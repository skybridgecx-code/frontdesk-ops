import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  ProspectAttemptChannel,
  ProspectAttemptOutcome,
  ProspectStatus,
  prisma
} from '@frontdesk/db';

const createProspectAttemptBodySchema = z
  .object({
    channel: z.nativeEnum(ProspectAttemptChannel),
    outcome: z.nativeEnum(ProspectAttemptOutcome),
    note: z.string().max(4000).nullable().optional(),
    attemptedAt: z.coerce.date().optional()
  })
  .strict();

export async function registerProspectAttemptWriteRoutes(app: FastifyInstance) {
  app.post('/v1/businesses/:businessId/prospects/:prospectSid/attempts', async (request, reply) => {
    const { businessId, prospectSid } = request.params as {
      businessId: string;
      prospectSid: string;
    };

    const parsed = createProspectAttemptBodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        error: parsed.error.flatten()
      });
    }

    const existing = await prisma.prospect.findFirst({
      where: {
        businessId,
        prospectSid
      },
      select: {
        id: true,
        status: true
      }
    });

    if (!existing) {
      return reply.notFound(`Prospect not found for businessId=${businessId} prospectSid=${prospectSid}`);
    }

    const attemptedAt = parsed.data.attemptedAt ?? new Date();

    const [attempt] = await prisma.$transaction([
      prisma.prospectAttempt.create({
        data: {
          prospectId: existing.id,
          channel: parsed.data.channel,
          outcome: parsed.data.outcome,
          note: parsed.data.note ?? null,
          attemptedAt
        },
        select: {
          id: true,
          channel: true,
          outcome: true,
          note: true,
          attemptedAt: true,
          createdAt: true
        }
      }),
      prisma.prospect.update({
        where: { id: existing.id },
        data: {
          lastAttemptAt: attemptedAt,
          ...(existing.status === ProspectStatus.NEW || existing.status === ProspectStatus.READY
            ? { status: ProspectStatus.ATTEMPTED }
            : {})
        },
        select: {
          prospectSid: true,
          status: true,
          lastAttemptAt: true
        }
      })
    ]);

    return {
      ok: true,
      attempt
    };
  });
}
