import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  prisma,
  ProspectAttemptChannel,
  ProspectAttemptOutcome,
  ProspectPriority,
  ProspectStatus
} from '@frontdesk/db';

const updateProspectBodySchema = z
  .object({
    companyName: z.string().min(1).max(160).optional(),
    contactName: z.string().min(1).max(160).nullable().optional(),
    contactPhone: z.string().min(1).max(40).nullable().optional(),
    contactEmail: z.string().email().max(160).nullable().optional(),
    city: z.string().min(1).max(120).nullable().optional(),
    state: z.string().min(1).max(80).nullable().optional(),
    sourceLabel: z.string().min(1).max(120).nullable().optional(),
    serviceInterest: z.string().min(1).max(240).nullable().optional(),
    notes: z.string().min(1).max(4000).nullable().optional(),
    status: z.nativeEnum(ProspectStatus).optional(),
    priority: z.nativeEnum(ProspectPriority).nullable().optional(),
    nextActionAt: z.coerce.date().nullable().optional()
  })
  .strict();

const logProspectAttemptBodySchema = z
  .object({
    channel: z.nativeEnum(ProspectAttemptChannel),
    outcome: z.nativeEnum(ProspectAttemptOutcome),
    note: z.string().min(1).max(4000).nullable().optional()
  })
  .strict();

function selectProspectAttemptSummary() {
  return {
    orderBy: {
      attemptedAt: 'desc' as const
    },
    take: 3,
    select: {
      channel: true,
      outcome: true,
      note: true,
      attemptedAt: true
    }
  };
}

function nextStatusForAttemptOutcome(outcome: ProspectAttemptOutcome) {
  if (outcome === ProspectAttemptOutcome.REPLIED) {
    return ProspectStatus.RESPONDED;
  }

  if (outcome === ProspectAttemptOutcome.BAD_FIT || outcome === ProspectAttemptOutcome.DO_NOT_CONTACT) {
    return ProspectStatus.DISQUALIFIED;
  }

  return ProspectStatus.ATTEMPTED;
}

export async function registerProspectWriteRoutes(app: FastifyInstance) {
  app.patch('/v1/prospects/:prospectSid', async (request, reply) => {
    const { prospectSid } = request.params as { prospectSid: string };
    const parsed = updateProspectBodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        error: parsed.error.flatten()
      });
    }

    if (Object.keys(parsed.data).length === 0) {
      return reply.status(400).send({
        ok: false,
        error: 'At least one field must be provided'
      });
    }

    const existing = await prisma.prospect.findUnique({
      where: { prospectSid },
      select: {
        id: true,
        status: true,
        archivedAt: true,
        respondedAt: true
      }
    });

    if (!existing) {
      return reply.notFound(`Prospect not found for prospectSid=${prospectSid}`);
    }

    const nextStatus = parsed.data.status;
    const shouldStampArchivedAt = nextStatus === ProspectStatus.ARCHIVED && !existing.archivedAt;
    const shouldStampRespondedAt =
      (nextStatus === ProspectStatus.RESPONDED || nextStatus === ProspectStatus.QUALIFIED) && !existing.respondedAt;

    const prospect = await prisma.prospect.update({
      where: { prospectSid },
      data: {
        companyName: parsed.data.companyName,
        contactName: parsed.data.contactName,
        contactPhone: parsed.data.contactPhone,
        contactEmail: parsed.data.contactEmail,
        city: parsed.data.city,
        state: parsed.data.state,
        sourceLabel: parsed.data.sourceLabel,
        serviceInterest: parsed.data.serviceInterest,
        notes: parsed.data.notes,
        status: nextStatus,
        priority: parsed.data.priority,
        nextActionAt: parsed.data.nextActionAt,
        archivedAt: shouldStampArchivedAt ? new Date() : undefined,
        respondedAt: shouldStampRespondedAt ? new Date() : undefined
      },
      select: {
        prospectSid: true,
        companyName: true,
        contactName: true,
        contactPhone: true,
        contactEmail: true,
        city: true,
        state: true,
        sourceLabel: true,
        serviceInterest: true,
        notes: true,
        status: true,
        priority: true,
        nextActionAt: true,
        lastAttemptAt: true,
        respondedAt: true,
        archivedAt: true
      }
    });

    return {
      ok: true,
      prospect
    };
  });

  app.post('/v1/prospects/:prospectSid/log-attempt', async (request, reply) => {
    const { prospectSid } = request.params as { prospectSid: string };
    const parsed = logProspectAttemptBodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        error: parsed.error.flatten()
      });
    }

    const existing = await prisma.prospect.findUnique({
      where: { prospectSid },
      select: {
        id: true,
        status: true,
        archivedAt: true,
        respondedAt: true
      }
    });

    if (!existing) {
      return reply.notFound(`Prospect not found for prospectSid=${prospectSid}`);
    }

    if (existing.status === ProspectStatus.ARCHIVED || existing.archivedAt) {
      return reply.status(400).send({
        ok: false,
        error: 'Archived prospects cannot receive new outreach attempts'
      });
    }

    const attemptedAt = new Date();
    const nextStatus = nextStatusForAttemptOutcome(parsed.data.outcome);

    const prospect = await prisma.$transaction(async (tx) => {
      await tx.prospectAttempt.create({
        data: {
          prospectId: existing.id,
          channel: parsed.data.channel,
          outcome: parsed.data.outcome,
          note: parsed.data.note ?? null,
          attemptedAt
        }
      });

      return tx.prospect.update({
        where: { id: existing.id },
        data: {
          status: nextStatus,
          lastAttemptAt: attemptedAt,
          respondedAt:
            nextStatus === ProspectStatus.RESPONDED && !existing.respondedAt
              ? attemptedAt
              : undefined
        },
        select: {
          prospectSid: true,
          status: true,
          priority: true,
          nextActionAt: true,
          lastAttemptAt: true,
          respondedAt: true,
          archivedAt: true,
          attempts: selectProspectAttemptSummary()
        }
      });
    });

    return {
      ok: true,
      prospect
    };
  });

  app.post('/v1/prospects/:prospectSid/archive', async (request, reply) => {
    const { prospectSid } = request.params as { prospectSid: string };

    const existing = await prisma.prospect.findUnique({
      where: { prospectSid },
      select: {
        id: true,
        status: true,
        archivedAt: true,
        respondedAt: true,
        lastAttemptAt: true
      }
    });

    if (!existing) {
      return reply.notFound(`Prospect not found for prospectSid=${prospectSid}`);
    }

    const prospect = await prisma.prospect.update({
      where: { prospectSid },
      data: {
        status: ProspectStatus.ARCHIVED,
        archivedAt: existing.archivedAt ?? new Date()
      },
      select: {
        prospectSid: true,
        status: true,
        lastAttemptAt: true,
        respondedAt: true,
        archivedAt: true
      }
    });

    return {
      ok: true,
      prospect
    };
  });
}
