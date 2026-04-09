import type { FastifyInstance } from 'fastify';
import { prisma } from '@frontdesk/db';

type TenantRow = {
  id: string;
  name: string;
};

type CountRow = {
  count: number | bigint | string;
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

export async function registerOnboardingRoutes(app: FastifyInstance) {
  app.get('/v1/onboarding/status', async (request, reply) => {
    const tenantId = request.tenantId;

    if (!tenantId) {
      return reply.status(401).send({
        error: 'Unauthorized'
      });
    }

    const tenantRows = await prisma.$queryRaw<TenantRow[]>`
      SELECT "id", "name"
      FROM "Tenant"
      WHERE "id" = ${tenantId}
      LIMIT 1
    `;

    const tenant = tenantRows[0];

    if (!tenant) {
      return reply.status(404).send({
        error: 'Tenant not found'
      });
    }

    const subscriptionCountRows = await prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::int AS "count"
      FROM "Subscription"
      WHERE "tenantId" = ${tenantId}
        AND LOWER("status") IN ('active', 'trialing', 'past_due')
    `;

    const businessCountRows = await prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::int AS "count"
      FROM "Business"
      WHERE "tenantId" = ${tenantId}
    `;

    const phoneNumberCountRows = await prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::int AS "count"
      FROM "PhoneNumber"
      WHERE "tenantId" = ${tenantId}
        AND "isActive" = true
    `;

    const hasSubscription = toCount(subscriptionCountRows[0]?.count ?? 0) > 0;
    const hasBusinesses = toCount(businessCountRows[0]?.count ?? 0) > 0;
    const hasPhoneNumbers = toCount(phoneNumberCountRows[0]?.count ?? 0) > 0;

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      hasSubscription,
      hasBusinesses,
      hasPhoneNumbers,
      isOnboardingComplete: hasSubscription && hasBusinesses && hasPhoneNumbers
    };
  });
}
