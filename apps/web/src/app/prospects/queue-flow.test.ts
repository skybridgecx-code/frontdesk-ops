import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PROSPECT_QUEUE_FETCH_LIMIT,
  buildProspectsRequestUrl,
  buildQueueContinuationHref,
  findNextQueueProspectSid,
  getQueueStateLabel,
  getQueueStatusFromReturnTo
} from './queue-flow';

test('prospect queue requests are explicitly bounded beyond the old 50-row default', () => {
  const url = new URL(
    buildProspectsRequestUrl({
      apiBaseUrl: 'http://localhost:4000',
      businessId: 'business-123',
      status: 'READY'
    })
  );

  assert.equal(PROSPECT_QUEUE_FETCH_LIMIT, 200);
  assert.equal(url.pathname, '/v1/businesses/business-123/prospects');
  assert.equal(url.searchParams.get('limit'), '200');
  assert.equal(url.searchParams.get('status'), 'READY');
});

test('returnTo only resolves queue status for prospect queues', () => {
  assert.equal(getQueueStatusFromReturnTo('/prospects?status=READY&page=2'), 'READY');
  assert.equal(getQueueStatusFromReturnTo('/calls?status=READY'), null);
  assert.equal(getQueueStatusFromReturnTo('not-a-url'), null);
});

test('next-in-queue resolves past the first 50 records when the queue is longer', () => {
  const queue = Array.from({ length: 60 }, (_, index) => ({
    prospectSid: `PR_${String(index + 1).padStart(3, '0')}`
  }));

  assert.equal(findNextQueueProspectSid(queue, 'PR_055'), 'PR_056');
  assert.equal(findNextQueueProspectSid(queue, 'PR_060'), null);
});

test('queue continuation preserves returnTo on next and falls back cleanly when there is no next item', () => {
  const returnTo = '/prospects?status=READY';
  const currentDetailHref = `/prospects/PR_055?returnTo=${encodeURIComponent(returnTo)}`;

  assert.equal(
    buildQueueContinuationHref({
      detailHref: currentDetailHref,
      nextProspectSid: 'PR_056',
      returnTo,
      nextNotice: 'saved-next',
      fallbackNotice: 'saved'
    }),
    `/prospects/PR_056?returnTo=${encodeURIComponent(returnTo)}&notice=saved-next`
  );

  assert.equal(
    buildQueueContinuationHref({
      detailHref: currentDetailHref,
      nextProspectSid: null,
      returnTo,
      nextNotice: 'saved-next',
      fallbackNotice: 'saved'
    }),
    `${currentDetailHref}&notice=saved`
  );
});

test('queue state labels remain stable for actionable timestamps', () => {
  const now = Date.UTC(2026, 3, 3, 12, 0, 0);
  assert.equal(getQueueStateLabel(null, now), 'no next action');
  assert.equal(getQueueStateLabel('2026-04-03T11:00:00.000Z', now), 'overdue');
  assert.equal(getQueueStateLabel('2026-04-03T20:00:00.000Z', now), 'due now');
  assert.equal(getQueueStateLabel('2026-04-05T12:00:00.000Z', now), 'upcoming');
});
