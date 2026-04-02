import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFrontdeskCallActionGuide } from '@frontdesk/domain';

function buildInput(overrides: Partial<Parameters<typeof buildFrontdeskCallActionGuide>[0]> = {}) {
  return {
    triageStatus: 'OPEN' as const,
    reviewStatus: 'UNREVIEWED' as const,
    contactedAt: null,
    archivedAt: null,
    urgency: null,
    leadName: 'Casey Caller',
    leadPhone: '703-555-0100',
    fromE164: '+17035550100',
    leadIntent: 'Water heater not working',
    serviceAddress: '123 Main St',
    summary: 'Caller needs a same-day water heater inspection.',
    callerTranscript: 'My water heater stopped working this morning.',
    assistantTranscript: 'I can help gather details for the team.',
    ...overrides
  };
}

test('call action guide prioritizes immediate callback for emergency or high-urgency calls with callback info', () => {
  const guide = buildFrontdeskCallActionGuide(
    buildInput({
      urgency: 'emergency'
    })
  );

  assert.equal(guide.primaryAction, 'Call back now and confirm the situation.');
  assert.equal(guide.urgencyLevel, 'emergency');
  assert.equal(guide.readyToContact, true);
});

test('call action guide marks contactable but unreviewed calls for quick review then callback', () => {
  const guide = buildFrontdeskCallActionGuide(
    buildInput({
      urgency: 'medium'
    })
  );

  assert.equal(guide.primaryAction, 'Finish a quick review, then call back.');
  assert.equal(guide.readyToContact, true);
});

test('call action guide blocks follow-up when callback phone is missing', () => {
  const guide = buildFrontdeskCallActionGuide(
    buildInput({
      leadPhone: null,
      fromE164: null
    })
  );

  assert.equal(guide.primaryAction, 'Review the call and capture a callback number before follow-up.');
  assert.equal(guide.readyToContact, false);
  assert.match(guide.missingInfo.join(', '), /callback phone/);
});

test('call action guide requires transcript review when extraction is thin but transcript exists', () => {
  const guide = buildFrontdeskCallActionGuide(
    buildInput({
      summary: null,
      leadIntent: null
    })
  );

  assert.equal(guide.primaryAction, 'Read the transcript and write a usable call summary before outreach.');
  assert.equal(guide.needsTranscriptReview, true);
  assert.equal(guide.readyToContact, false);
});

test('call action guide treats already contacted calls as follow-up verification work', () => {
  const guide = buildFrontdeskCallActionGuide(
    buildInput({
      triageStatus: 'CONTACTED',
      reviewStatus: 'REVIEWED',
      contactedAt: '2026-03-29T10:00:00.000Z'
    })
  );

  assert.equal(guide.primaryAction, 'Check the last outreach result before taking another follow-up step.');
  assert.equal(guide.readyToContact, false);
});

test('call action guide keeps archived calls out of active work', () => {
  const guide = buildFrontdeskCallActionGuide(
    buildInput({
      triageStatus: 'ARCHIVED',
      archivedAt: '2026-03-29T10:00:00.000Z'
    })
  );

  assert.equal(guide.primaryAction, 'No further action. Keep this call archived.');
  assert.equal(guide.readyToContact, false);
});
