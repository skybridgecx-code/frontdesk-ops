import type { VoiceProviderAdapter } from './contracts.js';
import type { NormalizedVoiceCallStatus, NormalizedVoiceStatusUpdate } from './types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getString(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function getRawString(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string') {
      return value;
    }
  }

  return null;
}

function parseDurationSeconds(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(Math.round(parsed), 0);
}

function normalizeStatusToken(value: string | null) {
  return value?.toLowerCase().replaceAll('.', '_').replaceAll('-', '_') ?? null;
}

function mapTelnyxCallStatus(rawStatus: string | null, rawEventType: string | null): NormalizedVoiceCallStatus | null {
  const status = normalizeStatusToken(rawStatus);
  const eventType = normalizeStatusToken(rawEventType);

  switch (status) {
    case 'ringing':
      return 'ringing';
    case 'answered':
    case 'in_progress':
    case 'bridged':
      return 'in_progress';
    case 'hangup':
    case 'ended':
    case 'completed':
      return 'completed';
    case 'busy':
      return 'busy';
    case 'no_answer':
      return 'no_answer';
    case 'failed':
    case 'error':
      return 'failed';
    case 'canceled':
    case 'cancelled':
      return 'canceled';
  }

  switch (eventType) {
    case 'call_initiated':
    case 'call_answered':
    case 'call_bridged':
    case 'call_speak_started':
      return 'in_progress';
    case 'call_hangup':
    case 'call_ended':
      return 'completed';
    case 'call_failed':
      return 'failed';
    default:
      return null;
  }
}

function resolveProviderCallId(record: Record<string, unknown>) {
  return getRawString(
    record,
    'call_control_id',
    'callControlId',
    'call_leg_id',
    'callLegId',
    'call_session_id',
    'callSessionId',
    'call_id',
    'callId',
    'id'
  );
}

export const telnyxVoiceProviderAdapter: VoiceProviderAdapter = {
  provider: 'telnyx',

  normalizeInboundCall(input) {
    if (!isRecord(input)) {
      return null;
    }

    return {
      provider: 'telnyx',
      providerCallId: resolveProviderCallId(input) ?? '',
      fromE164: getRawString(input, 'from', 'from_number', 'fromNumber', 'caller') ?? null,
      toE164: getRawString(input, 'to', 'to_number', 'toNumber', 'called') ?? null
    };
  },

  normalizeStatusUpdate(input: unknown): NormalizedVoiceStatusUpdate | null {
    if (!isRecord(input)) {
      return null;
    }

    const providerCallId = getString(
      input,
      'call_control_id',
      'callControlId',
      'call_leg_id',
      'callLegId',
      'call_session_id',
      'callSessionId',
      'call_id',
      'callId',
      'id'
    );
    const rawStatus = getString(input, 'call_status', 'callStatus', 'status', 'state');
    const rawEventType = getString(input, 'event_type', 'eventType', 'event');

    if (!providerCallId) {
      return null;
    }

    const status = mapTelnyxCallStatus(rawStatus, rawEventType);
    if (!status) {
      return null;
    }

    return {
      provider: 'telnyx',
      providerCallId,
      status,
      fromE164: getString(input, 'from', 'from_number', 'fromNumber', 'caller'),
      toE164: getString(input, 'to', 'to_number', 'toNumber', 'called'),
      answeredAt: getString(input, 'answered_at', 'answeredAt', 'start_time', 'startTime'),
      endedAt: getString(input, 'ended_at', 'endedAt', 'end_time', 'endTime'),
      durationSeconds: parseDurationSeconds(
        getString(input, 'duration', 'duration_seconds', 'durationSeconds', 'call_duration')
      )
    };
  }
};
