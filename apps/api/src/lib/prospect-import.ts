import { randomUUID } from 'node:crypto';
import { prisma, ProspectPriority, ProspectStatus } from '@frontdesk/db';

export type ProspectImportInput = {
  companyName: string;
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

export type ImportedProspectSummary = {
  prospectSid: string;
  companyName: string;
  status: ProspectStatus;
  priority: ProspectPriority | null;
  sourceLabel: string;
};

export class BusinessNotFoundError extends Error {
  constructor(public readonly businessId: string) {
    super(`Business not found for id=${businessId}`);
  }
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function buildProspectSid() {
  return `PR_${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
}

export async function importProspectsForBusiness(input: {
  businessId: string;
  prospects: ProspectImportInput[];
  defaultSourceLabel?: string | null;
}) {
  const business = await prisma.business.findUnique({
    where: { id: input.businessId },
    select: {
      id: true,
      tenantId: true
    }
  });

  if (!business) {
    throw new BusinessNotFoundError(input.businessId);
  }

  if (input.prospects.length === 0) {
    return {
      importedCount: 0,
      prospects: [] as ImportedProspectSummary[]
    };
  }

  const prospectsToCreate = input.prospects.map((prospect) => {
    const sourceLabel =
      normalizeOptionalText(prospect.sourceLabel) ??
      normalizeOptionalText(input.defaultSourceLabel) ??
      'manual_import';

    return {
      tenantId: business.tenantId,
      businessId: business.id,
      prospectSid: buildProspectSid(),
      companyName: prospect.companyName.trim(),
      contactName: normalizeOptionalText(prospect.contactName),
      contactPhone: normalizeOptionalText(prospect.contactPhone),
      contactEmail: normalizeOptionalText(prospect.contactEmail),
      city: normalizeOptionalText(prospect.city),
      state: normalizeOptionalText(prospect.state),
      sourceLabel,
      serviceInterest: normalizeOptionalText(prospect.serviceInterest),
      notes: normalizeOptionalText(prospect.notes),
      status: prospect.status ?? ProspectStatus.NEW,
      priority: prospect.priority ?? null,
      nextActionAt: prospect.nextActionAt ?? null
    };
  });

  const result = await prisma.prospect.createMany({
    data: prospectsToCreate
  });

  return {
    importedCount: result.count,
    prospects: prospectsToCreate.map(
      (prospect): ImportedProspectSummary => ({
        prospectSid: prospect.prospectSid,
        companyName: prospect.companyName,
        status: prospect.status,
        priority: prospect.priority,
        sourceLabel: prospect.sourceLabel
      })
    )
  };
}
