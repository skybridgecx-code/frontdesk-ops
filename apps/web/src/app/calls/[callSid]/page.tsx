import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  buildDetailNoticeHref,
  buildQueueContextSummary,
  getWorkItemDetailNoticeMessage,
  resolveReviewNextDetailHref
} from '@/app/operator-workflow';
import {
  OperatorActionGuideCard,
  OperatorDetailHeader,
  OperatorDetailPageShell,
  OperatorTimelineSection,
  type OperatorTimelineItem
} from '@/components/operator/detail-shell';
import { getApiBaseUrl, getInternalApiHeaders } from '@/lib/api';
import { CallReviewForm } from './call-review-form';
import {
  buildDetailReviewNextRequestHref,
  buildQueueNoticeHref,
  buildSaveAndNextHref,
  normalizeReturnTo
} from '../workflow-urls';

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
  answeredAt: string | null;
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
  routingDecision: {
    routingMode: string | null;
    isOpen: boolean | null;
    routeKind: string | null;
    agentProfileId: string | null;
    reason: string | null;
    message: string | null;
    phoneLineLabel: string | null;
    businessTimezone: string | null;
  } | null;
  events: Array<{
    type: string;
    sequence: number;
    createdAt: string;
  }>;
  timeline: OperatorTimelineItem[];
  actionGuide: {
    primaryAction: string;
    reason: string;
    urgencyLevel: 'emergency' | 'high' | 'normal';
    missingInfo: string[];
    readyToContact: boolean;
    needsTranscriptReview: boolean;
  };
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

function actionGuideToneClass(value: 'emergency' | 'high' | 'normal') {
  switch (value) {
    case 'emergency':
      return 'border-red-200 bg-red-50 text-red-900';
    case 'high':
      return 'border-orange-200 bg-orange-50 text-orange-900';
    default:
      return 'border-neutral-200 bg-neutral-50 text-neutral-900';
  }
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
      return null;
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
      return null;
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

function formatRoutingReason(value: string | null) {
  if (!value) {
    return '—';
  }

  return value.toLowerCase().replaceAll('_', ' ').replace(/^\w/, (match) => match.toUpperCase());
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
  const returnTo = normalizeReturnTo(resolvedSearchParams.returnTo);
  const notice = getWorkItemDetailNoticeMessage({
    notice: resolvedSearchParams.notice,
    itemSingular: 'call',
    itemPlural: 'calls',
    customMessages: {
      contacted: 'Call marked contacted.',
      archived: 'Call archived.',
      extracted: 'Extraction rerun queued.'
    }
  });
  const data = await getCall(callSid);
  const call = data.call;
  const detailHref = `/calls/${callSid}?returnTo=${encodeURIComponent(returnTo)}`;
  const reviewFormId = 'call-review-form';
  const notesFieldId = 'operator-notes';
  const reviewStatusFieldId = 'review-status';
  const saveButtonId = 'save-review-button';
  const saveNextButtonId = 'save-review-next-button';
  const returnContextSummary = buildQueueContextSummary({
    currentHref: returnTo,
    fallbackLabel: 'Open work queue',
    formatters: {
      triageStatus: formatTriageStatusLabel,
      reviewStatus: formatReviewStatusLabel,
      urgency: formatUrgencyLabel
    }
  });

  async function markContacted() {
    'use server';

    await fetch(`${getApiBaseUrl()}/v1/calls/${callSid}/mark-contacted`, {
      method: 'POST',
      headers: getInternalApiHeaders()
    });

    revalidatePath('/calls');
    revalidatePath(`/calls/${callSid}`);
    redirect(buildDetailNoticeHref(detailHref, 'contacted'));
  }

  async function archiveCall() {
    'use server';

    await fetch(`${getApiBaseUrl()}/v1/calls/${callSid}/archive`, {
      method: 'POST',
      headers: getInternalApiHeaders()
    });

    revalidatePath('/calls');
    revalidatePath(`/calls/${callSid}`);
    redirect(buildDetailNoticeHref(detailHref, 'archived'));
  }

  async function rerunExtraction() {
    'use server';

    await fetch(`${getApiBaseUrl()}/v1/calls/${callSid}/extract`, {
      method: 'POST',
      headers: getInternalApiHeaders()
    });

    revalidatePath('/calls');
    revalidatePath(`/calls/${callSid}`);
    redirect(buildDetailNoticeHref(detailHref, 'extracted'));
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
    redirect(buildDetailNoticeHref(detailHref, 'saved'));
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

    const nextRes = await fetch(`${getApiBaseUrl()}${buildDetailReviewNextRequestHref(returnTo, callSid)}`, {
      cache: 'no-store',
      headers: getInternalApiHeaders()
    });

    if (!nextRes.ok) {
      throw new Error(`Failed to load review-next call: ${nextRes.status}`);
    }

    const nextData = (await nextRes.json()) as { ok: true; callSid: string | null };

    redirect(
      resolveReviewNextDetailHref({
        currentItemId: callSid,
        nextItemId: nextData.callSid,
        returnTo,
        noReviewNotice: 'no-review-calls',
        buildQueueNoticeHref,
        buildSaveAndNextHref
      })
    );
  }

  return (
    <OperatorDetailPageShell notice={notice}>
        <OperatorDetailHeader
          returnTo={returnTo}
          returnContextSummary={returnContextSummary}
          title={call.twilioCallSid}
          badges={
            <>
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
            </>
          }
          metadata={
            <>
              <span>Started {formatDateTime(call.startedAt)}</span>
              <span>Answered {formatDateTime(call.answeredAt)}</span>
              <span>Ended {formatDateTime(call.endedAt)}</span>
              <span>Duration {formatDuration(call.durationSeconds)}</span>
            </>
          }
          actions={
            <>
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
            </>
          }
        />

        <section className="rounded-2xl border border-neutral-200 p-4">
          <h2 className="font-medium">Issue snapshot</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Best available summary of what happened and what the caller needs.
          </p>
          <p className="mt-3 text-sm whitespace-pre-wrap">
            {call.summary ?? call.leadIntent ?? 'No summary yet. Use the transcripts below to review the call.'}
          </p>
        </section>

        <OperatorActionGuideCard
          toneClassName={actionGuideToneClass(call.actionGuide.urgencyLevel)}
          emphasis={call.actionGuide.urgencyLevel}
          chips={
            <>
              {call.actionGuide.readyToContact ? (
                <span className="rounded-full border border-current/20 px-2.5 py-1 text-xs font-medium">
                  Ready to contact
                </span>
              ) : null}
              {call.actionGuide.needsTranscriptReview ? (
                <span className="rounded-full border border-current/20 px-2.5 py-1 text-xs font-medium">
                  Review transcript
                </span>
              ) : null}
            </>
          }
          primaryAction={call.actionGuide.primaryAction}
          reason={call.actionGuide.reason}
          missingInfo={call.actionGuide.missingInfo}
        />

        <OperatorTimelineSection
          title="Operator timeline"
          description="Operator-visible history for this call, newest first."
          items={call.timeline}
          emptyMessage="No operator-visible history recorded for this call yet."
        />

        <div className="grid gap-4 md:grid-cols-3">
          <section className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="font-medium">Lead facts</h2>
            <div className="mt-3 space-y-2 text-sm">
              <div><span className="text-neutral-500">Name:</span> {call.leadName ?? '—'}</div>
              <div><span className="text-neutral-500">Phone:</span> {call.leadPhone ?? '—'}</div>
              <div><span className="text-neutral-500">Intent:</span> {call.leadIntent ?? '—'}</div>
              <div><span className="text-neutral-500">Urgency:</span> {call.urgency ?? '—'}</div>
              <div><span className="text-neutral-500">Address:</span> {call.serviceAddress ?? '—'}</div>
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="font-medium">Call facts</h2>
            <div className="mt-3 space-y-2 text-sm">
              <div><span className="text-neutral-500">From:</span> {call.fromE164 ?? '—'}</div>
              <div><span className="text-neutral-500">To:</span> {call.toE164 ?? '—'}</div>
              <div><span className="text-neutral-500">Number:</span> {call.phoneNumber.label ?? '—'} · {call.phoneNumber.e164}</div>
              <div><span className="text-neutral-500">Routing:</span> {call.phoneNumber.routingMode}</div>
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="font-medium">Agent facts</h2>
            <div className="mt-3 space-y-2 text-sm">
              <div><span className="text-neutral-500">Name:</span> {call.agentProfile?.name ?? '—'}</div>
              <div><span className="text-neutral-500">Voice:</span> {call.agentProfile?.voiceName ?? '—'}</div>
              <div><span className="text-neutral-500">Active:</span> {call.agentProfile ? String(call.agentProfile.isActive) : '—'}</div>
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-neutral-200 p-4">
          <h2 className="font-medium">Routing decision</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Inspect how the inbound routing policy treated this call and why.
          </p>
          {call.routingDecision ? (
            <div className="mt-3 grid gap-4 md:grid-cols-2 text-sm">
              <div className="space-y-2">
                <div><span className="text-neutral-500">Route:</span> {call.routingDecision.routeKind ?? '—'}</div>
                <div><span className="text-neutral-500">Business treated as:</span> {call.routingDecision.isOpen == null ? '—' : call.routingDecision.isOpen ? 'Open' : 'Closed'}</div>
                <div><span className="text-neutral-500">Routing mode:</span> {call.routingDecision.routingMode ?? '—'}</div>
                <div><span className="text-neutral-500">Policy reason:</span> {formatRoutingReason(call.routingDecision.reason)}</div>
              </div>
              <div className="space-y-2">
                <div><span className="text-neutral-500">Line:</span> {call.routingDecision.phoneLineLabel ?? call.phoneNumber.label ?? '—'}</div>
                <div><span className="text-neutral-500">Selected agent:</span> {call.agentProfile?.name ?? call.routingDecision.agentProfileId ?? '—'}</div>
                <div><span className="text-neutral-500">Timezone:</span> {call.routingDecision.businessTimezone ?? '—'}</div>
                <div><span className="text-neutral-500">Route message:</span> {call.routingDecision.message ?? '—'}</div>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-neutral-700">
              No routing decision was captured for this call. Older or seeded rows may predate routing-decision events.
            </p>
          )}
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="font-medium">Caller transcript</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Caller words first. Use this when the summary is missing or thin.
            </p>
            <p className="mt-3 text-sm whitespace-pre-wrap">
              {call.callerTranscript ?? 'No caller transcript available.'}
            </p>
          </section>

          <section className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="font-medium">Assistant transcript</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Assistant responses and routing language captured during the call.
            </p>
            <p className="mt-3 text-sm whitespace-pre-wrap">
              {call.assistantTranscript ?? 'No assistant transcript available.'}
            </p>
          </section>
        </div>

        <section className="rounded-2xl border border-neutral-200 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-medium">Operator update</h2>
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

          <CallReviewForm
            callSid={callSid}
            notice={resolvedSearchParams.notice}
            initialValues={{
              reviewStatus: call.reviewStatus,
              urgency: call.urgency ?? '',
              leadName: call.leadName ?? '',
              leadPhone: call.leadPhone ?? '',
              leadIntent: call.leadIntent ?? '',
              serviceAddress: call.serviceAddress ?? '',
              summary: call.summary ?? '',
              operatorNotes: call.operatorNotes ?? ''
            }}
            triageStatusLabel={formatTriageStatusLabel(call.triageStatus) ?? '—'}
            followUpStatusDetail={
              call.contactedAt
                ? `Marked contacted ${formatDateTime(call.contactedAt)}`
                : call.archivedAt
                  ? `Archived ${formatDateTime(call.archivedAt)}`
                  : 'No follow-up action recorded yet.'
            }
            reviewFormId={reviewFormId}
            notesFieldId={notesFieldId}
            reviewStatusFieldId={reviewStatusFieldId}
            saveButtonId={saveButtonId}
            saveNextButtonId={saveNextButtonId}
            saveAction={saveReview}
            saveAndReviewNextAction={saveAndReviewNext}
          />
        </section>

        <section className="rounded-2xl border border-neutral-200 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-medium">Activity history</h2>
              <p className="mt-1 text-sm text-neutral-600">
                Read-only timeline from existing call and review timestamps.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <HistoryItem label="Started" value={formatDateTime(call.startedAt)} />
            <HistoryItem label="Answered" value={formatDateTime(call.answeredAt)} />
            <HistoryItem label="Ended" value={formatDateTime(call.endedAt)} />
            <HistoryItem label="Duration" value={formatDuration(call.durationSeconds)} />
            <HistoryItem label="Reviewed" value={formatDateTime(call.reviewedAt)} />
            <HistoryItem label="Contacted" value={formatDateTime(call.contactedAt)} />
            <HistoryItem label="Archived" value={formatDateTime(call.archivedAt)} />
          </div>
        </section>

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
    </OperatorDetailPageShell>
  );
}
