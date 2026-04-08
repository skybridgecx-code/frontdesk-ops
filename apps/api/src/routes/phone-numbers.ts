import type { FastifyInstance } from 'fastify';
import { prisma } from '@frontdesk/db';
import { phoneNumberIdParams } from '../lib/params.js';

export async function registerPhoneNumberRoutes(app: FastifyInstance) {
  app.get('/v1/phone-numbers/:phoneNumberId', async (request, reply) => {
    const { phoneNumberId } = phoneNumberIdParams.parse(request.params);

    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: {
        id: phoneNumberId,
        ...(request.tenantId ? { tenantId: request.tenantId } : {})
      },
      select: {
        id: true,
        tenantId: true,
        businessId: true,
        locationId: true,
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
        updatedAt: true,
        location: {
          select: {
            id: true,
            name: true,
            city: true,
            state: true,
            isPrimary: true
          }
        },
        primaryAgentProfile: {
          select: {
            id: true,
            name: true,
            channel: true,
            language: true,
            voiceName: true,
            isActive: true
          }
        },
        afterHoursAgentProfile: {
          select: {
            id: true,
            name: true,
            channel: true,
            language: true,
            voiceName: true,
            isActive: true
          }
        }
      }
    });

    if (!phoneNumber) {
      return reply.notFound(`Phone number not found for id=${phoneNumberId}`);
    }

    return {
      ok: true,
      phoneNumber
    };
  });
}
