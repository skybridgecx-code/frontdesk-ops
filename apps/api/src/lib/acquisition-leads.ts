import { randomUUID } from 'node:crypto';

export type AcquisitionLeadImportInput = {
  businessName: string;
  vertical?: string | null;
  services?: string | null;
  location?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  yearsInBusiness?: string | null;
  painPointFound?: string | null;
  outreachStatus?: string | null;
  stage?: string | null;
  demoStatus?: string | null;
  offerStage?: string | null;
  lastContactedAt?: Date | string | null;
  nextFollowUpAt?: Date | string | null;
  notes?: string | null;
  source?: string | null;
};

export type AcquisitionLeadRowIdentity = {
  website: string | null;
  businessName: string;
  location: string;
};

export type PreparedAcquisitionLead = {
  id: string;
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
};

function trimValue(value: string | null | undefined) {
  return value?.trim() ?? '';
}

function parseDate(value: Date | string | null | undefined) {
  if (value == null || value === '') {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function normalizeWebsiteKey(value: string | null | undefined) {
  const normalized = trimValue(value)
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '');
  return normalized;
}

export function normalizeBusinessLocationKey(businessName: string | null | undefined, location: string | null | undefined) {
  const name = trimValue(businessName).toLowerCase().replace(/\s+/g, ' ');
  const market = trimValue(location).toLowerCase().replace(/\s+/g, ' ');
  return `${name}|${market}`;
}

export function dedupeLeadIdentityKey(input: AcquisitionLeadRowIdentity | AcquisitionLeadImportInput) {
  const websiteKey = normalizeWebsiteKey(input.website ?? null);
  if (websiteKey) {
    return `w:${websiteKey}`;
  }
  return `n:${normalizeBusinessLocationKey(input.businessName ?? '', input.location ?? '')}`;
}

export function prepareImportedAcquisitionLead(input: AcquisitionLeadImportInput): PreparedAcquisitionLead | null {
  const businessName = trimValue(input.businessName);
  if (!businessName) {
    return null;
  }

  const location = trimValue(input.location) || 'Unknown market';
  const vertical = trimValue(input.vertical) || null;
  const services = trimValue(input.services) || null;
  const phone = trimValue(input.phone) || null;
  const email = trimValue(input.email).toLowerCase() || null;
  const website = trimValue(input.website) || null;
  const yearsInBusiness = trimValue(input.yearsInBusiness) || null;
  const painPointFound = trimValue(input.painPointFound) || 'Needs outreach qualification';
  const outreachStatus = trimValue(input.outreachStatus) || 'Not contacted';
  const stage = trimValue(input.stage) || 'Researching';
  const demoStatus = trimValue(input.demoStatus) || 'Not booked';
  const offerStage = trimValue(input.offerStage) || 'Not proposed';
  const notes = trimValue(input.notes) || 'Imported from lead file';
  const source = trimValue(input.source) || 'Imported lead file';

  return {
    id: randomUUID(),
    businessName,
    vertical,
    services,
    location,
    phone,
    email,
    website,
    yearsInBusiness,
    painPointFound,
    outreachStatus,
    stage,
    demoStatus,
    offerStage,
    lastContactedAt: parseDate(input.lastContactedAt),
    nextFollowUpAt: parseDate(input.nextFollowUpAt) ?? new Date(),
    notes,
    source
  };
}

export function dedupeImportedAcquisitionLeads(input: {
  existing: AcquisitionLeadRowIdentity[];
  incoming: AcquisitionLeadImportInput[];
}) {
  const seen = new Set(input.existing.map((row) => dedupeLeadIdentityKey(row)));
  const prepared: PreparedAcquisitionLead[] = [];
  let skipped = 0;

  for (const item of input.incoming) {
    const normalized = prepareImportedAcquisitionLead(item);
    if (!normalized) {
      skipped += 1;
      continue;
    }

    const key = dedupeLeadIdentityKey(normalized);
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }

    seen.add(key);
    prepared.push(normalized);
  }

  return {
    prepared,
    skipped
  };
}
