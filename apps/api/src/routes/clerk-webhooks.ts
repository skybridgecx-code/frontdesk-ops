import { randomUUID } from 'node:crypto';
import type { FastifyBaseLogger, FastifyInstance } from 'fastify';
import { prisma } from '@frontdesk/db';
import { Webhook } from 'svix';

/**
 * Required Clerk environment variables:
 * CLERK_WEBHOOK_SECRET=whsec_... (from Clerk Dashboard -> Webhooks)
 */

type ClerkWebhookEvent = {
  type: string;
  data: Record<string, unknown>;
};

type ClerkUserCreatedData = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
};

type TenantUserRow = {
  tenantId: string;
};

function toBodyString(body: unknown) {
  if (typeof body === 'string') {
    return body;
  }

  if (Buffer.isBuffer(body)) {
    return body.toString('utf8');
  }

  return JSON.stringify(body ?? {});
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

function getString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function toEvent(payload: unknown): ClerkWebhookEvent | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const eventCandidate = payload as { type?: unknown; data?: unknown };
  const type = getString(eventCandidate.type);

  if (!type || !eventCandidate.data || typeof eventCandidate.data !== 'object') {
    return null;
  }

  return {
    type,
    data: eventCandidate.data as Record<string, unknown>
  };
}

function toEmailAddress(data: Record<string, unknown>) {
  const emailAddresses = data.email_addresses;
  if (!Array.isArray(emailAddresses)) {
    return null;
  }

  const primaryId = getString(data.primary_email_address_id);

  const candidates = emailAddresses
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      id: getString(item.id),
      email: getString(item.email_address)
    }))
    .filter((item) => item.email);

  if (candidates.length === 0) {
    return null;
  }

  if (primaryId) {
    const primary = candidates.find((item) => item.id === primaryId);
    if (primary?.email) {
      return primary.email.toLowerCase();
    }
  }

  const firstEmail = candidates[0]?.email;
  return firstEmail ? firstEmail.toLowerCase() : null;
}

function toUserCreatedData(data: Record<string, unknown>): ClerkUserCreatedData | null {
  const id = getString(data.id);

  if (!id) {
    return null;
  }

  return {
    id,
    firstName: getString(data.first_name),
    lastName: getString(data.last_name),
    email: toEmailAddress(data)
  };
}

function toUserDeletedId(data: Record<string, unknown>) {
  return getString(data.id);
}

function titleCase(value: string) {
  return value
    .split(/[\s._-]+/)
    .filter((part) => part.length > 0)
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1).toLowerCase()}`)
    .join(' ')
    .trim();
}

function deriveTenantName(user: ClerkUserCreatedData) {
  const fullName = [user.firstName, user.lastName].filter((part) => Boolean(part)).join(' ').trim();
  if (fullName.length > 0) {
    return fullName;
  }

  if (user.firstName) {
    return `${user.firstName}'s Business`;
  }

  if (user.email) {
    const prefix = user.email.split('@')[0] ?? 'business';
    const normalizedPrefix = titleCase(prefix);
    if (normalizedPrefix.length > 0) {
      return `${normalizedPrefix} Business`;
    }
  }

  return 'SkybridgeCX Business';
}

function toSlugBase(value: string) {
  const base = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return base.length > 0 ? base : 'tenant';
}

function createTenantSlug(name: string) {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 4);
  return `${toSlugBase(name)}-${suffix}`;
}

const DEFAULT_AGENT_PROMPT =
  'You are the AI front desk for a home-services team focused on HVAC calls. Capture caller name, phone, service need, urgency, and service address. Keep responses concise, professional, and helpful while routing urgent issues quickly.';

async function handleUserCreated(data: Record<string, unknown>, logger: FastifyBaseLogger) {
  const user = toUserCreatedData(data);

  if (!user) {
    logger.warn('Received user.created webhook without valid user payload.');
    return;
  }

  const existingTenantUsers = await prisma.$queryRaw<TenantUserRow[]>`
    SELECT "tenantId"
    FROM "TenantUser"
    WHERE "clerkUserId" = ${user.id}
    LIMIT 1
  `;

  if (existingTenantUsers.length > 0) {
    logger.info({ clerkUserId: user.id }, 'Tenant provisioning skipped; Clerk user already provisioned.');
    return;
  }

  const tenantName = deriveTenantName(user);
  const tenantSlug = createTenantSlug(tenantName);
  const tenantId = randomUUID();
  const businessId = randomUUID();
  const businessSlug = `${toSlugBase(tenantName)}-main`;
  const agentProfileId = randomUUID();

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO "Tenant" (
        "id",
        "name",
        "slug",
        "status",
        "createdAt",
        "updatedAt"
      ) VALUES (
        ${tenantId},
        ${tenantName},
        ${tenantSlug},
        'active',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `;

    await tx.$executeRaw`
      INSERT INTO "TenantUser" (
        "id",
        "clerkUserId",
        "tenantId",
        "role",
        "createdAt",
        "updatedAt"
      ) VALUES (
        ${randomUUID()},
        ${user.id},
        ${tenantId},
        'owner',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `;

    await tx.$executeRaw`
      INSERT INTO "Business" (
        "id",
        "tenantId",
        "name",
        "slug",
        "vertical",
        "timezone",
        "isDefault",
        "createdAt",
        "updatedAt"
      ) VALUES (
        ${businessId},
        ${tenantId},
        ${tenantName},
        ${businessSlug},
        'HVAC',
        'America/New_York',
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `;

    await tx.$executeRaw`
      INSERT INTO "AgentProfile" (
        "id",
        "tenantId",
        "businessId",
        "name",
        "channel",
        "language",
        "voiceName",
        "systemPrompt",
        "isActive",
        "createdAt",
        "updatedAt"
      ) VALUES (
        ${agentProfileId},
        ${tenantId},
        ${businessId},
        'Default Voice Agent',
        'VOICE',
        'en',
        'alloy',
        ${DEFAULT_AGENT_PROMPT},
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `;
  });

  logger.info(
    {
      clerkUserId: user.id,
      tenantId,
      tenantSlug,
      businessId,
      agentProfileId
    },
    'Provisioned tenant for new Clerk user.'
  );
}

async function handleUserDeleted(data: Record<string, unknown>, logger: FastifyBaseLogger) {
  const clerkUserId = toUserDeletedId(data);

  if (!clerkUserId) {
    logger.warn('Received user.deleted webhook without valid user id.');
    return;
  }

  const deletedCount = await prisma.$executeRaw`
    DELETE FROM "TenantUser"
    WHERE "clerkUserId" = ${clerkUserId}
  `;

  logger.info(
    {
      clerkUserId,
      deletedCount: Number(deletedCount)
    },
    'Removed tenant association for deleted Clerk user.'
  );
}

export async function registerClerkWebhookRoutes(app: FastifyInstance) {
  await app.register(async (instance) => {
    instance.removeAllContentTypeParsers();
    instance.addContentTypeParser('*', { parseAs: 'string' }, (_request, body, done) => {
      done(null, body);
    });

    instance.route({
      method: 'POST',
      url: '/v1/clerk/webhooks',
      config: {
        rawBody: true
      },
      handler: async (request, reply) => {
        const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

        if (!webhookSecret) {
          return reply.status(500).send({
            ok: false,
            error: 'Clerk webhook is not configured'
          });
        }

        const svixId = getHeaderValue(request.headers['svix-id']);
        const svixTimestamp = getHeaderValue(request.headers['svix-timestamp']);
        const svixSignature = getHeaderValue(request.headers['svix-signature']);

        if (!svixId || !svixTimestamp || !svixSignature) {
          return reply.status(400).send({
            ok: false,
            error: 'Invalid signature'
          });
        }

        const payload = toBodyString(request.body);
        const webhook = new Webhook(webhookSecret);

        let verifiedPayload: unknown;

        try {
          verifiedPayload = webhook.verify(payload, {
            'svix-id': svixId,
            'svix-timestamp': svixTimestamp,
            'svix-signature': svixSignature
          });
        } catch {
          return reply.status(400).send({
            ok: false,
            error: 'Invalid signature'
          });
        }

        const event = toEvent(verifiedPayload);

        if (!event) {
          request.log.warn('Received Clerk webhook with invalid event payload.');
          return reply.status(200).send({
            received: true
          });
        }

        if (event.type === 'user.created') {
          await handleUserCreated(event.data, request.log);
        } else if (event.type === 'user.deleted') {
          await handleUserDeleted(event.data, request.log);
        }

        return reply.status(200).send({
          received: true
        });
      }
    });
  });
}
