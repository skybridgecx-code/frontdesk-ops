import { beforeEach, describe, expect, it, vi } from 'vitest';
import fastify from 'fastify';
import { CallStatus } from '@frontdesk/db';
import { registerRetellWebhookRoutes } from '../retell-webhooks.js';

const {
  callFindFirstMock,
  callCreateMock,
  callUpdateMock,
  callEventCountMock,
  callEventCreateMock
} = vi.hoisted(() => ({
  callFindFirstMock: vi.fn(),
  callCreateMock: vi.fn(),
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
        findFirst: callFindFirstMock,
        create: callCreateMock,
        update: callUpdateMock
      },
      callEvent: {
        count: callEventCountMock,
        create: callEventCreateMock
      }
    }
  };
});

async function createApp() {
  const app = fastify({ logger: false });
  await registerRetellWebhookRoutes(app);
  return app;
}

describe('retell-webhooks route', () => {
  beforeEach(() => {
    callFindFirstMock.mockReset();
    callCreateMock.mockReset();
    callUpdateMock.mockReset();
    callEventCountMock.mockReset();
    callEventCreateMock.mockReset();

    callCreateMock.mockResolvedValue({
      id: 'call_created',
      twilioCallSid: 'retell_call_created',
      answeredAt: null,
      endedAt: null
    });
    callUpdateMock.mockResolvedValue({ id: 'call_1' });
    callEventCountMock.mockResolvedValue(0);
    callEventCreateMock.mockResolvedValue({ id: 'evt_1' });
  });

  it('persists normalized Retell status and transcript for an existing call', async () => {
    callFindFirstMock.mockResolvedValue({
      id: 'call_1',
      twilioCallSid: 'retell_call_1',
      answeredAt: null,
      endedAt: null
    });

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/twilio/retell/webhook',
      payload: {
        event: 'call_ended',
        call: {
          id: 'retell_call_1',
          status: 'ended',
          duration_ms: 12000,
          transcript: 'Caller reported no heat.',
          call_summary: 'No-heat HVAC emergency'
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      provider: 'retell',
      callId: 'call_1',
      providerCallId: 'retell_call_1',
      correlationSource: 'sid',
      applied: {
        status: true,
        transcript: true
      }
    });

    expect(callUpdateMock).toHaveBeenCalledWith({
      where: { id: 'call_1' },
      data: expect.objectContaining({
        status: CallStatus.COMPLETED,
        durationSeconds: 12,
        endedAt: expect.any(Date)
      })
    });
    expect(callUpdateMock).toHaveBeenCalledWith({
      where: { id: 'call_1' },
      data: {
        summary: 'No-heat HVAC emergency',
        callerTranscript: 'Caller reported no heat.'
      }
    });
    expect(callEventCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        callId: 'call_1',
        type: 'twilio.status.completed',
        sequence: 1
      })
    });

    await app.close();
  });

  it('creates a call from Retell status metadata when no existing call is found', async () => {
    callFindFirstMock.mockResolvedValueOnce(null);

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/twilio/retell/webhook',
      payload: {
        event_type: 'call_started',
        call: {
          call_id: 'retell_call_created',
          status: 'in_progress',
          metadata: {
            tenantId: 'tenant_1',
            businessId: 'business_1',
            phoneNumberId: 'pn_1'
          }
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      provider: 'retell',
      callId: 'call_created',
      providerCallId: 'retell_call_created',
      correlationSource: 'created-from-status-payload',
      applied: {
        status: true,
        transcript: false
      }
    });
    expect(callCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant_1',
        businessId: 'business_1',
        phoneNumberId: 'pn_1',
        twilioCallSid: 'retell_call_created',
        callSid: 'retell_call_created',
        status: CallStatus.IN_PROGRESS
      }),
      select: {
        id: true,
        twilioCallSid: true,
        answeredAt: true,
        endedAt: true
      }
    });

    await app.close();
  });
});
