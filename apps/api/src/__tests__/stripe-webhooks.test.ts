import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fastify from 'fastify';
import { prisma } from '@frontdesk/db';
import { enforceClerkAuth, shouldSkipDashboardAuth } from '../lib/clerk-auth.js';
import { registerStripeWebhookRoutes } from '../routes/stripe-webhooks.js';

const {
  constructEventMock,
  subscriptionsRetrieveMock,
  verifyTokenMock
} = vi.hoisted(() => ({
  constructEventMock: vi.fn(),
  subscriptionsRetrieveMock: vi.fn(),
  verifyTokenMock: vi.fn()
}));

vi.mock('@clerk/backend', () => {
  return {
    verifyToken: verifyTokenMock
  };
});

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

const executeRawMock = vi.fn<(...args: unknown[]) => Promise<number>>();

async function createWebhookApp(input?: {
  withAuthHook?: boolean;
}) {
  const app = fastify({ logger: false });

  if (input?.withAuthHook) {
    app.addHook('onRequest', async (request, reply) => {
      if (shouldSkipDashboardAuth(request.url)) {
        return;
      }

      if (process.env.CLERK_SECRET_KEY) {
        const ok = await enforceClerkAuth(request, reply);
        if (!ok) {
          return reply;
        }
      }
    });
  }

  await app.register(registerStripeWebhookRoutes);
  return app;
}

describe('stripe webhook routes', () => {
  const originalEnv = { ...process.env };
  let originalExecuteRaw: typeof prisma.$executeRaw;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123';
    process.env.STRIPE_PRICE_ID = 'price_123';

    constructEventMock.mockReset();
    subscriptionsRetrieveMock.mockReset();
    verifyTokenMock.mockReset();
    executeRawMock.mockReset();

    executeRawMock.mockResolvedValue(1);

    originalExecuteRaw = prisma.$executeRaw;
    Object.defineProperty(prisma, '$executeRaw', {
      configurable: true,
      value: ((...args: unknown[]) => executeRawMock(...args)) as unknown as typeof prisma.$executeRaw
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    Object.defineProperty(prisma, '$executeRaw', {
      configurable: true,
      value: originalExecuteRaw
    });
  });

  it('valid checkout.session.completed creates or updates subscription', async () => {
    constructEventMock.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: {
            tenantId: 'tenant_1'
          },
          customer: 'cus_1',
          subscription: 'sub_1'
        }
      }
    });

    subscriptionsRetrieveMock.mockResolvedValue({
      id: 'sub_1',
      status: 'active',
      current_period_start: 1_712_000_000,
      current_period_end: 1_714_592_000,
      cancel_at_period_end: false,
      items: {
        data: [
          {
            current_period_start: 1_712_000_000,
            current_period_end: 1_714_592_000,
            price: {
              id: 'price_123'
            }
          }
        ]
      }
    });

    const app = await createWebhookApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/stripe/webhooks',
      headers: {
        'stripe-signature': 'sig_123',
        'content-type': 'application/json'
      },
      payload: '{"id":"evt_1"}'
    });

    expect(response.statusCode).toBe(200);
    expect(executeRawMock).toHaveBeenCalledTimes(1);
    const call = executeRawMock.mock.calls[0] ?? [];
    expect(call).toContain('tenant_1');
    expect(call).toContain('cus_1');
    expect(call).toContain('sub_1');

    await app.close();
  });

  it('valid customer.subscription.updated updates status', async () => {
    constructEventMock.mockReturnValue({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_1',
          customer: 'cus_1',
          status: 'past_due',
          current_period_start: 1_712_000_000,
          current_period_end: 1_714_592_000,
          cancel_at_period_end: true,
          metadata: {
            tenantId: 'tenant_1'
          },
          items: {
            data: [
              {
                current_period_start: 1_712_000_000,
                current_period_end: 1_714_592_000,
                price: {
                  id: 'price_123'
                }
              }
            ]
          }
        }
      }
    });

    executeRawMock.mockResolvedValueOnce(1);

    const app = await createWebhookApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/stripe/webhooks',
      headers: {
        'stripe-signature': 'sig_123',
        'content-type': 'application/json'
      },
      payload: '{"id":"evt_2"}'
    });

    expect(response.statusCode).toBe(200);
    const call = executeRawMock.mock.calls[0] ?? [];
    expect(call).toContain('past_due');
    expect(call).toContain('sub_1');

    await app.close();
  });

  it('valid customer.subscription.deleted sets status canceled', async () => {
    constructEventMock.mockReturnValue({
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_1',
          customer: 'cus_1',
          status: 'canceled',
          current_period_start: 1_712_000_000,
          current_period_end: 1_714_592_000,
          cancel_at_period_end: true,
          metadata: {
            tenantId: 'tenant_1'
          },
          items: {
            data: [
              {
                current_period_start: 1_712_000_000,
                current_period_end: 1_714_592_000,
                price: {
                  id: 'price_123'
                }
              }
            ]
          }
        }
      }
    });

    executeRawMock.mockResolvedValueOnce(1);

    const app = await createWebhookApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/stripe/webhooks',
      headers: {
        'stripe-signature': 'sig_123',
        'content-type': 'application/json'
      },
      payload: '{"id":"evt_3"}'
    });

    expect(response.statusCode).toBe(200);
    expect(executeRawMock).toHaveBeenCalledTimes(1);
    const firstCallTemplate = executeRawMock.mock.calls[0]?.[0];
    expect(Array.isArray(firstCallTemplate)).toBe(true);
    if (Array.isArray(firstCallTemplate)) {
      expect(firstCallTemplate.join('')).toContain(`"status" = 'canceled'`);
    }

    await app.close();
  });

  it('invalid signature returns 400', async () => {
    constructEventMock.mockImplementation(() => {
      throw new Error('bad signature');
    });

    const app = await createWebhookApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/stripe/webhooks',
      headers: {
        'stripe-signature': 'bad_sig',
        'content-type': 'application/json'
      },
      payload: '{"id":"evt_bad"}'
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('unhandled event type returns 200', async () => {
    constructEventMock.mockReturnValue({
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_123'
        }
      }
    });

    const app = await createWebhookApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/stripe/webhooks',
      headers: {
        'stripe-signature': 'sig_123',
        'content-type': 'application/json'
      },
      payload: '{"id":"evt_4"}'
    });

    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it('stripe webhook route skips Clerk auth', async () => {
    process.env.CLERK_SECRET_KEY = 'sk_clerk_test';
    verifyTokenMock.mockRejectedValue(new Error('invalid token'));

    constructEventMock.mockReturnValue({
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_123'
        }
      }
    });

    const app = await createWebhookApp({ withAuthHook: true });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/stripe/webhooks',
      headers: {
        'stripe-signature': 'sig_123',
        'content-type': 'application/json'
      },
      payload: '{"id":"evt_5"}'
    });

    expect(response.statusCode).toBe(200);
    expect(verifyTokenMock).not.toHaveBeenCalled();

    await app.close();
  });
});
