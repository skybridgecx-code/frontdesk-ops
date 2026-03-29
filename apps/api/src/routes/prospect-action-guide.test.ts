import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFrontdeskProspectActionGuide } from '@frontdesk/domain';

function buildInput(
  overrides: Partial<Parameters<typeof buildFrontdeskProspectActionGuide>[0]> = {}
) {
  return {
    status: 'READY' as const,
    priority: 'MEDIUM' as const,
    nextActionAt: null,
    lastAttemptAt: null,
    respondedAt: null,
    archivedAt: null,
    contactPhone: '703-555-0100',
    contactEmail: 'ops@example.com',
    contactName: 'Priya Shah',
    companyName: 'Nova Pediatrics',
    serviceInterest: 'After-hours overflow',
    notes: 'Interested in how after-hours calls get handled.',
    sourceLabel: 'website_inquiry',
    sourceCategory: 'Pediatrics Practice',
    sourceRoleTitle: 'Practice Manager',
    attempts: [],
    now: new Date('2026-03-29T15:00:00.000Z'),
    ...overrides
  };
}

test('prospect action guide marks READY prospects with contact info as ready for outreach', () => {
  const guide = buildFrontdeskProspectActionGuide(buildInput());

  assert.equal(guide.primaryAction, 'Start outreach now and set the next action time.');
  assert.equal(guide.readyForOutreach, true);
  assert.equal(guide.needsReplyHandling, false);
});

test('prospect action guide blocks NEW prospects missing all contact methods', () => {
  const guide = buildFrontdeskProspectActionGuide(
    buildInput({
      status: 'NEW',
      contactPhone: null,
      contactEmail: null
    })
  );

  assert.equal(guide.primaryAction, 'Find a usable contact method before outreach.');
  assert.equal(guide.readyForOutreach, false);
  assert.match(guide.missingInfo.join(', '), /contact method/);
});

test('prospect action guide prompts follow-up for ATTEMPTED prospects due now without reply', () => {
  const guide = buildFrontdeskProspectActionGuide(
    buildInput({
      status: 'ATTEMPTED',
      lastAttemptAt: '2026-03-28T15:00:00.000Z',
      nextActionAt: '2026-03-29T09:00:00.000Z',
      attempts: [
        {
          channel: 'EMAIL',
          outcome: 'SENT_EMAIL',
          note: 'Sent intro note.',
          attemptedAt: '2026-03-28T15:00:00.000Z',
          createdAt: '2026-03-28T15:00:00.000Z'
        }
      ]
    })
  );

  assert.equal(guide.primaryAction, 'Send the next follow-up now.');
  assert.equal(guide.readyForOutreach, true);
});

test('prospect action guide sends RESPONDED prospects into reply handling and qualification review', () => {
  const guide = buildFrontdeskProspectActionGuide(
    buildInput({
      status: 'RESPONDED',
      respondedAt: '2026-03-29T10:00:00.000Z',
      attempts: [
        {
          channel: 'EMAIL',
          outcome: 'REPLIED',
          note: 'Asked for pricing details.',
          attemptedAt: '2026-03-29T10:00:00.000Z',
          createdAt: '2026-03-29T10:00:00.000Z'
        }
      ]
    })
  );

  assert.equal(
    guide.primaryAction,
    'Review the reply and decide whether to qualify, answer questions, or disqualify.'
  );
  assert.equal(guide.needsReplyHandling, true);
  assert.equal(guide.needsQualificationReview, true);
});

test('prospect action guide treats QUALIFIED prospects as handoff confirmation work', () => {
  const guide = buildFrontdeskProspectActionGuide(
    buildInput({
      status: 'QUALIFIED',
      priority: 'HIGH'
    })
  );

  assert.equal(guide.primaryAction, 'Confirm qualified handoff and the next human follow-up step.');
  assert.equal(guide.readyForOutreach, false);
  assert.equal(guide.needsQualificationReview, true);
});

test('prospect action guide keeps ARCHIVED prospects out of active work', () => {
  const guide = buildFrontdeskProspectActionGuide(
    buildInput({
      status: 'ARCHIVED',
      archivedAt: '2026-03-29T10:00:00.000Z'
    })
  );

  assert.equal(guide.primaryAction, 'No further action. Keep this prospect archived.');
  assert.equal(guide.readyForOutreach, false);
  assert.equal(guide.attentionLevel, 'low');
});
