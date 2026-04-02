import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@frontdesk/db';
import { buildServer } from '../server.js';
import { FRONTDESK_ROUTE_DECISION_EVENT_TYPE } from '../lib/call-routing-decision.js';

test('POST /v1/twilio/voice/inbound persists a routing decision event', async (t) => {
  const original = {
    phoneNumberFindUnique: prisma.phoneNumber.findUnique,
    callUpsert: prisma.call.upsert,
    callEventCount: prisma.callEvent.count,
    callEventCreateMany: prisma.callEvent.createMany
  };

  const capturedCreateMany: unknown[] = [];

  prisma.phoneNumber.findUnique = (async () => ({
    id: 'pn_123',
    tenantId: 'tenant_demo',
    businessId: 'biz_demo',
    e164: '+17035550199',
    label: 'Main line',
    isActive: true,
    routingMode: 'AI_ALWAYS',
    primaryAgentProfileId: 'agent_primary',
    afterHoursAgentProfileId: null,
    business: {
      id: 'biz_demo',
      name: 'Demo HVAC',
      timezone: 'America/New_York',
      businessHours: []
    }
  })) as unknown as typeof prisma.phoneNumber.findUnique;

  prisma.call.upsert = ((async () => ({
    id: 'call_123',
    phoneNumberId: 'pn_123',
    agentProfileId: 'agent_primary'
  })) as unknown as typeof prisma.call.upsert);

  prisma.callEvent.count = ((async () => 0) as typeof prisma.callEvent.count);

  prisma.callEvent.createMany = ((async (args: unknown) => {
    capturedCreateMany.push(args);
    return { count: 2 };
  }) as typeof prisma.callEvent.createMany);

  t.after(() => {
    prisma.phoneNumber.findUnique = original.phoneNumberFindUnique;
    prisma.call.upsert = original.callUpsert;
    prisma.callEvent.count = original.callEventCount;
    prisma.callEvent.createMany = original.callEventCreateMany;
  });

  const app = await buildServer();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/v1/twilio/voice/inbound',
    payload: {
      CallSid: 'CA_LIVE_101',
      From: '+17035550100',
      To: '+17035550199'
    }
  });

  assert.equal(response.statusCode, 200);
  const createManyArgs = capturedCreateMany[0] as {
    data: Array<{ type: string; sequence: number; payloadJson: Record<string, unknown> }>;
  };
  assert.equal(createManyArgs.data[1]?.type, FRONTDESK_ROUTE_DECISION_EVENT_TYPE);
  assert.deepEqual(createManyArgs.data[1]?.payloadJson, {
    routingMode: 'AI_ALWAYS',
    isOpen: false,
    routeKind: 'AI',
    agentProfileId: 'agent_primary',
    reason: 'AI_ALWAYS',
    message: 'Connecting to AI front desk',
    phoneLineLabel: 'Main line',
    businessTimezone: 'America/New_York'
  });
});
