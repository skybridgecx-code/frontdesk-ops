import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fastify from 'fastify';
import { PhoneRoutingMode, PhoneNumberProvider } from '@frontdesk/db';
import { requireActiveSubscription } from '../lib/subscription-guard.js';
import { registerPhoneProvisioningRoutes } from '../routes/phone-provisioning.js';

const { getTwilioClientMock, businessFindFirstMock, phoneNumberCreateMock, phoneNumberFindFirstMock, phoneNumberUpdateMock } = vi.hoisted(() => ({
  getTwilioClientMock: vi.fn(),
  businessFindFirstMock: vi.fn(),
  phoneNumberCreateMock: vi.fn(),
  phoneNumberFindFirstMock: vi.fn(),
  phoneNumberUpdateMock: vi.fn()
}));

vi.mock('../lib/twilio-client.js', () => {
  return {
    getTwilioClient: getTwilioClientMock
  };
});

vi.mock('@frontdesk/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@frontdesk/db')>();
  return {
    ...actual,
    prisma: {
      $queryRaw: vi.fn().mockResolvedValue([]),
      business: {
        findFirst: businessFindFirstMock
      },
      phoneNumber: {
        create: phoneNumberCreateMock,
        findFirst: phoneNumberFindFirstMock,
        update: phoneNumberUpdateMock
      }
    }
  };
});

type AvailableNumber = {
  phoneNumber: string;
  friendlyName?: string;
  locality?: string | null;
  region?: string | null;
  postalCode?: string | null;
  capabilities?: {
    voice?: boolean;
    sms?: boolean;
    mms?: boolean;
    fax?: boolean;
  };
};

type PurchasedNumber = {
  sid: string;
  phoneNumber: string;
  friendlyName: string;
  capabilities?: {
    voice?: boolean;
    sms?: boolean;
    mms?: boolean;
    fax?: boolean;
  };
};

type SearchOptions = {
  limit: number;
  areaCode?: number;
  contains?: string;
};

type IncomingCreateParams = {
  phoneNumber: string;
  voiceUrl: string;
  voiceMethod: string;
  statusCallback: string;
  statusCallbackMethod: string;
};

type TwilioClientMock = {
  availablePhoneNumbers: (country: string) => {
    local: {
      list: (options: SearchOptions) => Promise<AvailableNumber[]>;
    };
  };
  incomingPhoneNumbers: ((sid: string) => { remove: () => Promise<boolean> }) & {
    create: (params: IncomingCreateParams) => Promise<PurchasedNumber>;
  };
};

function createTwilioClient(input: {
  availableNumbers?: AvailableNumber[];
  purchasedNumber?: PurchasedNumber;
  removeResult?: boolean;
}) {
  const listMock = vi.fn<(options: SearchOptions) => Promise<AvailableNumber[]>>();
  const createMock = vi.fn<(params: IncomingCreateParams) => Promise<PurchasedNumber>>();
  const removeMock = vi.fn<() => Promise<boolean>>();

  listMock.mockResolvedValue(input.availableNumbers ?? []);
  createMock.mockResolvedValue(
    input.purchasedNumber ?? {
      sid: 'PN_default',
      phoneNumber: '+17035550100',
      friendlyName: '(703) 555-0100',
      capabilities: {
        voice: true,
        sms: true,
        mms: false,
        fax: false
      }
    }
  );
  removeMock.mockResolvedValue(input.removeResult ?? true);

  const incomingPhoneNumbers = Object.assign(
    (_sid: string) => ({
      remove: removeMock
    }),
    {
      create: createMock
    }
  );

  const client: TwilioClientMock = {
    availablePhoneNumbers: (_country: string) => ({
      local: {
        list: listMock
      }
    }),
    incomingPhoneNumbers
  };

  return {
    client,
    listMock,
    createMock,
    removeMock
  };
}

async function createApp(input?: {
  enforceSubscription?: boolean;
}) {
  const app = fastify({ logger: false });

  app.addHook('onRequest', async (request) => {
    Object.defineProperty(request, 'tenantId', {
      value: 'tenant_1',
      writable: true,
      configurable: true
    });
  });

  if (input?.enforceSubscription) {
    app.addHook('preHandler', async (request, reply) => {
      const ok = await requireActiveSubscription(request, reply);
      if (!ok) {
        return reply;
      }
    });
  }

  await app.register(registerPhoneProvisioningRoutes);
  return app;
}

describe('phone provisioning routes', () => {
  const originalEnv = { ...process.env };
  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.FRONTDESK_API_PUBLIC_URL = 'https://api.example.com';

    getTwilioClientMock.mockReset();
    businessFindFirstMock.mockReset();
    phoneNumberCreateMock.mockReset();
    phoneNumberFindFirstMock.mockReset();
    phoneNumberUpdateMock.mockReset();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('search-numbers returns available numbers from Twilio', async () => {
    const { client, listMock } = createTwilioClient({
      availableNumbers: [
        {
          phoneNumber: '+12025550100',
          friendlyName: '(202) 555-0100',
          locality: 'Washington',
          region: 'DC',
          postalCode: '20001',
          capabilities: {
            voice: true,
            sms: true,
            mms: false,
            fax: false
          }
        }
      ]
    });

    getTwilioClientMock.mockReturnValue(client);

    const app = await createApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/provisioning/search-numbers?country=US&areaCode=202&limit=5&contains=77'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      numbers: [
        {
          phoneNumber: '+12025550100',
          friendlyName: '(202) 555-0100',
          locality: 'Washington',
          region: 'DC',
          postalCode: '20001',
          capabilities: {
            voice: true,
            sms: true,
            mms: false,
            fax: false
          }
        }
      ]
    });

    expect(listMock).toHaveBeenCalledWith({
      limit: 5,
      areaCode: 202,
      contains: '77'
    });

    await app.close();
  });

  it('search-numbers validates query params', async () => {
    const { client } = createTwilioClient({});
    getTwilioClientMock.mockReturnValue(client);

    const app = await createApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/provisioning/search-numbers?limit=50'
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('purchase-number creates Twilio number and DB record', async () => {
    const { client, createMock } = createTwilioClient({
      purchasedNumber: {
        sid: 'PN123',
        phoneNumber: '+17035550123',
        friendlyName: '(703) 555-0123',
        capabilities: {
          voice: true,
          sms: true,
          mms: true,
          fax: false
        }
      }
    });

    getTwilioClientMock.mockReturnValue(client);

    businessFindFirstMock.mockResolvedValue({
      id: 'biz_1',
      tenantId: 'tenant_1'
    } as never);

    phoneNumberCreateMock.mockResolvedValue({
      id: 'pn_1',
      tenantId: 'tenant_1',
      businessId: 'biz_1',
      locationId: null,
      provider: PhoneNumberProvider.TWILIO,
      externalSid: 'PN123',
      e164: '+17035550123',
      label: '(703) 555-0123',
      isActive: true,
      routingMode: PhoneRoutingMode.AI_ALWAYS,
      primaryAgentProfileId: null,
      afterHoursAgentProfileId: null,
      enableMissedCallTextBack: true,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-01T00:00:00.000Z')
    } as never);

    const app = await createApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/provisioning/purchase-number',
      payload: {
        phoneNumber: '+17035550123',
        businessId: 'biz_1'
      }
    });

    expect(response.statusCode).toBe(200);
    const data = response.json() as {
      ok: boolean;
      phoneNumber: {
        id: string;
        e164: string;
        externalSid: string | null;
        capabilities: {
          voice: boolean;
          sms: boolean;
          mms: boolean;
          fax: boolean;
        } | null;
      };
    };

    expect(data.ok).toBe(true);
    expect(data.phoneNumber.id).toBe('pn_1');
    expect(data.phoneNumber.e164).toBe('+17035550123');
    expect(data.phoneNumber.externalSid).toBe('PN123');
    expect(data.phoneNumber.capabilities).toEqual({
      voice: true,
      sms: true,
      mms: true,
      fax: false
    });

    expect(createMock).toHaveBeenCalledWith({
      phoneNumber: '+17035550123',
      voiceUrl: 'https://api.example.com/v1/twilio/voice/inbound',
      voiceMethod: 'POST',
      statusCallback: 'https://api.example.com/v1/twilio/voice/status',
      statusCallbackMethod: 'POST'
    });

    await app.close();
  });

  it('purchase-number falls back to FRONTDESK_API_BASE_URL when FRONTDESK_API_PUBLIC_URL is missing', async () => {
    delete process.env.FRONTDESK_API_PUBLIC_URL;
    process.env.FRONTDESK_API_BASE_URL = 'https://frontdesk-ops.onrender.com/';

    const { client, createMock } = createTwilioClient({
      purchasedNumber: {
        sid: 'PN124',
        phoneNumber: '+17035550124',
        friendlyName: '(703) 555-0124',
        capabilities: {
          voice: true,
          sms: true,
          mms: true,
          fax: false
        }
      }
    });

    getTwilioClientMock.mockReturnValue(client);

    businessFindFirstMock.mockResolvedValue({
      id: 'biz_1',
      tenantId: 'tenant_1'
    } as never);

    phoneNumberCreateMock.mockResolvedValue({
      id: 'pn_2',
      tenantId: 'tenant_1',
      businessId: 'biz_1',
      locationId: null,
      provider: PhoneNumberProvider.TWILIO,
      externalSid: 'PN124',
      e164: '+17035550124',
      label: '(703) 555-0124',
      isActive: true,
      routingMode: PhoneRoutingMode.AI_ALWAYS,
      primaryAgentProfileId: null,
      afterHoursAgentProfileId: null,
      enableMissedCallTextBack: true,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-01T00:00:00.000Z')
    } as never);

    const app = await createApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/provisioning/purchase-number',
      payload: {
        phoneNumber: '+17035550124',
        businessId: 'biz_1'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(createMock).toHaveBeenCalledWith({
      phoneNumber: '+17035550124',
      voiceUrl: 'https://frontdesk-ops.onrender.com/v1/twilio/voice/inbound',
      voiceMethod: 'POST',
      statusCallback: 'https://frontdesk-ops.onrender.com/v1/twilio/voice/status',
      statusCallbackMethod: 'POST'
    });

    await app.close();
  });

  it('purchase-number validates businessId belongs to tenant', async () => {
    const { client, createMock } = createTwilioClient({});
    getTwilioClientMock.mockReturnValue(client);

    businessFindFirstMock.mockResolvedValue(null);

    const app = await createApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/provisioning/purchase-number',
      payload: {
        phoneNumber: '+17035550123',
        businessId: 'biz_2'
      }
    });

    expect(response.statusCode).toBe(403);
    expect(createMock).not.toHaveBeenCalled();
    expect(businessFindFirstMock).toHaveBeenCalledWith({
      where: {
        id: 'biz_2',
        tenantId: 'tenant_1'
      },
      select: {
        id: true,
        tenantId: true
      }
    });

    await app.close();
  });

  it('purchase-number with invalid businessId returns 403', async () => {
    const { client, createMock } = createTwilioClient({});
    getTwilioClientMock.mockReturnValue(client);

    businessFindFirstMock.mockResolvedValue(null);

    const app = await createApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/provisioning/purchase-number',
      payload: {
        phoneNumber: '+17035550124',
        businessId: 'missing_business'
      }
    });

    expect(response.statusCode).toBe(403);
    expect(createMock).not.toHaveBeenCalled();

    await app.close();
  });

  it('release-number deactivates phone number', async () => {
    const { client, removeMock } = createTwilioClient({
      removeResult: true
    });

    getTwilioClientMock.mockReturnValue(client);

    phoneNumberFindFirstMock.mockResolvedValue({
      id: 'pn_1',
      externalSid: 'PN123',
      isActive: true
    } as never);

    phoneNumberUpdateMock.mockResolvedValue({
      id: 'pn_1',
      tenantId: 'tenant_1',
      businessId: 'biz_1',
      locationId: null,
      provider: PhoneNumberProvider.TWILIO,
      externalSid: 'PN123',
      e164: '+17035550123',
      label: '(703) 555-0123',
      isActive: false,
      routingMode: PhoneRoutingMode.AI_ALWAYS,
      primaryAgentProfileId: null,
      afterHoursAgentProfileId: null,
      enableMissedCallTextBack: true,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-01T00:00:00.000Z')
    });

    const app = await createApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/provisioning/release-number',
      payload: {
        phoneNumberId: 'pn_1'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      success: true
    });
    expect(removeMock).toHaveBeenCalledTimes(1);
    expect(phoneNumberUpdateMock).toHaveBeenCalledWith({
      where: {
        id: 'pn_1'
      },
      data: {
        isActive: false
      }
    });

    await app.close();
  });

  it('release-number validates phone belongs to tenant', async () => {
    const { client, removeMock } = createTwilioClient({});
    getTwilioClientMock.mockReturnValue(client);

    phoneNumberFindFirstMock.mockResolvedValue(null);

    const app = await createApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/provisioning/release-number',
      payload: {
        phoneNumberId: 'pn_missing'
      }
    });

    expect(response.statusCode).toBe(403);
    expect(removeMock).not.toHaveBeenCalled();

    await app.close();
  });

  it('all provisioning routes require active subscription', async () => {
    const { client, listMock, createMock, removeMock } = createTwilioClient({});
    getTwilioClientMock.mockReturnValue(client);

    const app = await createApp({ enforceSubscription: true });

    const searchResponse = await app.inject({
      method: 'GET',
      url: '/v1/provisioning/search-numbers'
    });

    const purchaseResponse = await app.inject({
      method: 'POST',
      url: '/v1/provisioning/purchase-number',
      payload: {
        phoneNumber: '+17035550123',
        businessId: 'biz_1'
      }
    });

    const releaseResponse = await app.inject({
      method: 'POST',
      url: '/v1/provisioning/release-number',
      payload: {
        phoneNumberId: 'pn_1'
      }
    });

    expect([403, 500]).toContain(searchResponse.statusCode);
    expect([403, 500]).toContain(purchaseResponse.statusCode);
    expect([403, 500]).toContain(releaseResponse.statusCode);

    expect(listMock).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
    expect(removeMock).not.toHaveBeenCalled();

    await app.close();
  });
});
