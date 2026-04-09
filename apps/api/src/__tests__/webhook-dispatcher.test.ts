import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  findManyMock,
  createDeliveryMock,
  updateDeliveryMock
} = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  createDeliveryMock: vi.fn(),
  updateDeliveryMock: vi.fn()
}));

vi.mock('@frontdesk/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@frontdesk/db')>();

  return {
    ...actual,
    prisma: {
      webhookEndpoint: {
        findMany: findManyMock
      },
      webhookDelivery: {
        create: createDeliveryMock,
        update: updateDeliveryMock
      }
    }
  };
});

import { dispatchWebhook, dispatchWebhookToEndpoint } from '../lib/webhook-dispatcher.js';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);

  findManyMock.mockResolvedValue([]);
  createDeliveryMock.mockResolvedValue({ id: 'delivery_1' });
  updateDeliveryMock.mockResolvedValue({ id: 'delivery_1' });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('webhook dispatcher', () => {
  it('dispatches to all matching active endpoints', async () => {
    findManyMock.mockResolvedValue([
      {
        id: 'endpoint_1',
        tenantId: 'tenant_1',
        url: 'https://example.com/hook-1',
        secret: 'secret_1',
        events: ['call.completed'],
        isActive: true
      },
      {
        id: 'endpoint_2',
        tenantId: 'tenant_1',
        url: 'https://example.com/hook-2',
        secret: 'secret_2',
        events: ['call.completed'],
        isActive: true
      }
    ]);

    createDeliveryMock
      .mockResolvedValueOnce({ id: 'delivery_1' })
      .mockResolvedValueOnce({ id: 'delivery_2' });

    fetchMock.mockResolvedValue(new Response('ok', { status: 200 }));

    const results = await dispatchWebhook('tenant_1', 'call.completed', {
      callSid: 'CA123'
    });

    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant_1',
        isActive: true,
        events: {
          has: 'call.completed'
        }
      },
      select: {
        id: true,
        tenantId: true,
        url: true,
        secret: true,
        events: true,
        isActive: true
      }
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(createDeliveryMock).toHaveBeenCalledTimes(2);
    expect(updateDeliveryMock).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(2);
    expect(results.every((result) => result.success)).toBe(true);
  });

  it('skips inactive endpoints by query filter', async () => {
    findManyMock.mockResolvedValue([]);

    const results = await dispatchWebhook('tenant_1', 'call.completed', {
      callSid: 'CA123'
    });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true
        })
      })
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(results).toEqual([]);
  });

  it('skips endpoints not subscribed to the event by query filter', async () => {
    findManyMock.mockResolvedValue([]);

    const results = await dispatchWebhook('tenant_1', 'prospect.created', {
      prospectSid: 'PR123'
    });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          events: {
            has: 'prospect.created'
          }
        })
      })
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(results).toEqual([]);
  });

  it('signs webhook payload with HMAC SHA256', async () => {
    fetchMock.mockResolvedValue(new Response('ok', { status: 200 }));
    createDeliveryMock.mockResolvedValue({ id: 'delivery_sig' });

    await dispatchWebhookToEndpoint({
      endpoint: {
        id: 'endpoint_sig',
        tenantId: 'tenant_1',
        url: 'https://example.com/hook',
        secret: 'super_secret',
        events: ['call.completed'],
        isActive: true
      },
      eventType: 'call.completed',
      payload: {
        callSid: 'CA_sig_1'
      }
    });

    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();

    if (!call) {
      throw new Error('Expected fetch to be called');
    }

    const init = call[1];
    expect(init).toBeDefined();

    if (!init) {
      throw new Error('Expected fetch init');
    }

    const body = String(init.body ?? '');
    const expectedSignature = `sha256=${createHmac('sha256', 'super_secret').update(body).digest('hex')}`;

    const headers = init.headers as Record<string, string>;
    expect(headers['X-SkybridgeCX-Signature']).toBe(expectedSignature);
    expect(headers['X-SkybridgeCX-Event']).toBe('call.completed');
    expect(headers['X-SkybridgeCX-Delivery-Id']).toBe('delivery_sig');
  });

  it('creates delivery record before sending', async () => {
    fetchMock.mockResolvedValue(new Response('ok', { status: 200 }));
    createDeliveryMock.mockResolvedValue({ id: 'delivery_create' });

    await dispatchWebhookToEndpoint({
      endpoint: {
        id: 'endpoint_create',
        tenantId: 'tenant_1',
        url: 'https://example.com/hook',
        secret: 'secret_create',
        events: ['call.completed'],
        isActive: true
      },
      eventType: 'call.completed',
      payload: {
        callSid: 'CA_create_1'
      }
    });

    expect(createDeliveryMock).toHaveBeenCalledWith({
      data: {
        webhookEndpointId: 'endpoint_create',
        eventType: 'call.completed',
        payload: expect.any(String),
        attempts: 1
      },
      select: {
        id: true
      }
    });
  });

  it('updates delivery on success (2xx)', async () => {
    fetchMock.mockResolvedValue(new Response('accepted', { status: 202 }));
    createDeliveryMock.mockResolvedValue({ id: 'delivery_success' });

    const result = await dispatchWebhookToEndpoint({
      endpoint: {
        id: 'endpoint_success',
        tenantId: 'tenant_1',
        url: 'https://example.com/hook',
        secret: 'secret_success',
        events: ['call.completed'],
        isActive: true
      },
      eventType: 'call.completed',
      payload: {
        callSid: 'CA_success_1'
      }
    });

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(202);
    expect(updateDeliveryMock).toHaveBeenCalledWith({
      where: {
        id: 'delivery_success'
      },
      data: {
        deliveredAt: expect.any(Date),
        responseStatus: 202,
        responseBody: 'accepted'
      }
    });
  });

  it('updates delivery on failure (non-2xx)', async () => {
    fetchMock.mockResolvedValue(new Response('bad request', { status: 400 }));
    createDeliveryMock.mockResolvedValue({ id: 'delivery_failure' });

    const result = await dispatchWebhookToEndpoint({
      endpoint: {
        id: 'endpoint_failure',
        tenantId: 'tenant_1',
        url: 'https://example.com/hook',
        secret: 'secret_failure',
        events: ['call.completed'],
        isActive: true
      },
      eventType: 'call.completed',
      payload: {
        callSid: 'CA_failure_1'
      }
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(400);
    expect(updateDeliveryMock).toHaveBeenCalledWith({
      where: {
        id: 'delivery_failure'
      },
      data: {
        failedAt: expect.any(Date),
        responseStatus: 400,
        responseBody: 'bad request',
        attempts: {
          increment: 1
        }
      }
    });
  });

  it('handles timeout gracefully', async () => {
    vi.useFakeTimers();

    fetchMock.mockImplementation(
      (_input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new Error('The operation was aborted'));
          });
        })
    );

    createDeliveryMock.mockResolvedValue({ id: 'delivery_timeout' });

    const resultPromise = dispatchWebhookToEndpoint({
      endpoint: {
        id: 'endpoint_timeout',
        tenantId: 'tenant_1',
        url: 'https://example.com/hook',
        secret: 'secret_timeout',
        events: ['call.completed'],
        isActive: true
      },
      eventType: 'call.completed',
      payload: {
        callSid: 'CA_timeout_1'
      }
    });

    await vi.advanceTimersByTimeAsync(10_100);

    const result = await resultPromise;

    expect(result.success).toBe(false);
    expect(result.statusCode).toBeNull();
    expect(updateDeliveryMock).toHaveBeenCalledWith({
      where: {
        id: 'delivery_timeout'
      },
      data: {
        failedAt: expect.any(Date),
        responseStatus: null,
        responseBody: 'The operation was aborted',
        attempts: {
          increment: 1
        }
      }
    });
  });

  it('handles network errors gracefully', async () => {
    fetchMock.mockRejectedValue(new Error('network unreachable'));
    createDeliveryMock.mockResolvedValue({ id: 'delivery_network_error' });

    const result = await dispatchWebhookToEndpoint({
      endpoint: {
        id: 'endpoint_network_error',
        tenantId: 'tenant_1',
        url: 'https://example.com/hook',
        secret: 'secret_network_error',
        events: ['call.completed'],
        isActive: true
      },
      eventType: 'call.completed',
      payload: {
        callSid: 'CA_network_error_1'
      }
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBeNull();
    expect(updateDeliveryMock).toHaveBeenCalledWith({
      where: {
        id: 'delivery_network_error'
      },
      data: {
        failedAt: expect.any(Date),
        responseStatus: null,
        responseBody: 'network unreachable',
        attempts: {
          increment: 1
        }
      }
    });
  });

  it('no endpoints for tenant is a no-op', async () => {
    findManyMock.mockResolvedValue([]);

    const results = await dispatchWebhook('tenant_2', 'call.completed', {
      callSid: 'CA_none'
    });

    expect(results).toEqual([]);
    expect(createDeliveryMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
