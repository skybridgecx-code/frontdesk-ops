import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCallOperatorTimeline } from './calls.js';

test('buildCallOperatorTimeline shapes newest-first operator history for calls', () => {
  const timeline = buildCallOperatorTimeline({
    startedAt: '2026-03-01T09:00:00.000Z',
    answeredAt: '2026-03-01T09:01:00.000Z',
    endedAt: null,
    durationSeconds: 180,
    fromE164: '+17035550001',
    toE164: '+17035550100',
    reviewStatus: 'REVIEWED',
    contactedAt: '2026-03-01T09:10:00.000Z',
    archivedAt: '2026-03-01T09:20:00.000Z',
    reviewedAt: '2026-03-01T09:05:00.000Z',
    phoneNumberLabel: 'Main Line',
    routingDecision: {
      routingMode: 'business_hours',
      isOpen: true,
      routeKind: 'LIVE_AGENT',
      agentProfileId: 'agent_demo',
      reason: 'BUSINESS_OPEN',
      message: 'Routed live to the daytime voice agent.',
      phoneLineLabel: 'Main Line',
      businessTimezone: 'America/New_York'
    },
    events: [
      {
        type: 'frontdesk.route.decision',
        createdAt: '2026-03-01T09:02:00.000Z'
      }
    ]
  });

  assert.deepEqual(
    timeline.map((item) => item.type),
    ['call.archived', 'call.contacted', 'call.reviewed', 'frontdesk.route.decision', 'call.answered', 'call.started']
  );
  assert.equal(timeline[3]?.title, 'Routing decision recorded');
  assert.match(timeline[3]?.description ?? '', /daytime voice agent/i);
  assert.equal(timeline[3]?.actorLabel, 'Main Line');
  assert.equal(timeline[3]?.statusLabel, 'Live agent');
});

test('buildCallOperatorTimeline stays safe for sparse legacy rows', () => {
  const timeline = buildCallOperatorTimeline({
    startedAt: '2026-03-01T09:00:00.000Z',
    answeredAt: null,
    endedAt: null,
    durationSeconds: null,
    fromE164: null,
    toE164: null,
    reviewStatus: 'UNREVIEWED',
    contactedAt: null,
    archivedAt: null,
    reviewedAt: null,
    phoneNumberLabel: null,
    routingDecision: null,
    events: []
  });

  assert.deepEqual(timeline.map((item) => item.type), ['call.started']);
  assert.equal(timeline[0]?.title, 'Inbound call started');
});
