import { buildServer } from './server.js';

const port = Number(process.env.PORT_API ?? 4000);
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
}

void main();
