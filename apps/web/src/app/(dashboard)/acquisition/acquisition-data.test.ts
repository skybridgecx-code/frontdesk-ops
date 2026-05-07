import assert from 'node:assert/strict';
import test from 'node:test';
import {
  acquisitionTargets,
  filterTargetsByStage,
  getAcquisitionStats,
  getStageCounts,
  getTodayActions
} from './acquisition-data';

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

test('stage filtering returns only matching stage and supports all reset', () => {
  const demoBooked = filterTargetsByStage(acquisitionTargets, 'Demo booked');
  assert.ok(demoBooked.length > 0);
  assert.ok(demoBooked.every((target) => target.stage === 'Demo booked'));

  const all = filterTargetsByStage(acquisitionTargets, 'all');
  assert.equal(all.length, acquisitionTargets.length);
});

test('stage counts summarize the current source view accurately', () => {
  const counts = getStageCounts(acquisitionTargets);
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  assert.equal(total, acquisitionTargets.length);
  assert.equal(counts['Demo booked'], 2);
  assert.equal(counts['Follow-up needed'], 2);
});
