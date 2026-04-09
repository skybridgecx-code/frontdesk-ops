import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fastify from 'fastify';
import type { SubscriptionRecord } from '../lib/subscription-store.js';
import { enforceUsageLimits, type UsageLimitScope } from '../lib/usage-limiter.js';

const { queryRawMock, getSubscriptionByTenantIdMock } = vi.hoisted(() => ({
  queryRawMock: vi.fn<(...args: unknown[]) => Promise<unknown[]>>(),
  getSubscriptionByTenantIdMock: vi.fn<(tenantId: string) => Promise<SubscriptionRecord | null>>()
}));

vi.mock('@frontdesk/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@frontdesk/db')>();
  return {
    ...actual,
    prisma: {
      $queryRaw: ((...args: unknown[]) => queryRawMock(...args)) as typeof actual.prisma.$queryRaw
    }
  };
});

vi.mock('../lib/subscription-store.js', () => {
  return {
    getSubscriptionByTenantId: getSubscriptionByTenantIdMock
  };
});

function buildSubscription(planKey: 'starter' | 'pro' | 'enterprise'): SubscriptionRecord {
  return {
    id: 'sub_1',
    tenantId: 'tenant_1',
    stripeCustomerId: 'cus_1',
    stripeSubscriptionId: 'sub_stripe_1',
    stripePriceId: 'price_placeholder',
    planKey,
    status: 'active',
    currentPeriodStart: new Date('2026-04-01T00:00:00.000Z'),
    currentPeriodEnd: new Date('2026-05-01T00:00:00.000Z'),
    cancelAtPeriodEnd: false,
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
    updatedAt: new Date('2026-04-01T00:00:00.000Z')
  };
}

async function createApp(scope: UsageLimitScope) {
  const app = fastify({ logger: false });

  if (scope !== 'calls') {
    app.addHook('onRequest', async (request) => {
      Object.defineProperty(request, 'tenantId', {
        value: 'tenant_1',
        writable: true,
        configurable: true
      });
    });
  }

  app.post('/test', { preHandler: enforceUsageLimits(scope) }, async () => {
    return {
      ok: true
    };
  });

  return app;
}

describe('usage limiter', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.STRIPE_PRICE_ID_STARTER = 'price_starter';
    process.env.STRIPE_PRICE_ID_PRO = 'price_pro';
    process.env.STRIPE_PRICE_ID_ENTERPRISE = 'price_enterprise';

    queryRawMock.mockReset();
    getSubscriptionByTenantIdMock.mockReset();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('calls under limit are allowed', async () => {
    getSubscriptionByTenantIdMock.mockResolvedValue(buildSubscription('starter'));
    queryRawMock
      .mockResolvedValueOnce([{ tenantId: 'tenant_1', isActive: true }])
      .mockResolvedValueOnce([{ count: 120 }]);

    const app = await createApp('calls');
    const response = await app.inject({
      method: 'POST',
      url: '/test',
      payload: {
        To: '+15551230001'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });

    await app.close();
  });

  it('calls at limit are rejected with 429', async () => {
    getSubscriptionByTenantIdMock.mockResolvedValue(buildSubscription('starter'));
    queryRawMock
      .mockResolvedValueOnce([{ tenantId: 'tenant_1', isActive: true }])
      .mockResolvedValueOnce([{ count: 500 }]);

    const app = await createApp('calls');
    const response = await app.inject({
      method: 'POST',
      url: '/test',
      payload: {
        To: '+15551230001'
      }
    });

    expect(response.statusCode).toBe(429);
    expect(response.body).toContain('monthly call limit');

    await app.close();
  });

  it('unlimited plan calls are always allowed', async () => {
    getSubscriptionByTenantIdMock.mockResolvedValue(buildSubscription('pro'));
    queryRawMock.mockResolvedValueOnce([{ tenantId: 'tenant_1', isActive: true }]);

    const app = await createApp('calls');
    const response = await app.inject({
      method: 'POST',
      url: '/test',
      payload: {
        To: '+15551230001'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });

    await app.close();
  });

  it('phone numbers at limit are rejected with 403', async () => {
    getSubscriptionByTenantIdMock.mockResolvedValue(buildSubscription('starter'));
    queryRawMock.mockResolvedValueOnce([{ count: 1 }]);

    const app = await createApp('phone_numbers');
    const response = await app.inject({
      method: 'POST',
      url: '/test'
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: 'Phone number limit reached for your plan. Upgrade to add more numbers.'
    });

    await app.close();
  });

  it('phone numbers under limit are allowed', async () => {
    getSubscriptionByTenantIdMock.mockResolvedValue(buildSubscription('pro'));
    queryRawMock.mockResolvedValueOnce([{ count: 2 }]);

    const app = await createApp('phone_numbers');
    const response = await app.inject({
      method: 'POST',
      url: '/test'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });

    await app.close();
  });

  it('businesses at limit are rejected with 403', async () => {
    getSubscriptionByTenantIdMock.mockResolvedValue(buildSubscription('starter'));
    queryRawMock.mockResolvedValueOnce([{ count: 1 }]);

    const app = await createApp('businesses');
    const response = await app.inject({
      method: 'POST',
      url: '/test'
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: 'Business limit reached for your plan. Upgrade to add more locations.'
    });

    await app.close();
  });
});
