import test from 'node:test';
import assert from 'node:assert/strict';
import { CallReviewStatus, CallTriageStatus } from './index';
import { demoCallFixtures } from './demo-call-fixtures.js';

function getDemoCall(callSid: string) {
  const call = demoCallFixtures.find((entry) => entry.twilioCallSid === callSid);
  assert.ok(call, `Expected fixture for ${callSid}`);
  return call;
}

test('bounded demo fixtures include CA_DEMO_101 through CA_DEMO_106', () => {
  assert.deepEqual(
    demoCallFixtures.map((call) => call.twilioCallSid),
    ['CA_DEMO_101', 'CA_DEMO_102', 'CA_DEMO_103', 'CA_DEMO_104', 'CA_DEMO_105', 'CA_DEMO_106']
  );
});

test('CA_DEMO_101 stays a strong open unreviewed high-urgency transcript-backed row', () => {
  const call = getDemoCall('CA_DEMO_101');

  assert.equal(call.triageStatus, CallTriageStatus.OPEN);
  assert.equal(call.reviewStatus, CallReviewStatus.UNREVIEWED);
  assert.equal(call.urgency, 'high');
  assert.ok(call.callerTranscript && call.callerTranscript.length > 40);
  assert.ok(call.assistantTranscript && call.assistantTranscript.length > 20);
  assert.ok(call.summary);
});

test('CA_DEMO_102 stays an open unreviewed medium-urgency transcript-backed service inquiry', () => {
  const call = getDemoCall('CA_DEMO_102');

  assert.equal(call.triageStatus, CallTriageStatus.OPEN);
  assert.equal(call.reviewStatus, CallReviewStatus.UNREVIEWED);
  assert.equal(call.urgency, 'medium');
  assert.ok(call.callerTranscript);
  assert.ok(call.assistantTranscript);
  assert.match(call.leadIntent ?? '', /tune-up/i);
});

test('CA_DEMO_103 stays a transcript-backed needs-review emergency scenario', () => {
  const call = getDemoCall('CA_DEMO_103');

  assert.equal(call.reviewStatus, CallReviewStatus.NEEDS_REVIEW);
  assert.equal(call.urgency, 'emergency');
  assert.ok(call.callerTranscript);
  assert.ok(call.assistantTranscript);
  assert.ok(call.leadPhone);
});

test('CA_DEMO_104 stays the contacted reviewed scenario in the bounded demo set', () => {
  const call = getDemoCall('CA_DEMO_104');

  assert.equal(call.triageStatus, CallTriageStatus.CONTACTED);
  assert.equal(call.reviewStatus, CallReviewStatus.REVIEWED);
  assert.ok(call.contactedAt instanceof Date);
  assert.ok(call.reviewedAt instanceof Date);
});

test('CA_DEMO_105 remains intentionally low-signal', () => {
  const call = getDemoCall('CA_DEMO_105');

  assert.equal(call.triageStatus, CallTriageStatus.OPEN);
  assert.equal(call.reviewStatus, CallReviewStatus.UNREVIEWED);
  assert.equal(call.leadName, null);
  assert.equal(call.leadPhone, null);
  assert.equal(call.leadIntent, null);
  assert.ok(call.callerTranscript);
  assert.ok(call.summary);
});

test('CA_DEMO_106 remains intentionally partial but transcript-backed', () => {
  const call = getDemoCall('CA_DEMO_106');

  assert.equal(call.triageStatus, CallTriageStatus.OPEN);
  assert.equal(call.reviewStatus, CallReviewStatus.UNREVIEWED);
  assert.equal(call.summary, null);
  assert.equal(call.urgency, null);
  assert.ok(call.callerTranscript);
  assert.ok(call.assistantTranscript);
  assert.ok(call.leadIntent);
});

test('bounded demo fixtures preserve the operator-validation scenario mix', () => {
  const urgencies = new Set(demoCallFixtures.map((call) => call.urgency));
  const openUnreviewed = demoCallFixtures.filter(
    (call) =>
      call.triageStatus === CallTriageStatus.OPEN && call.reviewStatus === CallReviewStatus.UNREVIEWED
  );

  assert.ok(openUnreviewed.length > 0);
  assert.ok(urgencies.has('high') || urgencies.has('emergency'));
  assert.ok(urgencies.has('medium'));
  assert.ok(demoCallFixtures.some((call) => call.reviewStatus === CallReviewStatus.NEEDS_REVIEW));
  assert.ok(
    demoCallFixtures.some(
      (call) =>
        call.triageStatus === CallTriageStatus.CONTACTED &&
        call.reviewStatus === CallReviewStatus.REVIEWED
    )
  );
  assert.ok(
    demoCallFixtures.some(
      (call) =>
        call.callerTranscript &&
        call.assistantTranscript &&
        (call.summary === null || call.leadIntent === null)
    )
  );
});
