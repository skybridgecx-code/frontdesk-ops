import Fastify from 'fastify';

const app = Fastify({
  logger: true
});

app.get('/health', async () => {
  return {
    ok: true,
    service: 'realtime-gateway'
  };
});

const port = Number(process.env.PORT_REALTIME ?? 4001);
const host = '0.0.0.0';

try {
  await app.listen({ port, host });
  app.log.info(`Realtime gateway listening on http://${host}:${port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
