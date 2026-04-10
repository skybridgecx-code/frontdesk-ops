import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fastify from 'fastify';
import formbody from '@fastify/formbody';
import twilioVoice from '../twilio-voice.js';

const {
  tenantFindUniqueMock,
  phoneNumberFindFirstMock,
  callUpsertMock,
  callFindFirstMock,
  callUpdateMock,
  handleMissedCallMock,
  validateTwilioRequestMock
} = vi.hoisted(() => ({
  tenantFindUniqueMock: vi.fn(),
  phoneNumberFindFirstMock: vi.fn(),
  callUpsertMock: vi.fn(),
  callFindFirstMock: vi.fn(),
  callUpdateMock: vi.fn(),
  handleMissedCallMock: vi.fn(),
  validateTwilioRequestMock: vi.fn()
}));

vi.mock('../../lib/twilio-auth.js', () => {
  return {
    validateTwilioRequest: validateTwilioRequestMock
  };
});

vi.mock('../../lib/missed-call-handler.js', () => {
  return {
    handleMissedCall: handleMissedCallMock
  };
});

vi.mock('@frontdesk/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@frontdesk/db')>();

  return {
    ...actual,
    prisma: {
      tenant: {
        findUnique: tenantFindUniqueMock
      },
      phoneNumber: {
        findFirst: phoneNumberFindFirstMock
      },
      call: {
        upsert: callUpsertMock,
        findFirst: callFindFirstMock,
        update: callUpdateMock
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
  await app.register(twilioVoice);
  return app;
}

describe('twilio voice routes', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };

    tenantFindUniqueMock.mockReset();
    phoneNumberFindFirstMock.mockReset();
    callUpsertMock.mockReset();
    callFindFirstMock.mockReset();
    callUpdateMock.mockReset();
    handleMissedCallMock.mockReset();
    validateTwilioRequestMock.mockReset();

    validateTwilioRequestMock.mockResolvedValue(undefined);
    callUpsertMock.mockResolvedValue({ id: 'call_1' });
    callUpdateMock.mockResolvedValue({ id: 'call_1' });
    handleMissedCallMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('POST /v1/twilio/voice/incoming with valid To number returns TwiML with greeting', async () => {
    tenantFindUniqueMock.mockResolvedValueOnce({
      id: 'tenant_1',
      name: 'Skybridge',
      businessName: 'Skybridge Plumbing',
      greeting: 'Thanks for calling Skybridge Plumbing!',
      plan: 'pro',
      subscriptionStatus: 'active'
    });
    phoneNumberFindFirstMock.mockResolvedValueOnce({
      id: 'pn_1',
      businessId: 'biz_1'
    });

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/twilio/voice/incoming',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      payload: toFormPayload({
        CallSid: 'CA111',
        From: '+15551234567',
        To: '+15557654321',
        CallStatus: 'in-progress'
      })
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/xml');
    expect(response.body).toContain('Thanks for calling Skybridge Plumbing!');
    expect(response.body).toContain('<Gather');

    await app.close();
  });

  it('POST /v1/twilio/voice/incoming with unknown To number returns error TwiML', async () => {
    tenantFindUniqueMock.mockResolvedValueOnce(null);

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/twilio/voice/incoming',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      payload: toFormPayload({
        CallSid: 'CA222',
        From: '+15551234567',
        To: '+19999999999',
        CallStatus: 'in-progress'
      })
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('something went wrong');
    expect(callUpsertMock).not.toHaveBeenCalled();

    await app.close();
  });

  it('POST /v1/twilio/voice/incoming creates Call record in DB', async () => {
    tenantFindUniqueMock.mockResolvedValueOnce({
      id: 'tenant_1',
      name: 'Skybridge',
      businessName: 'Skybridge Plumbing',
      greeting: null,
      plan: 'starter',
      subscriptionStatus: 'active'
    });
    phoneNumberFindFirstMock.mockResolvedValueOnce({
      id: 'pn_1',
      businessId: 'biz_1'
    });

    const app = await createApp();

    await app.inject({
      method: 'POST',
      url: '/v1/twilio/voice/incoming',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      payload: toFormPayload({
        CallSid: 'CA333',
        From: '+15551230000',
        To: '+15550001111',
        CallStatus: 'in-progress'
      })
    });

    expect(callUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          twilioCallSid: 'CA333'
        },
        create: expect.objectContaining({
          callSid: 'CA333',
          twilioCallSid: 'CA333',
          callerPhone: '+15551230000',
          callStatus: 'in-progress',
          twimlFlowStep: 'greeting'
        })
      })
    );

    await app.close();
  });

  it('POST /v1/twilio/voice/collect-name updates callerName on Call', async () => {
    callFindFirstMock.mockResolvedValueOnce({
      id: 'call_1',
      tenantId: 'tenant_1',
      callerName: null,
      callStatus: 'in-progress',
      twilioCallSid: 'CA444'
    });

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/twilio/voice/collect-name',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      payload: toFormPayload({
        CallSid: 'CA444',
        SpeechResult: 'Jordan'
      })
    });

    expect(response.statusCode).toBe(200);
    expect(callUpdateMock).toHaveBeenCalledWith({
      where: {
        id: 'call_1'
      },
      data: {
        callerName: 'Jordan',
        twimlFlowStep: 'collect-reason'
      }
    });

    await app.close();
  });

  it('POST /v1/twilio/voice/collect-reason updates callReason on Call', async () => {
    callFindFirstMock.mockResolvedValueOnce({
      id: 'call_1',
      tenantId: 'tenant_1',
      callerName: 'Jordan',
      callStatus: 'in-progress',
      twilioCallSid: 'CA555'
    });
    tenantFindUniqueMock.mockResolvedValueOnce({
      name: 'Skybridge',
      businessName: 'Skybridge Plumbing'
    });

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/twilio/voice/collect-reason',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      payload: toFormPayload({
        CallSid: 'CA555',
        SpeechResult: 'Need AC repair'
      })
    });

    expect(response.statusCode).toBe(200);
    expect(callUpdateMock).toHaveBeenCalledWith({
      where: {
        id: 'call_1'
      },
      data: {
        callReason: 'Need AC repair',
        twimlFlowStep: 'thank-you'
      }
    });

    await app.close();
  });

  it('POST /v1/twilio/voice/voicemail-complete updates voicemailUrl', async () => {
    callFindFirstMock.mockResolvedValueOnce({
      id: 'call_1',
      tenantId: 'tenant_1',
      callerName: 'Jordan',
      callStatus: 'in-progress',
      twilioCallSid: 'CA666'
    });

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/twilio/voice/voicemail-complete',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      payload: toFormPayload({
        CallSid: 'CA666',
        RecordingUrl: 'https://api.twilio.com/recordings/RE123',
        RecordingDuration: '45'
      })
    });

    expect(response.statusCode).toBe(200);
    expect(callUpdateMock).toHaveBeenCalledWith({
      where: {
        id: 'call_1'
      },
      data: {
        voicemailUrl: 'https://api.twilio.com/recordings/RE123',
        voicemailDuration: 45,
        status: 'COMPLETED',
        callStatus: 'voicemail',
        twimlFlowStep: 'complete',
        completedAt: expect.any(Date)
      }
    });

    await app.close();
  });

  it('POST /v1/twilio/voice/status-callback with completed updates callStatus', async () => {
    callFindFirstMock.mockResolvedValueOnce({
      id: 'call_1',
      tenantId: 'tenant_1',
      callerName: 'Jordan',
      callStatus: 'in-progress',
      twilioCallSid: 'CA777'
    });

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/twilio/voice/status-callback',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      payload: toFormPayload({
        CallSid: 'CA777',
        CallStatus: 'completed'
      })
    });

    expect(response.statusCode).toBe(200);
    expect(callUpdateMock).toHaveBeenCalledWith({
      where: {
        id: 'call_1'
      },
      data: {
        status: 'COMPLETED',
        callStatus: 'completed',
        completedAt: expect.any(Date)
      }
    });
    expect(handleMissedCallMock).not.toHaveBeenCalled();

    await app.close();
  });

  it('POST /v1/twilio/voice/status-callback with no-answer sets callStatus to missed', async () => {
    callFindFirstMock.mockResolvedValueOnce({
      id: 'call_1',
      tenantId: 'tenant_1',
      callerName: 'Jordan',
      callStatus: 'in-progress',
      twilioCallSid: 'CA888'
    });

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/twilio/voice/status-callback',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      payload: toFormPayload({
        CallSid: 'CA888',
        CallStatus: 'no-answer'
      })
    });

    expect(response.statusCode).toBe(200);
    expect(callUpdateMock).toHaveBeenCalledWith({
      where: {
        id: 'call_1'
      },
      data: {
        status: 'NO_ANSWER',
        callStatus: 'missed',
        completedAt: expect.any(Date)
      }
    });
    expect(handleMissedCallMock).toHaveBeenCalledWith('CA888');

    await app.close();
  });
});
