import type { FastifyPluginAsync } from 'fastify';
import type { Prisma } from '@frontdesk/db';
import { prisma } from '@frontdesk/db';
import { z } from 'zod';
import { requireAdminAuth } from '../lib/admin-auth.js';
import { getPlanByKey } from '../lib/plans.js';

const PLAN_VALUES = ['free', 'starter', 'pro', 'enterprise'] as const;
const SUBSCRIPTION_STATUS_VALUES = ['none', 'active', 'canceled', 'past_due', 'inactive'] as const;
const SORT_VALUES = ['created_desc', 'created_asc', 'name_asc', 'name_desc'] as const;
const PERIOD_VALUES = ['7d', '30d', '90d'] as const;

const tenantsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().optional(),
    plan: z.enum(PLAN_VALUES).optional(),
    status: z.enum(SUBSCRIPTION_STATUS_VALUES).optional(),
    sort: z.enum(SORT_VALUES).default('created_desc')
  })
  .strict();

const tenantIdParamsSchema = z
  .object({
    tenantId: z.string().trim().min(1)
  })
  .strict();

const tenantUpdateBodySchema = z
  .object({
    plan: z.enum(PLAN_VALUES).optional(),
    subscriptionStatus: z.enum(SUBSCRIPTION_STATUS_VALUES).optional(),
    onboardingComplete: z.boolean().optional(),
    businessName: z.string().trim().min(1).optional(),
    greeting: z.string().max(500).optional()
  })
  .strict();

const periodQuerySchema = z
  .object({
    period: z.enum(PERIOD_VALUES).default('7d')
  })
  .strict();

type TenantWithCallCount = {
  id: string;
  email: string | null;
  name: string;
  businessName: string | null;
  industry: string | null;
  plan: string;
  subscriptionStatus: string;
  twilioPhoneNumber: string | null;
  onboardingComplete: boolean;
  createdAt: Date;
  _count: {
    calls: number;
  };
};

type DailyCallRow = {
  date: Date | string;
  callStatus: string | null;
  count: number | bigint | string;
};

type DailySignupRow = {
  date: Date | string;
  count: number | bigint | string;
};

function toNumber(value: number | bigint | string) {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getDateKey(value: Date | string) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  return new Date(value).toISOString().slice(0, 10);
}

function getStartOfUtcDay(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function getStartOfUtcWeek(now: Date) {
  const startOfDay = getStartOfUtcDay(now);
  const day = startOfDay.getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;

  const result = new Date(startOfDay);
  result.setUTCDate(result.getUTCDate() - daysSinceMonday);
  return result;
}

function getStartOfUtcMonth(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function getPeriodDays(period: z.infer<typeof periodQuerySchema>['period']) {
  if (period === '30d') {
    return 30;
  }

  if (period === '90d') {
    return 90;
  }

  return 7;
}

function getPeriodStartDate(period: z.infer<typeof periodQuerySchema>['period'], now: Date) {
  const days = getPeriodDays(period);
  const start = getStartOfUtcDay(now);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return start;
}

function buildDateRange(start: Date, days: number) {
  const output: string[] = [];

  for (let index = 0; index < days; index += 1) {
    const value = new Date(start);
    value.setUTCDate(start.getUTCDate() + index);
    output.push(value.toISOString().slice(0, 10));
  }

  return output;
}

function buildTenantWhere(query: z.infer<typeof tenantsQuerySchema>): Prisma.TenantWhereInput {
  const where: Prisma.TenantWhereInput = {};

  if (query.search && query.search.length > 0) {
    where.OR = [
      { businessName: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
      { name: { contains: query.search, mode: 'insensitive' } }
    ];
  }

  if (query.plan) {
    where.plan = query.plan;
  }

  if (query.status) {
    where.subscriptionStatus = query.status;
  }

  return where;
}

function buildTenantOrderBy(
  sort: z.infer<typeof tenantsQuerySchema>['sort']
): Prisma.TenantOrderByWithRelationInput {
  if (sort === 'created_asc') {
    return { createdAt: 'asc' };
  }

  if (sort === 'name_asc') {
    return { name: 'asc' };
  }

  if (sort === 'name_desc') {
    return { name: 'desc' };
  }

  return { createdAt: 'desc' };
}

const admin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', requireAdminAuth);

  fastify.get('/v1/admin/tenants', async (request, reply) => {
    const parsed = tenantsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid tenants query params'
      });
    }

    const where = buildTenantWhere(parsed.data);
    const orderBy = buildTenantOrderBy(parsed.data.sort);
    const page = parsed.data.page;
    const limit = parsed.data.limit;

    const [total, tenants] = await Promise.all([
      prisma.tenant.count({ where }),
      prisma.tenant.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          businessName: true,
          industry: true,
          plan: true,
          subscriptionStatus: true,
          twilioPhoneNumber: true,
          onboardingComplete: true,
          createdAt: true,
          _count: {
            select: {
              calls: true
            }
          }
        }
      })
    ]);

    const tenantIds = tenants.map((tenant) => tenant.id);
    const groupedCalls =
      tenantIds.length > 0
        ? await prisma.call.groupBy({
            by: ['tenantId'],
            where: {
              tenantId: {
                in: tenantIds
              }
            },
            _max: {
              createdAt: true
            }
          })
        : [];

    const lastCallMap = new Map<string, string | null>(
      groupedCalls.map((entry) => [entry.tenantId, entry._max.createdAt?.toISOString() ?? null])
    );

    return {
      tenants: (tenants as TenantWithCallCount[]).map((tenant) => ({
        id: tenant.id,
        email: tenant.email ?? '',
        name: tenant.name,
        businessName: tenant.businessName,
        industry: tenant.industry,
        plan: tenant.plan,
        subscriptionStatus: tenant.subscriptionStatus,
        twilioPhoneNumber: tenant.twilioPhoneNumber,
        onboardingComplete: tenant.onboardingComplete,
        callCount: tenant._count.calls,
        lastCallAt: lastCallMap.get(tenant.id) ?? null,
        createdAt: tenant.createdAt.toISOString()
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    };
  });

  fastify.get('/v1/admin/tenants/:tenantId', async (request, reply) => {
    const params = tenantIdParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({
        error: 'Invalid tenantId'
      });
    }

    const tenant = await prisma.tenant.findUnique({
      where: {
        id: params.data.tenantId
      }
    });

    if (!tenant) {
      return reply.status(404).send({
        error: 'Tenant not found'
      });
    }

    const [callCount, missedCallCount, voicemailCount, lastCall, recentCalls] = await Promise.all([
      prisma.call.count({
        where: {
          tenantId: tenant.id
        }
      }),
      prisma.call.count({
        where: {
          tenantId: tenant.id,
          callStatus: 'missed'
        }
      }),
      prisma.call.count({
        where: {
          tenantId: tenant.id,
          callStatus: 'voicemail'
        }
      }),
      prisma.call.findFirst({
        where: {
          tenantId: tenant.id
        },
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          createdAt: true
        }
      }),
      prisma.call.findMany({
        where: {
          tenantId: tenant.id
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 10
      })
    ]);

    return {
      tenant: {
        ...tenant,
        callCount,
        missedCallCount,
        voicemailCount,
        lastCallAt: lastCall?.createdAt.toISOString() ?? null,
        recentCalls
      }
    };
  });

  fastify.put('/v1/admin/tenants/:tenantId', async (request, reply) => {
    const params = tenantIdParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({
        error: 'Invalid tenantId'
      });
    }

    const parsed = tenantUpdateBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid tenant update payload'
      });
    }

    const existingTenant = await prisma.tenant.findUnique({
      where: {
        id: params.data.tenantId
      }
    });

    if (!existingTenant) {
      return reply.status(404).send({
        error: 'Tenant not found'
      });
    }

    const updates: Prisma.TenantUpdateInput = {};

    if ('plan' in parsed.data && parsed.data.plan !== undefined) {
      updates.plan = parsed.data.plan;
    }

    if (
      'subscriptionStatus' in parsed.data &&
      parsed.data.subscriptionStatus !== undefined
    ) {
      updates.subscriptionStatus = parsed.data.subscriptionStatus;
    }

    if (
      'onboardingComplete' in parsed.data &&
      parsed.data.onboardingComplete !== undefined
    ) {
      updates.onboardingComplete = parsed.data.onboardingComplete;
    }

    if ('businessName' in parsed.data && parsed.data.businessName !== undefined) {
      updates.businessName = parsed.data.businessName;
    }

    if ('greeting' in parsed.data && parsed.data.greeting !== undefined) {
      updates.greeting = parsed.data.greeting;
    }

    if (Object.keys(updates).length === 0) {
      return {
        success: true,
        tenant: existingTenant
      };
    }

    const updatedTenant = await prisma.tenant.update({
      where: {
        id: existingTenant.id
      },
      data: updates
    });

    return {
      success: true,
      tenant: updatedTenant
    };
  });

  fastify.post('/v1/admin/tenants/:tenantId/deactivate', async (request, reply) => {
    const params = tenantIdParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({
        error: 'Invalid tenantId'
      });
    }

    const existingTenant = await prisma.tenant.findUnique({
      where: {
        id: params.data.tenantId
      },
      select: {
        id: true
      }
    });

    if (!existingTenant) {
      return reply.status(404).send({
        error: 'Tenant not found'
      });
    }

    await prisma.tenant.update({
      where: {
        id: existingTenant.id
      },
      data: {
        subscriptionStatus: 'inactive',
        plan: 'free'
      }
    });

    return {
      success: true,
      deactivated: true
    };
  });

  fastify.post('/v1/admin/tenants/:tenantId/reactivate', async (request, reply) => {
    const params = tenantIdParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({
        error: 'Invalid tenantId'
      });
    }

    const existingTenant = await prisma.tenant.findUnique({
      where: {
        id: params.data.tenantId
      },
      select: {
        id: true,
        plan: true
      }
    });

    if (!existingTenant) {
      return reply.status(404).send({
        error: 'Tenant not found'
      });
    }

    if (existingTenant.plan === 'free') {
      return reply.status(400).send({
        error: 'Cannot reactivate tenant on free plan'
      });
    }

    await prisma.tenant.update({
      where: {
        id: existingTenant.id
      },
      data: {
        subscriptionStatus: 'active'
      }
    });

    return {
      success: true,
      reactivated: true
    };
  });

  fastify.get('/v1/admin/metrics/overview', async () => {
    const now = new Date();
    const startOfToday = getStartOfUtcDay(now);
    const startOfWeek = getStartOfUtcWeek(now);
    const startOfMonth = getStartOfUtcMonth(now);

    const [
      tenantTotal,
      tenantActive,
      freeCount,
      starterCount,
      proCount,
      enterpriseCount,
      signedUpToday,
      signedUpThisWeek,
      signedUpThisMonth,
      activeStarterCount,
      activeProCount,
      activeEnterpriseCount,
      totalCalls,
      callsToday,
      callsThisWeek,
      callsThisMonth,
      completedCalls,
      missedCalls,
      voicemailCalls,
      inProgressCalls
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { subscriptionStatus: 'active' } }),
      prisma.tenant.count({ where: { plan: 'free' } }),
      prisma.tenant.count({ where: { plan: 'starter' } }),
      prisma.tenant.count({ where: { plan: 'pro' } }),
      prisma.tenant.count({ where: { plan: 'enterprise' } }),
      prisma.tenant.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.tenant.count({ where: { createdAt: { gte: startOfWeek } } }),
      prisma.tenant.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.tenant.count({ where: { plan: 'starter', subscriptionStatus: 'active' } }),
      prisma.tenant.count({ where: { plan: 'pro', subscriptionStatus: 'active' } }),
      prisma.tenant.count({ where: { plan: 'enterprise', subscriptionStatus: 'active' } }),
      prisma.call.count(),
      prisma.call.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.call.count({ where: { createdAt: { gte: startOfWeek } } }),
      prisma.call.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.call.count({ where: { callStatus: 'completed' } }),
      prisma.call.count({ where: { callStatus: 'missed' } }),
      prisma.call.count({ where: { callStatus: 'voicemail' } }),
      prisma.call.count({ where: { callStatus: 'in-progress' } })
    ]);

    const starterPrice = getPlanByKey('starter').monthlyPrice;
    const proPrice = getPlanByKey('pro').monthlyPrice;
    const enterprisePrice = getPlanByKey('enterprise').monthlyPrice;

    const starterRevenue = activeStarterCount * starterPrice;
    const proRevenue = activeProCount * proPrice;
    const enterpriseRevenue = activeEnterpriseCount * enterprisePrice;

    return {
      tenants: {
        total: tenantTotal,
        active: tenantActive,
        onPlan: {
          free: freeCount,
          starter: starterCount,
          pro: proCount,
          enterprise: enterpriseCount
        },
        signedUpToday,
        signedUpThisWeek,
        signedUpThisMonth
      },
      calls: {
        total: totalCalls,
        today: callsToday,
        thisWeek: callsThisWeek,
        thisMonth: callsThisMonth,
        byStatus: {
          completed: completedCalls,
          missed: missedCalls,
          voicemail: voicemailCalls,
          inProgress: inProgressCalls
        }
      },
      revenue: {
        mrr: starterRevenue + proRevenue + enterpriseRevenue,
        breakdown: {
          starter: {
            count: activeStarterCount,
            revenue: starterRevenue
          },
          pro: {
            count: activeProCount,
            revenue: proRevenue
          },
          enterprise: {
            count: activeEnterpriseCount,
            revenue: enterpriseRevenue
          }
        }
      }
    };
  });

  fastify.get('/v1/admin/metrics/calls-over-time', async (request, reply) => {
    const parsed = periodQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid period query param'
      });
    }

    const now = new Date();
    const days = getPeriodDays(parsed.data.period);
    const startDate = getPeriodStartDate(parsed.data.period, now);

    const rows = await prisma.$queryRaw<DailyCallRow[]>`
      SELECT DATE("createdAt") AS "date", "callStatus" AS "callStatus", COUNT(*)::int AS "count"
      FROM "Call"
      WHERE "createdAt" >= ${startDate}
      GROUP BY DATE("createdAt"), "callStatus"
      ORDER BY DATE("createdAt") ASC
    `;

    const dayKeys = buildDateRange(startDate, days);
    const dataMap = new Map(
      dayKeys.map((date) => [
        date,
        {
          date,
          total: 0,
          completed: 0,
          missed: 0,
          voicemail: 0
        }
      ])
    );

    for (const row of rows) {
      const dateKey = getDateKey(row.date);
      const bucket = dataMap.get(dateKey);
      if (!bucket) {
        continue;
      }

      const count = toNumber(row.count);
      bucket.total += count;

      const normalizedStatus = row.callStatus?.toLowerCase();
      if (normalizedStatus === 'completed') {
        bucket.completed += count;
      }

      if (normalizedStatus === 'missed') {
        bucket.missed += count;
      }

      if (normalizedStatus === 'voicemail') {
        bucket.voicemail += count;
      }
    }

    return {
      period: parsed.data.period,
      data: dayKeys.map((date) => dataMap.get(date))
    };
  });

  fastify.get('/v1/admin/metrics/signups-over-time', async (request, reply) => {
    const parsed = periodQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid period query param'
      });
    }

    const now = new Date();
    const days = getPeriodDays(parsed.data.period);
    const startDate = getPeriodStartDate(parsed.data.period, now);

    const rows = await prisma.$queryRaw<DailySignupRow[]>`
      SELECT DATE("createdAt") AS "date", COUNT(*)::int AS "count"
      FROM "Tenant"
      WHERE "createdAt" >= ${startDate}
      GROUP BY DATE("createdAt")
      ORDER BY DATE("createdAt") ASC
    `;

    const dayKeys = buildDateRange(startDate, days);
    const signupMap = new Map(dayKeys.map((date) => [date, 0]));

    for (const row of rows) {
      signupMap.set(getDateKey(row.date), toNumber(row.count));
    }

    return {
      period: parsed.data.period,
      data: dayKeys.map((date) => ({
        date,
        signups: signupMap.get(date) ?? 0
      }))
    };
  });
};

export default admin;
