import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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

describe('prospect summary routes', () => {
  let originalBusiness: typeof prisma.business;
  let originalProspect: typeof prisma.prospect;

  beforeEach(() => {
    originalBusiness = prisma.business;
    originalProspect = prisma.prospect;
  });

  afterEach(() => {
    Object.defineProperty(prisma, 'business', {
      configurable: true,
      value: originalBusiness,
    });
    Object.defineProperty(prisma, 'prospect', {
      configurable: true,
      value: originalProspect,
    });
  });

  it('exposes terminal and active counts from the backend read model', async () => {
    const app = await createApp();

    Object.defineProperty(prisma, 'business', {
      configurable: true,
      value: { findFirst: async () => ({ id: 'biz_123' }) },
    });
    Object.defineProperty(prisma, 'prospect', {
      configurable: true,
      value: {
        groupBy: async () => [
          { status: 'NEW', _count: { _all: 2 } },
          { status: 'READY', _count: { _all: 1 } },
          { status: 'ARCHIVED', _count: { _all: 3 } },
          { status: 'RESPONDED', _count: { _all: 4 } },
        ],
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/businesses/biz_123/prospects/summary',
    });

    expect(response.statusCode).toBe(200);

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

    expect(body.ok).toBe(true);
    expect(body.summary.total).toBe(10);
    expect(body.summary.active).toBe(3);
    expect(body.summary.terminal).toBe(7);
    expect(body.summary.new).toBe(2);
    expect(body.summary.ready).toBe(1);
    expect(body.summary.responded).toBe(4);
    expect(body.summary.archived).toBe(3);

    await app.close();
  });
});
