import type { Metadata } from 'next';
import Link from 'next/link';
import { getApiBaseUrl, getInternalApiHeaders } from '@/lib/api';
import { StatusBadge } from '@/components/calls/status-badge';
import { formatCallDuration, formatPhoneNumber, normalizeCallStatus } from '@/lib/call-utils';

export const dynamic = 'force-dynamic';

type CallEventPayload = {
  reason?: string | null;
  routeKind?: string | null;
  status?: string | null;
  to?: string | null;
  from?: string | null;
  message?: string | null;
  errorMessage?: string | null;
  destinationPhoneNumberE164?: string | null;
};

type CallEvent = {
  type: string;
  sequence: number;
  createdAt: string;
  payloadJson?: CallEventPayload | null;
};

type CallDetail = {
  id?: string;
  callSid?: string | null;
  twilioCallSid?: string;
  callerName?: string | null;
  leadName?: string | null;
  callerPhone?: string | null;
  fromE164?: string | null;
  callReason?: string | null;
  leadIntent?: string | null;
  callStatus?: string;
  status?: string;
  answeredAt?: string | null;
  completedAt?: string | null;
  endedAt?: string | null;
  durationSeconds?: number | null;
  voicemailUrl?: string | null;
  voicemailDuration?: number | null;
  recordingUrl?: string | null;
  recordingDuration?: number | null;
  createdAt?: string;
  startedAt?: string;
  events?: CallEvent[];
};

type CallResponse = {
  ok: boolean;
  call: CallDetail;
};

export async function generateMetadata({
  params
}: {
  params: Promise<{ callSid: string }>;
}): Promise<Metadata> {
  const { callSid } = await params;

  return {
    title: `Call ${callSid} | SkyBridgeCX`
  };
}

async function getCall(callSid: string): Promise<CallDetail | null> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/v1/calls/${callSid}`, {
      cache: 'no-store',
      headers: await getInternalApiHeaders()
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as CallResponse;
    if (!payload.ok) {
      return null;
    }

    return payload.call;
  } catch {
    return null;
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function formatDuration(call: CallDetail) {
  const byDates = formatCallDuration(call.answeredAt ?? null, call.completedAt ?? call.endedAt ?? null);
  if (byDates !== '—') {
    return byDates;
  }

  if (call.durationSeconds === null || call.durationSeconds === undefined) {
    return '—';
  }

  if (call.durationSeconds < 60) {
    return `${call.durationSeconds}s`;
  }

  const minutes = Math.floor(call.durationSeconds / 60);
  const remaining = call.durationSeconds % 60;
  return `${minutes}m ${remaining}s`;
}

function formatEvidenceText(value: string | null | undefined) {
  if (!value) {
    return '—';
  }

  return value
    .replace(/^twilio\.status\./, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getLatestEvent(call: CallDetail, type: string) {
  const matches = (call.events ?? []).filter((event) => event.type === type);
  return matches.length > 0 ? matches[matches.length - 1] : null;
}

function getLatestStatusEvent(call: CallDetail) {
  const matches = (call.events ?? []).filter((event) => event.type.startsWith('twilio.status.'));
  return matches.length > 0 ? matches[matches.length - 1] : null;
}

function DetailCard({
  label,
  value,
  className
}: {
  label: string;
  value: string | null;
  className?: string;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-gray-900 font-medium ${className ?? ''}`}>{value || '—'}</p>
    </div>
  );
}

export default async function CallDetailPage({
  params
}: {
  params: Promise<{ callSid: string }>;
}) {
  const { callSid } = await params;
  const call = await getCall(callSid);

  if (!call) {
    return (
      <div className="space-y-6">
        <Link href="/calls" className="text-blue-600 hover:text-blue-800 text-sm">
          ← Back to Call Log
        </Link>

        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <h2 className="text-xl font-semibold text-gray-900">Call not found</h2>
          <p className="mt-2 text-sm text-gray-500">The requested call could not be found.</p>
        </div>
      </div>
    );
  }

  const callerName = call.callerName ?? call.leadName ?? 'Unknown Caller';
  const callerPhone = formatPhoneNumber(call.callerPhone ?? call.fromE164 ?? null);
  const reason = call.callReason ?? call.leadIntent ?? 'Not captured';
  const normalizedStatus = normalizeCallStatus(call.callStatus ?? call.status);
  const resolvedCallSid = call.callSid ?? call.twilioCallSid ?? callSid;
  const resolvedVoicemailUrl = call.voicemailUrl ?? call.recordingUrl ?? null;
  const resolvedVoicemailDuration = call.voicemailDuration ?? call.recordingDuration ?? null;
  const fallbackEvent = getLatestEvent(call, 'twilio.inbound.fallback');
  const textbackSkippedEvent = getLatestEvent(call, 'textback.skipped');
  const textbackSentEvent = getLatestEvent(call, 'textback.sent');
  const latestStatusEvent = getLatestStatusEvent(call);

  return (
    <div className="space-y-6">
      <Link href="/calls" className="text-blue-600 hover:text-blue-800 text-sm">
        ← Back to Call Log
      </Link>

      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{callerName}</h2>
            <p className="text-gray-500">{callerPhone}</p>
          </div>
          <StatusBadge status={normalizedStatus} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <DetailCard label="Reason for Call" value={reason} />
        <DetailCard label="Call Status" value={normalizedStatus} />
        <DetailCard label="Answered At" value={formatDate(call.answeredAt)} />
        <DetailCard label="Completed At" value={formatDate(call.completedAt ?? call.endedAt)} />
        <DetailCard label="Duration" value={formatDuration(call)} />
        <DetailCard label="Call SID" value={resolvedCallSid} className="font-mono text-xs" />
      </div>

      {fallbackEvent || textbackSkippedEvent || textbackSentEvent || latestStatusEvent ? (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Voice handling evidence</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DetailCard
              label="Inbound Fallback"
              value={
                fallbackEvent
                  ? `Used — ${formatEvidenceText(fallbackEvent.payloadJson?.reason)}`
                  : 'Not used'
              }
            />

            <DetailCard
              label="Missed-Call Text Back"
              value={
                textbackSentEvent
                  ? 'Sent'
                  : textbackSkippedEvent
                    ? `Skipped — ${formatEvidenceText(textbackSkippedEvent.payloadJson?.reason)}`
                    : 'No event'
              }
            />

            <DetailCard
              label="Latest Twilio Status"
              value={latestStatusEvent ? formatEvidenceText(latestStatusEvent.type) : '—'}
            />

            <DetailCard
              label="Latest Status At"
              value={latestStatusEvent ? formatDate(latestStatusEvent.createdAt) : '—'}
            />
          </div>
        </div>
      ) : null}

      {resolvedVoicemailUrl ? (
        <div className="mt-6 bg-purple-50 border border-purple-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-purple-900 mb-3">🎤 Voicemail</h3>
          <audio controls className="w-full">
            <source src={resolvedVoicemailUrl} type="audio/wav" />
            Your browser does not support audio playback.
          </audio>
          <p className="text-sm text-purple-600 mt-2">
            Duration: {resolvedVoicemailDuration ? `${resolvedVoicemailDuration}s` : 'Unknown'}
          </p>
        </div>
      ) : null}
    </div>
  );
}
