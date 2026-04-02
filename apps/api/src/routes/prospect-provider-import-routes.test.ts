import test from 'node:test';
import assert from 'node:assert/strict';
import { ProspectSourceProvider, prisma } from '@frontdesk/db';
import { buildServer } from '../server.js';

type PrismaStubSet = Partial<{
  businessFindFirst: typeof prisma.business.findFirst;
  prospectFindFirst: typeof prisma.prospect.findFirst;
  prospectCreate: typeof prisma.prospect.create;
  prospectImportBatchCreate: typeof prisma.prospectImportBatch.create;
  prospectImportBatchUpdate: typeof prisma.prospectImportBatch.update;
}>;

function stubPrisma(stubs: PrismaStubSet) {
  const original = {
    businessFindFirst: prisma.business.findFirst,
    prospectFindFirst: prisma.prospect.findFirst,
    prospectCreate: prisma.prospect.create,
    prospectImportBatchCreate: prisma.prospectImportBatch.create,
    prospectImportBatchUpdate: prisma.prospectImportBatch.update
  };

  if (stubs.businessFindFirst) prisma.business.findFirst = stubs.businessFindFirst;
  if (stubs.prospectFindFirst) prisma.prospect.findFirst = stubs.prospectFindFirst;
  if (stubs.prospectCreate) prisma.prospect.create = stubs.prospectCreate;
  if (stubs.prospectImportBatchCreate) prisma.prospectImportBatch.create = stubs.prospectImportBatchCreate;
  if (stubs.prospectImportBatchUpdate) prisma.prospectImportBatch.update = stubs.prospectImportBatchUpdate;

  return () => {
    prisma.business.findFirst = original.businessFindFirst;
    prisma.prospect.findFirst = original.prospectFindFirst;
    prisma.prospect.create = original.prospectCreate;
    prisma.prospectImportBatch.create = original.prospectImportBatchCreate;
    prisma.prospectImportBatch.update = original.prospectImportBatchUpdate;
  };
}

function stubFetch(
  implementation: (
    input: string | URL | Request,
    init?: RequestInit
  ) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>
) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = implementation as typeof fetch;
  return () => {
    globalThis.fetch = originalFetch;
  };
}

test('POST /v1/businesses/:businessId/prospects/import/google-places imports mapped places results with provenance', async (t) => {
  process.env.GOOGLE_PLACES_API_KEY = 'google_test_key';
  let capturedRequest: { url: string; headers: Headers; body: string | null } | null = null;
  let capturedBusinessWhere: unknown;
  let capturedCreateData: Record<string, unknown> | null = null;
  let capturedBatchCreateData: unknown;
  let capturedBatchUpdateData: unknown;

  const restorePrisma = stubPrisma({
    businessFindFirst: ((async (args?: unknown) => {
      capturedBusinessWhere = (args as { where?: unknown } | undefined)?.where;
      return {
        id: 'biz_demo',
        tenantId: 'tenant_demo'
      };
    }) as unknown) as typeof prisma.business.findFirst,
    prospectFindFirst: (async () => null) as typeof prisma.prospect.findFirst,
    prospectImportBatchCreate: ((async (args?: unknown) => {
      capturedBatchCreateData = (args as { data?: unknown } | undefined)?.data;
      return { id: 'batch_google' };
    }) as unknown) as typeof prisma.prospectImportBatch.create,
    prospectImportBatchUpdate: ((async (args?: unknown) => {
      capturedBatchUpdateData = (args as { data?: unknown } | undefined)?.data;
      return { id: 'batch_google' };
    }) as unknown) as typeof prisma.prospectImportBatch.update,
    prospectCreate: (async (args?: unknown) => {
      capturedCreateData = ((args as { data?: Record<string, unknown> } | undefined)?.data ?? null) as Record<
        string,
        unknown
      > | null;
      return { prospectSid: 'PR_CREATED_GOOGLE' };
    }) as typeof prisma.prospect.create
  });
  t.after(restorePrisma);

  const restoreFetch = stubFetch(async (input, init) => {
    const request = new Request(input, init);
    capturedRequest = {
      url: request.url,
      headers: request.headers,
      body: await request.text()
    };

    return {
      ok: true,
      status: 200,
      json: async () => ({
        places: [
          {
            id: 'places/abc123',
            displayName: { text: 'Reston Family Dental' },
            nationalPhoneNumber: '(703) 555-0101',
            formattedAddress: '123 Main St, Reston, VA 20190',
            websiteUri: 'https://restondental.example',
            googleMapsUri: 'https://maps.google.com/?cid=demo',
            primaryTypeDisplayName: { text: 'Dentist' }
          }
        ]
      })
    };
  });
  t.after(restoreFetch);

  const app = await buildServer();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/v1/businesses/biz_demo/prospects/import/google-places?tenantId=tenant_demo',
    payload: {
      textQuery: ' dentists in Reston VA ',
      pageSize: 5,
      includedType: 'dentist',
      defaultStatus: 'READY',
      defaultPriority: 'HIGH',
      serviceInterest: 'New outbound list'
    }
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(capturedBusinessWhere, {
    id: 'biz_demo',
    tenantId: 'tenant_demo'
  });
  assert.deepEqual(capturedBatchCreateData, {
    tenantId: 'tenant_demo',
    businessId: 'biz_demo',
    sourceProvider: ProspectSourceProvider.GOOGLE_PLACES,
    sourceLabel: null
  });
  assert.deepEqual(capturedBatchUpdateData, {
    createdCount: 1,
    updatedCount: 0,
    skippedCount: 0
  });

  assert.ok(capturedRequest);
  const googleRequest = capturedRequest as {
    url: string;
    headers: Headers;
    body: string | null;
  };

  assert.equal(googleRequest.url, 'https://places.googleapis.com/v1/places:searchText');
  assert.equal(googleRequest.headers.get('x-goog-api-key'), 'google_test_key');
  assert.match(googleRequest.headers.get('x-goog-fieldmask') ?? '', /places\.id/);
  assert.deepEqual(JSON.parse(googleRequest.body ?? '{}'), {
    textQuery: 'dentists in Reston VA',
    pageSize: 5,
    includedType: 'dentist',
    includePureServiceAreaBusinesses: true
  });

  assert.ok(capturedCreateData);
  const createdGoogleData = capturedCreateData as unknown as Record<string, unknown>;
  assert.equal(createdGoogleData.tenantId, 'tenant_demo');
  assert.equal(createdGoogleData.businessId, 'biz_demo');
  assert.equal(createdGoogleData.sourceProvider, ProspectSourceProvider.GOOGLE_PLACES);
  assert.equal(createdGoogleData.sourceProviderRecordId, 'places/abc123');
  assert.equal(createdGoogleData.sourceLabel, 'google_places');
  assert.equal(createdGoogleData.sourceWebsiteUrl, 'https://restondental.example');
  assert.equal(createdGoogleData.sourceMapsUrl, 'https://maps.google.com/?cid=demo');
  assert.equal(createdGoogleData.sourceCategory, 'Dentist');
  assert.equal(createdGoogleData.serviceInterest, 'New outbound list');
  assert.equal(createdGoogleData.notes, null);
  assert.deepEqual(createdGoogleData.sourceMetadataJson, {
    primaryType: 'Dentist',
    formattedAddress: '123 Main St, Reston, VA 20190',
    websiteUri: 'https://restondental.example',
    googleMapsUri: 'https://maps.google.com/?cid=demo',
    sourceSnippet:
      'Dentist | 123 Main St, Reston, VA 20190 | https://restondental.example | https://maps.google.com/?cid=demo'
  });

  assert.deepEqual(response.json(), {
    ok: true,
    importBatchId: 'batch_google',
    importedCount: 1,
    createdCount: 1,
    updatedCount: 0,
    skippedCount: 0,
    prospects: [
      {
        prospectSid: 'PR_CREATED_GOOGLE',
        companyName: 'Reston Family Dental',
        status: 'READY',
        priority: 'HIGH',
        sourceLabel: 'google_places',
        result: 'created'
      }
    ]
  });
});

test('POST /v1/businesses/:businessId/prospects/import/apollo imports mapped people search results with provenance', async (t) => {
  process.env.APOLLO_API_KEY = 'apollo_test_key';
  let capturedRequest: { url: string; headers: Headers } | null = null;
  let capturedCreateData: Record<string, unknown> | null = null;

  const restorePrisma = stubPrisma({
    businessFindFirst: ((async () => ({
      id: 'biz_demo',
      tenantId: 'tenant_demo'
    })) as unknown) as typeof prisma.business.findFirst,
    prospectFindFirst: (async () => null) as typeof prisma.prospect.findFirst,
    prospectImportBatchCreate: ((async () => ({ id: 'batch_apollo' })) as unknown) as typeof prisma.prospectImportBatch.create,
    prospectImportBatchUpdate: ((async () => ({ id: 'batch_apollo' })) as unknown) as typeof prisma.prospectImportBatch.update,
    prospectCreate: (async (args?: unknown) => {
      capturedCreateData = ((args as { data?: Record<string, unknown> } | undefined)?.data ?? null) as Record<
        string,
        unknown
      > | null;
      return { prospectSid: 'PR_CREATED_APOLLO' };
    }) as typeof prisma.prospect.create
  });
  t.after(restorePrisma);

  const restoreFetch = stubFetch(async (input, init) => {
    const request = new Request(input, init);
    capturedRequest = {
      url: request.url,
      headers: request.headers
    };

    return {
      ok: true,
      status: 200,
      json: async () => ({
        people: [
          {
            id: 'apollo_person_123',
            name: 'Alicia Grant',
            title: 'Director of Operations',
            city: 'Reston',
            state: 'VA',
            organization: {
              name: 'Reston Family Dental',
              website_url: 'https://restondental.example',
              city: 'Reston',
              state: 'VA'
            },
            linkedin_url: 'https://linkedin.com/in/alicia-grant'
          }
        ]
      })
    };
  });
  t.after(restoreFetch);

  const app = await buildServer();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/v1/businesses/biz_demo/prospects/import/apollo?tenantId=tenant_demo',
    payload: {
      qKeywords: 'dentists',
      personTitles: ['operations manager'],
      organizationLocations: ['Virginia, US'],
      perPage: 5,
      defaultStatus: 'READY',
      defaultPriority: 'MEDIUM'
    }
  });

  assert.equal(response.statusCode, 200);

  assert.ok(capturedRequest);
  const apolloRequest = capturedRequest as {
    url: string;
    headers: Headers;
  };

  assert.match(apolloRequest.url, /https:\/\/api\.apollo\.io\/api\/v1\/mixed_people\/api_search\?/);
  assert.match(apolloRequest.url, /q_keywords=dentists/);
  assert.match(apolloRequest.url, /person_titles%5B%5D=operations(\+|%20)manager/);
  assert.match(apolloRequest.url, /organization_locations%5B%5D=Virginia%2C(\+|%20)US/);
  assert.equal(apolloRequest.headers.get('x-api-key'), 'apollo_test_key');

  assert.ok(capturedCreateData);
  const createdApolloData = capturedCreateData as unknown as Record<string, unknown>;
  assert.equal(createdApolloData.sourceProvider, ProspectSourceProvider.APOLLO_PEOPLE_SEARCH);
  assert.equal(createdApolloData.sourceProviderRecordId, 'apollo_person_123');
  assert.equal(createdApolloData.sourceLabel, 'apollo_people_search');
  assert.equal(createdApolloData.sourceWebsiteUrl, 'https://restondental.example');
  assert.equal(createdApolloData.sourceLinkedinUrl, 'https://linkedin.com/in/alicia-grant');
  assert.equal(createdApolloData.sourceRoleTitle, 'Director of Operations');
  assert.equal(createdApolloData.notes, null);
  assert.deepEqual(createdApolloData.sourceMetadataJson, {
    title: 'Director of Operations',
    websiteUrl: 'https://restondental.example',
    linkedinUrl: 'https://linkedin.com/in/alicia-grant',
    sourceSnippet:
      'Director of Operations | https://restondental.example | https://linkedin.com/in/alicia-grant'
  });

  assert.equal(response.json().prospects[0].sourceLabel, 'apollo_people_search');
  assert.equal(response.json().prospects[0].result, 'created');
});

test('POST /v1/businesses/:businessId/prospects/import/google-places fails clearly when provider key is missing', async (t) => {
  delete process.env.GOOGLE_PLACES_API_KEY;

  const app = await buildServer();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/v1/businesses/biz_demo/prospects/import/google-places?tenantId=tenant_demo',
    payload: {
      textQuery: 'dentists in Reston VA'
    }
  });

  assert.equal(response.statusCode, 503);
  assert.equal(response.json().ok, false);
  assert.match(response.json().error, /GOOGLE_PLACES_API_KEY/);
});

test('POST provider import routes require tenant scope', async (t) => {
  process.env.APOLLO_API_KEY = 'apollo_test_key';

  const app = await buildServer();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/v1/businesses/biz_demo/prospects/import/apollo',
    payload: {
      qKeywords: 'dentists'
    }
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), {
    ok: false,
    error: 'tenantId is required'
  });
});
