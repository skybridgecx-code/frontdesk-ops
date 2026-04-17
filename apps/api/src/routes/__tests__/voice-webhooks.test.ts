import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fastify from 'fastify';
import formbody from '@fastify/formbody';
import { PhoneRoutingMode } from '@frontdesk/db';
import { registerVoiceWebhookRoutes } from '../voice-webhooks.js';

const {
  phoneNumberFindUniqueMock,
  callUpsertMock,
  callEventCountMock,
  callEventCreateMock,
  requireTwilioSignatureMock,
  enforceUsageLimitsMock
} = vi.hoisted(() => ({
  phoneNumberFindUniqueMock: vi.fn(),
  callUpsertMock: vi.fn(),
  callEventCountMock: vi.fn(),
  callEventCreateMock: vi.fn(),
  requireTwilioSignatureMock: vi.fn(),
  enforceUsageLimitsMock: vi.fn()
}));

vi.mock('../../lib/twilio-validation.js', () => ({
  requireTwilioSignature: requireTwilioSignatureMock
}));

vi.mock('../../lib/usage-limiter.js', () => ({
  enforceUsageLimits: enforceUsageLimitsMock
}));

vi.mock('@frontdesk/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@frontdesk/db')>();

  return {
    ...actual,
    prisma: {
      phoneNumber: {
        findUnique: phoneNumberFindUniqueMock
      },
      call: {
        upsert: callUpsertMock
      },
      callEvent: {
        count: callEventCountMock,
        create: callEventCreateMock
      }
    }
  };
});

function toFormPayload(payload: Record<string, string>) {
  return new URLSearchParams(payload).toString();
}

async function createApp() {
  const app = fastify({ logger: false });
  await app.register(formbody);
  await registerVoiceWebhookRoutes(app);
  return app;
}

describe('voice-webhooks TwiML stream parameters', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.FRONTDESK_REALTIME_WS_BASE_URL = 'wss://realtime.example.com/ws/media-stream';
    process.env.FRONTDESK_API_PUBLIC_URL = 'https://api.example.com';
    process.env.FRONTDESK_INTERNAL_API_SECRET = 'super-secret';

    phoneNumberFindUniqueMock.mockReset();
    callUpsertMock.mockReset();
    callEventCountMock.mockReset();
    callEventCreateMock.mockReset();
    requireTwilioSignatureMock.mockReset();
    enforceUsageLimitsMock.mockReset();

    requireTwilioSignatureMock.mockReturnValue({ valid: true });
    enforceUsageLimitsMock.mockReturnValue(async () => {});
    callEventCountMock.mockResolvedValue(0);
    callEventCreateMock.mockResolvedValue({ id: 'evt_1' });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('includes signed custom <Parameter> stream context without exposing raw secret', async () => {
    phoneNumberFindUniqueMock.mockResolvedValue({
      id: 'pn_1',
      tenantId: 'tenant_1',
      businessId: 'business_1',
      e164: '+12029359687',
      label: 'Main line',
      isActive: true,
      routingMode: PhoneRoutingMode.AI_ALWAYS,
      primaryAgentProfileId: 'ap_1',
      afterHoursAgentProfileId: null,
      business: {
        id: 'business_1',
        name: 'Acme',
        timezone: 'America/New_York',
        businessHours: []
      }
    });

    callUpsertMock.mockResolvedValue({
      id: 'call_1',
      phoneNumberId: 'pn_1',
      agentProfileId: 'ap_1'
    });

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/twilio/voice/inbound',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      payload: toFormPayload({
        CallSid: 'CA123',
        From: '+15551234567',
        To: '+12029359687'
      })
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/xml');
    expect(response.body).toContain('<Stream url="wss://realtime.example.com/ws/media-stream">');
    expect(response.body).toContain('<Parameter name="callSid" value="CA123" />');
    expect(response.body).toContain('<Parameter name="phoneNumberId" value="pn_1" />');
    expect(response.body).toContain('<Parameter name="tenantId" value="tenant_1" />');
    expect(response.body).toContain('<Parameter name="businessId" value="business_1" />');
    expect(response.body).toContain('<Parameter name="agentProfileId" value="ap_1" />');

    const expectedSignature = createHmac('sha256', 'super-secret')
      .update('CA123|pn_1|tenant_1|business_1|ap_1')
      .digest('hex');

    expect(response.body).toContain(
      `<Parameter name="authSignature" value="${expectedSignature}" />`
    );
    expect(response.body).not.toContain('super-secret');
    expect(response.body).not.toContain('token=');

    await app.close();
  });
});
