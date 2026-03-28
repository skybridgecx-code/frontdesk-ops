import test from 'node:test';
import assert from 'node:assert/strict';
import { CallReviewStatus, CallTriageStatus, prisma } from '@frontdesk/db';
import { buildServer } from '../server.js';

type CallFindUnique = typeof prisma.call.findUnique;
type CallUpdate = typeof prisma.call.update;

function stubCallPrisma(stubs: Partial<{ findUnique: CallFindUnique; update: CallUpdate }>) {
  const original = {
    findUnique: prisma.call.findUnique,
    update: prisma.call.update
  };

  if (stubs.findUnique) {
    prisma.call.findUnique = stubs.findUnique;
  }

  if (stubs.update) {
    prisma.call.update = stubs.update;
  }

  return () => {
    prisma.call.findUnique = original.findUnique;
    prisma.call.update = original.update;
  };
}

test('PATCH /v1/calls/:callSid stamps reviewedAt when reviewStatus moves to REVIEWED', async (t) => {
  let capturedUpdateData: unknown;

  const restore = stubCallPrisma({
    findUnique: (async () => ({
      id: 'call_1',
      reviewStatus: CallReviewStatus.UNREVIEWED,
      reviewedAt: null
    })) as unknown as CallFindUnique,
    update: (async (args: unknown) => {
      capturedUpdateData = (args as { data: unknown }).data;
      return {
        twilioCallSid: 'CA_DEMO_101',
        leadName: null,
        leadPhone: null,
        leadIntent: null,
        urgency: null,
        serviceAddress: null,
        summary: null,
        operatorNotes: null,
        reviewStatus: CallReviewStatus.REVIEWED,
        reviewedAt: new Date('2026-03-24T12:00:00.000Z'),
        triageStatus: CallTriageStatus.OPEN
      };
    }) as unknown as CallUpdate
  });
  t.after(restore);

  const app = await buildServer();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'PATCH',
    url: '/v1/calls/CA_DEMO_101',
    payload: {
      reviewStatus: 'REVIEWED'
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal((capturedUpdateData as { reviewStatus: string }).reviewStatus, 'REVIEWED');
  assert.ok((capturedUpdateData as { reviewedAt: unknown }).reviewedAt instanceof Date);
  assert.deepEqual(response.json(), {
    ok: true,
    call: {
      twilioCallSid: 'CA_DEMO_101',
      leadName: null,
      leadPhone: null,
      leadIntent: null,
      urgency: null,
      serviceAddress: null,
      summary: null,
      operatorNotes: null,
      reviewStatus: 'REVIEWED',
      reviewedAt: '2026-03-24T12:00:00.000Z',
      triageStatus: 'OPEN'
    }
  });
});

test('PATCH /v1/calls/:callSid clears reviewedAt when reviewStatus moves to UNREVIEWED', async (t) => {
  let capturedUpdateData: unknown;

  const restore = stubCallPrisma({
    findUnique: (async () => ({
      id: 'call_1',
      reviewStatus: CallReviewStatus.REVIEWED,
      reviewedAt: new Date('2026-03-24T10:00:00.000Z')
    })) as unknown as CallFindUnique,
    update: (async (args: unknown) => {
      capturedUpdateData = (args as { data: unknown }).data;
      return {
        twilioCallSid: 'CA_DEMO_101',
        leadName: null,
        leadPhone: null,
        leadIntent: null,
        urgency: null,
        serviceAddress: null,
        summary: null,
        operatorNotes: null,
        reviewStatus: CallReviewStatus.UNREVIEWED,
        reviewedAt: null,
        triageStatus: CallTriageStatus.OPEN
      };
    }) as unknown as CallUpdate
  });
  t.after(restore);

  const app = await buildServer();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'PATCH',
    url: '/v1/calls/CA_DEMO_101',
    payload: {
      reviewStatus: 'UNREVIEWED'
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal((capturedUpdateData as { reviewStatus: string }).reviewStatus, 'UNREVIEWED');
  assert.equal((capturedUpdateData as { reviewedAt: unknown }).reviewedAt, null);
  assert.equal(response.json().call.reviewedAt, null);
});

test('POST /v1/calls/:callSid/mark-contacted sets CONTACTED and first contactedAt for open rows', async (t) => {
  let capturedUpdateData: unknown;

  const restore = stubCallPrisma({
    findUnique: (async () => ({
      id: 'call_103',
      triageStatus: CallTriageStatus.OPEN,
      contactedAt: null,
      archivedAt: null
    })) as unknown as CallFindUnique,
    update: (async (args: unknown) => {
      capturedUpdateData = (args as { data: unknown }).data;
      return {
        twilioCallSid: 'CA_DEMO_103',
        triageStatus: CallTriageStatus.CONTACTED,
        contactedAt: new Date('2026-03-24T12:05:00.000Z'),
        archivedAt: null
      };
    }) as unknown as CallUpdate
  });
  t.after(restore);

  const app = await buildServer();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/v1/calls/CA_DEMO_103/mark-contacted'
  });

  assert.equal(response.statusCode, 200);
  assert.equal((capturedUpdateData as { triageStatus: string }).triageStatus, 'CONTACTED');
  assert.ok((capturedUpdateData as { contactedAt: unknown }).contactedAt instanceof Date);
  assert.deepEqual(response.json(), {
    ok: true,
    call: {
      twilioCallSid: 'CA_DEMO_103',
      triageStatus: 'CONTACTED',
      contactedAt: '2026-03-24T12:05:00.000Z',
      archivedAt: null
    }
  });
});

test('POST /v1/calls/:callSid/mark-contacted keeps archived rows archived', async (t) => {
  let capturedUpdateData: unknown;

  const restore = stubCallPrisma({
    findUnique: (async () => ({
      id: 'call_106',
      triageStatus: CallTriageStatus.ARCHIVED,
      contactedAt: null,
      archivedAt: new Date('2026-03-24T12:10:00.000Z')
    })) as unknown as CallFindUnique,
    update: (async (args: unknown) => {
      capturedUpdateData = (args as { data: unknown }).data;
      return {
        twilioCallSid: 'CA_DEMO_106',
        triageStatus: CallTriageStatus.ARCHIVED,
        contactedAt: new Date('2026-03-24T12:11:00.000Z'),
        archivedAt: new Date('2026-03-24T12:10:00.000Z')
      };
    }) as unknown as CallUpdate
  });
  t.after(restore);

  const app = await buildServer();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/v1/calls/CA_DEMO_106/mark-contacted'
  });

  assert.equal(response.statusCode, 200);
  assert.equal((capturedUpdateData as { triageStatus: string }).triageStatus, 'ARCHIVED');
  assert.ok((capturedUpdateData as { contactedAt: unknown }).contactedAt instanceof Date);
  assert.equal(response.json().call.triageStatus, 'ARCHIVED');
});

test('POST /v1/calls/:callSid/archive preserves an existing archivedAt timestamp', async (t) => {
  let capturedUpdateData: unknown;
  const existingArchivedAt = new Date('2026-03-24T12:15:00.000Z');

  const restore = stubCallPrisma({
    findUnique: (async () => ({
      id: 'call_106',
      triageStatus: CallTriageStatus.CONTACTED,
      contactedAt: new Date('2026-03-24T12:00:00.000Z'),
      archivedAt: existingArchivedAt
    })) as unknown as CallFindUnique,
    update: (async (args: unknown) => {
      capturedUpdateData = (args as { data: unknown }).data;
      return {
        twilioCallSid: 'CA_DEMO_106',
        triageStatus: CallTriageStatus.ARCHIVED,
        contactedAt: new Date('2026-03-24T12:00:00.000Z'),
        archivedAt: existingArchivedAt
      };
    }) as unknown as CallUpdate
  });
  t.after(restore);

  const app = await buildServer();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/v1/calls/CA_DEMO_106/archive'
  });

  assert.equal(response.statusCode, 200);
  assert.equal((capturedUpdateData as { triageStatus: string }).triageStatus, 'ARCHIVED');
  assert.equal((capturedUpdateData as { archivedAt: Date }).archivedAt, existingArchivedAt);
  assert.deepEqual(response.json(), {
    ok: true,
    call: {
      twilioCallSid: 'CA_DEMO_106',
      triageStatus: 'ARCHIVED',
      contactedAt: '2026-03-24T12:00:00.000Z',
      archivedAt: '2026-03-24T12:15:00.000Z'
    }
  });
});
