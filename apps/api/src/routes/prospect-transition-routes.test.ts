import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ProspectAttemptChannel,
  ProspectAttemptOutcome,
  ProspectPriority,
  ProspectStatus,
  prisma
} from '@frontdesk/db';
import { buildServer } from '../server.js';

type ProspectFindUnique = typeof prisma.prospect.findUnique;
type ProspectUpdate = typeof prisma.prospect.update;
type ProspectAttemptCreate = typeof prisma.prospectAttempt.create;
type PrismaTransaction = typeof prisma.$transaction;

function stubProspectPrisma(
  stubs: Partial<{
    findUnique: ProspectFindUnique;
    update: ProspectUpdate;
    createAttempt: ProspectAttemptCreate;
    transaction: PrismaTransaction;
  }>
) {
  const original = {
    findUnique: prisma.prospect.findUnique,
    update: prisma.prospect.update,
    createAttempt: prisma.prospectAttempt.create,
    transaction: prisma.$transaction
  };

  if (stubs.findUnique) prisma.prospect.findUnique = stubs.findUnique;
  if (stubs.update) prisma.prospect.update = stubs.update;
  if (stubs.createAttempt) prisma.prospectAttempt.create = stubs.createAttempt;
  if (stubs.transaction) prisma.$transaction = stubs.transaction;

  return () => {
    prisma.prospect.findUnique = original.findUnique;
    prisma.prospect.update = original.update;
    prisma.prospectAttempt.create = original.createAttempt;
    prisma.$transaction = original.transaction;
  };
}

test('PATCH /v1/prospects/:prospectSid stamps archivedAt when status moves to ARCHIVED', async (t) => {
  let capturedUpdateData: unknown;

  const restore = stubProspectPrisma({
    findUnique: (async () => ({
      id: 'prospect_1',
      status: ProspectStatus.READY,
      archivedAt: null,
      respondedAt: null
    })) as unknown as ProspectFindUnique,
    update: (async (args: unknown) => {
      capturedUpdateData = (args as { data: unknown }).data;
      return {
        prospectSid: 'PR_DEMO_101',
        companyName: 'Reston Family Dental',
        contactName: 'Alicia Grant',
        contactPhone: '703-555-1101',
        contactEmail: 'alicia@restonfamilydental.example',
        city: 'Reston',
        state: 'VA',
        sourceLabel: 'manual_list',
        serviceInterest: 'After-hours HVAC answering coverage',
        notes: 'Strong fit',
        status: ProspectStatus.ARCHIVED,
        priority: ProspectPriority.HIGH,
        nextActionAt: new Date('2026-03-26T13:00:00.000Z'),
        lastAttemptAt: null,
        respondedAt: null,
        archivedAt: new Date('2026-03-26T12:00:00.000Z')
      };
    }) as unknown as ProspectUpdate
  });
  t.after(restore);

  const app = await buildServer();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'PATCH',
    url: '/v1/prospects/PR_DEMO_101',
    payload: {
      status: 'ARCHIVED'
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal((capturedUpdateData as { status: string }).status, 'ARCHIVED');
  assert.ok((capturedUpdateData as { archivedAt: unknown }).archivedAt instanceof Date);
  assert.equal(response.json().prospect.status, 'ARCHIVED');
});

test('POST /v1/prospects/:prospectSid/log-attempt moves prospect to ATTEMPTED and stamps lastAttemptAt', async (t) => {
  let capturedAttemptData: unknown;
  let capturedUpdateData: unknown;

  const restore = stubProspectPrisma({
    findUnique: (async () => ({
      id: 'prospect_2',
      status: ProspectStatus.READY,
      archivedAt: null,
      respondedAt: null
    })) as unknown as ProspectFindUnique,
    createAttempt: (async (args: unknown) => {
      capturedAttemptData = (args as { data: unknown }).data;
      return {
        id: 'attempt_1'
      };
    }) as unknown as ProspectAttemptCreate,
    update: (async (args: unknown) => {
      capturedUpdateData = (args as { data: unknown }).data;
      return {
        prospectSid: 'PR_DEMO_103',
        status: ProspectStatus.ATTEMPTED,
        priority: ProspectPriority.HIGH,
        nextActionAt: new Date('2026-03-26T12:30:00.000Z'),
        lastAttemptAt: new Date('2026-03-26T12:05:00.000Z'),
        respondedAt: null,
        archivedAt: null,
        attempts: [
          {
            channel: ProspectAttemptChannel.CALL,
            outcome: ProspectAttemptOutcome.LEFT_VOICEMAIL,
            note: 'Left voicemail',
            attemptedAt: new Date('2026-03-26T12:05:00.000Z')
          }
        ]
      };
    }) as unknown as ProspectUpdate,
    transaction: (async (fn: unknown) =>
      (fn as (tx: typeof prisma) => Promise<unknown>)(prisma)) as unknown as PrismaTransaction
  });
  t.after(restore);

  const app = await buildServer();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/v1/prospects/PR_DEMO_103/log-attempt',
    payload: {
      channel: 'CALL',
      outcome: 'LEFT_VOICEMAIL',
      note: 'Left voicemail'
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal((capturedAttemptData as { channel: string }).channel, 'CALL');
  assert.equal((capturedAttemptData as { outcome: string }).outcome, 'LEFT_VOICEMAIL');
  assert.equal((capturedUpdateData as { status: string }).status, 'ATTEMPTED');
  assert.ok((capturedUpdateData as { lastAttemptAt: unknown }).lastAttemptAt instanceof Date);
  assert.equal(response.json().prospect.status, 'ATTEMPTED');
});

test('POST /v1/prospects/:prospectSid/log-attempt moves prospect to RESPONDED and stamps respondedAt on reply', async (t) => {
  let capturedUpdateData: unknown;

  const restore = stubProspectPrisma({
    findUnique: (async () => ({
      id: 'prospect_4',
      status: ProspectStatus.ATTEMPTED,
      archivedAt: null,
      respondedAt: null
    })) as unknown as ProspectFindUnique,
    createAttempt: (async () => ({ id: 'attempt_2' })) as unknown as ProspectAttemptCreate,
    update: (async (args: unknown) => {
      capturedUpdateData = (args as { data: unknown }).data;
      return {
        prospectSid: 'PR_DEMO_104',
        status: ProspectStatus.RESPONDED,
        priority: ProspectPriority.MEDIUM,
        nextActionAt: new Date('2026-03-26T15:00:00.000Z'),
        lastAttemptAt: new Date('2026-03-26T12:10:00.000Z'),
        respondedAt: new Date('2026-03-26T12:10:00.000Z'),
        archivedAt: null,
        attempts: []
      };
    }) as unknown as ProspectUpdate,
    transaction: (async (fn: unknown) =>
      (fn as (tx: typeof prisma) => Promise<unknown>)(prisma)) as unknown as PrismaTransaction
  });
  t.after(restore);

  const app = await buildServer();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/v1/prospects/PR_DEMO_104/log-attempt',
    payload: {
      channel: 'EMAIL',
      outcome: 'REPLIED'
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal((capturedUpdateData as { status: string }).status, 'RESPONDED');
  assert.ok((capturedUpdateData as { respondedAt: unknown }).respondedAt instanceof Date);
  assert.equal(response.json().prospect.status, 'RESPONDED');
});

test('POST /v1/prospects/:prospectSid/log-attempt rejects archived prospects', async (t) => {
  const restore = stubProspectPrisma({
    findUnique: (async () => ({
      id: 'prospect_6',
      status: ProspectStatus.ARCHIVED,
      archivedAt: new Date('2026-03-21T12:00:00.000Z'),
      respondedAt: null
    })) as unknown as ProspectFindUnique
  });
  t.after(restore);

  const app = await buildServer();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/v1/prospects/PR_DEMO_106/log-attempt',
    payload: {
      channel: 'EMAIL',
      outcome: 'SENT_EMAIL'
    }
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), {
    ok: false,
    error: 'Archived prospects cannot receive new outreach attempts'
  });
});

test('POST /v1/prospects/:prospectSid/archive preserves an existing archivedAt timestamp', async (t) => {
  let capturedUpdateData: unknown;
  const existingArchivedAt = new Date('2026-03-21T12:00:00.000Z');

  const restore = stubProspectPrisma({
    findUnique: (async () => ({
      id: 'prospect_6',
      status: ProspectStatus.DISQUALIFIED,
      archivedAt: existingArchivedAt,
      respondedAt: null,
      lastAttemptAt: new Date('2026-03-20T15:00:00.000Z')
    })) as unknown as ProspectFindUnique,
    update: (async (args: unknown) => {
      capturedUpdateData = (args as { data: unknown }).data;
      return {
        prospectSid: 'PR_DEMO_106',
        status: ProspectStatus.ARCHIVED,
        lastAttemptAt: new Date('2026-03-20T15:00:00.000Z'),
        respondedAt: null,
        archivedAt: existingArchivedAt
      };
    }) as unknown as ProspectUpdate
  });
  t.after(restore);

  const app = await buildServer();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/v1/prospects/PR_DEMO_106/archive'
  });

  assert.equal(response.statusCode, 200);
  assert.equal((capturedUpdateData as { status: string }).status, 'ARCHIVED');
  assert.equal((capturedUpdateData as { archivedAt: Date }).archivedAt, existingArchivedAt);
  assert.equal(response.json().prospect.status, 'ARCHIVED');
});
