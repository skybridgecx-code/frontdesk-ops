import { randomUUID } from 'node:crypto';
import { prisma } from '@frontdesk/db';

export type SubscriptionRecord = {
  id: string;
  tenantId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type SubscriptionRow = {
  id: string;
  tenantId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  status: string;
  currentPeriodStart: Date | string;
  currentPeriodEnd: Date | string;
  cancelAtPeriodEnd: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type UpsertSubscriptionInput = {
  tenantId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
};

export type UpdateSubscriptionByStripeIdInput = {
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  stripePriceId: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
};

function toDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function toRecord(row: SubscriptionRow): SubscriptionRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    stripeCustomerId: row.stripeCustomerId,
    stripeSubscriptionId: row.stripeSubscriptionId,
    stripePriceId: row.stripePriceId,
    status: row.status,
    currentPeriodStart: toDate(row.currentPeriodStart),
    currentPeriodEnd: toDate(row.currentPeriodEnd),
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt)
  };
}

export async function getSubscriptionByTenantId(tenantId: string): Promise<SubscriptionRecord | null> {
  const rows = await prisma.$queryRaw<SubscriptionRow[]>`
    SELECT
      "id",
      "tenantId",
      "stripeCustomerId",
      "stripeSubscriptionId",
      "stripePriceId",
      "status",
      "currentPeriodStart",
      "currentPeriodEnd",
      "cancelAtPeriodEnd",
      "createdAt",
      "updatedAt"
    FROM "Subscription"
    WHERE "tenantId" = ${tenantId}
    LIMIT 1
  `;

  const row = rows[0];
  return row ? toRecord(row) : null;
}

export async function upsertSubscriptionByTenant(input: UpsertSubscriptionInput): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO "Subscription" (
      "id",
      "tenantId",
      "stripeCustomerId",
      "stripeSubscriptionId",
      "stripePriceId",
      "status",
      "currentPeriodStart",
      "currentPeriodEnd",
      "cancelAtPeriodEnd",
      "createdAt",
      "updatedAt"
    ) VALUES (
      ${randomUUID()},
      ${input.tenantId},
      ${input.stripeCustomerId},
      ${input.stripeSubscriptionId},
      ${input.stripePriceId},
      ${input.status},
      ${input.currentPeriodStart},
      ${input.currentPeriodEnd},
      ${input.cancelAtPeriodEnd},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("tenantId") DO UPDATE SET
      "stripeCustomerId" = EXCLUDED."stripeCustomerId",
      "stripeSubscriptionId" = EXCLUDED."stripeSubscriptionId",
      "stripePriceId" = EXCLUDED."stripePriceId",
      "status" = EXCLUDED."status",
      "currentPeriodStart" = EXCLUDED."currentPeriodStart",
      "currentPeriodEnd" = EXCLUDED."currentPeriodEnd",
      "cancelAtPeriodEnd" = EXCLUDED."cancelAtPeriodEnd",
      "updatedAt" = CURRENT_TIMESTAMP
  `;
}

export async function updateSubscriptionByStripeSubscriptionId(
  input: UpdateSubscriptionByStripeIdInput
): Promise<boolean> {
  const updatedCount = await prisma.$executeRaw`
    UPDATE "Subscription"
    SET
      "stripeCustomerId" = ${input.stripeCustomerId},
      "stripePriceId" = ${input.stripePriceId},
      "status" = ${input.status},
      "currentPeriodStart" = ${input.currentPeriodStart},
      "currentPeriodEnd" = ${input.currentPeriodEnd},
      "cancelAtPeriodEnd" = ${input.cancelAtPeriodEnd},
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "stripeSubscriptionId" = ${input.stripeSubscriptionId}
  `;

  return Number(updatedCount) > 0;
}

export async function setSubscriptionCanceledByStripeSubscriptionId(input: {
  stripeSubscriptionId: string;
}): Promise<boolean> {
  const updatedCount = await prisma.$executeRaw`
    UPDATE "Subscription"
    SET
      "status" = 'canceled',
      "cancelAtPeriodEnd" = true,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "stripeSubscriptionId" = ${input.stripeSubscriptionId}
  `;

  return Number(updatedCount) > 0;
}
