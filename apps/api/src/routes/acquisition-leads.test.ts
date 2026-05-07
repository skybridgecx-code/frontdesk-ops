import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify from 'fastify';
import sensible from '@fastify/sensible';
import { prisma } from '@frontdesk/db';
import { registerAcquisitionLeadRoutes } from './acquisition-leads';

type QueryRaw = typeof prisma.$queryRaw;

function makeLeadRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lead_123',
    businessName: 'Summit Peak Roofing Demo Co.',
    vertical: 'Roofing',
    services: 'Roof repair',
    location: 'Maple Ridge, VA',
    phone: '+15550000001',
    email: 'owner@summit-demo.test',
    website: 'summit-demo.example',
    yearsInBusiness: '8',
    painPointFound: 'Missed calls on storm-heavy days',
    outreachStatus: 'Not contacted',
    stage: 'Researching',
    demoStatus: 'Not booked',
    offerStage: 'Not proposed',
    lastContactedAt: null,
    nextFollowUpAt: null,
    notes: 'Initial row',
    source: 'Imported lead file',
    createdAt: new Date('2026-05-07T00:00:00.000Z'),
    updatedAt: new Date('2026-05-07T00:00:00.000Z'),
    ...overrides
  };
}

async function createApp(withTenant = false) {
  const app = fastify({ logger: false });
  await app.register(sensible);

  if (withTenant) {
    app.addHook('onRequest', async (request) => {
      request.tenantId = 'tenant_123';
    });
  }

  await app.register(registerAcquisitionLeadRoutes);
  return app;
}

describe.sequential('acquisition lead routes', () => {
  let originalQueryRaw: QueryRaw;

  beforeEach(() => {
    originalQueryRaw = prisma.$queryRaw;
  });

  afterEach(() => {
    Object.defineProperty(prisma, '$queryRaw', {
      configurable: true,
      value: originalQueryRaw
    });
  });

  it('returns 403 when tenant scope is missing', async () => {
    const app = await createApp(false);

    const response = await app.inject({
      method: 'GET',
      url: '/v1/acquisition/leads'
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      ok: false,
      error: 'Tenant scope required'
    });

    await app.close();
  });

  it('patch updates stage/outreach fields and returns updated lead payload', async () => {
    const app = await createApp(true);

    let call = 0;
    const mockQueryRaw: QueryRaw = (async () => {
      call += 1;
      if (call === 1) {
        return [makeLeadRow()] as unknown;
      }

      return [
        makeLeadRow({
          stage: 'Contacted',
          outreachStatus: 'Contacted',
          notes: 'Reached owner and scheduled follow-up',
          updatedAt: new Date('2026-05-07T12:30:00.000Z')
        })
      ] as unknown;
    }) as QueryRaw;

    Object.defineProperty(prisma, '$queryRaw', {
      configurable: true,
      value: mockQueryRaw
    });

    const response = await app.inject({
      method: 'PATCH',
      url: '/v1/acquisition/leads/lead_123',
      payload: {
        stage: 'Contacted',
        outreachStatus: 'Contacted',
        notes: 'Reached owner and scheduled follow-up'
      }
    });

    expect(response.statusCode).toBe(200);

    const body = response.json() as {
      ok: boolean;
      lead: {
        id: string;
        stage: string;
        outreachStatus: string;
        notes: string | null;
      };
    };

    expect(body.ok).toBe(true);
    expect(body.lead.id).toBe('lead_123');
    expect(body.lead.stage).toBe('Contacted');
    expect(body.lead.outreachStatus).toBe('Contacted');
    expect(body.lead.notes).toBe('Reached owner and scheduled follow-up');

    await app.close();
  });
});
