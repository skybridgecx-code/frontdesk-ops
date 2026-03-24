import type { FastifyInstance } from 'fastify';
import { prisma } from '@frontdesk/db';

type ReviewNextRow = {
  twilioCallSid: string;
};

export async function registerCallReviewNextRoutes(app: FastifyInstance) {
  app.get('/v1/calls/review-next', async () => {
    const rows = await prisma.$queryRaw<ReviewNextRow[]>`
      SELECT "twilioCallSid"
      FROM "Call"
      WHERE "reviewStatus" IN ('NEEDS_REVIEW', 'UNREVIEWED')
      ORDER BY
        CASE "reviewStatus"
          WHEN 'NEEDS_REVIEW' THEN 0
          WHEN 'UNREVIEWED' THEN 1
          ELSE 2
        END,
        CASE "urgency"
          WHEN 'emergency' THEN 0
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 3
          ELSE 4
        END,
        "createdAt" DESC
      LIMIT 1
    `;

    return {
      ok: true,
      callSid: rows[0]?.twilioCallSid ?? null
    };
  });
}
