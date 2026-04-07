import type { FastifyInstance } from 'fastify';
import { prisma, CallReviewStatus, CallTriageStatus } from '@frontdesk/db';
import type { Prisma } from '@frontdesk/db';
import { callSidParams } from '../lib/params.js';
const callListSelect = {
  twilioCallSid: true,
  twilioStreamSid: true,
  direction: true,
  status: true,
  routeKind: true,
  triageStatus: true,
  reviewStatus: true,
  contactedAt: true,
  archivedAt: true,
  reviewedAt: true,
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
} satisfies Prisma.CallSelect;

function parsePage(value: string | undefined) {
  return Math.max(Number(value ?? '1') || 1, 1);
}

function parseLimit(value: string | undefined) {
  return Math.min(Math.max(Number(value ?? '25') || 25, 1), 100);
}

function buildCallWhere(query: {
  triageStatus?: string;
  reviewStatus?: string;
  urgency?: string;
  q?: string;
}) {
  const where: Prisma.CallWhereInput = {};

  if (
    query.triageStatus === CallTriageStatus.OPEN ||
    query.triageStatus === CallTriageStatus.CONTACTED ||
    query.triageStatus === CallTriageStatus.ARCHIVED
  ) {
    where.triageStatus = query.triageStatus;
  }

  if (
    query.reviewStatus === CallReviewStatus.UNREVIEWED ||
    query.reviewStatus === CallReviewStatus.REVIEWED ||
    query.reviewStatus === CallReviewStatus.NEEDS_REVIEW
  ) {
    where.reviewStatus = query.reviewStatus;
  }

  if (
    query.urgency === 'low' ||
    query.urgency === 'medium' ||
    query.urgency === 'high' ||
    query.urgency === 'emergency'
  ) {
    where.urgency = query.urgency;
  }

  const q = query.q?.trim();
  if (q) {
    where.OR = [
      { twilioCallSid: { contains: q, mode: 'insensitive' } },
      { fromE164: { contains: q, mode: 'insensitive' } },
      { toE164: { contains: q, mode: 'insensitive' } },
      { leadName: { contains: q, mode: 'insensitive' } },
      { leadPhone: { contains: q, mode: 'insensitive' } },
      { leadIntent: { contains: q, mode: 'insensitive' } },
      { serviceAddress: { contains: q, mode: 'insensitive' } },
      { summary: { contains: q, mode: 'insensitive' } }
    ];
  }

  return where;
}

export async function registerCallRoutes(app: FastifyInstance) {
  app.get('/v1/calls', async (request) => {
    const query = request.query as {
      limit?: string;
      page?: string;
      triageStatus?: string;
      reviewStatus?: string;
      urgency?: string;
      q?: string;
    };

    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);
    const where = buildCallWhere(query);

    const [total, calls] = await prisma.$transaction([
      prisma.call.count({ where }),
      prisma.call.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: callListSelect
      })
    ]);

    return {
      ok: true,
      calls,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    };
  });

  app.get('/v1/calls/summary', async () => {
    const [
      totalCalls,
      openCalls,
      contactedCalls,
      archivedCalls,
      unreviewedCalls,
      needsReviewCalls,
      reviewedCalls,
      highUrgencyCalls,
      emergencyCalls
    ] = await prisma.$transaction([
      prisma.call.count(),
      prisma.call.count({ where: { triageStatus: CallTriageStatus.OPEN } }),
      prisma.call.count({ where: { triageStatus: CallTriageStatus.CONTACTED } }),
      prisma.call.count({ where: { triageStatus: CallTriageStatus.ARCHIVED } }),
      prisma.call.count({ where: { reviewStatus: CallReviewStatus.UNREVIEWED } }),
      prisma.call.count({ where: { reviewStatus: CallReviewStatus.NEEDS_REVIEW } }),
      prisma.call.count({ where: { reviewStatus: CallReviewStatus.REVIEWED } }),
      prisma.call.count({ where: { urgency: 'high' } }),
      prisma.call.count({ where: { urgency: 'emergency' } })
    ]);

    return {
      ok: true,
      totalCalls,
      openCalls,
      contactedCalls,
      archivedCalls,
      unreviewedCalls,
      needsReviewCalls,
      reviewedCalls,
      highUrgencyCalls,
      emergencyCalls
    };
  });

  app.get('/v1/calls/:callSid', async (request, reply) => {
    const { callSid } = callSidParams.parse(request.params);

    const call = await prisma.call.findUnique({
      where: { twilioCallSid: callSid },
      select: {
        id: true,
        twilioCallSid: true,
        twilioStreamSid: true,
        direction: true,
        status: true,
        routeKind: true,
        triageStatus: true,
        reviewStatus: true,
        contactedAt: true,
        archivedAt: true,
        reviewedAt: true,
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
        operatorNotes: true,
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
