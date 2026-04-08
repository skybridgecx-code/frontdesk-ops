import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify from 'fastify';
import sensible from '@fastify/sensible';
import { prisma } from '@frontdesk/db';
import { registerProspectReadRoutes } from './prospect-read';

async function createApp() {
  const app = fastify({ logger: false });
  await app.register(sensible);
  await app.register(registerProspectReadRoutes);
  return app;
}

describe('prospect read routes', () => {
  let originalProspect: typeof prisma.prospect;

  beforeEach(() => {
    originalProspect = prisma.prospect;
  });

  afterEach(() => {
    Object.defineProperty(prisma, 'prospect', {
      configurable: true,
      value: originalProspect,
    });
  });

  it('list reads expose readState and keep terminal prospects non-actionable', async () => {
    const app = await createApp();

    Object.defineProperty(prisma, 'prospect', {
      configurable: true,
      value: {
        findMany: async () => [
          {
            prospectSid: 'PR_READY',
            companyName: 'Acme HVAC',
            contactName: 'Jordan Smith',
            contactPhone: '555-0101',
            contactEmail: 'jordan@example.com',
            city: 'Austin',
            state: 'TX',
            sourceLabel: 'Web form',
            serviceInterest: 'Plumbing',
            status: 'READY',
            priority: 'HIGH',
            lastAttemptAt: '2026-04-03T10:00:00.000Z',
            nextActionAt: '2100-01-01T10:00:00.000Z',
            createdAt: '2026-04-01T10:00:00.000Z',
            updatedAt: '2026-04-03T12:00:00.000Z',
          },
          {
            prospectSid: 'PR_ARCHIVED',
            companyName: 'Old Lead Co',
            contactName: null,
            contactPhone: null,
            contactEmail: null,
            city: null,
            state: null,
            sourceLabel: null,
            serviceInterest: null,
            status: 'ARCHIVED',
            priority: null,
            lastAttemptAt: null,
            nextActionAt: '2026-04-01T10:00:00.000Z',
            createdAt: '2026-04-01T09:00:00.000Z',
            updatedAt: '2026-04-03T13:00:00.000Z',
          },
        ],
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/businesses/biz_123/prospects?status=READY',
    });

    expect(response.statusCode).toBe(200);

    const body = response.json() as {
      ok: true;
      prospects: Array<{
        prospectSid: string;
        readState: {
          isTerminal: boolean;
          hasNextAction: boolean;
          hasLastAttempt: boolean;
          isActionable: boolean;
          queueStateLabel: string;
        };
      }>;
    };

    expect(body.ok).toBe(true);
    expect(body.prospects).toHaveLength(2);
    expect(body.prospects[0]?.readState).toEqual({
      isTerminal: false,
      hasNextAction: true,
      hasLastAttempt: true,
      isActionable: true,
      queueStateLabel: 'upcoming',
    });
    expect(body.prospects[1]?.readState).toEqual({
      isTerminal: true,
      hasNextAction: false,
      hasLastAttempt: false,
      isActionable: false,
      queueStateLabel: 'no next action',
    });

    await app.close();
  });

  it('detail reads expose lastAttemptAt and readState', async () => {
    const app = await createApp();

    Object.defineProperty(prisma, 'prospect', {
      configurable: true,
      value: {
        findMany: async () => [],
        findFirst: async () => ({
          prospectSid: 'PR_DETAIL',
          companyName: 'Detail Co',
          contactName: 'Casey Johnson',
          contactPhone: '555-0102',
          contactEmail: 'casey@example.com',
          city: 'Dallas',
          state: 'TX',
          sourceLabel: 'Referral',
          serviceInterest: 'Water heater replacement',
          status: 'ARCHIVED',
          priority: 'LOW',
          lastAttemptAt: '2026-04-03T08:00:00.000Z',
          notes: 'Archived after qualification.',
          nextActionAt: '2026-04-03T09:00:00.000Z',
          createdAt: '2026-04-01T09:00:00.000Z',
          updatedAt: '2026-04-03T14:00:00.000Z',
        }),
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/businesses/biz_123/prospects/PR_DETAIL',
    });

    expect(response.statusCode).toBe(200);

    const body = response.json() as {
      ok: true;
      prospect: {
        lastAttemptAt: string;
        serviceInterest: string | null;
        readState: {
          isTerminal: boolean;
          hasNextAction: boolean;
          hasLastAttempt: boolean;
          isActionable: boolean;
          queueStateLabel: string;
        };
      };
    };

    expect(body.ok).toBe(true);
    expect(body.prospect.lastAttemptAt).toBe('2026-04-03T08:00:00.000Z');
    expect(body.prospect.serviceInterest).toBe('Water heater replacement');
    expect(body.prospect.readState).toEqual({
      isTerminal: true,
      hasNextAction: false,
      hasLastAttempt: true,
      isActionable: false,
      queueStateLabel: 'no next action',
    });

    await app.close();
  });
});
