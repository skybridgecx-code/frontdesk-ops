import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fastify from 'fastify';
import sensible from '@fastify/sensible';
import type { SubscriptionRecord } from '../lib/subscription-store.js';
import { registerWebhookEndpointRoutes } from '../routes/webhook-endpoints.js';

const {
  endpointFindManyMock,
  endpointCreateMock,
  endpointFindFirstMock,
  endpointUpdateMock,
  endpointDeleteMock,
  deliveryFindManyMock,
  dispatchWebhookToEndpointMock,
  getSubscriptionByTenantIdMock
} = vi.hoisted(() => ({
  endpointFindManyMock: vi.fn(),
  endpointCreateMock: vi.fn(),
  endpointFindFirstMock: vi.fn(),
  endpointUpdateMock: vi.fn(),
  endpointDeleteMock: vi.fn(),
  deliveryFindManyMock: vi.fn(),
  dispatchWebhookToEndpointMock: vi.fn(),
  getSubscriptionByTenantIdMock: vi.fn()
}));

vi.mock('@frontdesk/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@frontdesk/db')>();

  return {
    ...actual,
    prisma: {
      webhookEndpoint: {
        findMany: endpointFindManyMock,
        create: endpointCreateMock,
        findFirst: endpointFindFirstMock,
        update: endpointUpdateMock,
        delete: endpointDeleteMock
      },
      webhookDelivery: {
        findMany: deliveryFindManyMock
      }
    }
  };
});

vi.mock('../lib/webhook-dispatcher.js', () => {
  return {
    dispatchWebhookToEndpoint: dispatchWebhookToEndpointMock
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

  await app.register(sensible);

  app.addHook('onRequest', async (request) => {
    Object.defineProperty(request, 'tenantId', {
      value: 'tenant_1',
      configurable: true,
      writable: true
    });
  });

  await app.register(registerWebhookEndpointRoutes);
  return app;
}

describe('webhook endpoint routes', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.STRIPE_PRICE_ID_STARTER = 'price_starter_123';
    process.env.STRIPE_PRICE_ID_PRO = 'price_pro_123';
    process.env.STRIPE_PRICE_ID_ENTERPRISE = 'price_enterprise_123';

    endpointFindManyMock.mockReset();
    endpointCreateMock.mockReset();
    endpointFindFirstMock.mockReset();
    endpointUpdateMock.mockReset();
    endpointDeleteMock.mockReset();
    deliveryFindManyMock.mockReset();
    dispatchWebhookToEndpointMock.mockReset();
    getSubscriptionByTenantIdMock.mockReset();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('list webhooks returns tenant endpoints', async () => {
    endpointFindManyMock.mockResolvedValue([
      {
        id: 'hook_1',
        url: 'https://example.com/webhook',
        secret: 'secret_1',
        events: ['call.completed'],
        isActive: true,
        description: 'Primary endpoint',
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z')
      }
    ]);

    const app = await createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/v1/webhooks'
    });

    expect(response.statusCode).toBe(200);
    expect(endpointFindManyMock).toHaveBeenCalledWith({
      where: { tenantId: 'tenant_1' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        url: true,
        secret: true,
        events: true,
        isActive: true,
        description: true,
        createdAt: true,
        updatedAt: true
      }
    });

    const payload = response.json() as {
      ok: boolean;
      endpoints: Array<{ id: string }>;
    };

    expect(payload.ok).toBe(true);
    expect(payload.endpoints).toHaveLength(1);

    await app.close();
  });

  it('create webhook with valid data succeeds', async () => {
    getSubscriptionByTenantIdMock.mockResolvedValue(buildSubscription('pro'));
    endpointCreateMock.mockResolvedValue({
      id: 'hook_1',
      url: 'https://example.com/webhook',
      secret: 'secret_1',
      events: ['call.completed'],
      isActive: true,
      description: 'Primary endpoint',
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-01T00:00:00.000Z')
    });

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/webhooks',
      payload: {
        url: 'https://example.com/webhook',
        events: ['call.completed'],
        description: 'Primary endpoint'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(endpointCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant_1',
          url: 'https://example.com/webhook',
          events: ['call.completed'],
          description: 'Primary endpoint'
        })
      })
    );

    await app.close();
  });

  it('create webhook on Starter plan returns 403', async () => {
    getSubscriptionByTenantIdMock.mockResolvedValue(buildSubscription('starter'));

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/webhooks',
      payload: {
        url: 'https://example.com/webhook',
        events: ['call.completed']
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      ok: false,
      error: 'Webhooks are available on Pro and Enterprise plans.'
    });

    await app.close();
  });

  it('create webhook with invalid URL returns 400', async () => {
    getSubscriptionByTenantIdMock.mockResolvedValue(buildSubscription('pro'));

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/webhooks',
      payload: {
        url: 'http://example.com/webhook',
        events: ['call.completed']
      }
    });

    expect(response.statusCode).toBe(400);

    await app.close();
  });

  it('create webhook with invalid event types returns 400', async () => {
    getSubscriptionByTenantIdMock.mockResolvedValue(buildSubscription('pro'));

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/webhooks',
      payload: {
        url: 'https://example.com/webhook',
        events: ['invalid.event']
      }
    });

    expect(response.statusCode).toBe(400);

    await app.close();
  });

  it('update webhook validates ownership', async () => {
    endpointFindFirstMock.mockResolvedValue(null);

    const app = await createApp();

    const response = await app.inject({
      method: 'PATCH',
      url: '/v1/webhooks/hook_not_found',
      payload: {
        description: 'Updated'
      }
    });

    expect(response.statusCode).toBe(404);

    await app.close();
  });

  it('delete webhook validates ownership', async () => {
    endpointFindFirstMock.mockResolvedValue(null);

    const app = await createApp();

    const response = await app.inject({
      method: 'DELETE',
      url: '/v1/webhooks/hook_not_found'
    });

    expect(response.statusCode).toBe(404);

    await app.close();
  });

  it('test webhook sends and returns result', async () => {
    endpointFindFirstMock.mockResolvedValue({
      id: 'hook_1',
      tenantId: 'tenant_1',
      url: 'https://example.com/webhook',
      secret: 'secret_1',
      events: ['call.completed'],
      isActive: true
    });

    dispatchWebhookToEndpointMock.mockResolvedValue({
      endpointId: 'hook_1',
      deliveryId: 'delivery_1',
      eventType: 'test',
      success: true,
      statusCode: 200,
      responseBody: 'ok'
    });

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/webhooks/hook_1/test'
    });

    expect(response.statusCode).toBe(200);
    expect(dispatchWebhookToEndpointMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'test',
        endpoint: expect.objectContaining({
          id: 'hook_1'
        })
      })
    );

    const payload = response.json() as {
      ok: boolean;
      result: { success: boolean };
    };

    expect(payload.ok).toBe(true);
    expect(payload.result.success).toBe(true);

    await app.close();
  });
});
