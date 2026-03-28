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

test('POST /v1/businesses/:businessId/prospects/import creates business-scoped prospects with defaults', async (t) => {
  let capturedData: unknown[] = [];

  const restore = stubPrisma({
    businessFindUnique: ((async () => ({
      id: 'biz_demo',
      tenantId: 'tenant_demo'
    })) as unknown) as typeof prisma.business.findUnique,
    prospectCreateMany: (async (args?: unknown) => {
      capturedData = ((args as { data?: unknown[] } | undefined)?.data ?? []) as unknown[];
      return { count: capturedData.length };
    }) as typeof prisma.prospect.createMany
  });
  t.after(restore);

  const app = await buildServer();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/v1/businesses/biz_demo/prospects/import',
    payload: {
      defaultSourceLabel: 'csv_upload',
      prospects: [
        {
          companyName: ' Reston Family Dental ',
          contactName: ' Alicia Grant ',
          contactPhone: '703-555-2101',
          city: ' Reston ',
          state: ' VA ',
          status: 'READY',
          priority: 'HIGH'
        },
        {
          companyName: ' Sterling Property Group ',
          contactEmail: ' mreed@example.com ',
          sourceLabel: 'manual_list'
        }
      ]
    }
  });

  assert.equal(response.statusCode, 200);

  const body = response.json();
  assert.equal(body.ok, true);
  assert.equal(body.importedCount, 2);
  assert.equal(body.prospects[0].companyName, 'Reston Family Dental');
  assert.equal(body.prospects[0].status, 'READY');
  assert.equal(body.prospects[0].priority, 'HIGH');
  assert.equal(body.prospects[0].sourceLabel, 'csv_upload');
  assert.equal(body.prospects[1].sourceLabel, 'manual_list');
  assert.match(body.prospects[0].prospectSid, /^PR_[A-Z0-9]{12}$/);
  assert.match(body.prospects[1].prospectSid, /^PR_[A-Z0-9]{12}$/);

  assert.deepEqual(capturedData, [
    {
      tenantId: 'tenant_demo',
      businessId: 'biz_demo',
      prospectSid: body.prospects[0].prospectSid,
      companyName: 'Reston Family Dental',
      contactName: 'Alicia Grant',
      contactPhone: '703-555-2101',
      contactEmail: null,
      city: 'Reston',
      state: 'VA',
      sourceLabel: 'csv_upload',
      serviceInterest: null,
      notes: null,
      status: 'READY',
      priority: 'HIGH',
      nextActionAt: null
    },
    {
      tenantId: 'tenant_demo',
      businessId: 'biz_demo',
      prospectSid: body.prospects[1].prospectSid,
      companyName: 'Sterling Property Group',
      contactName: null,
      contactPhone: null,
      contactEmail: 'mreed@example.com',
      city: null,
      state: null,
      sourceLabel: 'manual_list',
      serviceInterest: null,
      notes: null,
      status: 'NEW',
      priority: null,
      nextActionAt: null
    }
  ]);
});

test('POST /v1/businesses/:businessId/prospects/import rejects invalid payloads', async (t) => {
  const app = await buildServer();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/v1/businesses/biz_demo/prospects/import',
    payload: {
      prospects: []
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().ok, false);
});
