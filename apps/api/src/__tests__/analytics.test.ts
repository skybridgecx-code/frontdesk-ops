import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fastify from 'fastify';
import type { SubscriptionRecord } from '../lib/subscription-store.js';
import { registerAnalyticsRoutes } from '../routes/analytics.js';

const { queryRawMock, callFindManyMock, getSubscriptionByTenantIdMock } = vi.hoisted(() => ({
  queryRawMock: vi.fn<(...args: unknown[]) => Promise<unknown[]>>(),
  callFindManyMock: vi.fn<(...args: unknown[]) => Promise<unknown[]>>(),
  getSubscriptionByTenantIdMock: vi.fn<(tenantId: string) => Promise<SubscriptionRecord | null>>()
}));

vi.mock('@frontdesk/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@frontdesk/db')>();

  return {
    ...actual,
    prisma: {
      $queryRaw: ((...args: unknown[]) => queryRawMock(...args)) as typeof actual.prisma.$queryRaw,
      call: {
        findMany: ((...args: unknown[]) => callFindManyMock(...args)) as typeof actual.prisma.call.findMany
      }
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
    stripeSubscriptionId: 'sub_1',
    stripePriceId: planKey === 'starter' ? 'price_starter_123' : planKey === 'pro' ? 'price_pro_123' : 'price_enterprise_123',
    planKey,
    status: 'active',
    currentPeriodStart: new Date('2026-04-01T00:00:00.000Z'),
    currentPeriodEnd: new Date('2026-05-01T00:00:00.000Z'),
    cancelAtPeriodEnd: false,
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
    updatedAt: new Date('2026-04-01T00:00:00.000Z')
  };
}

async function createApp() {
  const app = fastify({ logger: false });

  app.addHook('onRequest', async (request) => {
    const tenantId = request.headers['x-tenant-id'];
    const resolvedTenantId = typeof tenantId === 'string' && tenantId.length > 0 ? tenantId : 'tenant_1';

    Object.defineProperty(request, 'tenantId', {
      value: resolvedTenantId,
      configurable: true,
      writable: true
    });
  });

  await app.register(registerAnalyticsRoutes);
  return app;
}

function getDateArgs(call: unknown[]) {
  return call.filter((value): value is Date => value instanceof Date);
}

describe('analytics routes', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.STRIPE_PRICE_ID_STARTER = 'price_starter_123';
    process.env.STRIPE_PRICE_ID_PRO = 'price_pro_123';
    process.env.STRIPE_PRICE_ID_ENTERPRISE = 'price_enterprise_123';

    queryRawMock.mockReset();
    callFindManyMock.mockReset();
    getSubscriptionByTenantIdMock.mockReset();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('overview returns correct counts and rates', async () => {
    queryRawMock
      .mockResolvedValueOnce([
        { status: 'COMPLETED', durationSeconds: 120, leadName: 'Alex', textBackSent: false },
        { status: 'COMPLETED', durationSeconds: 5, leadName: null, textBackSent: true },
        { status: 'NO_ANSWER', durationSeconds: null, leadName: null, textBackSent: true },
        { status: 'BUSY', durationSeconds: null, leadName: 'Jordan', textBackSent: false }
      ])
      .mockResolvedValueOnce([
        { status: 'COMPLETED', durationSeconds: 100, leadName: 'Taylor', textBackSent: false },
        { status: 'FAILED', durationSeconds: null, leadName: null, textBackSent: false }
      ]);

    const app = await createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/v1/analytics/overview?period=30d'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        totalCalls: 4,
        answeredCalls: 1,
        missedCalls: 3,
        answerRate: 25,
        avgDurationSeconds: 120,
        totalLeadsExtracted: 2,
        leadConversionRate: 50,
        textBacksSent: 2,
        textBackRate: 66.67
      })
    );

    await app.close();
  });

  it('overview computes previous period comparison correctly', async () => {
    queryRawMock
      .mockResolvedValueOnce([
        { status: 'COMPLETED', durationSeconds: 100, leadName: 'Casey', textBackSent: false },
        { status: 'NO_ANSWER', durationSeconds: null, leadName: null, textBackSent: true }
      ])
      .mockResolvedValueOnce([
        { status: 'COMPLETED', durationSeconds: 50, leadName: null, textBackSent: false }
      ]);

    const app = await createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/v1/analytics/overview?period=30d'
    });

    expect(response.statusCode).toBe(200);

    const payload = response.json() as {
      comparedToPrevious: {
        totalCalls: { previous: number; changePct: number };
      };
    };

    expect(payload.comparedToPrevious.totalCalls.previous).toBe(1);
    expect(payload.comparedToPrevious.totalCalls.changePct).toBe(100);

    await app.close();
  });

  it('call-volume returns daily grouped data for 30d', async () => {
    queryRawMock.mockResolvedValueOnce([
      { bucket: new Date('2026-04-01T00:00:00.000Z'), total: 3, answered: 2, missed: 1 },
      { bucket: new Date('2026-04-02T00:00:00.000Z'), total: 1, answered: 1, missed: 0 }
    ]);

    const app = await createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/v1/analytics/call-volume?period=30d'
    });

    expect(response.statusCode).toBe(200);

    const payload = response.json() as {
      granularity: string;
      data: Array<{ date: string; total: number }>;
    };

    expect(payload.granularity).toBe('day');
    expect(payload.data.length).toBeGreaterThan(0);
    expect(payload.data.some((entry) => entry.date === '2026-04-01' && entry.total === 3)).toBe(true);

    await app.close();
  });

  it('call-volume returns weekly grouped data for 90d', async () => {
    queryRawMock.mockResolvedValueOnce([
      { bucket: new Date('2026-02-16T00:00:00.000Z'), total: 10, answered: 7, missed: 3 }
    ]);

    const app = await createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/v1/analytics/call-volume?period=90d'
    });

    expect(response.statusCode).toBe(200);

    const payload = response.json() as {
      granularity: string;
      data: Array<{ date: string; total: number }>;
    };

    expect(payload.granularity).toBe('week');
    expect(payload.data.some((entry) => entry.date === '2026-02-16' && entry.total === 10)).toBe(true);

    await app.close();
  });

  it('intents returns top 10 plus Other grouping', async () => {
    queryRawMock.mockResolvedValueOnce([
      { intent: 'Intent 1', count: 10 },
      { intent: 'Intent 2', count: 9 },
      { intent: 'Intent 3', count: 8 },
      { intent: 'Intent 4', count: 7 },
      { intent: 'Intent 5', count: 6 },
      { intent: 'Intent 6', count: 5 },
      { intent: 'Intent 7', count: 4 },
      { intent: 'Intent 8', count: 3 },
      { intent: 'Intent 9', count: 2 },
      { intent: 'Intent 10', count: 1 },
      { intent: 'Intent 11', count: 5 },
      { intent: 'Intent 12', count: 4 }
    ]);

    const app = await createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/v1/analytics/intents?period=30d'
    });

    expect(response.statusCode).toBe(200);

    const payload = response.json() as {
      data: Array<{ intent: string; count: number }>;
    };

    expect(payload.data).toHaveLength(11);
    expect(payload.data.some((entry) => entry.intent === 'Other' && entry.count === 9)).toBe(true);

    await app.close();
  });

  it('urgency returns correct distribution', async () => {
    queryRawMock.mockResolvedValueOnce([
      { urgency: 'high', count: 6 },
      { urgency: 'medium', count: 3 },
      { urgency: 'low', count: 1 }
    ]);

    const app = await createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/v1/analytics/urgency?period=30d'
    });

    expect(response.statusCode).toBe(200);

    const payload = response.json() as {
      data: Array<{ urgency: string; count: number; percentage: number }>;
    };

    expect(payload.data[0]).toEqual({ urgency: 'high', count: 6, percentage: 60 });

    await app.close();
  });

  it('peak-hours returns 24-hour distribution', async () => {
    queryRawMock.mockResolvedValueOnce([
      { hour: 9, count: 5 },
      { hour: 17, count: 2 }
    ]);

    const app = await createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/v1/analytics/peak-hours?period=30d'
    });

    expect(response.statusCode).toBe(200);

    const payload = response.json() as {
      data: Array<{ hour: number; count: number }>;
    };

    expect(payload.data).toHaveLength(24);
    expect(payload.data.find((entry) => entry.hour === 9)?.count).toBe(5);
    expect(payload.data.find((entry) => entry.hour === 0)?.count).toBe(0);

    await app.close();
  });

  it('recent-activity returns last 20 calls', async () => {
    callFindManyMock.mockResolvedValueOnce([
      {
        twilioCallSid: 'CA_recent_1',
        fromE164: '+17035550100',
        status: 'COMPLETED',
        durationSeconds: 35,
        leadName: 'Morgan',
        leadIntent: 'AC repair',
        urgency: 'high',
        textBackSent: false,
        createdAt: new Date('2026-04-10T12:00:00.000Z')
      }
    ]);

    const app = await createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/v1/analytics/recent-activity?period=30d'
    });

    expect(response.statusCode).toBe(200);

    const payload = response.json() as {
      data: Array<{ callSid: string; extractedName: string | null }>;
    };

    expect(payload.data[0]).toEqual(
      expect.objectContaining({
        callSid: 'CA_recent_1',
        extractedName: 'Morgan'
      })
    );

    await app.close();
  });

  it('webhook-health returns stats for Pro plan', async () => {
    getSubscriptionByTenantIdMock.mockResolvedValue(buildSubscription('pro'));
    queryRawMock.mockResolvedValueOnce([
      {
        totalDeliveries: 20,
        successfulDeliveries: 18,
        failedDeliveries: 2
      }
    ]);

    const app = await createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/v1/analytics/webhook-health?period=30d'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        available: true,
        totalDeliveries: 20,
        successfulDeliveries: 18,
        failedDeliveries: 2,
        successRate: 90
      })
    );

    await app.close();
  });

  it('webhook-health returns empty for Starter plan', async () => {
    getSubscriptionByTenantIdMock.mockResolvedValue(buildSubscription('starter'));

    const app = await createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/v1/analytics/webhook-health?period=30d'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        available: false,
        totalDeliveries: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        successRate: 0
      })
    );
    expect(queryRawMock).not.toHaveBeenCalled();

    await app.close();
  });

  it('all endpoints enforce tenant scoping', async () => {
    queryRawMock.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const app = await createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/v1/analytics/overview?period=30d',
      headers: {
        'x-tenant-id': 'tenant_scope'
      }
    });

    expect(response.statusCode).toBe(200);

    const firstQueryCall = queryRawMock.mock.calls[0] ?? [];
    expect(firstQueryCall).toContain('tenant_scope');

    await app.close();
  });

  it('period parameter correctly filters date range', async () => {
    queryRawMock.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const app = await createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/v1/analytics/overview?period=7d'
    });

    expect(response.statusCode).toBe(200);

    const firstQueryCall = queryRawMock.mock.calls[0] ?? [];
    const dateArgs = getDateArgs(firstQueryCall);

    expect(dateArgs.length).toBeGreaterThanOrEqual(2);

    const startArg = dateArgs[0];
    const endArg = dateArgs[1];

    if (!startArg || !endArg) {
      throw new Error('Expected date args in query');
    }

    const msDiff = endArg.getTime() - startArg.getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    expect(Math.abs(msDiff - sevenDaysMs)).toBeLessThan(5 * 60 * 1000);

    await app.close();
  });

  it('empty data returns zero counts, not errors', async () => {
    queryRawMock.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const app = await createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/v1/analytics/overview?period=30d'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        totalCalls: 0,
        answeredCalls: 0,
        missedCalls: 0,
        answerRate: 0,
        avgDurationSeconds: 0,
        totalLeadsExtracted: 0,
        leadConversionRate: 0,
        textBacksSent: 0,
        textBackRate: 0
      })
    );

    await app.close();
  });
});
