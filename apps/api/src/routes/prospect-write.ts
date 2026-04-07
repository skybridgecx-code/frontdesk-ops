import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prospectParams } from '../lib/params.js';
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

export function buildProspectWriteUpdateData(input: {
  currentStatus: ProspectStatus;
  status?: ProspectStatus;
  priority?: ProspectPriority | null;
  notes?: string | null;
  nextActionAt?: Date | null;
}) {
  const nextStatus = input.status ?? input.currentStatus;
  const nextActionAt =
    input.nextActionAt !== undefined
      ? normalizeProspectNextActionAt(nextStatus, input.nextActionAt)
      : isProspectTerminalStatus(nextStatus)
        ? null
        : undefined;

  return {
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    ...(nextActionAt !== undefined ? { nextActionAt } : {})
  };
}

export async function registerProspectWriteRoutes(app: FastifyInstance) {
  app.patch('/v1/businesses/:businessId/prospects/:prospectSid', async (request, reply) => {
        const { businessId, prospectSid } = prospectParams.parse(request.params);

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

    const prospect = await prisma.prospect.update({
      where: {
        id: existing.id
      },
      data: buildProspectWriteUpdateData({
        currentStatus: existing.status,
        status: parsed.data.status,
        priority: parsed.data.priority,
        notes: parsed.data.notes,
        nextActionAt: parsed.data.nextActionAt
      }),
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
