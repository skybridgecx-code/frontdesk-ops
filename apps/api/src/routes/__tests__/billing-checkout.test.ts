import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fastify from 'fastify';
import { registerBillingRoutes } from '../billing.js';

const {
  checkoutSessionCreateMock,
  portalSessionCreateMock,
  customerCreateMock,
  tenantFindUniqueMock,
  tenantUpdateMock
} = vi.hoisted(() => ({
  checkoutSessionCreateMock: vi.fn(),
  portalSessionCreateMock: vi.fn(),
  customerCreateMock: vi.fn(),
  tenantFindUniqueMock: vi.fn(),
  tenantUpdateMock: vi.fn()
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

    customers = {
      create: customerCreateMock
    };

    constructor(_secretKey: string) {}
  }

  return {
    default: StripeMock
  };
});

vi.mock('@frontdesk/db', () => {
  return {
    prisma: {
      tenant: {
        findUnique: tenantFindUniqueMock,
        update: tenantUpdateMock
      },
      $queryRaw: vi.fn(),
      $executeRaw: vi.fn()
    }
  };
});

async function createApp() {
  const app = fastify({ logger: false });
  await app.register(registerBillingRoutes);
  return app;
}

describe('billing checkout and portal routes', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';

    checkoutSessionCreateMock.mockReset();
    portalSessionCreateMock.mockReset();
    customerCreateMock.mockReset();
    tenantFindUniqueMock.mockReset();
    tenantUpdateMock.mockReset();

    tenantFindUniqueMock.mockResolvedValue({
      id: 'tenant_1',
      email: 'owner@example.com',
      stripeCustomerId: null
    });
    tenantUpdateMock.mockResolvedValue({
      id: 'tenant_1',
      stripeCustomerId: 'cus_new_1'
    });
    customerCreateMock.mockResolvedValue({ id: 'cus_new_1' });
    checkoutSessionCreateMock.mockResolvedValue({
      url: 'https://checkout.stripe.test/session_1'
    });
    portalSessionCreateMock.mockResolvedValue({
      url: 'https://billing.stripe.test/session_1'
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns 400 for invalid planKey', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/billing/checkout',
      payload: {
        tenantId: 'tenant_1',
        planKey: 'invalid-plan'
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'Invalid plan key'
    });

    await app.close();
  });

  it('returns 503 if STRIPE_SECRET_KEY is not set', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/billing/checkout',
      payload: {
        tenantId: 'tenant_1',
        planKey: 'starter'
      }
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      error: 'Billing not configured'
    });

    await app.close();
  });

  it('creates checkout session and returns URL', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/billing/checkout',
      payload: {
        tenantId: 'tenant_1',
        planKey: 'pro'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      url: 'https://checkout.stripe.test/session_1'
    });

    expect(customerCreateMock).toHaveBeenCalledWith({
      email: 'owner@example.com',
      metadata: {
        tenantId: 'tenant_1'
      }
    });

    expect(checkoutSessionCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          tenantId: 'tenant_1',
          planKey: 'pro'
        },
        subscription_data: {
          metadata: {
            tenantId: 'tenant_1',
            planKey: 'pro'
          }
        },
        success_url: 'https://skybridgecx.co/dashboard?checkout=success',
        cancel_url: 'https://skybridgecx.co/billing?checkout=canceled'
      })
    );

    await app.close();
  });

  it('portal returns URL for existing customer', async () => {
    tenantFindUniqueMock.mockResolvedValue({
      id: 'tenant_1',
      email: 'owner@example.com',
      stripeCustomerId: 'cus_existing_1'
    });

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/billing/portal',
      payload: {
        tenantId: 'tenant_1'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      url: 'https://billing.stripe.test/session_1'
    });

    expect(portalSessionCreateMock).toHaveBeenCalledWith({
      customer: 'cus_existing_1',
      return_url: 'https://skybridgecx.co/billing'
    });

    await app.close();
  });

  it('portal returns 400 if no stripeCustomerId exists', async () => {
    tenantFindUniqueMock.mockResolvedValue({
      id: 'tenant_1',
      email: 'owner@example.com',
      stripeCustomerId: null
    });

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/billing/portal',
      payload: {
        tenantId: 'tenant_1'
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'No billing account found'
    });

    await app.close();
  });
});
