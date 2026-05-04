import { describe, expect, it } from 'vitest';
import { telnyxVoiceProviderAdapter } from '../telnyx.js';

describe('telnyxVoiceProviderAdapter.normalizeInboundCall', () => {
  it('normalizes Telnyx inbound payload fields', () => {
    const normalized = telnyxVoiceProviderAdapter.normalizeInboundCall?.({
      call_control_id: 'v3:123',
      from: '+15551234567',
      to: '+12029359687'
    }) ?? null;

    expect(normalized).toEqual({
      provider: 'telnyx',
      providerCallId: 'v3:123',
      fromE164: '+15551234567',
      toE164: '+12029359687'
    });
  });

  it('returns default empty/null values when inbound keys are absent', () => {
    const normalized = telnyxVoiceProviderAdapter.normalizeInboundCall?.({}) ?? null;

    expect(normalized).toEqual({
      provider: 'telnyx',
      providerCallId: '',
      fromE164: null,
      toE164: null
    });
  });
});

describe('telnyxVoiceProviderAdapter.normalizeStatusUpdate', () => {
  it('normalizes Telnyx status payload fields from call_status', () => {
    const normalized = telnyxVoiceProviderAdapter.normalizeStatusUpdate?.({
      call_control_id: 'v3:123',
      call_status: 'answered',
      from: '+15551234567',
      to: '+12029359687',
      duration: '42'
    }) ?? null;

    expect(normalized).toEqual({
      provider: 'telnyx',
      providerCallId: 'v3:123',
      status: 'in_progress',
      fromE164: '+15551234567',
      toE164: '+12029359687',
      answeredAt: null,
      endedAt: null,
      durationSeconds: 42
    });
  });

  it('normalizes Telnyx status from event_type when status field is absent', () => {
    const normalized = telnyxVoiceProviderAdapter.normalizeStatusUpdate?.({
      call_session_id: 'session_1',
      event_type: 'call.hangup',
      duration_seconds: '13'
    }) ?? null;

    expect(normalized).toEqual({
      provider: 'telnyx',
      providerCallId: 'session_1',
      status: 'completed',
      fromE164: null,
      toE164: null,
      answeredAt: null,
      endedAt: null,
      durationSeconds: 13
    });
  });

  it('returns null when call identifier is missing', () => {
    const normalized = telnyxVoiceProviderAdapter.normalizeStatusUpdate?.({
      call_status: 'completed'
    }) ?? null;

    expect(normalized).toBeNull();
  });

  it('returns null when lifecycle status is unsupported', () => {
    const normalized = telnyxVoiceProviderAdapter.normalizeStatusUpdate?.({
      call_control_id: 'v3:123',
      call_status: 'queued'
    }) ?? null;

    expect(normalized).toBeNull();
  });
});
