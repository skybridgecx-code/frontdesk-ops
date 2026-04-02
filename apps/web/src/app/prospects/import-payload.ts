function normalizeNullableText(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : null;
}

function normalizePositiveInt(value: FormDataEntryValue | null, fallback: number, max: number) {
  const parsed = Number(String(value ?? '').trim());
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(parsed), 1), max);
}

function parseCommaList(value: FormDataEntryValue | null) {
  return String(value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseLineList(value: FormDataEntryValue | null) {
  return String(value ?? '')
    .split(/\r?\n|;/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export type GooglePlacesImportPayload = {
  textQuery: string;
  pageSize: number;
  includedType?: string;
  serviceInterest?: string;
  defaultStatus: 'READY';
  defaultPriority: 'HIGH';
};

export type ApolloImportPayload = {
  qKeywords?: string;
  personTitles?: string[];
  organizationLocations?: string[];
  perPage: number;
  serviceInterest?: string;
  defaultStatus: 'READY';
  defaultPriority: 'MEDIUM';
};

export function buildGooglePlacesImportPayload(formData: FormData): GooglePlacesImportPayload {
  const textQuery = normalizeNullableText(formData.get('textQuery'));

  if (!textQuery) {
    throw new Error('Google Places import requires a search query');
  }

  const includedType = normalizeNullableText(formData.get('includedType'));
  const serviceInterest = normalizeNullableText(formData.get('serviceInterest'));

  return {
    textQuery,
    pageSize: normalizePositiveInt(formData.get('pageSize'), 5, 20),
    ...(includedType ? { includedType } : {}),
    ...(serviceInterest ? { serviceInterest } : {}),
    defaultStatus: 'READY',
    defaultPriority: 'HIGH'
  };
}

export function buildApolloImportPayload(formData: FormData): ApolloImportPayload {
  const qKeywords = normalizeNullableText(formData.get('qKeywords'));
  const personTitles = parseCommaList(formData.get('personTitles'));
  const organizationLocations = parseLineList(formData.get('organizationLocations'));
  const serviceInterest = normalizeNullableText(formData.get('serviceInterest'));

  if (!qKeywords && personTitles.length === 0 && organizationLocations.length === 0) {
    throw new Error('Apollo import requires at least one search filter');
  }

  return {
    ...(qKeywords ? { qKeywords } : {}),
    ...(personTitles.length > 0 ? { personTitles } : {}),
    ...(organizationLocations.length > 0 ? { organizationLocations } : {}),
    ...(serviceInterest ? { serviceInterest } : {}),
    perPage: normalizePositiveInt(formData.get('perPage'), 10, 25),
    defaultStatus: 'READY',
    defaultPriority: 'MEDIUM'
  };
}
