import assert from 'node:assert/strict';
import test from 'node:test';
import fastify from 'fastify';
import sensible from '@fastify/sensible';
import { prisma } from '@frontdesk/db';
import { registerProspectSummaryRoutes } from './prospect-summary';

async function createApp() {
  const app = fastify({ logger: false });
  await app.register(sensible);
  await app.register(registerProspectSummaryRoutes);
  return app;
}

test('prospect summary reads expose terminal and active counts from the backend read model', async (t) => {
  const app = await createApp();
  t.after(() => app.close());

  const originalBusiness = prisma.business;
  const originalProspect = prisma.prospect;
  Object.defineProperty(prisma, 'business', {
    configurable: true,
    value: {
      findUnique: async () => ({ id: 'biz_123' })
    }
  });
  Object.defineProperty(prisma, 'prospect', {
    configurable: true,
    value: {
      groupBy: async () => [
        { status: 'NEW', _count: { _all: 2 } },
        { status: 'READY', _count: { _all: 1 } },
        { status: 'ARCHIVED', _count: { _all: 3 } },
        { status: 'RESPONDED', _count: { _all: 4 } }
      ]
    }
  });
  t.after(() => {
    delete (prisma as { business?: unknown }).business;
    delete (prisma as { prospect?: unknown }).prospect;
    void originalBusiness;
    void originalProspect;
  });

  const response = await app.inject({
    method: 'GET',
    url: '/v1/businesses/biz_123/prospects/summary'
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as {
    ok: true;
    summary: {
      total: number;
      active: number;
      terminal: number;
      new: number;
      ready: number;
      responded: number;
      archived: number;
    };
  };

  assert.equal(body.ok, true);
  assert.equal(body.summary.total, 10);
  assert.equal(body.summary.active, 3);
  assert.equal(body.summary.terminal, 7);
  assert.equal(body.summary.new, 2);
  assert.equal(body.summary.ready, 1);
  assert.equal(body.summary.responded, 4);
  assert.equal(body.summary.archived, 3);
});
