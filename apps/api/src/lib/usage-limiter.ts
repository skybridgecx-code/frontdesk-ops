import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import { prisma } from '@frontdesk/db';
import { getPlanByKey, getPlanByPriceId } from './plans.js';
import { getSubscriptionByTenantId, type SubscriptionRecord } from './subscription-store.js';

export type UsageLimitScope = 'calls' | 'phone_numbers' | 'businesses';

type CountRow = {
  count: number | bigint | string;
};

type PhoneTenantRow = {
  tenantId: string;
  isActive: boolean;
};

function toCount(value: CountRow['count']) {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolvePlan(subscription: SubscriptionRecord) {
  if (subscription.planKey) {
    return getPlanByKey(subscription.planKey);
  }

  const planByPriceId = getPlanByPriceId(subscription.stripePriceId);
  return planByPriceId ?? getPlanByKey('starter');
}

function callLimitTwiml() {
  return "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response><Say>We're sorry, this number has reached its monthly call limit. Please try again later.</Say><Hangup/></Response>";
}

async function getCallTenantId(request: FastifyRequest) {
  const body = (request.body ?? {}) as Record<string, string | undefined>;
  const toE164 = body.To;

  if (!toE164) {
    return null;
  }

  const rows = await prisma.$queryRaw<PhoneTenantRow[]>`
    SELECT
      "tenantId",
      "isActive"
    FROM "PhoneNumber"
    WHERE "e164" = ${toE164}
    LIMIT 1
  `;

  const phoneNumber = rows[0];

  if (!phoneNumber || !phoneNumber.isActive) {
    return null;
  }

  return phoneNumber.tenantId;
}

async function countCallsForPeriod(input: {
  tenantId: string;
  start: Date;
  end: Date;
}) {
  const rows = await prisma.$queryRaw<CountRow[]>`
    SELECT COUNT(*)::int AS "count"
    FROM "Call"
    WHERE "tenantId" = ${input.tenantId}
      AND "startedAt" >= ${input.start}
      AND "startedAt" <= ${input.end}
  `;

  return toCount(rows[0]?.count ?? 0);
}

async function countActivePhoneNumbers(tenantId: string) {
  const rows = await prisma.$queryRaw<CountRow[]>`
    SELECT COUNT(*)::int AS "count"
    FROM "PhoneNumber"
    WHERE "tenantId" = ${tenantId}
      AND "isActive" = true
  `;

  return toCount(rows[0]?.count ?? 0);
}

async function countBusinesses(tenantId: string) {
  const rows = await prisma.$queryRaw<CountRow[]>`
    SELECT COUNT(*)::int AS "count"
    FROM "Business"
    WHERE "tenantId" = ${tenantId}
  `;

  return toCount(rows[0]?.count ?? 0);
}

function rejectCallLimit(reply: FastifyReply) {
  reply.header('Content-Type', 'text/xml; charset=utf-8');
  reply.code(429).send(callLimitTwiml());
}

function rejectPhoneNumberLimit(reply: FastifyReply) {
  reply.code(403).send({
    error: 'Phone number limit reached for your plan. Upgrade to add more numbers.'
  });
}

function rejectBusinessLimit(reply: FastifyReply) {
  reply.code(403).send({
    error: 'Business limit reached for your plan. Upgrade to add more locations.'
  });
}

export function enforceUsageLimits(scope: UsageLimitScope): preHandlerHookHandler {
  return async (request, reply) => {
    const tenantId =
      scope === 'calls' ? await getCallTenantId(request) : (request.tenantId ?? null);

    if (!tenantId) {
      return;
    }

    const subscription = await getSubscriptionByTenantId(tenantId);

    // SECURITY (H4, 2026-04-27): if a tenant has no subscription record yet
    // (Stripe webhook hasn't fired, or signup is mid-flight), apply a
    // conservative FREE-tier ceiling rather than skipping enforcement.
    // Previously this returned early and granted unlimited usage, which is a
    // real cost-leak vector for self-serve signups and a race window during
    // Stripe propagation.
    const FREE_PLAN_FALLBACK = {
      callsPerMonth: 25,
      maxPhoneNumbers: 1,
      maxBusinesses: 1
    } as const;
    const plan = subscription ? resolvePlan(subscription) : FREE_PLAN_FALLBACK;

    if (scope === 'calls') {
      if (plan.callsPerMonth === -1) {
        return;
      }

      // For tenants without a subscription, count against a rolling 30-day
      // window starting from the current month boundary so free-plan caps
      // still apply.
      const now = new Date();
      const periodStart = subscription
        ? subscription.currentPeriodStart
        : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const periodEnd = subscription
        ? subscription.currentPeriodEnd
        : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));

      const callsThisPeriod = await countCallsForPeriod({
        tenantId,
        start: periodStart,
        end: periodEnd
      });

      if (callsThisPeriod >= plan.callsPerMonth) {
        rejectCallLimit(reply);
      }

      return;
    }

    if (scope === 'phone_numbers') {
      const activePhoneNumbers = await countActivePhoneNumbers(tenantId);

      if (activePhoneNumbers >= plan.maxPhoneNumbers) {
        rejectPhoneNumberLimit(reply);
      }

      return;
    }

    const activeBusinesses = await countBusinesses(tenantId);

    if (activeBusinesses >= plan.maxBusinesses) {
      rejectBusinessLimit(reply);
    }
  };
}
