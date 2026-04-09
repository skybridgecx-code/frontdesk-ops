import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '@frontdesk/db';
import { z } from 'zod';
import { getPlanByPriceId, type PlanKey } from '../lib/plans.js';
import { getSubscriptionByTenantId } from '../lib/subscription-store.js';

const PERIOD_OPTIONS = ['7d', '30d', '90d', 'custom'] as const;
type AnalyticsPeriod = (typeof PERIOD_OPTIONS)[number];
type BucketGranularity = 'day' | 'week';

const periodQuerySchema = z
  .object({
    period: z.enum(PERIOD_OPTIONS).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional()
  })
  .strict();

type AnalyticsWindow = {
  period: AnalyticsPeriod;
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
  bucketGranularity: BucketGranularity;
};

type RawCallMetricRow = {
  status: string;
  durationSeconds: number | string | bigint | null;
  leadName: string | null;
  textBackSent: boolean | null;
};

type OverviewMetrics = {
  totalCalls: number;
  answeredCalls: number;
  missedCalls: number;
  answerRate: number;
  avgDurationSeconds: number;
  totalLeadsExtracted: number;
  leadConversionRate: number;
  textBacksSent: number;
  textBackRate: number;
};

type MetricChange = {
  previous: number;
  changePct: number;
};

type RawVolumeRow = {
  bucket: Date;
  total: number | string | bigint;
  answered: number | string | bigint;
  missed: number | string | bigint;
};

type RawIntentRow = {
  intent: string;
  count: number | string | bigint;
};

type RawUrgencyRow = {
  urgency: string;
  count: number | string | bigint;
};

type RawHourRow = {
  hour: number | string | bigint;
  count: number | string | bigint;
};

type RawWebhookHealthRow = {
  totalDeliveries: number | string | bigint;
  successfulDeliveries: number | string | bigint;
  failedDeliveries: number | string | bigint;
};

const MISSED_STATUSES = new Set(['NO_ANSWER', 'BUSY', 'CANCELED', 'FAILED']);

function toNumber(value: number | string | bigint | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toPercentage(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return 0;
  }

  return Math.round((numerator / denominator) * 10000) / 100;
}

function toChangePercentage(current: number, previous: number) {
  if (previous === 0) {
    if (current === 0) {
      return 0;
    }

    return 100;
  }

  return Math.round((((current - previous) / Math.abs(previous)) * 100) * 100) / 100;
}

function isAnsweredCall(status: string, durationSeconds: number | null) {
  return status === 'COMPLETED' && (durationSeconds ?? 0) >= 10;
}

function isMissedCall(status: string, durationSeconds: number | null) {
  if (MISSED_STATUSES.has(status)) {
    return true;
  }

  return status === 'COMPLETED' && (durationSeconds ?? 0) < 10;
}

function hasExtractedLead(leadName: string | null) {
  return typeof leadName === 'string' && leadName.trim().length > 0;
}

function startOfUtcDay(input: Date) {
  const value = new Date(input);
  value.setUTCHours(0, 0, 0, 0);
  return value;
}

function startOfUtcWeek(input: Date) {
  const value = startOfUtcDay(input);
  const dayOfWeek = value.getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  value.setUTCDate(value.getUTCDate() - daysSinceMonday);
  return value;
}

function addUtcDays(input: Date, days: number) {
  const value = new Date(input);
  value.setUTCDate(value.getUTCDate() + days);
  return value;
}

function toDateKey(input: Date) {
  return input.toISOString().slice(0, 10);
}

function parseDateParam(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function buildWindow(parsedQuery: z.infer<typeof periodQuerySchema>) {
  const period = parsedQuery.period ?? '30d';
  const now = new Date();

  let start: Date;
  let end: Date;

  if (period === 'custom') {
    const parsedStart = parseDateParam(parsedQuery.startDate);
    const parsedEnd = parseDateParam(parsedQuery.endDate);

    if (!parsedStart || !parsedEnd) {
      return {
        ok: false as const,
        error: 'Custom period requires valid startDate and endDate.'
      };
    }

    if (parsedStart >= parsedEnd) {
      return {
        ok: false as const,
        error: 'startDate must be before endDate.'
      };
    }

    start = parsedStart;
    end = parsedEnd;
  } else {
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    end = now;
    start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  }

  const windowDurationMs = end.getTime() - start.getTime();

  if (windowDurationMs <= 0) {
    return {
      ok: false as const,
      error: 'Invalid date window.'
    };
  }

  const previousEnd = start;
  const previousStart = new Date(start.getTime() - windowDurationMs);

  return {
    ok: true as const,
    window: {
      period,
      start,
      end,
      previousStart,
      previousEnd,
      bucketGranularity: period === '90d' ? 'week' : 'day'
    } satisfies AnalyticsWindow
  };
}

function computeOverviewMetrics(rows: RawCallMetricRow[]): OverviewMetrics {
  let answeredCalls = 0;
  let missedCalls = 0;
  let totalDurationSeconds = 0;
  let totalLeadsExtracted = 0;
  let textBacksSent = 0;

  for (const row of rows) {
    const durationSeconds = row.durationSeconds === null ? null : toNumber(row.durationSeconds);

    if (isAnsweredCall(row.status, durationSeconds)) {
      answeredCalls += 1;
      totalDurationSeconds += durationSeconds ?? 0;
    }

    if (isMissedCall(row.status, durationSeconds)) {
      missedCalls += 1;
    }

    if (hasExtractedLead(row.leadName)) {
      totalLeadsExtracted += 1;
    }

    if (row.textBackSent) {
      textBacksSent += 1;
    }
  }

  const totalCalls = rows.length;

  return {
    totalCalls,
    answeredCalls,
    missedCalls,
    answerRate: toPercentage(answeredCalls, totalCalls),
    avgDurationSeconds: answeredCalls > 0 ? Math.round(totalDurationSeconds / answeredCalls) : 0,
    totalLeadsExtracted,
    leadConversionRate: toPercentage(totalLeadsExtracted, totalCalls),
    textBacksSent,
    textBackRate: toPercentage(textBacksSent, missedCalls)
  };
}

function buildComparedMetrics(current: OverviewMetrics, previous: OverviewMetrics) {
  const comparedToPrevious: Record<keyof OverviewMetrics, MetricChange> = {
    totalCalls: {
      previous: previous.totalCalls,
      changePct: toChangePercentage(current.totalCalls, previous.totalCalls)
    },
    answeredCalls: {
      previous: previous.answeredCalls,
      changePct: toChangePercentage(current.answeredCalls, previous.answeredCalls)
    },
    missedCalls: {
      previous: previous.missedCalls,
      changePct: toChangePercentage(current.missedCalls, previous.missedCalls)
    },
    answerRate: {
      previous: previous.answerRate,
      changePct: toChangePercentage(current.answerRate, previous.answerRate)
    },
    avgDurationSeconds: {
      previous: previous.avgDurationSeconds,
      changePct: toChangePercentage(current.avgDurationSeconds, previous.avgDurationSeconds)
    },
    totalLeadsExtracted: {
      previous: previous.totalLeadsExtracted,
      changePct: toChangePercentage(current.totalLeadsExtracted, previous.totalLeadsExtracted)
    },
    leadConversionRate: {
      previous: previous.leadConversionRate,
      changePct: toChangePercentage(current.leadConversionRate, previous.leadConversionRate)
    },
    textBacksSent: {
      previous: previous.textBacksSent,
      changePct: toChangePercentage(current.textBacksSent, previous.textBacksSent)
    },
    textBackRate: {
      previous: previous.textBackRate,
      changePct: toChangePercentage(current.textBackRate, previous.textBackRate)
    }
  };

  return comparedToPrevious;
}

async function loadCallMetricRows(input: {
  tenantId: string;
  start: Date;
  end: Date;
}) {
  return prisma.$queryRaw<RawCallMetricRow[]>`
    SELECT
      "status",
      "durationSeconds",
      "leadName",
      "textBackSent"
    FROM "Call"
    WHERE "tenantId" = ${input.tenantId}
      AND "createdAt" >= ${input.start}
      AND "createdAt" < ${input.end}
  `;
}

function getTenantId(request: FastifyRequest, reply: FastifyReply) {
  if (request.tenantId) {
    return request.tenantId;
  }

  reply.status(401).send({
    ok: false,
    error: 'Unauthorized'
  });
  return null;
}

function getWindowFromQuery(request: FastifyRequest, reply: FastifyReply) {
  const parsedQuery = periodQuerySchema.safeParse(request.query);

  if (!parsedQuery.success) {
    reply.status(400).send({
      ok: false,
      error: parsedQuery.error.flatten()
    });
    return null;
  }

  const windowResult = buildWindow(parsedQuery.data);
  if (!windowResult.ok) {
    reply.status(400).send({
      ok: false,
      error: windowResult.error
    });
    return null;
  }

  return windowResult.window;
}

function withDateRange(window: AnalyticsWindow) {
  return {
    period: window.period,
    startDate: window.start.toISOString(),
    endDate: window.end.toISOString()
  };
}

function normalizePlanKey(input: string | null): PlanKey {
  if (input === 'pro' || input === 'enterprise') {
    return input;
  }

  if (input === 'starter') {
    return input;
  }

  return 'starter';
}

export async function registerAnalyticsRoutes(app: FastifyInstance) {
  app.get('/v1/analytics/overview', async (request, reply) => {
    const tenantId = getTenantId(request, reply);
    if (!tenantId) {
      return reply;
    }

    const window = getWindowFromQuery(request, reply);
    if (!window) {
      return reply;
    }

    const [currentRows, previousRows] = await Promise.all([
      loadCallMetricRows({
        tenantId,
        start: window.start,
        end: window.end
      }),
      loadCallMetricRows({
        tenantId,
        start: window.previousStart,
        end: window.previousEnd
      })
    ]);

    const currentMetrics = computeOverviewMetrics(currentRows);
    const previousMetrics = computeOverviewMetrics(previousRows);

    return {
      ok: true,
      ...withDateRange(window),
      ...currentMetrics,
      comparedToPrevious: buildComparedMetrics(currentMetrics, previousMetrics)
    };
  });

  app.get('/v1/analytics/call-volume', async (request, reply) => {
    const tenantId = getTenantId(request, reply);
    if (!tenantId) {
      return reply;
    }

    const window = getWindowFromQuery(request, reply);
    if (!window) {
      return reply;
    }

    const rows = window.bucketGranularity === 'week'
      ? await prisma.$queryRaw<RawVolumeRow[]>`
          SELECT
            DATE_TRUNC('week', "createdAt") AS "bucket",
            COUNT(*)::int AS "total",
            SUM(CASE WHEN "status" = 'COMPLETED' AND COALESCE("durationSeconds", 0) >= 10 THEN 1 ELSE 0 END)::int AS "answered",
            SUM(CASE WHEN "status" IN ('NO_ANSWER', 'BUSY', 'CANCELED', 'FAILED') OR ("status" = 'COMPLETED' AND COALESCE("durationSeconds", 0) < 10) THEN 1 ELSE 0 END)::int AS "missed"
          FROM "Call"
          WHERE "tenantId" = ${tenantId}
            AND "createdAt" >= ${window.start}
            AND "createdAt" < ${window.end}
          GROUP BY 1
          ORDER BY 1 ASC
        `
      : await prisma.$queryRaw<RawVolumeRow[]>`
          SELECT
            DATE_TRUNC('day', "createdAt") AS "bucket",
            COUNT(*)::int AS "total",
            SUM(CASE WHEN "status" = 'COMPLETED' AND COALESCE("durationSeconds", 0) >= 10 THEN 1 ELSE 0 END)::int AS "answered",
            SUM(CASE WHEN "status" IN ('NO_ANSWER', 'BUSY', 'CANCELED', 'FAILED') OR ("status" = 'COMPLETED' AND COALESCE("durationSeconds", 0) < 10) THEN 1 ELSE 0 END)::int AS "missed"
          FROM "Call"
          WHERE "tenantId" = ${tenantId}
            AND "createdAt" >= ${window.start}
            AND "createdAt" < ${window.end}
          GROUP BY 1
          ORDER BY 1 ASC
        `;

    const byDate = new Map<string, { total: number; answered: number; missed: number }>();

    for (const row of rows) {
      const dateKey = toDateKey(new Date(row.bucket));
      byDate.set(dateKey, {
        total: toNumber(row.total),
        answered: toNumber(row.answered),
        missed: toNumber(row.missed)
      });
    }

    const buckets: Array<{ date: string; total: number; answered: number; missed: number }> = [];

    if (window.bucketGranularity === 'week') {
      let cursor = startOfUtcWeek(window.start);

      while (cursor < window.end) {
        const dateKey = toDateKey(cursor);
        const existing = byDate.get(dateKey);
        buckets.push({
          date: dateKey,
          total: existing?.total ?? 0,
          answered: existing?.answered ?? 0,
          missed: existing?.missed ?? 0
        });
        cursor = addUtcDays(cursor, 7);
      }
    } else {
      let cursor = startOfUtcDay(window.start);

      while (cursor < window.end) {
        const dateKey = toDateKey(cursor);
        const existing = byDate.get(dateKey);
        buckets.push({
          date: dateKey,
          total: existing?.total ?? 0,
          answered: existing?.answered ?? 0,
          missed: existing?.missed ?? 0
        });
        cursor = addUtcDays(cursor, 1);
      }
    }

    return {
      ok: true,
      ...withDateRange(window),
      granularity: window.bucketGranularity,
      data: buckets
    };
  });

  app.get('/v1/analytics/intents', async (request, reply) => {
    const tenantId = getTenantId(request, reply);
    if (!tenantId) {
      return reply;
    }

    const window = getWindowFromQuery(request, reply);
    if (!window) {
      return reply;
    }

    const rows = await prisma.$queryRaw<RawIntentRow[]>`
      SELECT
        TRIM("leadIntent") AS "intent",
        COUNT(*)::int AS "count"
      FROM "Call"
      WHERE "tenantId" = ${tenantId}
        AND "createdAt" >= ${window.start}
        AND "createdAt" < ${window.end}
        AND "leadIntent" IS NOT NULL
        AND LENGTH(TRIM("leadIntent")) > 0
      GROUP BY 1
      ORDER BY "count" DESC
    `;

    const sorted = rows.map((row) => ({
      intent: row.intent,
      count: toNumber(row.count)
    }));

    const topItems = sorted.slice(0, 10);
    const otherCount = sorted.slice(10).reduce((sum, row) => sum + row.count, 0);

    if (otherCount > 0) {
      topItems.push({
        intent: 'Other',
        count: otherCount
      });
    }

    const totalCount = topItems.reduce((sum, row) => sum + row.count, 0);

    return {
      ok: true,
      ...withDateRange(window),
      data: topItems.map((item) => ({
        intent: item.intent,
        count: item.count,
        percentage: toPercentage(item.count, totalCount)
      }))
    };
  });

  app.get('/v1/analytics/urgency', async (request, reply) => {
    const tenantId = getTenantId(request, reply);
    if (!tenantId) {
      return reply;
    }

    const window = getWindowFromQuery(request, reply);
    if (!window) {
      return reply;
    }

    const rows = await prisma.$queryRaw<RawUrgencyRow[]>`
      SELECT
        TRIM("urgency") AS "urgency",
        COUNT(*)::int AS "count"
      FROM "Call"
      WHERE "tenantId" = ${tenantId}
        AND "createdAt" >= ${window.start}
        AND "createdAt" < ${window.end}
        AND "urgency" IS NOT NULL
        AND LENGTH(TRIM("urgency")) > 0
      GROUP BY 1
      ORDER BY "count" DESC
    `;

    const totalCount = rows.reduce((sum, row) => sum + toNumber(row.count), 0);

    return {
      ok: true,
      ...withDateRange(window),
      data: rows.map((row) => {
        const count = toNumber(row.count);
        return {
          urgency: row.urgency,
          count,
          percentage: toPercentage(count, totalCount)
        };
      })
    };
  });

  app.get('/v1/analytics/peak-hours', async (request, reply) => {
    const tenantId = getTenantId(request, reply);
    if (!tenantId) {
      return reply;
    }

    const window = getWindowFromQuery(request, reply);
    if (!window) {
      return reply;
    }

    const rows = await prisma.$queryRaw<RawHourRow[]>`
      SELECT
        EXTRACT(HOUR FROM "createdAt" AT TIME ZONE 'UTC')::int AS "hour",
        COUNT(*)::int AS "count"
      FROM "Call"
      WHERE "tenantId" = ${tenantId}
        AND "createdAt" >= ${window.start}
        AND "createdAt" < ${window.end}
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    const byHour = new Map<number, number>();
    for (const row of rows) {
      byHour.set(toNumber(row.hour), toNumber(row.count));
    }

    const data = Array.from({ length: 24 }, (_value, hour) => ({
      hour,
      count: byHour.get(hour) ?? 0
    }));

    return {
      ok: true,
      ...withDateRange(window),
      data
    };
  });

  app.get('/v1/analytics/recent-activity', async (request, reply) => {
    const tenantId = getTenantId(request, reply);
    if (!tenantId) {
      return reply;
    }

    const window = getWindowFromQuery(request, reply);
    if (!window) {
      return reply;
    }

    const calls = await prisma.call.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: window.start,
          lt: window.end
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 20,
      select: {
        twilioCallSid: true,
        fromE164: true,
        status: true,
        durationSeconds: true,
        leadName: true,
        leadIntent: true,
        urgency: true,
        textBackSent: true,
        createdAt: true
      }
    });

    return {
      ok: true,
      ...withDateRange(window),
      data: calls.map((call) => ({
        callSid: call.twilioCallSid,
        fromE164: call.fromE164,
        status: call.status,
        durationSeconds: call.durationSeconds,
        extractedName: call.leadName,
        extractedIntent: call.leadIntent,
        extractedUrgency: call.urgency,
        textBackSent: call.textBackSent,
        createdAt: call.createdAt.toISOString()
      }))
    };
  });

  app.get('/v1/analytics/webhook-health', async (request, reply) => {
    const tenantId = getTenantId(request, reply);
    if (!tenantId) {
      return reply;
    }

    const window = getWindowFromQuery(request, reply);
    if (!window) {
      return reply;
    }

    const subscription = await getSubscriptionByTenantId(tenantId);

    const derivedPlanKey = subscription?.planKey
      ? normalizePlanKey(subscription.planKey)
      : subscription
        ? normalizePlanKey(getPlanByPriceId(subscription.stripePriceId)?.key ?? null)
        : 'starter';

    if (derivedPlanKey === 'starter') {
      return {
        ok: true,
        ...withDateRange(window),
        available: false,
        totalDeliveries: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        successRate: 0
      };
    }

    const rows = await prisma.$queryRaw<RawWebhookHealthRow[]>`
      SELECT
        COUNT(*)::int AS "totalDeliveries",
        SUM(CASE WHEN d."responseStatus" >= 200 AND d."responseStatus" < 300 THEN 1 ELSE 0 END)::int AS "successfulDeliveries",
        SUM(CASE WHEN d."failedAt" IS NOT NULL OR (d."responseStatus" IS NOT NULL AND (d."responseStatus" < 200 OR d."responseStatus" >= 300)) THEN 1 ELSE 0 END)::int AS "failedDeliveries"
      FROM "WebhookDelivery" d
      INNER JOIN "WebhookEndpoint" e ON e."id" = d."webhookEndpointId"
      WHERE e."tenantId" = ${tenantId}
        AND d."createdAt" >= ${window.start}
        AND d."createdAt" < ${window.end}
    `;

    const row = rows[0] ?? {
      totalDeliveries: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0
    };

    const totalDeliveries = toNumber(row.totalDeliveries);
    const successfulDeliveries = toNumber(row.successfulDeliveries);
    const failedDeliveries = toNumber(row.failedDeliveries);

    return {
      ok: true,
      ...withDateRange(window),
      available: true,
      totalDeliveries,
      successfulDeliveries,
      failedDeliveries,
      successRate: toPercentage(successfulDeliveries, totalDeliveries)
    };
  });

}
