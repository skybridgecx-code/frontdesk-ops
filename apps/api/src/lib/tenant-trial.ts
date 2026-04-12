import { prisma } from '@frontdesk/db';

const TRIAL_LENGTH_DAYS = 14;
const TRIAL_LENGTH_MS = TRIAL_LENGTH_DAYS * 24 * 60 * 60 * 1000;

type TenantTrialRow = {
  subscriptionStatus: string;
  trialEndsAt: Date | string | null;
  createdAt: Date | string;
};

export type TenantTrialState = {
  subscriptionStatus: string;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  isTrialing: boolean;
  isTrialActive: boolean;
  isTrialExpired: boolean;
  trialDaysRemaining: number;
};

function toDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value : new Date(value);
}

function resolveTrialEndsAt(row: TenantTrialRow, trialStartedAt: Date | null) {
  const explicitTrialEnd = toDate(row.trialEndsAt);
  if (explicitTrialEnd) {
    return explicitTrialEnd;
  }

  if (!trialStartedAt) {
    return null;
  }

  return new Date(trialStartedAt.getTime() + TRIAL_LENGTH_MS);
}

function toTrialDaysRemaining(now: Date, trialEndsAt: Date | null) {
  if (!trialEndsAt) {
    return 0;
  }

  const diffMs = trialEndsAt.getTime() - now.getTime();
  if (diffMs <= 0) {
    return 0;
  }

  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

export async function getTenantTrialState(tenantId: string): Promise<TenantTrialState | null> {
  const rows = await prisma.$queryRaw<TenantTrialRow[]>`
    SELECT
      "subscriptionStatus",
      "trialEndsAt",
      "createdAt"
    FROM "Tenant"
    WHERE "id" = ${tenantId}
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) {
    return null;
  }

  const now = new Date();
  const subscriptionStatus = row.subscriptionStatus.toLowerCase();
  const trialStartedAt = toDate(row.createdAt);
  const trialEndsAt = resolveTrialEndsAt(row, trialStartedAt);
  const isTrialing = subscriptionStatus === 'trialing';
  const isTrialActive = Boolean(isTrialing && trialEndsAt && trialEndsAt.getTime() > now.getTime());
  const isTrialExpired = Boolean(isTrialing && trialEndsAt && trialEndsAt.getTime() <= now.getTime());

  return {
    subscriptionStatus,
    trialStartedAt,
    trialEndsAt,
    isTrialing,
    isTrialActive,
    isTrialExpired,
    trialDaysRemaining: toTrialDaysRemaining(now, trialEndsAt)
  };
}

