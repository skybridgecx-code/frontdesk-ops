import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fastify from 'fastify';
import { registerClerkWebhookRoutes } from '../clerk-webhooks.js';

const {
  verifyWebhookMock,
  queryRawMock,
  executeRawMock,
  transactionMock,
  processedWebhookFindUniqueMock,
  processedWebhookCreateMock,
  tenantUpdateManyMock
} = vi.hoisted(() => ({
  verifyWebhookMock: vi.fn(),
  queryRawMock: vi.fn(),
  executeRawMock: vi.fn(),
  transactionMock: vi.fn(),
  processedWebhookFindUniqueMock: vi.fn(),
  processedWebhookCreateMock: vi.fn(),
  tenantUpdateManyMock: vi.fn()
}));

vi.mock('svix', () => {
  class WebhookMock {
    constructor(_secret: string) {}

    verify(payload: string, headers: Record<string, string>) {
      return verifyWebhookMock(payload, headers);
    }
  }

  return {
    Webhook: WebhookMock
  };
});

vi.mock('@frontdesk/db', () => {
  return {
    prisma: {
      $queryRaw: queryRawMock,
      $executeRaw: executeRawMock,
      $transaction: transactionMock,
      processedWebhookEvent: {
        findUnique: processedWebhookFindUniqueMock,
        create: processedWebhookCreateMock
      },
      tenant: {
        updateMany: tenantUpdateManyMock
      }
    }
  };
});

type TransactionShape = {
  $executeRaw: (...args: unknown[]) => Promise<number>;
};

async function createApp() {
  const app = fastify({ logger: false });
  await app.register(registerClerkWebhookRoutes);
  return app;
}

describe('clerk webhook hardening routes', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_test_123';
    process.env.FRONTDESK_ENABLE_WEBHOOK_IDEMPOTENCY_IN_TESTS = 'true';

    verifyWebhookMock.mockReset();
    queryRawMock.mockReset();
    executeRawMock.mockReset();
    transactionMock.mockReset();
    processedWebhookFindUniqueMock.mockReset();
    processedWebhookCreateMock.mockReset();
    tenantUpdateManyMock.mockReset();

    verifyWebhookMock.mockReturnValue({ ok: true });
    queryRawMock.mockResolvedValue([]);
    executeRawMock.mockResolvedValue(1);
    processedWebhookFindUniqueMock.mockResolvedValue(null);
    processedWebhookCreateMock.mockResolvedValue({ id: 'proc_1' });
    tenantUpdateManyMock.mockResolvedValue({ count: 1 });

    transactionMock.mockImplementation(async (runner: (tx: TransactionShape) => Promise<unknown>) => {
      const tx: TransactionShape = {
        $executeRaw: executeRawMock
      };

      return runner(tx);
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('creates tenant on user.created', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/clerk/webhooks',
      headers: {
        'svix-id': 'evt_1',
        'svix-timestamp': '1710000000',
        'svix-signature': 'v1,sig_123',
        'content-type': 'application/json'
      },
      payload: JSON.stringify({
        type: 'user.created',
        data: {
          id: 'user_1',
          first_name: 'Aatif',
          last_name: 'Khan',
          primary_email_address_id: 'email_1',
          email_addresses: [{ id: 'email_1', email_address: 'aatif@example.com' }]
        }
      })
    });

    expect(response.statusCode).toBe(200);
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(executeRawMock).toHaveBeenCalledTimes(4);

    const tenantInsertArgs = executeRawMock.mock.calls[0] ?? [];
    const tenantInsertQuery = tenantInsertArgs[0];
    const tenantInsertSql = Array.isArray(tenantInsertQuery)
      ? tenantInsertQuery.join('')
      : String(tenantInsertQuery ?? '');

    expect(tenantInsertSql).toContain('"trialEndsAt"');
    expect(tenantInsertSql).toContain("'none'");

    await app.close();
  });

  it('updates tenant on user.updated', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/clerk/webhooks',
      headers: {
        'svix-id': 'evt_2',
        'svix-timestamp': '1710000001',
        'svix-signature': 'v1,sig_456',
        'content-type': 'application/json'
      },
      payload: JSON.stringify({
        type: 'user.updated',
        data: {
          id: 'user_1',
          first_name: 'Aatif',
          last_name: 'Updated',
          primary_email_address_id: 'email_1',
          email_addresses: [{ id: 'email_1', email_address: 'updated@example.com' }]
        }
      })
    });

    expect(response.statusCode).toBe(200);
    expect(tenantUpdateManyMock).toHaveBeenCalledWith({
      where: {
        clerkUserId: 'user_1'
      },
      data: {
        email: 'updated@example.com',
        name: 'Aatif Updated'
      }
    });

    await app.close();
  });

  it('deactivates tenant on user.deleted', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/clerk/webhooks',
      headers: {
        'svix-id': 'evt_3',
        'svix-timestamp': '1710000002',
        'svix-signature': 'v1,sig_789',
        'content-type': 'application/json'
      },
      payload: JSON.stringify({
        type: 'user.deleted',
        data: {
          id: 'user_1'
        }
      })
    });

    expect(response.statusCode).toBe(200);
    expect(tenantUpdateManyMock).toHaveBeenCalledWith({
      where: {
        clerkUserId: 'user_1'
      },
      data: {
        subscriptionStatus: 'inactive'
      }
    });

    await app.close();
  });

  it('skips duplicate events', async () => {
    processedWebhookFindUniqueMock.mockResolvedValue({
      id: 'proc_1',
      eventId: 'evt_dup',
      type: 'user.created',
      createdAt: new Date('2026-01-01T00:00:00.000Z')
    });

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/clerk/webhooks',
      headers: {
        'svix-id': 'evt_dup',
        'svix-timestamp': '1710000003',
        'svix-signature': 'v1,sig_dup',
        'content-type': 'application/json'
      },
      payload: JSON.stringify({
        type: 'user.created',
        data: {
          id: 'user_1'
        }
      })
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      received: true,
      duplicate: true
    });
    expect(transactionMock).not.toHaveBeenCalled();

    await app.close();
  });

  it('returns 200 for valid webhook processing', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/clerk/webhooks',
      headers: {
        'svix-id': 'evt_4',
        'svix-timestamp': '1710000004',
        'svix-signature': 'v1,sig_101',
        'content-type': 'application/json'
      },
      payload: JSON.stringify({
        type: 'session.ended',
        data: {
          id: 'session_1'
        }
      })
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      received: true
    });

    await app.close();
  });
});
