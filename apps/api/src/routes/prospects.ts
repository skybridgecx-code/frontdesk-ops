import type { FastifyInstance } from 'fastify';
import { Prisma, prisma, ProspectPriority, ProspectStatus } from '@frontdesk/db';
import {
  buildProspectScopeSql,
  buildProspectScopeWhere,
  normalizeProspectScopeQuery,
  PROSPECT_PRIORITY_ORDER_SQL
} from '../lib/prospect-selectors.js';

const prospectListSelect = {
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
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  attempts: {
    orderBy: {
      attemptedAt: 'desc'
    },
    take: 3,
    select: {
      channel: true,
      outcome: true,
      note: true,
      attemptedAt: true
    }
  }
} satisfies Prisma.ProspectSelect;

const prospectDetailSelect = {
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
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  attempts: {
    orderBy: {
      attemptedAt: 'desc'
    },
    select: {
      channel: true,
      outcome: true,
      note: true,
      attemptedAt: true,
      createdAt: true
    }
  }
} satisfies Prisma.ProspectSelect;

type ProspectListOrderRow = {
  prospectSid: string;
};

function parsePage(value: string | undefined) {
  return Math.max(Number(value ?? '1') || 1, 1);
}

function parseLimit(value: string | undefined) {
  return Math.min(Math.max(Number(value ?? '25') || 25, 1), 100);
}

export async function registerProspectRoutes(app: FastifyInstance) {
  app.get('/v1/prospects', async (request) => {
    const query = request.query as {
      limit?: string;
      page?: string;
      status?: string;
      priority?: string;
      q?: string;
    };

    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);
    const skip = (page - 1) * limit;
    const scope = normalizeProspectScopeQuery(query);
    const where = buildProspectScopeWhere(scope);

    const [total, orderedRows] = await prisma.$transaction([
      prisma.prospect.count({ where }),
      prisma.$queryRaw<ProspectListOrderRow[]>(Prisma.sql`
        SELECT "prospectSid"
        FROM "Prospect"
        WHERE 1 = 1
        ${buildProspectScopeSql(scope)}
        ${PROSPECT_PRIORITY_ORDER_SQL}
        OFFSET ${skip}
        LIMIT ${limit}
      `)
    ]);

    const orderedProspectSids = orderedRows.map((row) => row.prospectSid);
    const prospects =
      orderedProspectSids.length === 0
        ? []
        : await prisma.prospect.findMany({
            where: {
              prospectSid: {
                in: orderedProspectSids
              }
            },
            select: prospectListSelect
          });

    const prospectsBySid = new Map(prospects.map((prospect) => [prospect.prospectSid, prospect]));
    const orderedProspects = orderedProspectSids
      .map((prospectSid) => prospectsBySid.get(prospectSid))
      .filter((prospect): prospect is (typeof prospects)[number] => Boolean(prospect));

    return {
      ok: true,
      prospects: orderedProspects,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    };
  });

  app.get('/v1/prospects/summary', async () => {
    const [
      totalProspects,
      newProspects,
      readyProspects,
      inProgressProspects,
      attemptedProspects,
      respondedProspects,
      qualifiedProspects,
      disqualifiedProspects,
      archivedProspects,
      highPriorityProspects,
      mediumPriorityProspects,
      lowPriorityProspects
    ] = await prisma.$transaction([
      prisma.prospect.count(),
      prisma.prospect.count({ where: { status: ProspectStatus.NEW } }),
      prisma.prospect.count({ where: { status: ProspectStatus.READY } }),
      prisma.prospect.count({ where: { status: ProspectStatus.IN_PROGRESS } }),
      prisma.prospect.count({ where: { status: ProspectStatus.ATTEMPTED } }),
      prisma.prospect.count({ where: { status: ProspectStatus.RESPONDED } }),
      prisma.prospect.count({ where: { status: ProspectStatus.QUALIFIED } }),
      prisma.prospect.count({ where: { status: ProspectStatus.DISQUALIFIED } }),
      prisma.prospect.count({ where: { status: ProspectStatus.ARCHIVED } }),
      prisma.prospect.count({ where: { priority: ProspectPriority.HIGH } }),
      prisma.prospect.count({ where: { priority: ProspectPriority.MEDIUM } }),
      prisma.prospect.count({ where: { priority: ProspectPriority.LOW } })
    ]);

    return {
      ok: true,
      totalProspects,
      newProspects,
      readyProspects,
      inProgressProspects,
      attemptedProspects,
      respondedProspects,
      qualifiedProspects,
      disqualifiedProspects,
      archivedProspects,
      highPriorityProspects,
      mediumPriorityProspects,
      lowPriorityProspects
    };
  });

  app.get('/v1/prospects/:prospectSid', async (request, reply) => {
    const { prospectSid } = request.params as { prospectSid: string };

    const prospect = await prisma.prospect.findUnique({
      where: { prospectSid },
      select: prospectDetailSelect
    });

    if (!prospect) {
      return reply.notFound(`Prospect not found for prospectSid=${prospectSid}`);
    }

    return {
      ok: true,
      prospect
    };
  });
}
