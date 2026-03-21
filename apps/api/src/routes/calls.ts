import type { FastifyInstance } from 'fastify';
import { prisma } from '@frontdesk/db';

export async function registerCallRoutes(app: FastifyInstance) {
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
