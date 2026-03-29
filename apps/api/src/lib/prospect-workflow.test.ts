import test from 'node:test';
import assert from 'node:assert/strict';
import {
  prisma,
  ProspectAttemptChannel,
  ProspectAttemptOutcome,
  ProspectPriority,
  ProspectStatus
} from '@frontdesk/db';
import {
  archiveScopedProspect,
  ArchivedProspectAttemptError,
  logScopedProspectAttempt,
  updateScopedProspectFacts
} from './prospect-workflow.js';

type ProspectFindFirst = typeof prisma.prospect.findFirst;
type ProspectUpdate = typeof prisma.prospect.update;
type ProspectAttemptCreate = typeof prisma.prospectAttempt.create;
type PrismaTransaction = typeof prisma.$transaction;

function stubProspectPrisma(
  stubs: Partial<{
    findFirst: ProspectFindFirst;
    update: ProspectUpdate;
    createAttempt: ProspectAttemptCreate;
    transaction: PrismaTransaction;
  }>
) {
  const original = {
    findFirst: prisma.prospect.findFirst,
    update: prisma.prospect.update,
    createAttempt: prisma.prospectAttempt.create,
    transaction: prisma.$transaction
  };

  if (stubs.findFirst) prisma.prospect.findFirst = stubs.findFirst;
  if (stubs.update) prisma.prospect.update = stubs.update;
  if (stubs.createAttempt) prisma.prospectAttempt.create = stubs.createAttempt;
  if (stubs.transaction) prisma.$transaction = stubs.transaction;

  return () => {
    prisma.prospect.findFirst = original.findFirst;
    prisma.prospect.update = original.update;
    prisma.prospectAttempt.create = original.createAttempt;
    prisma.$transaction = original.transaction;
  };
}

const scope = {
  tenantId: 'tenant_demo',
  businessId: 'biz_demo'
};

test('updateScopedProspectFacts stamps archivedAt when status moves to ARCHIVED', async (t) => {
  let capturedUpdateData: unknown;

  const restore = stubProspectPrisma({
    findFirst: (async () => ({
      id: 'prospect_1',
      status: ProspectStatus.READY,
      archivedAt: null,
      respondedAt: null,
      lastAttemptAt: null
    })) as unknown as ProspectFindFirst,
    update: (async (args: unknown) => {
      capturedUpdateData = (args as { data: unknown }).data;
      return {
        prospectSid: 'PR_DEMO_101',
        status: ProspectStatus.ARCHIVED
      };
    }) as unknown as ProspectUpdate
  });
  t.after(restore);

  const prospect = await updateScopedProspectFacts(scope, 'PR_DEMO_101', {
    status: ProspectStatus.ARCHIVED
  });

  assert.equal(prospect.prospectSid, 'PR_DEMO_101');
  assert.equal((capturedUpdateData as { status: string }).status, 'ARCHIVED');
  assert.ok((capturedUpdateData as { archivedAt: unknown }).archivedAt instanceof Date);
});

test('logScopedProspectAttempt stamps respondedAt coherently on reply', async (t) => {
  let capturedAttemptData: unknown;
  let capturedUpdateData: unknown;

  const restore = stubProspectPrisma({
    findFirst: (async () => ({
      id: 'prospect_4',
      status: ProspectStatus.ATTEMPTED,
      archivedAt: null,
      respondedAt: null,
      lastAttemptAt: null
    })) as unknown as ProspectFindFirst,
    createAttempt: (async (args: unknown) => {
      capturedAttemptData = (args as { data: unknown }).data;
      return { id: 'attempt_1' };
    }) as unknown as ProspectAttemptCreate,
    update: (async (args: unknown) => {
      capturedUpdateData = (args as { data: unknown }).data;
      return {
        prospectSid: 'PR_DEMO_104',
        status: ProspectStatus.RESPONDED,
        priority: ProspectPriority.MEDIUM,
        nextActionAt: null,
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

  const prospect = await logScopedProspectAttempt(scope, 'PR_DEMO_104', {
    channel: ProspectAttemptChannel.EMAIL,
    outcome: ProspectAttemptOutcome.REPLIED
  });

  assert.equal((capturedAttemptData as { channel: string }).channel, 'EMAIL');
  assert.equal((capturedUpdateData as { status: string }).status, 'RESPONDED');
  assert.ok((capturedUpdateData as { respondedAt: unknown }).respondedAt instanceof Date);
  assert.equal(prospect.status, 'RESPONDED');
});

test('logScopedProspectAttempt rejects archived prospects', async (t) => {
  const restore = stubProspectPrisma({
    findFirst: (async () => ({
      id: 'prospect_6',
      status: ProspectStatus.ARCHIVED,
      archivedAt: new Date('2026-03-21T12:00:00.000Z'),
      respondedAt: null,
      lastAttemptAt: null
    })) as unknown as ProspectFindFirst
  });
  t.after(restore);

  await assert.rejects(
    () =>
      logScopedProspectAttempt(scope, 'PR_DEMO_106', {
        channel: ProspectAttemptChannel.EMAIL,
        outcome: ProspectAttemptOutcome.SENT_EMAIL
      }),
    ArchivedProspectAttemptError
  );
});

test('archiveScopedProspect preserves an existing archivedAt timestamp', async (t) => {
  let capturedUpdateData: unknown;
  const existingArchivedAt = new Date('2026-03-21T12:00:00.000Z');

  const restore = stubProspectPrisma({
    findFirst: (async () => ({
      id: 'prospect_6',
      status: ProspectStatus.DISQUALIFIED,
      archivedAt: existingArchivedAt,
      respondedAt: null,
      lastAttemptAt: new Date('2026-03-20T15:00:00.000Z')
    })) as unknown as ProspectFindFirst,
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

  const prospect = await archiveScopedProspect(scope, 'PR_DEMO_106');

  assert.equal((capturedUpdateData as { status: string }).status, 'ARCHIVED');
  assert.equal((capturedUpdateData as { archivedAt: Date }).archivedAt, existingArchivedAt);
  assert.equal(prospect.status, 'ARCHIVED');
});
