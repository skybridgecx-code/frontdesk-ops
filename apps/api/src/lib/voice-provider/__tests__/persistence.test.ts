import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CallStatus } from '@frontdesk/db';
import {
  applyNormalizedStatusUpdateToCall,
  persistNormalizedEvidenceEvent,
  persistNormalizedStatusEvent,
  persistNormalizedTranscriptArtifact
} from '../persistence.js';

const {
  callUpdateMock,
  callEventCountMock,
  callEventCreateMock
} = vi.hoisted(() => ({
  callUpdateMock: vi.fn(),
  callEventCountMock: vi.fn(),
  callEventCreateMock: vi.fn()
}));

vi.mock('@frontdesk/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@frontdesk/db')>();

  return {
    ...actual,
    prisma: {
      call: {
        update: callUpdateMock
      },
      callEvent: {
        count: callEventCountMock,
        create: callEventCreateMock
      }
    }
  };
});

describe('voice-provider persistence service', () => {
  beforeEach(() => {
    callUpdateMock.mockReset();
    callEventCountMock.mockReset();
    callEventCreateMock.mockReset();

    callUpdateMock.mockResolvedValue({ id: 'call_1' });
    callEventCountMock.mockResolvedValue(0);
    callEventCreateMock.mockResolvedValue({ id: 'evt_1' });
  });

  it('applies normalized in-progress status with answeredAt semantics', async () => {
    await applyNormalizedStatusUpdateToCall({
      call: {
        id: 'call_1',
        answeredAt: null,
        endedAt: null
      },
      statusUpdate: {
        provider: 'twilio',
        providerCallId: 'CA111',
        status: 'in_progress'
      }
    });

    expect(callUpdateMock).toHaveBeenCalledWith({
      where: { id: 'call_1' },
      data: expect.objectContaining({
        status: CallStatus.IN_PROGRESS,
        answeredAt: expect.any(Date)
      })
    });
  });

  it('applies normalized terminal status with endedAt and duration semantics', async () => {
    await applyNormalizedStatusUpdateToCall({
      call: {
        id: 'call_1',
        answeredAt: null,
        endedAt: null
      },
      statusUpdate: {
        provider: 'twilio',
        providerCallId: 'CA222',
        status: 'completed',
        durationSeconds: 19
      }
    });

    expect(callUpdateMock).toHaveBeenCalledWith({
      where: { id: 'call_1' },
      data: expect.objectContaining({
        status: CallStatus.COMPLETED,
        durationSeconds: 19,
        endedAt: expect.any(Date)
      })
    });
  });

  it('uses explicit endedAt from normalized status when provided', async () => {
    await applyNormalizedStatusUpdateToCall({
      call: {
        id: 'call_1',
        answeredAt: null,
        endedAt: null
      },
      statusUpdate: {
        provider: 'retell',
        providerCallId: 'call_retell_1',
        status: 'busy',
        endedAt: '2026-01-02T03:04:05.000Z'
      }
    });

    expect(callUpdateMock).toHaveBeenCalledWith({
      where: { id: 'call_1' },
      data: expect.objectContaining({
        status: CallStatus.BUSY,
        endedAt: new Date('2026-01-02T03:04:05.000Z')
      })
    });
  });

  it('persists normalized evidence event as current UI-compatible event type', async () => {
    await persistNormalizedEvidenceEvent({
      callId: 'call_1',
      event: {
        provider: 'twilio',
        providerCallId: 'CA333',
        type: 'inbound_fallback',
        reason: 'realtime_health_unreachable'
      }
    });

    expect(callEventCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        callId: 'call_1',
        type: 'twilio.inbound.fallback',
        sequence: 1,
        payloadJson: expect.objectContaining({
          type: 'inbound_fallback',
          reason: 'realtime_health_unreachable'
        })
      })
    });
  });

  it('persists normalized status lifecycle event as legacy-compatible status evidence type', async () => {
    await persistNormalizedStatusEvent({
      callId: 'call_1',
      statusUpdate: {
        provider: 'retell',
        providerCallId: 'call_retell_1',
        status: 'completed'
      }
    });

    expect(callEventCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        callId: 'call_1',
        type: 'twilio.status.completed',
        sequence: 1,
        payloadJson: expect.objectContaining({
          provider: 'retell',
          status: 'completed'
        })
      })
    });
  });

  it('accepts transcript/summary artifact shape for future persistence', async () => {
    await persistNormalizedTranscriptArtifact({
      callId: 'call_1',
      artifact: {
        provider: 'retell',
        providerCallId: 'call_retell_2',
        transcript: 'Caller asked for HVAC repair.',
        summary: 'Needs same-day HVAC service'
      }
    });

    expect(callUpdateMock).toHaveBeenCalledWith({
      where: { id: 'call_1' },
      data: {
        summary: 'Needs same-day HVAC service',
        callerTranscript: 'Caller asked for HVAC repair.'
      }
    });
  });

  it('does not write when transcript artifact has no writable fields', async () => {
    const result = await persistNormalizedTranscriptArtifact({
      callId: 'call_1',
      artifact: {
        provider: 'retell',
        providerCallId: 'call_retell_3'
      }
    });

    expect(result).toEqual({ updated: false });
    expect(callUpdateMock).not.toHaveBeenCalled();
  });
});
