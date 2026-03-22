import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma, CallTriageStatus } from '@frontdesk/db';

const bulkCallBodySchema = z.object({
  callSids: z.array(z.string().trim().min(1))
});

function parseUniqueCallSids(body: unknown) {
  const parsed = bulkCallBodySchema.safeParse(body);

  if (!parsed.success) {
    return {
      ok: false as const,
      error: 'Invalid request body'
    };
  }

  const callSids = [...new Set(parsed.data.callSids)];

  if (callSids.length === 0) {
    return {
      ok: false as const,
      error: 'callSids must contain at least one value'
    };
  }

  return {
    ok: true as const,
    callSids
  };
}

export async function registerCallBulkTriageRoutes(app: FastifyInstance) {
  app.post('/v1/calls/bulk/mark-contacted', async (request, reply) => {
    const parsed = parseUniqueCallSids(request.body);

    if (!parsed.ok) {
      return reply.code(400).send({
        ok: false,
        error: parsed.error
      });
    }

    const now = new Date();
    const result = await prisma.call.updateMany({
      where: {
        twilioCallSid: {
          in: parsed.callSids
        }
      },
      data: {
        triageStatus: CallTriageStatus.CONTACTED,
        contactedAt: now
      }
    });

    return {
      ok: true,
      updatedCount: result.count,
      callSids: parsed.callSids
    };
  });

  app.post('/v1/calls/bulk/archive', async (request, reply) => {
    const parsed = parseUniqueCallSids(request.body);

    if (!parsed.ok) {
      return reply.code(400).send({
        ok: false,
        error: parsed.error
      });
    }

    const now = new Date();
    const result = await prisma.call.updateMany({
      where: {
        twilioCallSid: {
          in: parsed.callSids
        }
      },
      data: {
        triageStatus: CallTriageStatus.ARCHIVED,
        archivedAt: now
      }
    });

    return {
      ok: true,
      updatedCount: result.count,
      callSids: parsed.callSids
    };
  });
}
