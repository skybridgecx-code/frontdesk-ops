import { Readable } from 'node:stream';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '@frontdesk/db';
import Stripe from 'stripe';
import {
  setSubscriptionCanceledByStripeSubscriptionId,
  upsertSubscriptionByTenant,
  updateSubscriptionByStripeSubscriptionId
} from '../lib/subscription-store.js';
import { getPlanByPriceId, PLAN_KEYS, type PlanKey } from '../lib/plans.js';

type RequestWithRawBody = FastifyRequest & {
  rawBody?: Buffer;
};

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

function getHeaderValue(header: string | string[] | undefined) {
  if (typeof header === 'string') {
    return header;
  }

  if (Array.isArray(header)) {
    return header[0] ?? null;
  }

  return null;
}

async function rawBodyHook(
  request: FastifyRequest,
  _reply: FastifyReply,
  payload: NodeJS.ReadableStream
) {
  const chunks: Buffer[] = [];

  for await (const chunk of payload) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBodyBuffer = Buffer.concat(chunks);
  (request as any).rawBody = rawBodyBuffer;
  return Readable.from(rawBodyBuffer);
}

function getRawBody(request: FastifyRequest) {
  const requestWithRawBody = request as RequestWithRawBody;

  if (Buffer.isBuffer(requestWithRawBody.rawBody)) {
    return requestWithRawBody.rawBody;
  }

  if (Buffer.isBuffer(request.body)) {
    return request.body;
  }

  if (typeof request.body === 'string') {
    return Buffer.from(request.body, 'utf8');
  }

  return Buffer.from(JSON.stringify(request.body ?? {}), 'utf8');
}

function toPlanKey(value: string | null | undefined): PlanKey | null {
  if (!value) {
    return null;
  }

  return PLAN_KEYS.find((key) => key === value) ?? null;
}

function shouldUseProcessedWebhookStore() {
  return (
    process.env.NODE_ENV !== 'test' ||
    process.env.FRONTDESK_ENABLE_WEBHOOK_IDEMPOTENCY_IN_TESTS === 'true'
  );
}

async function findProcessedWebhookEvent(eventId: string) {
  if (!shouldUseProcessedWebhookStore()) {
    return null;
  }

  try {
    return await prisma.processedWebhookEvent.findUnique({
      where: {
        eventId
      }
    });
  } catch {
    return null;
  }
}

async function recordProcessedWebhookEvent(eventId: string, type: string) {
  if (!shouldUseProcessedWebhookStore()) {
    return;
  }

  try {
    await prisma.processedWebhookEvent.create({
      data: {
        eventId,
        type
      }
    });
  } catch {
    // Best-effort idempotency persistence.
  }
}

async function updateTenantFromCheckoutSession(session: Stripe.Checkout.Session) {
  const tenantId = getTenantIdFromMetadata(session.metadata);
  const planKey = toPlanKey(session.metadata?.planKey ?? null);
  const stripeCustomerId = getCustomerId(session.customer);
  const stripeSubscriptionId = getSubscriptionId(session.subscription);

  if (!tenantId || !planKey || !stripeCustomerId || !stripeSubscriptionId) {
    return;
  }

  try {
    await prisma.tenant.update({
      where: {
        id: tenantId
      },
      data: {
        stripeCustomerId,
        stripeSubscriptionId,
        plan: planKey,
        subscriptionStatus: 'active'
      }
    });
  } catch {
    // Tenant update is best-effort for backwards compatibility.
  }
}

async function updateTenantFromSubscription(subscription: Stripe.Subscription) {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: {
        stripeSubscriptionId: subscription.id
      }
    });

    if (!tenant) {
      return;
    }

    const priceId = subscription.items.data[0]?.price?.id ?? '';
    const resolvedPlan = getPlanByPriceId(priceId)?.key ?? tenant.plan;

    await prisma.tenant.update({
      where: {
        id: tenant.id
      },
      data: {
        plan: resolvedPlan,
        subscriptionStatus: toSubscriptionStatus(subscription.status)
      }
    });
  } catch {
    // Tenant update is best-effort for backwards compatibility.
  }
}

async function markTenantSubscriptionDeleted(stripeSubscriptionId: string) {
  try {
    await prisma.tenant.updateMany({
      where: {
        stripeSubscriptionId
      },
      data: {
        plan: 'free',
        subscriptionStatus: 'canceled'
      }
    });
  } catch {
    // Tenant update is best-effort for backwards compatibility.
  }
}

async function markTenantSubscriptionPastDue(stripeSubscriptionId: string) {
  try {
    await prisma.tenant.updateMany({
      where: {
        stripeSubscriptionId
      },
      data: {
        subscriptionStatus: 'past_due'
      }
    });
  } catch {
    // Tenant update is best-effort for backwards compatibility.
  }
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice) {
  const parentSubscription = invoice.parent?.subscription_details?.subscription;

  if (typeof parentSubscription === 'string') {
    return parentSubscription;
  }

  if (parentSubscription && typeof parentSubscription.id === 'string') {
    return parentSubscription.id;
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
    instance.route({
      method: 'POST',
      url: '/v1/stripe/webhooks',
      preParsing: rawBodyHook,
      handler: async (request, reply) => {
        const stripe = getStripeClient();
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        const defaultPriceId = process.env.STRIPE_PRICE_ID_STARTER ?? process.env.STRIPE_PRICE_ID ?? '';

        if (!webhookSecret) {
          return reply.code(500).send({
            error: 'Webhook secret not configured'
          });
        }

        if (!stripe) {
          return reply.code(500).send({
            error: 'Stripe secret key not configured'
          });
        }

        const signature = getHeaderValue(request.headers['stripe-signature']);

        if (!signature) {
          return reply.code(400).send({
            error: 'Invalid signature'
          });
        }

        const rawBody = getRawBody(request);

        let event: Stripe.Event;

        try {
          event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
        } catch {
          return reply.code(400).send({
            error: 'Invalid signature'
          });
        }

        const existing = await findProcessedWebhookEvent(event.id);
        if (existing) {
          return reply.send({
            received: true,
            duplicate: true
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
              planKey: getPlanByPriceId(getPriceId(subscription, defaultPriceId))?.key ?? null,
              status: toSubscriptionStatus(subscription.status),
              currentPeriodStart: toDateFromUnix(periodBounds.currentPeriodStart, new Date()),
              currentPeriodEnd: toDateFromUnix(
                periodBounds.currentPeriodEnd,
                new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
              ),
                cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end)
              });
          }

          await updateTenantFromCheckoutSession(session);
        } else if (event.type === 'customer.subscription.updated') {
          const subscription = event.data.object as Stripe.Subscription;
          const stripeCustomerId = getCustomerId(subscription.customer);
          const periodBounds = getPeriodBounds(subscription);

          if (stripeCustomerId) {
            const updated = await updateSubscriptionByStripeSubscriptionId({
              stripeSubscriptionId: subscription.id,
              stripeCustomerId,
              stripePriceId: getPriceId(subscription, defaultPriceId),
              planKey: getPlanByPriceId(getPriceId(subscription, defaultPriceId))?.key ?? null,
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
                  planKey: getPlanByPriceId(getPriceId(subscription, defaultPriceId))?.key ?? null,
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

          await updateTenantFromSubscription(subscription);
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
                planKey: getPlanByPriceId(getPriceId(subscription, defaultPriceId))?.key ?? null,
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
          await markTenantSubscriptionDeleted(subscription.id);
        } else if (event.type === 'invoice.payment_failed') {
          const invoice = event.data.object as Stripe.Invoice;
          const stripeSubscriptionId = getInvoiceSubscriptionId(invoice);

          if (stripeSubscriptionId) {
            await markTenantSubscriptionPastDue(stripeSubscriptionId);
          }
        }

        await recordProcessedWebhookEvent(event.id, event.type);

        return reply.send({
          received: true
        });
      }
    });
  });
}
