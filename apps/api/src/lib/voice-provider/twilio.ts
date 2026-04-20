import type { VoiceProviderAdapter } from './contracts.js';
import type { NormalizedVoiceCallStatus, NormalizedVoiceStatusUpdate } from './types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function getRawString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === 'string' ? value : null;
}

function mapTwilioCallStatus(status: string): NormalizedVoiceCallStatus | null {
  switch (status) {
    case 'ringing':
      return 'ringing';
    case 'in-progress':
      return 'in_progress';
    case 'completed':
      return 'completed';
    case 'busy':
      return 'busy';
    case 'no-answer':
      return 'no_answer';
    case 'failed':
      return 'failed';
    case 'canceled':
      return 'canceled';
    default:
      return null;
  }
}

function parseDurationSeconds(value: string | null) {
  if (!value || !/^\d+$/.test(value)) {
    return null;
  }

  return Number(value);
}

export const twilioVoiceProviderAdapter: VoiceProviderAdapter = {
  provider: 'twilio',

  normalizeInboundCall(input) {
    if (!isRecord(input)) {
      return null;
    }

    return {
      provider: 'twilio',
      providerCallId: getRawString(input, 'CallSid') ?? '',
      fromE164: getRawString(input, 'From') ?? null,
      toE164: getRawString(input, 'To') ?? null
    };
  },

  normalizeStatusUpdate(input: unknown): NormalizedVoiceStatusUpdate | null {
    if (!isRecord(input)) {
      return null;
    }

    const providerCallId = getString(input, 'CallSid');
    const rawStatus = getString(input, 'CallStatus');

    if (!providerCallId || !rawStatus) {
      return null;
    }

    const status = mapTwilioCallStatus(rawStatus);
    if (!status) {
      return null;
    }

    return {
      provider: 'twilio',
      providerCallId,
      status,
      fromE164: getString(input, 'From'),
      toE164: getString(input, 'To'),
      durationSeconds: parseDurationSeconds(getString(input, 'CallDuration'))
    };
  }
};
