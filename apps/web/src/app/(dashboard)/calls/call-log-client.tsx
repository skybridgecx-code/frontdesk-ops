'use client';

import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { getApiBaseUrl, getClientInternalApiHeaders } from '@/lib/api-client';
import { formatCallDuration, formatPhoneNumber, normalizeCallStatus } from '@/lib/call-utils';
import { StatusBadge } from '@/components/calls/status-badge';

type CallRecord = {
  id?: string;
  callSid?: string | null;
  twilioCallSid?: string;
  status?: string;
  callStatus?: string;
  callerName?: string | null;
  leadName?: string | null;
  callerPhone?: string | null;
  fromE164?: string | null;
  callReason?: string | null;
  leadIntent?: string | null;
  voicemailDuration?: number | null;
  durationSeconds?: number | null;
  answeredAt?: string | null;
  completedAt?: string | null;
  endedAt?: string | null;
  createdAt?: string;
  startedAt?: string;
  voiceHandling?: {
    fallbackUsed?: boolean;
    textBackOutcome?: 'sent' | 'skipped' | null;
    textBackSkippedReason?: string | null;
  };
};

type CallsResponse = {
  ok: boolean;
  calls: CallRecord[];
  page: number;
  totalPages: number;
};

type CallsFilter = 'all' | 'completed' | 'missed' | 'voicemail';

type CallLogClientProps = {
  initialCalls: CallRecord[];
  initialPage: number;
  totalPages: number;
  initialError: string | null;
};

const FILTERS: Array<{ key: CallsFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'completed', label: 'Completed' },
  { key: 'missed', label: 'Missed' },
  { key: 'voicemail', label: 'Voicemail' }
];

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-12 w-12" fill="none" aria-hidden="true">
      <path
        d="M6.5 4.5h2.8c.4 0 .8.3.9.7l.9 4.1c.1.4-.1.8-.4 1.1l-1.7 1.7a14.6 14.6 0 0 0 6 6l1.7-1.7c.3-.3.7-.5 1.1-.4l4.1.9c.4.1.7.5.7.9v2.8c0 .5-.4 1-1 1C11.2 22.5 1.5 12.8 1.5 5.5c0-.6.4-1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatDate(value: string | undefined) {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(value));
}

function formatSeconds(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return '—';
  }

  if (value < 60) {
    return `${value}s`;
  }

  const minutes = Math.floor(value / 60);
  const remaining = value % 60;
  return `${minutes}m ${remaining}s`;
}

function getCallId(call: CallRecord) {
  return call.callSid ?? call.twilioCallSid ?? call.id ?? '';
}

function getCaller(call: CallRecord) {
  return call.callerName ?? call.leadName ?? 'Unknown Caller';
}

function getPhone(call: CallRecord) {
  return formatPhoneNumber(call.callerPhone ?? call.fromE164 ?? null);
}

function getReason(call: CallRecord) {
  return call.callReason ?? call.leadIntent ?? 'Not captured';
}

function getStatus(call: CallRecord) {
  return normalizeCallStatus(call.callStatus ?? call.status);
}

function getDuration(call: CallRecord) {
  if (call.durationSeconds !== undefined && call.durationSeconds !== null) {
    return formatSeconds(call.durationSeconds);
  }

  return formatCallDuration(call.answeredAt ?? null, call.completedAt ?? call.endedAt ?? null);
}

function getDate(call: CallRecord) {
  return formatDate(call.createdAt ?? call.startedAt);
}

function VoiceEvidence({ call }: { call: CallRecord }) {
  const fallbackUsed = Boolean(call.voiceHandling?.fallbackUsed);
  const textBackOutcome = call.voiceHandling?.textBackOutcome ?? null;
  const skippedReason = call.voiceHandling?.textBackSkippedReason ?? null;

  const hasEvidence = fallbackUsed || textBackOutcome;
  if (!hasEvidence) {
    return <span className="text-xs text-gray-400">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
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

export function CallLogClient({ initialCalls, initialPage, totalPages, initialError }: CallLogClientProps) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [selectedFilter, setSelectedFilter] = useState<CallsFilter>('all');
  const [calls, setCalls] = useState<CallRecord[]>(initialCalls);
  const [page, setPage] = useState(initialPage);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const filteredCalls = useMemo(() => {
    if (selectedFilter === 'all') {
      return calls;
    }

    return calls.filter((call) => getStatus(call) === selectedFilter);
  }, [calls, selectedFilter]);

  const hasMore = page < totalPages;

  async function loadMore() {
    const nextPage = page + 1;

    setIsLoadingMore(true);
    setLoadError(null);

    try {
      const response = await fetch(`${getApiBaseUrl()}/v1/calls?page=${nextPage}&limit=25`, {
        cache: 'no-store',
        headers: await getClientInternalApiHeaders(() => getToken())
      });

      if (!response.ok) {
        setLoadError('Failed to load more calls. Try again.');
        return;
      }

      const payload = (await response.json()) as CallsResponse;
      if (!payload.ok) {
        setLoadError('Failed to load more calls. Try again.');
        return;
      }

      const seen = new Set(calls.map((call) => getCallId(call)));
      const nextCalls = payload.calls.filter((call) => !seen.has(getCallId(call)));

      setCalls((prev) => [...prev, ...nextCalls]);
      setPage(payload.page);
    } catch {
      setLoadError('Failed to load more calls. Try again.');
    } finally {
      setIsLoadingMore(false);
    }
  }

  if (calls.length === 0 && initialError) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-8 text-center">
        <div className="mx-auto h-12 w-12 text-rose-300">
          <PhoneIcon />
        </div>
        <h3 className="mt-4 text-lg font-medium text-rose-900">Could not load calls</h3>
        <p className="mt-2 text-sm text-rose-700">{initialError}</p>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="mt-4 inline-flex min-h-11 items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
        >
          Try again
        </button>
      </div>
    );
  }

  if (calls.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="mx-auto h-12 w-12 text-gray-300">
          <PhoneIcon />
        </div>
        <h3 className="mt-4 text-lg font-medium text-gray-900">No calls yet</h3>
        <p className="mt-2 text-gray-500">When customers call your AI receptionist, they'll appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => {
          const active = selectedFilter === filter.key;

          return (
            <button
              key={filter.key}
              type="button"
              onClick={() => setSelectedFilter(filter.key)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                active
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {filteredCalls.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <p className="text-sm text-gray-500">No calls match this filter yet.</p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white md:block">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Caller</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Reason</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Voice</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Duration</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCalls.map((call) => {
                  const callId = getCallId(call);
                  const href = callId ? `/calls/${callId}` : '/calls';
                  const status = getStatus(call);

                  return (
                    <tr
                      key={href + getDate(call)}
                      className="cursor-pointer hover:bg-blue-50/40"
                      tabIndex={0}
                      onClick={() => router.push(href)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          router.push(href);
                        }
                      }}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        <Link href={href} className="block w-full">
                          {getCaller(call)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{getPhone(call)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{getReason(call)}</td>
                      <td className="px-4 py-3 text-sm">
                        <StatusBadge status={status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <VoiceEvidence call={call} />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{getDuration(call)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{getDate(call)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {filteredCalls.map((call) => {
              const callId = getCallId(call);
              const href = callId ? `/calls/${callId}` : '/calls';
              const status = getStatus(call);

              return (
                <Link key={href + getDate(call)} href={href} className="block rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{getCaller(call)}</p>
                      <p className="text-xs text-gray-500">{getPhone(call)}</p>
                    </div>
                    <StatusBadge status={status} size="sm" />
                  </div>
                  <p className="mt-3 text-sm text-gray-700">{getReason(call)}</p>
                  <div className="mt-2">
                    <VoiceEvidence call={call} />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                    <span>{getDuration(call)}</span>
                    <span>{getDate(call)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {hasMore ? (
        <div className="flex flex-col items-center gap-2 pt-2">
          <button
            type="button"
            onClick={loadMore}
            disabled={isLoadingMore}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoadingMore ? 'Loading...' : 'Load more'}
          </button>
          {loadError ? <p className="text-xs text-red-600">{loadError}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
