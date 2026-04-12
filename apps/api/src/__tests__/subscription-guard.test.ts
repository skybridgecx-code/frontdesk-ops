import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fastify from 'fastify';
import { prisma } from '@frontdesk/db';
import { requireActiveSubscription } from '../lib/subscription-guard.js';

const queryRawMock = vi.fn<(...args: unknown[]) => Promise<unknown[]>>();

function shouldSkipSubscriptionGuard(url: string) {
  const pathname = url.split('?')[0] ?? url;

  return (
    pathname === '/health' ||
    pathname === '/v1/ping' ||
    pathname.startsWith('/v1/twilio/') ||
    pathname.startsWith('/v1/stripe/') ||
    pathname.startsWith('/v1/clerk/') ||
    pathname.startsWith('/v1/billing/') ||
    pathname.startsWith('/v1/onboarding/')
  );
}

function buildSubscriptionRow(status: string) {
  return {
    id: 'sub_local_1',
    tenantId: 'tenant_1',
    stripeCustomerId: 'cus_1',
    stripeSubscriptionId: 'sub_1',
    stripePriceId: 'price_1',
    status,
    currentPeriodStart: new Date('2026-04-01T00:00:00.000Z'),
    currentPeriodEnd: new Date('2026-05-01T00:00:00.000Z'),
    cancelAtPeriodEnd: false,
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
    updatedAt: new Date('2026-04-01T00:00:00.000Z')
  };
}

function buildTenantTrialRow(input: { trialEndsAt: Date | string | null; createdAt?: Date | string }) {
  return {
    subscriptionStatus: 'trialing',
    trialEndsAt: input.trialEndsAt,
    createdAt: input.createdAt ?? new Date('2026-04-01T00:00:00.000Z')
  };
}

async function createApp() {
  const app = fastify({ logger: false });

  app.addHook('onRequest', async (request) => {
    if (!shouldSkipSubscriptionGuard(request.url)) {
      request.tenantId = 'tenant_1';
    }
  });

  app.addHook('preHandler', async (request, reply) => {
    if (shouldSkipSubscriptionGuard(request.url)) {
      return;
    }

    const ok = await requireActiveSubscription(request, reply);
    if (!ok) {
      return reply;
    }
  });

  app.get('/v1/private', async (request) => ({
    ok: true,
    subscriptionWarning: request.subscriptionWarning ?? null
  }));
  app.get('/v1/billing/status/tenant_1', async () => ({ ok: true }));
  app.get('/v1/onboarding/status', async () => ({ ok: true }));
  app.post('/v1/twilio/voice/inbound/mock', async () => ({ ok: true }));
  app.post('/v1/clerk/webhooks', async () => ({ ok: true }));

  return app;
}

describe('subscription guard middleware', () => {
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

  it('allows active subscriptions', async () => {
    queryRawMock.mockResolvedValue([buildSubscriptionRow('active')]);

    const app = await createApp();
    const response = await app.inject({ method: 'GET', url: '/v1/private' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      subscriptionWarning: null
    });

    await app.close();
  });

  it('allows trialing subscriptions', async () => {
    queryRawMock.mockResolvedValue([buildSubscriptionRow('trialing')]);

    const app = await createApp();
    const response = await app.inject({ method: 'GET', url: '/v1/private' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      subscriptionWarning: null
    });

    await app.close();
  });

  it('allows past_due subscriptions with warning', async () => {
    queryRawMock.mockResolvedValue([buildSubscriptionRow('past_due')]);

    const app = await createApp();
    const response = await app.inject({ method: 'GET', url: '/v1/private' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      subscriptionWarning: 'past_due'
    });

    await app.close();
  });

  it('blocks canceled subscriptions', async () => {
    queryRawMock.mockResolvedValue([buildSubscriptionRow('canceled')]);

    const app = await createApp();
    const response = await app.inject({ method: 'GET', url: '/v1/private' });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: 'Active subscription required.',
      redirectTo: '/billing'
    });

    await app.close();
  });

  it('blocks when subscription does not exist', async () => {
    queryRawMock.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const app = await createApp();
    const response = await app.inject({ method: 'GET', url: '/v1/private' });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: 'Active subscription required.',
      redirectTo: '/billing'
    });

    await app.close();
  });

  it('allows tenant-level active trials when subscription row does not exist', async () => {
    queryRawMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        buildTenantTrialRow({
          trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        })
      ]);

    const app = await createApp();
    const response = await app.inject({ method: 'GET', url: '/v1/private' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      subscriptionWarning: null
    });

    await app.close();
  });

  it('blocks tenant-level expired trials when subscription row does not exist', async () => {
    queryRawMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        buildTenantTrialRow({
          trialEndsAt: new Date(Date.now() - 60 * 1000)
        })
      ]);

    const app = await createApp();
    const response = await app.inject({ method: 'GET', url: '/v1/private' });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: 'Active subscription required.',
      redirectTo: '/billing'
    });

    await app.close();
  });

  it('billing routes skip subscription guard', async () => {
    const app = await createApp();
    const response = await app.inject({ method: 'GET', url: '/v1/billing/status/tenant_1' });

    expect(response.statusCode).toBe(200);
    expect(queryRawMock).not.toHaveBeenCalled();

    await app.close();
  });

  it('onboarding routes skip subscription guard', async () => {
    const app = await createApp();
    const response = await app.inject({ method: 'GET', url: '/v1/onboarding/status' });

    expect(response.statusCode).toBe(200);
    expect(queryRawMock).not.toHaveBeenCalled();

    await app.close();
  });

  it('clerk webhook routes skip subscription guard', async () => {
    const app = await createApp();
    const response = await app.inject({ method: 'POST', url: '/v1/clerk/webhooks' });

    expect(response.statusCode).toBe(200);
    expect(queryRawMock).not.toHaveBeenCalled();

    await app.close();
  });

  it('twilio routes skip subscription guard', async () => {
    const app = await createApp();
    const response = await app.inject({ method: 'POST', url: '/v1/twilio/voice/inbound/mock' });

    expect(response.statusCode).toBe(200);
    expect(queryRawMock).not.toHaveBeenCalled();

    await app.close();
  });
});
