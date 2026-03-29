import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@frontdesk/db';
import { buildServer } from '../server.js';

type PrismaStubSet = Partial<{
  $queryRaw: typeof prisma.$queryRaw;
  $transaction: typeof prisma.$transaction;
  callCount: typeof prisma.call.count;
  callFindMany: typeof prisma.call.findMany;
  callFindUnique: typeof prisma.call.findUnique;
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
    callCount: prisma.call.count,
    callFindMany: prisma.call.findMany,
    callFindUnique: prisma.call.findUnique
  };

  if (stubs.$queryRaw) {
    prisma.$queryRaw = stubs.$queryRaw;
  }

  if (stubs.$transaction) {
    prisma.$transaction = stubs.$transaction;
  }

  if (stubs.callCount) {
    prisma.call.count = stubs.callCount;
  }

  if (stubs.callFindMany) {
    prisma.call.findMany = stubs.callFindMany;
  }

  if (stubs.callFindUnique) {
    prisma.call.findUnique = stubs.callFindUnique;
  }

  return () => {
    prisma.$queryRaw = original.$queryRaw;
    prisma.$transaction = original.$transaction;
    prisma.call.count = original.callCount;
    prisma.call.findMany = original.callFindMany;
    prisma.call.findUnique = original.callFindUnique;
  };
}

test('GET /v1/calls/review-next returns 200 with the expected shape', async (t) => {
  const restore = stubPrisma({
    $queryRaw: (async () => [{ twilioCallSid: 'CA_DEMO_101' }]) as typeof prisma.$queryRaw
  });
  t.after(restore);

  const app = await buildServer();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'GET',
    url: '/v1/calls/review-next'
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    ok: true,
    callSid: 'CA_DEMO_101'
  });
});

test('GET /v1/calls/review-next wires scoped filters and excludeCallSid into the query', async (t) => {
  let capturedText = '';
  let capturedValues: unknown[] = [];

  const restore = stubPrisma({
    $queryRaw: (async (...args: unknown[]) => {
      const sql = flattenTaggedSqlArgs(args);
      capturedText = sql.text;
      capturedValues = sql.values;
      return [{ twilioCallSid: 'CA_DEMO_102' }];
    }) as typeof prisma.$queryRaw
  });
  t.after(restore);

  const app = await buildServer();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'GET',
    url: '/v1/calls/review-next?triageStatus=OPEN&reviewStatus=UNREVIEWED&urgency=high&excludeCallSid=CA_DEMO_101'
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    ok: true,
    callSid: 'CA_DEMO_102'
  });
  assert.match(capturedText, /"triageStatus" = \?/);
  assert.match(capturedText, /"reviewStatus" = \?/);
  assert.match(capturedText, /"urgency" = \?/);
  assert.match(capturedText, /"twilioCallSid" NOT IN/);
  assert.deepEqual(capturedValues, ['OPEN', 'UNREVIEWED', 'high', 'CA_DEMO_101']);
});

test('GET /v1/calls accepts scoped query params and returns calls in priority order', async (t) => {
  let capturedWhere: unknown;
  let capturedSqlText = '';
  let capturedSqlValues: unknown[] = [];

  const restore = stubPrisma({
    callCount: (async (args?: unknown) => {
      capturedWhere = (args as { where?: unknown } | undefined)?.where;
      return 2;
    }) as typeof prisma.call.count,
    $queryRaw: (async (...args: unknown[]) => {
      const sql = flattenTaggedSqlArgs(args);
      capturedSqlText = sql.text;
      capturedSqlValues = sql.values;
      return [{ twilioCallSid: 'CA_DEMO_101' }, { twilioCallSid: 'CA_DEMO_102' }];
    }) as typeof prisma.$queryRaw,
    $transaction: (async (operations: unknown[]) => Promise.all(operations as Promise<unknown>[])) as typeof prisma.$transaction,
    callFindMany: (async () => [
      { twilioCallSid: 'CA_DEMO_102', summary: 'second' },
      { twilioCallSid: 'CA_DEMO_101', summary: 'first' }
    ]) as typeof prisma.call.findMany
  });
  t.after(restore);

  const app = await buildServer();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'GET',
    url: '/v1/calls?triageStatus=OPEN&reviewStatus=UNREVIEWED&urgency=high&q=reston&page=2&limit=2'
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(capturedWhere, {
    triageStatus: 'OPEN',
    reviewStatus: 'UNREVIEWED',
    urgency: 'high',
    OR: [
      { twilioCallSid: { contains: 'reston', mode: 'insensitive' } },
      { fromE164: { contains: 'reston', mode: 'insensitive' } },
      { toE164: { contains: 'reston', mode: 'insensitive' } },
      { leadName: { contains: 'reston', mode: 'insensitive' } },
      { leadPhone: { contains: 'reston', mode: 'insensitive' } },
      { leadIntent: { contains: 'reston', mode: 'insensitive' } },
      { serviceAddress: { contains: 'reston', mode: 'insensitive' } },
      { summary: { contains: 'reston', mode: 'insensitive' } }
    ]
  });
  assert.match(capturedSqlText, /"triageStatus" = \?/);
  assert.match(capturedSqlText, /"reviewStatus" = \?/);
  assert.match(capturedSqlText, /"urgency" = \?/);
  assert.match(capturedSqlText, /"twilioCallSid" ILIKE \?/);
  assert.deepEqual(capturedSqlValues, [
    'OPEN',
    'UNREVIEWED',
    'high',
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
    calls: [
      { twilioCallSid: 'CA_DEMO_101', summary: 'first' },
      { twilioCallSid: 'CA_DEMO_102', summary: 'second' }
    ],
    page: 2,
    limit: 2,
    total: 2,
    totalPages: 1
  });
});

test('GET /v1/calls/:callSid returns call detail with a deterministic action guide', async (t) => {
  const restore = stubPrisma({
    callFindUnique: ((async () => ({
      id: 'call_123',
      twilioCallSid: 'CA_DEMO_101',
      twilioStreamSid: null,
      direction: 'INBOUND',
      status: 'COMPLETED',
      routeKind: 'AI',
      triageStatus: 'OPEN',
      reviewStatus: 'UNREVIEWED',
      contactedAt: null,
      archivedAt: null,
      reviewedAt: null,
      fromE164: '+17035550100',
      toE164: '+17035550199',
      callerTranscript: 'My furnace stopped working.',
      assistantTranscript: 'I can collect details for the team.',
      leadName: 'Casey Caller',
      leadPhone: '703-555-0100',
      leadIntent: 'Furnace not working',
      urgency: 'high',
      serviceAddress: '123 Main St',
      summary: 'Caller needs a same-day furnace callback.',
      operatorNotes: null,
      startedAt: new Date('2026-03-29T10:00:00.000Z'),
      answeredAt: new Date('2026-03-29T10:01:00.000Z'),
      endedAt: new Date('2026-03-29T10:10:00.000Z'),
      durationSeconds: 540,
      phoneNumber: {
        id: 'pn_123',
        e164: '+17035550199',
        label: 'Main line',
        routingMode: 'AI_ALWAYS'
      },
      agentProfile: {
        id: 'agent_123',
        name: 'Dispatch',
        voiceName: 'alloy',
        isActive: true
      },
      events: []
    })) as unknown as typeof prisma.call.findUnique)
  });
  t.after(restore);

  const app = await buildServer();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'GET',
    url: '/v1/calls/CA_DEMO_101'
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    ok: true,
    call: {
      id: 'call_123',
      twilioCallSid: 'CA_DEMO_101',
      twilioStreamSid: null,
      direction: 'INBOUND',
      status: 'COMPLETED',
      routeKind: 'AI',
      triageStatus: 'OPEN',
      reviewStatus: 'UNREVIEWED',
      contactedAt: null,
      archivedAt: null,
      reviewedAt: null,
      fromE164: '+17035550100',
      toE164: '+17035550199',
      callerTranscript: 'My furnace stopped working.',
      assistantTranscript: 'I can collect details for the team.',
      leadName: 'Casey Caller',
      leadPhone: '703-555-0100',
      leadIntent: 'Furnace not working',
      urgency: 'high',
      serviceAddress: '123 Main St',
      summary: 'Caller needs a same-day furnace callback.',
      operatorNotes: null,
      startedAt: '2026-03-29T10:00:00.000Z',
      answeredAt: '2026-03-29T10:01:00.000Z',
      endedAt: '2026-03-29T10:10:00.000Z',
      durationSeconds: 540,
      phoneNumber: {
        id: 'pn_123',
        e164: '+17035550199',
        label: 'Main line',
        routingMode: 'AI_ALWAYS'
      },
      agentProfile: {
        id: 'agent_123',
        name: 'Dispatch',
        voiceName: 'alloy',
        isActive: true
      },
      events: [],
      actionGuide: {
        primaryAction: 'Call back now and confirm the situation.',
        reason: 'This call is still unreviewed, but urgency is already high enough that callback should not wait.',
        urgencyLevel: 'high',
        missingInfo: [],
        readyToContact: true,
        needsTranscriptReview: false
      }
    }
  });
});
