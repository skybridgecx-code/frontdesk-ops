import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNoticeHref,
  buildQueueContextSummary,
  getWorkItemSaveNoticeMessage,
  normalizeLimit,
  normalizePage
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
