import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDetailNoticeHref,
  buildNoticeHref,
  buildQueueContextSummary,
  getWorkItemDetailNoticeMessage,
  getWorkItemSaveNoticeMessage,
  normalizeLimit,
  normalizePage,
  resolveReviewNextDetailHref
} from './operator-workflow.js';

test('normalizePage and normalizeLimit clamp invalid values', () => {
  assert.equal(normalizePage('0'), '1');
  assert.equal(normalizeLimit('999'), '100');
});

test('buildNoticeHref preserves current scope and merges extras', () => {
  assert.equal(
    buildNoticeHref('/prospects?tenantId=tenant_demo&status=READY&page=2', 'provider-import-failed', {
      error: 'APOLLO_API_KEY is not set'
    }),
    '/prospects?tenantId=tenant_demo&status=READY&page=2&notice=provider-import-failed&error=APOLLO_API_KEY+is+not+set'
  );
});

test('buildQueueContextSummary creates a shared return-context summary from queue scope', () => {
  assert.equal(
    buildQueueContextSummary({
      currentHref: '/calls?triageStatus=OPEN&reviewStatus=UNREVIEWED&urgency=high&q=reston&page=2',
      fallbackLabel: 'Open work queue',
      formatters: {
        triageStatus: (value) => (value === 'OPEN' ? 'Open' : null),
        reviewStatus: (value) => (value === 'UNREVIEWED' ? 'Unreviewed' : null),
        urgency: (value) => (value === 'high' ? 'High urgency' : null)
      }
    }),
    'Open • Unreviewed • High urgency • Search: "reston" • Page 2'
  );
});

test('getWorkItemSaveNoticeMessage aligns shared save-and-next semantics without hiding domain nouns', () => {
  assert.equal(
    getWorkItemSaveNoticeMessage({
      notice: 'saved-next',
      itemSingular: 'call',
      itemPlural: 'calls'
    }),
    'Changes saved. Moved to the next call needing attention.'
  );

  assert.equal(
    getWorkItemSaveNoticeMessage({
      notice: 'no-review-prospects',
      itemSingular: 'prospect',
      itemPlural: 'prospects'
    }),
    'Changes saved. No more prospects need attention.'
  );
});

test('getWorkItemDetailNoticeMessage combines custom mutation notices with shared save notices', () => {
  assert.equal(
    getWorkItemDetailNoticeMessage({
      notice: 'archived',
      itemSingular: 'call',
      itemPlural: 'calls',
      customMessages: {
        archived: 'Call archived.'
      }
    }),
    'Call archived.'
  );

  assert.equal(
    getWorkItemDetailNoticeMessage({
      notice: 'saved-next',
      itemSingular: 'prospect',
      itemPlural: 'prospects',
      customMessages: {
        archived: 'Prospect archived.'
      }
    }),
    'Changes saved. Moved to the next prospect needing attention.'
  );
});

test('buildDetailNoticeHref preserves return context while adding a notice', () => {
  assert.equal(
    buildDetailNoticeHref('/calls/CA_DEMO_101?returnTo=%2Fcalls%3FtriageStatus%3DOPEN', 'archived'),
    '/calls/CA_DEMO_101?returnTo=%2Fcalls%3FtriageStatus%3DOPEN&notice=archived'
  );
});

test('resolveReviewNextDetailHref shares save-and-review-next redirect semantics', () => {
  assert.equal(
    resolveReviewNextDetailHref({
      currentItemId: 'CA_DEMO_101',
      nextItemId: null,
      returnTo: '/calls?triageStatus=OPEN',
      noReviewNotice: 'no-review-calls',
      buildQueueNoticeHref: (returnTo, notice) => buildNoticeHref(returnTo, notice),
      buildSaveAndNextHref: (nextItemId, returnTo) =>
        `/calls/${nextItemId}?returnTo=${encodeURIComponent(returnTo)}&notice=saved-next`
    }),
    '/calls?triageStatus=OPEN&notice=no-review-calls'
  );

  assert.equal(
    resolveReviewNextDetailHref({
      currentItemId: 'PR_DEMO_101',
      nextItemId: 'PR_DEMO_102',
      returnTo: '/prospects?tenantId=tenant_demo&status=READY',
      noReviewNotice: 'no-review-prospects',
      buildQueueNoticeHref: (returnTo, notice) => buildNoticeHref(returnTo, notice),
      buildSaveAndNextHref: (nextItemId, returnTo) =>
        `/prospects/${nextItemId}?returnTo=${encodeURIComponent(returnTo)}&notice=saved-next`
    }),
    '/prospects/PR_DEMO_102?returnTo=%2Fprospects%3FtenantId%3Dtenant_demo%26status%3DREADY&notice=saved-next'
  );
});
