import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '@frontdesk/db';
import Stripe from 'stripe';
import { z } from 'zod';
import { getAllPlans, getPlanByKey, getPlanByPriceId, PLAN_KEYS, type Plan } from '../lib/plans.js';
import { getSubscriptionByTenantId, type SubscriptionRecord } from '../lib/subscription-store.js';

/**
 * Required Stripe environment variables:
 * STRIPE_SECRET_KEY=sk_...
 * STRIPE_WEBHOOK_SECRET=whsec_...
 * STRIPE_PRICE_ID_STARTER=price_...
 * STRIPE_PRICE_ID_PRO=price_...
 * STRIPE_PRICE_ID_ENTERPRISE=price_...
 */

type CountRow = {
  count: number | bigint | string;
};

const createCheckoutBodySchema = z
  .object({
    tenantId: z.string().min(1),
    planKey: z.enum(PLAN_KEYS)
  })
  .strict();

const tenantBodySchema = z
  .object({
    tenantId: z.string().min(1)
  })
  .strict();

const tenantParamsSchema = z
  .object({
    tenantId: z.string().min(1)
  })
  .strict();

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return null;
  }

  return new Stripe(secretKey);
}

function getWebBaseUrl() {
  return (process.env.FRONTDESK_WEB_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

function formatBillingStatus(status: string) {
  return status.toLowerCase();
}

function enforceTenantMatch(
  request: FastifyRequest,
  reply: FastifyReply,
  tenantId: string
) {
  if (!request.tenantId) {
    return true;
  }

  if (request.tenantId !== tenantId) {
    reply.status(403).send({
      error: 'Forbidden'
    });
    return false;
  }

  return true;
}

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

function resolveSubscriptionPlan(subscription: SubscriptionRecord): Plan {
  if (subscription.planKey) {
    return getPlanByKey(subscription.planKey);
  }

  const planFromPrice = getPlanByPriceId(subscription.stripePriceId);
  return planFromPrice ?? getPlanByKey('starter');
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

async function getUsageSnapshot(input: {
  tenantId: string;
  subscription: SubscriptionRecord;
}) {
  const [callsThisPeriod, activePhoneNumbers, activeBusinesses] = await Promise.all([
    countCallsForPeriod({
      tenantId: input.tenantId,
      start: input.subscription.currentPeriodStart,
      end: input.subscription.currentPeriodEnd
    }),
    countActivePhoneNumbers(input.tenantId),
    countBusinesses(input.tenantId)
  ]);

  return {
    callsThisPeriod,
    activePhoneNumbers,
    activeBusinesses
  };
}

export async function registerBillingRoutes(app: FastifyInstance) {
  app.post('/v1/billing/create-checkout-session', async (request, reply) => {
    const parsed = createCheckoutBodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        error: parsed.error.flatten()
      });
    }

    if (!enforceTenantMatch(request, reply, parsed.data.tenantId)) {
      return reply;
    }

    const stripe = getStripeClient();
    const selectedPlan = getPlanByKey(parsed.data.planKey);
    const stripePriceId = selectedPlan.stripePriceId;

    if (!stripe || !stripePriceId) {
      return reply.status(500).send({
        ok: false,
        error: 'Stripe billing is not configured for the selected plan'
      });
    }

    const existingSubscription = await getSubscriptionByTenantId(parsed.data.tenantId);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          price: stripePriceId,
          quantity: 1
        }
      ],
      success_url: `${getWebBaseUrl()}/billing?checkout=success`,
      cancel_url: `${getWebBaseUrl()}/billing?checkout=cancel`,
      metadata: {
        tenantId: parsed.data.tenantId,
        planKey: selectedPlan.key
      },
      ...(existingSubscription
        ? {
            customer: existingSubscription.stripeCustomerId
          }
        : {})
    });

    if (!session.url) {
      return reply.status(500).send({
        ok: false,
        error: 'Stripe checkout URL is unavailable'
      });
    }

    return {
      url: session.url
    };
  });

  app.post('/v1/billing/create-portal-session', async (request, reply) => {
    const parsed = tenantBodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        error: parsed.error.flatten()
      });
    }

    if (!enforceTenantMatch(request, reply, parsed.data.tenantId)) {
      return reply;
    }

    const stripe = getStripeClient();

    if (!stripe) {
      return reply.status(500).send({
        ok: false,
        error: 'Stripe billing is not configured'
      });
    }

    const subscription = await getSubscriptionByTenantId(parsed.data.tenantId);

    if (!subscription) {
      return reply.status(404).send({
        ok: false,
        error: 'Subscription not found'
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${getWebBaseUrl()}/billing`
    });

    return {
      url: session.url
    };
  });

  app.get('/v1/billing/status/:tenantId', async (request, reply) => {
    const parsed = tenantParamsSchema.safeParse(request.params);

    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        error: parsed.error.flatten()
      });
    }

    if (!enforceTenantMatch(request, reply, parsed.data.tenantId)) {
      return reply;
    }

    const subscription = await getSubscriptionByTenantId(parsed.data.tenantId);

    if (!subscription) {
      return {
        status: 'none',
        plans: getAllPlans()
      };
    }

    const plan = resolveSubscriptionPlan(subscription);
    const usage = await getUsageSnapshot({
      tenantId: parsed.data.tenantId,
      subscription
    });

    return {
      status: formatBillingStatus(subscription.status),
      stripeCustomerId: subscription.stripeCustomerId,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      stripePriceId: subscription.stripePriceId,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      currentPeriodStart: subscription.currentPeriodStart.toISOString(),
      currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
      planKey: plan.key,
      planName: plan.name,
      planLimits: {
        callsPerMonth: plan.callsPerMonth,
        maxPhoneNumbers: plan.maxPhoneNumbers,
        maxBusinesses: plan.maxBusinesses
      },
      monthlyPrice: plan.monthlyPrice,
      callsThisPeriod: usage.callsThisPeriod,
      activePhoneNumbers: usage.activePhoneNumbers,
      activeBusinesses: usage.activeBusinesses,
      plans: getAllPlans()
    };
  });

  app.get('/v1/billing/usage/:tenantId', async (request, reply) => {
    const parsed = tenantParamsSchema.safeParse(request.params);

    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        error: parsed.error.flatten()
      });
    }

    if (!enforceTenantMatch(request, reply, parsed.data.tenantId)) {
      return reply;
    }

    const subscription = await getSubscriptionByTenantId(parsed.data.tenantId);

    if (!subscription) {
      return reply.status(404).send({
        ok: false,
        error: 'Subscription not found'
      });
    }

    const plan = resolveSubscriptionPlan(subscription);
    const usage = await getUsageSnapshot({
      tenantId: parsed.data.tenantId,
      subscription
    });

    return {
      planKey: plan.key,
      planName: plan.name,
      callsThisPeriod: usage.callsThisPeriod,
      callsLimit: plan.callsPerMonth,
      activePhoneNumbers: usage.activePhoneNumbers,
      phoneNumberLimit: plan.maxPhoneNumbers,
      activeBusinesses: usage.activeBusinesses,
      businessLimit: plan.maxBusinesses,
      periodStart: subscription.currentPeriodStart.toISOString(),
      periodEnd: subscription.currentPeriodEnd.toISOString()
    };
  });
}
