'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type CallRow = {
  twilioCallSid: string;
  status: string;
  routeKind: string | null;
  triageStatus: string;
  reviewStatus: string;
  fromE164: string | null;
  leadName: string | null;
  leadPhone: string | null;
  leadIntent: string | null;
  urgency: string | null;
  serviceAddress: string | null;
  summary: string | null;
  startedAt: string;
  durationSeconds: number | null;
  phoneNumber: {
    e164: string;
    label: string | null;
  };
  agentProfile: {
    name: string | null;
    voiceName: string | null;
  } | null;
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

type QueueSearchState = {
  triageStatus: string;
  reviewStatus?: string;
  urgency?: string;
  q?: string;
};

type QuickEditDraft = {
  leadName: string;
  leadPhone: string;
  reviewStatus: string;
};

function badgeClass(value: string | null | undefined) {
  switch (value) {
    case 'OPEN':
      return 'border border-amber-300 bg-amber-100 text-amber-900';
    case 'CONTACTED':
      return 'border border-blue-300 bg-blue-100 text-blue-900';
    case 'ARCHIVED':
      return 'border border-neutral-300 bg-neutral-200 text-neutral-800';
    case 'UNREVIEWED':
      return 'border border-neutral-300 bg-white text-neutral-700';
    case 'REVIEWED':
      return 'border border-emerald-300 bg-emerald-100 text-emerald-900';
    case 'NEEDS_REVIEW':
      return 'border border-rose-400 bg-rose-100 text-rose-900';
    case 'high':
      return 'border border-orange-300 bg-orange-100 text-orange-900';
    case 'emergency':
      return 'border border-red-400 bg-red-100 text-red-900';
    case 'medium':
      return 'border border-yellow-300 bg-yellow-100 text-yellow-900';
    case 'low':
      return 'border border-green-300 bg-green-100 text-green-900';
    case 'COMPLETED':
      return 'border border-green-300 bg-green-100 text-green-900';
    case 'RINGING':
    case 'IN_PROGRESS':
      return 'border border-blue-300 bg-blue-100 text-blue-900';
    case 'AI':
      return 'border border-sky-300 bg-sky-100 text-sky-900';
    case 'VOICEMAIL':
      return 'border border-purple-300 bg-purple-100 text-purple-900';
    case 'HUMAN':
      return 'border border-indigo-300 bg-indigo-100 text-indigo-900';
    case 'REJECTED':
      return 'border border-neutral-300 bg-neutral-100 text-neutral-500';
    default:
      return 'border border-neutral-200 bg-neutral-100 text-neutral-700';
  }
}

function getDataQualitySignals(call: CallRow) {
  const missingData = !call.leadName || !call.leadPhone || !call.leadIntent;

  return {
    missingData,
    needsReview: call.reviewStatus === 'NEEDS_REVIEW',
    unreviewed: call.reviewStatus === 'UNREVIEWED'
  };
}

function getRowClass(call: CallRow) {
  if (call.reviewStatus === 'NEEDS_REVIEW') {
    return 'border-t border-rose-200 bg-rose-50/50 align-top';
  }

  if (call.urgency === 'emergency') {
    return 'border-t border-red-200 bg-red-50/40 align-top';
  }

  if (call.urgency === 'high') {
    return 'border-t border-orange-200 bg-orange-50/40 align-top';
  }

  return 'border-t border-neutral-200 align-top';
}

export function CallsQueueTable({
  calls,
  currentHref,
  queueState,
  limit,
  markContactedAction,
  archiveAction,
  bulkMarkContactedAction,
  bulkArchiveAction,
  saveQueueQuickEditAction
}: {
  calls: CallRow[];
  currentHref: string;
  queueState: QueueSearchState;
  limit: string;
  markContactedAction: (formData: FormData) => void;
  archiveAction: (formData: FormData) => void;
  bulkMarkContactedAction: (formData: FormData) => void;
  bulkArchiveAction: (formData: FormData) => void;
  saveQueueQuickEditAction: (formData: FormData) => void;
}) {
  const router = useRouter();
  const [selectedCallSids, setSelectedCallSids] = useState<string[]>([]);
  const [editingCallSid, setEditingCallSid] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, QuickEditDraft>>({});
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
    if (queueState.reviewStatus) params.set('reviewStatus', queueState.reviewStatus);
    if (queueState.q?.trim()) params.set('q', queueState.q.trim());
    params.set('limit', nextLimit);

    router.push(`/calls?${params.toString()}`);
  }

  function startEditing(call: CallRow) {
    setEditingCallSid(call.twilioCallSid);
    setDrafts((current) => ({
      ...current,
      [call.twilioCallSid]: {
        leadName: call.leadName ?? '',
        leadPhone: call.leadPhone ?? '',
        reviewStatus: call.reviewStatus
      }
    }));
  }

  function updateDraft(callSid: string, field: keyof QuickEditDraft, value: string) {
    setDrafts((current) => ({
      ...current,
      [callSid]: {
        ...(current[callSid] ?? {
          leadName: '',
          leadPhone: '',
          reviewStatus: 'UNREVIEWED'
        }),
        [field]: value
      }
    }));
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
              <th className="px-4 py-3 font-medium">Review</th>
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
                const isEditing = editingCallSid === call.twilioCallSid;
                const draft = drafts[call.twilioCallSid] ?? {
                  leadName: call.leadName ?? '',
                  leadPhone: call.leadPhone ?? '',
                  reviewStatus: call.reviewStatus
                };
                const signals = getDataQualitySignals(call);

                return (
                  <tr key={call.twilioCallSid} className={getRowClass(call)}>
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
                      <div className="mt-2 flex flex-wrap gap-2">
                        {call.routeKind ? (
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass(call.routeKind)}`}
                          >
                            {call.routeKind}
                          </span>
                        ) : null}
                        {signals.missingData ? (
                          <span className="rounded-full border border-amber-300 bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">
                            Missing data
                          </span>
                        ) : null}
                        {signals.needsReview ? (
                          <span className="rounded-full border border-rose-400 bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-900">
                            Needs review
                          </span>
                        ) : null}
                        {!signals.needsReview && signals.unreviewed ? (
                          <span className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700">
                            Unreviewed
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            value={draft.leadName}
                            onChange={(event) =>
                              updateDraft(call.twilioCallSid, 'leadName', event.target.value)
                            }
                            placeholder="Lead name"
                            className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                          />
                          <input
                            value={draft.leadPhone}
                            onChange={(event) =>
                              updateDraft(call.twilioCallSid, 'leadPhone', event.target.value)
                            }
                            placeholder="Lead phone"
                            className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                          />
                          <div className="text-neutral-600">{call.serviceAddress ?? '—'}</div>
                        </div>
                      ) : (
                        <>
                          <div>{call.leadName ?? '—'}</div>
                          <div className="mt-1 text-neutral-600">{call.leadPhone ?? '—'}</div>
                          <div className="mt-1 text-neutral-600">{call.serviceAddress ?? '—'}</div>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div>{call.leadIntent ?? '—'}</div>
                      <div className="mt-1 text-neutral-600">{call.summary ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass(call.urgency)}`}
                        >
                          {call.urgency ?? '—'}
                        </span>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass(call.triageStatus)}`}
                        >
                          {call.triageStatus}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-2">
                        {isEditing ? (
                          <select
                            value={draft.reviewStatus}
                            onChange={(event) =>
                              updateDraft(call.twilioCallSid, 'reviewStatus', event.target.value)
                            }
                            className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                          >
                            <option value="UNREVIEWED">UNREVIEWED</option>
                            <option value="NEEDS_REVIEW">NEEDS_REVIEW</option>
                            <option value="REVIEWED">REVIEWED</option>
                          </select>
                        ) : (
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass(call.reviewStatus)}`}
                          >
                            {call.reviewStatus}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        {new Date(call.startedAt).toLocaleString('en-US', {
                          dateStyle: 'short',
                          timeStyle: 'short'
                        })}
                      </div>
                      {call.durationSeconds != null && (
                        <div className="mt-1 text-neutral-500">
                          {formatDuration(call.durationSeconds)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-2">
                        {isEditing ? (
                          <>
                            <form action={saveQueueQuickEditAction}>
                              <input type="hidden" name="callSid" value={call.twilioCallSid} />
                              <input type="hidden" name="leadName" value={draft.leadName} />
                              <input type="hidden" name="leadPhone" value={draft.leadPhone} />
                              <input type="hidden" name="reviewStatus" value={draft.reviewStatus} />
                              <button className="w-full rounded-xl border border-black bg-black px-3 py-2 text-left text-sm text-white">
                                Save
                              </button>
                            </form>
                            <button
                              type="button"
                              onClick={() => setEditingCallSid(null)}
                              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-left text-sm"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEditing(call)}
                              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-left text-sm"
                            >
                              Edit
                            </button>
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
                          </>
                        )}
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
