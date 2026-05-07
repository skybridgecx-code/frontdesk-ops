import assert from 'node:assert/strict';
import test from 'node:test';
import { acquisitionTargets, getAcquisitionStats, getTodayActions } from './acquisition-data';

test('acquisition stats summarize sample pipeline correctly', () => {
  const stats = getAcquisitionStats(acquisitionTargets, new Date('2026-05-07T12:00:00.000Z'));

  assert.equal(stats.researched, 10);
  assert.equal(stats.contacted, 9);
  assert.equal(stats.demosBooked, 2);
  assert.equal(stats.followUpsDue, 4);
});

test('today action list stays between three and five actions', () => {
  const actions = getTodayActions(acquisitionTargets, new Date('2026-05-07T12:00:00.000Z'));

  assert.ok(actions.length >= 3);
  assert.ok(actions.length <= 5);
  assert.match(actions[0]?.label ?? '', /Follow up/i);
});
