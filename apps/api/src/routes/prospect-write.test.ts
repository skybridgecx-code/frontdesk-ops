import assert from 'node:assert/strict';
import test from 'node:test';
import { ProspectPriority, ProspectStatus } from '@frontdesk/db';
import { buildProspectWriteUpdateData } from './prospect-write';

test('workflow save preserves non-terminal next actions and explicit fields', () => {
  const nextActionAt = new Date('2026-04-06T13:30:00.000Z');

  const update = buildProspectWriteUpdateData({
    currentStatus: ProspectStatus.NEW,
    status: ProspectStatus.READY,
    priority: ProspectPriority.HIGH,
    notes: 'Call after lunch',
    nextActionAt
  });

  assert.deepEqual(update, {
    status: ProspectStatus.READY,
    priority: ProspectPriority.HIGH,
    notes: 'Call after lunch',
    nextActionAt
  });
});

test('workflow save clears nextActionAt for terminal states and keeps them terminal', () => {
  const nextActionAt = new Date('2026-04-06T13:30:00.000Z');

  const update = buildProspectWriteUpdateData({
    currentStatus: ProspectStatus.IN_PROGRESS,
    status: ProspectStatus.RESPONDED,
    notes: 'Customer replied',
    nextActionAt
  });

  assert.deepEqual(update, {
    status: ProspectStatus.RESPONDED,
    notes: 'Customer replied',
    nextActionAt: null
  });
});

test('workflow save clears stale nextActionAt when an existing terminal prospect is edited', () => {
  const update = buildProspectWriteUpdateData({
    currentStatus: ProspectStatus.ARCHIVED,
    notes: 'Archived prospect updated'
  });

  assert.deepEqual(update, {
    notes: 'Archived prospect updated',
    nextActionAt: null
  });
});
