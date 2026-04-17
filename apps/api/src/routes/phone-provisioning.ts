import type { FastifyInstance } from 'fastify';
import { PhoneNumberProvider, prisma } from '@frontdesk/db';
import { z } from 'zod';
import { getTwilioClient } from '../lib/twilio-client.js';
import { enforceUsageLimits } from '../lib/usage-limiter.js';
import { requireAdminAuth } from '../lib/admin-auth.js';

const searchNumbersQuerySchema = z
  .object({
    country: z
      .string()
      .length(2)
      .transform((value) => value.toUpperCase())
      .default('US'),
    areaCode: z
      .string()
      .regex(/^\d{3}$/)
      .optional(),
    contains: z.string().min(2).max(16).optional(),
    limit: z.coerce.number().int().min(1).max(20).default(10)
  })
  .strict();

const purchaseNumberBodySchema = z
  .object({
    phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/),
    businessId: z.string().min(1)
  })
  .strict();

const releaseNumberBodySchema = z
  .object({
    phoneNumberId: z.string().min(1)
  })
  .strict();

const attachExistingNumberBodySchema = z
  .object({
    tenantId: z.string().min(1),
    businessId: z.string().min(1),
    phoneNumber: z.string().min(1)
  })
  .strict();

type ProvisionPhoneNumberInput = {
  tenantId: string;
  businessId: string;
  phoneNumber: string;
};

function getApiPublicBaseUrl() {
  const configuredBaseUrl =
    process.env.FRONTDESK_API_PUBLIC_URL?.trim() ||
    process.env.FRONTDESK_API_BASE_URL?.trim() ||
    process.env.RENDER_EXTERNAL_URL?.trim() ||
    'http://localhost:4000';

  return configuredBaseUrl.replace(/\/+$/, '');
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'Unexpected error';
}

function normalizeE164(value: string) {
  const normalized = value.trim().replace(/[^\d+]/g, '');
  if (normalized.length === 0 || !normalized.startsWith('+')) {
    return null;
  }

  return /^\+[1-9]\d{1,14}$/.test(normalized) ? normalized : null;
}

function normalizeCapabilities(capabilities: unknown) {
  if (!capabilities || typeof capabilities !== 'object') {
    return null;
  }

  const value = capabilities as Record<string, unknown>;

  const result = {
    voice: Boolean(value.voice),
    sms: Boolean(value.sms),
    mms: Boolean(value.mms),
    fax: Boolean(value.fax)
  };

  return result;
}

export async function findAvailableLocalNumber(input: { areaCode?: string }) {
  const client = getTwilioClient();
  const options = {
    voiceEnabled: true,
    smsEnabled: true,
    limit: 1,
    ...(input.areaCode ? { areaCode: Number(input.areaCode) } : {})
  };

  const numbers = await client.availablePhoneNumbers('US').local.list(options);
  return numbers[0] ?? null;
}

export async function provisionPhoneNumberForTenant(input: ProvisionPhoneNumberInput) {
  const client = getTwilioClient();
  const baseUrl = getApiPublicBaseUrl();

  const purchasedNumber = await client.incomingPhoneNumbers.create({
    phoneNumber: input.phoneNumber,
    voiceUrl: `${baseUrl}/v1/twilio/voice/inbound`,
    voiceMethod: 'POST',
    statusCallback: `${baseUrl}/v1/twilio/voice/status`,
    statusCallbackMethod: 'POST'
  });

  const phoneNumber = await prisma.phoneNumber.create({
    data: {
      tenantId: input.tenantId,
      businessId: input.businessId,
      provider: PhoneNumberProvider.TWILIO,
      externalSid: purchasedNumber.sid,
      e164: purchasedNumber.phoneNumber,
      label: purchasedNumber.friendlyName ?? purchasedNumber.phoneNumber,
      isActive: true
    },
    select: {
      id: true,
      tenantId: true,
      businessId: true,
      provider: true,
      externalSid: true,
      e164: true,
      label: true,
      isActive: true,
      routingMode: true,
      primaryAgentProfileId: true,
      afterHoursAgentProfileId: true,
      enableMissedCallTextBack: true,
      createdAt: true,
      updatedAt: true
    }
  });

  return {
    phoneNumber,
    purchasedNumber
  };
}

export async function registerPhoneProvisioningRoutes(app: FastifyInstance) {
  app.get('/v1/provisioning/search-numbers', async (request, reply) => {
    const parsed = searchNumbersQuerySchema.safeParse(request.query);

    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        error: parsed.error.flatten()
      });
    }

    try {
      const client = getTwilioClient();
      const options = {
        limit: parsed.data.limit,
        ...(parsed.data.areaCode ? { areaCode: Number(parsed.data.areaCode) } : {}),
        ...(parsed.data.contains ? { contains: parsed.data.contains } : {})
      };

      const availableNumbers = await client.availablePhoneNumbers(parsed.data.country).local.list(options);

      return {
        ok: true,
        numbers: availableNumbers.map((item: {
          phoneNumber: string;
          friendlyName: string;
          locality?: string;
          region?: string;
          postalCode?: string;
          isoCountry?: string;
          capabilities?: unknown;
        }) => ({
          phoneNumber: item.phoneNumber,
          friendlyName: item.friendlyName ?? item.phoneNumber,
          locality: item.locality ?? null,
          region: item.region ?? null,
          postalCode: item.postalCode ?? null,
          capabilities: normalizeCapabilities(item.capabilities)
        }))
      };
    } catch (error) {
      request.log.error({ err: error }, 'Failed to search available Twilio phone numbers.');
      return reply.status(500).send({
        ok: false,
        error: getErrorMessage(error)
      });
    }
  });

  app.post(
    '/v1/provisioning/purchase-number',
    { preHandler: enforceUsageLimits('phone_numbers') },
    async (request, reply) => {
    const parsed = purchaseNumberBodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        error: parsed.error.flatten()
      });
    }

    const tenantId = request.tenantId;

    if (!tenantId) {
      return reply.status(401).send({
        error: 'Unauthorized'
      });
    }

    const business = await prisma.business.findFirst({
      where: {
        id: parsed.data.businessId,
        tenantId
      },
      select: {
        id: true,
        tenantId: true
      }
    });

    if (!business) {
      return reply.status(403).send({
        error: 'Forbidden'
      });
    }

    try {
      const result = await provisionPhoneNumberForTenant({
        tenantId,
        businessId: business.id,
        phoneNumber: parsed.data.phoneNumber
      });

      return {
        ok: true,
        phoneNumber: {
          ...result.phoneNumber,
          capabilities: normalizeCapabilities(result.purchasedNumber.capabilities)
        }
      };
    } catch (error) {
      request.log.error({ err: error }, 'Failed to purchase Twilio phone number.');
      return reply.status(500).send({
        ok: false,
        error: getErrorMessage(error)
      });
    }
    }
  );

  app.post(
    '/v1/admin/provisioning/attach-existing-number',
    { preHandler: requireAdminAuth },
    async (request, reply) => {
      const parsed = attachExistingNumberBodySchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          ok: false,
          error: parsed.error.flatten()
        });
      }

      const normalizedPhoneNumber = normalizeE164(parsed.data.phoneNumber);

      if (!normalizedPhoneNumber) {
        return reply.status(400).send({
          ok: false,
          error: 'phoneNumber must be a valid E.164 number'
        });
      }

      const business = await prisma.business.findFirst({
        where: {
          id: parsed.data.businessId,
          tenantId: parsed.data.tenantId
        },
        select: {
          id: true,
          tenantId: true
        }
      });

      if (!business) {
        return reply.status(403).send({
          ok: false,
          error: 'Business does not belong to tenant'
        });
      }

      const existingAssignment = await prisma.phoneNumber.findUnique({
        where: {
          e164: normalizedPhoneNumber
        },
        select: {
          id: true,
          tenantId: true
        }
      });

      if (existingAssignment && existingAssignment.tenantId !== parsed.data.tenantId) {
        return reply.status(409).send({
          ok: false,
          error: 'Phone number is already assigned to another tenant'
        });
      }

      try {
        const client = getTwilioClient();
        const baseUrl = getApiPublicBaseUrl();
        const twilioNumbers = await client.incomingPhoneNumbers.list({
          phoneNumber: normalizedPhoneNumber,
          limit: 1
        });

        const twilioNumber = twilioNumbers[0];

        if (!twilioNumber?.sid) {
          return reply.status(404).send({
            ok: false,
            error: 'Twilio number not found in configured account'
          });
        }

        const updatedTwilioNumber = await client.incomingPhoneNumbers(twilioNumber.sid).update({
          voiceUrl: `${baseUrl}/v1/twilio/voice/inbound`,
          voiceMethod: 'POST',
          statusCallback: `${baseUrl}/v1/twilio/voice/status`,
          statusCallbackMethod: 'POST'
        });

        const phoneNumber = await prisma.phoneNumber.upsert({
          where: {
            e164: normalizedPhoneNumber
          },
          update: {
            tenantId: parsed.data.tenantId,
            businessId: business.id,
            provider: PhoneNumberProvider.TWILIO,
            externalSid: twilioNumber.sid,
            label: twilioNumber.friendlyName ?? twilioNumber.phoneNumber ?? normalizedPhoneNumber,
            isActive: true
          },
          create: {
            tenantId: parsed.data.tenantId,
            businessId: business.id,
            provider: PhoneNumberProvider.TWILIO,
            externalSid: twilioNumber.sid,
            e164: normalizedPhoneNumber,
            label: twilioNumber.friendlyName ?? twilioNumber.phoneNumber ?? normalizedPhoneNumber,
            isActive: true
          },
          select: {
            id: true,
            tenantId: true,
            businessId: true,
            provider: true,
            externalSid: true,
            e164: true,
            label: true,
            isActive: true,
            routingMode: true,
            primaryAgentProfileId: true,
            afterHoursAgentProfileId: true,
            enableMissedCallTextBack: true,
            createdAt: true,
            updatedAt: true
          }
        });

        return {
          ok: true,
          phoneNumber: {
            ...phoneNumber,
            capabilities: normalizeCapabilities(updatedTwilioNumber.capabilities)
          }
        };
      } catch (error) {
        request.log.error({ err: error }, 'Failed to attach existing Twilio phone number.');
        return reply.status(500).send({
          ok: false,
          error: getErrorMessage(error)
        });
      }
    }
  );

  app.post('/v1/provisioning/release-number', async (request, reply) => {
    const parsed = releaseNumberBodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        error: parsed.error.flatten()
      });
    }

    const tenantId = request.tenantId;

    if (!tenantId) {
      return reply.status(401).send({
        error: 'Unauthorized'
      });
    }

    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: {
        id: parsed.data.phoneNumberId,
        tenantId
      },
      select: {
        id: true,
        externalSid: true,
        isActive: true
      }
    });

    if (!phoneNumber) {
      return reply.status(403).send({
        error: 'Forbidden'
      });
    }

    try {
      if (phoneNumber.externalSid) {
        const client = getTwilioClient();
        await client.incomingPhoneNumbers(phoneNumber.externalSid).remove();
      }

      await prisma.phoneNumber.update({
        where: {
          id: phoneNumber.id
        },
        data: {
          isActive: false
        }
      });

      return {
        success: true
      };
    } catch (error) {
      request.log.error({ err: error }, 'Failed to release Twilio phone number.');
      return reply.status(500).send({
        ok: false,
        error: getErrorMessage(error)
      });
    }
  });
}
