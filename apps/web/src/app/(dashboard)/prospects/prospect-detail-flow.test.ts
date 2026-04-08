import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProspectMutationRedirect } from './prospect-detail-flow';

test('save-and-next preserves returnTo and advances to the next prospect when available', () => {
  const returnTo = '/prospects?status=READY';
  const detailHref = `/prospects/PR_123?returnTo=${encodeURIComponent(returnTo)}`;

  const redirect = buildProspectMutationRedirect({
    detailHref,
    returnTo,
    queueReturnTo: returnTo,
    nextProspectSid: 'PR_124',
    nextNotice: 'saved-next',
    fallbackNotice: 'saved'
  });

  assert.equal(redirect, `/prospects/PR_124?returnTo=${encodeURIComponent(returnTo)}&notice=saved-next`);
});

test('log-and-next preserves returnTo and advances to the next prospect when available', () => {
  const returnTo = '/prospects?status=IN_PROGRESS';
  const detailHref = `/prospects/PR_900?returnTo=${encodeURIComponent(returnTo)}`;

  const redirect = buildProspectMutationRedirect({
    detailHref,
    returnTo,
    queueReturnTo: returnTo,
    nextProspectSid: 'PR_901',
    nextNotice: 'attempt-saved-next',
    fallbackNotice: 'attempt-saved'
  });

  assert.equal(
    redirect,
    `/prospects/PR_901?returnTo=${encodeURIComponent(returnTo)}&notice=attempt-saved-next`
  );
});

test('continuations fall back to the current detail page with a notice when no next prospect exists', () => {
  const returnTo = '/prospects?status=NEW';
  const detailHref = `/prospects/PR_200?returnTo=${encodeURIComponent(returnTo)}`;

  const saveRedirect = buildProspectMutationRedirect({
    detailHref,
    returnTo,
    queueReturnTo: returnTo,
    nextProspectSid: null,
    nextNotice: 'saved-next',
    fallbackNotice: 'saved'
  });

  const logRedirect = buildProspectMutationRedirect({
    detailHref,
    returnTo,
    queueReturnTo: returnTo,
    nextProspectSid: null,
    nextNotice: 'attempt-saved-next',
    fallbackNotice: 'attempt-saved'
  });

  assert.equal(saveRedirect, `${detailHref}&notice=saved`);
  assert.equal(logRedirect, `${detailHref}&notice=attempt-saved`);
});
