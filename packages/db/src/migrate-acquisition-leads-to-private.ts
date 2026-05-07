import { randomUUID } from 'node:crypto';
import { prisma } from './index';

const REQUIRED_CONFIRMATION = 'aatif-sales';
const SOURCE_SLUG = 'skybridge-demo';
const TARGET_SLUG = 'aatif-sales';

type LeadIdentity = {
  website: string | null;
  businessName: string;
  location: string;
};

type AcquisitionLeadRow = {
  id: string;
  tenantId: string;
  businessName: string;
  vertical: string | null;
  services: string | null;
  location: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  yearsInBusiness: string | null;
  painPointFound: string | null;
  outreachStatus: string;
  stage: string;
  demoStatus: string;
  offerStage: string;
  lastContactedAt: Date | null;
  nextFollowUpAt: Date | null;
  notes: string | null;
  source: string;
  createdAt: Date | null;
  updatedAt: Date | null;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

function normalizeWebsite(value: string | null | undefined) {
  const normalized = normalizeText(value)
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '');
  return normalized.length > 0 ? normalized : null;
}

function leadIdentityKey(input: LeadIdentity) {
  const website = normalizeWebsite(input.website);
  if (website) {
    return `website:${website}`;
  }

  const business = normalizeText(input.businessName);
  const location = normalizeText(input.location);
  return `business_location:${business}::${location}`;
}

async function main() {
  const confirmation = process.env.MIGRATE_ACQUISITION_CONFIRM?.trim();
  if (confirmation !== REQUIRED_CONFIRMATION) {
    throw new Error(
      `Safety check failed. Re-run with MIGRATE_ACQUISITION_CONFIRM=${REQUIRED_CONFIRMATION}.`
    );
  }

  const sourceTenant = await prisma.tenant.findUnique({
    where: { slug: SOURCE_SLUG },
    select: { id: true, slug: true }
  });

  const targetTenant = await prisma.tenant.findUnique({
    where: { slug: TARGET_SLUG },
    select: { id: true, slug: true }
  });

  if (!sourceTenant) {
    throw new Error(`Source tenant slug "${SOURCE_SLUG}" not found.`);
  }

  if (!targetTenant) {
    throw new Error(`Target tenant slug "${TARGET_SLUG}" not found.`);
  }

  const sourceLeads = await prisma.$queryRaw<AcquisitionLeadRow[]>`
    SELECT
      "id",
      "tenantId",
      "businessName",
      "vertical",
      "services",
      "location",
      "phone",
      "email",
      "website",
      "yearsInBusiness",
      "painPointFound",
      "outreachStatus",
      "stage",
      "demoStatus",
      "offerStage",
      "lastContactedAt",
      "nextFollowUpAt",
      "notes",
      "source",
      "createdAt",
      "updatedAt"
    FROM "AcquisitionLead"
    WHERE "tenantId" = ${sourceTenant.id}
    ORDER BY "createdAt" ASC
  `;

  const targetLeads = await prisma.$queryRaw<
    Array<Pick<AcquisitionLeadRow, 'website' | 'businessName' | 'location'>>
  >`
    SELECT
      "website",
      "businessName",
      "location"
    FROM "AcquisitionLead"
    WHERE "tenantId" = ${targetTenant.id}
  `;

  const existingKeys = new Set(targetLeads.map((lead) => leadIdentityKey(lead)));

  let copied = 0;
  let skipped = 0;

  for (const source of sourceLeads) {
    const key = leadIdentityKey(source);
    if (existingKeys.has(key)) {
      skipped += 1;
      continue;
    }

    existingKeys.add(key);
    const now = new Date();
    const createdAt = source.createdAt ?? now;
    const updatedAt = source.updatedAt ?? now;

    await prisma.$executeRaw`
      INSERT INTO "AcquisitionLead" (
        "id",
        "tenantId",
        "businessName",
        "vertical",
        "services",
        "location",
        "phone",
        "email",
        "website",
        "yearsInBusiness",
        "painPointFound",
        "outreachStatus",
        "stage",
        "demoStatus",
        "offerStage",
        "lastContactedAt",
        "nextFollowUpAt",
        "notes",
        "source",
        "createdAt",
        "updatedAt"
      ) VALUES (
        ${randomUUID()},
        ${targetTenant.id},
        ${source.businessName},
        ${source.vertical},
        ${source.services},
        ${source.location},
        ${source.phone},
        ${source.email},
        ${source.website},
        ${source.yearsInBusiness},
        ${source.painPointFound},
        ${source.outreachStatus},
        ${source.stage},
        ${source.demoStatus},
        ${source.offerStage},
        ${source.lastContactedAt},
        ${source.nextFollowUpAt},
        ${source.notes},
        ${source.source},
        ${createdAt},
        ${updatedAt}
      )
    `;

    copied += 1;
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        sourceTenant: SOURCE_SLUG,
        targetTenant: TARGET_SLUG,
        sourceCount: sourceLeads.length,
        copied,
        skipped
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error('[migrate-acquisition-leads-to-private] failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
