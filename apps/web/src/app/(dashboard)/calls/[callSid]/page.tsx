import type { Metadata } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getApiBaseUrl, getInternalApiHeaders } from '@/lib/api';
import { Breadcrumb } from '../../components/breadcrumb';
import { Card } from '../../components/card';
import { StatusBadge } from '../../components/status-badge';
import { DetailReviewShortcuts } from './detail-review-shortcuts';
import { RecordingPlayer } from '../../components/recording-player';

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
  recordingUrl: string | null;
  recordingSid: string | null;
  recordingDuration: number | null;
  recordingStatus: string | null;
  textBackSent: boolean;
  textBackSentAt: string | null;
  routeKind: string | null;
  phoneNumber: {
    e164: string;
    label: string | null;
    routingMode: string;
  };
};

export async function generateMetadata({
  params
}: {
  params: Promise<{ callSid: string }>;
}): Promise<Metadata> {
  const { callSid } = await params;

  return {
    title: `Call ${callSid} | SkybridgeCX`
  };
}

async function getCall(callSid: string) {
  const response = await fetch(`${getApiBaseUrl()}/v1/calls/${callSid}`, {
    cache: 'no-store',
    headers: await getInternalApiHeaders()
  });

  if (!response.ok) {
    throw new Error(`Failed to load call: ${response.status}`);
  }

  return (await response.json()) as { ok: true; call: CallDetail };
}

function formatDateTime(value: string | null) {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function formatDuration(seconds: number | null) {
  if (seconds === null) {
    return '—';
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${String(remainder).padStart(2, '0')}s`;
}

function getNoticeMessage(notice: string | undefined) {
  switch (notice) {
    case 'contacted':
      return 'Call marked contacted.';
    case 'archived':
      return 'Call archived.';
    case 'extracted':
      return 'Extraction rerun queued.';
    case 'saved':
      return 'Review changes saved.';
    case 'saved-next':
      return 'Review changes saved. Moved to next call.';
    case 'no-review-calls':
      return 'Review changes saved. No more calls need review.';
    default:
      return null;
  }
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
      : '/calls';
  const data = await getCall(callSid);
  const call = data.call;
  const noticeMessage = getNoticeMessage(resolvedSearchParams.notice);

  const detailHref = `/calls/${callSid}?returnTo=${encodeURIComponent(returnTo)}`;
  const reviewFormId = 'call-review-form';
  const notesFieldId = 'operator-notes';
  const reviewStatusFieldId = 'review-status';
  const saveButtonId = 'save-review-button';
  const saveNextButtonId = 'save-review-next-button';

  async function markContacted() {
    'use server';

    await fetch(`${getApiBaseUrl()}/v1/calls/${callSid}/mark-contacted`, {
      method: 'POST',
      headers: await getInternalApiHeaders()
    });

    revalidatePath('/calls');
    revalidatePath(`/calls/${callSid}`);
    redirect(`${detailHref}&notice=contacted`);
  }

  async function archiveCall() {
    'use server';

    await fetch(`${getApiBaseUrl()}/v1/calls/${callSid}/archive`, {
      method: 'POST',
      headers: await getInternalApiHeaders()
    });

    revalidatePath('/calls');
    revalidatePath(`/calls/${callSid}`);
    redirect(`${detailHref}&notice=archived`);
  }

  async function rerunExtraction() {
    'use server';

    await fetch(`${getApiBaseUrl()}/v1/calls/${callSid}/extract`, {
      method: 'POST',
      headers: await getInternalApiHeaders()
    });

    revalidatePath('/calls');
    revalidatePath(`/calls/${callSid}`);
    redirect(`${detailHref}&notice=extracted`);
  }

  async function saveReview(formData: FormData) {
    'use server';

    const payload = {
      leadName: String(formData.get('leadName') ?? '').trim() || null,
      leadPhone: String(formData.get('leadPhone') ?? '').trim() || null,
      leadIntent: String(formData.get('leadIntent') ?? '').trim() || null,
      urgency: String(formData.get('urgency') ?? '').trim() || null,
      serviceAddress: String(formData.get('serviceAddress') ?? '').trim() || null,
      summary: String(formData.get('summary') ?? '').trim() || null,
      operatorNotes: String(formData.get('operatorNotes') ?? '').trim() || null,
      reviewStatus: String(formData.get('reviewStatus') ?? '').trim()
    };

    const response = await fetch(`${getApiBaseUrl()}/v1/calls/${callSid}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        ...(await getInternalApiHeaders())
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Failed to save call review: ${response.status}`);
    }

    revalidatePath('/calls');
    revalidatePath(`/calls/${callSid}`);
    redirect(`${detailHref}&notice=saved`);
  }

  async function saveAndReviewNext(formData: FormData) {
    'use server';

    const payload = {
      leadName: String(formData.get('leadName') ?? '').trim() || null,
      leadPhone: String(formData.get('leadPhone') ?? '').trim() || null,
      leadIntent: String(formData.get('leadIntent') ?? '').trim() || null,
      urgency: String(formData.get('urgency') ?? '').trim() || null,
      serviceAddress: String(formData.get('serviceAddress') ?? '').trim() || null,
      summary: String(formData.get('summary') ?? '').trim() || null,
      operatorNotes: String(formData.get('operatorNotes') ?? '').trim() || null,
      reviewStatus: String(formData.get('reviewStatus') ?? '').trim()
    };

    const response = await fetch(`${getApiBaseUrl()}/v1/calls/${callSid}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        ...(await getInternalApiHeaders())
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Failed to save call review: ${response.status}`);
    }

    const nextResponse = await fetch(`${getApiBaseUrl()}/v1/calls/review-next`, {
      cache: 'no-store',
      headers: await getInternalApiHeaders()
    });

    if (!nextResponse.ok) {
      throw new Error(`Failed to load next review call: ${nextResponse.status}`);
    }

    const nextData = (await nextResponse.json()) as { ok: true; callSid: string | null };

    revalidatePath('/calls');
    revalidatePath(`/calls/${callSid}`);

    if (!nextData.callSid) {
      redirect(`${detailHref}&notice=no-review-calls`);
    }

    redirect(`/calls/${nextData.callSid}?returnTo=${encodeURIComponent(returnTo)}&notice=saved-next`);
  }

  return (
    <div className="space-y-6">
      <DetailReviewShortcuts
        formId={reviewFormId}
        notesFieldId={notesFieldId}
        reviewStatusFieldId={reviewStatusFieldId}
        saveButtonId={saveButtonId}
        saveNextButtonId={saveNextButtonId}
      />

      <Breadcrumb
        items={[
          { label: 'Calls', href: returnTo },
          { label: `Call from ${call.leadName ?? call.fromE164 ?? 'Unknown caller'}` }
        ]}
      />

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <a href={returnTo} className="inline-flex min-h-11 items-center text-sm font-medium text-gray-500 transition hover:text-indigo-600">
              ← Back to calls list
            </a>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
              {call.leadName ?? call.fromE164 ?? call.twilioCallSid}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge value={call.urgency ?? 'unknown'} type="urgency" fallback="Unknown" />
              <StatusBadge value={call.triageStatus} type="triage" />
              <StatusBadge value={call.reviewStatus} type="review" />
            </div>
          </div>
          <div className="max-w-full break-all text-sm text-gray-500">Call SID: {call.twilioCallSid}</div>
        </div>
      </section>

      {noticeMessage ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {noticeMessage}
        </div>
      ) : null}

      <form id={reviewFormId} action={saveReview} className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <div className="space-y-6">
          <Card title="Extracted lead info" subtitle="Verify and correct AI extracted fields before disposition.">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-gray-600">
                <span className="font-medium text-gray-700">Name</span>
                <input
                  name="leadName"
                  defaultValue={call.leadName ?? ''}
                  className="min-h-11 w-full rounded-md border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                />
              </label>
              <label className="space-y-2 text-sm text-gray-600">
                <span className="font-medium text-gray-700">Phone</span>
                <input
                  name="leadPhone"
                  defaultValue={call.leadPhone ?? ''}
                  className="min-h-11 w-full rounded-md border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                />
              </label>
              <label className="space-y-2 text-sm text-gray-600 md:col-span-2">
                <span className="font-medium text-gray-700">Intent</span>
                <input
                  name="leadIntent"
                  defaultValue={call.leadIntent ?? ''}
                  className="min-h-11 w-full rounded-md border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                />
              </label>
              <label className="space-y-2 text-sm text-gray-600 md:col-span-2">
                <span className="font-medium text-gray-700">Address</span>
                <input
                  name="serviceAddress"
                  defaultValue={call.serviceAddress ?? ''}
                  className="min-h-11 w-full rounded-md border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                />
              </label>
              <label className="space-y-2 text-sm text-gray-600 md:col-span-2">
                <span className="font-medium text-gray-700">Summary</span>
                <textarea
                  name="summary"
                  rows={4}
                  defaultValue={call.summary ?? ''}
                  className="min-h-11 w-full rounded-md border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                />
              </label>
            </div>
          </Card>

          <Card title="Transcript" subtitle="Conversation transcript for context during review.">
            <div className="grid gap-3 text-sm">
              <div className="max-h-64 overflow-auto rounded-md border border-gray-200 bg-gray-50 p-3 text-gray-700">
                <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500 sm:text-xs">Caller</p>
                <p className="whitespace-pre-wrap">{call.callerTranscript ?? 'No caller transcript available.'}</p>
              </div>
              <div className="max-h-64 overflow-auto rounded-md border border-gray-200 bg-gray-50 p-3 text-gray-700">
                <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500 sm:text-xs">SkybridgeCX Assistant</p>
                <p className="whitespace-pre-wrap">{call.assistantTranscript ?? 'No assistant transcript available.'}</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Call metadata">
            <dl className="space-y-3 text-sm">
              <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <dt className="text-gray-500">Duration</dt>
                <dd className="font-medium text-gray-900">{formatDuration(call.durationSeconds)}</dd>
              </div>
              <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <dt className="text-gray-500">Start time</dt>
                <dd className="text-right text-gray-900">{formatDateTime(call.startedAt)}</dd>
              </div>
              <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <dt className="text-gray-500">End time</dt>
                <dd className="text-right text-gray-900">{formatDateTime(call.endedAt)}</dd>
              </div>
              <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <dt className="text-gray-500">Route kind</dt>
                <dd className="text-right text-gray-900">{call.routeKind ?? '—'}</dd>
              </div>
              <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <dt className="text-gray-500">Missed-call text-back</dt>
                <dd className="text-right text-gray-900">
                  {call.textBackSent ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        Text-back sent
                      </span>
                      <span className="text-gray-600">{formatDateTime(call.textBackSentAt)}</span>
                    </span>
                  ) : (
                    'Not sent'
                  )}
                </dd>
              </div>
              <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <dt className="text-gray-500">Inbound number</dt>
                <dd className="text-right text-gray-900">{call.phoneNumber.e164}</dd>
              </div>
              <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <dt className="text-gray-500">From</dt>
                <dd className="text-right text-gray-900">{call.fromE164 ?? '—'}</dd>
              </div>
              <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <dt className="text-gray-500">To</dt>
                <dd className="text-right text-gray-900">{call.toE164 ?? '—'}</dd>
              </div>
              <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <dt className="text-gray-500">Twilio SID</dt>
                <dd className="break-all text-right text-sm text-gray-700 sm:text-xs">{call.twilioCallSid}</dd>
              </div>
            </dl>
          </Card>

          <RecordingPlayer
            recordingUrl={call.recordingUrl}
            recordingDuration={call.recordingDuration}
            recordingStatus={call.recordingStatus}
          />

          <Card title="Review actions" subtitle="Update status, save quickly, and continue queue review.">
            <div className="space-y-4">
              <label className="block space-y-2 text-sm text-gray-600">
                <span className="font-medium text-gray-700">Urgency</span>
                <select
                  name="urgency"
                  defaultValue={call.urgency ?? ''}
                  className="min-h-11 w-full rounded-md border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="">Unknown</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="emergency">Emergency</option>
                </select>
              </label>

              <label className="block space-y-2 text-sm text-gray-600">
                <span className="font-medium text-gray-700">Review status</span>
                <select
                  id={reviewStatusFieldId}
                  name="reviewStatus"
                  defaultValue={call.reviewStatus}
                  className="min-h-11 w-full rounded-md border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="UNREVIEWED">Unreviewed</option>
                  <option value="NEEDS_REVIEW">Needs review</option>
                  <option value="REVIEWED">Reviewed</option>
                </select>
              </label>

              <label className="block space-y-2 text-sm text-gray-600">
                <span className="font-medium text-gray-700">Operator notes</span>
                <textarea
                  id={notesFieldId}
                  name="operatorNotes"
                  rows={6}
                  defaultValue={call.operatorNotes ?? ''}
                  className="min-h-11 w-full rounded-md border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                />
              </label>

              <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                Shortcuts: Cmd/Ctrl+S save, Cmd/Ctrl+Enter save + next, Alt+R reviewed, Alt+N needs review, Alt+U unreviewed, / focus notes.
              </div>

              <div className="grid gap-2">
                <button
                  id={saveButtonId}
                  className="min-h-11 rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500"
                >
                  Save review changes
                </button>
                <button
                  id={saveNextButtonId}
                  formAction={saveAndReviewNext}
                  className="min-h-11 rounded-md border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-indigo-50"
                >
                  Save and review next
                </button>
              </div>

              <div className="grid gap-2">
                <form action={rerunExtraction}>
                  <button className="min-h-11 w-full rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-indigo-50">
                    Rerun extraction
                  </button>
                </form>
                <form action={markContacted}>
                  <button className="min-h-11 w-full rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-indigo-50">
                    Mark contacted
                  </button>
                </form>
                <form action={archiveCall}>
                  <button className="min-h-11 w-full rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-indigo-50">
                    Archive call
                  </button>
                </form>
              </div>
            </div>
          </Card>
        </div>
      </form>
    </div>
  );
}
