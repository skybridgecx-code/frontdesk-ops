import { describe, expect, it } from 'vitest';
import { retellVoiceProviderAdapter } from '../retell.js';

describe('retellVoiceProviderAdapter.normalizeInboundCall', () => {
  it('normalizes minimal Retell call identifiers and phone numbers', () => {
    const normalized = retellVoiceProviderAdapter.normalizeInboundCall?.({
      call: {
        call_id: 'retell_call_1',
        from_number: '+15551230000',
        to_number: '+15557654321'
      }
    }) ?? null;

    expect(normalized).toEqual({
      provider: 'retell',
      providerCallId: 'retell_call_1',
      fromE164: '+15551230000',
      toE164: '+15557654321'
    });
  });
});

describe('retellVoiceProviderAdapter.normalizeStatusUpdate', () => {
  it('normalizes ended lifecycle payloads with metadata and duration', () => {
    const normalized = retellVoiceProviderAdapter.normalizeStatusUpdate?.({
      event: 'call_ended',
      call: {
        id: 'retell_call_2',
        status: 'ended',
        from: '+15551230000',
        to: '+15557654321',
        duration_ms: 12500,
        started_at: '2026-04-20T12:00:00.000Z',
        ended_at: '2026-04-20T12:00:12.000Z',
        metadata: {
          tenantId: 'tenant_1',
          businessId: 'business_1',
          phoneNumberId: 'pn_1'
        }
      }
    }) ?? null;

    expect(normalized).toEqual({
      provider: 'retell',
      providerCallId: 'retell_call_2',
      status: 'completed',
      tenantId: 'tenant_1',
      businessId: 'business_1',
      phoneNumberId: 'pn_1',
      fromE164: '+15551230000',
      toE164: '+15557654321',
      answeredAt: '2026-04-20T12:00:00.000Z',
      endedAt: '2026-04-20T12:00:12.000Z',
      durationSeconds: 13
    });
  });

  it('returns null when no recognized lifecycle status can be derived', () => {
    const normalized = retellVoiceProviderAdapter.normalizeStatusUpdate?.({
      call: {
        id: 'retell_call_3'
      }
    }) ?? null;

    expect(normalized).toBeNull();
  });
});

describe('retellVoiceProviderAdapter.normalizeTranscriptArtifact', () => {
  it('normalizes transcript and summary artifacts', () => {
    const normalized = retellVoiceProviderAdapter.normalizeTranscriptArtifact?.({
      call: {
        call_id: 'retell_call_4',
        transcript: 'Caller asked for same-day plumbing help.',
        call_summary: 'Emergency plumbing request',
        metadata: {
          tenant_id: 'tenant_2',
          business_id: 'business_2',
          phone_number_id: 'pn_2'
        }
      }
    }) ?? null;

    expect(normalized).toEqual({
      provider: 'retell',
      providerCallId: 'retell_call_4',
      tenantId: 'tenant_2',
      businessId: 'business_2',
      phoneNumberId: 'pn_2',
      fromE164: null,
      toE164: null,
      transcript: 'Caller asked for same-day plumbing help.',
      summary: 'Emergency plumbing request'
    });
  });

  it('normalizes transcript artifacts nested under analysis payloads', () => {
    const normalized = retellVoiceProviderAdapter.normalizeTranscriptArtifact?.({
      event: 'call_analyzed',
      call: {
        call_id: 'retell_call_5',
        from_number: '+15550000001',
        to_number: '+15550000002'
      },
      analysis: {
        transcript: 'Caller needs same-day electrical service.',
        summary: 'Urgent electrical service request'
      }
    }) ?? null;

    expect(normalized).toEqual({
      provider: 'retell',
      providerCallId: 'retell_call_5',
      tenantId: null,
      businessId: null,
      phoneNumberId: null,
      fromE164: '+15550000001',
      toE164: '+15550000002',
      transcript: 'Caller needs same-day electrical service.',
      summary: 'Urgent electrical service request'
    });
  });

  it('normalizes summary nested under call.call_analysis payloads', () => {
    const normalized = retellVoiceProviderAdapter.normalizeTranscriptArtifact?.({
      event: 'call_analyzed',
      call: {
        call_id: 'retell_call_6',
        transcript: 'Caller asked for same-day garage door repair.',
        call_analysis: {
          call_summary: 'Urgent garage door repair'
        }
      }
    }) ?? null;

    expect(normalized).toEqual({
      provider: 'retell',
      providerCallId: 'retell_call_6',
      tenantId: null,
      businessId: null,
      phoneNumberId: null,
      fromE164: null,
      toE164: null,
      transcript: 'Caller asked for same-day garage door repair.',
      summary: 'Urgent garage door repair'
    });
  });
});
