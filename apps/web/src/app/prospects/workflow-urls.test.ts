import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDetailReviewNextRequestHref,
  buildFilterHref,
  buildProspectDetailHref,
  buildQueueNoticeHref,
  buildQueueReviewNextRequestHref,
  buildSaveAndNextHref,
  normalizeLimit,
  normalizePage,
  normalizeReturnTo
} from './workflow-urls.js';

test('buildFilterHref keeps prospect scope and strips default page/limit', () => {
  assert.equal(
    buildFilterHref({
      status: 'READY',
      priority: 'HIGH',
      q: '  reston  ',
      page: '1',
      limit: '25'
    }),
    '/prospects?status=READY&priority=HIGH&q=reston'
  );
});

test('buildFilterHref keeps non-default paging when present', () => {
  assert.equal(
    buildFilterHref({
      status: 'ATTEMPTED',
      page: '2',
      limit: '10'
    }),
    '/prospects?status=ATTEMPTED&page=2&limit=10'
  );
});

test('normalizePage and normalizeLimit clamp invalid values', () => {
  assert.equal(normalizePage('0'), '1');
  assert.equal(normalizeLimit('999'), '100');
});

test('buildProspectDetailHref includes encoded returnTo', () => {
  assert.equal(
    buildProspectDetailHref('PR_DEMO_101', '/prospects?status=READY&page=2'),
    '/prospects/PR_DEMO_101?returnTo=%2Fprospects%3Fstatus%3DREADY%26page%3D2'
  );
});

test('buildQueueReviewNextRequestHref scopes review-next to queue filters only', () => {
  assert.equal(
    buildQueueReviewNextRequestHref('/prospects?status=READY&priority=HIGH&q=reston&page=2&limit=25'),
    '/v1/prospects/review-next?status=READY&priority=HIGH&q=reston'
  );
});

test('normalizeReturnTo keeps valid prospect scope and falls back for invalid returnTo', () => {
  assert.equal(normalizeReturnTo('/prospects?status=ATTEMPTED&page=2'), '/prospects?status=ATTEMPTED&page=2');
  assert.equal(normalizeReturnTo('/calls?triageStatus=OPEN'), '/prospects?status=READY');
  assert.equal(normalizeReturnTo(undefined), '/prospects?status=READY');
});

test('buildDetailReviewNextRequestHref preserves queue scope and adds self-exclusion', () => {
  assert.equal(
    buildDetailReviewNextRequestHref('/prospects?status=READY&priority=HIGH&page=2', 'PR_DEMO_101'),
    '/v1/prospects/review-next?excludeProspectSid=PR_DEMO_101&status=READY&priority=HIGH'
  );
});

test('buildQueueNoticeHref preserves returnTo queue context for terminal fallback', () => {
  assert.equal(
    buildQueueNoticeHref('/prospects?status=READY&priority=HIGH&page=1', 'no-review-prospects'),
    '/prospects?status=READY&priority=HIGH&page=1&notice=no-review-prospects'
  );
});

test('buildQueueNoticeHref merges extra notice context when provided', () => {
  assert.equal(
    buildQueueNoticeHref('/prospects?status=READY&page=1', 'provider-import-failed', {
      error: 'APOLLO_API_KEY is not set'
    }),
    '/prospects?status=READY&page=1&notice=provider-import-failed&error=APOLLO_API_KEY+is+not+set'
  );
});

test('buildSaveAndNextHref preserves returnTo on happy-path next navigation', () => {
  assert.equal(
    buildSaveAndNextHref('PR_DEMO_102', '/prospects?status=READY&page=2'),
    '/prospects/PR_DEMO_102?returnTo=%2Fprospects%3Fstatus%3DREADY%26page%3D2&notice=saved-next'
  );
});
