import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fastify from 'fastify';
import { registerPhoneNumberWriteRoutes } from '../phone-numbers-write.js';

const {
  phoneNumberFindFirstMock,
  phoneNumberUpdateMock,
  agentProfileFindFirstMock
} = vi.hoisted(() => ({
  phoneNumberFindFirstMock: vi.fn(),
  phoneNumberUpdateMock: vi.fn(),
  agentProfileFindFirstMock: vi.fn()
}));

vi.mock('@frontdesk/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@frontdesk/db')>();

  return {
    ...actual,
    prisma: {
      phoneNumber: {
        findFirst: phoneNumberFindFirstMock,
        update: phoneNumberUpdateMock
      },
      agentProfile: {
        findFirst: agentProfileFindFirstMock
      }
    }
  };
});

async function createApp() {
  const app = fastify({ logger: false });
  await registerPhoneNumberWriteRoutes(app);
  return app;
}

describe('phone-numbers-write routes', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.FRONTDESK_INTERNAL_API_SECRET = 'internal-secret';

    phoneNumberFindFirstMock.mockReset();
    phoneNumberUpdateMock.mockReset();
    agentProfileFindFirstMock.mockReset();

    phoneNumberUpdateMock.mockResolvedValue({
      id: 'pn_1',
      tenantId: 'tenant_1',
      businessId: 'biz_1',
      locationId: null,
      provider: 'TWILIO',
      externalSid: 'PN123',
      e164: '+12025550100',
      label: 'Main line',
      isActive: true,
      routingMode: 'AI_ALWAYS',
      primaryAgentProfileId: null,
      afterHoursAgentProfileId: null,
      enableMissedCallTextBack: false,
      updatedAt: new Date('2026-04-18T00:00:00.000Z'),
      primaryAgentProfile: null,
      afterHoursAgentProfile: null
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('allows admin-secret PATCH update for enableMissedCallTextBack', async () => {
    phoneNumberFindFirstMock.mockResolvedValue({
      id: 'pn_1',
      businessId: 'biz_1',
      tenantId: 'tenant_1'
    });

    const app = await createApp();

    const response = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/phone-numbers/pn_1',
      headers: {
        authorization: 'Bearer internal-secret'
      },
      payload: {
        enableMissedCallTextBack: false
      }
    });

    expect(response.statusCode).toBe(200);
    expect(phoneNumberFindFirstMock).toHaveBeenCalledWith({
      where: { id: 'pn_1' },
      select: { id: true, businessId: true, tenantId: true }
    });
    expect(phoneNumberUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pn_1' },
        data: { enableMissedCallTextBack: false }
      })
    );

    await app.close();
  });

  it('rejects unauthorized admin PATCH updates', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/phone-numbers/pn_1',
      payload: {
        enableMissedCallTextBack: false
      }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'Authorization header required' });
    expect(phoneNumberFindFirstMock).not.toHaveBeenCalled();
    expect(phoneNumberUpdateMock).not.toHaveBeenCalled();

    await app.close();
  });
});
