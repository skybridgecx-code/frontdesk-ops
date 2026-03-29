import test from 'node:test';
import assert from 'node:assert/strict';
import { getCallQueueActionHint, getProspectQueueActionHint } from './queue-action-hints.js';

test('getCallQueueActionHint projects high-urgency callbacks into a queue hint', () => {
  assert.deepEqual(
    getCallQueueActionHint({
      triageStatus: 'OPEN',
      reviewStatus: 'UNREVIEWED',
      contactedAt: null,
      archivedAt: null,
      urgency: 'high',
      leadName: 'Jamie',
      leadPhone: '555-0100',
      fromE164: null,
      leadIntent: 'No heat',
      serviceAddress: '123 Main St',
      summary: 'Caller reported no heat.',
      callerTranscript: 'My furnace is out.',
      assistantTranscript: 'We will call you back.'
    }),
    {
      label: 'Call back now',
      reason: 'This call is still unreviewed, but urgency is already high enough that callback should not wait.',
      tone: 'high'
    }
  );
});

test('getCallQueueActionHint projects missing callback data into a blocker hint', () => {
  assert.deepEqual(
    getCallQueueActionHint({
      triageStatus: 'OPEN',
      reviewStatus: 'UNREVIEWED',
      contactedAt: null,
      archivedAt: null,
      urgency: null,
      leadName: 'Jamie',
      leadPhone: null,
      fromE164: null,
      leadIntent: null,
      serviceAddress: null,
      summary: null,
      callerTranscript: 'Please call me back.',
      assistantTranscript: null
    }),
    {
      label: 'Need callback number',
      reason: 'A follow-up call cannot happen confidently without any callback phone on the record.',
      tone: 'normal'
    }
  );
});

test('getProspectQueueActionHint projects replied prospects into a reply-handling hint', () => {
  assert.deepEqual(
    getProspectQueueActionHint({
      status: 'RESPONDED',
      priority: 'HIGH',
      nextActionAt: null,
      lastAttemptAt: '2026-03-29T13:00:00.000Z',
      respondedAt: '2026-03-29T13:30:00.000Z',
      archivedAt: null,
      contactPhone: '555-0200',
      contactEmail: 'ops@example.com',
      contactName: 'Dana',
      companyName: 'Acme Dental',
      serviceInterest: 'Phone coverage',
      notes: null,
      sourceLabel: 'apollo',
      sourceCategory: null,
      sourceRoleTitle: null,
      attempts: [
        {
          channel: 'EMAIL',
          outcome: 'REPLIED',
          note: null,
          attemptedAt: '2026-03-29T13:00:00.000Z',
          createdAt: '2026-03-29T13:00:00.000Z'
        }
      ]
    }),
    {
      label: 'Handle reply',
      reason: 'A response is already on record, so the next operator step is reply handling and qualification rather than another blind touch.',
      tone: 'high'
    }
  );
});

test('getProspectQueueActionHint projects ready prospects into an outreach hint', () => {
  assert.deepEqual(
    getProspectQueueActionHint({
      status: 'READY',
      priority: 'MEDIUM',
      nextActionAt: null,
      lastAttemptAt: null,
      respondedAt: null,
      archivedAt: null,
      contactPhone: '555-0200',
      contactEmail: null,
      contactName: 'Dana',
      companyName: 'Acme Dental',
      serviceInterest: 'Phone coverage',
      notes: null,
      sourceLabel: 'apollo',
      sourceCategory: null,
      sourceRoleTitle: null,
      attempts: []
    }),
    {
      label: 'Start outreach',
      reason: 'The prospect is ready, contactable, and does not yet have a scheduled next action.',
      tone: 'normal'
    }
  );
});
