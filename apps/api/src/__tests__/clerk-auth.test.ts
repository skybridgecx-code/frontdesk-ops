import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fastify from 'fastify';
import { enforceBasicAuth } from '../lib/basic-auth.js';
import { enforceClerkAuth, shouldSkipDashboardAuth } from '../lib/clerk-auth.js';

const { verifyTokenMock } = vi.hoisted(() => ({
  verifyTokenMock: vi.fn()
}));

vi.mock('@clerk/backend', () => {
  return {
    verifyToken: verifyTokenMock
  };
});

function encodeBasic(user: string, pass: string) {
  return Buffer.from(`${user}:${pass}`).toString('base64');
}

async function createAuthTestApp() {
  const app = fastify({ logger: false });

  app.addHook('onRequest', async (request, reply) => {
    if (shouldSkipDashboardAuth(request.url)) {
      return;
    }

    if (process.env.CLERK_SECRET_KEY) {
      const ok = await enforceClerkAuth(request, reply);
      if (!ok) {
        return reply;
      }
      return;
    }

    const ok = enforceBasicAuth(request, reply);
    if (!ok) {
      return reply;
    }
  });

  app.get('/v1/private', async (request) => {
    return {
      ok: true,
      clerkUserId: request.clerkUserId ?? null,
      clerkOrgId: request.clerkOrgId ?? null
    };
  });

  app.get('/health', async () => ({ ok: true }));
  app.get('/v1/ping', async () => ({ pong: true }));
  app.post('/v1/twilio/voice/inbound/mock', async () => ({ ok: true }));
  app.post('/v1/stripe/webhooks', async () => ({ ok: true }));

  return app;
}

describe('clerk auth integration hook', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    verifyTokenMock.mockReset();
    process.env = { ...originalEnv };
    process.env.FRONTDESK_REQUIRE_BASIC_AUTH = 'true';
    process.env.FRONTDESK_BASIC_AUTH_USER = 'operator';
    process.env.FRONTDESK_BASIC_AUTH_PASS = 'secret';
    delete process.env.FRONTDESK_INTERNAL_API_SECRET;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('valid Clerk token passes and attaches clerkUserId', async () => {
    process.env.CLERK_SECRET_KEY = 'sk_test_123';
    verifyTokenMock.mockResolvedValue({
      sub: 'user_123',
      org_id: 'org_123'
    });

    const app = await createAuthTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/private',
      headers: {
        authorization: 'Bearer token_123'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      clerkUserId: 'user_123',
      clerkOrgId: 'org_123'
    });

    await app.close();
  });

  it('missing Authorization header returns 401', async () => {
    process.env.CLERK_SECRET_KEY = 'sk_test_123';

    const app = await createAuthTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/private'
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'Unauthorized' });

    await app.close();
  });

  it('invalid token returns 401', async () => {
    process.env.CLERK_SECRET_KEY = 'sk_test_123';
    verifyTokenMock.mockRejectedValue(new Error('invalid token'));

    const app = await createAuthTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/private',
      headers: {
        authorization: 'Bearer bad_token'
      }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'Unauthorized' });

    await app.close();
  });

  it('twilio webhook routes skip Clerk auth entirely', async () => {
    process.env.CLERK_SECRET_KEY = 'sk_test_123';

    const app = await createAuthTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/twilio/voice/inbound/mock'
    });

    expect(response.statusCode).toBe(200);
    expect(verifyTokenMock).not.toHaveBeenCalled();

    await app.close();
  });

  it('health and ping routes skip Clerk auth entirely', async () => {
    process.env.CLERK_SECRET_KEY = 'sk_test_123';

    const app = await createAuthTestApp();

    const healthResponse = await app.inject({
      method: 'GET',
      url: '/health'
    });
    const pingResponse = await app.inject({
      method: 'GET',
      url: '/v1/ping'
    });

    expect(healthResponse.statusCode).toBe(200);
    expect(pingResponse.statusCode).toBe(200);
    expect(verifyTokenMock).not.toHaveBeenCalled();

    await app.close();
  });

  it('stripe webhook routes skip Clerk auth entirely', async () => {
    process.env.CLERK_SECRET_KEY = 'sk_test_123';

    const app = await createAuthTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/stripe/webhooks'
    });

    expect(response.statusCode).toBe(200);
    expect(verifyTokenMock).not.toHaveBeenCalled();

    await app.close();
  });

  it('falls back to Basic Auth when CLERK_SECRET_KEY is not set', async () => {
    delete process.env.CLERK_SECRET_KEY;

    const app = await createAuthTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/private',
      headers: {
        authorization: `Basic ${encodeBasic('operator', 'secret')}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      clerkUserId: null,
      clerkOrgId: null
    });

    await app.close();
  });
});
