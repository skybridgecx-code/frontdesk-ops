import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import formbody from '@fastify/formbody';
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
import { registerCallReviewNextRoutes } from './routes/call-review-next.js';
import { registerCallExtractionRoutes } from './routes/call-extract.js';
import { registerCallReviewRoutes } from './routes/call-review.js';
import { registerCallTranscriptRoutes } from './routes/call-transcript.js';
import { registerCallTriageRoutes } from './routes/call-triage.js';
import { registerCallBackfillRoutes } from './routes/call-backfill.js';
import { registerProspectRoutes } from './routes/prospects.js';
import { registerProspectReviewNextRoutes } from './routes/prospect-review-next.js';
import { registerProspectImportRoutes } from './routes/prospect-import.js';
import { registerProspectProviderImportRoutes } from './routes/prospect-provider-import.js';
import { registerProspectWriteRoutes } from './routes/prospect-write.js';
import { enforceBasicAuth, shouldSkipBasicAuth } from './lib/basic-auth.js';
import { registerVoiceWebhookRoutes } from './routes/voice-webhooks.js';
import { registerVoiceStatusWebhookRoutes } from './routes/voice-status-webhooks.js';
import { registerAgentProfileWriteRoutes } from './routes/agent-profiles-write.js';

export async function buildServer() {
  const app = Fastify({
    logger: true
  });

  await app.register(cors, {
    origin: true
  });

  await app.register(sensible);
  await app.register(formbody);

  await registerCoreRoutes(app);
  await registerTenantRoutes(app);
  await registerBusinessRoutes(app);
  await registerBusinessWriteRoutes(app);
  await registerBusinessHoursRoutes(app);
  await registerServiceAreaRoutes(app);
  await registerPhoneNumberRoutes(app);
  await registerPhoneNumberWriteRoutes(app);
  await registerCallBulkTriageRoutes(app);
  await registerCallReviewNextRoutes(app);
  await registerCallRoutes(app);
  await registerCallReviewRoutes(app);
  await registerCallExtractionRoutes(app);
  await registerCallTranscriptRoutes(app);
  await registerCallTriageRoutes(app);
  await registerCallBackfillRoutes(app);
  await registerProspectReviewNextRoutes(app);
  await registerProspectRoutes(app);
  await registerProspectImportRoutes(app);
  await registerProspectProviderImportRoutes(app);
  await registerProspectWriteRoutes(app);
  app.addHook('onRequest', async (request, reply) => {
    if (shouldSkipBasicAuth(request.url)) {
      return;
    }

    const ok = enforceBasicAuth(request, reply);
    if (!ok) {
      return reply;
    }
  });

  await registerVoiceWebhookRoutes(app);
  await registerVoiceStatusWebhookRoutes(app);
  await registerAgentProfileWriteRoutes(app);

  return app;
}
