import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fastify from 'fastify';
import { prisma } from '@frontdesk/db';
import { registerBillingRoutes } from '../routes/billing.js';

const { checkoutSessionCreateMock, portalSessionCreateMock } = vi.hoisted(() => ({
  checkoutSessionCreateMock: vi.fn(),
  portalSessionCreateMock: vi.fn()
}));

vi.mock('stripe', () => {
  class StripeMock {
    checkout = {
      sessions: {
        create: checkoutSessionCreateMock
      }
    };

    billingPortal = {
      sessions: {
        create: portalSessionCreateMock
      }
    };

    constructor(_secretKey: string) {}
  }

  return {
    default: StripeMock
  };
});

const queryRawMock = vi.fn<(...args: unknown[]) => Promise<unknown[]>>();

async function createApp() {
  const app = fastify({ logger: false });
  await app.register(registerBillingRoutes);
  return app;
}

function buildSubscriptionRow() {
  return {
    id: 'sub_local_1',
    tenantId: 'tenant_1',
    stripeCustomerId: 'cus_123',
    stripeSubscriptionId: 'sub_123',
    stripePriceId: 'price_pro_123',
    planKey: 'pro',
    status: 'active',
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

describe('billing routes', () => {
  const originalEnv = { ...process.env };
  let originalQueryRaw: typeof prisma.$queryRaw;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.STRIPE_PRICE_ID_STARTER = 'price_starter_123';
    process.env.STRIPE_PRICE_ID_PRO = 'price_pro_123';
    process.env.STRIPE_PRICE_ID_ENTERPRISE = 'price_enterprise_123';
    process.env.FRONTDESK_WEB_URL = 'http://localhost:3000';

    checkoutSessionCreateMock.mockReset();
    portalSessionCreateMock.mockReset();
    queryRawMock.mockReset();

    originalQueryRaw = prisma.$queryRaw;
    Object.defineProperty(prisma, '$queryRaw', {
      configurable: true,
      value: ((...args: unknown[]) => queryRawMock(...args)) as unknown as typeof prisma.$queryRaw
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    Object.defineProperty(prisma, '$queryRaw', {
      configurable: true,
      value: originalQueryRaw
    });
  });

  it('create-checkout-session returns Stripe URL for selected plan', async () => {
    queryRawMock.mockResolvedValue([]);
    checkoutSessionCreateMock.mockResolvedValue({
      url: 'https://checkout.stripe.test/session_1'
    });

    const app = await createApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/billing/create-checkout-session',
      payload: {
        tenantId: 'tenant_1',
        planKey: 'starter'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      url: 'https://checkout.stripe.test/session_1'
    });

    expect(checkoutSessionCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [
          {
            price: 'price_starter_123',
            quantity: 1
          }
        ],
        metadata: {
          tenantId: 'tenant_1',
          planKey: 'starter'
        }
      })
    );

    await app.close();
  });

  it('create-portal-session returns Stripe URL', async () => {
    queryRawMock.mockResolvedValue([buildSubscriptionRow()]);

    portalSessionCreateMock.mockResolvedValue({
      url: 'https://billing.stripe.test/session_1'
    });

    const app = await createApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/billing/create-portal-session',
      payload: {
        tenantId: 'tenant_1'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      url: 'https://billing.stripe.test/session_1'
    });

    expect(portalSessionCreateMock).toHaveBeenCalledWith({
      customer: 'cus_123',
      return_url: 'http://localhost:3000/billing'
    });

    await app.close();
  });

  it('billing status returns subscription, plan, and usage data', async () => {
    queryRawMock
      .mockResolvedValueOnce([buildSubscriptionRow()])
      .mockResolvedValueOnce([{ count: 342 }])
      .mockResolvedValueOnce([{ count: 2 }])
      .mockResolvedValueOnce([{ count: 1 }]);

    const app = await createApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/billing/status/tenant_1'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        status: 'active',
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
        stripePriceId: 'price_pro_123',
        planKey: 'pro',
        planName: 'Pro',
        monthlyPrice: 499,
        planLimits: {
          callsPerMonth: -1,
          maxPhoneNumbers: 3,
          maxBusinesses: 1
        },
        callsThisPeriod: 342,
        activePhoneNumbers: 2,
        activeBusinesses: 1
      })
    );

    const payload = response.json() as {
      plans: Array<{ key: string }>;
    };

    expect(payload.plans).toHaveLength(3);

    await app.close();
  });

  it('billing usage returns current period usage snapshot', async () => {
    queryRawMock
      .mockResolvedValueOnce([buildSubscriptionRow()])
      .mockResolvedValueOnce([{ count: 90 }])
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([{ count: 1 }]);

    const app = await createApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/billing/usage/tenant_1'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      planKey: 'pro',
      planName: 'Pro',
      callsThisPeriod: 90,
      callsLimit: -1,
      activePhoneNumbers: 1,
      phoneNumberLimit: 3,
      activeBusinesses: 1,
      businessLimit: 1,
      periodStart: '2026-04-01T00:00:00.000Z',
      periodEnd: '2026-05-01T00:00:00.000Z'
    });

    await app.close();
  });

  it('billing status returns none when no subscription exists', async () => {
    queryRawMock.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const app = await createApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/billing/status/tenant_1'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        status: 'none'
      })
    );

    await app.close();
  });

  it('billing status returns trialing when tenant has an active free trial', async () => {
    queryRawMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        buildTenantTrialRow({
          trialEndsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
        })
      ])
      .mockResolvedValueOnce([{ count: 42 }])
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([{ count: 1 }]);

    const app = await createApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/billing/status/tenant_1'
    });

    expect(response.statusCode).toBe(200);

    const payload = response.json() as {
      status: string;
      planKey: string;
      stripeSubscriptionId: string | null;
      trialEndsAt?: string;
      trialDaysRemaining?: number;
      callsThisPeriod: number;
      activePhoneNumbers: number;
      activeBusinesses: number;
    };

    expect(payload.status).toBe('trialing');
    expect(payload.planKey).toBe('starter');
    expect(payload.stripeSubscriptionId).toBeNull();
    expect(payload.trialEndsAt).toBeDefined();
    expect(payload.trialDaysRemaining).toBeGreaterThan(0);
    expect(payload.callsThisPeriod).toBe(42);
    expect(payload.activePhoneNumbers).toBe(1);
    expect(payload.activeBusinesses).toBe(1);

    await app.close();
  });
});
