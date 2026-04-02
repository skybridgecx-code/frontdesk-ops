import type { FastifyInstance } from 'fastify';
import { prisma, Prisma, CallReviewStatus, CallTriageStatus } from '@frontdesk/db';
import { buildFrontdeskCallActionGuide } from '@frontdesk/domain';
import {
  getLatestCallRoutingDecision,
  parseCallRoutingDecisionPayload
} from '../lib/call-routing-decision.js';
import {
  buildCallScopeSql,
  buildCallScopeWhere,
  CALL_PRIORITY_ORDER_SQL,
  normalizeCallScopeQuery
} from '../lib/call-selectors.js';

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
  },
  events: {
    where: {
      type: 'frontdesk.route.decision'
    },
    orderBy: {
      createdAt: 'asc' as const
    },
    select: {
      type: true,
      createdAt: true,
      payloadJson: true
    }
  }
} satisfies Prisma.CallSelect;

type CallListOrderRow = {
  twilioCallSid: string;
};

type CallRoutingDecisionSummary = {
  routingMode: string | null;
  isOpen: boolean | null;
  routeKind: string | null;
  agentProfileId: string | null;
  reason: string | null;
  message: string | null;
  phoneLineLabel: string | null;
  businessTimezone: string | null;
} | null;

type CallQueueRoutingSummary = {
  routeKind: string | null;
  businessStateLabel: 'Open' | 'Closed' | null;
  routingMode: string | null;
  phoneLineLabel: string | null;
  routingReasonLabel: string | null;
} | null;

type CallTimelineEvent = {
  type: string;
  createdAt: Date | string;
};

type CallOperatorTimelineInput = {
  startedAt: Date | string;
  answeredAt: Date | string | null;
  endedAt: Date | string | null;
  durationSeconds: number | null;
  fromE164: string | null;
  toE164: string | null;
  reviewStatus: string;
  contactedAt: Date | string | null;
  archivedAt: Date | string | null;
  reviewedAt: Date | string | null;
  phoneNumberLabel: string | null;
  routingDecision: CallRoutingDecisionSummary;
  events: CallTimelineEvent[];
};

export type CallOperatorTimelineItem = {
  type: string;
  occurredAt: string;
  title: string;
  description: string;
  actorLabel: string | null;
  statusLabel: string | null;
};

type CallLastActivityPreview = {
  lastActivityAt: string;
  lastActivityTitle: string;
  lastActivityDetail: string | null;
};

type CallLastActivityCandidate = CallLastActivityPreview & {
  priority: number;
};

function parsePage(value: string | undefined) {
  return Math.max(Number(value ?? '1') || 1, 1);
}

function parseLimit(value: string | undefined) {
  return Math.min(Math.max(Number(value ?? '25') || 25, 1), 100);
}

function formatTimelineLabel(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return value.toLowerCase().replaceAll('_', ' ').replace(/^\w/, (match) => match.toUpperCase());
}

function buildCallQueueRoutingSummary(
  routingDecision: CallRoutingDecisionSummary,
  fallback: {
    routeKind: string | null;
    phoneLineLabel: string | null;
  }
): CallQueueRoutingSummary {
  const routeKind = routingDecision?.routeKind ?? fallback.routeKind ?? null;
  const routingMode = routingDecision?.routingMode ?? null;
  const phoneLineLabel = routingDecision?.phoneLineLabel ?? fallback.phoneLineLabel ?? null;
  const routingReasonLabel =
    formatTimelineLabel(routingDecision?.reason) ??
    formatTimelineLabel(routingDecision?.message) ??
    null;
  const businessStateLabel =
    routingDecision?.isOpen == null ? null : routingDecision.isOpen ? 'Open' : 'Closed';

  if (!routeKind && !routingMode && !phoneLineLabel && !businessStateLabel && !routingReasonLabel) {
    return null;
  }

  return {
    routeKind,
    businessStateLabel,
    routingMode,
    phoneLineLabel,
    routingReasonLabel
  };
}

function pickLatestCallActivity(candidates: CallLastActivityCandidate[]) {
  const candidate = candidates
    .filter((entry) => Boolean(entry.lastActivityAt))
    .sort((left, right) => {
      if (left.lastActivityAt === right.lastActivityAt) {
        return right.priority - left.priority;
      }

      return right.lastActivityAt.localeCompare(left.lastActivityAt);
    })[0];

  if (!candidate) {
    return {
      lastActivityAt: new Date(0).toISOString(),
      lastActivityTitle: 'Started',
      lastActivityDetail: null
    };
  }

  return {
    lastActivityAt: candidate.lastActivityAt,
    lastActivityTitle: candidate.lastActivityTitle,
    lastActivityDetail: candidate.lastActivityDetail
  };
}

function toTimelineInstant(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function getLatestTimelineEventInstant(events: CallTimelineEvent[], type: string) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index]?.type === type) {
      return toTimelineInstant(events[index]?.createdAt);
    }
  }

  return null;
}

function buildCallLastActivityPreview(input: {
  startedAt: Date | string | null;
  endedAt: Date | string | null;
  reviewedAt: Date | string | null;
  contactedAt: Date | string | null;
  archivedAt: Date | string | null;
  events: Array<{
    type: string;
    createdAt: Date | string;
    payloadJson?: unknown;
  }>;
}) {
  const routeEvent = [...input.events]
    .filter((event) => event.type === 'frontdesk.route.decision')
    .sort((left, right) => {
      const leftAt = toTimelineInstant(left.createdAt) ?? '';
      const rightAt = toTimelineInstant(right.createdAt) ?? '';
      return rightAt.localeCompare(leftAt);
    })[0];
  const routingDecision = parseCallRoutingDecisionPayload(routeEvent?.payloadJson);
  const routingDetail =
    [formatTimelineLabel(routingDecision?.routeKind), routingDecision?.phoneLineLabel]
      .filter(Boolean)
      .join(' · ') || null;

  return pickLatestCallActivity([
    {
      lastActivityAt: toTimelineInstant(input.archivedAt) ?? '',
      lastActivityTitle: 'Archived',
      lastActivityDetail: null,
      priority: 6
    },
    {
      lastActivityAt: toTimelineInstant(input.contactedAt) ?? '',
      lastActivityTitle: 'Marked contacted',
      lastActivityDetail: null,
      priority: 5
    },
    {
      lastActivityAt: toTimelineInstant(input.reviewedAt) ?? '',
      lastActivityTitle: 'Reviewed',
      lastActivityDetail: null,
      priority: 4
    },
    {
      lastActivityAt: toTimelineInstant(routeEvent?.createdAt) ?? '',
      lastActivityTitle: 'Routing decision recorded',
      lastActivityDetail: routingDetail,
      priority: 3
    },
    {
      lastActivityAt: toTimelineInstant(input.endedAt) ?? '',
      lastActivityTitle: 'Ended',
      lastActivityDetail: null,
      priority: 2
    },
    {
      lastActivityAt: toTimelineInstant(input.startedAt) ?? '',
      lastActivityTitle: 'Started',
      lastActivityDetail: null,
      priority: 1
    }
  ]);
}

function pushTimelineItem(
  items: CallOperatorTimelineItem[],
  item: Omit<CallOperatorTimelineItem, 'occurredAt'> & { occurredAt: string | null }
) {
  if (!item.occurredAt) {
    return;
  }

  items.push({
    ...item,
    occurredAt: item.occurredAt
  });
}

function formatCallDuration(durationSeconds: number | null) {
  if (durationSeconds == null) {
    return null;
  }

  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

export function buildCallOperatorTimeline(input: CallOperatorTimelineInput) {
  const items: CallOperatorTimelineItem[] = [];

  const startContext = [input.fromE164 ? `from ${input.fromE164}` : null, input.toE164 ? `to ${input.toE164}` : null]
    .filter(Boolean)
    .join(' ');

  pushTimelineItem(items, {
    type: 'call.started',
    occurredAt: toTimelineInstant(input.startedAt),
    title: 'Inbound call started',
    description: startContext ? `Inbound call received ${startContext}.` : 'Inbound call received.',
    actorLabel: input.phoneNumberLabel ?? null,
    statusLabel: null
  });

  pushTimelineItem(items, {
    type: 'call.answered',
    occurredAt: toTimelineInstant(input.answeredAt),
    title: 'Frontdesk answered the call',
    description: 'The frontdesk agent picked up and handled the caller.',
    actorLabel: input.phoneNumberLabel ?? null,
    statusLabel: null
  });

  const routingOccurredAt = getLatestTimelineEventInstant(input.events, 'frontdesk.route.decision');
  const routingDescription =
    input.routingDecision?.message ??
    ([
      input.routingDecision?.routeKind ? `Route ${formatTimelineLabel(input.routingDecision.routeKind)}` : null,
      input.routingDecision?.reason ? `Reason ${formatTimelineLabel(input.routingDecision.reason)}` : null
    ]
      .filter(Boolean)
      .join(' · ') || 'Routing policy decision recorded for operator review.');

  pushTimelineItem(items, {
    type: 'frontdesk.route.decision',
    occurredAt: routingOccurredAt,
    title: 'Routing decision recorded',
    description: routingDescription,
    actorLabel: input.routingDecision?.phoneLineLabel ?? input.phoneNumberLabel ?? 'Routing policy',
    statusLabel: formatTimelineLabel(input.routingDecision?.routeKind)
  });

  pushTimelineItem(items, {
    type: 'call.reviewed',
    occurredAt: toTimelineInstant(input.reviewedAt),
    title: 'Operator reviewed the call',
    description: `Current review state: ${formatTimelineLabel(input.reviewStatus) ?? 'Unknown'}.`,
    actorLabel: 'Operator',
    statusLabel: formatTimelineLabel(input.reviewStatus)
  });

  pushTimelineItem(items, {
    type: 'call.contacted',
    occurredAt: toTimelineInstant(input.contactedAt),
    title: 'Caller marked contacted',
    description: 'An operator marked this caller as contacted.',
    actorLabel: 'Operator',
    statusLabel: 'Contacted'
  });

  pushTimelineItem(items, {
    type: 'call.archived',
    occurredAt: toTimelineInstant(input.archivedAt),
    title: 'Call archived',
    description: 'This call was archived and removed from active operator work.',
    actorLabel: 'Operator',
    statusLabel: 'Archived'
  });

  const durationLabel = formatCallDuration(input.durationSeconds);
  pushTimelineItem(items, {
    type: 'call.ended',
    occurredAt: toTimelineInstant(input.endedAt),
    title: 'Call ended',
    description: durationLabel ? `The live call completed after ${durationLabel}.` : 'The live call completed.',
    actorLabel: input.phoneNumberLabel ?? null,
    statusLabel: null
  });

  return items.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
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
    const skip = (page - 1) * limit;
    const scope = normalizeCallScopeQuery(query);
    const where = buildCallScopeWhere(scope);

    const [total, orderedRows] = await prisma.$transaction([
      prisma.call.count({ where }),
      prisma.$queryRaw<CallListOrderRow[]>(Prisma.sql`
        SELECT "twilioCallSid"
        FROM "Call"
        WHERE 1 = 1
        ${buildCallScopeSql(scope)}
        ${CALL_PRIORITY_ORDER_SQL}
        OFFSET ${skip}
        LIMIT ${limit}
      `)
    ]);

    const orderedCallSids = orderedRows.map((row) => row.twilioCallSid);
    const calls =
      orderedCallSids.length === 0
        ? []
        : await prisma.call.findMany({
            where: {
              twilioCallSid: {
                in: orderedCallSids
              }
            },
            select: callListSelect
          });
    const callsBySid = new Map(calls.map((call) => [call.twilioCallSid, call]));
    const orderedCalls = orderedCallSids
      .map((callSid) => callsBySid.get(callSid))
      .filter((call): call is (typeof calls)[number] => Boolean(call));

    return {
      ok: true,
      calls: orderedCalls.map((call) => {
        const { events, ...rest } = call;
        const routingDecision = getLatestCallRoutingDecision(call.events);

        return {
          ...rest,
          routingSummary: buildCallQueueRoutingSummary(routingDecision, {
            routeKind: call.routeKind,
            phoneLineLabel: call.phoneNumber.label
          }),
          lastActivityPreview: buildCallLastActivityPreview({
            startedAt: call.startedAt,
            endedAt: call.endedAt,
            reviewedAt: call.reviewedAt,
            contactedAt: call.contactedAt,
            archivedAt: call.archivedAt,
            events: call.events
          })
        };
      }),
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
            createdAt: true,
            payloadJson: true
          }
        }
      }
    });

    if (!call) {
      return reply.notFound(`Call not found for callSid=${callSid}`);
    }

    const actionGuide = buildFrontdeskCallActionGuide({
      triageStatus: call.triageStatus,
      reviewStatus: call.reviewStatus,
      contactedAt: call.contactedAt,
      archivedAt: call.archivedAt,
      urgency: call.urgency,
      leadName: call.leadName,
      leadPhone: call.leadPhone,
      fromE164: call.fromE164,
      leadIntent: call.leadIntent,
      serviceAddress: call.serviceAddress,
      summary: call.summary,
      callerTranscript: call.callerTranscript,
      assistantTranscript: call.assistantTranscript
    });
    const routingDecision = getLatestCallRoutingDecision(call.events);
    const timeline = buildCallOperatorTimeline({
      startedAt: call.startedAt,
      answeredAt: call.answeredAt,
      endedAt: call.endedAt,
      durationSeconds: call.durationSeconds,
      fromE164: call.fromE164,
      toE164: call.toE164,
      reviewStatus: call.reviewStatus,
      contactedAt: call.contactedAt,
      archivedAt: call.archivedAt,
      reviewedAt: call.reviewedAt,
      phoneNumberLabel: call.phoneNumber.label,
      routingDecision,
      events: call.events
    });

    return {
      ok: true,
      call: {
        ...call,
        actionGuide,
        routingDecision,
        timeline
      }
    };
  });
}
