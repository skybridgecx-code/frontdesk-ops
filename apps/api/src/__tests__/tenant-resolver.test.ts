import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fastify from 'fastify';
import { prisma } from '@frontdesk/db';
import { resolveTenant } from '../lib/tenant-resolver.js';

const queryRawMock = vi.fn<(...args: unknown[]) => Promise<unknown[]>>();

function shouldSkipTenantResolver(url: string) {
  const pathname = url.split('?')[0] ?? url;

  return (
    pathname === '/health' ||
    pathname === '/v1/ping' ||
    pathname.startsWith('/v1/twilio/') ||
    pathname.startsWith('/v1/stripe/') ||
    pathname.startsWith('/v1/clerk/')
  );
}

async function createApp() {
  const app = fastify({ logger: false });

  app.addHook('onRequest', async (request) => {
    if (!shouldSkipTenantResolver(request.url)) {
      request.clerkUserId = 'user_123';
    }
  });

  app.addHook('preHandler', async (request, reply) => {
    if (shouldSkipTenantResolver(request.url)) {
      return;
    }

    const ok = await resolveTenant(request, reply);
    if (!ok) {
      return reply;
    }
  });

  app.get('/v1/private', async (request) => ({
    ok: true,
    tenantId: request.tenantId ?? null,
    tenantRole: request.tenantRole ?? null
  }));

  app.get('/health', async () => ({ ok: true }));
  app.get('/v1/ping', async () => ({ pong: true }));
  app.post('/v1/twilio/voice/inbound/mock', async () => ({ ok: true }));
  app.post('/v1/clerk/webhooks', async () => ({ ok: true }));

  return app;
}

describe('tenant resolver middleware', () => {
  let originalQueryRaw: typeof prisma.$queryRaw;

  beforeEach(() => {
    queryRawMock.mockReset();

    originalQueryRaw = prisma.$queryRaw;
    Object.defineProperty(prisma, '$queryRaw', {
      configurable: true,
      value: ((...args: unknown[]) => queryRawMock(...args)) as unknown as typeof prisma.$queryRaw
    });
  });

  afterEach(() => {
    Object.defineProperty(prisma, '$queryRaw', {
      configurable: true,
      value: originalQueryRaw
    });
  });

  it('attaches tenantId and tenantRole when TenantUser exists', async () => {
    queryRawMock.mockResolvedValue([
      {
        tenantId: 'tenant_1',
        role: 'owner'
      }
    ]);

    const app = await createApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/private'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      tenantId: 'tenant_1',
      tenantRole: 'owner'
    });

    await app.close();
  });

  it('returns 403 when no TenantUser record exists', async () => {
    queryRawMock.mockResolvedValue([]);

    const app = await createApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/private'
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: 'No tenant associated with this account. Contact support.'
    });

    await app.close();
  });

  it('twilio routes skip tenant resolution', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/twilio/voice/inbound/mock'
    });

    expect(response.statusCode).toBe(200);
    expect(queryRawMock).not.toHaveBeenCalled();

    await app.close();
  });

  it('clerk webhook routes skip tenant resolution', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/clerk/webhooks'
    });

    expect(response.statusCode).toBe(200);
    expect(queryRawMock).not.toHaveBeenCalled();

    await app.close();
  });

  it('health and ping routes skip tenant resolution', async () => {
    const app = await createApp();

    const health = await app.inject({ method: 'GET', url: '/health' });
    const ping = await app.inject({ method: 'GET', url: '/v1/ping' });

    expect(health.statusCode).toBe(200);
    expect(ping.statusCode).toBe(200);
    expect(queryRawMock).not.toHaveBeenCalled();

    await app.close();
  });
});
