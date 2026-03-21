import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';

export async function buildServer() {
  const app = Fastify({
    logger: true
  });

  await app.register(cors, {
    origin: true
  });

  await app.register(sensible);

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

  return app;
}
