import type { VoiceProviderAdapter } from './contracts.js';
import type {
  NormalizedVoiceCallStatus,
  NormalizedVoiceInboundCall,
  NormalizedVoiceStatusUpdate,
  NormalizedVoiceTranscriptArtifact
} from './types.js';

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

function getNumber(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

function getNestedRecord(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return isRecord(value) ? value : null;
}

function getCanonicalCallRecord(input: unknown) {
  if (!isRecord(input)) {
    return null;
  }

  const nestedCall = getNestedRecord(input, 'call');
  return {
    root: input,
    call: nestedCall ?? input,
    metadata: getNestedRecord(nestedCall ?? input, 'metadata') ?? getNestedRecord(input, 'metadata')
  };
}

function mapRetellStatus(rawStatus: string | null, rawEvent: string | null): NormalizedVoiceCallStatus | null {
  const status = rawStatus?.toLowerCase().replaceAll('-', '_') ?? null;
  const event = rawEvent?.toLowerCase().replaceAll('-', '_') ?? null;

  switch (status) {
    case 'ringing':
      return 'ringing';
    case 'in_progress':
    case 'active':
    case 'ongoing':
    case 'started':
      return 'in_progress';
    case 'completed':
    case 'ended':
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

  switch (event) {
    case 'call_started':
    case 'call_in_progress':
      return 'in_progress';
    case 'call_ended':
    case 'call_completed':
      return 'completed';
    case 'call_failed':
      return 'failed';
    default:
      return null;
  }
}

function resolveProviderCallId(input: {
  root: Record<string, unknown>;
  call: Record<string, unknown>;
}) {
  return (
    getString(input.call, 'call_id', 'callId', 'id') ??
    getString(input.root, 'call_id', 'callId', 'id')
  );
}

function normalizeInboundCall(input: {
  root: Record<string, unknown>;
  call: Record<string, unknown>;
}): NormalizedVoiceInboundCall | null {
  const providerCallId = resolveProviderCallId(input);
  if (!providerCallId) {
    return null;
  }

  return {
    provider: 'retell',
    providerCallId,
    fromE164: getString(input.call, 'from', 'from_number', 'fromNumber', 'caller') ?? null,
    toE164: getString(input.call, 'to', 'to_number', 'toNumber', 'called') ?? null
  };
}

export const retellVoiceProviderAdapter: VoiceProviderAdapter = {
  provider: 'retell',

  normalizeInboundCall(input: unknown): NormalizedVoiceInboundCall | null {
    const canonical = getCanonicalCallRecord(input);
    if (!canonical) {
      return null;
    }

    return normalizeInboundCall(canonical);
  },

  normalizeStatusUpdate(input: unknown): NormalizedVoiceStatusUpdate | null {
    const canonical = getCanonicalCallRecord(input);
    if (!canonical) {
      return null;
    }

    const inboundCall = normalizeInboundCall(canonical);
    if (!inboundCall) {
      return null;
    }

    const rawStatus = getString(canonical.call, 'status', 'call_status', 'callStatus');
    const rawEvent = getString(canonical.root, 'event', 'event_type', 'eventType');
    const status = mapRetellStatus(rawStatus, rawEvent);
    if (!status) {
      return null;
    }

    const durationMs = getNumber(canonical.call, 'duration_ms', 'durationMs');
    const durationSecondsRaw = getNumber(canonical.call, 'duration', 'duration_seconds', 'durationSeconds');
    const durationSeconds =
      durationSecondsRaw !== null
        ? Math.max(Math.round(durationSecondsRaw), 0)
        : durationMs !== null
          ? Math.max(Math.round(durationMs / 1000), 0)
          : null;

    return {
      provider: 'retell',
      providerCallId: inboundCall.providerCallId,
      status,
      tenantId: canonical.metadata
        ? getString(canonical.metadata, 'tenantId', 'tenant_id')
        : null,
      businessId: canonical.metadata
        ? getString(canonical.metadata, 'businessId', 'business_id')
        : null,
      phoneNumberId: canonical.metadata
        ? getString(canonical.metadata, 'phoneNumberId', 'phone_number_id')
        : null,
      fromE164: inboundCall.fromE164,
      toE164: inboundCall.toE164,
      answeredAt: getString(canonical.call, 'start_timestamp', 'started_at', 'startedAt'),
      endedAt: getString(canonical.call, 'end_timestamp', 'ended_at', 'endedAt'),
      durationSeconds
    };
  },

  normalizeTranscriptArtifact(input: unknown): NormalizedVoiceTranscriptArtifact | null {
    const canonical = getCanonicalCallRecord(input);
    if (!canonical) {
      return null;
    }

    const inboundCall = normalizeInboundCall(canonical);
    if (!inboundCall) {
      return null;
    }

    const transcript =
      getString(canonical.call, 'transcript', 'transcript_text', 'transcriptText') ??
      getString(canonical.root, 'transcript', 'transcript_text', 'transcriptText');
    const summary =
      getString(canonical.call, 'summary', 'call_summary', 'callSummary') ??
      getString(canonical.root, 'summary', 'call_summary', 'callSummary');

    if (!transcript && !summary) {
      return null;
    }

    return {
      provider: 'retell',
      providerCallId: inboundCall.providerCallId,
      tenantId: canonical.metadata
        ? getString(canonical.metadata, 'tenantId', 'tenant_id')
        : null,
      businessId: canonical.metadata
        ? getString(canonical.metadata, 'businessId', 'business_id')
        : null,
      phoneNumberId: canonical.metadata
        ? getString(canonical.metadata, 'phoneNumberId', 'phone_number_id')
        : null,
      fromE164: inboundCall.fromE164,
      toE164: inboundCall.toE164,
      transcript: transcript ?? null,
      summary: summary ?? null
    };
  }
};
