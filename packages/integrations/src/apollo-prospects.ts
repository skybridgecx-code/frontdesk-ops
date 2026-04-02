export class MissingApolloApiKeyError extends Error {
  constructor() {
    super('APOLLO_API_KEY is not set');
  }
}

export class ApolloApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
  }
}

export type ApolloPeopleSearchInput = {
  personTitles?: string[];
  personLocations?: string[];
  organizationLocations?: string[];
  qKeywords?: string;
  perPage?: number;
  page?: number;
};

export type ApolloProspect = {
  companyName: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  city: string | null;
  state: string | null;
  sourceLabel: string;
  sourceProviderRecordId: string | null;
  sourceWebsiteUrl: string | null;
  sourceLinkedinUrl: string | null;
  sourceRoleTitle: string | null;
  sourceMetadataJson: Record<string, string | null>;
};

type ApolloSearchResponse = {
  people?: Array<{
    id?: string;
    name?: string;
    first_name?: string;
    last_name?: string;
    title?: string;
    email?: string;
    city?: string;
    state?: string;
    phone_numbers?: Array<{
      sanitized_number?: string;
      raw_number?: string;
    }>;
    linkedin_url?: string;
    organization?: {
      name?: string;
      website_url?: string;
      city?: string;
      state?: string;
      primary_phone?: {
        sanitized_number?: string;
        number?: string;
      };
    };
  }>;
  error?: string;
};

function getApolloApiKey() {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    throw new MissingApolloApiKeyError();
  }

  return apiKey;
}

function cleanNullableString(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildContactName(person: NonNullable<ApolloSearchResponse['people']>[number]) {
  return (
    cleanNullableString(person.name) ??
    cleanNullableString([person.first_name, person.last_name].filter(Boolean).join(' '))
  );
}

function buildSourceSnippet(person: NonNullable<ApolloSearchResponse['people']>[number]) {
  const parts = [
    cleanNullableString(person.title),
    cleanNullableString(person.organization?.website_url),
    cleanNullableString(person.linkedin_url)
  ].filter((value): value is string => Boolean(value));

  return parts.length > 0 ? parts.join(' | ') : null;
}

export async function searchApolloPeopleProspects(input: ApolloPeopleSearchInput) {
  const apiKey = getApolloApiKey();
  const search = new URLSearchParams();

  for (const value of input.personTitles ?? []) {
    search.append('person_titles[]', value);
  }

  for (const value of input.personLocations ?? []) {
    search.append('person_locations[]', value);
  }

  for (const value of input.organizationLocations ?? []) {
    search.append('organization_locations[]', value);
  }

  if (input.qKeywords) {
    search.set('q_keywords', input.qKeywords);
  }

  if (input.perPage) {
    search.set('per_page', String(input.perPage));
  }

  if (input.page) {
    search.set('page', String(input.page));
  }

  const response = await fetch(`https://api.apollo.io/api/v1/mixed_people/api_search?${search}`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-api-key': apiKey
    },
    body: JSON.stringify({})
  });

  const body = (await response.json()) as ApolloSearchResponse;

  if (!response.ok) {
    throw new ApolloApiError(body.error ?? 'Apollo People Search request failed', response.status);
  }

  return (body.people ?? [])
    .map((person): ApolloProspect | null => {
      const companyName = cleanNullableString(person.organization?.name);

      if (!companyName) {
        return null;
      }

      return {
        companyName,
        contactName: buildContactName(person),
        contactPhone:
          cleanNullableString(person.phone_numbers?.[0]?.sanitized_number) ??
          cleanNullableString(person.phone_numbers?.[0]?.raw_number) ??
          cleanNullableString(person.organization?.primary_phone?.sanitized_number) ??
          cleanNullableString(person.organization?.primary_phone?.number),
        contactEmail: cleanNullableString(person.email),
        city:
          cleanNullableString(person.organization?.city) ?? cleanNullableString(person.city),
        state:
          cleanNullableString(person.organization?.state) ?? cleanNullableString(person.state),
        sourceLabel: 'apollo_people_search',
        sourceProviderRecordId: cleanNullableString(person.id),
        sourceWebsiteUrl: cleanNullableString(person.organization?.website_url),
        sourceLinkedinUrl: cleanNullableString(person.linkedin_url),
        sourceRoleTitle: cleanNullableString(person.title),
        sourceMetadataJson: {
          title: cleanNullableString(person.title),
          websiteUrl: cleanNullableString(person.organization?.website_url),
          linkedinUrl: cleanNullableString(person.linkedin_url),
          sourceSnippet: buildSourceSnippet(person)
        }
      };
    })
    .filter((prospect): prospect is ApolloProspect => Boolean(prospect));
}
