import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getAllPlans, getPlanByKey, getPlanByPriceId } from '../lib/plans.js';

describe('plans config helpers', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.STRIPE_PRICE_ID = 'price_legacy_starter';
    process.env.STRIPE_PRICE_ID_STARTER = 'price_starter';
    process.env.STRIPE_PRICE_ID_PRO = 'price_pro';
    process.env.STRIPE_PRICE_ID_ENTERPRISE = 'price_enterprise';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('getPlanByPriceId returns correct plan for each configured price id', () => {
    expect(getPlanByPriceId('price_starter')?.key).toBe('starter');
    expect(getPlanByPriceId('price_pro')?.key).toBe('pro');
    expect(getPlanByPriceId('price_enterprise')?.key).toBe('enterprise');
  });

  it('getPlanByPriceId returns null for unknown price id', () => {
    expect(getPlanByPriceId('price_unknown')).toBeNull();
  });

  it('getPlanByKey returns a plan by key', () => {
    const plan = getPlanByKey('starter');

    expect(plan.key).toBe('starter');
    expect(plan.name).toBe('Starter');
    expect(plan.monthlyPrice).toBe(299);
    expect(plan.callsPerMonth).toBe(500);
  });

  it('getAllPlans returns all plans with env-based price ids', () => {
    const plans = getAllPlans();

    expect(plans).toHaveLength(3);
    expect(plans.map((plan) => plan.key)).toEqual(['starter', 'pro', 'enterprise']);
    expect(plans.find((plan) => plan.key === 'starter')?.stripePriceId).toBe('price_starter');
    expect(plans.find((plan) => plan.key === 'pro')?.stripePriceId).toBe('price_pro');
    expect(plans.find((plan) => plan.key === 'enterprise')?.stripePriceId).toBe('price_enterprise');
  });
});
