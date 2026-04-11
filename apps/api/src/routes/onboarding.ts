import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '@frontdesk/db';
import { z } from 'zod';
import { findAvailableLocalNumber, provisionPhoneNumberForTenant } from './phone-provisioning.js';

type TenantRow = {
  id: string;
  name: string;
};

type CountRow = {
  count: number | bigint | string;
};

const INDUSTRY_VALUES = [
  'plumbing',
  'hvac',
  'electrical',
  'roofing',
  'landscaping',
  'cleaning',
  'pest-control',
  'painting',
  'general-contractor',
  'other'
] as const;

const businessInfoBodySchema = z
  .object({
    businessName: z.string().trim().min(2),
    industry: z.enum(INDUSTRY_VALUES),
    businessAddress: z.string().optional(),
    businessPhone: z.string().optional(),
    timezone: z.string().trim().min(1).optional()
  })
  .strict();

const greetingBodySchema = z
  .object({
    greeting: z.string().max(500).optional(),
    useDefault: z.boolean().optional()
  })
  .strict();

const phoneNumberBodySchema = z
  .object({
    areaCode: z
      .string()
      .regex(/^\d{3}$/)
      .optional()
  })
  .strict();

type OnboardingTenant = {
  id: string;
  onboardingStep: number;
  onboardingComplete: boolean;
  businessName: string | null;
  industry: string | null;
  businessAddress: string | null;
  businessPhone: string | null;
  timezone: string | null;
  greeting: string | null;
  twilioPhoneNumber: string | null;
  plan: string;
  subscriptionStatus: string;
};

const ONBOARDING_TENANT_SELECT = {
  id: true,
  onboardingStep: true,
  onboardingComplete: true,
  businessName: true,
  industry: true,
  businessAddress: true,
  businessPhone: true,
  timezone: true,
  greeting: true,
  twilioPhoneNumber: true,
  plan: true,
  subscriptionStatus: true
} as const;

function toCount(value: CountRow['count']) {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function unauthorized(reply: FastifyReply) {
  return reply.status(401).send({
    error: 'Unauthorized'
  });
}

function normalizeOptionalString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function createTenantSlugFromClerkUserId(clerkUserId: string) {
  const normalized = clerkUserId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  const suffix = randomUUID().replace(/-/g, '').slice(0, 8);
  const base = normalized.length > 0 ? normalized : 'tenant';
  return `${base}-${suffix}`;
}

async function ensureOnboardingTenant(clerkUserId: string): Promise<OnboardingTenant> {
  const tenant = await prisma.tenant.upsert({
    where: {
      clerkUserId
    },
    update: {},
    create: {
      name: 'New User',
      slug: createTenantSlugFromClerkUserId(clerkUserId),
      clerkUserId
    },
    select: ONBOARDING_TENANT_SELECT
  });

  await prisma.tenantUser.upsert({
    where: {
      clerkUserId
    },
    update: {
      tenantId: tenant.id,
      role: 'owner'
    },
    create: {
      clerkUserId,
      tenantId: tenant.id,
      role: 'owner'
    }
  });

  return tenant;
}

async function getOnboardingTenant(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<OnboardingTenant | null> {
  const clerkUserId = request.clerkUserId;

  if (!clerkUserId) {
    unauthorized(reply);
    return null;
  }

  const tenantUser = await prisma.tenantUser.findUnique({
    where: {
      clerkUserId
    },
    select: {
      tenantId: true
    }
  });

  if (tenantUser?.tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: {
        id: tenantUser.tenantId
      },
      select: ONBOARDING_TENANT_SELECT
    });

    if (tenant) {
      request.tenantId = tenant.id;
      request.tenantRole = 'owner';
      return tenant;
    }
  }

  const tenant = await ensureOnboardingTenant(clerkUserId);
  request.tenantId = tenant.id;
  request.tenantRole = 'owner';
  return tenant;
}

export async function registerOnboardingRoutes(app: FastifyInstance) {
  app.get('/v1/onboarding/status', async (request, reply) => {
    const tenantId = request.tenantId;

    if (!tenantId) {
      return reply.status(401).send({
        error: 'Unauthorized'
      });
    }

    const tenantRows = await prisma.$queryRaw<TenantRow[]>`
      SELECT "id", "name"
      FROM "Tenant"
      WHERE "id" = ${tenantId}
      LIMIT 1
    `;

    const tenant = tenantRows[0];

    if (!tenant) {
      return reply.status(404).send({
        error: 'Tenant not found'
      });
    }

    const subscriptionCountRows = await prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::int AS "count"
      FROM "Subscription"
      WHERE "tenantId" = ${tenantId}
        AND LOWER("status") IN ('active', 'trialing', 'past_due')
    `;

    const businessCountRows = await prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::int AS "count"
      FROM "Business"
      WHERE "tenantId" = ${tenantId}
    `;

    const phoneNumberCountRows = await prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::int AS "count"
      FROM "PhoneNumber"
      WHERE "tenantId" = ${tenantId}
        AND "isActive" = true
    `;

    const hasSubscription = toCount(subscriptionCountRows[0]?.count ?? 0) > 0;
    const hasBusinesses = toCount(businessCountRows[0]?.count ?? 0) > 0;
    const hasPhoneNumbers = toCount(phoneNumberCountRows[0]?.count ?? 0) > 0;

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      hasSubscription,
      hasBusinesses,
      hasPhoneNumbers,
      isOnboardingComplete: hasSubscription && hasBusinesses && hasPhoneNumbers
    };
  });
}

const onboarding: FastifyPluginAsync = async (fastify) => {
  fastify.get('/v1/onboarding/status', async (request, reply) => {
    const tenant = await getOnboardingTenant(request, reply);
    if (!tenant) {
      return reply;
    }

    const businessInfoComplete = Boolean(tenant.businessName && tenant.industry);
    const greetingComplete = Boolean(tenant.greeting);
    const phoneNumberComplete = Boolean(tenant.twilioPhoneNumber);
    const billingComplete = tenant.plan !== 'free' && tenant.subscriptionStatus === 'active';

    return {
      onboardingStep: tenant.onboardingStep,
      onboardingComplete: tenant.onboardingComplete,
      steps: {
        businessInfo: {
          complete: businessInfoComplete,
          data: {
            businessName: tenant.businessName,
            industry: tenant.industry,
            businessAddress: tenant.businessAddress,
            businessPhone: tenant.businessPhone,
            timezone: tenant.timezone
          }
        },
        greeting: {
          complete: greetingComplete,
          data: {
            greeting: tenant.greeting
          }
        },
        phoneNumber: {
          complete: phoneNumberComplete,
          data: {
            twilioPhoneNumber: tenant.twilioPhoneNumber
          }
        },
        billing: {
          complete: billingComplete,
          data: {
            plan: tenant.plan,
            subscriptionStatus: tenant.subscriptionStatus
          }
        }
      }
    };
  });

  fastify.post('/v1/onboarding/business-info', async (request, reply) => {
    const parsed = businessInfoBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid business info payload'
      });
    }

    const tenant = await getOnboardingTenant(request, reply);
    if (!tenant) {
      return reply;
    }

    await prisma.tenant.update({
      where: {
        id: tenant.id
      },
      data: {
        businessName: parsed.data.businessName.trim(),
        industry: parsed.data.industry,
        businessAddress: normalizeOptionalString(parsed.data.businessAddress),
        businessPhone: normalizeOptionalString(parsed.data.businessPhone),
        timezone: parsed.data.timezone?.trim() ?? 'America/New_York',
        onboardingStep: Math.max(tenant.onboardingStep, 1)
      }
    });

    return {
      success: true,
      onboardingStep: 1
    };
  });

  fastify.post('/v1/onboarding/greeting', async (request, reply) => {
    const parsed = greetingBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid greeting payload'
      });
    }

    const tenant = await getOnboardingTenant(request, reply);
    if (!tenant) {
      return reply;
    }

    let nextGreeting: string | null = null;
    if (parsed.data.useDefault) {
      nextGreeting = null;
    } else if (typeof parsed.data.greeting === 'string') {
      const trimmedGreeting = parsed.data.greeting.trim();
      if (trimmedGreeting.length > 500) {
        return reply.status(400).send({
          error: 'Greeting cannot exceed 500 characters'
        });
      }
      nextGreeting = trimmedGreeting.length > 0 ? trimmedGreeting : null;
    } else {
      return reply.status(400).send({
        error: 'Provide greeting text or set useDefault=true'
      });
    }

    const updatedTenant = await prisma.tenant.update({
      where: {
        id: tenant.id
      },
      data: {
        greeting: nextGreeting,
        onboardingStep: Math.max(tenant.onboardingStep, 2)
      },
      select: {
        greeting: true
      }
    });

    return {
      success: true,
      onboardingStep: 2,
      greeting: updatedTenant.greeting
    };
  });

  fastify.post('/v1/onboarding/phone-number', async (request, reply) => {
    const parsed = phoneNumberBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid phone number payload'
      });
    }

    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      return reply.status(503).send({
        error: 'Phone service not configured'
      });
    }

    const tenant = await getOnboardingTenant(request, reply);
    if (!tenant) {
      return reply;
    }

    if (tenant.twilioPhoneNumber) {
      await prisma.tenant.update({
        where: {
          id: tenant.id
        },
        data: {
          onboardingStep: Math.max(tenant.onboardingStep, 3)
        }
      });

      return {
        success: true,
        onboardingStep: 3,
        phoneNumber: tenant.twilioPhoneNumber
      };
    }

    const business =
      (await prisma.business.findFirst({
        where: {
          tenantId: tenant.id,
          isDefault: true
        },
        select: {
          id: true
        }
      })) ??
      (await prisma.business.findFirst({
        where: {
          tenantId: tenant.id
        },
        select: {
          id: true
        }
      }));

    if (!business) {
      return reply.status(400).send({
        error: 'Complete business setup first'
      });
    }

    const availableNumber = await findAvailableLocalNumber({
      areaCode: parsed.data.areaCode
    });

    if (!availableNumber?.phoneNumber) {
      return reply.status(503).send({
        error: 'No phone numbers available right now'
      });
    }

    const provisioned = await provisionPhoneNumberForTenant({
      tenantId: tenant.id,
      businessId: business.id,
      phoneNumber: availableNumber.phoneNumber
    });

    const updatedTenant = await prisma.tenant.update({
      where: {
        id: tenant.id
      },
      data: {
        twilioPhoneNumber: provisioned.phoneNumber.e164,
        onboardingStep: Math.max(tenant.onboardingStep, 3)
      },
      select: {
        twilioPhoneNumber: true
      }
    });

    return {
      success: true,
      onboardingStep: 3,
      phoneNumber: updatedTenant.twilioPhoneNumber
    };
  });

  fastify.post('/v1/onboarding/complete', async (request, reply) => {
    const tenant = await getOnboardingTenant(request, reply);
    if (!tenant) {
      return reply;
    }

    if (!tenant.businessName || !tenant.industry) {
      return reply.status(400).send({
        error: 'Complete business info first'
      });
    }

    if (!tenant.twilioPhoneNumber) {
      return reply.status(400).send({
        error: 'Provision a phone number first'
      });
    }

    await prisma.tenant.update({
      where: {
        id: tenant.id
      },
      data: {
        onboardingStep: 4,
        onboardingComplete: true
      }
    });

    return {
      success: true,
      onboardingComplete: true
    };
  });

  fastify.post('/v1/onboarding/skip', async (request, reply) => {
    const tenant = await getOnboardingTenant(request, reply);
    if (!tenant) {
      return reply;
    }

    await prisma.tenant.update({
      where: {
        id: tenant.id
      },
      data: {
        onboardingComplete: true
      }
    });

    return {
      success: true,
      skipped: true
    };
  });
};

export default onboarding;
