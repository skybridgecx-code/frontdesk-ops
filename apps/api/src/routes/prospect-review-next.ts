import type { FastifyInstance } from 'fastify';
import { Prisma, prisma } from '@frontdesk/db';
import {
  buildProspectScopeSql,
  normalizeProspectScopeQuery,
  PROSPECT_PRIORITY_ORDER_SQL,
  REVIEW_NEXT_PROSPECT_ELIGIBILITY_SQL
} from '../lib/prospect-selectors.js';

type ReviewNextProspectRow = {
  prospectSid: string;
};

export async function registerProspectReviewNextRoutes(app: FastifyInstance) {
  app.get('/v1/prospects/review-next', async (request) => {
    const query = request.query as {
      excludeProspectSid?: string | string[];
      status?: string;
      priority?: string;
      q?: string;
    };

    const scope = normalizeProspectScopeQuery(query);
    const rawExcludeProspectSid = query.excludeProspectSid;
    const excludeProspectSids = (Array.isArray(rawExcludeProspectSid) ? rawExcludeProspectSid : [rawExcludeProspectSid])
      .filter((value): value is string => Boolean(value))
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    const excludeClause =
      excludeProspectSids.length > 0
        ? Prisma.sql`AND "prospectSid" NOT IN (${Prisma.join(excludeProspectSids)})`
        : Prisma.empty;

    const rows = await prisma.$queryRaw<ReviewNextProspectRow[]>`
      SELECT "prospectSid"
      FROM "Prospect"
      WHERE 1 = 1
        ${REVIEW_NEXT_PROSPECT_ELIGIBILITY_SQL}
        ${buildProspectScopeSql(scope)}
        ${excludeClause}
      ${PROSPECT_PRIORITY_ORDER_SQL}
      LIMIT 1
    `;

    return {
      ok: true,
      prospectSid: rows[0]?.prospectSid ?? null
    };
  });
}
