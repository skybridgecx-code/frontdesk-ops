import type { FastifyInstance } from 'fastify';
import { prisma, CallTriageStatus } from '@frontdesk/db';

export async function registerCallTriageRoutes(app: FastifyInstance) {
  app.post('/v1/calls/:callSid/mark-contacted', async (request, reply) => {
    const { callSid } = request.params as { callSid: string };

    const existing = await prisma.call.findUnique({
      where: { twilioCallSid: callSid },
      select: {
        id: true,
        triageStatus: true,
        contactedAt: true,
        archivedAt: true
      }
    });

    if (!existing) {
      return reply.notFound(`Call not found for callSid=${callSid}`);
    }

    const call = await prisma.call.update({
      where: { twilioCallSid: callSid },
      data: {
        triageStatus:
          existing.triageStatus === CallTriageStatus.ARCHIVED || existing.archivedAt
            ? CallTriageStatus.ARCHIVED
            : CallTriageStatus.CONTACTED,
        contactedAt: existing.contactedAt ?? new Date()
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
    const { callSid } = request.params as { callSid: string };

    const existing = await prisma.call.findUnique({
      where: { twilioCallSid: callSid },
      select: {
        id: true,
        triageStatus: true,
        contactedAt: true,
        archivedAt: true
      }
    });

    if (!existing) {
      return reply.notFound(`Call not found for callSid=${callSid}`);
    }

    const call = await prisma.call.update({
      where: { twilioCallSid: callSid },
      data: {
        triageStatus: CallTriageStatus.ARCHIVED,
        archivedAt: existing.archivedAt ?? new Date()
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
