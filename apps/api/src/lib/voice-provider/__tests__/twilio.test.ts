import { describe, expect, it } from 'vitest';
import { CallStatus } from '@frontdesk/db';
import { mapNormalizedVoiceStatusToCallStatus } from '../event-mapping.js';
import { twilioVoiceProviderAdapter } from '../twilio.js';

describe('twilioVoiceProviderAdapter.normalizeStatusUpdate', () => {
  it('normalizes Twilio status payload fields', () => {
    const normalized = twilioVoiceProviderAdapter.normalizeStatusUpdate?.({
      CallSid: 'CA123',
      CallStatus: 'in-progress',
      From: '+15551234567',
      To: '+12029359687',
      CallDuration: '42'
    }) ?? null;

    expect(normalized).toEqual({
      provider: 'twilio',
      providerCallId: 'CA123',
      status: 'in_progress',
      fromE164: '+15551234567',
      toE164: '+12029359687',
      durationSeconds: 42
    });
  });

  it('returns null when CallSid is missing', () => {
    const normalized = twilioVoiceProviderAdapter.normalizeStatusUpdate?.({
      CallStatus: 'completed'
    }) ?? null;

    expect(normalized).toBeNull();
  });

  it('returns null for unknown CallStatus values', () => {
    const normalized = twilioVoiceProviderAdapter.normalizeStatusUpdate?.({
      CallSid: 'CA123',
      CallStatus: 'queued'
    }) ?? null;

    expect(normalized).toBeNull();
  });
});

describe('mapNormalizedVoiceStatusToCallStatus', () => {
  it('maps each normalized status to the existing CallStatus contract', () => {
    expect(mapNormalizedVoiceStatusToCallStatus('ringing')).toBe(CallStatus.RINGING);
    expect(mapNormalizedVoiceStatusToCallStatus('in_progress')).toBe(CallStatus.IN_PROGRESS);
    expect(mapNormalizedVoiceStatusToCallStatus('completed')).toBe(CallStatus.COMPLETED);
    expect(mapNormalizedVoiceStatusToCallStatus('busy')).toBe(CallStatus.BUSY);
    expect(mapNormalizedVoiceStatusToCallStatus('no_answer')).toBe(CallStatus.NO_ANSWER);
    expect(mapNormalizedVoiceStatusToCallStatus('failed')).toBe(CallStatus.FAILED);
    expect(mapNormalizedVoiceStatusToCallStatus('canceled')).toBe(CallStatus.CANCELED);
  });
});
