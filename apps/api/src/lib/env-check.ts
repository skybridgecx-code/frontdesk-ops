type EnvRequirement = {
  key: string;
  message: string;
};

const REQUIRED_ENV_VARS: readonly EnvRequirement[] = [
  { key: 'STRIPE_SECRET_KEY', message: 'Stripe billing will not work' },
  { key: 'STRIPE_WEBHOOK_SECRET', message: 'Stripe webhook verification will not work' },
  { key: 'CLERK_SECRET_KEY', message: 'Clerk auth will not work' },
  { key: 'CLERK_WEBHOOK_SECRET', message: 'Clerk webhook verification will not work' },
  { key: 'TWILIO_ACCOUNT_SID', message: 'Twilio calls will not work' },
  { key: 'TWILIO_AUTH_TOKEN', message: 'Twilio calls will not work' },
  { key: 'RESEND_API_KEY', message: 'Email notifications will not work' },
  { key: 'DATABASE_URL', message: 'Database will not work' },
  { key: 'FRONTDESK_INTERNAL_API_SECRET', message: 'Internal API auth will not work' }
];

function hasValue(value: string | undefined) {
  return typeof value === 'string' && value.trim().length > 0;
}

function warnMissingEnv(key: string, message: string) {
  console.warn(`[env-check] ⚠️  ${key} is not set — ${message}`);
}

export function runEnvCheck() {
  console.info(
    '[env-check] TWILIO_ACCOUNT_SID present=%s TWILIO_AUTH_TOKEN present=%s',
    Boolean(process.env.TWILIO_ACCOUNT_SID),
    Boolean(process.env.TWILIO_AUTH_TOKEN)
  );
  console.info(
    '[env-check] TWILIO_ACCOUNT_SID present=%s TWILIO_AUTH_TOKEN present=%s',
    Boolean(process.env.TWILIO_ACCOUNT_SID),
    Boolean(process.env.TWILIO_AUTH_TOKEN)
  );
  for (const requirement of REQUIRED_ENV_VARS) {
    if (!hasValue(process.env[requirement.key])) {
      warnMissingEnv(requirement.key, requirement.message);
    }
  }

  if (!hasValue(process.env.STRIPE_PRICE_ID_STARTER)) {
    console.warn(
      '[env-check] Using hardcoded test price ID for Starter plan — set STRIPE_PRICE_ID_STARTER for production'
    );
  }

  if (!hasValue(process.env.STRIPE_PRICE_ID_PRO)) {
    console.warn(
      '[env-check] Using hardcoded test price ID for Pro plan — set STRIPE_PRICE_ID_PRO for production'
    );
  }

  if (!hasValue(process.env.STRIPE_PRICE_ID_ENTERPRISE)) {
    console.warn(
      '[env-check] Using hardcoded test price ID for Enterprise plan — set STRIPE_PRICE_ID_ENTERPRISE for production'
    );
  }
}
