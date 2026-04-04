import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProspectActivityTimeline } from './prospect-activity-timeline';

test('buildProspectActivityTimeline keeps attempts and the current snapshot distinct', () => {
  const timeline = buildProspectActivityTimeline(
    {
      prospectSid: 'PR_123',
      companyName: 'Acme HVAC',
      contactName: 'Jordan Smith',
      contactPhone: null,
      contactEmail: null,
      city: null,
      state: null,
      sourceLabel: null,
      status: 'RESPONDED',
      priority: 'HIGH',
      notes: 'Customer responded and wants a quote.',
      nextActionAt: '2026-04-04T15:00:00.000Z',
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-03T12:00:00.000Z'
    },
    [
      {
        id: 'attempt-1',
        channel: 'CALL',
        outcome: 'LEFT_VOICEMAIL',
        note: 'Left voicemail and requested callback.',
        attemptedAt: '2026-04-03T11:30:00.000Z',
        createdAt: '2026-04-03T11:30:00.000Z'
      },
      {
        id: 'attempt-2',
        channel: 'SMS',
        outcome: 'REPLIED',
        note: null,
        attemptedAt: '2026-04-03T09:00:00.000Z',
        createdAt: '2026-04-03T09:00:00.000Z'
      }
    ]
  );

  assert.equal(timeline.length, 3);
  assert.equal(timeline[0]?.kind, 'snapshot');
  assert.equal(timeline[0]?.eventTypeLabel, 'Current snapshot');
  assert.match(timeline[0]?.description ?? '', /Status Responded/);
  assert.match(timeline[0]?.description ?? '', /Priority High/);
  assert.match(timeline[0]?.description ?? '', /Next action/);
  assert.equal(timeline[1]?.kind, 'attempt');
  assert.equal(timeline[1]?.eventTypeLabel, 'Attempt');
  assert.match(timeline[1]?.description ?? '', /Call/);
  assert.match(timeline[1]?.description ?? '', /Left Voicemail/);
  assert.equal(timeline[2]?.kind, 'attempt');
});
