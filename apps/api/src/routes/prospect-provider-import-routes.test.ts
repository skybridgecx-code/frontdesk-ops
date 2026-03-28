import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@frontdesk/db';
import { buildServer } from '../server.js';

type PrismaStubSet = Partial<{
  businessFindUnique: typeof prisma.business.findUnique;
  prospectCreateMany: typeof prisma.prospect.createMany;
}>;

function stubPrisma(stubs: PrismaStubSet) {
  const original = {
    businessFindUnique: prisma.business.findUnique,
    prospectCreateMany: prisma.prospect.createMany
  };

  if (stubs.businessFindUnique) prisma.business.findUnique = stubs.businessFindUnique;
  if (stubs.prospectCreateMany) prisma.prospect.createMany = stubs.prospectCreateMany;

  return () => {
    prisma.business.findUnique = original.businessFindUnique;
    prisma.prospect.createMany = original.prospectCreateMany;
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

test('POST /v1/businesses/:businessId/prospects/import/google-places imports mapped places results', async (t) => {
  process.env.GOOGLE_PLACES_API_KEY = 'google_test_key';
  let capturedData: unknown[] = [];
  let capturedRequest: { url: string; headers: Headers; body: string | null } | null = null;

  const restorePrisma = stubPrisma({
    businessFindUnique: ((async () => ({
      id: 'biz_demo',
      tenantId: 'tenant_demo'
    })) as unknown) as typeof prisma.business.findUnique,
    prospectCreateMany: (async (args?: unknown) => {
      capturedData = ((args as { data?: unknown[] } | undefined)?.data ?? []) as unknown[];
      return { count: capturedData.length };
    }) as typeof prisma.prospect.createMany
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
    url: '/v1/businesses/biz_demo/prospects/import/google-places',
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

  const body = response.json();
  assert.equal(body.ok, true);
  assert.equal(body.importedCount, 1);
  assert.equal(body.prospects[0].companyName, 'Reston Family Dental');
  assert.equal(body.prospects[0].status, 'READY');
  assert.equal(body.prospects[0].priority, 'HIGH');
  assert.equal(body.prospects[0].sourceLabel, 'google_places');
  assert.match(body.prospects[0].prospectSid, /^PR_[A-Z0-9]{12}$/);

  assert.ok(capturedRequest);
  const googleRequest = capturedRequest as {
    url: string;
    headers: Headers;
    body: string | null;
  };

  assert.equal(googleRequest.url, 'https://places.googleapis.com/v1/places:searchText');
  assert.equal(googleRequest.headers.get('x-goog-api-key'), 'google_test_key');
  assert.match(googleRequest.headers.get('x-goog-fieldmask') ?? '', /places\.displayName/);
  assert.deepEqual(JSON.parse(googleRequest.body ?? '{}'), {
    textQuery: 'dentists in Reston VA',
    pageSize: 5,
    includedType: 'dentist',
    includePureServiceAreaBusinesses: true
  });

  assert.deepEqual(capturedData, [
    {
      tenantId: 'tenant_demo',
      businessId: 'biz_demo',
      prospectSid: body.prospects[0].prospectSid,
      companyName: 'Reston Family Dental',
      contactName: null,
      contactPhone: '(703) 555-0101',
      contactEmail: null,
      city: null,
      state: null,
      sourceLabel: 'google_places',
      serviceInterest: 'New outbound list',
      notes: 'Dentist | 123 Main St, Reston, VA 20190 | https://restondental.example | https://maps.google.com/?cid=demo',
      status: 'READY',
      priority: 'HIGH',
      nextActionAt: null
    }
  ]);
});

test('POST /v1/businesses/:businessId/prospects/import/apollo imports mapped people search results', async (t) => {
  process.env.APOLLO_API_KEY = 'apollo_test_key';
  let capturedData: unknown[] = [];
  let capturedRequest: { url: string; headers: Headers } | null = null;

  const restorePrisma = stubPrisma({
    businessFindUnique: ((async () => ({
      id: 'biz_demo',
      tenantId: 'tenant_demo'
    })) as unknown) as typeof prisma.business.findUnique,
    prospectCreateMany: (async (args?: unknown) => {
      capturedData = ((args as { data?: unknown[] } | undefined)?.data ?? []) as unknown[];
      return { count: capturedData.length };
    }) as typeof prisma.prospect.createMany
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
    url: '/v1/businesses/biz_demo/prospects/import/apollo',
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

  const body = response.json();
  assert.equal(body.ok, true);
  assert.equal(body.importedCount, 1);
  assert.equal(body.prospects[0].companyName, 'Reston Family Dental');
  assert.equal(body.prospects[0].sourceLabel, 'apollo_people_search');
  assert.equal(body.prospects[0].status, 'READY');
  assert.equal(body.prospects[0].priority, 'MEDIUM');

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

  assert.deepEqual(capturedData, [
    {
      tenantId: 'tenant_demo',
      businessId: 'biz_demo',
      prospectSid: body.prospects[0].prospectSid,
      companyName: 'Reston Family Dental',
      contactName: 'Alicia Grant',
      contactPhone: null,
      contactEmail: null,
      city: 'Reston',
      state: 'VA',
      sourceLabel: 'apollo_people_search',
      serviceInterest: null,
      notes: 'Director of Operations | https://restondental.example | https://linkedin.com/in/alicia-grant',
      status: 'READY',
      priority: 'MEDIUM',
      nextActionAt: null
    }
  ]);
});

test('POST /v1/businesses/:businessId/prospects/import/google-places fails clearly when provider key is missing', async (t) => {
  delete process.env.GOOGLE_PLACES_API_KEY;

  const app = await buildServer();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/v1/businesses/biz_demo/prospects/import/google-places',
    payload: {
      textQuery: 'dentists in Reston VA'
    }
  });

  assert.equal(response.statusCode, 503);
  assert.equal(response.json().ok, false);
  assert.match(response.json().error, /GOOGLE_PLACES_API_KEY/);
});
