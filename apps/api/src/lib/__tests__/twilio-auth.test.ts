import type { FastifyReply, FastifyRequest } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateTwilioRequest } from '../twilio-auth.js';

const { validateRequestMock } = vi.hoisted(() => ({
  validateRequestMock: vi.fn()
}));

vi.mock('twilio', () => {
  return {
    validateRequest: validateRequestMock
  };
});

function createReply() {
  const reply = {
    code: vi.fn().mockReturnThis(),
    send: vi.fn()
  };

  return reply as unknown as FastifyReply;
}

describe('validateTwilioRequest', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    validateRequestMock.mockReset();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('skips validation and warns when TWILIO_AUTH_TOKEN not set', async () => {
    delete process.env.TWILIO_AUTH_TOKEN;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const request = {
      headers: {
        'x-twilio-signature': 'sig_test'
      },
      url: '/v1/twilio/voice/incoming',
      body: {
        CallSid: 'CA123'
      }
    } as unknown as FastifyRequest;
    const reply = createReply();

    await validateTwilioRequest(request, reply);

    expect(warnSpy).toHaveBeenCalledWith(
      '[twilio-auth] TWILIO_AUTH_TOKEN not set — skipping request validation'
    );
    expect(validateRequestMock).not.toHaveBeenCalled();
    expect((reply.code as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it('returns 403 when signature is invalid', async () => {
    process.env.TWILIO_AUTH_TOKEN = 'twilio_auth_token';
    validateRequestMock.mockReturnValue(false);

    const request = {
      headers: {
        'x-twilio-signature': 'sig_invalid'
      },
      url: '/v1/twilio/voice/incoming',
      body: {
        CallSid: 'CA123',
        From: '+15551234567',
        To: '+15557654321'
      }
    } as unknown as FastifyRequest;
    const reply = createReply();

    await validateTwilioRequest(request, reply);

    expect(validateRequestMock).toHaveBeenCalledWith(
      'twilio_auth_token',
      'sig_invalid',
      'https://frontdesk-ops.onrender.com/v1/twilio/voice/incoming',
      {
        CallSid: 'CA123',
        From: '+15551234567',
        To: '+15557654321'
      }
    );
    expect((reply.code as unknown as ReturnType<typeof vi.fn>).mock.calls[0]).toEqual([403]);
    expect((reply.send as unknown as ReturnType<typeof vi.fn>).mock.calls[0]).toEqual([
      { error: 'Invalid Twilio signature' }
    ]);
  });

  it('passes when signature is valid', async () => {
    process.env.TWILIO_AUTH_TOKEN = 'twilio_auth_token';
    validateRequestMock.mockReturnValue(true);

    const request = {
      headers: {
        'x-twilio-signature': 'sig_valid'
      },
      url: '/v1/twilio/voice/status-callback',
      body: {
        CallSid: 'CA999'
      }
    } as unknown as FastifyRequest;
    const reply = createReply();

    await validateTwilioRequest(request, reply);

    expect((reply.code as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
    expect((reply.send as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });
});
