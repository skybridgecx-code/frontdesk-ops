import { afterEach, describe, expect, it, vi } from 'vitest';
import { runEnvCheck } from '../env-check.js';

const ORIGINAL_ENV = { ...process.env };

const REQUIRED_KEYS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'CLERK_SECRET_KEY',
  'CLERK_WEBHOOK_SECRET',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'RESEND_API_KEY',
  'DATABASE_URL',
  'FRONTDESK_INTERNAL_API_SECRET',
  'STRIPE_PRICE_ID_STARTER',
  'STRIPE_PRICE_ID_PRO',
  'STRIPE_PRICE_ID_ENTERPRISE'
] as const;

function setAllRequiredEnv() {
  process.env.STRIPE_SECRET_KEY = 'sk_test';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  process.env.CLERK_SECRET_KEY = 'clerk_secret';
  process.env.CLERK_WEBHOOK_SECRET = 'clerk_whsec';
  process.env.TWILIO_ACCOUNT_SID = 'AC123';
  process.env.TWILIO_AUTH_TOKEN = 'twilio_token';
  process.env.RESEND_API_KEY = 'resend_key';
  process.env.DATABASE_URL = 'postgresql://localhost:5432/frontdesk';
  process.env.FRONTDESK_INTERNAL_API_SECRET = 'internal_secret';
  process.env.STRIPE_PRICE_ID_STARTER = 'price_starter';
  process.env.STRIPE_PRICE_ID_PRO = 'price_pro';
  process.env.STRIPE_PRICE_ID_ENTERPRISE = 'price_enterprise';
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe('runEnvCheck', () => {
  it('warns when STRIPE_SECRET_KEY is missing', () => {
    setAllRequiredEnv();
    delete process.env.STRIPE_SECRET_KEY;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    runEnvCheck();

    expect(warnSpy).toHaveBeenCalledWith(
      '[env-check] ⚠️  STRIPE_SECRET_KEY is not set — Stripe billing will not work'
    );
  });

  it('warns when plan price IDs are not set and hardcoded defaults are used', () => {
    setAllRequiredEnv();
    delete process.env.STRIPE_PRICE_ID_STARTER;
    delete process.env.STRIPE_PRICE_ID_PRO;
    delete process.env.STRIPE_PRICE_ID_ENTERPRISE;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    runEnvCheck();

    expect(warnSpy).toHaveBeenCalledWith(
      '[env-check] Using hardcoded test price ID for Starter plan — set STRIPE_PRICE_ID_STARTER for production'
    );
    expect(warnSpy).toHaveBeenCalledWith(
      '[env-check] Using hardcoded test price ID for Pro plan — set STRIPE_PRICE_ID_PRO for production'
    );
    expect(warnSpy).toHaveBeenCalledWith(
      '[env-check] Using hardcoded test price ID for Enterprise plan — set STRIPE_PRICE_ID_ENTERPRISE for production'
    );
  });

  it('does not warn when all required vars are set', () => {
    for (const key of REQUIRED_KEYS) {
      delete process.env[key];
    }

    setAllRequiredEnv();

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    runEnvCheck();

    expect(warnSpy).not.toHaveBeenCalled();
  });
});
