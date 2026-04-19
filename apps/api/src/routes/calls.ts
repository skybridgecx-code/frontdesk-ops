import type { FastifyInstance } from 'fastify';
import { prisma, CallReviewStatus, CallTriageStatus } from '@frontdesk/db';
import type { Prisma } from '@frontdesk/db';
import { callSidParams } from '../lib/params.js';

const VOICE_HANDLING_EVENT_TYPES = [
  'twilio.inbound.fallback',
  'textback.sent',
  'textback.skipped'
] as const;

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
  recordingUrl: true,
  recordingSid: true,
  recordingDuration: true,
  recordingStatus: true,
  textBackSent: true,
  textBackSentAt: true,
  events: {
    where: {
      type: {
        in: [...VOICE_HANDLING_EVENT_TYPES]
      }
    },
    orderBy: { sequence: 'desc' },
    take: 10,
    select: {
      type: true,
      sequence: true,
      payloadJson: true
    }
  },
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

function getTextBackSkippedReason(payload: Prisma.JsonValue | null) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  const reason = (payload as Record<string, unknown>).reason;
  return typeof reason === 'string' && reason.trim().length > 0 ? reason : null;
}

function summarizeSkippedReason(reason: string | null) {
  if (!reason) return null;

  switch (reason) {
    case 'destination_number_not_found':
      return 'no sender line';
    case 'textback_disabled':
      return 'text-back off';
    case 'missing_caller_number':
      return 'caller number missing';
    case 'provider_send_failed':
      return 'sms failed';
    default:
      return reason.replaceAll('_', ' ');
  }
}

function parsePage(value: string | undefined) {
  return Math.max(Number(value ?? '1') || 1, 1);
}

function parseLimit(value: string | undefined) {
  return Math.min(Math.max(Number(value ?? '25') || 25, 1), 100);
}

function buildCallWhere(
  query: {
    triageStatus?: string;
    reviewStatus?: string;
    urgency?: string;
    q?: string;
  },
  tenantId?: string
) {
  const where: Prisma.CallWhereInput = {
    ...(tenantId ? { tenantId } : {})
  };

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
    const where = buildCallWhere(query, request.tenantId);

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

    const callsWithVoiceHandling = calls.map((call) => {
      const fallbackUsed = call.events.some((event) => event.type === 'twilio.inbound.fallback');
      const latestTextBackEvent = call.events.find(
        (event) => event.type === 'textback.sent' || event.type === 'textback.skipped'
      );
      const textBackOutcome =
        latestTextBackEvent?.type === 'textback.sent'
          ? 'sent'
          : latestTextBackEvent?.type === 'textback.skipped'
            ? 'skipped'
            : null;
      const textBackSkippedReason =
        latestTextBackEvent?.type === 'textback.skipped'
          ? summarizeSkippedReason(getTextBackSkippedReason(latestTextBackEvent.payloadJson))
          : null;

      const { events, ...rest } = call;

      return {
        ...rest,
        voiceHandling: {
          fallbackUsed,
          textBackOutcome,
          textBackSkippedReason
        }
      };
    });

    return {
      ok: true,
      calls: callsWithVoiceHandling,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    };
  });

  app.get('/v1/calls/summary', async (request) => {
    const tenantWhere = request.tenantId ? { tenantId: request.tenantId } : {};

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
      prisma.call.count({ where: tenantWhere }),
      prisma.call.count({ where: { ...tenantWhere, triageStatus: CallTriageStatus.OPEN } }),
      prisma.call.count({ where: { ...tenantWhere, triageStatus: CallTriageStatus.CONTACTED } }),
      prisma.call.count({ where: { ...tenantWhere, triageStatus: CallTriageStatus.ARCHIVED } }),
      prisma.call.count({ where: { ...tenantWhere, reviewStatus: CallReviewStatus.UNREVIEWED } }),
      prisma.call.count({ where: { ...tenantWhere, reviewStatus: CallReviewStatus.NEEDS_REVIEW } }),
      prisma.call.count({ where: { ...tenantWhere, reviewStatus: CallReviewStatus.REVIEWED } }),
      prisma.call.count({ where: { ...tenantWhere, urgency: 'high' } }),
      prisma.call.count({ where: { ...tenantWhere, urgency: 'emergency' } })
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

    const call = await prisma.call.findFirst({
      where: {
        twilioCallSid: callSid,
        ...(request.tenantId ? { tenantId: request.tenantId } : {})
      },
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
        recordingUrl: true,
        recordingSid: true,
        recordingDuration: true,
        recordingStatus: true,
        textBackSent: true,
        textBackSentAt: true,
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
            createdAt: true,
            payloadJson: true
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
