import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '@frontdesk/db';
import { z } from 'zod';
import { getTwilioClient } from '../lib/twilio-client.js';
import { findAvailableLocalNumber, provisionPhoneNumberForTenant } from './phone-provisioning.js';

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

const businessBodySchema = z
  .object({
    businessName: z.string().trim().min(2).max(100).optional(),
    industry: z.enum(INDUSTRY_VALUES).optional(),
    businessAddress: z.string().optional(),
    businessPhone: z.string().optional(),
    timezone: z.string().trim().min(1).optional()
  })
  .strict();

const greetingBodySchema = z
  .object({
    greeting: z.string().max(500).nullable().optional(),
    useDefault: z.boolean().optional()
  })
  .strict();

const webhookBodySchema = z
  .object({
    webhookUrl: z.string().url().nullable().optional(),
    webhookSecret: z.string().nullable().optional(),
    webhookEnabled: z.boolean().optional()
  })
  .strict();

const notificationsBodySchema = z
  .object({
    notifyEmail: z.boolean().optional(),
    notifySmsMissedCall: z.boolean().optional(),
    notifyEmailVoicemail: z.boolean().optional()
  })
  .strict();

const phoneProvisionBodySchema = z
  .object({
    areaCode: z
      .string()
      .regex(/^\d{3}$/)
      .optional()
  })
  .strict();

type SettingsTenant = {
  id: string;
  name: string;
  email: string | null;
  businessName: string | null;
  industry: string | null;
  businessAddress: string | null;
  businessPhone: string | null;
  timezone: string | null;
  greeting: string | null;
  twilioPhoneNumber: string | null;
  webhookUrl: string | null;
  webhookSecret: string | null;
  webhookEnabled: boolean;
  notifyEmail: boolean;
  notifySmsMissedCall: boolean;
  notifyEmailVoicemail: boolean;
  plan: string;
  subscriptionStatus: string;
  createdAt: Date;
};

function unauthorized(reply: FastifyReply) {
  return reply.status(401).send({
    error: 'Unauthorized'
  });
}

function normalizeOptionalString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'Unexpected error';
}

function maskWebhookSecret(secret: string | null) {
  if (!secret) {
    return null;
  }

  return `••••${secret.slice(-4)}`;
}

function buildDefaultGreeting(businessName: string | null) {
  const resolvedName = businessName && businessName.trim().length > 0 ? businessName.trim() : 'our office';
  return `Thanks for calling ${resolvedName}. How can we help you today?`;
}

async function getSettingsTenant(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<SettingsTenant | null> {
  const clerkUserId = request.clerkUserId;
  if (!clerkUserId) {
    unauthorized(reply);
    return null;
  }

  const tenant = await prisma.tenant.findUnique({
    where: {
      clerkUserId
    },
    select: {
      id: true,
      name: true,
      email: true,
      businessName: true,
      industry: true,
      businessAddress: true,
      businessPhone: true,
      timezone: true,
      greeting: true,
      twilioPhoneNumber: true,
      webhookUrl: true,
      webhookSecret: true,
      webhookEnabled: true,
      notifyEmail: true,
      notifySmsMissedCall: true,
      notifyEmailVoicemail: true,
      plan: true,
      subscriptionStatus: true,
      createdAt: true
    }
  });

  if (!tenant) {
    reply.status(404).send({
      error: 'Tenant not found'
    });
    return null;
  }

  return tenant;
}

const settings: FastifyPluginAsync = async (fastify) => {
  fastify.get('/v1/settings', async (request, reply) => {
    const tenant = await getSettingsTenant(request, reply);
    if (!tenant) {
      return reply;
    }

    return {
      business: {
        businessName: tenant.businessName,
        industry: tenant.industry,
        businessAddress: tenant.businessAddress,
        businessPhone: tenant.businessPhone,
        timezone: tenant.timezone
      },
      greeting: {
        greeting: tenant.greeting,
        defaultGreeting: buildDefaultGreeting(tenant.businessName)
      },
      phone: {
        twilioPhoneNumber: tenant.twilioPhoneNumber
      },
      webhook: {
        webhookUrl: tenant.webhookUrl,
        webhookSecret: maskWebhookSecret(tenant.webhookSecret),
        webhookEnabled: tenant.webhookEnabled
      },
      notifications: {
        notifyEmail: tenant.notifyEmail,
        notifySmsMissedCall: tenant.notifySmsMissedCall,
        notifyEmailVoicemail: tenant.notifyEmailVoicemail
      },
      account: {
        email: tenant.email ?? '',
        name: tenant.name,
        plan: tenant.plan,
        subscriptionStatus: tenant.subscriptionStatus,
        createdAt: tenant.createdAt.toISOString()
      }
    };
  });

  fastify.put('/v1/settings/business', async (request, reply) => {
    const parsed = businessBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid business settings payload'
      });
    }

    const tenant = await getSettingsTenant(request, reply);
    if (!tenant) {
      return reply;
    }

    const updates: {
      businessName?: string;
      industry?: (typeof INDUSTRY_VALUES)[number];
      businessAddress?: string | null;
      businessPhone?: string | null;
      timezone?: string;
    } = {};

    if ('businessName' in parsed.data && parsed.data.businessName !== undefined) {
      updates.businessName = parsed.data.businessName.trim();
    }

    if ('industry' in parsed.data && parsed.data.industry !== undefined) {
      updates.industry = parsed.data.industry;
    }

    if ('businessAddress' in parsed.data) {
      updates.businessAddress = normalizeOptionalString(parsed.data.businessAddress);
    }

    if ('businessPhone' in parsed.data) {
      updates.businessPhone = normalizeOptionalString(parsed.data.businessPhone);
    }

    if ('timezone' in parsed.data && parsed.data.timezone !== undefined) {
      updates.timezone = parsed.data.timezone.trim();
    }

    const updatedTenant = await prisma.tenant.update({
      where: {
        id: tenant.id
      },
      data: updates,
      select: {
        businessName: true,
        industry: true,
        businessAddress: true,
        businessPhone: true,
        timezone: true
      }
    });

    return {
      success: true,
      business: updatedTenant
    };
  });

  fastify.put('/v1/settings/greeting', async (request, reply) => {
    const parsed = greetingBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid greeting settings payload'
      });
    }

    const tenant = await getSettingsTenant(request, reply);
    if (!tenant) {
      return reply;
    }

    let nextGreeting = tenant.greeting;

    if (parsed.data.useDefault === true) {
      nextGreeting = null;
    } else if ('greeting' in parsed.data) {
      const greetingValue = parsed.data.greeting;
      nextGreeting = greetingValue === null ? null : normalizeOptionalString(greetingValue);
    }

    const updatedTenant = await prisma.tenant.update({
      where: {
        id: tenant.id
      },
      data: {
        greeting: nextGreeting
      },
      select: {
        greeting: true,
        businessName: true
      }
    });

    return {
      success: true,
      greeting: updatedTenant.greeting,
      defaultGreeting: buildDefaultGreeting(updatedTenant.businessName)
    };
  });

  fastify.put('/v1/settings/webhook', async (request, reply) => {
    const parsed = webhookBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid webhook settings payload'
      });
    }

    if (
      parsed.data.webhookUrl !== undefined &&
      parsed.data.webhookUrl !== null &&
      !parsed.data.webhookUrl.startsWith('https://')
    ) {
      return reply.status(400).send({
        error: 'Webhook URL must use HTTPS'
      });
    }

    if (
      parsed.data.webhookSecret !== undefined &&
      parsed.data.webhookSecret !== null &&
      parsed.data.webhookSecret.length < 8
    ) {
      return reply.status(400).send({
        error: 'Webhook secret must be at least 8 characters'
      });
    }

    const tenant = await getSettingsTenant(request, reply);
    if (!tenant) {
      return reply;
    }

    const updates: {
      webhookUrl?: string | null;
      webhookSecret?: string | null;
      webhookEnabled?: boolean;
    } = {};

    if ('webhookUrl' in parsed.data) {
      updates.webhookUrl = parsed.data.webhookUrl ? parsed.data.webhookUrl.trim() : null;
    }

    if ('webhookSecret' in parsed.data) {
      const webhookSecret = parsed.data.webhookSecret;
      updates.webhookSecret = webhookSecret ? webhookSecret : null;
    }

    if ('webhookEnabled' in parsed.data && parsed.data.webhookEnabled !== undefined) {
      updates.webhookEnabled = parsed.data.webhookEnabled;
    }

    const updatedTenant = await prisma.tenant.update({
      where: {
        id: tenant.id
      },
      data: updates,
      select: {
        webhookUrl: true,
        webhookSecret: true,
        webhookEnabled: true
      }
    });

    return {
      success: true,
      webhook: {
        webhookUrl: updatedTenant.webhookUrl,
        webhookEnabled: updatedTenant.webhookEnabled,
        webhookSecret: maskWebhookSecret(updatedTenant.webhookSecret)
      }
    };
  });

  fastify.put('/v1/settings/notifications', async (request, reply) => {
    const parsed = notificationsBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid notifications settings payload'
      });
    }

    const tenant = await getSettingsTenant(request, reply);
    if (!tenant) {
      return reply;
    }

    const updates: {
      notifyEmail?: boolean;
      notifySmsMissedCall?: boolean;
      notifyEmailVoicemail?: boolean;
    } = {};

    if ('notifyEmail' in parsed.data && parsed.data.notifyEmail !== undefined) {
      updates.notifyEmail = parsed.data.notifyEmail;
    }

    if ('notifySmsMissedCall' in parsed.data && parsed.data.notifySmsMissedCall !== undefined) {
      updates.notifySmsMissedCall = parsed.data.notifySmsMissedCall;
    }

    if ('notifyEmailVoicemail' in parsed.data && parsed.data.notifyEmailVoicemail !== undefined) {
      updates.notifyEmailVoicemail = parsed.data.notifyEmailVoicemail;
    }

    const updatedTenant = await prisma.tenant.update({
      where: {
        id: tenant.id
      },
      data: updates,
      select: {
        notifyEmail: true,
        notifySmsMissedCall: true,
        notifyEmailVoicemail: true
      }
    });

    return {
      success: true,
      notifications: updatedTenant
    };
  });

  fastify.post('/v1/settings/phone/provision', async (request, reply) => {
    const parsed = phoneProvisionBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid phone provision payload'
      });
    }

    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      return reply.status(503).send({
        error: 'Phone service not configured'
      });
    }

    const tenant = await getSettingsTenant(request, reply);
    if (!tenant) {
      return reply;
    }

    if (tenant.twilioPhoneNumber) {
      return reply.status(400).send({
        error: 'Phone number already provisioned. Release it first.'
      });
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
        twilioPhoneNumber: provisioned.phoneNumber.e164
      },
      select: {
        twilioPhoneNumber: true
      }
    });

    return {
      success: true,
      phoneNumber: updatedTenant.twilioPhoneNumber
    };
  });

  fastify.post('/v1/settings/phone/release', async (request, reply) => {
    const tenant = await getSettingsTenant(request, reply);
    if (!tenant) {
      return reply;
    }

    if (!tenant.twilioPhoneNumber) {
      return reply.status(400).send({
        error: 'No phone number to release'
      });
    }

    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      return reply.status(503).send({
        error: 'Phone service not configured'
      });
    }

    let releaseError: string | null = null;

    try {
      const client = getTwilioClient();
      const numbers = await client.incomingPhoneNumbers.list({
        phoneNumber: tenant.twilioPhoneNumber,
        limit: 1
      });

      const number = numbers[0];
      if (number?.sid) {
        await client.incomingPhoneNumbers(number.sid).remove();
      }
    } catch (error) {
      releaseError = toErrorMessage(error);
      request.log.error({ err: error }, 'Failed to release Twilio phone number in settings route.');
    }

    await prisma.tenant.update({
      where: {
        id: tenant.id
      },
      data: {
        twilioPhoneNumber: null
      }
    });

    if (releaseError) {
      return reply.status(500).send({
        error: releaseError
      });
    }

    return {
      success: true,
      released: true
    };
  });
};

export default settings;
