import { describe, it, expect } from 'vitest';
import { ProspectStatus } from '@frontdesk/db';
import { buildProspectAttemptUpdateData } from './prospect-attempts-write';

describe('buildProspectAttemptUpdateData', () => {
  it('promotes non-terminal prospects and stamps the attempt time', () => {
    const attemptedAt = new Date('2026-04-06T13:30:00.000Z');

    const update = buildProspectAttemptUpdateData({
      currentStatus: ProspectStatus.READY,
      attemptedAt,
    });

    expect(update).toEqual({
      lastAttemptAt: attemptedAt,
      status: ProspectStatus.ATTEMPTED,
    });
  });

  it('preserves terminal prospects while still stamping the attempt time', () => {
    const attemptedAt = new Date('2026-04-06T13:30:00.000Z');

    const update = buildProspectAttemptUpdateData({
      currentStatus: ProspectStatus.QUALIFIED,
      attemptedAt,
    });

    expect(update).toEqual({
      lastAttemptAt: attemptedAt,
      status: ProspectStatus.QUALIFIED,
    });
  });
});
