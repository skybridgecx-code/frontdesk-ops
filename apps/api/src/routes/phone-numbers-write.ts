import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { PhoneRoutingMode, prisma } from '@frontdesk/db';
import { phoneNumberIdParams } from '../lib/params.js';
import { requireAdminAuth } from '../lib/admin-auth.js';

const updatePhoneNumberBodySchema = z.object({
  label: z.string().min(1).max(120).optional(),
  isActive: z.boolean().optional(),
  routingMode: z.nativeEnum(PhoneRoutingMode).optional(),
  primaryAgentProfileId: z.string().cuid().nullable().optional(),
  afterHoursAgentProfileId: z.string().cuid().nullable().optional(),
  enableMissedCallTextBack: z.boolean().optional()
});

export async function registerPhoneNumberWriteRoutes(app: FastifyInstance) {
  const handlePhoneNumberUpdate = async (
    request: FastifyRequest,
    reply: FastifyReply,
    options: { requireTenant: boolean }
  ) => {
    const { phoneNumberId } = phoneNumberIdParams.parse(request.params);
    const parsed = updatePhoneNumberBodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: parsed.error.flatten() });
    }

    if (options.requireTenant && !request.tenantId) {
      return reply.status(401).send({
        error: 'Unauthorized'
      });
    }

    const existingPhoneNumber = await prisma.phoneNumber.findFirst({
      where: {
        id: phoneNumberId,
        ...(options.requireTenant && request.tenantId ? { tenantId: request.tenantId } : {})
      },
      select: {
        id: true,
        businessId: true,
        tenantId: true
      }
    });

    if (!existingPhoneNumber) {
      return reply.notFound(`Phone number not found for id=${phoneNumberId}`);
    }

    if (parsed.data.primaryAgentProfileId) {
      const primaryAgent = await prisma.agentProfile.findFirst({
        where: {
          id: parsed.data.primaryAgentProfileId,
          ...(options.requireTenant && request.tenantId ? { tenantId: request.tenantId } : {})
        },
        select: { id: true, businessId: true, tenantId: true }
      });

      if (!primaryAgent) {
        return reply.notFound(`Primary agent not found for id=${parsed.data.primaryAgentProfileId}`);
      }

      if (
        primaryAgent.businessId !== existingPhoneNumber.businessId ||
        primaryAgent.tenantId !== existingPhoneNumber.tenantId
      ) {
        return reply.status(400).send({
          ok: false,
          error: 'Primary agent must belong to the same business and tenant as the phone number'
        });
      }
    }

    if (parsed.data.afterHoursAgentProfileId) {
      const afterHoursAgent = await prisma.agentProfile.findFirst({
        where: {
          id: parsed.data.afterHoursAgentProfileId,
          ...(options.requireTenant && request.tenantId ? { tenantId: request.tenantId } : {})
        },
        select: { id: true, businessId: true, tenantId: true }
      });

      if (!afterHoursAgent) {
        return reply.notFound(`After-hours agent not found for id=${parsed.data.afterHoursAgentProfileId}`);
      }

      if (
        afterHoursAgent.businessId !== existingPhoneNumber.businessId ||
        afterHoursAgent.tenantId !== existingPhoneNumber.tenantId
      ) {
        return reply.status(400).send({
          ok: false,
          error: 'After-hours agent must belong to the same business and tenant as the phone number'
        });
      }
    }

    const phoneNumber = await prisma.phoneNumber.update({
      where: { id: existingPhoneNumber.id },
      data: parsed.data,
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
        updatedAt: true,
        primaryAgentProfile: {
          select: {
            id: true,
            name: true,
            voiceName: true,
            isActive: true
          }
        },
        afterHoursAgentProfile: {
          select: {
            id: true,
            name: true,
            voiceName: true,
            isActive: true
          }
        }
      }
    });

    return {
      ok: true,
      phoneNumber
    };
  };

  app.patch('/v1/phone-numbers/:phoneNumberId', async (request, reply) => {
    return handlePhoneNumberUpdate(request, reply, { requireTenant: true });
  });

  app.patch(
    '/v1/admin/phone-numbers/:phoneNumberId',
    { preHandler: requireAdminAuth },
    async (request, reply) => {
      return handlePhoneNumberUpdate(request, reply, { requireTenant: false });
    }
  );
}
