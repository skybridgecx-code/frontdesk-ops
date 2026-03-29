import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@frontdesk/db';
import { buildServer } from '../server.js';

type PrismaStubSet = Partial<{
  $queryRaw: typeof prisma.$queryRaw;
  $transaction: typeof prisma.$transaction;
  prospectCount: typeof prisma.prospect.count;
  prospectFindMany: typeof prisma.prospect.findMany;
  prospectFindFirst: typeof prisma.prospect.findFirst;
}>;

function flattenTaggedSqlArgs(args: unknown[]) {
  const sqlArgs =
    args.length === 1
      ? args.filter(
          (value): value is { strings?: ReadonlyArray<string>; values?: unknown[] } => Boolean(value)
        )
      : args
          .slice(1)
          .filter(
            (value): value is { strings?: ReadonlyArray<string>; values?: unknown[] } => Boolean(value)
          );

  return {
    text: sqlArgs.flatMap((value) => value.strings ?? []).join('?'),
    values: sqlArgs.flatMap((value) => value.values ?? [])
  };
}

function stubPrisma(stubs: PrismaStubSet) {
  const original = {
    $queryRaw: prisma.$queryRaw,
    $transaction: prisma.$transaction,
    prospectCount: prisma.prospect.count,
    prospectFindMany: prisma.prospect.findMany,
    prospectFindFirst: prisma.prospect.findFirst
  };

  if (stubs.$queryRaw) prisma.$queryRaw = stubs.$queryRaw;
  if (stubs.$transaction) prisma.$transaction = stubs.$transaction;
  if (stubs.prospectCount) prisma.prospect.count = stubs.prospectCount;
  if (stubs.prospectFindMany) prisma.prospect.findMany = stubs.prospectFindMany;
  if (stubs.prospectFindFirst) prisma.prospect.findFirst = stubs.prospectFindFirst;

  return () => {
    prisma.$queryRaw = original.$queryRaw;
    prisma.$transaction = original.$transaction;
    prisma.prospect.count = original.prospectCount;
    prisma.prospect.findMany = original.prospectFindMany;
    prisma.prospect.findFirst = original.prospectFindFirst;
  };
}

test('GET /v1/prospects/review-next returns 200 with the expected shape', async (t) => {
  const restore = stubPrisma({
    $queryRaw: (async () => [{ prospectSid: 'PR_DEMO_101' }]) as typeof prisma.$queryRaw
  });
  t.after(restore);

  const app = await buildServer();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'GET',
    url: '/v1/prospects/review-next?tenantId=tenant_demo&businessId=biz_demo'
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    ok: true,
    prospectSid: 'PR_DEMO_101'
  });
});

test('GET /v1/prospects/review-next wires scoped filters and excludeProspectSid into the query', async (t) => {
  let capturedText = '';
  let capturedValues: unknown[] = [];

  const restore = stubPrisma({
    $queryRaw: (async (...args: unknown[]) => {
      const sql = flattenTaggedSqlArgs(args);
      capturedText = sql.text;
      capturedValues = sql.values;
      return [{ prospectSid: 'PR_DEMO_102' }];
    }) as typeof prisma.$queryRaw
  });
  t.after(restore);

  const app = await buildServer();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'GET',
    url: '/v1/prospects/review-next?tenantId=tenant_demo&businessId=biz_demo&status=READY&priority=HIGH&q=reston&excludeProspectSid=PR_DEMO_101'
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    ok: true,
    prospectSid: 'PR_DEMO_102'
  });
  assert.match(capturedText, /"tenantId" = \?/);
  assert.match(capturedText, /"businessId" = \?/);
  assert.match(capturedText, /"status" = \?/);
  assert.match(capturedText, /"priority" = \?/);
  assert.match(capturedText, /"companyName" ILIKE \?/);
  assert.match(capturedText, /"prospectSid" NOT IN/);
  assert.deepEqual(capturedValues, [
    'tenant_demo',
    'biz_demo',
    'READY',
    'HIGH',
    '%reston%',
    '%reston%',
    '%reston%',
    '%reston%',
    '%reston%',
    '%reston%',
    '%reston%',
    '%reston%',
    '%reston%',
    '%reston%',
    'PR_DEMO_101'
  ]);
});

test('GET /v1/prospects accepts scoped query params and returns prospects in priority order', async (t) => {
  let capturedWhere: unknown;
  let capturedSqlText = '';
  let capturedSqlValues: unknown[] = [];

  const restore = stubPrisma({
    prospectCount: (async (args?: unknown) => {
      capturedWhere = (args as { where?: unknown } | undefined)?.where;
      return 2;
    }) as typeof prisma.prospect.count,
    $queryRaw: (async (...args: unknown[]) => {
      const sql = flattenTaggedSqlArgs(args);
      capturedSqlText = sql.text;
      capturedSqlValues = sql.values;
      return [{ prospectSid: 'PR_DEMO_101' }, { prospectSid: 'PR_DEMO_102' }];
    }) as typeof prisma.$queryRaw,
    $transaction: (async (operations: unknown[]) => Promise.all(operations as Promise<unknown>[])) as typeof prisma.$transaction,
    prospectFindMany: (async () => [
      { prospectSid: 'PR_DEMO_102', companyName: 'Second Company' },
      { prospectSid: 'PR_DEMO_101', companyName: 'First Company' }
    ]) as typeof prisma.prospect.findMany
  });
  t.after(restore);

  const app = await buildServer();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'GET',
    url: '/v1/prospects?tenantId=tenant_demo&businessId=biz_demo&status=READY&priority=HIGH&q=reston&page=2&limit=2'
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(capturedWhere, {
    tenantId: 'tenant_demo',
    businessId: 'biz_demo',
    status: 'READY',
    priority: 'HIGH',
    OR: [
      { prospectSid: { contains: 'reston', mode: 'insensitive' } },
      { companyName: { contains: 'reston', mode: 'insensitive' } },
      { contactName: { contains: 'reston', mode: 'insensitive' } },
      { contactPhone: { contains: 'reston', mode: 'insensitive' } },
      { contactEmail: { contains: 'reston', mode: 'insensitive' } },
      { city: { contains: 'reston', mode: 'insensitive' } },
      { state: { contains: 'reston', mode: 'insensitive' } },
      { sourceLabel: { contains: 'reston', mode: 'insensitive' } },
      { serviceInterest: { contains: 'reston', mode: 'insensitive' } },
      { notes: { contains: 'reston', mode: 'insensitive' } }
    ]
  });
  assert.match(capturedSqlText, /"tenantId" = \?/);
  assert.match(capturedSqlText, /"businessId" = \?/);
  assert.match(capturedSqlText, /"status" = \?/);
  assert.match(capturedSqlText, /"priority" = \?/);
  assert.match(capturedSqlText, /"prospectSid" ILIKE \?/);
  assert.deepEqual(capturedSqlValues, [
    'tenant_demo',
    'biz_demo',
    'READY',
    'HIGH',
    '%reston%',
    '%reston%',
    '%reston%',
    '%reston%',
    '%reston%',
    '%reston%',
    '%reston%',
    '%reston%',
    '%reston%',
    '%reston%',
    2,
    2
  ]);
  assert.deepEqual(response.json(), {
    ok: true,
    prospects: [
      { prospectSid: 'PR_DEMO_101', companyName: 'First Company' },
      { prospectSid: 'PR_DEMO_102', companyName: 'Second Company' }
    ],
    page: 2,
    limit: 2,
    total: 2,
    totalPages: 1
  });
});

test('GET /v1/prospects/summary returns 200 with expected outbound bucket counts', async (t) => {
  const counts = [6, 1, 2, 0, 1, 1, 0, 0, 1, 2, 2, 2];
  let countIndex = 0;
  const capturedWhereArgs: unknown[] = [];

  const restore = stubPrisma({
    prospectCount: (async (args?: unknown) => {
      capturedWhereArgs.push((args as { where?: unknown } | undefined)?.where ?? null);
      return counts[countIndex++] ?? 0;
    }) as typeof prisma.prospect.count,
    $transaction: (async (operations: unknown[]) => Promise.all(operations as Promise<unknown>[])) as typeof prisma.$transaction
  });
  t.after(restore);

  const app = await buildServer();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'GET',
    url: '/v1/prospects/summary?tenantId=tenant_demo&businessId=biz_demo'
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(capturedWhereArgs[0], {
    tenantId: 'tenant_demo',
    businessId: 'biz_demo'
  });
  assert.deepEqual(capturedWhereArgs[1], {
    tenantId: 'tenant_demo',
    businessId: 'biz_demo',
    status: 'NEW'
  });
  assert.deepEqual(response.json(), {
    ok: true,
    totalProspects: 6,
    newProspects: 1,
    readyProspects: 2,
    inProgressProspects: 0,
    attemptedProspects: 1,
    respondedProspects: 1,
    qualifiedProspects: 0,
    disqualifiedProspects: 0,
    archivedProspects: 1,
    highPriorityProspects: 2,
    mediumPriorityProspects: 2,
    lowPriorityProspects: 2
  });
});

test('GET /v1/prospects/:prospectSid returns 200 with full prospect detail and attempts', async (t) => {
  let capturedWhere: unknown;
  const restore = stubPrisma({
    prospectFindFirst: (async (args?: unknown) => {
      capturedWhere = (args as { where?: unknown } | undefined)?.where;
      return {
      prospectSid: 'PR_DEMO_104',
      companyName: 'Nova Pediatrics',
      contactName: 'Priya Shah',
      contactPhone: '703-555-1104',
      contactEmail: 'pshah@novapediatrics.example',
      city: 'Vienna',
      state: 'VA',
      sourceLabel: 'website_inquiry',
      sourceWebsiteUrl: 'https://novapediatrics.example',
      sourceMapsUrl: 'https://maps.google.com/?cid=nova',
      sourceLinkedinUrl: 'https://linkedin.com/company/nova-pediatrics',
      sourceCategory: 'Pediatrics Practice',
      sourceRoleTitle: 'Practice Manager',
      serviceInterest: 'Appointment-line overflow and after-hours routing',
      notes: 'They replied asking for pricing and next steps.',
      status: 'RESPONDED',
      priority: 'MEDIUM',
      nextActionAt: new Date('2026-03-26T15:00:00.000Z'),
      lastAttemptAt: new Date('2026-03-25T14:15:00.000Z'),
      respondedAt: new Date('2026-03-25T14:15:00.000Z'),
      archivedAt: null,
      createdAt: new Date('2026-03-24T10:00:00.000Z'),
      updatedAt: new Date('2026-03-25T14:15:00.000Z'),
      attempts: [
        {
          channel: 'EMAIL',
          outcome: 'REPLIED',
          note: 'Prospect replied asking for pricing.',
          attemptedAt: new Date('2026-03-25T14:15:00.000Z'),
          createdAt: new Date('2026-03-25T14:15:00.000Z')
        },
        {
          channel: 'EMAIL',
          outcome: 'SENT_EMAIL',
          note: 'Sent intro email with short product summary.',
          attemptedAt: new Date('2026-03-25T11:00:00.000Z'),
          createdAt: new Date('2026-03-25T11:00:00.000Z')
        }
      ]
    };
    }) as unknown as typeof prisma.prospect.findFirst
  });
  t.after(restore);

  const app = await buildServer();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'GET',
    url: '/v1/prospects/PR_DEMO_104?tenantId=tenant_demo&businessId=biz_demo'
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(capturedWhere, {
    tenantId: 'tenant_demo',
    businessId: 'biz_demo',
    prospectSid: 'PR_DEMO_104'
  });
  assert.deepEqual(response.json(), {
    ok: true,
    prospect: {
      prospectSid: 'PR_DEMO_104',
      companyName: 'Nova Pediatrics',
      contactName: 'Priya Shah',
      contactPhone: '703-555-1104',
      contactEmail: 'pshah@novapediatrics.example',
      city: 'Vienna',
      state: 'VA',
      sourceLabel: 'website_inquiry',
      sourceWebsiteUrl: 'https://novapediatrics.example',
      sourceMapsUrl: 'https://maps.google.com/?cid=nova',
      sourceLinkedinUrl: 'https://linkedin.com/company/nova-pediatrics',
      sourceCategory: 'Pediatrics Practice',
      sourceRoleTitle: 'Practice Manager',
      serviceInterest: 'Appointment-line overflow and after-hours routing',
      notes: 'They replied asking for pricing and next steps.',
      status: 'RESPONDED',
      priority: 'MEDIUM',
      nextActionAt: '2026-03-26T15:00:00.000Z',
      lastAttemptAt: '2026-03-25T14:15:00.000Z',
      respondedAt: '2026-03-25T14:15:00.000Z',
      archivedAt: null,
      createdAt: '2026-03-24T10:00:00.000Z',
      updatedAt: '2026-03-25T14:15:00.000Z',
      attempts: [
        {
          channel: 'EMAIL',
          outcome: 'REPLIED',
          note: 'Prospect replied asking for pricing.',
          attemptedAt: '2026-03-25T14:15:00.000Z',
          createdAt: '2026-03-25T14:15:00.000Z'
        },
        {
          channel: 'EMAIL',
          outcome: 'SENT_EMAIL',
          note: 'Sent intro email with short product summary.',
          attemptedAt: '2026-03-25T11:00:00.000Z',
          createdAt: '2026-03-25T11:00:00.000Z'
        }
      ]
    }
  });
});
