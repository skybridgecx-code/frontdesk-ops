import assert from 'node:assert/strict';
import test from 'node:test';
import { ProspectStatus } from '@frontdesk/db';
import { buildProspectAttemptUpdateData } from './prospect-attempts-write';

test('attempt logging promotes non-terminal prospects and stamps the attempt time', () => {
  const attemptedAt = new Date('2026-04-06T13:30:00.000Z');

  const update = buildProspectAttemptUpdateData({
    currentStatus: ProspectStatus.READY,
    attemptedAt
  });

  assert.deepEqual(update, {
    lastAttemptAt: attemptedAt,
    status: ProspectStatus.ATTEMPTED
  });
});

test('attempt logging preserves terminal prospects while still stamping the attempt time', () => {
  const attemptedAt = new Date('2026-04-06T13:30:00.000Z');

  const update = buildProspectAttemptUpdateData({
    currentStatus: ProspectStatus.QUALIFIED,
    attemptedAt
  });

  assert.deepEqual(update, {
    lastAttemptAt: attemptedAt,
    status: ProspectStatus.QUALIFIED
  });
});
