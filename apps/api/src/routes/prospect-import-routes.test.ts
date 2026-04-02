import test from 'node:test';
import assert from 'node:assert/strict';
import { ProspectSourceProvider, prisma } from '@frontdesk/db';
import { buildServer } from '../server.js';

type PrismaStubSet = Partial<{
  businessFindFirst: typeof prisma.business.findFirst;
  prospectFindFirst: typeof prisma.prospect.findFirst;
  prospectCreate: typeof prisma.prospect.create;
  prospectUpdate: typeof prisma.prospect.update;
  prospectImportBatchCreate: typeof prisma.prospectImportBatch.create;
  prospectImportBatchUpdate: typeof prisma.prospectImportBatch.update;
}>;

function stubPrisma(stubs: PrismaStubSet) {
  const original = {
    businessFindFirst: prisma.business.findFirst,
    prospectFindFirst: prisma.prospect.findFirst,
    prospectCreate: prisma.prospect.create,
    prospectUpdate: prisma.prospect.update,
    prospectImportBatchCreate: prisma.prospectImportBatch.create,
    prospectImportBatchUpdate: prisma.prospectImportBatch.update
  };

  if (stubs.businessFindFirst) prisma.business.findFirst = stubs.businessFindFirst;
  if (stubs.prospectFindFirst) prisma.prospect.findFirst = stubs.prospectFindFirst;
  if (stubs.prospectCreate) prisma.prospect.create = stubs.prospectCreate;
  if (stubs.prospectUpdate) prisma.prospect.update = stubs.prospectUpdate;
  if (stubs.prospectImportBatchCreate) prisma.prospectImportBatch.create = stubs.prospectImportBatchCreate;
  if (stubs.prospectImportBatchUpdate) prisma.prospectImportBatch.update = stubs.prospectImportBatchUpdate;

  return () => {
    prisma.business.findFirst = original.businessFindFirst;
    prisma.prospect.findFirst = original.prospectFindFirst;
    prisma.prospect.create = original.prospectCreate;
    prisma.prospect.update = original.prospectUpdate;
    prisma.prospectImportBatch.create = original.prospectImportBatchCreate;
    prisma.prospectImportBatch.update = original.prospectImportBatchUpdate;
  };
}

test('POST /v1/businesses/:businessId/prospects/import creates business-scoped prospects with provenance defaults', async (t) => {
  let capturedBusinessWhere: unknown;
  const capturedCreateData: unknown[] = [];
  let capturedBatchCreateData: unknown;
  let capturedBatchUpdateData: unknown;
  let createIndex = 0;

  const restore = stubPrisma({
    businessFindFirst: ((async (args?: unknown) => {
      capturedBusinessWhere = (args as { where?: unknown } | undefined)?.where;
      return {
        id: 'biz_demo',
        tenantId: 'tenant_demo'
      };
    }) as unknown) as typeof prisma.business.findFirst,
    prospectFindFirst: (async () => null) as typeof prisma.prospect.findFirst,
    prospectImportBatchCreate: (async (args?: unknown) => {
      capturedBatchCreateData = (args as { data?: unknown } | undefined)?.data;
      return { id: 'batch_demo' };
    }) as typeof prisma.prospectImportBatch.create,
    prospectImportBatchUpdate: (async (args?: unknown) => {
      capturedBatchUpdateData = (args as { data?: unknown } | undefined)?.data;
      return { id: 'batch_demo' };
    }) as typeof prisma.prospectImportBatch.update,
    prospectCreate: (async (args?: unknown) => {
      const data = (args as { data?: Record<string, unknown> } | undefined)?.data ?? {};
      capturedCreateData.push(data);
      createIndex += 1;
      return { prospectSid: `PR_CREATED_${createIndex}` };
    }) as typeof prisma.prospect.create
  });
  t.after(restore);

  const app = await buildServer();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/v1/businesses/biz_demo/prospects/import?tenantId=tenant_demo',
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
  assert.deepEqual(capturedBusinessWhere, {
    id: 'biz_demo',
    tenantId: 'tenant_demo'
  });
  assert.deepEqual(capturedBatchCreateData, {
    tenantId: 'tenant_demo',
    businessId: 'biz_demo',
    sourceProvider: ProspectSourceProvider.MANUAL,
    sourceLabel: 'csv_upload'
  });
  assert.deepEqual(capturedBatchUpdateData, {
    createdCount: 2,
    updatedCount: 0,
    skippedCount: 0
  });

  const createdFirst = capturedCreateData[0] as Record<string, unknown>;
  const createdSecond = capturedCreateData[1] as Record<string, unknown>;
  assert.equal(createdFirst.tenantId, 'tenant_demo');
  assert.equal(createdFirst.businessId, 'biz_demo');
  assert.equal(createdFirst.companyName, 'Reston Family Dental');
  assert.equal(createdFirst.sourceProvider, ProspectSourceProvider.MANUAL);
  assert.equal(createdFirst.sourceLabel, 'csv_upload');
  assert.equal(createdFirst.lastImportBatchId, 'batch_demo');
  assert.ok(typeof createdFirst.sourceFingerprint === 'string');
  assert.equal(createdSecond.contactEmail, 'mreed@example.com');
  assert.equal(createdSecond.sourceLabel, 'manual_list');

  assert.deepEqual(response.json(), {
    ok: true,
    importBatchId: 'batch_demo',
    importedCount: 2,
    createdCount: 2,
    updatedCount: 0,
    skippedCount: 0,
    prospects: [
      {
        prospectSid: 'PR_CREATED_1',
        companyName: 'Reston Family Dental',
        status: 'READY',
        priority: 'HIGH',
        sourceLabel: 'csv_upload',
        result: 'created'
      },
      {
        prospectSid: 'PR_CREATED_2',
        companyName: 'Sterling Property Group',
        status: 'NEW',
        priority: null,
        sourceLabel: 'manual_list',
        result: 'created'
      }
    ]
  });
});

test('POST /v1/businesses/:businessId/prospects/import rejects invalid payloads', async (t) => {
  const app = await buildServer();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/v1/businesses/biz_demo/prospects/import?tenantId=tenant_demo',
    payload: {
      prospects: []
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().ok, false);
});

test('POST /v1/businesses/:businessId/prospects/import requires tenant scope', async (t) => {
  const app = await buildServer();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/v1/businesses/biz_demo/prospects/import',
    payload: {
      prospects: [{ companyName: 'Reston Family Dental' }]
    }
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), {
    ok: false,
    error: 'tenantId is required'
  });
});
