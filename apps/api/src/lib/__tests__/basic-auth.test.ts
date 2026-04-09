import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { shouldSkipBasicAuth, enforceBasicAuth } from '../basic-auth.js';

function encode(user: string, pass: string): string {
  return Buffer.from(`${user}:${pass}`).toString('base64');
}

function makeFastifyRequest(headers: Record<string, string | undefined> = {}) {
  return { headers } as any;
}

function makeFastifyReply() {
  const reply: any = {
    statusCode: 200,
    sentBody: null,
    sentHeaders: {} as Record<string, string>,
    code(n: number) { reply.statusCode = n; return reply; },
    header(k: string, v: string) { reply.sentHeaders[k] = v; return reply; },
    send(body: unknown) { reply.sentBody = body; return reply; }
  };
  return reply;
}

describe('shouldSkipBasicAuth', () => {
  it('skips /health', () => {
    expect(shouldSkipBasicAuth('/health')).toBe(true);
  });

  it('skips /v1/ping', () => {
    expect(shouldSkipBasicAuth('/v1/ping')).toBe(true);
  });

  it('skips twilio voice inbound', () => {
    expect(shouldSkipBasicAuth('/v1/twilio/voice/inbound')).toBe(true);
    expect(shouldSkipBasicAuth('/v1/twilio/voice/inbound/123')).toBe(true);
  });

  it('skips twilio voice status', () => {
    expect(shouldSkipBasicAuth('/v1/twilio/voice/status')).toBe(true);
    expect(shouldSkipBasicAuth('/v1/twilio/voice/status/abc')).toBe(true);
  });

  it('does not skip other routes', () => {
    expect(shouldSkipBasicAuth('/v1/calls')).toBe(false);
    expect(shouldSkipBasicAuth('/v1/prospects')).toBe(false);
    expect(shouldSkipBasicAuth('/')).toBe(false);
  });
});

describe('enforceBasicAuth', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.FRONTDESK_REQUIRE_BASIC_AUTH = 'true';
    process.env.FRONTDESK_BASIC_AUTH_USER = 'admin';
    process.env.FRONTDESK_BASIC_AUTH_PASS = 'secret123';
    delete process.env.FRONTDESK_INTERNAL_API_SECRET;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns true when auth is not required', () => {
    process.env.FRONTDESK_REQUIRE_BASIC_AUTH = 'false';
    const reply = makeFastifyReply();
    expect(enforceBasicAuth(makeFastifyRequest(), reply)).toBe(true);
  });

  it('returns true for valid basic auth credentials', () => {
    const reply = makeFastifyReply();
    const request = makeFastifyRequest({
      authorization: `Basic ${encode('admin', 'secret123')}`
    });
    expect(enforceBasicAuth(request, reply)).toBe(true);
  });

  it('returns false for wrong username', () => {
    const reply = makeFastifyReply();
    const request = makeFastifyRequest({
      authorization: `Basic ${encode('wrong', 'secret123')}`
    });
    expect(enforceBasicAuth(request, reply)).toBe(false);
    expect(reply.statusCode).toBe(401);
  });

  it('returns false for wrong password', () => {
    const reply = makeFastifyReply();
    const request = makeFastifyRequest({
      authorization: `Basic ${encode('admin', 'wrong')}`
    });
    expect(enforceBasicAuth(request, reply)).toBe(false);
    expect(reply.statusCode).toBe(401);
  });

  it('returns false when no authorization header', () => {
    const reply = makeFastifyReply();
    expect(enforceBasicAuth(makeFastifyRequest(), reply)).toBe(false);
    expect(reply.statusCode).toBe(401);
    expect(reply.sentHeaders['WWW-Authenticate']).toBe('Basic realm="Frontdesk Ops"');
  });

  it('returns false for non-Basic auth scheme', () => {
    const reply = makeFastifyReply();
    const request = makeFastifyRequest({ authorization: 'Bearer some-token' });
    expect(enforceBasicAuth(request, reply)).toBe(false);
    expect(reply.statusCode).toBe(401);
  });

  it('allows internal secret header to bypass basic auth', () => {
    process.env.FRONTDESK_INTERNAL_API_SECRET = 'internal-secret-xyz';
    const reply = makeFastifyReply();
    const request = makeFastifyRequest({
      'x-frontdesk-internal-secret': 'internal-secret-xyz'
    });
    expect(enforceBasicAuth(request, reply)).toBe(true);
  });

  it('rejects wrong internal secret header', () => {
    process.env.FRONTDESK_INTERNAL_API_SECRET = 'internal-secret-xyz';
    const reply = makeFastifyReply();
    const request = makeFastifyRequest({
      'x-frontdesk-internal-secret': 'wrong-secret'
    });
    // No basic auth header either, so should fail
    expect(enforceBasicAuth(request, reply)).toBe(false);
    expect(reply.statusCode).toBe(401);
  });

  it('returns 500 when auth is required but credentials are not configured', () => {
    delete process.env.FRONTDESK_BASIC_AUTH_USER;
    delete process.env.FRONTDESK_BASIC_AUTH_PASS;
    const reply = makeFastifyReply();
    expect(enforceBasicAuth(makeFastifyRequest(), reply)).toBe(false);
    expect(reply.statusCode).toBe(500);
  });

  it('handles colons in password', () => {
    process.env.FRONTDESK_BASIC_AUTH_PASS = 'pass:with:colons';
    const reply = makeFastifyReply();
    const request = makeFastifyRequest({
      authorization: `Basic ${encode('admin', 'pass:with:colons')}`
    });
    expect(enforceBasicAuth(request, reply)).toBe(true);
  });
});
