import type { FastifyInstance } from 'fastify';
import { resolveActiveWorkspace } from '../lib/active-workspace.js';

export async function registerCoreRoutes(app: FastifyInstance) {
  app.get('/health', async () => {
    return {
      ok: true,
      service: 'api'
    };
  });

  app.get('/v1/ping', async () => {
    return {
      pong: true
    };
  });

  app.get('/v1/bootstrap', async () => {
    const tenant = await resolveActiveWorkspace();

    return {
      ok: true,
      tenant
    };
  });
}
