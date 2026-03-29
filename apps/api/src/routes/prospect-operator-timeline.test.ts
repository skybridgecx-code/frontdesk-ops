import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProspectOperatorTimeline } from './prospects.js';

test('buildProspectOperatorTimeline shapes newest-first operator history for prospects', () => {
  const timeline = buildProspectOperatorTimeline({
    createdAt: '2026-03-01T09:00:00.000Z',
    sourceLabel: 'public_demo_request',
    respondedAt: '2026-03-03T11:00:00.000Z',
    archivedAt: '2026-03-04T12:00:00.000Z',
    attempts: [
      {
        channel: 'PHONE',
        outcome: 'NO_ANSWER',
        note: 'Left voicemail',
        attemptedAt: '2026-03-02T10:00:00.000Z'
      },
      {
        channel: 'EMAIL',
        outcome: 'REPLY_RECEIVED',
        note: 'Asked for pricing',
        attemptedAt: '2026-03-03T10:00:00.000Z'
      }
    ]
  });

  assert.deepEqual(
    timeline.map((item) => item.type),
    ['prospect.archived', 'prospect.responded', 'prospect.attempt', 'prospect.attempt', 'prospect.created']
  );
  assert.equal(timeline[2]?.title, 'Reply logged');
  assert.match(timeline[2]?.description ?? '', /asked for pricing/i);
  assert.equal(timeline[4]?.actorLabel, 'Demo request');
});

test('buildProspectOperatorTimeline stays safe for sparse rows', () => {
  const timeline = buildProspectOperatorTimeline({
    createdAt: '2026-03-01T09:00:00.000Z',
    sourceLabel: null,
    respondedAt: null,
    archivedAt: null,
    attempts: []
  });

  assert.deepEqual(timeline.map((item) => item.type), ['prospect.created']);
  assert.equal(timeline[0]?.title, 'Prospect added to outbound work');
});
