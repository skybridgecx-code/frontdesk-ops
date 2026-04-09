import type { FastifyInstance } from 'fastify';
import { prisma } from '@frontdesk/db';

const terminalTypeToStatus = {
  'twilio.media.stop': 'COMPLETED',
  'twilio.status.completed': 'COMPLETED',
  'twilio.status.busy': 'BUSY',
  'twilio.status.no-answer': 'NO_ANSWER',
  'twilio.status.failed': 'FAILED',
  'twilio.status.canceled': 'CANCELED'
} as const;

export async function registerCallBackfillRoutes(app: FastifyInstance) {
  app.post('/v1/admin/calls/backfill-statuses', async (request) => {
    const candidates = await prisma.call.findMany({
      where: {
        status: {
          in: ['RINGING', 'IN_PROGRESS']
        },
        ...(request.tenantId ? { tenantId: request.tenantId } : {})
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        twilioCallSid: true,
        status: true,
        answeredAt: true,
        endedAt: true,
        events: {
          where: {
            type: {
              in: Object.keys(terminalTypeToStatus)
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1,
          select: {
            type: true,
            createdAt: true
          }
        }
      }
    });

    const updatedCalls: Array<{
      twilioCallSid: string;
      previousStatus: string;
      newStatus: string;
      endedAt: string;
      sourceEventType: string;
    }> = [];

    for (const call of candidates) {
      const lastTerminalEvent = call.events[0];
      if (!lastTerminalEvent) continue;

      const newStatus = terminalTypeToStatus[lastTerminalEvent.type as keyof typeof terminalTypeToStatus];
      if (!newStatus) continue;

      await prisma.call.update({
        where: { id: call.id },
        data: {
          status: newStatus,
          endedAt: call.endedAt ?? lastTerminalEvent.createdAt
        }
      });

      updatedCalls.push({
        twilioCallSid: call.twilioCallSid,
        previousStatus: call.status,
        newStatus,
        endedAt: (call.endedAt ?? lastTerminalEvent.createdAt).toISOString(),
        sourceEventType: lastTerminalEvent.type
      });
    }

    return {
      ok: true,
      updatedCount: updatedCalls.length,
      updatedCalls
    };
  });
}
