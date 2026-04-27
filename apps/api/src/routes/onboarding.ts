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

type TwilioLikeError = {
  status?: unknown;
  message?: unknown;
};

type AgentLanguage = 'en' | 'es' | 'bilingual';

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
  name: string;
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
  name: true,
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

const TRIAL_LENGTH_DAYS = 14;

function getTrialEndsAt() {
  return new Date(Date.now() + TRIAL_LENGTH_DAYS * 24 * 60 * 60 * 1000);
}

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

function normalizeAgentLanguage(value: string | null | undefined): AgentLanguage | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'en' || normalized === 'es' || normalized === 'bilingual') {
    return normalized;
  }

  return null;
}

function normalizeTwilioError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return {
      status: null,
      message: ''
    };
  }

  const value = error as TwilioLikeError;
  const status = typeof value.status === 'number' ? value.status : null;
  const message = typeof value.message === 'string' ? value.message.trim() : '';

  return {
    status,
    message
  };
}

function getOnboardingProvisioningError(error: unknown) {
  const normalized = normalizeTwilioError(error);

  if (normalized.status === 400 || normalized.status === 404) {
    return {
      statusCode: 503,
      error: 'Could not provision a phone number right now. Try another area code or leave the field blank.'
    };
  }

  if (normalized.status === 401 || normalized.status === 403) {
    return {
      statusCode: 503,
      error: 'Phone service is not fully configured. Please contact support.'
    };
  }

  if (normalized.message.length > 0) {
    return {
      statusCode: 503,
      error: normalized.message
    };
  }

  return {
    statusCode: 503,
    error: 'Unable to provision a phone number right now. Please try again in a minute.'
  };
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

async function ensureDefaultBusinessForTenant(tenant: Pick<OnboardingTenant, 'id' | 'name' | 'businessName' | 'timezone'>) {
  await prisma.business.upsert({
    where: {
      tenantId_slug: {
        tenantId: tenant.id,
        slug: 'main'
      }
    },
    update: {
      isDefault: true,
      timezone: tenant.timezone ?? 'America/New_York'
    },
    create: {
      tenantId: tenant.id,
      name: tenant.businessName ?? tenant.name,
      slug: 'main',
      vertical: 'OTHER',
      timezone: tenant.timezone ?? 'America/New_York',
      isDefault: true
    }
  });
}

async function getTenantVoiceAgentLanguage(tenantId: string): Promise<AgentLanguage | null> {
  const agentProfile = await prisma.agentProfile.findFirst({
    where: {
      tenantId,
      channel: 'VOICE',
      isActive: true
    },
    orderBy: {
      createdAt: 'asc'
    },
    select: {
      language: true
    }
  });

  return normalizeAgentLanguage(agentProfile?.language);
}

async function ensureTenantVoiceAgentLanguage(tenant: OnboardingTenant, language: AgentLanguage) {
  const updateResult = await prisma.agentProfile.updateMany({
    where: {
      tenantId: tenant.id,
      channel: 'VOICE',
      isActive: true
    },
    data: {
      language
    }
  });

  if (updateResult.count > 0) {
    return;
  }

  const business = await prisma.business.findFirst({
    where: {
      tenantId: tenant.id,
      isDefault: true
    },
    select: {
      id: true
    }
  });

  if (!business) {
    return;
  }

  await prisma.agentProfile.create({
    data: {
      tenantId: tenant.id,
      businessId: business.id,
      name: 'Default Voice Agent',
      channel: 'VOICE',
      language,
      isActive: true
    }
  });
}

async function ensureOnboardingTenant(clerkUserId: string): Promise<OnboardingTenant> {
  const trialEndsAt = getTrialEndsAt();

  const tenant = await prisma.tenant.upsert({
    where: {
      clerkUserId
    },
    update: {},
    create: {
      name: 'New User',
      slug: createTenantSlugFromClerkUserId(clerkUserId),
      clerkUserId,
      subscriptionStatus: 'none'
    },
    select: ONBOARDING_TENANT_SELECT
  });

  await prisma.$executeRaw`
    UPDATE "Tenant"
    SET "trialEndsAt" = COALESCE("trialEndsAt", ${trialEndsAt})
    WHERE "id" = ${tenant.id}
      AND "subscriptionStatus" = 'trialing'
  `;

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

  await ensureDefaultBusinessForTenant(tenant);

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
      await ensureDefaultBusinessForTenant(tenant);
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
    const language = await getTenantVoiceAgentLanguage(tenant.id);

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
            greeting: tenant.greeting,
            language
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
    // Manual validation — no Zod schema so no spurious 400s from body shape variations.
    // Accept any object (or null/string body) and extract what we need defensively.
    const rawBody = request.body;
    const body: Record<string, unknown> =
      rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody)
        ? (rawBody as Record<string, unknown>)
        : typeof rawBody === 'string'
          ? (() => {
              try {
                return JSON.parse(rawBody) as Record<string, unknown>;
              } catch {
                return {};
              }
            })()
          : {};

    const rawGreeting = body['greeting'];
    const rawLanguage = body['language'];

    const greetingStr = typeof rawGreeting === 'string' ? rawGreeting.trim() : null;
    const language = normalizeAgentLanguage(typeof rawLanguage === 'string' ? rawLanguage : null);

    if (greetingStr !== null && greetingStr.length > 500) {
      return reply.status(400).send({
        error: 'Greeting cannot exceed 500 characters'
      });
    }

    // Empty string, missing, or useDefault=true all resolve to null (system default)
    const nextGreeting = greetingStr && greetingStr.length > 0 ? greetingStr : null;

    const tenant = await getOnboardingTenant(request, reply);
    if (!tenant) {
      return reply;
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

    if (language) {
      await ensureTenantVoiceAgentLanguage(tenant, language);
    }

    return {
      success: true,
      onboardingStep: 2,
      greeting: updatedTenant.greeting,
      ...(language ? { language } : {})
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

    let availableNumber: Awaited<ReturnType<typeof findAvailableLocalNumber>>;
    try {
      availableNumber = await findAvailableLocalNumber({
        areaCode: parsed.data.areaCode
      });
    } catch (error) {
      request.log.error(
        { err: error, tenantId: tenant.id, areaCode: parsed.data.areaCode ?? null },
        'Failed to search available onboarding phone numbers.'
      );
      return reply.status(503).send({
        error: 'Unable to search available phone numbers right now. Please try again in a minute.'
      });
    }

    if (!availableNumber?.phoneNumber) {
      return reply.status(503).send({
        error: 'No phone numbers available right now'
      });
    }

    let provisioned: Awaited<ReturnType<typeof provisionPhoneNumberForTenant>>;
    try {
      provisioned = await provisionPhoneNumberForTenant({
        tenantId: tenant.id,
        businessId: business.id,
        phoneNumber: availableNumber.phoneNumber
      });
    } catch (error) {
      request.log.error(
        {
          err: error,
          tenantId: tenant.id,
          businessId: business.id,
          phoneNumber: availableNumber.phoneNumber
        },
        'Failed to provision onboarding phone number.'
      );

      const mappedError = getOnboardingProvisioningError(error);
      return reply.status(mappedError.statusCode).send({
        error: mappedError.error
      });
    }

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
