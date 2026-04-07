import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { validateTwilioSignature, requireTwilioSignature } from '../twilio-validation.js';

function sign(authToken: string, url: string, params: Record<string, string | undefined>): string {
  const sortedKeys = Object.keys(params).sort();
  const data =
    url +
    sortedKeys.reduce((acc, key) => acc + key + (params[key] ?? ''), '');
  return createHmac('sha1', authToken).update(data).digest('base64');
}

describe('validateTwilioSignature', () => {
  const authToken = 'test-auth-token-12345';
  const url = 'https://example.com/v1/twilio/voice/inbound';
  const params = { CallSid: 'CA123', From: '+15551234567' };

  it('returns true for a valid signature', () => {
    const signature = sign(authToken, url, params);
    expect(validateTwilioSignature(authToken, signature, url, params)).toBe(true);
  });

  it('returns false for a tampered signature', () => {
    const signature = sign(authToken, url, params);
    const tampered = signature.slice(0, -2) + 'XX';
    expect(validateTwilioSignature(authToken, tampered, url, params)).toBe(false);
  });

  it('returns false for a completely wrong signature', () => {
    expect(validateTwilioSignature(authToken, 'garbage', url, params)).toBe(false);
  });

  it('returns false when signature is empty', () => {
    expect(validateTwilioSignature(authToken, '', url, params)).toBe(false);
  });

  it('returns false when authToken is empty', () => {
    const signature = sign(authToken, url, params);
    expect(validateTwilioSignature('', signature, url, params)).toBe(false);
  });

  it('returns true with empty params', () => {
    const signature = sign(authToken, url, {});
    expect(validateTwilioSignature(authToken, signature, url, {})).toBe(true);
  });

  it('sorts params correctly', () => {
    const unsorted = { Zebra: 'z', Alpha: 'a', Middle: 'm' };
    const signature = sign(authToken, url, unsorted);
    expect(validateTwilioSignature(authToken, signature, url, unsorted)).toBe(true);
  });

  it('handles params with undefined values', () => {
    const withUndef = { CallSid: 'CA123', Empty: undefined };
    const signature = sign(authToken, url, withUndef);
    expect(validateTwilioSignature(authToken, signature, url, withUndef)).toBe(true);
  });
});

describe('requireTwilioSignature', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.TWILIO_AUTH_TOKEN = 'test-token-abc';
    process.env.FRONTDESK_API_PUBLIC_URL = 'https://api.example.com';
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function makeRequest(url: string, signature: string) {
    return {
      headers: { 'x-twilio-signature': signature } as Record<string, string | string[] | undefined>,
      url
    };
  }

  it('returns valid for correct signature', () => {
    const fullUrl = 'https://api.example.com/v1/twilio/voice/inbound';
    const body = { CallSid: 'CA123' };
    const sig = sign('test-token-abc', fullUrl, body);

    const result = requireTwilioSignature(makeRequest('/v1/twilio/voice/inbound', sig), body);
    expect(result).toEqual({ valid: true });
  });

  it('returns invalid for wrong signature', () => {
    const body = { CallSid: 'CA123' };
    const result = requireTwilioSignature(makeRequest('/v1/twilio/voice/inbound', 'bad-sig'), body);
    expect(result).toEqual({ valid: false, error: 'Invalid Twilio signature' });
  });

  it('returns invalid when signature header is missing', () => {
    const request = { headers: {} as Record<string, string | string[] | undefined>, url: '/v1/twilio/voice/inbound' };
    const result = requireTwilioSignature(request, { CallSid: 'CA123' });
    expect(result).toEqual({ valid: false, error: 'Invalid Twilio signature' });
  });

  it('allows in development when TWILIO_AUTH_TOKEN is not set', () => {
    delete process.env.TWILIO_AUTH_TOKEN;
    process.env.NODE_ENV = 'development';
    const result = requireTwilioSignature(makeRequest('/v1/twilio/voice/inbound', ''), {});
    expect(result).toEqual({ valid: true });
  });

  it('rejects in production when TWILIO_AUTH_TOKEN is not set', () => {
    delete process.env.TWILIO_AUTH_TOKEN;
    process.env.NODE_ENV = 'production';
    const result = requireTwilioSignature(makeRequest('/v1/twilio/voice/inbound', ''), {});
    expect(result).toEqual({ valid: false, error: 'TWILIO_AUTH_TOKEN is not configured' });
  });

  it('strips query string from URL before validation', () => {
    const fullUrl = 'https://api.example.com/v1/twilio/voice/inbound';
    const body = { CallSid: 'CA123' };
    const sig = sign('test-token-abc', fullUrl, body);

    const result = requireTwilioSignature(
      makeRequest('/v1/twilio/voice/inbound?foo=bar', sig),
      body
    );
    expect(result).toEqual({ valid: true });
  });

  it('strips trailing slash from public URL', () => {
    process.env.FRONTDESK_API_PUBLIC_URL = 'https://api.example.com/';
    const fullUrl = 'https://api.example.com/v1/twilio/voice/inbound';
    const body = { CallSid: 'CA123' };
    const sig = sign('test-token-abc', fullUrl, body);

    const result = requireTwilioSignature(makeRequest('/v1/twilio/voice/inbound', sig), body);
    expect(result).toEqual({ valid: true });
  });
});
