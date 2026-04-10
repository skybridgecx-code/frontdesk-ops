import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fastify from 'fastify';
import { registerStripeWebhookRoutes } from '../stripe-webhooks.js';

const {
  constructEventMock,
  subscriptionsRetrieveMock,
  processedWebhookFindUniqueMock,
  processedWebhookCreateMock,
  tenantUpdateMock,
  tenantFindUniqueMock,
  tenantUpdateManyMock,
  executeRawMock,
  queryRawMock
} = vi.hoisted(() => ({
  constructEventMock: vi.fn(),
  subscriptionsRetrieveMock: vi.fn(),
  processedWebhookFindUniqueMock: vi.fn(),
  processedWebhookCreateMock: vi.fn(),
  tenantUpdateMock: vi.fn(),
  tenantFindUniqueMock: vi.fn(),
  tenantUpdateManyMock: vi.fn(),
  executeRawMock: vi.fn(),
  queryRawMock: vi.fn()
}));

vi.mock('stripe', () => {
  class StripeMock {
    webhooks = {
      constructEvent: constructEventMock
    };

    subscriptions = {
      retrieve: subscriptionsRetrieveMock
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
      processedWebhookEvent: {
        findUnique: processedWebhookFindUniqueMock,
        create: processedWebhookCreateMock
      },
      tenant: {
        update: tenantUpdateMock,
        findUnique: tenantFindUniqueMock,
        updateMany: tenantUpdateManyMock
      },
      $executeRaw: executeRawMock,
      $queryRaw: queryRawMock
    }
  };
});

async function createApp() {
  const app = fastify({ logger: false });
  await app.register(registerStripeWebhookRoutes);
  return app;
}

describe('stripe webhook hardening routes', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123';
    process.env.STRIPE_PRICE_ID_STARTER = 'price_starter_123';
    process.env.FRONTDESK_ENABLE_WEBHOOK_IDEMPOTENCY_IN_TESTS = 'true';

    constructEventMock.mockReset();
    subscriptionsRetrieveMock.mockReset();
    processedWebhookFindUniqueMock.mockReset();
    processedWebhookCreateMock.mockReset();
    tenantUpdateMock.mockReset();
    tenantFindUniqueMock.mockReset();
    tenantUpdateManyMock.mockReset();
    executeRawMock.mockReset();
    queryRawMock.mockReset();

    processedWebhookFindUniqueMock.mockResolvedValue(null);
    processedWebhookCreateMock.mockResolvedValue({ id: 'proc_1' });
    tenantUpdateMock.mockResolvedValue({ id: 'tenant_1' });
    tenantFindUniqueMock.mockResolvedValue(null);
    tenantUpdateManyMock.mockResolvedValue({ count: 1 });
    executeRawMock.mockResolvedValue(1);
    queryRawMock.mockResolvedValue([]);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns 400 if stripe-signature header is missing', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/stripe/webhooks',
      headers: {
        'content-type': 'application/json'
      },
      payload: '{"id":"evt_1"}'
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('returns 500 if STRIPE_WEBHOOK_SECRET is not set', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/stripe/webhooks',
      headers: {
        'stripe-signature': 'sig_123',
        'content-type': 'application/json'
      },
      payload: '{"id":"evt_2"}'
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: 'Webhook secret not configured'
    });

    await app.close();
  });

  it('processes checkout.session.completed and updates tenant billing fields', async () => {
    constructEventMock.mockReturnValue({
      id: 'evt_checkout_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: {
            tenantId: 'tenant_1',
            planKey: 'starter'
          },
          customer: 'cus_123',
          subscription: 'sub_123'
        }
      }
    });

    subscriptionsRetrieveMock.mockResolvedValue({
      id: 'sub_123',
      status: 'active',
      cancel_at_period_end: false,
      items: {
        data: [
          {
            current_period_start: 1_712_000_000,
            current_period_end: 1_714_592_000,
            price: {
              id: 'price_starter_123'
            }
          }
        ]
      }
    });

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/stripe/webhooks',
      headers: {
        'stripe-signature': 'sig_checkout',
        'content-type': 'application/json'
      },
      payload: '{"id":"evt_checkout_1"}'
    });

    expect(response.statusCode).toBe(200);
    expect(tenantUpdateMock).toHaveBeenCalledWith({
      where: {
        id: 'tenant_1'
      },
      data: {
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
        plan: 'starter',
        subscriptionStatus: 'active'
      }
    });

    await app.close();
  });

  it('processes customer.subscription.deleted and marks tenant free', async () => {
    constructEventMock.mockReturnValue({
      id: 'evt_deleted_1',
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_deleted_1',
          customer: 'cus_deleted_1',
          status: 'canceled',
          metadata: {
            tenantId: 'tenant_1'
          },
          items: {
            data: [
              {
                current_period_start: 1_712_000_000,
                current_period_end: 1_714_592_000,
                price: {
                  id: 'price_starter_123'
                }
              }
            ]
          }
        }
      }
    });

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/stripe/webhooks',
      headers: {
        'stripe-signature': 'sig_deleted',
        'content-type': 'application/json'
      },
      payload: '{"id":"evt_deleted_1"}'
    });

    expect(response.statusCode).toBe(200);
    expect(tenantUpdateManyMock).toHaveBeenCalledWith({
      where: {
        stripeSubscriptionId: 'sub_deleted_1'
      },
      data: {
        plan: 'free',
        subscriptionStatus: 'canceled'
      }
    });

    await app.close();
  });

  it('skips duplicate events by idempotency key', async () => {
    processedWebhookFindUniqueMock.mockResolvedValue({
      id: 'processed_1',
      eventId: 'evt_dup_1',
      type: 'checkout.session.completed',
      createdAt: new Date('2026-01-01T00:00:00.000Z')
    });

    constructEventMock.mockReturnValue({
      id: 'evt_dup_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: {
            tenantId: 'tenant_1',
            planKey: 'starter'
          },
          customer: 'cus_123',
          subscription: 'sub_123'
        }
      }
    });

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/stripe/webhooks',
      headers: {
        'stripe-signature': 'sig_dup',
        'content-type': 'application/json'
      },
      payload: '{"id":"evt_dup_1"}'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      received: true,
      duplicate: true
    });
    expect(tenantUpdateMock).not.toHaveBeenCalled();

    await app.close();
  });

  it('returns 200 on successful invoice.payment_failed handling', async () => {
    constructEventMock.mockReturnValue({
      id: 'evt_invoice_1',
      type: 'invoice.payment_failed',
      data: {
        object: {
          id: 'in_123',
          subscription: 'sub_past_due_1'
        }
      }
    });

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/stripe/webhooks',
      headers: {
        'stripe-signature': 'sig_invoice',
        'content-type': 'application/json'
      },
      payload: '{"id":"evt_invoice_1"}'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      received: true
    });

    await app.close();
  });
});
