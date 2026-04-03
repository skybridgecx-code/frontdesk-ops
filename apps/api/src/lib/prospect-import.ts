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

function normalizeEmail(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized ? normalized : null;
}

function normalizePhone(value: string | null | undefined) {
  if (!value) return null;

  const digits = value.replace(/\D/g, '');
  if (!digits) return null;

  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }

  return digits;
}

function buildProspectSid() {
  return `PR_${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
}

function isUniqueConstraintError(error: unknown): error is { code: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string' &&
    (error as { code: string }).code === 'P2002'
  );
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

    const contactPhone = normalizeOptionalText(prospect.contactPhone);
    const contactEmail = normalizeOptionalText(prospect.contactEmail);

    return {
      tenantId: business.tenantId,
      businessId: business.id,
      prospectSid: buildProspectSid(),
      companyName: prospect.companyName.trim(),
      contactName: normalizeOptionalText(prospect.contactName),
      contactPhone,
      contactEmail,
      normalizedPhone: normalizePhone(contactPhone),
      normalizedEmail: normalizeEmail(contactEmail),
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

  const importedProspects: ImportedProspectSummary[] = [];
  let importedCount = 0;

  for (const prospect of prospectsToCreate) {
    try {
      const created = await prisma.prospect.create({
        data: prospect,
        select: {
          prospectSid: true,
          companyName: true,
          status: true,
          priority: true,
          sourceLabel: true
        }
      });

      importedProspects.push({
        prospectSid: created.prospectSid,
        companyName: created.companyName,
        status: created.status,
        priority: created.priority,
        sourceLabel: created.sourceLabel ?? 'manual_import'
      });

      importedCount += 1;
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const orConditions = [
        ...(prospect.normalizedEmail ? [{ normalizedEmail: prospect.normalizedEmail }] : []),
        ...(prospect.normalizedPhone ? [{ normalizedPhone: prospect.normalizedPhone }] : [])
      ];

      if (orConditions.length === 0) {
        throw error;
      }

      const existing = await prisma.prospect.findFirst({
        where: {
          tenantId: business.tenantId,
          businessId: business.id,
          OR: orConditions
        },
        select: {
          prospectSid: true,
          companyName: true,
          status: true,
          priority: true,
          sourceLabel: true
        }
      });

      if (!existing) {
        throw error;
      }

      importedProspects.push({
        prospectSid: existing.prospectSid,
        companyName: existing.companyName,
        status: existing.status,
        priority: existing.priority,
        sourceLabel: existing.sourceLabel ?? 'manual_import'
      });
    }
  }

  return {
    importedCount,
    prospects: importedProspects
  };
}
