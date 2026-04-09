import type { FastifyInstance } from 'fastify';
import { prisma, CallTriageStatus } from '@frontdesk/db';
import { callSidParams } from '../lib/params.js';

export async function registerCallTriageRoutes(app: FastifyInstance) {
  app.post('/v1/calls/:callSid/mark-contacted', async (request, reply) => {
    const { callSid } = callSidParams.parse(request.params);

    const existing = await prisma.call.findFirst({
      where: {
        twilioCallSid: callSid,
        ...(request.tenantId ? { tenantId: request.tenantId } : {})
      },
      select: { id: true }
    });

    if (!existing) {
      return reply.notFound(`Call not found for callSid=${callSid}`);
    }

    const call = await prisma.call.update({
      where: { id: existing.id },
      data: {
        triageStatus: CallTriageStatus.CONTACTED,
        contactedAt: new Date()
      },
      select: {
        twilioCallSid: true,
        triageStatus: true,
        contactedAt: true,
        archivedAt: true
      }
    });

    return {
      ok: true,
      call
    };
  });

  app.post('/v1/calls/:callSid/archive', async (request, reply) => {
    const { callSid } = callSidParams.parse(request.params);

    const existing = await prisma.call.findFirst({
      where: {
        twilioCallSid: callSid,
        ...(request.tenantId ? { tenantId: request.tenantId } : {})
      },
      select: { id: true }
    });

    if (!existing) {
      return reply.notFound(`Call not found for callSid=${callSid}`);
    }

    const call = await prisma.call.update({
      where: { id: existing.id },
      data: {
        triageStatus: CallTriageStatus.ARCHIVED,
        archivedAt: new Date()
      },
      select: {
        twilioCallSid: true,
        triageStatus: true,
        contactedAt: true,
        archivedAt: true
      }
    });

    return {
      ok: true,
      call
    };
  });
}
