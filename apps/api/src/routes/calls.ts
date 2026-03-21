import type { FastifyInstance } from 'fastify';
import { prisma } from '@frontdesk/db';

export async function registerCallRoutes(app: FastifyInstance) {
  app.get('/v1/calls', async (request) => {
    const query = request.query as { limit?: string };
    const limit = Math.min(Math.max(Number(query.limit ?? '20') || 20, 1), 100);

    const calls = await prisma.call.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        twilioCallSid: true,
        twilioStreamSid: true,
        direction: true,
        status: true,
        routeKind: true,
        fromE164: true,
        toE164: true,
        leadName: true,
        leadPhone: true,
        leadIntent: true,
        urgency: true,
        serviceAddress: true,
        summary: true,
        callerTranscript: true,
        assistantTranscript: true,
        startedAt: true,
        answeredAt: true,
        endedAt: true,
        durationSeconds: true,
        phoneNumber: {
          select: {
            e164: true,
            label: true
          }
        },
        agentProfile: {
          select: {
            name: true,
            voiceName: true
          }
        }
      }
    });

    return {
      ok: true,
      calls
    };
  });

  app.get('/v1/calls/:callSid', async (request, reply) => {
    const { callSid } = request.params as { callSid: string };

    const call = await prisma.call.findUnique({
      where: { twilioCallSid: callSid },
      select: {
        id: true,
        twilioCallSid: true,
        twilioStreamSid: true,
        direction: true,
        status: true,
        routeKind: true,
        fromE164: true,
        toE164: true,
        callerTranscript: true,
        assistantTranscript: true,
        leadName: true,
        leadPhone: true,
        leadIntent: true,
        urgency: true,
        serviceAddress: true,
        summary: true,
        startedAt: true,
        answeredAt: true,
        endedAt: true,
        durationSeconds: true,
        phoneNumber: {
          select: {
            id: true,
            e164: true,
            label: true,
            routingMode: true
          }
        },
        agentProfile: {
          select: {
            id: true,
            name: true,
            voiceName: true,
            isActive: true
          }
        },
        events: {
          orderBy: { sequence: 'asc' },
          select: {
            type: true,
            sequence: true,
            createdAt: true
          }
        }
      }
    });

    if (!call) {
      return reply.notFound(`Call not found for callSid=${callSid}`);
    }

    return {
      ok: true,
      call
    };
  });
}
