import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@frontdesk/db';
import { z } from 'zod';
import { dispatchWebhookToEndpoint } from '../lib/webhook-dispatcher.js';
import { WEBHOOK_EVENTS, isWebhookEventType } from '../lib/webhook-events.js';
import { getPlanByKey, getPlanByPriceId } from '../lib/plans.js';
import { getSubscriptionByTenantId } from '../lib/subscription-store.js';

const idParamsSchema = z
  .object({
    id: z.string().min(1)
  })
  .strict();

const createWebhookBodySchema = z
  .object({
    url: z.string().url(),
    events: z.array(z.string().min(1)).min(1),
    description: z.string().max(240).nullable().optional()
  })
  .strict();

const updateWebhookBodySchema = z
  .object({
    url: z.string().url().optional(),
    events: z.array(z.string().min(1)).min(1).optional(),
    isActive: z.boolean().optional(),
    description: z.string().max(240).nullable().optional()
  })
  .strict();

function getTenantIdOrUnauthorized(tenantId: string | undefined) {
  return tenantId ?? null;
}

function isWebhookUrlAllowed(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);

    if (parsed.protocol === 'https:') {
      return true;
    }

    const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';

    if (process.env.NODE_ENV === 'development' && parsed.protocol === 'http:' && isLocalhost) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

function normalizeEvents(input: string[]) {
  const unique = [...new Set(input.map((event) => event.trim()).filter(Boolean))];

  if (unique.length === 0) {
    return {
      ok: false as const,
      error: 'At least one event is required.'
    };
  }

  const invalidEvents = unique.filter((event) => !isWebhookEventType(event));

  if (invalidEvents.length > 0) {
    return {
      ok: false as const,
      error: `Invalid event types: ${invalidEvents.join(', ')}`
    };
  }

  return {
    ok: true as const,
    events: unique
  };
}

function resolvePlanKey(subscription: {
  planKey: string | null;
  stripePriceId: string;
}) {
  if (subscription.planKey === 'starter' || subscription.planKey === 'pro' || subscription.planKey === 'enterprise') {
    return subscription.planKey;
  }

  const byPriceId = getPlanByPriceId(subscription.stripePriceId);
  return byPriceId?.key ?? 'starter';
}

async function canUseWebhooks(tenantId: string) {
  const subscription = await getSubscriptionByTenantId(tenantId);

  if (!subscription) {
    return false;
  }

  const planKey = resolvePlanKey(subscription);
  const plan = getPlanByKey(planKey);

  return plan.key === 'pro' || plan.key === 'enterprise';
}

function buildTestPayload(input: { tenantId: string; endpointId: string }) {
  return {
    tenantId: input.tenantId,
    sample: true,
    callSid: 'CA_TEST_123',
    businessName: 'Demo HVAC Co',
    leadName: 'Pat Jordan',
    leadPhone: '+17035550123',
    leadIntent: 'Emergency AC repair',
    urgency: 'high'
  };
}

export async function registerWebhookEndpointRoutes(app: FastifyInstance) {
  app.get('/v1/webhooks', async (request, reply) => {
    const tenantId = getTenantIdOrUnauthorized(request.tenantId);

    if (!tenantId) {
      return reply.status(401).send({
        ok: false,
        error: 'Unauthorized'
      });
    }

    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        url: true,
        secret: true,
        events: true,
        isActive: true,
        description: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return {
      ok: true,
      events: WEBHOOK_EVENTS,
      endpoints
    };
  });

  app.post('/v1/webhooks', async (request, reply) => {
    const tenantId = getTenantIdOrUnauthorized(request.tenantId);

    if (!tenantId) {
      return reply.status(401).send({
        ok: false,
        error: 'Unauthorized'
      });
    }

    const hasWebhookAccess = await canUseWebhooks(tenantId);

    if (!hasWebhookAccess) {
      return reply.status(403).send({
        ok: false,
        error: 'Webhooks are available on Pro and Enterprise plans.'
      });
    }

    const parsed = createWebhookBodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        error: parsed.error.flatten()
      });
    }

    if (!isWebhookUrlAllowed(parsed.data.url)) {
      return reply.status(400).send({
        ok: false,
        error: 'Webhook URL must be HTTPS. HTTP is only allowed for localhost in development.'
      });
    }

    const normalizedEvents = normalizeEvents(parsed.data.events);

    if (!normalizedEvents.ok) {
      return reply.status(400).send({
        ok: false,
        error: normalizedEvents.error
      });
    }

    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        tenantId,
        url: parsed.data.url.trim(),
        secret: randomBytes(32).toString('hex'),
        events: normalizedEvents.events,
        description: parsed.data.description?.trim() || null
      },
      select: {
        id: true,
        url: true,
        secret: true,
        events: true,
        isActive: true,
        description: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return {
      ok: true,
      endpoint
    };
  });

  app.patch('/v1/webhooks/:id', async (request, reply) => {
    const tenantId = getTenantIdOrUnauthorized(request.tenantId);

    if (!tenantId) {
      return reply.status(401).send({
        ok: false,
        error: 'Unauthorized'
      });
    }

    const params = idParamsSchema.safeParse(request.params);

    if (!params.success) {
      return reply.status(400).send({
        ok: false,
        error: params.error.flatten()
      });
    }

    const parsed = updateWebhookBodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        error: parsed.error.flatten()
      });
    }

    const existing = await prisma.webhookEndpoint.findFirst({
      where: {
        id: params.data.id,
        tenantId
      },
      select: {
        id: true
      }
    });

    if (!existing) {
      return reply.notFound(`Webhook endpoint not found for id=${params.data.id}`);
    }

    if (parsed.data.url && !isWebhookUrlAllowed(parsed.data.url)) {
      return reply.status(400).send({
        ok: false,
        error: 'Webhook URL must be HTTPS. HTTP is only allowed for localhost in development.'
      });
    }

    let nextEvents: string[] | undefined;

    if (parsed.data.events) {
      const normalizedEvents = normalizeEvents(parsed.data.events);

      if (!normalizedEvents.ok) {
        return reply.status(400).send({
          ok: false,
          error: normalizedEvents.error
        });
      }

      nextEvents = normalizedEvents.events;
    }

    const endpoint = await prisma.webhookEndpoint.update({
      where: {
        id: existing.id
      },
      data: {
        ...(parsed.data.url !== undefined ? { url: parsed.data.url.trim() } : {}),
        ...(nextEvents !== undefined ? { events: nextEvents } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
        ...(parsed.data.description !== undefined ? { description: parsed.data.description?.trim() || null } : {})
      },
      select: {
        id: true,
        url: true,
        secret: true,
        events: true,
        isActive: true,
        description: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return {
      ok: true,
      endpoint
    };
  });

  app.delete('/v1/webhooks/:id', async (request, reply) => {
    const tenantId = getTenantIdOrUnauthorized(request.tenantId);

    if (!tenantId) {
      return reply.status(401).send({
        ok: false,
        error: 'Unauthorized'
      });
    }

    const params = idParamsSchema.safeParse(request.params);

    if (!params.success) {
      return reply.status(400).send({
        ok: false,
        error: params.error.flatten()
      });
    }

    const existing = await prisma.webhookEndpoint.findFirst({
      where: {
        id: params.data.id,
        tenantId
      },
      select: {
        id: true
      }
    });

    if (!existing) {
      return reply.notFound(`Webhook endpoint not found for id=${params.data.id}`);
    }

    await prisma.webhookEndpoint.delete({
      where: {
        id: existing.id
      }
    });

    return {
      ok: true
    };
  });

  app.post('/v1/webhooks/:id/test', async (request, reply) => {
    const tenantId = getTenantIdOrUnauthorized(request.tenantId);

    if (!tenantId) {
      return reply.status(401).send({
        ok: false,
        error: 'Unauthorized'
      });
    }

    const params = idParamsSchema.safeParse(request.params);

    if (!params.success) {
      return reply.status(400).send({
        ok: false,
        error: params.error.flatten()
      });
    }

    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: {
        id: params.data.id,
        tenantId
      },
      select: {
        id: true,
        tenantId: true,
        url: true,
        secret: true,
        events: true,
        isActive: true
      }
    });

    if (!endpoint) {
      return reply.notFound(`Webhook endpoint not found for id=${params.data.id}`);
    }

    const result = await dispatchWebhookToEndpoint({
      endpoint,
      eventType: 'test',
      payload: buildTestPayload({
        tenantId,
        endpointId: endpoint.id
      })
    });

    return {
      ok: true,
      result
    };
  });

  app.get('/v1/webhooks/:id/deliveries', async (request, reply) => {
    const tenantId = getTenantIdOrUnauthorized(request.tenantId);

    if (!tenantId) {
      return reply.status(401).send({
        ok: false,
        error: 'Unauthorized'
      });
    }

    const params = idParamsSchema.safeParse(request.params);

    if (!params.success) {
      return reply.status(400).send({
        ok: false,
        error: params.error.flatten()
      });
    }

    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: {
        id: params.data.id,
        tenantId
      },
      select: {
        id: true
      }
    });

    if (!endpoint) {
      return reply.notFound(`Webhook endpoint not found for id=${params.data.id}`);
    }

    const deliveries = await prisma.webhookDelivery.findMany({
      where: {
        webhookEndpointId: endpoint.id
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50,
      select: {
        id: true,
        eventType: true,
        responseStatus: true,
        responseBody: true,
        deliveredAt: true,
        failedAt: true,
        attempts: true,
        createdAt: true
      }
    });

    return {
      ok: true,
      deliveries
    };
  });
}
