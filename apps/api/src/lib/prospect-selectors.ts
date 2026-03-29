import { Prisma, ProspectPriority, ProspectStatus } from '@frontdesk/db';

export type ProspectScopeQuery = {
  tenantId?: string;
  businessId?: string;
  status?: string;
  priority?: string;
  q?: string;
};

export type NormalizedProspectScope = {
  tenantId?: string;
  businessId?: string;
  status?: ProspectStatus;
  priority?: ProspectPriority;
  q?: string;
};

export function normalizeProspectScopeQuery(query: ProspectScopeQuery): NormalizedProspectScope {
  const scope: NormalizedProspectScope = {};

  const tenantId = query.tenantId?.trim();
  if (tenantId) {
    scope.tenantId = tenantId;
  }

  const businessId = query.businessId?.trim();
  if (businessId) {
    scope.businessId = businessId;
  }

  if (
    query.status === ProspectStatus.NEW ||
    query.status === ProspectStatus.READY ||
    query.status === ProspectStatus.IN_PROGRESS ||
    query.status === ProspectStatus.ATTEMPTED ||
    query.status === ProspectStatus.RESPONDED ||
    query.status === ProspectStatus.QUALIFIED ||
    query.status === ProspectStatus.DISQUALIFIED ||
    query.status === ProspectStatus.ARCHIVED
  ) {
    scope.status = query.status;
  }

  if (
    query.priority === ProspectPriority.HIGH ||
    query.priority === ProspectPriority.MEDIUM ||
    query.priority === ProspectPriority.LOW
  ) {
    scope.priority = query.priority;
  }

  const q = query.q?.trim();
  if (q) {
    scope.q = q;
  }

  return scope;
}

export function getRequiredProspectScopeError(scope: NormalizedProspectScope) {
  if (!scope.tenantId) {
    return 'tenantId is required';
  }

  if (!scope.businessId) {
    return 'businessId is required';
  }

  return null;
}

export function buildProspectScopeWhere(scope: NormalizedProspectScope) {
  const where: Prisma.ProspectWhereInput = {};

  if (scope.tenantId) {
    where.tenantId = scope.tenantId;
  }

  if (scope.businessId) {
    where.businessId = scope.businessId;
  }

  if (scope.status) {
    where.status = scope.status;
  }

  if (scope.priority) {
    where.priority = scope.priority;
  }

  if (scope.q) {
    where.OR = [
      { prospectSid: { contains: scope.q, mode: 'insensitive' } },
      { companyName: { contains: scope.q, mode: 'insensitive' } },
      { contactName: { contains: scope.q, mode: 'insensitive' } },
      { contactPhone: { contains: scope.q, mode: 'insensitive' } },
      { contactEmail: { contains: scope.q, mode: 'insensitive' } },
      { city: { contains: scope.q, mode: 'insensitive' } },
      { state: { contains: scope.q, mode: 'insensitive' } },
      { sourceLabel: { contains: scope.q, mode: 'insensitive' } },
      { serviceInterest: { contains: scope.q, mode: 'insensitive' } },
      { notes: { contains: scope.q, mode: 'insensitive' } }
    ];
  }

  return where;
}

export function buildProspectScopeSql(scope: NormalizedProspectScope) {
  const clauses: Prisma.Sql[] = [];

  if (scope.tenantId) {
    clauses.push(Prisma.sql`AND "tenantId" = ${scope.tenantId}`);
  }

  if (scope.businessId) {
    clauses.push(Prisma.sql`AND "businessId" = ${scope.businessId}`);
  }

  if (scope.status) {
    clauses.push(Prisma.sql`AND "status" = ${scope.status}`);
  }

  if (scope.priority) {
    clauses.push(Prisma.sql`AND "priority" = ${scope.priority}`);
  }

  if (scope.q) {
    const like = `%${scope.q}%`;
    clauses.push(Prisma.sql`
      AND (
        "prospectSid" ILIKE ${like}
        OR "companyName" ILIKE ${like}
        OR "contactName" ILIKE ${like}
        OR "contactPhone" ILIKE ${like}
        OR "contactEmail" ILIKE ${like}
        OR "city" ILIKE ${like}
        OR "state" ILIKE ${like}
        OR "sourceLabel" ILIKE ${like}
        OR "serviceInterest" ILIKE ${like}
        OR "notes" ILIKE ${like}
      )
    `);
  }

  return clauses.reduce((acc, clause) => Prisma.sql`${acc} ${clause}`, Prisma.empty);
}

export const PROSPECT_PRIORITY_ORDER_SQL = Prisma.sql`
  ORDER BY
    CASE "status"
      WHEN 'READY' THEN 0
      WHEN 'NEW' THEN 1
      WHEN 'ATTEMPTED' THEN 2
      WHEN 'IN_PROGRESS' THEN 3
      WHEN 'RESPONDED' THEN 4
      WHEN 'QUALIFIED' THEN 5
      WHEN 'DISQUALIFIED' THEN 6
      ELSE 7
    END,
    CASE "priority"
      WHEN 'HIGH' THEN 0
      WHEN 'MEDIUM' THEN 1
      WHEN 'LOW' THEN 2
      ELSE 3
    END,
    CASE
      WHEN "nextActionAt" IS NULL THEN 1
      ELSE 0
    END,
    "nextActionAt" ASC,
    CASE
      WHEN "lastAttemptAt" IS NULL THEN 0
      ELSE 1
    END,
    "lastAttemptAt" ASC,
    "createdAt" ASC
`;

export const REVIEW_NEXT_PROSPECT_ELIGIBILITY_SQL = Prisma.sql`
  AND "status" IN ('READY', 'NEW', 'ATTEMPTED')
  AND "archivedAt" IS NULL
  AND "status" != 'ARCHIVED'
`;
