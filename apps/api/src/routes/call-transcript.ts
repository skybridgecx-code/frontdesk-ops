import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@frontdesk/db';
import { callSidParams } from '../lib/params.js';

const updateTranscriptBodySchema = z.object({
  callerTranscript: z.string().nullable().optional(),
  assistantTranscript: z.string().nullable().optional()
});

export async function registerCallTranscriptRoutes(app: FastifyInstance) {
  app.patch('/v1/calls/:callSid/transcript', async (request, reply) => {
    const { callSid } = callSidParams.parse(request.params);
    const parsed = updateTranscriptBodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        error: parsed.error.flatten()
      });
    }

    const existing = await prisma.call.findUnique({
      where: { twilioCallSid: callSid },
      select: { id: true }
    });

    if (!existing) {
      return reply.notFound(`Call not found for callSid=${callSid}`);
    }

    const call = await prisma.call.update({
      where: { twilioCallSid: callSid },
      data: {
        callerTranscript:
          parsed.data.callerTranscript === undefined
            ? undefined
            : parsed.data.callerTranscript,
        assistantTranscript:
          parsed.data.assistantTranscript === undefined
            ? undefined
            : parsed.data.assistantTranscript
      },
      select: {
        twilioCallSid: true,
        callerTranscript: true,
        assistantTranscript: true
      }
    });

    return {
      ok: true,
      call
    };
  });
}
