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
import { registerCallExtractionRoutes } from './routes/call-extract.js';
import { registerCallTranscriptRoutes } from './routes/call-transcript.js';
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
  await registerCallRoutes(app);
  await registerCallExtractionRoutes(app);
  await registerCallTranscriptRoutes(app);
  await registerVoiceWebhookRoutes(app);
  await registerVoiceStatusWebhookRoutes(app);
  await registerAgentProfileWriteRoutes(app);

  return app;
}
