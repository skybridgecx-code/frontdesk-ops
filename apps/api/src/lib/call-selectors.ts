import { CallReviewStatus, CallTriageStatus, Prisma } from '@frontdesk/db';

export type CallScopeQuery = {
  triageStatus?: string;
  reviewStatus?: string;
  urgency?: string;
  q?: string;
};

export type NormalizedCallScope = {
  triageStatus?: CallTriageStatus;
  reviewStatus?: CallReviewStatus;
  urgency?: 'low' | 'medium' | 'high' | 'emergency';
  q?: string;
};

export function normalizeCallScopeQuery(query: CallScopeQuery): NormalizedCallScope {
  const scope: NormalizedCallScope = {};

  if (
    query.triageStatus === CallTriageStatus.OPEN ||
    query.triageStatus === CallTriageStatus.CONTACTED ||
    query.triageStatus === CallTriageStatus.ARCHIVED
  ) {
    scope.triageStatus = query.triageStatus;
  }

  if (
    query.reviewStatus === CallReviewStatus.UNREVIEWED ||
    query.reviewStatus === CallReviewStatus.REVIEWED ||
    query.reviewStatus === CallReviewStatus.NEEDS_REVIEW
  ) {
    scope.reviewStatus = query.reviewStatus;
  }

  if (
    query.urgency === 'low' ||
    query.urgency === 'medium' ||
    query.urgency === 'high' ||
    query.urgency === 'emergency'
  ) {
    scope.urgency = query.urgency;
  }

  const q = query.q?.trim();
  if (q) {
    scope.q = q;
  }

  return scope;
}

export function buildCallScopeWhere(scope: NormalizedCallScope) {
  const where: Prisma.CallWhereInput = {};

  if (scope.triageStatus) {
    where.triageStatus = scope.triageStatus;
  }

  if (scope.reviewStatus) {
    where.reviewStatus = scope.reviewStatus;
  }

  if (scope.urgency) {
    where.urgency = scope.urgency;
  }

  if (scope.q) {
    where.OR = [
      { twilioCallSid: { contains: scope.q, mode: 'insensitive' } },
      { fromE164: { contains: scope.q, mode: 'insensitive' } },
      { toE164: { contains: scope.q, mode: 'insensitive' } },
      { leadName: { contains: scope.q, mode: 'insensitive' } },
      { leadPhone: { contains: scope.q, mode: 'insensitive' } },
      { leadIntent: { contains: scope.q, mode: 'insensitive' } },
      { serviceAddress: { contains: scope.q, mode: 'insensitive' } },
      { summary: { contains: scope.q, mode: 'insensitive' } }
    ];
  }

  return where;
}

export function buildCallScopeSql(scope: NormalizedCallScope) {
  const clauses: Prisma.Sql[] = [];

  if (scope.triageStatus) {
    clauses.push(Prisma.sql`AND "triageStatus" = ${scope.triageStatus}`);
  }

  if (scope.reviewStatus) {
    clauses.push(Prisma.sql`AND "reviewStatus" = ${scope.reviewStatus}`);
  }

  if (scope.urgency) {
    clauses.push(Prisma.sql`AND "urgency" = ${scope.urgency}`);
  }

  if (scope.q) {
    const like = `%${scope.q}%`;
    clauses.push(Prisma.sql`
      AND (
        "twilioCallSid" ILIKE ${like}
        OR "fromE164" ILIKE ${like}
        OR "toE164" ILIKE ${like}
        OR "leadName" ILIKE ${like}
        OR "leadPhone" ILIKE ${like}
        OR "leadIntent" ILIKE ${like}
        OR "serviceAddress" ILIKE ${like}
        OR "summary" ILIKE ${like}
      )
    `);
  }

  return clauses.reduce((acc, clause) => Prisma.sql`${acc} ${clause}`, Prisma.empty);
}

export const CALL_PRIORITY_ORDER_SQL = Prisma.sql`
  ORDER BY
    CASE "triageStatus"
      WHEN 'OPEN' THEN 0
      WHEN 'CONTACTED' THEN 1
      ELSE 2
    END,
    CASE "reviewStatus"
      WHEN 'UNREVIEWED' THEN 0
      WHEN 'NEEDS_REVIEW' THEN 1
      WHEN 'REVIEWED' THEN 2
      ELSE 3
    END,
    CASE "urgency"
      WHEN 'emergency' THEN 0
      WHEN 'high' THEN 1
      WHEN 'medium' THEN 2
      WHEN 'low' THEN 3
      ELSE 4
    END,
    CASE "status"
      WHEN 'COMPLETED' THEN 0
      WHEN 'IN_PROGRESS' THEN 1
      WHEN 'RINGING' THEN 2
      ELSE 3
    END,
    CASE
      WHEN "startedAt" IS NULL THEN 1
      ELSE 0
    END,
    "startedAt" ASC,
    "createdAt" ASC
`;

export const REVIEW_NEXT_ELIGIBILITY_SQL = Prisma.sql`
  AND "reviewStatus" IN ('UNREVIEWED', 'NEEDS_REVIEW')
  AND "triageStatus" != 'ARCHIVED'
  AND "archivedAt" IS NULL
`;
