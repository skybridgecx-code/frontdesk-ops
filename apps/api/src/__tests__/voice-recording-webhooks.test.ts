import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fastify from 'fastify';
import { enforceClerkAuth, shouldSkipDashboardAuth } from '../lib/clerk-auth.js';
import { registerVoiceRecordingWebhookRoutes } from '../routes/voice-recording-webhooks.js';

const {
  callFindUniqueMock,
  callUpdateMock,
  requireTwilioSignatureMock,
  verifyTokenMock
} = vi.hoisted(() => ({
  callFindUniqueMock: vi.fn(),
  callUpdateMock: vi.fn(),
  requireTwilioSignatureMock: vi.fn(),
  verifyTokenMock: vi.fn()
}));

vi.mock('../lib/twilio-validation.js', () => {
  return {
    requireTwilioSignature: requireTwilioSignatureMock
  };
});

vi.mock('@clerk/backend', () => {
  return {
    verifyToken: verifyTokenMock
  };
});

vi.mock('@frontdesk/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@frontdesk/db')>();

  return {
    ...actual,
    prisma: {
      call: {
        findUnique: callFindUniqueMock,
        update: callUpdateMock
      }
    }
  };
});

async function createApp(options?: { withClerkHook?: boolean }) {
  const app = fastify({ logger: false });

  if (options?.withClerkHook) {
    app.addHook('onRequest', async (request, reply) => {
      if (shouldSkipDashboardAuth(request.url)) {
        return;
      }

      const ok = await enforceClerkAuth(request, reply);
      if (!ok) {
        return reply;
      }
    });
  }

  await app.register(registerVoiceRecordingWebhookRoutes);
  return app;
}

describe('voice recording webhook route', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.FRONTDESK_API_PUBLIC_URL = 'https://api.example.com';

    callFindUniqueMock.mockReset();
    callUpdateMock.mockReset();
    requireTwilioSignatureMock.mockReset();
    verifyTokenMock.mockReset();

    requireTwilioSignatureMock.mockReturnValue({ valid: true });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('completed recording updates call with all recording fields', async () => {
    callFindUniqueMock.mockResolvedValue({ id: 'call_1' });
    callUpdateMock.mockResolvedValue({ id: 'call_1' });

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/twilio/voice/recording-status',
      payload: {
        CallSid: 'CA123',
        RecordingSid: 'RE456',
        RecordingUrl: 'https://api.twilio.com/recordings/RE456',
        RecordingDuration: '154',
        RecordingStatus: 'completed'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(callFindUniqueMock).toHaveBeenCalledWith({
      where: { twilioCallSid: 'CA123' },
      select: { id: true }
    });
    expect(callUpdateMock).toHaveBeenCalledWith({
      where: { id: 'call_1' },
      data: {
        recordingUrl: 'https://api.twilio.com/recordings/RE456.mp3',
        recordingSid: 'RE456',
        recordingDuration: 154,
        recordingStatus: 'completed'
      }
    });

    await app.close();
  });

  it('absent recording updates status to absent', async () => {
    callFindUniqueMock.mockResolvedValue({ id: 'call_2' });
    callUpdateMock.mockResolvedValue({ id: 'call_2' });

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/twilio/voice/recording-status',
      payload: {
        CallSid: 'CA_absent',
        RecordingSid: 'RE_absent',
        RecordingStatus: 'absent'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(callUpdateMock).toHaveBeenCalledWith({
      where: { id: 'call_2' },
      data: {
        recordingUrl: null,
        recordingSid: 'RE_absent',
        recordingDuration: null,
        recordingStatus: 'absent'
      }
    });

    await app.close();
  });

  it('failed recording updates status to failed', async () => {
    callFindUniqueMock.mockResolvedValue({ id: 'call_3' });
    callUpdateMock.mockResolvedValue({ id: 'call_3' });

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/twilio/voice/recording-status',
      payload: {
        CallSid: 'CA_failed',
        RecordingStatus: 'failed'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(callUpdateMock).toHaveBeenCalledWith({
      where: { id: 'call_3' },
      data: {
        recordingUrl: null,
        recordingSid: null,
        recordingDuration: null,
        recordingStatus: 'failed'
      }
    });

    await app.close();
  });

  it('unknown CallSid returns 200 without crashing', async () => {
    callFindUniqueMock.mockResolvedValue(null);

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/twilio/voice/recording-status',
      payload: {
        CallSid: 'CA_unknown',
        RecordingStatus: 'completed'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(callUpdateMock).not.toHaveBeenCalled();

    await app.close();
  });

  it('invalid Twilio signature returns 403', async () => {
    requireTwilioSignatureMock.mockReturnValue({ valid: false, error: 'Invalid Twilio signature' });

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/twilio/voice/recording-status',
      payload: {
        CallSid: 'CA123'
      }
    });

    expect(response.statusCode).toBe(403);
    expect(callFindUniqueMock).not.toHaveBeenCalled();
    expect(callUpdateMock).not.toHaveBeenCalled();

    await app.close();
  });

  it('route skips Clerk auth', async () => {
    process.env.CLERK_SECRET_KEY = 'sk_test_123';
    callFindUniqueMock.mockResolvedValue(null);

    const app = await createApp({ withClerkHook: true });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/twilio/voice/recording-status',
      payload: {
        CallSid: 'CA_no_clerk'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(verifyTokenMock).not.toHaveBeenCalled();

    await app.close();
  });
});
