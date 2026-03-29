import { createHash, randomUUID } from 'node:crypto';
import {
  prisma,
  ProspectPriority,
  ProspectSourceProvider,
  ProspectStatus,
  Prisma
} from '@frontdesk/db';

export type ProspectImportInput = {
  companyName: string;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  city?: string | null;
  state?: string | null;
  sourceLabel?: string | null;
  sourceProvider?: ProspectSourceProvider;
  sourceProviderRecordId?: string | null;
  sourceFingerprint?: string | null;
  sourceWebsiteUrl?: string | null;
  sourceMapsUrl?: string | null;
  sourceLinkedinUrl?: string | null;
  sourceCategory?: string | null;
  sourceRoleTitle?: string | null;
  sourceMetadataJson?: Prisma.InputJsonValue | null;
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
  result: 'created' | 'updated' | 'skipped';
};

export class BusinessNotFoundError extends Error {
  constructor(
    public readonly businessId: string,
    public readonly tenantId: string
  ) {
    super(`Business not found for id=${businessId} in tenant=${tenantId}`);
  }
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function buildProspectSid() {
  return `PR_${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
}

function inferSourceProvider(sourceLabel: string | null, sourceProvider?: ProspectSourceProvider) {
  if (sourceProvider) {
    return sourceProvider;
  }

  if (sourceLabel === 'public_demo_request' || sourceLabel === 'website_inquiry') {
    return ProspectSourceProvider.PUBLIC_INTAKE;
  }

  return ProspectSourceProvider.MANUAL;
}

function buildStableFingerprint(input: {
  sourceProvider: ProspectSourceProvider;
  companyName: string;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  city?: string | null;
  state?: string | null;
}) {
  const canonical = [
    input.sourceProvider,
    input.companyName.trim().toLowerCase(),
    normalizeOptionalText(input.contactName)?.toLowerCase() ?? '',
    normalizeOptionalText(input.contactPhone)?.replaceAll(/\D/g, '') ?? '',
    normalizeOptionalText(input.contactEmail)?.toLowerCase() ?? '',
    normalizeOptionalText(input.city)?.toLowerCase() ?? '',
    normalizeOptionalText(input.state)?.toLowerCase() ?? ''
  ].join('|');

  return createHash('sha256').update(canonical).digest('hex').slice(0, 32);
}

function normalizeNullableJsonInput(value: Prisma.InputJsonValue | null) {
  return value === null ? Prisma.JsonNull : value;
}

type PreparedImportProspect = {
  companyName: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  city: string | null;
  state: string | null;
  sourceLabel: string;
  sourceProvider: ProspectSourceProvider;
  sourceProviderRecordId: string | null;
  sourceFingerprint: string;
  sourceWebsiteUrl: string | null;
  sourceMapsUrl: string | null;
  sourceLinkedinUrl: string | null;
  sourceCategory: string | null;
  sourceRoleTitle: string | null;
  sourceMetadataJson: Prisma.InputJsonValue | null;
  serviceInterest: string | null;
  notes: string | null;
  status: ProspectStatus;
  priority: ProspectPriority | null;
  nextActionAt: Date | null;
};

function prepareImportedProspect(
  prospect: ProspectImportInput,
  defaultSourceLabel?: string | null
): PreparedImportProspect {
  const sourceLabel =
    normalizeOptionalText(prospect.sourceLabel) ??
    normalizeOptionalText(defaultSourceLabel) ??
    'manual_import';
  const sourceProvider = inferSourceProvider(sourceLabel, prospect.sourceProvider);
  const companyName = prospect.companyName.trim();

  return {
    companyName,
    contactName: normalizeOptionalText(prospect.contactName),
    contactPhone: normalizeOptionalText(prospect.contactPhone),
    contactEmail: normalizeOptionalText(prospect.contactEmail),
    city: normalizeOptionalText(prospect.city),
    state: normalizeOptionalText(prospect.state),
    sourceLabel,
    sourceProvider,
    sourceProviderRecordId: normalizeOptionalText(prospect.sourceProviderRecordId),
    sourceFingerprint:
      normalizeOptionalText(prospect.sourceFingerprint) ??
      buildStableFingerprint({
        sourceProvider,
        companyName,
        contactName: prospect.contactName,
        contactPhone: prospect.contactPhone,
        contactEmail: prospect.contactEmail,
        city: prospect.city,
        state: prospect.state
      }),
    sourceWebsiteUrl: normalizeOptionalText(prospect.sourceWebsiteUrl),
    sourceMapsUrl: normalizeOptionalText(prospect.sourceMapsUrl),
    sourceLinkedinUrl: normalizeOptionalText(prospect.sourceLinkedinUrl),
    sourceCategory: normalizeOptionalText(prospect.sourceCategory),
    sourceRoleTitle: normalizeOptionalText(prospect.sourceRoleTitle),
    sourceMetadataJson: prospect.sourceMetadataJson ?? null,
    serviceInterest: normalizeOptionalText(prospect.serviceInterest),
    notes: normalizeOptionalText(prospect.notes),
    status: prospect.status ?? ProspectStatus.NEW,
    priority: prospect.priority ?? null,
    nextActionAt: prospect.nextActionAt ?? null
  };
}

function shouldUpdateField<T>(existing: T | null, incoming: T | null) {
  if (incoming == null) {
    return false;
  }

  if (existing == null) {
    return true;
  }

  return existing !== incoming;
}

function buildExistingProspectLookupWhere(input: {
  tenantId: string;
  businessId: string;
  sourceProvider: ProspectSourceProvider;
  sourceProviderRecordId: string | null;
  sourceFingerprint: string;
}): Prisma.ProspectWhereInput {
  return {
    tenantId: input.tenantId,
    businessId: input.businessId,
    sourceProvider: input.sourceProvider,
    OR: [
      ...(input.sourceProviderRecordId
        ? [{ sourceProviderRecordId: input.sourceProviderRecordId }]
        : []),
      { sourceFingerprint: input.sourceFingerprint }
    ]
  };
}

export async function importProspectsForBusiness(input: {
  tenantId: string;
  businessId: string;
  sourceProvider?: ProspectSourceProvider;
  prospects: ProspectImportInput[];
  defaultSourceLabel?: string | null;
}) {
  const business = await prisma.business.findFirst({
    where: {
      id: input.businessId,
      tenantId: input.tenantId
    },
    select: {
      id: true,
      tenantId: true
    }
  });

  if (!business) {
    throw new BusinessNotFoundError(input.businessId, input.tenantId);
  }

  if (input.prospects.length === 0) {
    return {
      importBatchId: null,
      importedCount: 0,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      prospects: [] as ImportedProspectSummary[]
    };
  }

  const preparedProspects = input.prospects.map((prospect) =>
    prepareImportedProspect(
      {
        ...prospect,
        sourceProvider: prospect.sourceProvider ?? input.sourceProvider
      },
      input.defaultSourceLabel
    )
  );
  const batchProvider =
    input.sourceProvider ??
    (preparedProspects.every((prospect) => prospect.sourceProvider === preparedProspects[0]?.sourceProvider)
      ? preparedProspects[0]!.sourceProvider
      : ProspectSourceProvider.MANUAL);

  const batch = await prisma.prospectImportBatch.create({
    data: {
      tenantId: business.tenantId,
      businessId: business.id,
      sourceProvider: batchProvider,
      sourceLabel: normalizeOptionalText(input.defaultSourceLabel)
    },
    select: {
      id: true
    }
  });

  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const now = new Date();
  const prospectResults: ImportedProspectSummary[] = [];

  for (const prepared of preparedProspects) {
    const existing = await prisma.prospect.findFirst({
      where: buildExistingProspectLookupWhere({
        tenantId: business.tenantId,
        businessId: business.id,
        sourceProvider: prepared.sourceProvider,
        sourceProviderRecordId: prepared.sourceProviderRecordId,
        sourceFingerprint: prepared.sourceFingerprint
      }),
      select: {
        id: true,
        prospectSid: true,
        companyName: true,
        contactName: true,
        contactPhone: true,
        contactEmail: true,
        city: true,
        state: true,
        sourceLabel: true,
        sourceProviderRecordId: true,
        sourceFingerprint: true,
        sourceWebsiteUrl: true,
        sourceMapsUrl: true,
        sourceLinkedinUrl: true,
        sourceCategory: true,
        sourceRoleTitle: true,
        sourceMetadataJson: true,
        serviceInterest: true,
        notes: true,
        status: true,
        priority: true
      }
    });

    if (!existing) {
      const created = await prisma.prospect.create({
        data: {
          tenantId: business.tenantId,
          businessId: business.id,
          prospectSid: buildProspectSid(),
          companyName: prepared.companyName,
          contactName: prepared.contactName,
          contactPhone: prepared.contactPhone,
          contactEmail: prepared.contactEmail,
          city: prepared.city,
          state: prepared.state,
          sourceLabel: prepared.sourceLabel,
          sourceProvider: prepared.sourceProvider,
          sourceProviderRecordId: prepared.sourceProviderRecordId,
          sourceFingerprint: prepared.sourceFingerprint,
          sourceWebsiteUrl: prepared.sourceWebsiteUrl,
          sourceMapsUrl: prepared.sourceMapsUrl,
          sourceLinkedinUrl: prepared.sourceLinkedinUrl,
          sourceCategory: prepared.sourceCategory,
          sourceRoleTitle: prepared.sourceRoleTitle,
          sourceMetadataJson: normalizeNullableJsonInput(prepared.sourceMetadataJson),
          lastImportBatchId: batch.id,
          firstSeenAt: now,
          lastSeenAt: now,
          serviceInterest: prepared.serviceInterest,
          notes: prepared.notes,
          status: prepared.status,
          priority: prepared.priority,
          nextActionAt: prepared.nextActionAt
        },
        select: {
          prospectSid: true
        }
      });

      createdCount += 1;
      prospectResults.push({
        prospectSid: created.prospectSid,
        companyName: prepared.companyName,
        status: prepared.status,
        priority: prepared.priority,
        sourceLabel: prepared.sourceLabel,
        result: 'created'
      });
      continue;
    }

    const updateData: Prisma.ProspectUpdateInput = {
      lastImportBatch: {
        connect: {
          id: batch.id
        }
      },
      lastSeenAt: now
    };
    let materiallyUpdated = false;

    if (shouldUpdateField(existing.contactName, prepared.contactName)) {
      updateData.contactName = prepared.contactName;
      materiallyUpdated = true;
    }

    if (shouldUpdateField(existing.contactPhone, prepared.contactPhone)) {
      updateData.contactPhone = prepared.contactPhone;
      materiallyUpdated = true;
    }

    if (shouldUpdateField(existing.contactEmail, prepared.contactEmail)) {
      updateData.contactEmail = prepared.contactEmail;
      materiallyUpdated = true;
    }

    if (shouldUpdateField(existing.city, prepared.city)) {
      updateData.city = prepared.city;
      materiallyUpdated = true;
    }

    if (shouldUpdateField(existing.state, prepared.state)) {
      updateData.state = prepared.state;
      materiallyUpdated = true;
    }

    if (shouldUpdateField(existing.sourceLabel, prepared.sourceLabel)) {
      updateData.sourceLabel = prepared.sourceLabel;
      materiallyUpdated = true;
    }

    if (shouldUpdateField(existing.sourceProviderRecordId, prepared.sourceProviderRecordId)) {
      updateData.sourceProviderRecordId = prepared.sourceProviderRecordId;
      materiallyUpdated = true;
    }

    if (existing.sourceFingerprint !== prepared.sourceFingerprint) {
      updateData.sourceFingerprint = prepared.sourceFingerprint;
      materiallyUpdated = true;
    }

    if (shouldUpdateField(existing.sourceWebsiteUrl, prepared.sourceWebsiteUrl)) {
      updateData.sourceWebsiteUrl = prepared.sourceWebsiteUrl;
      materiallyUpdated = true;
    }

    if (shouldUpdateField(existing.sourceMapsUrl, prepared.sourceMapsUrl)) {
      updateData.sourceMapsUrl = prepared.sourceMapsUrl;
      materiallyUpdated = true;
    }

    if (shouldUpdateField(existing.sourceLinkedinUrl, prepared.sourceLinkedinUrl)) {
      updateData.sourceLinkedinUrl = prepared.sourceLinkedinUrl;
      materiallyUpdated = true;
    }

    if (shouldUpdateField(existing.sourceCategory, prepared.sourceCategory)) {
      updateData.sourceCategory = prepared.sourceCategory;
      materiallyUpdated = true;
    }

    if (shouldUpdateField(existing.sourceRoleTitle, prepared.sourceRoleTitle)) {
      updateData.sourceRoleTitle = prepared.sourceRoleTitle;
      materiallyUpdated = true;
    }

    if (JSON.stringify(existing.sourceMetadataJson) !== JSON.stringify(prepared.sourceMetadataJson)) {
      updateData.sourceMetadataJson = normalizeNullableJsonInput(prepared.sourceMetadataJson);
      materiallyUpdated = true;
    }

    if (shouldUpdateField(existing.serviceInterest, prepared.serviceInterest)) {
      updateData.serviceInterest = prepared.serviceInterest;
      materiallyUpdated = true;
    }

    if (!existing.notes && prepared.notes) {
      updateData.notes = prepared.notes;
      materiallyUpdated = true;
    }

    await prisma.prospect.update({
      where: { id: existing.id },
      data: updateData
    });

    if (materiallyUpdated) {
      updatedCount += 1;
    } else {
      skippedCount += 1;
    }

    prospectResults.push({
      prospectSid: existing.prospectSid,
      companyName: existing.companyName,
      status: existing.status,
      priority: existing.priority,
      sourceLabel: prepared.sourceLabel,
      result: materiallyUpdated ? 'updated' : 'skipped'
    });
  }

  await prisma.prospectImportBatch.update({
    where: { id: batch.id },
    data: {
      createdCount,
      updatedCount,
      skippedCount
    }
  });

  return {
    importBatchId: batch.id,
    importedCount: createdCount + updatedCount,
    createdCount,
    updatedCount,
    skippedCount,
    prospects: prospectResults
  };
}
