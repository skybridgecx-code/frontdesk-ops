import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fastify from 'fastify';
import settings from '../settings.js';

const {
  tenantFindUniqueMock,
  tenantUpdateMock,
  businessFindFirstMock,
  findAvailableLocalNumberMock,
  provisionPhoneNumberForTenantMock,
  getTwilioClientMock,
  incomingPhoneNumbersListMock,
  incomingPhoneNumbersRemoveMock,
  incomingPhoneNumbersBySidMock
} = vi.hoisted(() => {
  const incomingPhoneNumbersList = vi.fn();
  const incomingPhoneNumbersRemove = vi.fn();
  const incomingPhoneNumbersBySid = vi.fn().mockImplementation((_sid: string) => ({
    remove: incomingPhoneNumbersRemove
  }));

  const incomingPhoneNumbers = Object.assign(incomingPhoneNumbersBySid, {
    list: incomingPhoneNumbersList
  });

  return {
    tenantFindUniqueMock: vi.fn(),
    tenantUpdateMock: vi.fn(),
    businessFindFirstMock: vi.fn(),
    findAvailableLocalNumberMock: vi.fn(),
    provisionPhoneNumberForTenantMock: vi.fn(),
    getTwilioClientMock: vi.fn(() => ({
      incomingPhoneNumbers
    })),
    incomingPhoneNumbersListMock: incomingPhoneNumbersList,
    incomingPhoneNumbersRemoveMock: incomingPhoneNumbersRemove,
    incomingPhoneNumbersBySidMock: incomingPhoneNumbersBySid
  };
});

vi.mock('../phone-provisioning.js', () => {
  return {
    findAvailableLocalNumber: findAvailableLocalNumberMock,
    provisionPhoneNumberForTenant: provisionPhoneNumberForTenantMock
  };
});

vi.mock('../../lib/twilio-client.js', () => {
  return {
    getTwilioClient: getTwilioClientMock
  };
});

vi.mock('@frontdesk/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@frontdesk/db')>();

  return {
    ...actual,
    prisma: {
      tenant: {
        findUnique: tenantFindUniqueMock,
        update: tenantUpdateMock
      },
      business: {
        findFirst: businessFindFirstMock
      }
    }
  };
});

type MockTenant = {
  id: string;
  name: string;
  email: string | null;
  businessName: string | null;
  industry: string | null;
  businessAddress: string | null;
  businessPhone: string | null;
  timezone: string | null;
  greeting: string | null;
  twilioPhoneNumber: string | null;
  webhookUrl: string | null;
  webhookSecret: string | null;
  webhookEnabled: boolean;
  notifyEmail: boolean;
  notifySmsMissedCall: boolean;
  notifyEmailVoicemail: boolean;
  plan: string;
  subscriptionStatus: string;
  createdAt: Date;
};

function createTenant(overrides: Partial<MockTenant> = {}): MockTenant {
  return {
    id: 'tenant_1',
    name: 'SkybridgeCX',
    email: 'owner@skybridgecx.co',
    businessName: 'Skybridge Plumbing',
    industry: 'plumbing',
    businessAddress: '123 Main St',
    businessPhone: '+12125550000',
    timezone: 'America/New_York',
    greeting: 'Thanks for calling Skybridge Plumbing!',
    twilioPhoneNumber: '+12125551234',
    webhookUrl: 'https://crm.example.com/webhooks/calls',
    webhookSecret: 'secret-abcdef7890',
    webhookEnabled: true,
    notifyEmail: true,
    notifySmsMissedCall: true,
    notifyEmailVoicemail: true,
    plan: 'pro',
    subscriptionStatus: 'active',
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    ...overrides
  };
}

async function createApp(clerkUserId = 'user_1') {
  const app = fastify({ logger: false });

  app.addHook('onRequest', async (request) => {
    if (!clerkUserId) {
      return;
    }

    Object.defineProperty(request, 'clerkUserId', {
      configurable: true,
      writable: true,
      value: clerkUserId
    });
  });

  await app.register(settings);
  return app;
}

describe('settings routes', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_AUTH_TOKEN = 'auth123';

    tenantFindUniqueMock.mockReset();
    tenantUpdateMock.mockReset();
    businessFindFirstMock.mockReset();
    findAvailableLocalNumberMock.mockReset();
    provisionPhoneNumberForTenantMock.mockReset();
    getTwilioClientMock.mockClear();
    incomingPhoneNumbersListMock.mockReset();
    incomingPhoneNumbersRemoveMock.mockReset();
    incomingPhoneNumbersBySidMock.mockClear();

    tenantFindUniqueMock.mockResolvedValue(createTenant());
    tenantUpdateMock.mockResolvedValue({});
    businessFindFirstMock.mockResolvedValue({ id: 'biz_1' });
    findAvailableLocalNumberMock.mockResolvedValue({ phoneNumber: '+12125557654' });
    provisionPhoneNumberForTenantMock.mockResolvedValue({
      phoneNumber: {
        e164: '+12125557654'
      }
    });
    incomingPhoneNumbersListMock.mockResolvedValue([{ sid: 'PN123' }]);
    incomingPhoneNumbersRemoveMock.mockResolvedValue(true);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('GET /v1/settings returns structured settings and masks webhook secret', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/v1/settings'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      business: {
        businessName: 'Skybridge Plumbing',
        industry: 'plumbing',
        businessAddress: '123 Main St',
        businessPhone: '+12125550000',
        timezone: 'America/New_York'
      },
      greeting: {
        greeting: 'Thanks for calling Skybridge Plumbing!',
        defaultGreeting: 'Thanks for calling Skybridge Plumbing. How can we help you today?'
      },
      phone: {
        twilioPhoneNumber: '+12125551234'
      },
      webhook: {
        webhookUrl: 'https://crm.example.com/webhooks/calls',
        webhookSecret: '••••7890',
        webhookEnabled: true
      },
      notifications: {
        notifyEmail: true,
        notifySmsMissedCall: true,
        notifyEmailVoicemail: true
      },
      account: {
        email: 'owner@skybridgecx.co',
        name: 'SkybridgeCX',
        plan: 'pro',
        subscriptionStatus: 'active',
        createdAt: '2026-01-01T10:00:00.000Z'
      }
    });

    await app.close();
  });

  it('GET /v1/settings returns null optional values and default greeting fallback', async () => {
    tenantFindUniqueMock.mockResolvedValueOnce(
      createTenant({
        businessName: null,
        industry: null,
        businessAddress: null,
        businessPhone: null,
        timezone: null,
        greeting: null,
        twilioPhoneNumber: null,
        webhookUrl: null,
        webhookSecret: null,
        webhookEnabled: false
      })
    );

    const app = await createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/v1/settings'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().business).toEqual({
      businessName: null,
      industry: null,
      businessAddress: null,
      businessPhone: null,
      timezone: null
    });
    expect(response.json().webhook).toEqual({
      webhookUrl: null,
      webhookSecret: null,
      webhookEnabled: false
    });
    expect(response.json().greeting.defaultGreeting).toBe('Thanks for calling our office. How can we help you today?');

    await app.close();
  });

  it('PUT /v1/settings/business updates businessName successfully', async () => {
    tenantUpdateMock.mockResolvedValueOnce({
      businessName: 'Updated Plumbing Co',
      industry: 'plumbing',
      businessAddress: '123 Main St',
      businessPhone: '+12125550000',
      timezone: 'America/New_York'
    });

    const app = await createApp();

    const response = await app.inject({
      method: 'PUT',
      url: '/v1/settings/business',
      payload: {
        businessName: 'Updated Plumbing Co'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      success: true,
      business: {
        businessName: 'Updated Plumbing Co',
        industry: 'plumbing',
        businessAddress: '123 Main St',
        businessPhone: '+12125550000',
        timezone: 'America/New_York'
      }
    });

    expect(tenantUpdateMock).toHaveBeenCalledWith({
      where: {
        id: 'tenant_1'
      },
      data: {
        businessName: 'Updated Plumbing Co'
      },
      select: {
        businessName: true,
        industry: true,
        businessAddress: true,
        businessPhone: true,
        timezone: true
      }
    });

    await app.close();
  });

  it('PUT /v1/settings/business returns 400 for short businessName', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'PUT',
      url: '/v1/settings/business',
      payload: {
        businessName: 'A'
      }
    });

    expect(response.statusCode).toBe(400);

    await app.close();
  });

  it('PUT /v1/settings/business returns 400 for invalid industry', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'PUT',
      url: '/v1/settings/business',
      payload: {
        industry: 'invalid'
      }
    });

    expect(response.statusCode).toBe(400);

    await app.close();
  });

  it('PUT /v1/settings/business supports partial updates only', async () => {
    tenantUpdateMock.mockResolvedValueOnce({
      businessName: 'Skybridge Plumbing',
      industry: 'plumbing',
      businessAddress: '999 New Address',
      businessPhone: '+12125550000',
      timezone: 'America/New_York'
    });

    const app = await createApp();

    const response = await app.inject({
      method: 'PUT',
      url: '/v1/settings/business',
      payload: {
        businessAddress: '999 New Address'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(tenantUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          businessAddress: '999 New Address'
        }
      })
    );

    await app.close();
  });

  it('PUT /v1/settings/greeting saves custom greeting', async () => {
    tenantUpdateMock.mockResolvedValueOnce({
      greeting: 'Hello from Skybridge!',
      businessName: 'Skybridge Plumbing'
    });

    const app = await createApp();

    const response = await app.inject({
      method: 'PUT',
      url: '/v1/settings/greeting',
      payload: {
        greeting: 'Hello from Skybridge!'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      success: true,
      greeting: 'Hello from Skybridge!',
      defaultGreeting: 'Thanks for calling Skybridge Plumbing. How can we help you today?'
    });

    await app.close();
  });

  it('PUT /v1/settings/greeting sets greeting to null when useDefault=true', async () => {
    tenantUpdateMock.mockResolvedValueOnce({
      greeting: null,
      businessName: 'Skybridge Plumbing'
    });

    const app = await createApp();

    const response = await app.inject({
      method: 'PUT',
      url: '/v1/settings/greeting',
      payload: {
        useDefault: true
      }
    });

    expect(response.statusCode).toBe(200);
    expect(tenantUpdateMock).toHaveBeenCalledWith({
      where: {
        id: 'tenant_1'
      },
      data: {
        greeting: null
      },
      select: {
        greeting: true,
        businessName: true
      }
    });

    await app.close();
  });

  it('PUT /v1/settings/greeting returns 400 when greeting exceeds 500 chars', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'PUT',
      url: '/v1/settings/greeting',
      payload: {
        greeting: 'x'.repeat(501)
      }
    });

    expect(response.statusCode).toBe(400);

    await app.close();
  });

  it('PUT /v1/settings/webhook saves valid HTTPS webhook URL', async () => {
    tenantUpdateMock.mockResolvedValueOnce({
      webhookUrl: 'https://hooks.example.com/calls',
      webhookSecret: 'my-secret-1234',
      webhookEnabled: true
    });

    const app = await createApp();

    const response = await app.inject({
      method: 'PUT',
      url: '/v1/settings/webhook',
      payload: {
        webhookUrl: 'https://hooks.example.com/calls',
        webhookSecret: 'my-secret-1234',
        webhookEnabled: true
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      success: true,
      webhook: {
        webhookUrl: 'https://hooks.example.com/calls',
        webhookEnabled: true,
        webhookSecret: '••••1234'
      }
    });

    await app.close();
  });

  it('PUT /v1/settings/webhook returns 400 for non-HTTPS URL', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'PUT',
      url: '/v1/settings/webhook',
      payload: {
        webhookUrl: 'http://hooks.example.com/calls'
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'Webhook URL must use HTTPS'
    });

    await app.close();
  });

  it('PUT /v1/settings/webhook returns 400 for short webhook secret', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'PUT',
      url: '/v1/settings/webhook',
      payload: {
        webhookSecret: 'short'
      }
    });

    expect(response.statusCode).toBe(400);

    await app.close();
  });

  it('PUT /v1/settings/notifications updates notification preferences with partial payload', async () => {
    tenantUpdateMock.mockResolvedValueOnce({
      notifyEmail: false,
      notifySmsMissedCall: true,
      notifyEmailVoicemail: true
    });

    const app = await createApp();

    const response = await app.inject({
      method: 'PUT',
      url: '/v1/settings/notifications',
      payload: {
        notifyEmail: false
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      success: true,
      notifications: {
        notifyEmail: false,
        notifySmsMissedCall: true,
        notifyEmailVoicemail: true
      }
    });

    expect(tenantUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          notifyEmail: false
        }
      })
    );

    await app.close();
  });

  it('POST /v1/settings/phone/provision returns 400 when phone already exists', async () => {
    tenantFindUniqueMock.mockResolvedValueOnce(
      createTenant({
        twilioPhoneNumber: '+12125559999'
      })
    );

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/settings/phone/provision',
      payload: {}
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'Phone number already provisioned. Release it first.'
    });

    await app.close();
  });

  it('POST /v1/settings/phone/provision returns 503 when Twilio is not configured', async () => {
    delete process.env.TWILIO_ACCOUNT_SID;

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/settings/phone/provision',
      payload: {}
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      error: 'Phone service not configured'
    });

    await app.close();
  });

  it('POST /v1/settings/phone/provision provisions and saves number', async () => {
    tenantFindUniqueMock.mockResolvedValueOnce(
      createTenant({
        twilioPhoneNumber: null
      })
    );

    tenantUpdateMock.mockResolvedValueOnce({
      twilioPhoneNumber: '+12125557654'
    });

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/settings/phone/provision',
      payload: {
        areaCode: '212'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      success: true,
      phoneNumber: '+12125557654'
    });

    expect(findAvailableLocalNumberMock).toHaveBeenCalledWith({
      areaCode: '212'
    });

    expect(provisionPhoneNumberForTenantMock).toHaveBeenCalledWith({
      tenantId: 'tenant_1',
      businessId: 'biz_1',
      phoneNumber: '+12125557654'
    });

    await app.close();
  });

  it('POST /v1/settings/phone/release returns 400 when no number is set', async () => {
    tenantFindUniqueMock.mockResolvedValueOnce(
      createTenant({
        twilioPhoneNumber: null
      })
    );

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/settings/phone/release'
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'No phone number to release'
    });

    await app.close();
  });

  it('POST /v1/settings/phone/release releases Twilio number and clears tenant field', async () => {
    tenantFindUniqueMock.mockResolvedValueOnce(
      createTenant({
        twilioPhoneNumber: '+12125551234'
      })
    );

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/settings/phone/release'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      success: true,
      released: true
    });

    expect(getTwilioClientMock).toHaveBeenCalledTimes(1);
    expect(incomingPhoneNumbersListMock).toHaveBeenCalledWith({
      phoneNumber: '+12125551234',
      limit: 1
    });
    expect(incomingPhoneNumbersBySidMock).toHaveBeenCalledWith('PN123');
    expect(incomingPhoneNumbersRemoveMock).toHaveBeenCalledTimes(1);

    expect(tenantUpdateMock).toHaveBeenCalledWith({
      where: {
        id: 'tenant_1'
      },
      data: {
        twilioPhoneNumber: null
      }
    });

    await app.close();
  });

  it('POST /v1/settings/phone/release handles Twilio error and still clears number', async () => {
    tenantFindUniqueMock.mockResolvedValueOnce(
      createTenant({
        twilioPhoneNumber: '+12125551234'
      })
    );

    incomingPhoneNumbersListMock.mockRejectedValueOnce(new Error('Twilio release failed'));

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/settings/phone/release'
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: 'Twilio release failed'
    });

    expect(tenantUpdateMock).toHaveBeenCalledWith({
      where: {
        id: 'tenant_1'
      },
      data: {
        twilioPhoneNumber: null
      }
    });

    await app.close();
  });
});
