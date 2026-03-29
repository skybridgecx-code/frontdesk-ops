import type { FastifyInstance } from 'fastify';
import { prisma, Prisma, CallReviewStatus, CallTriageStatus } from '@frontdesk/db';
import { buildFrontdeskCallActionGuide } from '@frontdesk/domain';
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
  }
} satisfies Prisma.CallSelect;

type CallListOrderRow = {
  twilioCallSid: string;
};

function parsePage(value: string | undefined) {
  return Math.max(Number(value ?? '1') || 1, 1);
}

function parseLimit(value: string | undefined) {
  return Math.min(Math.max(Number(value ?? '25') || 25, 1), 100);
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
      calls: orderedCalls,
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
            createdAt: true
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

    return {
      ok: true,
      call: {
        ...call,
        actionGuide
      }
    };
  });
}
