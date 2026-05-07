import type { AcquisitionTarget, AcquisitionStage } from './acquisition-data';

export type ImportPreview = {
  parsedRows: number;
  sampleRows: AcquisitionTarget[];
  missingPhone: number;
  missingEmail: number;
  missingWebsite: number;
};

export type ImportResult = {
  merged: AcquisitionTarget[];
  addedCount: number;
  skippedCount: number;
};

const DEFAULT_STAGE: AcquisitionStage = 'Researching';
const DEFAULT_SOURCE = 'Imported lead file';

const headerAlias: Record<string, string[]> = {
  companyName: ['company name', 'company', 'business name'],
  market: ['market', 'location', 'city', 'area'],
  services: ['services', 'service', 'vertical'],
  phone: ['phone', 'phone number', 'contact phone'],
  email: ['email', 'contact email'],
  website: ['website', 'domain', 'site'],
  yearsInBusiness: ['years in business', 'years', 'years_in_business'],
  notes: ['notes', 'note']
};

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeValue(value: string | null | undefined) {
  return value?.trim() ?? '';
}

function normalizeWebsite(value: string) {
  const cleaned = normalizeValue(value)
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '');
  return cleaned;
}

function normalizeKeyPart(value: string | null | undefined) {
  return normalizeValue(value).toLowerCase().replace(/\s+/g, ' ');
}

function resolveColumnMap(headers: string[]) {
  const normalizedHeaders = headers.map(normalizeHeader);
  const map: Partial<Record<keyof typeof headerAlias, number>> = {};

  for (const [field, aliases] of Object.entries(headerAlias) as Array<[keyof typeof headerAlias, string[]]>) {
    const idx = normalizedHeaders.findIndex((header) => aliases.includes(header));
    if (idx >= 0) {
      map[field] = idx;
    }
  }

  return map;
}

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current);
  return result.map((value) => value.trim());
}

export function parseCsvText(text: string) {
  const cleaned = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!cleaned) {
    return { headers: [] as string[], rows: [] as string[][] };
  }

  const lines = cleaned.split('\n').filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { headers: [] as string[], rows: [] as string[][] };
  }

  const headers = parseCsvLine(lines[0] ?? '');
  const rows = lines.slice(1).map((line) => parseCsvLine(line));
  return { headers, rows };
}

export function mapCsvRowsToTargets(headers: string[], rows: string[][]): AcquisitionTarget[] {
  const columnMap = resolveColumnMap(headers);
  const createdAt = new Date().toISOString().slice(0, 10);

  return rows
    .map((cells) => {
      const read = (idx: number | undefined) => (idx == null ? '' : normalizeValue(cells[idx]));

      const businessName = read(columnMap.companyName);
      if (!businessName) {
        return null;
      }

      const location = read(columnMap.market);
      const services = read(columnMap.services);
      const phone = read(columnMap.phone);
      const email = read(columnMap.email);
      const website = read(columnMap.website);
      const yearsInBusiness = read(columnMap.yearsInBusiness);
      const notes = read(columnMap.notes);

      const composedNotes = [yearsInBusiness ? `Years in business: ${yearsInBusiness}` : '', notes]
        .filter(Boolean)
        .join(' | ');

      const target: AcquisitionTarget = {
        businessName,
        vertical: services || 'Home Services',
        services: services || null,
        location: location || 'Unknown market',
        website: website || '',
        phone: phone || null,
        email: email || null,
        yearsInBusiness: yearsInBusiness || null,
        painPoint: 'Needs outreach qualification',
        outreachStatus: 'Not contacted',
        lastContacted: null,
        nextFollowUp: createdAt,
        demoStatus: 'Not booked',
        offerStage: 'Not proposed',
        stage: DEFAULT_STAGE,
        notes: composedNotes || 'Imported from lead file',
        source: DEFAULT_SOURCE
      };

      return target;
    })
    .filter((value): value is AcquisitionTarget => Boolean(value));
}

function dedupeKey(target: AcquisitionTarget) {
  const websiteKey = normalizeWebsite(target.website);
  if (websiteKey) {
    return `w:${websiteKey}`;
  }
  return `n:${normalizeKeyPart(target.businessName)}|${normalizeKeyPart(target.location)}`;
}

export function buildImportPreview(targets: AcquisitionTarget[]): ImportPreview {
  return {
    parsedRows: targets.length,
    sampleRows: targets.slice(0, 5),
    missingPhone: targets.filter((target) => !normalizeValue(target.phone)).length,
    missingEmail: targets.filter((target) => !normalizeValue(target.email)).length,
    missingWebsite: targets.filter((target) => !normalizeValue(target.website)).length
  };
}

export function mergeImportedTargets(existing: AcquisitionTarget[], incoming: AcquisitionTarget[]): ImportResult {
  const seen = new Set(existing.map((target) => dedupeKey(target)));
  const merged = [...existing];
  let addedCount = 0;
  let skippedCount = 0;

  for (const target of incoming) {
    const key = dedupeKey(target);
    if (seen.has(key)) {
      skippedCount += 1;
      continue;
    }
    seen.add(key);
    merged.push(target);
    addedCount += 1;
  }

  return { merged, addedCount, skippedCount };
}

function escapeCsvCell(value: string) {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportTargetsToCsv(targets: AcquisitionTarget[]) {
  const headers = [
    'Company Name',
    'Market',
    'Services',
    'Phone',
    'Email',
    'Website',
    'Years in Business',
    'Notes',
    'Stage',
    'Outreach Status',
    'Demo Status',
    'Offer Stage',
    'Source'
  ];

  const rows = targets.map((target) => [
    target.businessName,
    target.location,
    target.services ?? target.vertical,
    target.phone ?? '',
    target.email ?? '',
    target.website,
    target.yearsInBusiness ?? '',
    target.notes,
    target.stage,
    target.outreachStatus,
    target.demoStatus,
    target.offerStage,
    target.source
  ]);

  return [headers, ...rows].map((row) => row.map((cell) => escapeCsvCell(String(cell ?? ''))).join(',')).join('\n');
}
