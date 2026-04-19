'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DataTable } from '../components/data-table';
import { EmptyState } from '../components/empty-state';
import { StatusBadge } from '../components/status-badge';

type CallRow = {
  twilioCallSid: string;
  status: string;
  triageStatus: string;
  reviewStatus: string;
  fromE164: string | null;
  leadName: string | null;
  leadPhone: string | null;
  leadIntent: string | null;
  urgency: string | null;
  startedAt: string;
  durationSeconds: number | null;
  recordingUrl: string | null;
  recordingStatus: string | null;
  voiceHandling?: {
    fallbackUsed?: boolean;
    textBackOutcome?: 'sent' | 'skipped' | null;
    textBackSkippedReason?: string | null;
  };
};

function formatDuration(seconds: number | null) {
  if (seconds === null) {
    return '—';
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${String(remainder).padStart(2, '0')}s`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function callDisplayName(call: CallRow) {
  return call.leadName ?? call.fromE164 ?? call.twilioCallSid;
}

function hasRecordingAvailable(call: CallRow) {
  return Boolean(call.recordingUrl);
}

function RecordingIndicator() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-sm sm:text-[11px] font-medium text-indigo-700"
      title="Recording available"
      aria-label="Recording available"
    >
      <svg viewBox="0 0 20 20" className="h-3 w-3" fill="currentColor" aria-hidden="true">
        <path d="M10 12a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3Zm5-3a1 1 0 1 0-2 0 3 3 0 0 1-6 0 1 1 0 1 0-2 0 5 5 0 0 0 4 4.9V16H7a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.1A5 5 0 0 0 15 9Z" />
      </svg>
      Rec
    </span>
  );
}

function VoiceEvidence({ call }: { call: CallRow }) {
  const fallbackUsed = Boolean(call.voiceHandling?.fallbackUsed);
  const textBackOutcome = call.voiceHandling?.textBackOutcome ?? null;
  const skippedReason = call.voiceHandling?.textBackSkippedReason ?? null;

  if (!fallbackUsed && !textBackOutcome) {
    return null;
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {fallbackUsed ? (
        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
          Fallback
        </span>
      ) : null}
      {textBackOutcome === 'sent' ? (
        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
          Text-back sent
        </span>
      ) : null}
      {textBackOutcome === 'skipped' ? (
        <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
          {skippedReason ? `Text-back skipped: ${skippedReason}` : 'Text-back skipped'}
        </span>
      ) : null}
    </div>
  );
}

export function CallsQueueTable({
  calls,
  returnTo,
  markContactedAction,
  archiveAction
}: {
  calls: CallRow[];
  returnTo: string;
  markContactedAction: (formData: FormData) => void;
  archiveAction: (formData: FormData) => void;
}) {
  const router = useRouter();

  if (calls.length === 0) {
    return (
      <EmptyState
        title="No calls yet"
        description="No calls yet. When your AI answers the phone, calls will appear here."
        actionLabel="Go to Dashboard"
        actionHref="/dashboard"
      />
    );
  }

  return (
    <>
      <div className="hidden md:block">
        <DataTable>
          <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Caller</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Intent</th>
              <th className="px-4 py-3 font-medium">Urgency</th>
              <th className="px-4 py-3 font-medium">Duration</th>
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Triage Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {calls.map((call) => (
              <tr
                key={call.twilioCallSid}
                onClick={() => router.push(`/calls/${call.twilioCallSid}?returnTo=${encodeURIComponent(returnTo)}`)}
                className="cursor-pointer border-b border-gray-100 text-sm text-gray-700 transition hover:bg-indigo-50"
              >
                <td className="px-4 py-3 font-medium text-gray-900">
                  <div>{callDisplayName(call)}</div>
                  <VoiceEvidence call={call} />
                </td>
                <td className="px-4 py-3 text-gray-600">{call.leadPhone ?? call.fromE164 ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600">{call.leadIntent ?? '—'}</td>
                <td className="px-4 py-3">
                  <StatusBadge value={call.urgency ?? 'unknown'} type="urgency" fallback="Unknown" />
                </td>
                <td className="px-4 py-3 text-gray-600">
                  <div className="flex items-center gap-2">
                    <span>{formatDuration(call.durationSeconds)}</span>
                    {hasRecordingAvailable(call) ? <RecordingIndicator /> : null}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">{formatDateTime(call.startedAt)}</td>
                <td className="px-4 py-3">
                  <StatusBadge value={call.triageStatus} type="triage" />
                </td>
                <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/calls/${call.twilioCallSid}?returnTo=${encodeURIComponent(returnTo)}`}
                      className="inline-flex min-h-11 items-center rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-indigo-50 sm:text-xs"
                    >
                      Open
                    </Link>
                    <form action={markContactedAction}>
                      <input type="hidden" name="callSid" value={call.twilioCallSid} />
                      <button className="inline-flex min-h-11 items-center rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-indigo-50 sm:text-xs">
                        Contacted
                      </button>
                    </form>
                    <form action={archiveAction}>
                      <input type="hidden" name="callSid" value={call.twilioCallSid} />
                      <button className="inline-flex min-h-11 items-center rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-indigo-50 sm:text-xs">
                        Archive
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </div>

      <div className="grid gap-3 md:hidden">
        {calls.map((call) => (
          <article
            key={call.twilioCallSid}
            onClick={() => router.push(`/calls/${call.twilioCallSid}?returnTo=${encodeURIComponent(returnTo)}`)}
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-gray-900">{callDisplayName(call)}</p>
                <p className="mt-1 text-sm text-gray-500">{call.leadPhone ?? call.fromE164 ?? '—'}</p>
                <VoiceEvidence call={call} />
              </div>
              <StatusBadge value={call.urgency ?? 'unknown'} type="urgency" fallback="Unknown" />
            </div>
            <p className="mt-3 text-sm text-gray-600">{call.leadIntent ?? 'No intent extracted'}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-gray-500">
              <StatusBadge value={call.triageStatus} type="triage" />
              <span>{formatDuration(call.durationSeconds)}</span>
              {hasRecordingAvailable(call) ? <RecordingIndicator /> : null}
              <span>{formatDateTime(call.startedAt)}</span>
            </div>
            <div className="mt-4 flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
              <form action={markContactedAction} className="flex-1">
                <input type="hidden" name="callSid" value={call.twilioCallSid} />
                <button className="min-h-11 w-full rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-indigo-50">
                  Mark contacted
                </button>
              </form>
              <form action={archiveAction} className="flex-1">
                <input type="hidden" name="callSid" value={call.twilioCallSid} />
                <button className="min-h-11 w-full rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-indigo-50">
                  Archive
                </button>
              </form>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
