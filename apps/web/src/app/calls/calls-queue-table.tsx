'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type CallRow = {
  twilioCallSid: string;
  status: string;
  triageStatus: string;
  fromE164: string | null;
  leadName: string | null;
  leadPhone: string | null;
  leadIntent: string | null;
  urgency: string | null;
  serviceAddress: string | null;
  summary: string | null;
  startedAt: string;
  phoneNumber: {
    e164: string;
    label: string | null;
  };
  agentProfile: {
    name: string | null;
    voiceName: string | null;
  } | null;
};

type QueueSearchState = {
  triageStatus: string;
  urgency?: string;
  q?: string;
};

function badgeClass(value: string | null | undefined) {
  switch (value) {
    case 'OPEN':
      return 'bg-amber-100 text-amber-900';
    case 'CONTACTED':
      return 'bg-blue-100 text-blue-900';
    case 'ARCHIVED':
      return 'bg-neutral-200 text-neutral-800';
    case 'high':
      return 'bg-orange-100 text-orange-900';
    case 'emergency':
      return 'bg-red-100 text-red-900';
    case 'medium':
      return 'bg-yellow-100 text-yellow-900';
    case 'low':
      return 'bg-green-100 text-green-900';
    case 'COMPLETED':
      return 'bg-green-100 text-green-900';
    case 'RINGING':
    case 'IN_PROGRESS':
      return 'bg-blue-100 text-blue-900';
    default:
      return 'bg-neutral-100 text-neutral-700';
  }
}

export function CallsQueueTable({
  calls,
  currentHref,
  queueState,
  limit,
  markContactedAction,
  archiveAction,
  bulkMarkContactedAction,
  bulkArchiveAction
}: {
  calls: CallRow[];
  currentHref: string;
  queueState: QueueSearchState;
  limit: string;
  markContactedAction: (formData: FormData) => void;
  archiveAction: (formData: FormData) => void;
  bulkMarkContactedAction: (formData: FormData) => void;
  bulkArchiveAction: (formData: FormData) => void;
}) {
  const router = useRouter();
  const [selectedCallSids, setSelectedCallSids] = useState<string[]>([]);
  const visibleCallSids = useMemo(() => calls.map((call) => call.twilioCallSid), [calls]);
  const visibleSelection = selectedCallSids.filter((callSid) => visibleCallSids.includes(callSid));
  const allVisibleSelected =
    visibleCallSids.length > 0 && visibleSelection.length === visibleCallSids.length;

  function setSelectedFromChecked(callSid: string, checked: boolean) {
    setSelectedCallSids((current) => {
      if (checked) {
        return current.includes(callSid) ? current : [...current, callSid];
      }

      return current.filter((value) => value !== callSid);
    });
  }

  function toggleVisible(checked: boolean) {
    if (checked) {
      setSelectedCallSids(visibleCallSids);
      return;
    }

    setSelectedCallSids([]);
  }

  function onLimitChange(nextLimit: string) {
    const params = new URLSearchParams();
    params.set('triageStatus', queueState.triageStatus);

    if (queueState.urgency) params.set('urgency', queueState.urgency);
    if (queueState.q?.trim()) params.set('q', queueState.q.trim());
    params.set('limit', nextLimit);

    router.push(`/calls?${params.toString()}`);
  }

  return (
    <>
      <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm text-neutral-600">
            {visibleSelection.length} selected on this page
          </div>

          <form action={bulkMarkContactedAction}>
            {visibleSelection.map((callSid) => (
              <input key={`bulk-contacted-${callSid}`} type="hidden" name="callSids" value={callSid} />
            ))}
            <button
              disabled={visibleSelection.length === 0}
              className="rounded-xl border border-neutral-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:border-neutral-200 disabled:text-neutral-400"
            >
              Mark selected contacted
            </button>
          </form>

          <form action={bulkArchiveAction}>
            {visibleSelection.map((callSid) => (
              <input key={`bulk-archived-${callSid}`} type="hidden" name="callSids" value={callSid} />
            ))}
            <button
              disabled={visibleSelection.length === 0}
              className="rounded-xl border border-neutral-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:border-neutral-200 disabled:text-neutral-400"
            >
              Archive selected
            </button>
          </form>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-neutral-600">Page size</span>
          <select
            value={limit}
            onChange={(event) => onLimitChange(event.target.value)}
            className="rounded-xl border border-neutral-300 px-3 py-2"
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-neutral-200">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50">
            <tr className="text-left">
              <th className="w-12 px-4 py-3 font-medium">
                <input
                  type="checkbox"
                  aria-label="Select visible rows"
                  checked={allVisibleSelected}
                  onChange={(event) => toggleVisible(event.target.checked)}
                />
              </th>
              <th className="px-4 py-3 font-medium">Call</th>
              <th className="px-4 py-3 font-medium">Lead</th>
              <th className="px-4 py-3 font-medium">Intent</th>
              <th className="px-4 py-3 font-medium">Urgency</th>
              <th className="px-4 py-3 font-medium">Triage</th>
              <th className="px-4 py-3 font-medium">Started</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {calls.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-neutral-500">
                  No calls matched this queue.
                </td>
              </tr>
            ) : (
              calls.map((call) => {
                const selected = visibleSelection.includes(call.twilioCallSid);

                return (
                  <tr key={call.twilioCallSid} className="border-t border-neutral-200 align-top">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${call.twilioCallSid}`}
                        checked={selected}
                        onChange={(event) =>
                          setSelectedFromChecked(call.twilioCallSid, event.target.checked)
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`/calls/${call.twilioCallSid}?returnTo=${encodeURIComponent(currentHref)}`}
                        className="font-medium underline underline-offset-2"
                      >
                        {call.twilioCallSid}
                      </a>
                      <div className="mt-1 text-neutral-600">{call.fromE164 ?? 'Unknown caller'}</div>
                      <div className="mt-1 text-neutral-500">
                        {call.phoneNumber.label ?? 'Number'} · {call.phoneNumber.e164}
                      </div>
                      <div className="mt-1 text-neutral-500">{call.agentProfile?.name ?? 'No agent'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{call.leadName ?? '—'}</div>
                      <div className="mt-1 text-neutral-600">{call.leadPhone ?? '—'}</div>
                      <div className="mt-1 text-neutral-600">{call.serviceAddress ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{call.leadIntent ?? '—'}</div>
                      <div className="mt-1 text-neutral-600">{call.summary ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass(call.urgency)}`}
                      >
                        {call.urgency ?? '—'}
                      </span>
                    </td>
                    <td className="space-y-2 px-4 py-3">
                      <div>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass(call.triageStatus)}`}
                        >
                          {call.triageStatus}
                        </span>
                      </div>
                      <div>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass(call.status)}`}
                        >
                          {call.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {new Date(call.startedAt).toLocaleString('en-US', {
                        dateStyle: 'short',
                        timeStyle: 'short'
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-2">
                        <form action={markContactedAction}>
                          <input type="hidden" name="callSid" value={call.twilioCallSid} />
                          <button className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-left text-sm">
                            Mark contacted
                          </button>
                        </form>
                        <form action={archiveAction}>
                          <input type="hidden" name="callSid" value={call.twilioCallSid} />
                          <button className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-left text-sm">
                            Archive
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
