import {
  Prisma,
  prisma,
  ProspectAttemptChannel,
  ProspectAttemptOutcome,
  ProspectPriority,
  ProspectSourceProvider,
  ProspectStatus
} from '@frontdesk/db';
import {
  buildProspectScopeSql,
  buildProspectScopeWhere,
  PROSPECT_PRIORITY_ORDER_SQL,
  REVIEW_NEXT_PROSPECT_ELIGIBILITY_SQL,
} from './prospect-selectors.js';
import {
  importProspectsForBusiness,
  type ProspectImportInput
} from './prospect-import.js';

export type RequiredProspectScope = {
  tenantId: string;
  businessId: string;
  status?: ProspectStatus;
  priority?: ProspectPriority;
  q?: string;
};

export type UpdateProspectFactsInput = {
  companyName?: string;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  city?: string | null;
  state?: string | null;
  sourceLabel?: string | null;
  serviceInterest?: string | null;
  notes?: string | null;
  status?: ProspectStatus;
  priority?: ProspectPriority | null;
  nextActionAt?: Date | null;
};

export type LogProspectAttemptInput = {
  channel: ProspectAttemptChannel;
  outcome: ProspectAttemptOutcome;
  note?: string | null;
};

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
      attemptedAt: 'desc' as const
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
  sourceWebsiteUrl: true,
  sourceMapsUrl: true,
  sourceLinkedinUrl: true,
  sourceCategory: true,
  sourceRoleTitle: true,
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
      attemptedAt: 'desc' as const
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

export class ProspectNotFoundError extends Error {
  constructor(public readonly prospectSid: string) {
    super(`Prospect not found for prospectSid=${prospectSid}`);
  }
}

export class ArchivedProspectAttemptError extends Error {
  constructor(public readonly prospectSid: string) {
    super('Archived prospects cannot receive new outreach attempts');
  }
}

function parsePage(value: string | undefined) {
  return Math.max(Number(value ?? '1') || 1, 1);
}

function parseLimit(value: string | undefined) {
  return Math.min(Math.max(Number(value ?? '25') || 25, 1), 100);
}

function nextStatusForAttemptOutcome(outcome: ProspectAttemptOutcome) {
  if (outcome === ProspectAttemptOutcome.REPLIED) {
    return ProspectStatus.RESPONDED;
  }

  if (outcome === ProspectAttemptOutcome.BAD_FIT || outcome === ProspectAttemptOutcome.DO_NOT_CONTACT) {
    return ProspectStatus.DISQUALIFIED;
  }

  return ProspectStatus.ATTEMPTED;
}

function selectProspectAttemptSummary() {
  return {
    orderBy: {
      attemptedAt: 'desc' as const
    },
    take: 3,
    select: {
      channel: true,
      outcome: true,
      note: true,
      attemptedAt: true
    }
  };
}

function findScopedProspectBase(scope: RequiredProspectScope, prospectSid: string) {
  return prisma.prospect.findFirst({
    where: {
      ...buildProspectScopeWhere(scope),
      prospectSid
    },
    select: {
      id: true,
      status: true,
      archivedAt: true,
      respondedAt: true,
      lastAttemptAt: true
    }
  });
}

export async function listScopedProspects(
  scope: RequiredProspectScope,
  paging: { page?: string; limit?: string }
) {
  const page = parsePage(paging.page);
  const limit = parseLimit(paging.limit);
  const skip = (page - 1) * limit;
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
            tenantId: scope.tenantId,
            businessId: scope.businessId,
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
    prospects: orderedProspects,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit))
  };
}

export async function summarizeScopedProspects(scope: RequiredProspectScope) {
  const scopedWhere = buildProspectScopeWhere(scope);
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
    prisma.prospect.count({ where: scopedWhere }),
    prisma.prospect.count({ where: { ...scopedWhere, status: ProspectStatus.NEW } }),
    prisma.prospect.count({ where: { ...scopedWhere, status: ProspectStatus.READY } }),
    prisma.prospect.count({ where: { ...scopedWhere, status: ProspectStatus.IN_PROGRESS } }),
    prisma.prospect.count({ where: { ...scopedWhere, status: ProspectStatus.ATTEMPTED } }),
    prisma.prospect.count({ where: { ...scopedWhere, status: ProspectStatus.RESPONDED } }),
    prisma.prospect.count({ where: { ...scopedWhere, status: ProspectStatus.QUALIFIED } }),
    prisma.prospect.count({ where: { ...scopedWhere, status: ProspectStatus.DISQUALIFIED } }),
    prisma.prospect.count({ where: { ...scopedWhere, status: ProspectStatus.ARCHIVED } }),
    prisma.prospect.count({ where: { ...scopedWhere, priority: ProspectPriority.HIGH } }),
    prisma.prospect.count({ where: { ...scopedWhere, priority: ProspectPriority.MEDIUM } }),
    prisma.prospect.count({ where: { ...scopedWhere, priority: ProspectPriority.LOW } })
  ]);

  return {
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
}

export async function getScopedProspectDetail(scope: RequiredProspectScope, prospectSid: string) {
  return prisma.prospect.findFirst({
    where: {
      ...buildProspectScopeWhere(scope),
      prospectSid
    },
    select: prospectDetailSelect
  });
}

export async function reviewNextScopedProspect(scope: RequiredProspectScope, excludeProspectSids: string[]) {
  const excludeClause =
    excludeProspectSids.length > 0
      ? Prisma.sql`AND "prospectSid" NOT IN (${Prisma.join(excludeProspectSids)})`
      : Prisma.empty;

  const rows = await prisma.$queryRaw<ProspectListOrderRow[]>`
    SELECT "prospectSid"
    FROM "Prospect"
    WHERE 1 = 1
      ${REVIEW_NEXT_PROSPECT_ELIGIBILITY_SQL}
      ${buildProspectScopeSql(scope)}
      ${excludeClause}
    ${PROSPECT_PRIORITY_ORDER_SQL}
    LIMIT 1
  `;

  return rows[0]?.prospectSid ?? null;
}

export async function importScopedProspects(input: {
  scope: RequiredProspectScope;
  sourceProvider?: ProspectSourceProvider;
  prospects: ProspectImportInput[];
  defaultSourceLabel?: string | null;
}) {
  return importProspectsForBusiness({
    tenantId: input.scope.tenantId,
    businessId: input.scope.businessId,
    sourceProvider: input.sourceProvider,
    prospects: input.prospects,
    defaultSourceLabel: input.defaultSourceLabel
  });
}

export async function updateScopedProspectFacts(
  scope: RequiredProspectScope,
  prospectSid: string,
  input: UpdateProspectFactsInput
) {
  const existing = await findScopedProspectBase(scope, prospectSid);

  if (!existing) {
    throw new ProspectNotFoundError(prospectSid);
  }

  const nextStatus = input.status;
  const shouldStampArchivedAt = nextStatus === ProspectStatus.ARCHIVED && !existing.archivedAt;
  const shouldStampRespondedAt =
    (nextStatus === ProspectStatus.RESPONDED || nextStatus === ProspectStatus.QUALIFIED) && !existing.respondedAt;

  return prisma.prospect.update({
    where: { id: existing.id },
    data: {
      companyName: input.companyName,
      contactName: input.contactName,
      contactPhone: input.contactPhone,
      contactEmail: input.contactEmail,
      city: input.city,
      state: input.state,
      sourceLabel: input.sourceLabel,
      serviceInterest: input.serviceInterest,
      notes: input.notes,
      status: nextStatus,
      priority: input.priority,
      nextActionAt: input.nextActionAt,
      archivedAt: shouldStampArchivedAt ? new Date() : undefined,
      respondedAt: shouldStampRespondedAt ? new Date() : undefined
    },
    select: {
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
      archivedAt: true
    }
  });
}

export async function logScopedProspectAttempt(
  scope: RequiredProspectScope,
  prospectSid: string,
  input: LogProspectAttemptInput
) {
  const existing = await findScopedProspectBase(scope, prospectSid);

  if (!existing) {
    throw new ProspectNotFoundError(prospectSid);
  }

  if (existing.status === ProspectStatus.ARCHIVED || existing.archivedAt) {
    throw new ArchivedProspectAttemptError(prospectSid);
  }

  const attemptedAt = new Date();
  const nextStatus = nextStatusForAttemptOutcome(input.outcome);

  return prisma.$transaction(async (tx) => {
    await tx.prospectAttempt.create({
      data: {
        prospectId: existing.id,
        channel: input.channel,
        outcome: input.outcome,
        note: input.note ?? null,
        attemptedAt
      }
    });

    return tx.prospect.update({
      where: { id: existing.id },
      data: {
        status: nextStatus,
        lastAttemptAt: attemptedAt,
        respondedAt:
          nextStatus === ProspectStatus.RESPONDED && !existing.respondedAt
            ? attemptedAt
            : undefined
      },
      select: {
        prospectSid: true,
        status: true,
        priority: true,
        nextActionAt: true,
        lastAttemptAt: true,
        respondedAt: true,
        archivedAt: true,
        attempts: selectProspectAttemptSummary()
      }
    });
  });
}

export async function archiveScopedProspect(scope: RequiredProspectScope, prospectSid: string) {
  const existing = await findScopedProspectBase(scope, prospectSid);

  if (!existing) {
    throw new ProspectNotFoundError(prospectSid);
  }

  return prisma.prospect.update({
    where: { id: existing.id },
    data: {
      status: ProspectStatus.ARCHIVED,
      archivedAt: existing.archivedAt ?? new Date()
    },
    select: {
      prospectSid: true,
      status: true,
      lastAttemptAt: true,
      respondedAt: true,
      archivedAt: true
    }
  });
}
