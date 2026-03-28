export class MissingGooglePlacesApiKeyError extends Error {
  constructor() {
    super('GOOGLE_PLACES_API_KEY is not set');
  }
}

export class GooglePlacesApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
  }
}

export type GooglePlacesProspect = {
  companyName: string;
  contactPhone: string | null;
  sourceLabel: string;
  notes: string | null;
};

export type SearchGooglePlacesProspectsInput = {
  textQuery: string;
  pageSize?: number;
  includedType?: string;
  regionCode?: string;
  languageCode?: string;
  strictTypeFiltering?: boolean;
};

type GooglePlacesSearchResponse = {
  places?: Array<{
    displayName?: { text?: string };
    nationalPhoneNumber?: string;
    internationalPhoneNumber?: string;
    formattedAddress?: string;
    websiteUri?: string;
    googleMapsUri?: string;
    primaryTypeDisplayName?: { text?: string };
  }>;
  error?: {
    message?: string;
  };
};

function getGooglePlacesApiKey() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new MissingGooglePlacesApiKeyError();
  }

  return apiKey;
}

function cleanNullableString(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildNotes(place: NonNullable<GooglePlacesSearchResponse['places']>[number]) {
  const parts = [
    cleanNullableString(place.primaryTypeDisplayName?.text),
    cleanNullableString(place.formattedAddress),
    cleanNullableString(place.websiteUri),
    cleanNullableString(place.googleMapsUri)
  ].filter((value): value is string => Boolean(value));

  return parts.length > 0 ? parts.join(' | ') : null;
}

export async function searchGooglePlacesProspects(input: SearchGooglePlacesProspectsInput) {
  const apiKey = getGooglePlacesApiKey();

  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'places.displayName,places.nationalPhoneNumber,places.internationalPhoneNumber,places.formattedAddress,places.websiteUri,places.googleMapsUri,places.primaryTypeDisplayName'
    },
    body: JSON.stringify({
      textQuery: input.textQuery,
      pageSize: input.pageSize,
      includedType: input.includedType,
      regionCode: input.regionCode,
      languageCode: input.languageCode,
      strictTypeFiltering: input.strictTypeFiltering,
      includePureServiceAreaBusinesses: true
    })
  });

  const body = (await response.json()) as GooglePlacesSearchResponse;

  if (!response.ok) {
    throw new GooglePlacesApiError(
      body.error?.message ?? 'Google Places API request failed',
      response.status
    );
  }

  return (body.places ?? [])
    .map((place): GooglePlacesProspect | null => {
      const companyName = cleanNullableString(place.displayName?.text);

      if (!companyName) {
        return null;
      }

      return {
        companyName,
        contactPhone:
          cleanNullableString(place.internationalPhoneNumber) ??
          cleanNullableString(place.nationalPhoneNumber),
        sourceLabel: 'google_places',
        notes: buildNotes(place)
      };
    })
    .filter((prospect): prospect is GooglePlacesProspect => Boolean(prospect));
}
