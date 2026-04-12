import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fastify from 'fastify';
import onboarding from '../onboarding.js';

const {
  tenantFindUniqueMock,
  tenantUpsertMock,
  tenantUpdateMock,
  tenantUserFindUniqueMock,
  tenantUserUpsertMock,
  businessFindFirstMock,
  businessUpsertMock,
  findAvailableLocalNumberMock,
  provisionPhoneNumberForTenantMock
} = vi.hoisted(() => ({
  tenantFindUniqueMock: vi.fn(),
  tenantUpsertMock: vi.fn(),
  tenantUpdateMock: vi.fn(),
  tenantUserFindUniqueMock: vi.fn(),
  tenantUserUpsertMock: vi.fn(),
  businessFindFirstMock: vi.fn(),
  businessUpsertMock: vi.fn(),
  findAvailableLocalNumberMock: vi.fn(),
  provisionPhoneNumberForTenantMock: vi.fn()
}));

vi.mock('../phone-provisioning.js', () => {
  return {
    findAvailableLocalNumber: findAvailableLocalNumberMock,
    provisionPhoneNumberForTenant: provisionPhoneNumberForTenantMock
  };
});

vi.mock('@frontdesk/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@frontdesk/db')>();

  return {
    ...actual,
    prisma: {
      tenant: {
        findUnique: tenantFindUniqueMock,
        upsert: tenantUpsertMock,
        update: tenantUpdateMock
      },
      tenantUser: {
        findUnique: tenantUserFindUniqueMock,
        upsert: tenantUserUpsertMock
      },
      business: {
        findFirst: businessFindFirstMock,
        upsert: businessUpsertMock
      }
    }
  };
});

type MockTenant = {
  id: string;
  onboardingStep: number;
  onboardingComplete: boolean;
  businessName: string | null;
  industry: string | null;
  businessAddress: string | null;
  businessPhone: string | null;
  timezone: string | null;
  greeting: string | null;
  twilioPhoneNumber: string | null;
  plan: string;
  subscriptionStatus: string;
};

function createTenant(overrides: Partial<MockTenant> = {}): MockTenant {
  return {
    id: 'tenant_1',
    onboardingStep: 0,
    onboardingComplete: false,
    businessName: null,
    industry: null,
    businessAddress: null,
    businessPhone: null,
    timezone: null,
    greeting: null,
    twilioPhoneNumber: null,
    plan: 'free',
    subscriptionStatus: 'none',
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

  await app.register(onboarding);
  return app;
}

describe('onboarding wizard routes', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_AUTH_TOKEN = 'auth123';

    tenantFindUniqueMock.mockReset();
    tenantUpsertMock.mockReset();
    tenantUpdateMock.mockReset();
    tenantUserFindUniqueMock.mockReset();
    tenantUserUpsertMock.mockReset();
    businessFindFirstMock.mockReset();
    businessUpsertMock.mockReset();
    findAvailableLocalNumberMock.mockReset();
    provisionPhoneNumberForTenantMock.mockReset();

    tenantFindUniqueMock.mockResolvedValue(createTenant());
    tenantUpsertMock.mockResolvedValue(createTenant());
    tenantUpdateMock.mockResolvedValue({});
    tenantUserFindUniqueMock.mockResolvedValue({ tenantId: 'tenant_1' });
    tenantUserUpsertMock.mockResolvedValue({});
    businessFindFirstMock.mockResolvedValue({ id: 'biz_1' });
    businessUpsertMock.mockResolvedValue({});
    findAvailableLocalNumberMock.mockResolvedValue({ phoneNumber: '+12125551234' });
    provisionPhoneNumberForTenantMock.mockResolvedValue({
      phoneNumber: {
        e164: '+12125551234'
      }
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('GET /v1/onboarding/status returns correct structure for fresh tenant', async () => {
    tenantFindUniqueMock.mockResolvedValueOnce(createTenant());

    const app = await createApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/onboarding/status'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      onboardingStep: 0,
      onboardingComplete: false,
      steps: {
        businessInfo: {
          complete: false,
          data: {
            businessName: null,
            industry: null,
            businessAddress: null,
            businessPhone: null,
            timezone: null
          }
        },
        greeting: {
          complete: false,
          data: {
            greeting: null
          }
        },
        phoneNumber: {
          complete: false,
          data: {
            twilioPhoneNumber: null
          }
        },
        billing: {
          complete: false,
          data: {
            plan: 'free',
            subscriptionStatus: 'none'
          }
        }
      }
    });

    await app.close();
  });

  it('GET /v1/onboarding/status marks completed sub-steps correctly', async () => {
    tenantFindUniqueMock.mockResolvedValueOnce(
      createTenant({
        businessName: 'Skybridge Plumbing',
        industry: 'plumbing',
        twilioPhoneNumber: '+12125550000',
        plan: 'pro',
        subscriptionStatus: 'active'
      })
    );

    const app = await createApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/onboarding/status'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().steps.businessInfo.complete).toBe(true);
    expect(response.json().steps.phoneNumber.complete).toBe(true);
    expect(response.json().steps.billing.complete).toBe(true);

    await app.close();
  });

  it('POST /v1/onboarding/business-info returns 400 for short businessName', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/onboarding/business-info',
      payload: {
        businessName: 'A',
        industry: 'plumbing'
      }
    });

    expect(response.statusCode).toBe(400);

    await app.close();
  });

  it('POST /v1/onboarding/business-info returns 400 for invalid industry', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/onboarding/business-info',
      payload: {
        businessName: 'Skybridge',
        industry: 'invalid'
      }
    });

    expect(response.statusCode).toBe(400);

    await app.close();
  });

  it('POST /v1/onboarding/business-info updates tenant and sets onboardingStep = 1', async () => {
    tenantFindUniqueMock.mockResolvedValueOnce(createTenant({ onboardingStep: 0 }));

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/onboarding/business-info',
      payload: {
        businessName: 'Skybridge HVAC',
        industry: 'hvac',
        businessAddress: '123 Main St',
        businessPhone: '+12125550100',
        timezone: 'America/Chicago'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      success: true,
      onboardingStep: 1
    });

    expect(tenantUpdateMock).toHaveBeenCalledWith({
      where: {
        id: 'tenant_1'
      },
      data: {
        businessName: 'Skybridge HVAC',
        industry: 'hvac',
        businessAddress: '123 Main St',
        businessPhone: '+12125550100',
        timezone: 'America/Chicago',
        onboardingStep: 1
      }
    });

    await app.close();
  });

  it('POST /v1/onboarding/greeting saves custom greeting and sets onboardingStep = 2', async () => {
    tenantFindUniqueMock.mockResolvedValueOnce(createTenant({ onboardingStep: 1 }));
    tenantUpdateMock.mockResolvedValueOnce({ greeting: 'Thanks for calling Skybridge!' });

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/onboarding/greeting',
      payload: {
        greeting: 'Thanks for calling Skybridge!'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      success: true,
      onboardingStep: 2,
      greeting: 'Thanks for calling Skybridge!'
    });

    await app.close();
  });

  it('POST /v1/onboarding/greeting sets greeting to null when useDefault=true', async () => {
    tenantFindUniqueMock.mockResolvedValueOnce(createTenant({ onboardingStep: 1, greeting: 'Custom greeting' }));
    tenantUpdateMock.mockResolvedValueOnce({ greeting: null });

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/onboarding/greeting',
      payload: {
        useDefault: true
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      success: true,
      onboardingStep: 2,
      greeting: null
    });

    expect(tenantUpdateMock).toHaveBeenCalledWith({
      where: {
        id: 'tenant_1'
      },
      data: {
        greeting: null,
        onboardingStep: 2
      },
      select: {
        greeting: true
      }
    });

    await app.close();
  });

  it('POST /v1/onboarding/greeting returns 400 when greeting exceeds 500 chars', async () => {
    const longGreeting = 'x'.repeat(501);
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/onboarding/greeting',
      payload: {
        greeting: longGreeting
      }
    });

    expect(response.statusCode).toBe(400);

    await app.close();
  });

  it('POST /v1/onboarding/phone-number returns 503 when Twilio credentials are missing', async () => {
    delete process.env.TWILIO_ACCOUNT_SID;

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/onboarding/phone-number',
      payload: {}
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      error: 'Phone service not configured'
    });

    await app.close();
  });

  it('POST /v1/onboarding/phone-number provisions number and sets onboardingStep = 3', async () => {
    tenantFindUniqueMock.mockResolvedValueOnce(createTenant({ onboardingStep: 2 }));
    tenantUpdateMock.mockResolvedValueOnce({ twilioPhoneNumber: '+12125551234' });

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/onboarding/phone-number',
      payload: {
        areaCode: '212'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      success: true,
      onboardingStep: 3,
      phoneNumber: '+12125551234'
    });

    expect(findAvailableLocalNumberMock).toHaveBeenCalledWith({
      areaCode: '212'
    });
    expect(provisionPhoneNumberForTenantMock).toHaveBeenCalledWith({
      tenantId: 'tenant_1',
      businessId: 'biz_1',
      phoneNumber: '+12125551234'
    });

    await app.close();
  });

  it('POST /v1/onboarding/complete returns 400 when business info is incomplete', async () => {
    tenantFindUniqueMock.mockResolvedValueOnce(createTenant());

    const app = await createApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/onboarding/complete'
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'Complete business info first'
    });

    await app.close();
  });

  it('POST /v1/onboarding/complete returns 400 when phone number is missing', async () => {
    tenantFindUniqueMock.mockResolvedValueOnce(
      createTenant({
        businessName: 'Skybridge HVAC',
        industry: 'hvac'
      })
    );

    const app = await createApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/onboarding/complete'
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'Provision a phone number first'
    });

    await app.close();
  });

  it('POST /v1/onboarding/complete sets onboardingComplete = true', async () => {
    tenantFindUniqueMock.mockResolvedValueOnce(
      createTenant({
        onboardingStep: 3,
        businessName: 'Skybridge HVAC',
        industry: 'hvac',
        twilioPhoneNumber: '+12125551234'
      })
    );

    const app = await createApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/onboarding/complete'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      success: true,
      onboardingComplete: true
    });

    expect(tenantUpdateMock).toHaveBeenCalledWith({
      where: {
        id: 'tenant_1'
      },
      data: {
        onboardingStep: 4,
        onboardingComplete: true
      }
    });

    await app.close();
  });

  it('POST /v1/onboarding/skip sets onboardingComplete = true and returns skipped', async () => {
    tenantFindUniqueMock.mockResolvedValueOnce(createTenant());

    const app = await createApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/onboarding/skip'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      success: true,
      skipped: true
    });

    expect(tenantUpdateMock).toHaveBeenCalledWith({
      where: {
        id: 'tenant_1'
      },
      data: {
        onboardingComplete: true
      }
    });

    await app.close();
  });
});
