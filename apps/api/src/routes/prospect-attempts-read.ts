import type { FastifyInstance } from 'fastify';
import { prisma } from '@frontdesk/db';
import { prospectParams } from '../lib/params.js';

export async function registerProspectAttemptReadRoutes(app: FastifyInstance) {
  app.get('/v1/businesses/:businessId/prospects/:prospectSid/attempts', async (request, reply) => {
    const { businessId, prospectSid } = prospectParams.parse(request.params);

    const prospect = await prisma.prospect.findFirst({
      where: {
        businessId,
        prospectSid,
        ...(request.tenantId ? { tenantId: request.tenantId } : {})
      },
      select: {
        id: true
      }
    });

    if (!prospect) {
      return reply.notFound(`Prospect not found for businessId=${businessId} prospectSid=${prospectSid}`);
    }

    const attempts = await prisma.prospectAttempt.findMany({
      where: {
        prospectId: prospect.id
      },
      orderBy: {
        attemptedAt: 'desc'
      },
      select: {
        id: true,
        channel: true,
        outcome: true,
        note: true,
        attemptedAt: true,
        createdAt: true
      }
    });

    return {
      ok: true,
      attempts
    };
  });
}
