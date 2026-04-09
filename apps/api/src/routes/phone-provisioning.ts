import type { FastifyInstance } from 'fastify';
import { PhoneNumberProvider, prisma } from '@frontdesk/db';
import { z } from 'zod';
import { getTwilioClient } from '../lib/twilio-client.js';

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

function getApiPublicBaseUrl() {
  return (process.env.FRONTDESK_API_PUBLIC_URL ?? 'http://localhost:4000').replace(/\/$/, '');
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'Unexpected error';
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
        numbers: availableNumbers.map((item) => ({
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

  app.post('/v1/provisioning/purchase-number', async (request, reply) => {
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
      const client = getTwilioClient();
      const baseUrl = getApiPublicBaseUrl();

      const purchasedNumber = await client.incomingPhoneNumbers.create({
        phoneNumber: parsed.data.phoneNumber,
        voiceUrl: `${baseUrl}/v1/twilio/voice/inbound`,
        voiceMethod: 'POST',
        statusCallback: `${baseUrl}/v1/twilio/voice/status`,
        statusCallbackMethod: 'POST'
      });

      const phoneNumber = await prisma.phoneNumber.create({
        data: {
          tenantId,
          businessId: business.id,
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
        ok: true,
        phoneNumber: {
          ...phoneNumber,
          capabilities: normalizeCapabilities(purchasedNumber.capabilities)
        }
      };
    } catch (error) {
      request.log.error({ err: error }, 'Failed to purchase Twilio phone number.');
      return reply.status(500).send({
        ok: false,
        error: getErrorMessage(error)
      });
    }
  });

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
