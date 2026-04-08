import type { FastifyInstance } from 'fastify';
import Stripe from 'stripe';
import { z } from 'zod';
import { getSubscriptionByTenantId } from '../lib/subscription-store.js';

/**
 * Required Stripe environment variables:
 * STRIPE_SECRET_KEY=sk_...
 * STRIPE_WEBHOOK_SECRET=whsec_...
 * STRIPE_PRICE_ID=price_...
 */

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

export async function registerBillingRoutes(app: FastifyInstance) {
  app.post('/v1/billing/create-checkout-session', async (request, reply) => {
    const parsed = tenantBodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        error: parsed.error.flatten()
      });
    }

    const stripe = getStripeClient();
    const stripePriceId = process.env.STRIPE_PRICE_ID;

    if (!stripe || !stripePriceId) {
      return reply.status(500).send({
        ok: false,
        error: 'Stripe billing is not configured'
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
        tenantId: parsed.data.tenantId
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

    const subscription = await getSubscriptionByTenantId(parsed.data.tenantId);

    if (!subscription) {
      return {
        status: 'none'
      };
    }

    return {
      status: formatBillingStatus(subscription.status),
      stripeCustomerId: subscription.stripeCustomerId,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      stripePriceId: subscription.stripePriceId,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      currentPeriodStart: subscription.currentPeriodStart.toISOString(),
      currentPeriodEnd: subscription.currentPeriodEnd.toISOString()
    };
  });
}
