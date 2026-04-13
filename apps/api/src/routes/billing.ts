import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '@frontdesk/db';
import Stripe from 'stripe';
import { z } from 'zod';
import { getAllPlans, getPlanByKey, getPlanByPriceId, PLAN_KEYS, type Plan } from '../lib/plans.js';
import { getSubscriptionByTenantId, type SubscriptionRecord } from '../lib/subscription-store.js';
import { getTenantTrialState } from '../lib/tenant-trial.js';

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

type TenantBillingAccount = {
  id: string;
  email: string | null;
  stripeCustomerId: string | null;
};

const TRIAL_LENGTH_DAYS = 14;
const TRIAL_LENGTH_MS = TRIAL_LENGTH_DAYS * 24 * 60 * 60 * 1000;

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

function getDashboardSuccessUrl() {
  return 'https://skybridgecx.co/dashboard?checkout=success';
}

function getBillingCancelUrl() {
  return 'https://skybridgecx.co/billing?checkout=canceled';
}

function getBillingReturnUrl() {
  return 'https://skybridgecx.co/billing';
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

function toTenantBillingAccount(
  tenant: {
    id: string;
    email: string | null;
    stripeCustomerId: string | null;
  } | null
): TenantBillingAccount | null {
  if (!tenant) {
    return null;
  }

  return {
    id: tenant.id,
    email: tenant.email,
    stripeCustomerId: tenant.stripeCustomerId
  };
}

async function findTenantBillingAccount(tenantId: string): Promise<TenantBillingAccount | null> {
  const tenant = await prisma.tenant.findUnique({
    where: {
      id: tenantId
    },
    select: {
      id: true,
      email: true,
      stripeCustomerId: true
    }
  });

  return toTenantBillingAccount(tenant);
}

async function resolveStripeCustomerId(input: {
  stripe: Stripe;
  tenant: TenantBillingAccount;
}) {
  if (input.tenant.stripeCustomerId) {
    return input.tenant.stripeCustomerId;
  }

  const customer = await input.stripe.customers.create({
    ...(input.tenant.email ? { email: input.tenant.email } : {}),
    metadata: {
      tenantId: input.tenant.id
    }
  });

  await prisma.tenant.update({
    where: {
      id: input.tenant.id
    },
    data: {
      stripeCustomerId: customer.id
    }
  });

  return customer.id;
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
  periodStart: Date;
  periodEnd: Date;
}) {
  const [callsThisPeriod, activePhoneNumbers, activeBusinesses] = await Promise.all([
    countCallsForPeriod({
      tenantId: input.tenantId,
      start: input.periodStart,
      end: input.periodEnd
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
  app.post('/v1/billing/checkout', async (request, reply) => {
    const parsed = createCheckoutBodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid plan key'
      });
    }

    if (!enforceTenantMatch(request, reply, parsed.data.tenantId)) {
      return reply;
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return reply.status(503).send({
        error: 'Billing not configured'
      });
    }

    const stripe = getStripeClient();
    if (!stripe) {
      return reply.status(503).send({
        error: 'Billing not configured'
      });
    }

    const selectedPlan = getPlanByKey(parsed.data.planKey);
    const stripePriceId = selectedPlan.stripePriceId;

    if (!selectedPlan || !stripePriceId) {
      return reply.status(400).send({
        error: 'Invalid plan key'
      });
    }

    const tenant = await findTenantBillingAccount(parsed.data.tenantId);
    if (!tenant) {
      return reply.status(404).send({
        error: 'Tenant not found'
      });
    }

    const stripeCustomerId = await resolveStripeCustomerId({
      stripe,
      tenant
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [
        {
          price: stripePriceId,
          quantity: 1
        }
      ],
      metadata: {
        tenantId: tenant.id,
        planKey: selectedPlan.key
      },
      payment_method_collection: 'always',
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          tenantId: tenant.id,
          planKey: selectedPlan.key
        }
      },
      success_url: getDashboardSuccessUrl(),
      cancel_url: getBillingCancelUrl()
    });

    if (!session.url) {
      return reply.status(500).send({
        error: 'Stripe checkout URL is unavailable'
      });
    }

    return {
      url: session.url
    };
  });

  app.post('/v1/billing/portal', async (request, reply) => {
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

    if (!process.env.STRIPE_SECRET_KEY) {
      return reply.status(503).send({
        error: 'Billing not configured'
      });
    }

    const stripe = getStripeClient();
    if (!stripe) {
      return reply.status(503).send({
        error: 'Billing not configured'
      });
    }

    const tenant = await findTenantBillingAccount(parsed.data.tenantId);
    if (!tenant || !tenant.stripeCustomerId) {
      return reply.status(400).send({
        error: 'No billing account found'
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: getBillingReturnUrl()
    });

    return {
      url: session.url
    };
  });

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
      payment_method_collection: 'always',
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          tenantId: parsed.data.tenantId,
          planKey: selectedPlan.key
        }
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
      const tenantTrial = await getTenantTrialState(parsed.data.tenantId);

      if (tenantTrial?.isTrialActive && tenantTrial.trialEndsAt) {
        const trialPlan = getPlanByKey('starter');
        const trialPeriodStart =
          tenantTrial.trialStartedAt ??
          new Date(tenantTrial.trialEndsAt.getTime() - TRIAL_LENGTH_MS);

        const trialUsage = await getUsageSnapshot({
          tenantId: parsed.data.tenantId,
          periodStart: trialPeriodStart,
          periodEnd: tenantTrial.trialEndsAt
        });

        return {
          status: 'trialing',
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          stripePriceId: null,
          cancelAtPeriodEnd: false,
          currentPeriodStart: trialPeriodStart.toISOString(),
          currentPeriodEnd: tenantTrial.trialEndsAt.toISOString(),
          planKey: trialPlan.key,
          planName: trialPlan.name,
          planLimits: {
            callsPerMonth: trialPlan.callsPerMonth,
            maxPhoneNumbers: trialPlan.maxPhoneNumbers,
            maxBusinesses: trialPlan.maxBusinesses
          },
          monthlyPrice: trialPlan.monthlyPrice,
          callsThisPeriod: trialUsage.callsThisPeriod,
          activePhoneNumbers: trialUsage.activePhoneNumbers,
          activeBusinesses: trialUsage.activeBusinesses,
          trialEndsAt: tenantTrial.trialEndsAt.toISOString(),
          trialDaysRemaining: tenantTrial.trialDaysRemaining,
          plans: getAllPlans()
        };
      }

      return {
        status: 'none',
        trialExpired: tenantTrial?.isTrialExpired ?? false,
        trialEndedAt:
          tenantTrial?.isTrialExpired && tenantTrial.trialEndsAt
            ? tenantTrial.trialEndsAt.toISOString()
            : null,
        plans: getAllPlans()
      };
    }

    const plan = resolveSubscriptionPlan(subscription);
    const usage = await getUsageSnapshot({
      tenantId: parsed.data.tenantId,
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd
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
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd
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
