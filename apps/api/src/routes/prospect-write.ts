import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ProspectPriority, ProspectStatus, prisma } from '@frontdesk/db';
import { isProspectTerminalStatus, normalizeProspectNextActionAt } from '@frontdesk/domain';

const updateProspectBodySchema = z
  .object({
    status: z.nativeEnum(ProspectStatus).optional(),
    priority: z.nativeEnum(ProspectPriority).nullable().optional(),
    notes: z.string().max(4000).nullable().optional(),
    nextActionAt: z.coerce.date().nullable().optional()
  })
  .strict();

export async function registerProspectWriteRoutes(app: FastifyInstance) {
  app.patch('/v1/businesses/:businessId/prospects/:prospectSid', async (request, reply) => {
    const { businessId, prospectSid } = request.params as {
      businessId: string;
      prospectSid: string;
    };

    const parsed = updateProspectBodySchema.safeParse(request.body);

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

    const nextStatus = parsed.data.status ?? existing.status;
    const nextActionAtUpdate =
      parsed.data.nextActionAt !== undefined
        ? normalizeProspectNextActionAt(nextStatus, parsed.data.nextActionAt)
        : isProspectTerminalStatus(nextStatus)
          ? null
          : undefined;

    const prospect = await prisma.prospect.update({
      where: {
        id: existing.id
      },
      data: {
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        ...(parsed.data.priority !== undefined ? { priority: parsed.data.priority } : {}),
        ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
        ...(nextActionAtUpdate !== undefined ? { nextActionAt: nextActionAtUpdate } : {})
      },
      select: {
        prospectSid: true,
        companyName: true,
        contactName: true,
        contactPhone: true,
        contactEmail: true,
        sourceLabel: true,
        status: true,
        priority: true,
        notes: true,
        nextActionAt: true,
        updatedAt: true
      }
    });

    return {
      ok: true,
      prospect
    };
  });
}
