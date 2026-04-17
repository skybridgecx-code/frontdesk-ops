import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fastify from 'fastify';
import admin from '../admin.js';

const {
  tenantFindManyMock,
  tenantCountMock,
  tenantFindUniqueMock,
  tenantUpdateMock,
  callCountMock,
  callGroupByMock,
  callFindFirstMock,
  callFindManyMock,
  queryRawMock
} = vi.hoisted(() => ({
  tenantFindManyMock: vi.fn(),
  tenantCountMock: vi.fn(),
  tenantFindUniqueMock: vi.fn(),
  tenantUpdateMock: vi.fn(),
  callCountMock: vi.fn(),
  callGroupByMock: vi.fn(),
  callFindFirstMock: vi.fn(),
  callFindManyMock: vi.fn(),
  queryRawMock: vi.fn()
}));

vi.mock('@frontdesk/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@frontdesk/db')>();

  return {
    ...actual,
    prisma: {
      tenant: {
        findMany: tenantFindManyMock,
        count: tenantCountMock,
        findUnique: tenantFindUniqueMock,
        update: tenantUpdateMock
      },
      call: {
        count: callCountMock,
        groupBy: callGroupByMock,
        findFirst: callFindFirstMock,
        findMany: callFindManyMock
      },
      $queryRaw: queryRawMock
    }
  };
});

function createTenant(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tenant_1',
    name: 'Skybridge Plumbing',
    email: 'owner@skybridgecx.co',
    businessName: 'Skybridge Plumbing',
    industry: 'plumbing',
    businessAddress: '123 Main St',
    businessPhone: '+12125550000',
    timezone: 'America/New_York',
    greeting: 'Thanks for calling Skybridge Plumbing!',
    twilioPhoneNumber: '+12125551111',
    onboardingStep: 3,
    onboardingComplete: true,
    plan: 'starter',
    subscriptionStatus: 'active',
    stripeCustomerId: 'cus_123',
    stripeSubscriptionId: 'sub_123',
    slug: 'skybridge-plumbing',
    status: 'active',
    webhookUrl: null,
    webhookSecret: null,
    webhookEnabled: false,
    notifyEmail: true,
    notifySmsMissedCall: true,
    notifyEmailVoicemail: true,
    clerkUserId: 'user_123',
    createdAt: new Date('2026-01-01T12:00:00.000Z'),
    updatedAt: new Date('2026-01-02T12:00:00.000Z'),
    ...overrides
  };
}

function createTenantListItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tenant_1',
    email: 'owner@skybridgecx.co',
    name: 'Skybridge Plumbing',
    businessName: 'Skybridge Plumbing',
    industry: 'plumbing',
    plan: 'starter',
    subscriptionStatus: 'active',
    twilioPhoneNumber: '+12125551111',
    onboardingComplete: true,
    createdAt: new Date('2026-01-01T12:00:00.000Z'),
    _count: {
      calls: 5
    },
    ...overrides
  };
}

async function createApp() {
  const app = fastify({ logger: false });
  await app.register(admin);
  return app;
}

function authHeader(token = 'super_secret') {
  return {
    authorization: `Bearer ${token}`
  };
}

describe('admin routes', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      FRONTDESK_INTERNAL_API_SECRET: 'super_secret'
    };

    tenantFindManyMock.mockReset();
    tenantCountMock.mockReset();
    tenantFindUniqueMock.mockReset();
    tenantUpdateMock.mockReset();
    callCountMock.mockReset();
    callGroupByMock.mockReset();
    callFindFirstMock.mockReset();
    callFindManyMock.mockReset();
    queryRawMock.mockReset();

    tenantFindManyMock.mockResolvedValue([createTenantListItem()]);
    tenantCountMock.mockResolvedValue(1);
    tenantFindUniqueMock.mockResolvedValue(createTenant());
    tenantUpdateMock.mockResolvedValue(createTenant());
    callCountMock.mockResolvedValue(0);
    callGroupByMock.mockResolvedValue([
      {
        tenantId: 'tenant_1',
        _max: {
          createdAt: new Date('2026-04-10T10:00:00.000Z')
        }
      }
    ]);
    callFindFirstMock.mockResolvedValue({ createdAt: new Date('2026-04-10T10:00:00.000Z') });
    callFindManyMock.mockResolvedValue([]);
    queryRawMock.mockResolvedValue([]);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('all admin routes return 401 without auth header', async () => {
    const app = await createApp();

    const requests = [
      { method: 'GET', url: '/v1/admin/tenants' },
      { method: 'GET', url: '/v1/admin/tenants/tenant_1' },
      { method: 'PUT', url: '/v1/admin/tenants/tenant_1', payload: {} },
      { method: 'POST', url: '/v1/admin/tenants/tenant_1/deactivate' },
      { method: 'POST', url: '/v1/admin/tenants/tenant_1/reactivate' },
      { method: 'GET', url: '/v1/admin/metrics/overview' },
      { method: 'GET', url: '/v1/admin/metrics/calls-over-time' },
      { method: 'GET', url: '/v1/admin/metrics/signups-over-time' }
    ] as const;

    for (const request of requests) {
      const response = await app.inject(request);
      expect(response.statusCode).toBe(401);
    }

    await app.close();
  });

  it('all admin routes return 403 with invalid token', async () => {
    const app = await createApp();

    const requests = [
      { method: 'GET', url: '/v1/admin/tenants' },
      { method: 'GET', url: '/v1/admin/tenants/tenant_1' },
      { method: 'PUT', url: '/v1/admin/tenants/tenant_1', payload: {} },
      { method: 'POST', url: '/v1/admin/tenants/tenant_1/deactivate' },
      { method: 'POST', url: '/v1/admin/tenants/tenant_1/reactivate' },
      { method: 'GET', url: '/v1/admin/metrics/overview' },
      { method: 'GET', url: '/v1/admin/metrics/calls-over-time' },
      { method: 'GET', url: '/v1/admin/metrics/signups-over-time' }
    ] as const;

    for (const request of requests) {
      const response = await app.inject({
        ...request,
        headers: authHeader('wrong_secret')
      });
      expect(response.statusCode).toBe(403);
    }

    await app.close();
  });

  it('all admin routes succeed with correct token', async () => {
    const app = await createApp();

    const requests = [
      { method: 'GET', url: '/v1/admin/tenants' },
      { method: 'GET', url: '/v1/admin/tenants/tenant_1' },
      { method: 'PUT', url: '/v1/admin/tenants/tenant_1', payload: {} },
      { method: 'POST', url: '/v1/admin/tenants/tenant_1/deactivate' },
      { method: 'POST', url: '/v1/admin/tenants/tenant_1/reactivate' },
      { method: 'GET', url: '/v1/admin/metrics/overview' },
      { method: 'GET', url: '/v1/admin/metrics/calls-over-time' },
      { method: 'GET', url: '/v1/admin/metrics/signups-over-time' }
    ] as const;

    for (const request of requests) {
      const response = await app.inject({
        ...request,
        headers: authHeader()
      });
      expect(response.statusCode).not.toBe(401);
      expect(response.statusCode).not.toBe(403);
    }

    await app.close();
  });

  it('GET /v1/admin/tenants returns paginated tenant list', async () => {
    tenantCountMock.mockResolvedValueOnce(1);
    tenantFindManyMock.mockResolvedValueOnce([createTenantListItem()]);

    const app = await createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/v1/admin/tenants',
      headers: authHeader()
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      tenants: [
        {
          id: 'tenant_1',
          email: 'owner@skybridgecx.co',
          name: 'Skybridge Plumbing',
          businessName: 'Skybridge Plumbing',
          industry: 'plumbing',
          plan: 'starter',
          subscriptionStatus: 'active',
          twilioPhoneNumber: '+12125551111',
          onboardingComplete: true,
          callCount: 5,
          lastCallAt: '2026-04-10T10:00:00.000Z',
          createdAt: '2026-01-01T12:00:00.000Z'
        }
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1
      }
    });

    await app.close();
  });

  it('GET /v1/admin/tenants applies search filter', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/v1/admin/tenants?search=alice',
      headers: authHeader()
    });

    expect(response.statusCode).toBe(200);
    expect(tenantFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { businessName: { contains: 'alice', mode: 'insensitive' } },
            { email: { contains: 'alice', mode: 'insensitive' } },
            { name: { contains: 'alice', mode: 'insensitive' } }
          ]
        }
      })
    );

    await app.close();
  });

  it('GET /v1/admin/tenants applies plan filter', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/v1/admin/tenants?plan=pro',
      headers: authHeader()
    });

    expect(response.statusCode).toBe(200);
    expect(tenantFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          plan: 'pro'
        }
      })
    );

    await app.close();
  });

  it('GET /v1/admin/tenants applies status filter', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/v1/admin/tenants?status=past_due',
      headers: authHeader()
    });

    expect(response.statusCode).toBe(200);
    expect(tenantFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          subscriptionStatus: 'past_due'
        }
      })
    );

    await app.close();
  });

  it('GET /v1/admin/tenants returns correct pagination metadata and respects page/limit', async () => {
    tenantCountMock.mockResolvedValueOnce(45);

    const app = await createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/v1/admin/tenants?page=2&limit=10',
      headers: authHeader()
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().pagination).toEqual({
      page: 2,
      limit: 10,
      total: 45,
      totalPages: 5
    });
    expect(tenantFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10
      })
    );

    await app.close();
  });

  it('GET /v1/admin/tenants/:tenantId returns full tenant detail with call counts and recent calls', async () => {
    tenantFindUniqueMock.mockResolvedValueOnce(createTenant());
    callCountMock.mockResolvedValueOnce(15).mockResolvedValueOnce(4).mockResolvedValueOnce(3);
    callFindFirstMock.mockResolvedValueOnce({
      createdAt: new Date('2026-04-10T11:00:00.000Z')
    });
    callFindManyMock.mockResolvedValueOnce([
      {
        id: 'call_1',
        tenantId: 'tenant_1',
        callStatus: 'voicemail',
        createdAt: new Date('2026-04-10T11:00:00.000Z')
      }
    ]);

    const app = await createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/v1/admin/tenants/tenant_1',
      headers: authHeader()
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().tenant.callCount).toBe(15);
    expect(response.json().tenant.missedCallCount).toBe(4);
    expect(response.json().tenant.voicemailCount).toBe(3);
    expect(response.json().tenant.lastCallAt).toBe('2026-04-10T11:00:00.000Z');
    expect(response.json().tenant.recentCalls).toHaveLength(1);

    await app.close();
  });

  it('GET /v1/admin/tenants/:tenantId returns 404 for non-existent tenant', async () => {
    tenantFindUniqueMock.mockResolvedValueOnce(null);

    const app = await createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/v1/admin/tenants/tenant_missing',
      headers: authHeader()
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: 'Tenant not found'
    });

    await app.close();
  });

  it('PUT /v1/admin/tenants/:tenantId updates plan successfully', async () => {
    tenantFindUniqueMock.mockResolvedValueOnce(createTenant());
    tenantUpdateMock.mockResolvedValueOnce(createTenant({ plan: 'pro' }));

    const app = await createApp();

    const response = await app.inject({
      method: 'PUT',
      url: '/v1/admin/tenants/tenant_1',
      headers: authHeader(),
      payload: {
        plan: 'pro'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().success).toBe(true);
    expect(response.json().tenant.plan).toBe('pro');
    expect(tenantUpdateMock).toHaveBeenCalledWith({
      where: {
        id: 'tenant_1'
      },
      data: {
        plan: 'pro'
      }
    });

    await app.close();
  });

  it('PUT /v1/admin/tenants/:tenantId returns 400 for invalid plan value', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'PUT',
      url: '/v1/admin/tenants/tenant_1',
      headers: authHeader(),
      payload: {
        plan: 'invalid-plan'
      }
    });

    expect(response.statusCode).toBe(400);

    await app.close();
  });

  it('PUT /v1/admin/tenants/:tenantId returns 400 for invalid subscriptionStatus', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'PUT',
      url: '/v1/admin/tenants/tenant_1',
      headers: authHeader(),
      payload: {
        subscriptionStatus: 'unknown'
      }
    });

    expect(response.statusCode).toBe(400);

    await app.close();
  });

  it('PUT /v1/admin/tenants/:tenantId supports partial updates', async () => {
    tenantFindUniqueMock.mockResolvedValueOnce(createTenant());
    tenantUpdateMock.mockResolvedValueOnce(createTenant({ businessName: 'Updated Name' }));

    const app = await createApp();

    const response = await app.inject({
      method: 'PUT',
      url: '/v1/admin/tenants/tenant_1',
      headers: authHeader(),
      payload: {
        businessName: 'Updated Name'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(tenantUpdateMock).toHaveBeenCalledWith({
      where: {
        id: 'tenant_1'
      },
      data: {
        businessName: 'Updated Name'
      }
    });

    await app.close();
  });

  it('POST /v1/admin/tenants/:tenantId/deactivate sets status inactive and plan free', async () => {
    tenantFindUniqueMock.mockResolvedValueOnce({ id: 'tenant_1' });

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/admin/tenants/tenant_1/deactivate',
      headers: authHeader()
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      success: true,
      deactivated: true
    });
    expect(tenantUpdateMock).toHaveBeenCalledWith({
      where: {
        id: 'tenant_1'
      },
      data: {
        subscriptionStatus: 'inactive',
        plan: 'free'
      }
    });

    await app.close();
  });

  it('POST /v1/admin/tenants/:tenantId/deactivate returns 404 for non-existent tenant', async () => {
    tenantFindUniqueMock.mockResolvedValueOnce(null);

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/admin/tenants/tenant_missing/deactivate',
      headers: authHeader()
    });

    expect(response.statusCode).toBe(404);

    await app.close();
  });

  it('POST /v1/admin/tenants/:tenantId/reactivate reactivates tenant', async () => {
    tenantFindUniqueMock.mockResolvedValueOnce({
      id: 'tenant_1',
      plan: 'starter'
    });

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/admin/tenants/tenant_1/reactivate',
      headers: authHeader()
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      success: true,
      reactivated: true
    });
    expect(tenantUpdateMock).toHaveBeenCalledWith({
      where: {
        id: 'tenant_1'
      },
      data: {
        subscriptionStatus: 'active'
      }
    });

    await app.close();
  });

  it('POST /v1/admin/tenants/:tenantId/reactivate returns 400 if plan is free', async () => {
    tenantFindUniqueMock.mockResolvedValueOnce({
      id: 'tenant_1',
      plan: 'free'
    });

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/admin/tenants/tenant_1/reactivate',
      headers: authHeader()
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'Cannot reactivate tenant on free plan'
    });

    await app.close();
  });

  it('GET /v1/admin/metrics/overview returns counts and MRR breakdown', async () => {
    tenantCountMock
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(40)
      .mockResolvedValueOnce(60)
      .mockResolvedValueOnce(20)
      .mockResolvedValueOnce(15)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(25)
      .mockResolvedValueOnce(18)
      .mockResolvedValueOnce(14)
      .mockResolvedValueOnce(4);

    callCountMock
      .mockResolvedValueOnce(1000)
      .mockResolvedValueOnce(80)
      .mockResolvedValueOnce(300)
      .mockResolvedValueOnce(700)
      .mockResolvedValueOnce(500)
      .mockResolvedValueOnce(200)
      .mockResolvedValueOnce(150)
      .mockResolvedValueOnce(50);

    const app = await createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/v1/admin/metrics/overview',
      headers: authHeader()
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      tenants: {
        total: 100,
        active: 40,
        onPlan: {
          free: 60,
          starter: 20,
          pro: 15,
          enterprise: 5
        },
        signedUpToday: 2,
        signedUpThisWeek: 10,
        signedUpThisMonth: 25
      },
      calls: {
        total: 1000,
        today: 80,
        thisWeek: 300,
        thisMonth: 700,
        byStatus: {
          completed: 500,
          missed: 200,
          voicemail: 150,
          inProgress: 50
        }
      },
      revenue: {
        mrr: 16364,
        breakdown: {
          starter: {
            count: 18,
            revenue: 5382
          },
          pro: {
            count: 14,
            revenue: 6986
          },
          enterprise: {
            count: 4,
            revenue: 3996
          }
        }
      }
    });

    await app.close();
  });

  it('GET /v1/admin/metrics/calls-over-time returns daily data and respects period param', async () => {
    queryRawMock.mockResolvedValueOnce([
      {
        date: '2026-04-09',
        callStatus: 'completed',
        count: 2
      },
      {
        date: '2026-04-09',
        callStatus: 'missed',
        count: 1
      }
    ]);

    const app = await createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/v1/admin/metrics/calls-over-time?period=30d',
      headers: authHeader()
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().period).toBe('30d');
    expect(response.json().data).toHaveLength(30);

    const day = response.json().data.find((row: { date: string }) => row.date === '2026-04-09');
    expect(day).toEqual({
      date: '2026-04-09',
      total: 3,
      completed: 2,
      missed: 1,
      voicemail: 0
    });

    await app.close();
  });

  it('GET /v1/admin/metrics/signups-over-time returns daily signup counts', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T12:00:00.000Z'));
    try {
      queryRawMock.mockResolvedValueOnce([
        {
          date: '2026-04-09',
          count: 4
        }
      ]);

      const app = await createApp();

      const response = await app.inject({
        method: 'GET',
        url: '/v1/admin/metrics/signups-over-time?period=7d',
        headers: authHeader()
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().period).toBe('7d');
      expect(response.json().data).toHaveLength(7);

      const day = response.json().data.find((row: { date: string }) => row.date === '2026-04-09');
      expect(day).toEqual({
        date: '2026-04-09',
        signups: 4
      });

      await app.close();
    } finally {
      vi.useRealTimers();
    }
  });
});
