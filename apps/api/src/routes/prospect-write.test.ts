import { describe, it, expect } from 'vitest';
import { ProspectPriority, ProspectStatus } from '@frontdesk/db';
import { buildProspectWriteUpdateData } from './prospect-write';

describe('buildProspectWriteUpdateData', () => {
  it('preserves non-terminal next actions and explicit fields', () => {
    const nextActionAt = new Date('2026-04-06T13:30:00.000Z');

    const update = buildProspectWriteUpdateData({
      currentStatus: ProspectStatus.NEW,
      status: ProspectStatus.READY,
      priority: ProspectPriority.HIGH,
      notes: 'Call after lunch',
      nextActionAt,
    });

    expect(update).toEqual({
      status: ProspectStatus.READY,
      priority: ProspectPriority.HIGH,
      notes: 'Call after lunch',
      nextActionAt,
    });
  });

  it('clears nextActionAt for terminal states', () => {
    const nextActionAt = new Date('2026-04-06T13:30:00.000Z');

    const update = buildProspectWriteUpdateData({
      currentStatus: ProspectStatus.IN_PROGRESS,
      status: ProspectStatus.RESPONDED,
      notes: 'Customer replied',
      nextActionAt,
    });

    expect(update).toEqual({
      status: ProspectStatus.RESPONDED,
      notes: 'Customer replied',
      nextActionAt: null,
    });
  });

  it('clears stale nextActionAt when an existing terminal prospect is edited', () => {
    const update = buildProspectWriteUpdateData({
      currentStatus: ProspectStatus.ARCHIVED,
      notes: 'Archived prospect updated',
    });

    expect(update).toEqual({
      notes: 'Archived prospect updated',
      nextActionAt: null,
    });
  });
});
