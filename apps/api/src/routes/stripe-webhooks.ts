import type { FastifyInstance } from 'fastify';
import Stripe from 'stripe';
import {
  setSubscriptionCanceledByStripeSubscriptionId,
  upsertSubscriptionByTenant,
  updateSubscriptionByStripeSubscriptionId
} from '../lib/subscription-store.js';

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return null;
  }

  return new Stripe(secretKey);
}

function toDateFromUnix(value: number | null | undefined, fallback: Date) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }

  return new Date(value * 1000);
}

function toSubscriptionStatus(value: string | undefined) {
  return (value ?? 'incomplete').toLowerCase();
}

function getTenantIdFromMetadata(metadata: Stripe.Metadata | null | undefined) {
  const tenantId = metadata?.tenantId;
  return typeof tenantId === 'string' && tenantId.trim().length > 0 ? tenantId.trim() : null;
}

function getCustomerId(value: string | Stripe.Customer | Stripe.DeletedCustomer | null) {
  if (typeof value === 'string') {
    return value;
  }

  if (value && typeof value.id === 'string') {
    return value.id;
  }

  return null;
}

function getSubscriptionId(value: string | Stripe.Subscription | null) {
  if (typeof value === 'string') {
    return value;
  }

  if (value && typeof value.id === 'string') {
    return value.id;
  }

  return null;
}

function getPriceId(subscription: Stripe.Subscription, fallbackPriceId: string) {
  const priceId = subscription.items.data[0]?.price?.id;
  return typeof priceId === 'string' && priceId.length > 0 ? priceId : fallbackPriceId;
}

function getPeriodBounds(subscription: Stripe.Subscription) {
  const starts = subscription.items.data
    .map((item) => item.current_period_start)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const ends = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  return {
    currentPeriodStart: starts.length > 0 ? Math.min(...starts) : null,
    currentPeriodEnd: ends.length > 0 ? Math.max(...ends) : null
  };
}

export async function registerStripeWebhookRoutes(app: FastifyInstance) {
  await app.register(async (instance) => {
    instance.removeAllContentTypeParsers();
    instance.addContentTypeParser('*', { parseAs: 'string' }, (_request, body, done) => {
      done(null, body);
    });

    instance.route({
      method: 'POST',
      url: '/v1/stripe/webhooks',
      config: {
        rawBody: true
      },
      handler: async (request, reply) => {
        const stripe = getStripeClient();
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        const defaultPriceId = process.env.STRIPE_PRICE_ID ?? '';

        if (!stripe || !webhookSecret) {
          return reply.status(500).send({
            ok: false,
            error: 'Stripe webhook is not configured'
          });
        }

        const signatureHeader = request.headers['stripe-signature'];
        const signature = typeof signatureHeader === 'string' ? signatureHeader : '';

        if (!signature) {
          return reply.status(400).send({
            ok: false,
            error: 'Invalid signature'
          });
        }

        const payload =
          typeof request.body === 'string'
            ? request.body
            : Buffer.isBuffer(request.body)
              ? request.body.toString('utf8')
              : JSON.stringify(request.body ?? {});

        let event: Stripe.Event;

        try {
          event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
        } catch {
          return reply.status(400).send({
            ok: false,
            error: 'Invalid signature'
          });
        }

        if (event.type === 'checkout.session.completed') {
          const session = event.data.object as Stripe.Checkout.Session;
          const tenantId = getTenantIdFromMetadata(session.metadata);
          const stripeCustomerId = getCustomerId(session.customer);
          const stripeSubscriptionId = getSubscriptionId(session.subscription);

          if (tenantId && stripeCustomerId && stripeSubscriptionId) {
            const subscription = (await stripe.subscriptions.retrieve(
              stripeSubscriptionId
            )) as Stripe.Subscription;
            const periodBounds = getPeriodBounds(subscription);

            await upsertSubscriptionByTenant({
              tenantId,
              stripeCustomerId,
              stripeSubscriptionId,
              stripePriceId: getPriceId(subscription, defaultPriceId),
              status: toSubscriptionStatus(subscription.status),
              currentPeriodStart: toDateFromUnix(periodBounds.currentPeriodStart, new Date()),
              currentPeriodEnd: toDateFromUnix(
                periodBounds.currentPeriodEnd,
                new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
              ),
              cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end)
            });
          }
        } else if (event.type === 'customer.subscription.updated') {
          const subscription = event.data.object as Stripe.Subscription;
          const stripeCustomerId = getCustomerId(subscription.customer);
          const periodBounds = getPeriodBounds(subscription);

          if (stripeCustomerId) {
            const updated = await updateSubscriptionByStripeSubscriptionId({
              stripeSubscriptionId: subscription.id,
              stripeCustomerId,
              stripePriceId: getPriceId(subscription, defaultPriceId),
              status: toSubscriptionStatus(subscription.status),
              currentPeriodStart: toDateFromUnix(periodBounds.currentPeriodStart, new Date()),
              currentPeriodEnd: toDateFromUnix(
                periodBounds.currentPeriodEnd,
                new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
              ),
              cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end)
            });

            if (!updated) {
              const tenantId = getTenantIdFromMetadata(subscription.metadata);
              if (tenantId) {
                await upsertSubscriptionByTenant({
                  tenantId,
                  stripeCustomerId,
                  stripeSubscriptionId: subscription.id,
                  stripePriceId: getPriceId(subscription, defaultPriceId),
                  status: toSubscriptionStatus(subscription.status),
                  currentPeriodStart: toDateFromUnix(periodBounds.currentPeriodStart, new Date()),
                  currentPeriodEnd: toDateFromUnix(
                    periodBounds.currentPeriodEnd,
                    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                  ),
                  cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end)
                });
              }
            }
          }
        } else if (event.type === 'customer.subscription.deleted') {
          const subscription = event.data.object as Stripe.Subscription;
          const periodBounds = getPeriodBounds(subscription);
          const updated = await setSubscriptionCanceledByStripeSubscriptionId({
            stripeSubscriptionId: subscription.id
          });

          if (!updated) {
            const tenantId = getTenantIdFromMetadata(subscription.metadata);
            const stripeCustomerId = getCustomerId(subscription.customer);

            if (tenantId && stripeCustomerId) {
              await upsertSubscriptionByTenant({
                tenantId,
                stripeCustomerId,
                stripeSubscriptionId: subscription.id,
                stripePriceId: getPriceId(subscription, defaultPriceId),
                status: 'canceled',
                currentPeriodStart: toDateFromUnix(periodBounds.currentPeriodStart, new Date()),
                currentPeriodEnd: toDateFromUnix(
                  periodBounds.currentPeriodEnd,
                  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                ),
                cancelAtPeriodEnd: true
              });
            }
          }
        }

        return reply.status(200).send({
          received: true
        });
      }
    });
  });
}
