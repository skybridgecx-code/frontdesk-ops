import { prisma } from '@frontdesk/db';
import { buildServer } from './server.js';

const port = Number(process.env.PORT_API ?? process.env.PORT ?? 4000);
const host = '0.0.0.0';

async function main() {
  const app = await buildServer();

  try {
    await app.listen({ port, host });
    app.log.info(`API listening on http://${host}:${port}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }

  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, async () => {
      app.log.info({ msg: `Received ${signal}, shutting down` });
      await app.close();
      await prisma.$disconnect();
      process.exit(0);
    });
  }
}

void main();