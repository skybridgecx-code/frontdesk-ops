import type { FastifyInstance } from 'fastify';
import { Prisma, prisma } from '@frontdesk/db';
import {
  buildCallScopeSql,
  CALL_PRIORITY_ORDER_SQL,
  normalizeCallScopeQuery,
  REVIEW_NEXT_ELIGIBILITY_SQL
} from '../lib/call-selectors.js';

type ReviewNextRow = {
  twilioCallSid: string;
};

export async function registerCallReviewNextRoutes(app: FastifyInstance) {
  app.get('/v1/calls/review-next', async (request) => {
    const query = request.query as {
      excludeCallSid?: string | string[];
      triageStatus?: string;
      reviewStatus?: string;
      urgency?: string;
      q?: string;
    };
    const scope = normalizeCallScopeQuery(query);
    const rawExcludeCallSid = query.excludeCallSid;
    const excludeCallSids = (Array.isArray(rawExcludeCallSid) ? rawExcludeCallSid : [rawExcludeCallSid])
      .filter((value): value is string => Boolean(value))
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    const excludeClause =
      excludeCallSids.length > 0
        ? Prisma.sql`AND "twilioCallSid" NOT IN (${Prisma.join(excludeCallSids)})`
        : Prisma.empty;

    const rows = await prisma.$queryRaw<ReviewNextRow[]>`
      SELECT "twilioCallSid"
      FROM "Call"
      WHERE 1 = 1
        ${REVIEW_NEXT_ELIGIBILITY_SQL}
        ${buildCallScopeSql(scope)}
        ${excludeClause}
      ${CALL_PRIORITY_ORDER_SQL}
      LIMIT 1
    `;

    return {
      ok: true,
      callSid: rows[0]?.twilioCallSid ?? null
    };
  });
}
