import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@frontdesk/db';
import { buildServer } from '../server.js';

type PrismaStubSet = Partial<{
  callFindUnique: typeof prisma.call.findUnique;
  callUpdate: typeof prisma.call.update;
  callEventCount: typeof prisma.callEvent.count;
  callEventFindFirst: typeof prisma.callEvent.findFirst;
  callEventCreate: typeof prisma.callEvent.create;
}>;

const originalEnv = {
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER
};

const originalFetch = global.fetch;

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function stubPrisma(stubs: PrismaStubSet) {
  const original = {
    callFindUnique: prisma.call.findUnique,
    callUpdate: prisma.call.update,
    callEventCount: prisma.callEvent.count,
    callEventFindFirst: prisma.callEvent.findFirst,
    callEventCreate: prisma.callEvent.create
  };

  if (stubs.callFindUnique) prisma.call.findUnique = stubs.callFindUnique;
  if (stubs.callUpdate) prisma.call.update = stubs.callUpdate;
  if (stubs.callEventCount) prisma.callEvent.count = stubs.callEventCount;
  if (stubs.callEventFindFirst) prisma.callEvent.findFirst = stubs.callEventFindFirst;
  if (stubs.callEventCreate) prisma.callEvent.create = stubs.callEventCreate;

  return () => {
    prisma.call.findUnique = original.callFindUnique;
    prisma.call.update = original.callUpdate;
    prisma.callEvent.count = original.callEventCount;
    prisma.callEvent.findFirst = original.callEventFindFirst;
    prisma.callEvent.create = original.callEventCreate;
  };
}

test('POST /v1/twilio/voice/status sends missed-call text back for no-answer calls when enabled', async (t) => {
  const createdEvents: Array<{ data: { type: string; sequence: number; payloadJson?: unknown } }> = [];
  const fetchCalls: Array<{ input: string; body: string | undefined }> = [];

  const restore = stubPrisma({
    callFindUnique: ((async () => ({
      id: 'call_123',
      answeredAt: null,
      endedAt: null,
      fromE164: '+17035550100',
      business: { name: 'Demo HVAC' },
      phoneNumber: {
        e164: '+17035550199',
        enableMissedCallTextBack: true
      }
    })) as unknown) as typeof prisma.call.findUnique,
    callUpdate: ((async () => ({ id: 'call_123' })) as unknown) as typeof prisma.call.update,
    callEventCount: (async () => 0) as typeof prisma.callEvent.count,
    callEventFindFirst: (async () => null) as typeof prisma.callEvent.findFirst,
    callEventCreate: (async (args?: unknown) => {
      createdEvents.push((args ?? {}) as { data: { type: string; sequence: number; payloadJson?: unknown } });
      return { id: `evt_${createdEvents.length}` };
    }) as typeof prisma.callEvent.create
  });

  process.env.TWILIO_ACCOUNT_SID = 'AC_TEST_123';
  process.env.TWILIO_AUTH_TOKEN = 'auth_token_test';
  process.env.TWILIO_PHONE_NUMBER = '+17035550199';

  global.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    fetchCalls.push({
      input: String(input),
      body: typeof init?.body === 'string' ? init.body : init?.body ? String(init.body) : undefined
    });

    return new Response(JSON.stringify({ sid: 'SM_TEST_123' }), {
      status: 201,
      headers: {
        'content-type': 'application/json'
      }
    });
  }) as typeof fetch;

  t.after(() => {
    restore();
    restoreEnv();
    global.fetch = originalFetch;
  });

  const app = await buildServer();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/v1/twilio/voice/status',
    payload: {
      CallSid: 'CA_LIVE_201',
      CallStatus: 'no-answer'
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(fetchCalls.length, 1);
  const firstFetchCall = fetchCalls[0];
  assert.ok(firstFetchCall);
  assert.match(firstFetchCall.input, /Messages\.json$/);
  assert.match(firstFetchCall.body ?? '', /To=%2B17035550100/);
  assert.match(firstFetchCall.body ?? '', /From=%2B17035550199/);
  assert.match(firstFetchCall.body ?? '', /Sorry/);

  assert.equal(createdEvents[0]?.data.type, 'twilio.status.no-answer');
  assert.equal(createdEvents[0]?.data.sequence, 1);
  assert.equal(createdEvents[1]?.data.type, 'twilio.sms.missed-call-text.sent');
  assert.equal(createdEvents[1]?.data.sequence, 2);
});

test('POST /v1/twilio/voice/status does not send missed-call text back when the phone number opt-in is disabled', async (t) => {
  const createdEvents: Array<{ data: { type: string; sequence: number } }> = [];
  let fetchCalled = false;

  const restore = stubPrisma({
    callFindUnique: ((async () => ({
      id: 'call_456',
      answeredAt: null,
      endedAt: null,
      fromE164: '+17035550101',
      business: { name: 'Demo Plumbing' },
      phoneNumber: {
        e164: '+17035550198',
        enableMissedCallTextBack: false
      }
    })) as unknown) as typeof prisma.call.findUnique,
    callUpdate: ((async () => ({ id: 'call_456' })) as unknown) as typeof prisma.call.update,
    callEventCount: (async () => 0) as typeof prisma.callEvent.count,
    callEventFindFirst: (async () => null) as typeof prisma.callEvent.findFirst,
    callEventCreate: (async (args?: unknown) => {
      createdEvents.push((args ?? {}) as { data: { type: string; sequence: number } });
      return { id: `evt_${createdEvents.length}` };
    }) as typeof prisma.callEvent.create
  });

  process.env.TWILIO_ACCOUNT_SID = 'AC_TEST_123';
  process.env.TWILIO_AUTH_TOKEN = 'auth_token_test';
  process.env.TWILIO_PHONE_NUMBER = '+17035550198';

  global.fetch = (async () => {
    fetchCalled = true;
    return new Response(JSON.stringify({ sid: 'SM_TEST_456' }), {
      status: 201,
      headers: {
        'content-type': 'application/json'
      }
    });
  }) as typeof fetch;

  t.after(() => {
    restore();
    restoreEnv();
    global.fetch = originalFetch;
  });

  const app = await buildServer();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/v1/twilio/voice/status',
    payload: {
      CallSid: 'CA_LIVE_202',
      CallStatus: 'no-answer'
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(fetchCalled, false);
  assert.equal(createdEvents.length, 1);
  assert.equal(createdEvents[0]?.data.type, 'twilio.status.no-answer');
});
