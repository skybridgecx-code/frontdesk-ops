import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fastify from 'fastify';
import { prisma } from '@frontdesk/db';
import { enforceClerkAuth, shouldSkipDashboardAuth } from '../lib/clerk-auth.js';
import { resolveTenant } from '../lib/tenant-resolver.js';
import { registerOnboardingRoutes } from '../routes/onboarding.js';

const { verifyTokenMock, subscriptionGuardSpy } = vi.hoisted(() => ({
  verifyTokenMock: vi.fn(),
  subscriptionGuardSpy: vi.fn()
}));

vi.mock('@clerk/backend', () => {
  return {
    verifyToken: verifyTokenMock
  };
});

const queryRawMock = vi.fn<(...args: unknown[]) => Promise<unknown[]>>();

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

async function createApp() {
  const app = fastify({ logger: false });

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

  app.addHook('preHandler', async (request, reply) => {
    if (!process.env.CLERK_SECRET_KEY) {
      return;
    }

    if (shouldSkipTenantResolver(request.url)) {
      return;
    }

    const tenantResolved = await resolveTenant(request, reply);
    if (!tenantResolved) {
      return reply;
    }

    if (shouldSkipSubscriptionGuard(request.url)) {
      return;
    }

    subscriptionGuardSpy(request.url);
    return reply;
  });

  await app.register(registerOnboardingRoutes);
  return app;
}

function mockResolverAndOnboardingRows(input: {
  subscriptionCount: number;
  businessCount: number;
  phoneCount: number;
}) {
  queryRawMock
    .mockResolvedValueOnce([
      {
        tenantId: 'tenant_1',
        role: 'owner'
      }
    ])
    .mockResolvedValueOnce([
      {
        id: 'tenant_1',
        name: 'Tenant One'
      }
    ])
    .mockResolvedValueOnce([
      {
        count: input.subscriptionCount
      }
    ])
    .mockResolvedValueOnce([
      {
        count: input.businessCount
      }
    ])
    .mockResolvedValueOnce([
      {
        count: input.phoneCount
      }
    ]);
}

describe('onboarding status route', () => {
  const originalEnv = { ...process.env };
  let originalQueryRaw: typeof prisma.$queryRaw;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.CLERK_SECRET_KEY = 'sk_clerk_test';

    verifyTokenMock.mockReset();
    queryRawMock.mockReset();
    subscriptionGuardSpy.mockReset();

    verifyTokenMock.mockResolvedValue({
      sub: 'user_123'
    });

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

  it('tenant with subscription + businesses + phone numbers is onboarding complete', async () => {
    mockResolverAndOnboardingRows({
      subscriptionCount: 1,
      businessCount: 1,
      phoneCount: 1
    });

    const app = await createApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/onboarding/status',
      headers: {
        authorization: 'Bearer token_123'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      tenantId: 'tenant_1',
      tenantName: 'Tenant One',
      hasSubscription: true,
      hasBusinesses: true,
      hasPhoneNumbers: true,
      isOnboardingComplete: true
    });

    await app.close();
  });

  it('tenant with no subscription is not onboarding complete', async () => {
    mockResolverAndOnboardingRows({
      subscriptionCount: 0,
      businessCount: 1,
      phoneCount: 1
    });

    const app = await createApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/onboarding/status',
      headers: {
        authorization: 'Bearer token_123'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      tenantId: 'tenant_1',
      tenantName: 'Tenant One',
      hasSubscription: false,
      hasBusinesses: true,
      hasPhoneNumbers: true,
      isOnboardingComplete: false
    });

    await app.close();
  });

  it('tenant with subscription but no phone numbers is not onboarding complete', async () => {
    mockResolverAndOnboardingRows({
      subscriptionCount: 1,
      businessCount: 1,
      phoneCount: 0
    });

    const app = await createApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/onboarding/status',
      headers: {
        authorization: 'Bearer token_123'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      tenantId: 'tenant_1',
      tenantName: 'Tenant One',
      hasSubscription: true,
      hasBusinesses: true,
      hasPhoneNumbers: false,
      isOnboardingComplete: false
    });

    await app.close();
  });

  it('route requires Clerk auth', async () => {
    const app = await createApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/onboarding/status'
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: 'Unauthorized'
    });

    await app.close();
  });

  it('route skips subscription-guard hook', async () => {
    mockResolverAndOnboardingRows({
      subscriptionCount: 1,
      businessCount: 1,
      phoneCount: 1
    });

    const app = await createApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/onboarding/status',
      headers: {
        authorization: 'Bearer token_123'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(subscriptionGuardSpy).not.toHaveBeenCalled();

    await app.close();
  });
});
