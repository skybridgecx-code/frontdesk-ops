import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getApiBaseUrl, getInternalApiHeaders } from '@/lib/api';
import { DetailReviewShortcuts } from './detail-review-shortcuts';

export const dynamic = 'force-dynamic';

type CallDetail = {
  twilioCallSid: string;
  twilioStreamSid: string | null;
  status: string;
  triageStatus: string;
  reviewStatus: string;
  contactedAt: string | null;
  archivedAt: string | null;
  reviewedAt: string | null;
  fromE164: string | null;
  toE164: string | null;
  callerTranscript: string | null;
  assistantTranscript: string | null;
  leadName: string | null;
  leadPhone: string | null;
  leadIntent: string | null;
  urgency: string | null;
  serviceAddress: string | null;
  summary: string | null;
  operatorNotes: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  phoneNumber: {
    e164: string;
    label: string | null;
    routingMode: string;
  };
  agentProfile: {
    name: string;
    voiceName: string | null;
    isActive: boolean;
  } | null;
  events: Array<{
    type: string;
    sequence: number;
    createdAt: string;
  }>;
};


function badgeClass(value: string | null | undefined) {
  switch (value) {
    case 'OPEN':
      return 'bg-amber-100 text-amber-900';
    case 'CONTACTED':
      return 'bg-blue-100 text-blue-900';
    case 'ARCHIVED':
      return 'bg-neutral-200 text-neutral-800';
    case 'UNREVIEWED':
      return 'bg-neutral-100 text-neutral-700';
    case 'REVIEWED':
      return 'bg-emerald-100 text-emerald-900';
    case 'NEEDS_REVIEW':
      return 'bg-rose-100 text-rose-900';
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

async function getCall(callSid: string) {
  const res = await fetch(`${getApiBaseUrl()}/v1/calls/${callSid}`, {
    cache: 'no-store',
    headers: getInternalApiHeaders()
  });

  if (!res.ok) {
    throw new Error(`Failed to load call: ${res.status}`);
  }

  return (await res.json()) as { ok: true; call: CallDetail };
}

function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : '—';
}

function formatDuration(seconds: number | null) {
  if (seconds == null) {
    return '—';
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${String(remainingSeconds).padStart(2, '0')}s`;
}

function HistoryItem({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-sm text-black">{value}</div>
    </div>
  );
}

function formatReviewStatusLabel(value: string | undefined) {
  switch (value) {
    case 'UNREVIEWED':
      return 'Unreviewed';
    case 'NEEDS_REVIEW':
      return 'Needs review';
    case 'REVIEWED':
      return 'Reviewed';
    default:
      return value;
  }
}

function formatTriageStatusLabel(value: string | undefined) {
  switch (value) {
    case 'OPEN':
      return 'Open';
    case 'CONTACTED':
      return 'Contacted';
    case 'ARCHIVED':
      return 'Archived';
    default:
      return value;
  }
}

function formatUrgencyLabel(value: string | undefined) {
  switch (value) {
    case 'low':
      return 'Low urgency';
    case 'medium':
      return 'Medium urgency';
    case 'high':
      return 'High urgency';
    case 'emergency':
      return 'Emergency';
    default:
      return null;
  }
}

function buildReturnContextSummary(returnTo: string) {
  const url = new URL(returnTo, 'http://localhost');
  const parts = [
    formatTriageStatusLabel(url.searchParams.get('triageStatus') ?? 'OPEN'),
    formatReviewStatusLabel(url.searchParams.get('reviewStatus') ?? undefined),
    formatUrgencyLabel(url.searchParams.get('urgency') ?? undefined),
    url.searchParams.get('q')?.trim() ? `Search: "${url.searchParams.get('q')?.trim()}"` : null,
    url.searchParams.get('page') ? `Page ${url.searchParams.get('page')}` : null
  ].filter(Boolean);

  return parts.join(' • ');
}

export default async function CallDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ callSid: string }>;
  searchParams: Promise<{ returnTo?: string; notice?: string }>;
}) {
  const { callSid } = await params;
  const resolvedSearchParams = await searchParams;
  const returnTo =
    resolvedSearchParams.returnTo && resolvedSearchParams.returnTo.startsWith('/calls')
      ? resolvedSearchParams.returnTo
      : '/calls?triageStatus=OPEN';
  const notice =
    resolvedSearchParams.notice === 'contacted'
      ? 'Call marked contacted.'
      : resolvedSearchParams.notice === 'archived'
        ? 'Call archived.'
        : resolvedSearchParams.notice === 'extracted'
          ? 'Extraction rerun queued.'
          : resolvedSearchParams.notice === 'saved'
            ? 'Review changes saved.'
            : resolvedSearchParams.notice === 'saved-next'
                ? 'Review changes saved. Moved to the next call needing review.'
                : resolvedSearchParams.notice === 'no-review-calls'
                  ? 'Review changes saved. No more calls need review.'
                  : null;
  const data = await getCall(callSid);
  const call = data.call;
  const detailHref = `/calls/${callSid}?returnTo=${encodeURIComponent(returnTo)}`;
  const reviewFormId = 'call-review-form';
  const notesFieldId = 'operator-notes';
  const reviewStatusFieldId = 'review-status';
  const saveButtonId = 'save-review-button';
  const saveNextButtonId = 'save-review-next-button';
  const returnContextSummary = buildReturnContextSummary(returnTo);

  async function markContacted() {
    'use server';

    await fetch(`${getApiBaseUrl()}/v1/calls/${callSid}/mark-contacted`, {
      method: 'POST',
      headers: getInternalApiHeaders()
    });

    revalidatePath('/calls');
    revalidatePath(`/calls/${callSid}`);
    redirect(`${detailHref}&notice=contacted`);
  }

  async function archiveCall() {
    'use server';

    await fetch(`${getApiBaseUrl()}/v1/calls/${callSid}/archive`, {
      method: 'POST',
      headers: getInternalApiHeaders()
    });

    revalidatePath('/calls');
    revalidatePath(`/calls/${callSid}`);
    redirect(`${detailHref}&notice=archived`);
  }

  async function rerunExtraction() {
    'use server';

    await fetch(`${getApiBaseUrl()}/v1/calls/${callSid}/extract`, {
      method: 'POST',
      headers: getInternalApiHeaders()
    });

    revalidatePath('/calls');
    revalidatePath(`/calls/${callSid}`);
    redirect(`${detailHref}&notice=extracted`);
  }

  async function saveReview(formData: FormData) {
    'use server';

    const reviewStatus = String(formData.get('reviewStatus') ?? '');
    const urgency = String(formData.get('urgency') ?? '');

    const payload = {
      leadName: String(formData.get('leadName') ?? '').trim() || null,
      leadPhone: String(formData.get('leadPhone') ?? '').trim() || null,
      leadIntent: String(formData.get('leadIntent') ?? '').trim() || null,
      urgency: urgency || null,
      serviceAddress: String(formData.get('serviceAddress') ?? '').trim() || null,
      summary: String(formData.get('summary') ?? '').trim() || null,
      operatorNotes: String(formData.get('operatorNotes') ?? '').trim() || null,
      reviewStatus
    };

    const res = await fetch(`${getApiBaseUrl()}/v1/calls/${callSid}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        ...getInternalApiHeaders()
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`Failed to save call review: ${res.status}`);
    }

    revalidatePath('/calls');
    revalidatePath(`/calls/${callSid}`);
    redirect(`${detailHref}&notice=saved`);
  }

  async function saveAndReviewNext(formData: FormData) {
    'use server';

    const reviewStatus = String(formData.get('reviewStatus') ?? '');
    const urgency = String(formData.get('urgency') ?? '');

    const payload = {
      leadName: String(formData.get('leadName') ?? '').trim() || null,
      leadPhone: String(formData.get('leadPhone') ?? '').trim() || null,
      leadIntent: String(formData.get('leadIntent') ?? '').trim() || null,
      urgency: urgency || null,
      serviceAddress: String(formData.get('serviceAddress') ?? '').trim() || null,
      summary: String(formData.get('summary') ?? '').trim() || null,
      operatorNotes: String(formData.get('operatorNotes') ?? '').trim() || null,
      reviewStatus
    };

    const res = await fetch(`${getApiBaseUrl()}/v1/calls/${callSid}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        ...getInternalApiHeaders()
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`Failed to save call review: ${res.status}`);
    }

    revalidatePath('/calls');
    revalidatePath(`/calls/${callSid}`);

    const nextRes = await fetch(`${getApiBaseUrl()}/v1/calls/review-next`, {
      cache: 'no-store',
      headers: getInternalApiHeaders()
    });

    if (!nextRes.ok) {
      throw new Error(`Failed to load review-next call: ${nextRes.status}`);
    }

    const nextData = (await nextRes.json()) as { ok: true; callSid: string | null };

    if (!nextData.callSid) {
      redirect(`${detailHref}&notice=no-review-calls`);
    }

    redirect(`/calls/${nextData.callSid}?returnTo=${encodeURIComponent(returnTo)}&notice=saved-next`);
  }

  return (
    <main className="min-h-screen bg-white text-black p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <DetailReviewShortcuts
          formId={reviewFormId}
          notesFieldId={notesFieldId}
          reviewStatusFieldId={reviewStatusFieldId}
          saveButtonId={saveButtonId}
          saveNextButtonId={saveNextButtonId}
        />

        {notice ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
            {notice}
          </div>
        ) : null}

        <div className="flex items-start justify-between gap-4">
          <div>
            <a href={returnTo} className="text-sm underline underline-offset-2 text-neutral-600">
              ← Back to filtered queue
            </a>
            <div className="mt-2 text-sm text-neutral-600">Return to: {returnContextSummary}</div>
            <h1 className="text-3xl font-semibold tracking-tight mt-2">{call.twilioCallSid}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass(call.status)}`}>
                {call.status}
              </span>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass(call.triageStatus)}`}>
                {formatTriageStatusLabel(call.triageStatus)}
              </span>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass(call.reviewStatus)}`}>
                {formatReviewStatusLabel(call.reviewStatus)}
              </span>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass(call.urgency)}`}>
                {call.urgency ?? 'no urgency'}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <form action={rerunExtraction}>
              <button className="rounded-xl border border-neutral-300 px-4 py-2 text-sm">
                Extract
              </button>
            </form>
            <form action={markContacted}>
              <button className="rounded-xl border border-neutral-300 px-4 py-2 text-sm">
                Mark contacted
              </button>
            </form>
            <form action={archiveCall}>
              <button className="rounded-xl border border-neutral-300 px-4 py-2 text-sm">
                Archive
              </button>
            </form>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <section className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="font-medium">Lead</h2>
            <div className="mt-3 space-y-2 text-sm">
              <div><span className="text-neutral-500">Name:</span> {call.leadName ?? '—'}</div>
              <div><span className="text-neutral-500">Phone:</span> {call.leadPhone ?? '—'}</div>
              <div><span className="text-neutral-500">Intent:</span> {call.leadIntent ?? '—'}</div>
              <div><span className="text-neutral-500">Urgency:</span> {call.urgency ?? '—'}</div>
              <div><span className="text-neutral-500">Address:</span> {call.serviceAddress ?? '—'}</div>
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="font-medium">Call</h2>
            <div className="mt-3 space-y-2 text-sm">
              <div><span className="text-neutral-500">From:</span> {call.fromE164 ?? '—'}</div>
              <div><span className="text-neutral-500">To:</span> {call.toE164 ?? '—'}</div>
              <div><span className="text-neutral-500">Number:</span> {call.phoneNumber.label ?? '—'} · {call.phoneNumber.e164}</div>
              <div><span className="text-neutral-500">Routing:</span> {call.phoneNumber.routingMode}</div>
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="font-medium">Agent</h2>
            <div className="mt-3 space-y-2 text-sm">
              <div><span className="text-neutral-500">Name:</span> {call.agentProfile?.name ?? '—'}</div>
              <div><span className="text-neutral-500">Voice:</span> {call.agentProfile?.voiceName ?? '—'}</div>
              <div><span className="text-neutral-500">Active:</span> {call.agentProfile ? String(call.agentProfile.isActive) : '—'}</div>
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-neutral-200 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-medium">Activity history</h2>
              <p className="mt-1 text-sm text-neutral-600">
                Read-only timeline from existing call and review timestamps.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <HistoryItem label="Started" value={formatDateTime(call.startedAt)} />
            <HistoryItem label="Ended" value={formatDateTime(call.endedAt)} />
            <HistoryItem label="Duration" value={formatDuration(call.durationSeconds)} />
            <HistoryItem label="Reviewed" value={formatDateTime(call.reviewedAt)} />
            <HistoryItem label="Contacted" value={formatDateTime(call.contactedAt)} />
            <HistoryItem label="Archived" value={formatDateTime(call.archivedAt)} />
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-200 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-medium">Operator review</h2>
              <p className="mt-1 text-sm text-neutral-600">
                Correct extracted fields, add notes, and mark the review state.
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
            <span className="font-medium text-black">Shortcuts</span>{' '}
            <span className="mr-3">Cmd/Ctrl+S Save</span>
            <span className="mr-3">Cmd/Ctrl+Enter Save and review next</span>
            <span className="mr-3">Alt+R Reviewed</span>
            <span className="mr-3">Alt+N Needs review</span>
            <span className="mr-3">Alt+U Unreviewed</span>
            <span>/ Focus notes</span>
          </div>

          <form id={reviewFormId} action={saveReview} className="mt-4 space-y-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
              <div className="space-y-4">
                <section className="rounded-2xl border border-neutral-200 p-4">
                  <h3 className="text-sm font-medium text-black">Lead details</h3>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="text-sm">
                      <div className="mb-2 font-medium">Lead name</div>
                      <input
                        name="leadName"
                        defaultValue={call.leadName ?? ''}
                        className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                      />
                    </label>

                    <label className="text-sm">
                      <div className="mb-2 font-medium">Lead phone</div>
                      <input
                        name="leadPhone"
                        defaultValue={call.leadPhone ?? ''}
                        className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                      />
                    </label>

                    <label className="text-sm md:col-span-2">
                      <div className="mb-2 font-medium">Lead intent</div>
                      <input
                        name="leadIntent"
                        defaultValue={call.leadIntent ?? ''}
                        className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                      />
                    </label>

                    <label className="text-sm md:col-span-2">
                      <div className="mb-2 font-medium">Service address</div>
                      <input
                        name="serviceAddress"
                        defaultValue={call.serviceAddress ?? ''}
                        className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                      />
                    </label>
                  </div>
                </section>

                <section className="rounded-2xl border border-neutral-200 p-4">
                  <h3 className="text-sm font-medium text-black">Review summary</h3>
                  <div className="mt-4 space-y-4">
                    <label className="text-sm block">
                      <div className="mb-2 font-medium">Summary</div>
                      <textarea
                        name="summary"
                        defaultValue={call.summary ?? ''}
                        rows={5}
                        className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                      />
                    </label>

                    <label className="text-sm block">
                      <div className="mb-2 font-medium">Operator notes</div>
                      <textarea
                        id={notesFieldId}
                        name="operatorNotes"
                        defaultValue={call.operatorNotes ?? ''}
                        rows={8}
                        className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                      />
                    </label>
                  </div>
                </section>
              </div>

              <div className="space-y-4">
                <section className="rounded-2xl border border-neutral-200 p-4">
                  <h3 className="text-sm font-medium text-black">Review controls</h3>
                  <div className="mt-4 space-y-4">
                    <label className="text-sm block">
                      <div className="mb-2 font-medium">Urgency</div>
                      <select
                        name="urgency"
                        defaultValue={call.urgency ?? ''}
                        className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                      >
                        <option value="">Unspecified</option>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="emergency">Emergency</option>
                      </select>
                    </label>

                    <label className="text-sm block">
                      <div className="mb-2 font-medium">Review status</div>
                      <select
                        id={reviewStatusFieldId}
                        name="reviewStatus"
                        defaultValue={call.reviewStatus}
                        className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                      >
                        <option value="UNREVIEWED">Unreviewed</option>
                        <option value="NEEDS_REVIEW">Needs review</option>
                        <option value="REVIEWED">Reviewed</option>
                      </select>
                    </label>
                  </div>
                </section>

                <div className="lg:sticky lg:top-4">
                  <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                    <h3 className="text-sm font-medium text-black">Actions</h3>
                    <p className="mt-1 text-sm text-neutral-600">
                      Keep moving through review without losing your place.
                    </p>
                    <div className="mt-4 flex flex-col gap-2">
                      <button
                        id={saveButtonId}
                        className="rounded-xl border border-black bg-black px-4 py-2 text-sm text-white"
                      >
                        Save review changes
                      </button>
                      <button
                        id={saveNextButtonId}
                        formAction={saveAndReviewNext}
                        className="rounded-xl border border-neutral-300 px-4 py-2 text-sm"
                      >
                        Save and review next
                      </button>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-neutral-200 p-4">
          <h2 className="font-medium">Summary</h2>
          <p className="mt-3 text-sm whitespace-pre-wrap">{call.summary ?? '—'}</p>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="font-medium">Caller transcript</h2>
            <p className="mt-3 text-sm whitespace-pre-wrap">{call.callerTranscript ?? '—'}</p>
          </section>

          <section className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="font-medium">Assistant transcript</h2>
            <p className="mt-3 text-sm whitespace-pre-wrap">{call.assistantTranscript ?? '—'}</p>
          </section>
        </div>

        <section className="rounded-2xl border border-neutral-200 p-4">
          <h2 className="font-medium">Event timeline</h2>
          <div className="mt-3 space-y-2 text-sm">
            {call.events.map((event) => (
              <div key={`${event.sequence}-${event.type}`} className="flex items-start gap-3">
                <div className="w-10 text-neutral-500">{event.sequence}</div>
                <div className="min-w-0 flex-1">
                  <div>{event.type}</div>
                  <div className="text-neutral-500">
                    {new Date(event.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
