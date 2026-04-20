import { beforeEach, describe, expect, it, vi } from 'vitest';
import fastify from 'fastify';
import { CallDirection, CallReviewStatus, CallStatus, CallTriageStatus } from '@frontdesk/db';
import { registerRetellWebhookRoutes } from '../retell-webhooks.js';
import { registerCallRoutes } from '../calls.js';

const {
  callFindFirstMock,
  callCreateMock,
  callUpdateMock,
  callCountMock,
  callFindManyMock,
  transactionMock,
  callEventCountMock,
  callEventCreateMock,
  phoneNumberFindUniqueMock
} = vi.hoisted(() => ({
  callFindFirstMock: vi.fn(),
  callCreateMock: vi.fn(),
  callUpdateMock: vi.fn(),
  callCountMock: vi.fn(),
  callFindManyMock: vi.fn(),
  transactionMock: vi.fn(),
  callEventCountMock: vi.fn(),
  callEventCreateMock: vi.fn(),
  phoneNumberFindUniqueMock: vi.fn()
}));

vi.mock('@frontdesk/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@frontdesk/db')>();

  return {
    ...actual,
    prisma: {
      call: {
        findFirst: callFindFirstMock,
        create: callCreateMock,
        update: callUpdateMock,
        count: callCountMock,
        findMany: callFindManyMock
      },
      callEvent: {
        count: callEventCountMock,
        create: callEventCreateMock
      },
      phoneNumber: {
        findUnique: phoneNumberFindUniqueMock
      },
      $transaction: transactionMock
    }
  };
});

async function createApp() {
  const app = fastify({ logger: false });
  await registerRetellWebhookRoutes(app);
  return app;
}

async function createCompatibilityApp() {
  const app = fastify({ logger: false });
  await registerRetellWebhookRoutes(app);
  await registerCallRoutes(app);
  return app;
}

describe('retell-webhooks route', () => {
  beforeEach(() => {
    callFindFirstMock.mockReset();
    callCreateMock.mockReset();
    callUpdateMock.mockReset();
    callCountMock.mockReset();
    callFindManyMock.mockReset();
    transactionMock.mockReset();
    callEventCountMock.mockReset();
    callEventCreateMock.mockReset();
    phoneNumberFindUniqueMock.mockReset();

    callCreateMock.mockResolvedValue({
      id: 'call_created',
      twilioCallSid: 'retell_call_created',
      answeredAt: null,
      endedAt: null
    });
    callUpdateMock.mockResolvedValue({ id: 'call_1' });
    callCountMock.mockResolvedValue(0);
    callFindManyMock.mockResolvedValue([]);
    transactionMock.mockImplementation(async (operations) => Promise.all(operations));
    callEventCountMock.mockResolvedValue(0);
    callEventCreateMock.mockResolvedValue({ id: 'evt_1' });
    phoneNumberFindUniqueMock.mockResolvedValue(null);
  });

  it('persists normalized Retell status and transcript for an existing call', async () => {
    callFindFirstMock.mockResolvedValue({
      id: 'call_1',
      twilioCallSid: 'retell_call_1',
      answeredAt: null,
      endedAt: null
    });

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/twilio/retell/webhook',
      payload: {
        event: 'call_ended',
        call: {
          id: 'retell_call_1',
          status: 'ended',
          duration_ms: 12000,
          transcript: 'Caller reported no heat.',
          call_summary: 'No-heat HVAC emergency'
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      provider: 'retell',
      callId: 'call_1',
      providerCallId: 'retell_call_1',
      correlationSource: 'sid',
      applied: {
        status: true,
        transcript: true
      }
    });

    expect(callUpdateMock).toHaveBeenCalledWith({
      where: { id: 'call_1' },
      data: expect.objectContaining({
        status: CallStatus.COMPLETED,
        durationSeconds: 12,
        endedAt: expect.any(Date)
      })
    });
    expect(callUpdateMock).toHaveBeenCalledWith({
      where: { id: 'call_1' },
      data: {
        summary: 'No-heat HVAC emergency',
        callerTranscript: 'Caller reported no heat.'
      }
    });
    expect(callEventCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        callId: 'call_1',
        type: 'twilio.status.completed',
        sequence: 1
      })
    });

    await app.close();
  });

  it('creates a call from Retell status metadata when no existing call is found', async () => {
    callFindFirstMock.mockResolvedValueOnce(null);

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/twilio/retell/webhook',
      payload: {
        event_type: 'call_started',
        call: {
          call_id: 'retell_call_created',
          status: 'in_progress',
          metadata: {
            tenantId: 'tenant_1',
            businessId: 'business_1',
            phoneNumberId: 'pn_1'
          }
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      provider: 'retell',
      callId: 'call_created',
      providerCallId: 'retell_call_created',
      correlationSource: 'created-from-status-payload',
      applied: {
        status: true,
        transcript: false
      }
    });
    expect(callCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant_1',
        businessId: 'business_1',
        phoneNumberId: 'pn_1',
        twilioCallSid: 'retell_call_created',
        callSid: 'retell_call_created',
        status: CallStatus.IN_PROGRESS
      }),
      select: {
        id: true,
        twilioCallSid: true,
        answeredAt: true,
        endedAt: true
      }
    });

    await app.close();
  });

  it('creates a call from destination number lookup when metadata is absent', async () => {
    callFindFirstMock.mockResolvedValueOnce(null);
    phoneNumberFindUniqueMock.mockResolvedValue({
      id: 'pn_lookup',
      tenantId: 'tenant_lookup',
      businessId: 'business_lookup',
      isActive: true
    });

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/twilio/retell/webhook',
      payload: {
        event_type: 'call_started',
        call: {
          call_id: 'retell_call_lookup',
          status: 'in_progress',
          to_number: '+12029350000'
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      provider: 'retell',
      callId: 'call_created',
      providerCallId: 'retell_call_lookup',
      correlationSource: 'created-from-status-payload',
      applied: {
        status: true,
        transcript: false
      }
    });
    expect(phoneNumberFindUniqueMock).toHaveBeenCalledWith({
      where: { e164: '+12029350000' },
      select: {
        id: true,
        tenantId: true,
        businessId: true,
        isActive: true
      }
    });
    expect(callCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant_lookup',
        businessId: 'business_lookup',
        phoneNumberId: 'pn_lookup',
        twilioCallSid: 'retell_call_lookup',
        callSid: 'retell_call_lookup'
      }),
      select: {
        id: true,
        twilioCallSid: true,
        answeredAt: true,
        endedAt: true
      }
    });

    await app.close();
  });

  it('keeps /v1/calls and /v1/calls/:callSid contract compatible for Retell-originated sandbox calls', async () => {
    type StoredEvent = {
      type: string;
      sequence: number;
      payloadJson: unknown;
      createdAt: Date;
    };

    type StoredCall = {
      id: string;
      tenantId: string;
      businessId: string;
      phoneNumberId: string;
      twilioCallSid: string;
      twilioStreamSid: string | null;
      direction: CallDirection;
      status: CallStatus;
      routeKind: null;
      triageStatus: CallTriageStatus;
      reviewStatus: CallReviewStatus;
      contactedAt: Date | null;
      archivedAt: Date | null;
      reviewedAt: Date | null;
      fromE164: string | null;
      toE164: string | null;
      leadName: string | null;
      leadPhone: string | null;
      leadIntent: string | null;
      urgency: string | null;
      serviceAddress: string | null;
      summary: string | null;
      callerTranscript: string | null;
      assistantTranscript: string | null;
      startedAt: Date;
      answeredAt: Date | null;
      endedAt: Date | null;
      durationSeconds: number | null;
      recordingUrl: string | null;
      recordingSid: string | null;
      recordingDuration: number | null;
      recordingStatus: string | null;
      textBackSent: boolean;
      textBackSentAt: Date | null;
      operatorNotes: string | null;
      phoneNumber: {
        id: string;
        e164: string;
        label: string;
        routingMode: 'AI_ALWAYS';
      };
      agentProfile: null;
    };

    const callsById = new Map<string, StoredCall>();
    const callsBySid = new Map<string, StoredCall>();
    const eventsByCallId = new Map<string, StoredEvent[]>();

    phoneNumberFindUniqueMock.mockResolvedValue({
      id: 'pn_compat',
      tenantId: 'tenant_compat',
      businessId: 'business_compat',
      isActive: true
    });

    callCreateMock.mockImplementation(async ({ data }) => {
      const storedCall: StoredCall = {
        id: 'call_contract_1',
        tenantId: data.tenantId,
        businessId: data.businessId,
        phoneNumberId: data.phoneNumberId,
        twilioCallSid: data.twilioCallSid,
        twilioStreamSid: null,
        direction: data.direction ?? CallDirection.INBOUND,
        status: data.status ?? CallStatus.RINGING,
        routeKind: null,
        triageStatus: CallTriageStatus.OPEN,
        reviewStatus: CallReviewStatus.UNREVIEWED,
        contactedAt: null,
        archivedAt: null,
        reviewedAt: null,
        fromE164: data.fromE164 ?? null,
        toE164: data.toE164 ?? null,
        leadName: null,
        leadPhone: null,
        leadIntent: null,
        urgency: null,
        serviceAddress: null,
        summary: null,
        callerTranscript: null,
        assistantTranscript: null,
        startedAt: new Date('2026-04-20T12:00:00.000Z'),
        answeredAt: null,
        endedAt: null,
        durationSeconds: null,
        recordingUrl: null,
        recordingSid: null,
        recordingDuration: null,
        recordingStatus: null,
        textBackSent: false,
        textBackSentAt: null,
        operatorNotes: null,
        phoneNumber: {
          id: data.phoneNumberId,
          e164: '+12029350000',
          label: 'Retell Sandbox',
          routingMode: 'AI_ALWAYS'
        },
        agentProfile: null
      };

      callsById.set(storedCall.id, storedCall);
      callsBySid.set(storedCall.twilioCallSid, storedCall);
      eventsByCallId.set(storedCall.id, []);

      return {
        id: storedCall.id,
        twilioCallSid: storedCall.twilioCallSid,
        answeredAt: storedCall.answeredAt,
        endedAt: storedCall.endedAt
      };
    });

    callUpdateMock.mockImplementation(async ({ where, data }) => {
      const call = callsById.get(where.id);
      if (!call) {
        throw new Error(`missing call ${where.id}`);
      }

      if (data.status !== undefined) call.status = data.status;
      if (data.answeredAt !== undefined) call.answeredAt = data.answeredAt;
      if (data.endedAt !== undefined) call.endedAt = data.endedAt;
      if (data.durationSeconds !== undefined) call.durationSeconds = data.durationSeconds;
      if (data.summary !== undefined) call.summary = data.summary;
      if (data.callerTranscript !== undefined) call.callerTranscript = data.callerTranscript;

      return { id: call.id };
    });

    callEventCountMock.mockImplementation(async ({ where }) => {
      return eventsByCallId.get(where.callId)?.length ?? 0;
    });

    callEventCreateMock.mockImplementation(async ({ data }) => {
      const events = eventsByCallId.get(data.callId);
      if (!events) {
        throw new Error(`missing event bucket for ${data.callId}`);
      }

      events.push({
        type: data.type,
        sequence: data.sequence,
        payloadJson: data.payloadJson,
        createdAt: new Date('2026-04-20T12:00:35.000Z')
      });

      return { id: `evt_${data.sequence}` };
    });

    callFindFirstMock.mockImplementation(async ({ where }) => {
      if (where?.OR) {
        const sid = where.OR[0]?.twilioCallSid ?? where.OR[1]?.callSid ?? '';
        const call = callsBySid.get(sid);
        if (!call) return null;

        return {
          id: call.id,
          twilioCallSid: call.twilioCallSid,
          answeredAt: call.answeredAt,
          endedAt: call.endedAt
        };
      }

      if (typeof where?.twilioCallSid === 'string') {
        const call = callsBySid.get(where.twilioCallSid);
        if (!call) return null;

        return {
          id: call.id,
          twilioCallSid: call.twilioCallSid,
          twilioStreamSid: call.twilioStreamSid,
          direction: call.direction,
          status: call.status,
          routeKind: call.routeKind,
          triageStatus: call.triageStatus,
          reviewStatus: call.reviewStatus,
          contactedAt: call.contactedAt,
          archivedAt: call.archivedAt,
          reviewedAt: call.reviewedAt,
          fromE164: call.fromE164,
          toE164: call.toE164,
          callerTranscript: call.callerTranscript,
          assistantTranscript: call.assistantTranscript,
          leadName: call.leadName,
          leadPhone: call.leadPhone,
          leadIntent: call.leadIntent,
          urgency: call.urgency,
          serviceAddress: call.serviceAddress,
          summary: call.summary,
          operatorNotes: call.operatorNotes,
          startedAt: call.startedAt,
          answeredAt: call.answeredAt,
          endedAt: call.endedAt,
          durationSeconds: call.durationSeconds,
          recordingUrl: call.recordingUrl,
          recordingSid: call.recordingSid,
          recordingDuration: call.recordingDuration,
          recordingStatus: call.recordingStatus,
          textBackSent: call.textBackSent,
          textBackSentAt: call.textBackSentAt,
          phoneNumber: call.phoneNumber,
          agentProfile: call.agentProfile,
          events: (eventsByCallId.get(call.id) ?? []).map((event) => ({
            type: event.type,
            sequence: event.sequence,
            createdAt: event.createdAt,
            payloadJson: event.payloadJson
          }))
        };
      }

      return null;
    });

    callCountMock.mockImplementation(async () => callsById.size);

    callFindManyMock.mockImplementation(async () => {
      const voiceHandlingEventTypes = new Set([
        'twilio.inbound.fallback',
        'textback.sent',
        'textback.skipped'
      ]);

      return [...callsById.values()].map((call) => ({
        twilioCallSid: call.twilioCallSid,
        twilioStreamSid: call.twilioStreamSid,
        direction: call.direction,
        status: call.status,
        routeKind: call.routeKind,
        triageStatus: call.triageStatus,
        reviewStatus: call.reviewStatus,
        contactedAt: call.contactedAt,
        archivedAt: call.archivedAt,
        reviewedAt: call.reviewedAt,
        fromE164: call.fromE164,
        toE164: call.toE164,
        leadName: call.leadName,
        leadPhone: call.leadPhone,
        leadIntent: call.leadIntent,
        urgency: call.urgency,
        serviceAddress: call.serviceAddress,
        summary: call.summary,
        callerTranscript: call.callerTranscript,
        assistantTranscript: call.assistantTranscript,
        startedAt: call.startedAt,
        answeredAt: call.answeredAt,
        endedAt: call.endedAt,
        durationSeconds: call.durationSeconds,
        recordingUrl: call.recordingUrl,
        recordingSid: call.recordingSid,
        recordingDuration: call.recordingDuration,
        recordingStatus: call.recordingStatus,
        textBackSent: call.textBackSent,
        textBackSentAt: call.textBackSentAt,
        events: (eventsByCallId.get(call.id) ?? [])
          .filter((event) => voiceHandlingEventTypes.has(event.type))
          .map((event) => ({
            type: event.type,
            sequence: event.sequence,
            payloadJson: event.payloadJson
          })),
        phoneNumber: {
          e164: call.phoneNumber.e164,
          label: call.phoneNumber.label
        },
        agentProfile: call.agentProfile
      }));
    });

    transactionMock.mockImplementation(async (operations) => Promise.all(operations));

    const app = await createCompatibilityApp();

    const webhookResponse = await app.inject({
      method: 'POST',
      url: '/v1/twilio/retell/webhook',
      payload: {
        event: 'call_ended',
        call: {
          id: 'retell_contract_1',
          status: 'ended',
          from_number: '+15551230000',
          to_number: '+12029350000',
          start_timestamp: '2026-04-20T12:00:00.000Z',
          end_timestamp: '2026-04-20T12:00:34.000Z',
          duration_ms: 34000,
          transcript: 'Caller requested emergency HVAC repair.',
          call_summary: 'Emergency HVAC request'
        }
      }
    });

    expect(webhookResponse.statusCode).toBe(200);
    expect(webhookResponse.json()).toEqual({
      ok: true,
      provider: 'retell',
      callId: 'call_contract_1',
      providerCallId: 'retell_contract_1',
      correlationSource: 'created-from-status-payload',
      applied: {
        status: true,
        transcript: true
      }
    });

    const listResponse = await app.inject({
      method: 'GET',
      url: '/v1/calls'
    });

    expect(listResponse.statusCode).toBe(200);
    const listBody = listResponse.json();
    expect(listBody).toEqual(
      expect.objectContaining({
        ok: true,
        page: 1,
        limit: 25,
        total: 1,
        totalPages: 1
      })
    );
    expect(listBody.calls).toHaveLength(1);
    expect(listBody.calls[0]).toEqual(
      expect.objectContaining({
        twilioCallSid: 'retell_contract_1',
        status: 'COMPLETED',
        fromE164: '+15551230000',
        toE164: '+12029350000',
        durationSeconds: 34,
        summary: 'Emergency HVAC request',
        callerTranscript: 'Caller requested emergency HVAC repair.'
      })
    );
    expect(listBody.calls[0]).toEqual(
      expect.objectContaining({
        voiceHandling: {
          fallbackUsed: false,
          textBackOutcome: null,
          textBackSkippedReason: null
        }
      })
    );

    const detailResponse = await app.inject({
      method: 'GET',
      url: '/v1/calls/retell_contract_1'
    });

    expect(detailResponse.statusCode).toBe(200);
    const detailBody = detailResponse.json();
    expect(detailBody).toEqual(
      expect.objectContaining({
        ok: true,
        call: expect.objectContaining({
          twilioCallSid: 'retell_contract_1',
          status: 'COMPLETED',
          durationSeconds: 34,
          summary: 'Emergency HVAC request',
          callerTranscript: 'Caller requested emergency HVAC repair.'
        })
      })
    );
    expect(detailBody.call).toEqual(
      expect.objectContaining({
        events: expect.arrayContaining([
          expect.objectContaining({
            type: 'twilio.status.completed'
          })
        ])
      })
    );

    await app.close();
  });
});
