import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import formbody from '@fastify/formbody';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { registerCoreRoutes } from './routes/core.js';
import { registerTenantRoutes } from './routes/tenants.js';
import { registerBusinessRoutes } from './routes/businesses.js';
import { registerBusinessWriteRoutes } from './routes/business-write.js';
import { registerBusinessHoursRoutes } from './routes/business-hours.js';
import { registerServiceAreaRoutes } from './routes/service-areas.js';
import { registerPhoneNumberRoutes } from './routes/phone-numbers.js';
import { registerPhoneNumberWriteRoutes } from './routes/phone-numbers-write.js';
import { registerCallRoutes } from './routes/calls.js';
import { registerCallBulkTriageRoutes } from './routes/call-bulk-triage.js';
import { registerCallExtractionRoutes } from './routes/call-extract.js';
import { registerCallReviewRoutes } from './routes/call-review.js';
import { registerCallTranscriptRoutes } from './routes/call-transcript.js';
import { registerCallTriageRoutes } from './routes/call-triage.js';
import { registerCallBackfillRoutes } from './routes/call-backfill.js';
import { enforceBasicAuth } from './lib/basic-auth.js';
import { enforceClerkAuth, shouldSkipDashboardAuth } from './lib/clerk-auth.js';
import { resolveTenant } from './lib/tenant-resolver.js';
import { requireActiveSubscription } from './lib/subscription-guard.js';
import { registerVoiceWebhookRoutes } from './routes/voice-webhooks.js';
import { registerVoiceStatusWebhookRoutes } from './routes/voice-status-webhooks.js';
import { registerVoiceRecordingWebhookRoutes } from './routes/voice-recording-webhooks.js';
import { registerAgentProfileWriteRoutes } from './routes/agent-profiles-write.js';
import { registerProspectImportRoutes } from './routes/prospect-import.js';
import { registerProspectReadRoutes } from './routes/prospect-read.js';
import { registerProspectWriteRoutes } from './routes/prospect-write.js';
import { registerProspectAttemptWriteRoutes } from './routes/prospect-attempts-write.js';
import { registerProspectAttemptReadRoutes } from './routes/prospect-attempts-read.js';
import { registerProspectSummaryRoutes } from './routes/prospect-summary.js';
import { registerStripeWebhookRoutes } from './routes/stripe-webhooks.js';
import { registerClerkWebhookRoutes } from './routes/clerk-webhooks.js';
import { registerBillingRoutes } from './routes/billing.js';
import { registerOnboardingRoutes } from './routes/onboarding.js';

function getPathname(url: string) {
  return url.split('?')[0] ?? url;
}

function shouldSkipTenantResolver(url: string) {
  const pathname = getPathname(url);

  return (
    pathname === '/health' ||
    pathname === '/v1/ping' ||
    pathname.startsWith('/v1/twilio/') ||
    pathname.startsWith('/v1/stripe/') ||
    pathname.startsWith('/v1/clerk/')
  );
}

function shouldSkipSubscriptionGuard(url: string) {
  const pathname = getPathname(url);

  return (
    shouldSkipTenantResolver(pathname) ||
    pathname === '/v1/bootstrap' ||
    pathname.startsWith('/v1/billing/') ||
    pathname.startsWith('/v1/onboarding/')
  );
}

export async function buildServer() {
  const app = Fastify({
    logger: true,
    bodyLimit: 1_048_576
  });

  const allowedOrigins = [
    process.env.FRONTDESK_WEB_URL ?? 'https://frontdesk-ops-web.vercel.app'
  ];
  if (process.env.NODE_ENV === 'development') {
    allowedOrigins.push('http://localhost:3000');
  }

  await app.register(cors, {
    origin: allowedOrigins,
    credentials: true
  });

  await app.register(helmet);
  await app.register(sensible);
  await app.register(formbody);

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    allowList: (request) => {
      return shouldSkipDashboardAuth(request.url);
    }
  });

  app.addHook('onRequest', async (request, reply) => {
    if (shouldSkipDashboardAuth(request.url)) {
      return;
    }

    if (process.env.CLERK_SECRET_KEY) {
      const ok = await enforceClerkAuth(request, reply);
      if (!ok) {
        return reply;
      }
      return;
    }

    const ok = enforceBasicAuth(request, reply);
    if (!ok) {
      return reply;
    }
  });

  app.addHook('preHandler', async (request, reply) => {
    if (!process.env.CLERK_SECRET_KEY) {
      return;
    }

    if (shouldSkipTenantResolver(request.url)) {
      return;
    }

    const tenantResolved = await resolveTenant(request, reply);
    if (!tenantResolved) {
      return reply;
    }

    if (shouldSkipSubscriptionGuard(request.url)) {
      return;
    }

    const hasSubscription = await requireActiveSubscription(request, reply);
    if (!hasSubscription) {
      return reply;
    }
  });

  await registerCoreRoutes(app);
  await registerTenantRoutes(app);
  await registerBusinessRoutes(app);
  await registerBusinessWriteRoutes(app);
  await registerBusinessHoursRoutes(app);
  await registerServiceAreaRoutes(app);
  await registerPhoneNumberRoutes(app);
  await registerPhoneNumberWriteRoutes(app);
  await registerCallBulkTriageRoutes(app);
  await registerCallRoutes(app);
  await registerCallReviewRoutes(app);
  await registerCallExtractionRoutes(app);
  await registerCallTranscriptRoutes(app);
  await registerCallTriageRoutes(app);
  await registerCallBackfillRoutes(app);
  await registerVoiceWebhookRoutes(app);
  await registerVoiceStatusWebhookRoutes(app);
  await registerVoiceRecordingWebhookRoutes(app);
  await registerStripeWebhookRoutes(app);
  await registerClerkWebhookRoutes(app);
  await registerBillingRoutes(app);
  await registerOnboardingRoutes(app);
  await registerAgentProfileWriteRoutes(app);
  await registerProspectImportRoutes(app);
  await registerProspectReadRoutes(app);
  await registerProspectWriteRoutes(app);
  await registerProspectAttemptWriteRoutes(app);
  await registerProspectAttemptReadRoutes(app);
  await registerProspectSummaryRoutes(app);

  return app;
}
