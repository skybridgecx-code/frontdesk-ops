import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CallStatus } from '@frontdesk/db';
import { handleMissedCall } from '../lib/missed-call-handler.js';

const {
  callFindUniqueMock,
  callUpdateMock,
  callEventCountMock,
  callEventCreateMock,
  phoneNumberFindFirstMock,
  messagesCreateMock,
  getTwilioClientMock
} = vi.hoisted(() => ({
  callFindUniqueMock: vi.fn(),
  callUpdateMock: vi.fn(),
  callEventCountMock: vi.fn(),
  callEventCreateMock: vi.fn(),
  phoneNumberFindFirstMock: vi.fn(),
  messagesCreateMock: vi.fn(),
  getTwilioClientMock: vi.fn()
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
      call: {
        findUnique: callFindUniqueMock,
        update: callUpdateMock
      },
      callEvent: {
        count: callEventCountMock,
        create: callEventCreateMock
      },
      phoneNumber: {
        findFirst: phoneNumberFindFirstMock
      }
    }
  };
});

type AgentProfileFixture = {
  id: string;
  missedCallTextBackMessage: string | null;
};

type CallFixture = {
  id: string;
  tenantId: string;
  businessId: string;
  phoneNumberId: string;
  toE164: string | null;
  status: CallStatus;
  durationSeconds: number | null;
  fromE164: string | null;
  textBackSent: boolean;
  business: {
    name: string;
    agentProfiles: AgentProfileFixture[];
  };
  agentProfile: AgentProfileFixture | null;
};

function buildCallFixture(input?: Partial<CallFixture>): CallFixture {
  return {
    id: 'call_1',
    tenantId: 'tenant_1',
    businessId: 'business_1',
    phoneNumberId: 'pn_1',
    toE164: '+17035550100',
    status: CallStatus.NO_ANSWER,
    durationSeconds: null,
    fromE164: '+17035550999',
    textBackSent: false,
    business: {
      name: 'Skyline HVAC',
      agentProfiles: [
        {
          id: 'agent_1',
          missedCallTextBackMessage: null
        }
      ]
    },
    agentProfile: {
      id: 'agent_1',
      missedCallTextBackMessage: null
    },
    ...input
  };
}

describe('handleMissedCall', () => {
  beforeEach(() => {
    callFindUniqueMock.mockReset();
    callUpdateMock.mockReset();
    callEventCountMock.mockReset();
    callEventCreateMock.mockReset();
    phoneNumberFindFirstMock.mockReset();
    messagesCreateMock.mockReset();
    getTwilioClientMock.mockReset();

    callEventCountMock.mockResolvedValue(2);
    callEventCreateMock.mockResolvedValue({ id: 'event_1' });
    callUpdateMock.mockResolvedValue({ id: 'call_1' });

    getTwilioClientMock.mockReturnValue({
      messages: {
        create: messagesCreateMock
      }
    });
    messagesCreateMock.mockResolvedValue({ sid: 'SM123' });

    phoneNumberFindFirstMock.mockResolvedValue({
      e164: '+17035550100',
      enableMissedCallTextBack: true
    });
  });

  it('no-answer call with text-back enabled sends SMS, updates call, and creates event', async () => {
    callFindUniqueMock.mockResolvedValue(buildCallFixture({ status: CallStatus.NO_ANSWER }));

    await handleMissedCall('CA_no_answer');

    expect(messagesCreateMock).toHaveBeenCalledTimes(1);
    expect(callUpdateMock).toHaveBeenCalledWith({
      where: { id: 'call_1' },
      data: {
        textBackSent: true,
        textBackSentAt: expect.any(Date)
      }
    });
    expect(callEventCreateMock).toHaveBeenCalledWith({
      data: {
        callId: 'call_1',
        type: 'textback.sent',
        sequence: 3,
        payloadJson: {
          to: '+17035550999',
          from: '+17035550100',
          message: expect.any(String)
        }
      }
    });
  });

  it('busy call with text-back enabled sends SMS', async () => {
    callFindUniqueMock.mockResolvedValue(buildCallFixture({ status: CallStatus.BUSY }));

    await handleMissedCall('CA_busy');

    expect(messagesCreateMock).toHaveBeenCalledTimes(1);
  });

  it('completed call with duration under 10 seconds sends SMS', async () => {
    callFindUniqueMock.mockResolvedValue(
      buildCallFixture({
        status: CallStatus.COMPLETED,
        durationSeconds: 9
      })
    );

    await handleMissedCall('CA_quick_hangup');

    expect(messagesCreateMock).toHaveBeenCalledTimes(1);
  });

  it('completed call with duration >= 10 seconds does not send SMS', async () => {
    callFindUniqueMock.mockResolvedValue(
      buildCallFixture({
        status: CallStatus.COMPLETED,
        durationSeconds: 10
      })
    );

    await handleMissedCall('CA_completed_long');

    expect(messagesCreateMock).not.toHaveBeenCalled();
    expect(callUpdateMock).not.toHaveBeenCalled();
    expect(callEventCreateMock).not.toHaveBeenCalled();
  });

  it('missed call with text-back disabled does not send SMS', async () => {
    callFindUniqueMock.mockResolvedValue(buildCallFixture());
    phoneNumberFindFirstMock.mockResolvedValue({
      e164: '+17035550100',
      enableMissedCallTextBack: false
    });

    await handleMissedCall('CA_disabled');

    expect(messagesCreateMock).not.toHaveBeenCalled();
    expect(callUpdateMock).not.toHaveBeenCalled();
    expect(callEventCreateMock).toHaveBeenCalledWith({
      data: {
        callId: 'call_1',
        type: 'textback.skipped',
        sequence: 3,
        payloadJson: {
          reason: 'textback_disabled',
          status: 'NO_ANSWER',
          durationSeconds: null,
          fromE164: '+17035550999',
          toE164: '+17035550100',
          destinationPhoneNumberE164: '+17035550100',
          errorMessage: null
        }
      }
    });
  });

  it('missed call with no matching phone number records skip evidence', async () => {
    callFindUniqueMock.mockResolvedValue(buildCallFixture({ toE164: '+17035550100' }));
    phoneNumberFindFirstMock.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    await expect(handleMissedCall('CA_no_phone')).resolves.toBeUndefined();

    expect(messagesCreateMock).not.toHaveBeenCalled();
    expect(callUpdateMock).not.toHaveBeenCalled();
    expect(callEventCreateMock).toHaveBeenCalledWith({
      data: {
        callId: 'call_1',
        type: 'textback.skipped',
        sequence: 3,
        payloadJson: {
          reason: 'destination_number_not_found',
          status: 'NO_ANSWER',
          durationSeconds: null,
          fromE164: '+17035550999',
          toE164: '+17035550100',
          destinationPhoneNumberE164: null,
          errorMessage: null
        }
      }
    });
  });

  it('uses custom missed call text-back message when set', async () => {
    callFindUniqueMock.mockResolvedValue(
      buildCallFixture({
        agentProfile: {
          id: 'agent_1',
          missedCallTextBackMessage: 'Custom callback text from the service team.'
        }
      })
    );

    await handleMissedCall('CA_custom_message');

    expect(messagesCreateMock).toHaveBeenCalledWith({
      from: '+17035550100',
      to: '+17035550999',
      body: 'Custom callback text from the service team.'
    });
  });

  it('uses default message when custom message is null', async () => {
    callFindUniqueMock.mockResolvedValue(
      buildCallFixture({
        agentProfile: {
          id: 'agent_1',
          missedCallTextBackMessage: null
        },
        business: {
          name: 'Skyline HVAC',
          agentProfiles: [
            {
              id: 'agent_1',
              missedCallTextBackMessage: null
            }
          ]
        }
      })
    );

    await handleMissedCall('CA_default_message');

    expect(messagesCreateMock).toHaveBeenCalledWith({
      from: '+17035550100',
      to: '+17035550999',
      body:
        "Hi! Sorry we missed your call to Skyline HVAC. We got your message and will get back to you shortly. If this is urgent, please call back and we'll prioritize your request. — Skyline HVAC"
    });
  });

  it('logs Twilio SMS failure and does not throw', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    callFindUniqueMock.mockResolvedValue(buildCallFixture());
    messagesCreateMock.mockRejectedValue(new Error('Twilio SMS failed'));

    await expect(handleMissedCall('CA_twilio_error')).resolves.toBeUndefined();

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(callUpdateMock).not.toHaveBeenCalled();
    expect(callEventCreateMock).toHaveBeenCalledWith({
      data: {
        callId: 'call_1',
        type: 'textback.skipped',
        sequence: 3,
        payloadJson: {
          reason: 'provider_send_failed',
          status: 'NO_ANSWER',
          durationSeconds: null,
          fromE164: '+17035550999',
          toE164: '+17035550100',
          destinationPhoneNumberE164: '+17035550100',
          errorMessage: 'Twilio SMS failed'
        }
      }
    });

    consoleErrorSpy.mockRestore();
  });

  it('missed call with missing caller number records skip evidence', async () => {
    callFindUniqueMock.mockResolvedValue(buildCallFixture({ fromE164: null }));

    await handleMissedCall('CA_missing_caller');

    expect(messagesCreateMock).not.toHaveBeenCalled();
    expect(callUpdateMock).not.toHaveBeenCalled();
    expect(callEventCreateMock).toHaveBeenCalledWith({
      data: {
        callId: 'call_1',
        type: 'textback.skipped',
        sequence: 3,
        payloadJson: {
          reason: 'missing_caller_number',
          status: 'NO_ANSWER',
          durationSeconds: null,
          fromE164: null,
          toE164: '+17035550100',
          destinationPhoneNumberE164: '+17035550100',
          errorMessage: null
        }
      }
    });
  });
});
