import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fastify from 'fastify';
import { prisma } from '@frontdesk/db';
import { enforceClerkAuth, shouldSkipDashboardAuth } from '../lib/clerk-auth.js';
import { registerClerkWebhookRoutes } from '../routes/clerk-webhooks.js';

const {
  verifyWebhookMock,
  verifyTokenMock,
  tenantResolverSpy,
  subscriptionGuardSpy
} = vi.hoisted(() => ({
  verifyWebhookMock: vi.fn(),
  verifyTokenMock: vi.fn(),
  tenantResolverSpy: vi.fn(),
  subscriptionGuardSpy: vi.fn()
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

vi.mock('@clerk/backend', () => {
  return {
    verifyToken: verifyTokenMock
  };
});

const queryRawMock = vi.fn<(...args: unknown[]) => Promise<unknown[]>>();
const executeRawMock = vi.fn<(...args: unknown[]) => Promise<number>>();

type TransactionClientShape = {
  $executeRaw: typeof prisma.$executeRaw;
};

const transactionMock = vi.fn<(runner: (tx: TransactionClientShape) => Promise<unknown>) => Promise<unknown>>();

function shouldSkipTenantResolver(url: string) {
  const pathname = url.split('?')[0] ?? url;

  return (
    pathname === '/health' ||
    pathname === '/v1/ping' ||
    pathname.startsWith('/v1/twilio/') ||
    pathname.startsWith('/v1/stripe/') ||
    pathname.startsWith('/v1/clerk/')
  );
}

function shouldSkipSubscriptionGuard(url: string) {
  const pathname = url.split('?')[0] ?? url;

  return (
    shouldSkipTenantResolver(pathname) ||
    pathname === '/v1/bootstrap' ||
    pathname.startsWith('/v1/billing/') ||
    pathname.startsWith('/v1/onboarding/')
  );
}

async function createWebhookApp(input?: {
  withAuthHook?: boolean;
  withTenantResolverHook?: boolean;
  withSubscriptionGuardHook?: boolean;
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

  if (input?.withTenantResolverHook || input?.withSubscriptionGuardHook) {
    app.addHook('preHandler', async (request, reply) => {
      if (input.withTenantResolverHook && !shouldSkipTenantResolver(request.url)) {
        tenantResolverSpy(request.url);
      }

      if (input.withSubscriptionGuardHook && !shouldSkipSubscriptionGuard(request.url)) {
        subscriptionGuardSpy(request.url);
      }

      return;
    });
  }

  await app.register(registerClerkWebhookRoutes);
  return app;
}

describe('clerk webhook routes', () => {
  const originalEnv = { ...process.env };
  let originalQueryRaw: typeof prisma.$queryRaw;
  let originalExecuteRaw: typeof prisma.$executeRaw;
  let originalTransaction: typeof prisma.$transaction;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_test_123';

    verifyWebhookMock.mockReset();
    verifyTokenMock.mockReset();
    queryRawMock.mockReset();
    executeRawMock.mockReset();
    transactionMock.mockReset();
    tenantResolverSpy.mockReset();
    subscriptionGuardSpy.mockReset();

    verifyTokenMock.mockRejectedValue(new Error('invalid token'));
    executeRawMock.mockResolvedValue(1);

    transactionMock.mockImplementation(async (runner) => {
      const tx: TransactionClientShape = {
        $executeRaw: ((...args: unknown[]) => executeRawMock(...args)) as unknown as typeof prisma.$executeRaw
      };

      return runner(tx);
    });

    originalQueryRaw = prisma.$queryRaw;
    originalExecuteRaw = prisma.$executeRaw;
    originalTransaction = prisma.$transaction;

    Object.defineProperty(prisma, '$queryRaw', {
      configurable: true,
      value: ((...args: unknown[]) => queryRawMock(...args)) as unknown as typeof prisma.$queryRaw
    });

    Object.defineProperty(prisma, '$executeRaw', {
      configurable: true,
      value: ((...args: unknown[]) => executeRawMock(...args)) as unknown as typeof prisma.$executeRaw
    });

    Object.defineProperty(prisma, '$transaction', {
      configurable: true,
      value: ((runner: (tx: TransactionClientShape) => Promise<unknown>) => transactionMock(runner)) as unknown as typeof prisma.$transaction
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };

    Object.defineProperty(prisma, '$queryRaw', {
      configurable: true,
      value: originalQueryRaw
    });

    Object.defineProperty(prisma, '$executeRaw', {
      configurable: true,
      value: originalExecuteRaw
    });

    Object.defineProperty(prisma, '$transaction', {
      configurable: true,
      value: originalTransaction
    });
  });

  it('valid user.created provisions Tenant, TenantUser, Business, and AgentProfile', async () => {
    queryRawMock.mockResolvedValue([]);

    verifyWebhookMock.mockReturnValue({
      type: 'user.created',
      data: {
        id: 'user_123',
        first_name: 'Aatif',
        last_name: 'Khan',
        primary_email_address_id: 'em_primary',
        email_addresses: [
          {
            id: 'em_primary',
            email_address: 'aatif@example.com'
          }
        ]
      }
    });

    const app = await createWebhookApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/clerk/webhooks',
      headers: {
        'svix-id': 'msg_1',
        'svix-timestamp': '1710000000',
        'svix-signature': 'v1,sig_123',
        'content-type': 'application/json'
      },
      payload: '{"id":"evt_1"}'
    });

    expect(response.statusCode).toBe(200);
    expect(queryRawMock).toHaveBeenCalledTimes(1);
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(executeRawMock).toHaveBeenCalledTimes(4);

    await app.close();
  });

  it('user.created with existing clerkUserId skips duplicate provisioning', async () => {
    queryRawMock.mockResolvedValue([
      {
        tenantId: 'tenant_existing'
      }
    ]);

    verifyWebhookMock.mockReturnValue({
      type: 'user.created',
      data: {
        id: 'user_123'
      }
    });

    const app = await createWebhookApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/clerk/webhooks',
      headers: {
        'svix-id': 'msg_2',
        'svix-timestamp': '1710000001',
        'svix-signature': 'v1,sig_456',
        'content-type': 'application/json'
      },
      payload: '{"id":"evt_2"}'
    });

    expect(response.statusCode).toBe(200);
    expect(queryRawMock).toHaveBeenCalledTimes(1);
    expect(transactionMock).not.toHaveBeenCalled();
    expect(executeRawMock).not.toHaveBeenCalled();

    await app.close();
  });

  it('valid user.deleted event deletes TenantUser link', async () => {
    verifyWebhookMock.mockReturnValue({
      type: 'user.deleted',
      data: {
        id: 'user_123'
      }
    });

    const app = await createWebhookApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/clerk/webhooks',
      headers: {
        'svix-id': 'msg_3',
        'svix-timestamp': '1710000002',
        'svix-signature': 'v1,sig_789',
        'content-type': 'application/json'
      },
      payload: '{"id":"evt_3"}'
    });

    expect(response.statusCode).toBe(200);
    expect(executeRawMock).toHaveBeenCalledTimes(1);
    expect(transactionMock).not.toHaveBeenCalled();

    await app.close();
  });

  it('invalid webhook signature returns 400', async () => {
    verifyWebhookMock.mockImplementation(() => {
      throw new Error('invalid signature');
    });

    const app = await createWebhookApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/clerk/webhooks',
      headers: {
        'svix-id': 'msg_4',
        'svix-timestamp': '1710000003',
        'svix-signature': 'v1,bad',
        'content-type': 'application/json'
      },
      payload: '{"id":"evt_4"}'
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('unhandled event type returns 200', async () => {
    verifyWebhookMock.mockReturnValue({
      type: 'session.ended',
      data: {
        id: 'evt_unknown'
      }
    });

    const app = await createWebhookApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/clerk/webhooks',
      headers: {
        'svix-id': 'msg_5',
        'svix-timestamp': '1710000004',
        'svix-signature': 'v1,sig_101',
        'content-type': 'application/json'
      },
      payload: '{"id":"evt_5"}'
    });

    expect(response.statusCode).toBe(200);
    expect(executeRawMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();

    await app.close();
  });

  it('clerk webhook route skips Clerk JWT auth', async () => {
    process.env.CLERK_SECRET_KEY = 'sk_clerk_test';

    verifyWebhookMock.mockReturnValue({
      type: 'session.ended',
      data: {
        id: 'evt_auth_skip'
      }
    });

    const app = await createWebhookApp({ withAuthHook: true });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/clerk/webhooks',
      headers: {
        'svix-id': 'msg_6',
        'svix-timestamp': '1710000005',
        'svix-signature': 'v1,sig_102',
        'content-type': 'application/json'
      },
      payload: '{"id":"evt_6"}'
    });

    expect(response.statusCode).toBe(200);
    expect(verifyTokenMock).not.toHaveBeenCalled();

    await app.close();
  });

  it('clerk webhook route skips tenant-resolver hook', async () => {
    verifyWebhookMock.mockReturnValue({
      type: 'session.ended',
      data: {
        id: 'evt_skip_tenant'
      }
    });

    const app = await createWebhookApp({
      withTenantResolverHook: true
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/clerk/webhooks',
      headers: {
        'svix-id': 'msg_7',
        'svix-timestamp': '1710000006',
        'svix-signature': 'v1,sig_103',
        'content-type': 'application/json'
      },
      payload: '{"id":"evt_7"}'
    });

    expect(response.statusCode).toBe(200);
    expect(tenantResolverSpy).not.toHaveBeenCalled();

    await app.close();
  });

  it('clerk webhook route skips subscription-guard hook', async () => {
    verifyWebhookMock.mockReturnValue({
      type: 'session.ended',
      data: {
        id: 'evt_skip_subscription'
      }
    });

    const app = await createWebhookApp({
      withSubscriptionGuardHook: true
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/clerk/webhooks',
      headers: {
        'svix-id': 'msg_8',
        'svix-timestamp': '1710000007',
        'svix-signature': 'v1,sig_104',
        'content-type': 'application/json'
      },
      payload: '{"id":"evt_8"}'
    });

    expect(response.statusCode).toBe(200);
    expect(subscriptionGuardSpy).not.toHaveBeenCalled();

    await app.close();
  });
});
