import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fastify from 'fastify';
import formbody from '@fastify/formbody';
import { CallStatus } from '@frontdesk/db';
import { registerVoiceStatusWebhookRoutes } from '../voice-status-webhooks.js';

const {
  callFindFirstMock,
  callCreateMock,
  callUpdateMock,
  callEventCountMock,
  callEventCreateMock,
  phoneNumberFindUniqueMock,
  requireTwilioSignatureMock,
  handleMissedCallMock
} = vi.hoisted(() => ({
  callFindFirstMock: vi.fn(),
  callCreateMock: vi.fn(),
  callUpdateMock: vi.fn(),
  callEventCountMock: vi.fn(),
  callEventCreateMock: vi.fn(),
  phoneNumberFindUniqueMock: vi.fn(),
  requireTwilioSignatureMock: vi.fn(),
  handleMissedCallMock: vi.fn()
}));

vi.mock('../../lib/twilio-validation.js', () => ({
  requireTwilioSignature: requireTwilioSignatureMock
}));

vi.mock('../../lib/missed-call-handler.js', () => ({
  handleMissedCall: handleMissedCallMock
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
      },
      phoneNumber: {
        findUnique: phoneNumberFindUniqueMock
      }
    }
  };
});

function toFormPayload(payload: Record<string, string>) {
  return new URLSearchParams(payload).toString();
}

async function createApp() {
  const app = fastify({ logger: false });
  await app.register(formbody);
  await registerVoiceStatusWebhookRoutes(app);
  return app;
}

describe('voice-status-webhooks', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };

    callFindFirstMock.mockReset();
    callCreateMock.mockReset();
    callUpdateMock.mockReset();
    callEventCountMock.mockReset();
    callEventCreateMock.mockReset();
    phoneNumberFindUniqueMock.mockReset();
    requireTwilioSignatureMock.mockReset();
    handleMissedCallMock.mockReset();

    requireTwilioSignatureMock.mockReturnValue({ valid: true });
    callUpdateMock.mockResolvedValue({ id: 'call_1' });
    callEventCountMock.mockResolvedValue(0);
    callEventCreateMock.mockResolvedValue({ id: 'evt_1' });
    handleMissedCallMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('updates call in normal lookup path', async () => {
    callFindFirstMock.mockResolvedValueOnce({
      id: 'call_1',
      twilioCallSid: 'CA111',
      answeredAt: null,
      endedAt: null
    });

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/twilio/voice/status',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: toFormPayload({
        CallSid: 'CA111',
        CallStatus: 'completed',
        CallDuration: '12'
      })
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      callId: 'call_1',
      status: 'COMPLETED',
      correlationSource: 'sid'
    });
    expect(callUpdateMock).toHaveBeenCalledWith({
      where: { id: 'call_1' },
      data: expect.objectContaining({
        status: CallStatus.COMPLETED,
        durationSeconds: 12,
        endedAt: expect.any(Date)
      })
    });
    expect(callEventCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        callId: 'call_1',
        type: 'twilio.status.completed',
        sequence: 1
      })
    });
    expect(handleMissedCallMock).toHaveBeenCalledWith('CA111');
    expect(phoneNumberFindUniqueMock).not.toHaveBeenCalled();

    await app.close();
  });

  it('recovers by creating call from callback payload when sid lookup is initially missing', async () => {
    callFindFirstMock.mockResolvedValue(null);
    phoneNumberFindUniqueMock.mockResolvedValue({
      id: 'pn_1',
      tenantId: 'tenant_1',
      businessId: 'business_1',
      isActive: true
    });
    callCreateMock.mockResolvedValue({
      id: 'call_recovered',
      twilioCallSid: 'CA222',
      answeredAt: null,
      endedAt: null
    });
    callUpdateMock.mockResolvedValue({ id: 'call_recovered' });

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/twilio/voice/status',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: toFormPayload({
        CallSid: 'CA222',
        CallStatus: 'no-answer',
        From: '+15551234567',
        To: '+12029359687'
      })
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      callId: 'call_recovered',
      status: 'NO_ANSWER',
      correlationSource: 'recovered-from-status-payload'
    });
    expect(callCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant_1',
        businessId: 'business_1',
        phoneNumberId: 'pn_1',
        twilioCallSid: 'CA222',
        callSid: 'CA222',
        status: CallStatus.NO_ANSWER,
        fromE164: '+15551234567',
        toE164: '+12029359687'
      }),
      select: {
        id: true,
        twilioCallSid: true,
        answeredAt: true,
        endedAt: true
      }
    });
    expect(callUpdateMock).toHaveBeenCalledWith({
      where: { id: 'call_recovered' },
      data: expect.objectContaining({
        status: CallStatus.NO_ANSWER,
        endedAt: expect.any(Date)
      })
    });
    expect(handleMissedCallMock).toHaveBeenCalledWith('CA222');

    await app.close();
  });

  it('returns retry-safe 200 with correlated=false when still unresolved', async () => {
    callFindFirstMock.mockResolvedValue(null);
    phoneNumberFindUniqueMock.mockResolvedValue(null);

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/twilio/voice/status',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: toFormPayload({
        CallSid: 'CA333',
        CallStatus: 'completed',
        To: '+19999999999'
      })
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      correlated: false,
      status: 'COMPLETED'
    });
    expect(callCreateMock).not.toHaveBeenCalled();
    expect(callUpdateMock).not.toHaveBeenCalled();
    expect(callEventCreateMock).not.toHaveBeenCalled();
    expect(handleMissedCallMock).not.toHaveBeenCalled();

    await app.close();
  });
});
