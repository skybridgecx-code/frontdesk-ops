import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProspectOutreachSnapshot } from './outreach-copilot.shared';

test('prospect outreach snapshot keeps only the latest attempts for generation input', () => {
  const snapshot = buildProspectOutreachSnapshot(
    {
      prospectSid: 'PR_123',
      companyName: 'Acme Plumbing',
      contactName: 'Jordan Smith',
      contactPhone: '555-0101',
      contactEmail: 'jordan@example.com',
      city: 'Austin',
      state: 'TX',
      sourceLabel: 'houston_starter_list',
      status: 'READY',
      priority: 'HIGH',
      serviceInterest: 'Water heater replacement',
      notes: 'Needs evening follow-up.',
      nextActionAt: '2026-04-05T15:00:00.000Z',
      lastAttemptAt: '2026-04-05T09:15:00.000Z'
    },
    [
      {
        id: 'att_1',
        channel: 'CALL',
        outcome: 'NO_ANSWER',
        note: null,
        attemptedAt: '2026-04-05T09:15:00.000Z',
        createdAt: '2026-04-05T09:15:00.000Z'
      },
      {
        id: 'att_2',
        channel: 'SMS',
        outcome: 'SENT_EMAIL',
        note: 'Sent follow-up.',
        attemptedAt: '2026-04-05T10:15:00.000Z',
        createdAt: '2026-04-05T10:15:00.000Z'
      },
      {
        id: 'att_3',
        channel: 'EMAIL',
        outcome: 'REPLIED',
        note: 'Replied to the email.',
        attemptedAt: '2026-04-05T11:15:00.000Z',
        createdAt: '2026-04-05T11:15:00.000Z'
      },
      {
        id: 'att_4',
        channel: 'CALL',
        outcome: 'LEFT_VOICEMAIL',
        note: 'Left a voicemail.',
        attemptedAt: '2026-04-05T12:15:00.000Z',
        createdAt: '2026-04-05T12:15:00.000Z'
      }
    ]
  );

  assert.equal(snapshot.prospect.companyName, 'Acme Plumbing');
  assert.equal(snapshot.prospect.serviceInterest, 'Water heater replacement');
  assert.equal(snapshot.recentAttempts.length, 3);
  assert.deepEqual(snapshot.recentAttempts.map((attempt) => attempt.attemptedAt), [
    '2026-04-05T09:15:00.000Z',
    '2026-04-05T10:15:00.000Z',
    '2026-04-05T11:15:00.000Z'
  ]);
});
