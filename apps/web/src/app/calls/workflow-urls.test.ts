import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCallDetailHref,
  buildDetailReviewNextRequestHref,
  buildFilterHref,
  buildNoticeHref,
  buildQueueNoticeHref,
  buildQueueReviewNextRequestHref,
  buildSaveAndNextHref,
  normalizeReturnTo
} from './workflow-urls.js';

test('buildFilterHref keeps queue scope and strips default page/limit', () => {
  assert.equal(
    buildFilterHref({
      triageStatus: 'OPEN',
      reviewStatus: 'UNREVIEWED',
      urgency: 'high',
      q: '  reston  ',
      page: '1',
      limit: '25'
    }),
    '/calls?triageStatus=OPEN&reviewStatus=UNREVIEWED&urgency=high&q=reston'
  );
});

test('buildNoticeHref preserves current queue scope and only merges notice', () => {
  assert.equal(
    buildNoticeHref('/calls?triageStatus=OPEN&page=2', 'no-review-calls'),
    '/calls?triageStatus=OPEN&page=2&notice=no-review-calls'
  );
});

test('buildCallDetailHref includes encoded returnTo', () => {
  assert.equal(
    buildCallDetailHref('CA_DEMO_101', '/calls?triageStatus=OPEN&page=2'),
    '/calls/CA_DEMO_101?returnTo=%2Fcalls%3FtriageStatus%3DOPEN%26page%3D2'
  );
});

test('buildQueueReviewNextRequestHref scopes review-next to queue filters only', () => {
  assert.equal(
    buildQueueReviewNextRequestHref('/calls?triageStatus=OPEN&reviewStatus=UNREVIEWED&urgency=high&q=reston&page=2&limit=25'),
    '/v1/calls/review-next?triageStatus=OPEN&reviewStatus=UNREVIEWED&urgency=high&q=reston'
  );
});

test('buildDetailReviewNextRequestHref preserves queue scope and adds self-exclusion', () => {
  assert.equal(
    buildDetailReviewNextRequestHref('/calls?triageStatus=OPEN&reviewStatus=UNREVIEWED&page=2', 'CA_DEMO_101'),
    '/v1/calls/review-next?excludeCallSid=CA_DEMO_101&triageStatus=OPEN&reviewStatus=UNREVIEWED'
  );
});

test('buildQueueNoticeHref preserves returnTo queue context for terminal fallback', () => {
  assert.equal(
    buildQueueNoticeHref('/calls?triageStatus=OPEN&urgency=high&page=1', 'no-review-calls'),
    '/calls?triageStatus=OPEN&urgency=high&page=1&notice=no-review-calls'
  );
});

test('buildSaveAndNextHref preserves returnTo on happy-path next navigation', () => {
  assert.equal(
    buildSaveAndNextHref('CA_DEMO_102', '/calls?triageStatus=OPEN&page=2'),
    '/calls/CA_DEMO_102?returnTo=%2Fcalls%3FtriageStatus%3DOPEN%26page%3D2&notice=saved-next'
  );
});

test('normalizeReturnTo keeps valid calls scope and falls back for invalid returnTo', () => {
  assert.equal(normalizeReturnTo('/calls?triageStatus=OPEN&page=2'), '/calls?triageStatus=OPEN&page=2');
  assert.equal(normalizeReturnTo('/dashboard'), '/calls?triageStatus=OPEN');
  assert.equal(normalizeReturnTo(undefined), '/calls?triageStatus=OPEN');
});
