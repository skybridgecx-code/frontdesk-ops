import assert from 'node:assert/strict';
import test from 'node:test';
import { getProspectReadSignals, getProspectQueueStateLabel } from './prospect-read-model';

test('terminal prospects are not treated as actionable even if they still carry a next action timestamp', () => {
  const signals = getProspectReadSignals({
    status: 'RESPONDED',
    nextActionAt: '2026-04-05T12:00:00.000Z',
    lastAttemptAt: '2026-04-04T11:30:00.000Z',
    nowMs: Date.UTC(2026, 3, 4, 12, 0, 0)
  });

  assert.deepEqual(signals, {
    isTerminal: true,
    hasNextAction: false,
    hasLastAttempt: true,
    isActionable: false,
    queueStateLabel: 'no next action'
  });
});

test('non-terminal prospects use the shared queue-state labels for visibility', () => {
  const nowMs = Date.UTC(2026, 3, 4, 12, 0, 0);

  assert.equal(getProspectQueueStateLabel('2026-04-04T11:00:00.000Z', nowMs), 'overdue');
  assert.equal(getProspectQueueStateLabel('2026-04-04T20:00:00.000Z', nowMs), 'due now');
  assert.equal(getProspectQueueStateLabel('2026-04-06T12:00:00.000Z', nowMs), 'upcoming');
  assert.equal(
    getProspectReadSignals({
      status: 'READY',
      nextActionAt: '2026-04-04T20:00:00.000Z',
      lastAttemptAt: null,
      nowMs
    }).isActionable,
    true
  );
});
