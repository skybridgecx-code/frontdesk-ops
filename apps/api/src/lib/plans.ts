/**
 * Stripe price configuration defaults for production checkout.
 *
 * Optional overrides:
 * STRIPE_PRICE_ID_STARTER=price_...
 * STRIPE_PRICE_ID_PRO=price_...
 * STRIPE_PRICE_ID_ENTERPRISE=price_...
 * STRIPE_PRICE_ID=price_... (legacy Starter override)
 */

export const PLAN_KEYS = ['starter', 'pro', 'enterprise'] as const;

export type PlanKey = (typeof PLAN_KEYS)[number];

type PlanTemplate = {
  key: PlanKey;
  name: string;
  monthlyPrice: number;
  callsPerMonth: number;
  maxPhoneNumbers: number;
  maxBusinesses: number;
  features: readonly string[];
};

export type Plan = {
  key: PlanKey;
  name: string;
  monthlyPrice: number;
  callsPerMonth: number;
  maxPhoneNumbers: number;
  maxBusinesses: number;
  features: string[];
  stripePriceId: string | null;
};

const PLAN_TEMPLATES: Record<PlanKey, PlanTemplate> = {
  starter: {
    key: 'starter',
    name: 'Starter',
    monthlyPrice: 299,
    callsPerMonth: 500,
    maxPhoneNumbers: 1,
    maxBusinesses: 1,
    features: [
      'AI call answering 24/7',
      'Up to 500 calls/month',
      'Lead extraction & email alerts',
      'Call recording & playback',
      'Basic dashboard & CRM',
      'Email support'
    ]
  },
  pro: {
    key: 'pro',
    name: 'Pro',
    monthlyPrice: 499,
    callsPerMonth: -1,
    maxPhoneNumbers: 3,
    maxBusinesses: 1,
    features: [
      'Everything in Starter',
      'Unlimited calls',
      'Up to 3 phone numbers',
      'Outreach copilot AI drafts',
      'Priority support',
      'Custom agent personality'
    ]
  },
  enterprise: {
    key: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 999,
    callsPerMonth: -1,
    maxPhoneNumbers: 10,
    maxBusinesses: 5,
    features: [
      'Everything in Pro',
      'Up to 5 businesses / locations',
      'Up to 10 phone numbers',
      'API access & webhooks',
      'Dedicated onboarding',
      'Custom integrations'
    ]
  }
};

const DEFAULT_STRIPE_PRICE_IDS: Record<PlanKey, string> = {
  starter: 'price_1TKXE9GRmFZwSOkBgZXtYPoT',
  pro: 'price_1TKXF4GRmFZwSOkBlL8LPl7J',
  enterprise: 'price_1TKXFrGRmFZwSOkBfM5eOUMM'
};

function toPriceId(key: PlanKey) {
  if (key === 'starter') {
    return (
      process.env.STRIPE_PRICE_ID_STARTER ??
      process.env.STRIPE_PRICE_ID ??
      DEFAULT_STRIPE_PRICE_IDS.starter
    );
  }

  if (key === 'pro') {
    return process.env.STRIPE_PRICE_ID_PRO ?? DEFAULT_STRIPE_PRICE_IDS.pro;
  }

  return process.env.STRIPE_PRICE_ID_ENTERPRISE ?? DEFAULT_STRIPE_PRICE_IDS.enterprise;
}

function toPlan(key: PlanKey): Plan {
  const template = PLAN_TEMPLATES[key];

  return {
    key: template.key,
    name: template.name,
    monthlyPrice: template.monthlyPrice,
    callsPerMonth: template.callsPerMonth,
    maxPhoneNumbers: template.maxPhoneNumbers,
    maxBusinesses: template.maxBusinesses,
    features: [...template.features],
    stripePriceId: toPriceId(key)
  };
}

export function getPlanByKey(key: PlanKey): Plan {
  return toPlan(key);
}

export function getAllPlans(): Plan[] {
  return PLAN_KEYS.map((key) => toPlan(key));
}

export function getPlanByPriceId(stripePriceId: string): Plan | null {
  const normalizedPriceId = stripePriceId.trim();

  if (normalizedPriceId.length === 0) {
    return null;
  }

  const plans = getAllPlans();
  const matchingPlan = plans.find((plan) => plan.stripePriceId === normalizedPriceId);
  return matchingPlan ?? null;
}
