import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getApiBaseUrl, getInternalApiHeaders } from '@/lib/api';
import {
  buildProspectDetailHref,
  buildQueueContinuationHref,
  buildProspectsRequestUrl,
  findNextQueueProspectSid,
  getQueueStatusFromReturnTo,
  PROSPECT_QUEUE_FETCH_LIMIT,
  prospectQueueStatuses
} from '../queue-flow';

export const dynamic = 'force-dynamic';

type BootstrapResponse = {
  ok: true;
  tenant: {
    id: string;
    businesses: Array<{
      id: string;
      name: string;
    }>;
  } | null;
};

type ProspectDetail = {
  prospectSid: string;
  companyName: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  city: string | null;
  state: string | null;
  sourceLabel: string | null;
  status: string;
  priority: string | null;
  notes: string | null;
  nextActionAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ProspectDetailResponse = {
  ok: true;
  prospect: ProspectDetail;
};

type ProspectAttempt = {
  id: string;
  channel: string;
  outcome: string;
  note: string | null;
  attemptedAt: string;
  createdAt: string;
};

type ProspectAttemptsResponse = {
  ok: true;
  attempts: ProspectAttempt[];
};

type ProspectQueueResponse = {
  ok: true;
  prospects: Array<{
    prospectSid: string;
  }>;
};

const prospectStatuses = [
  'NEW',
  'READY',
  'IN_PROGRESS',
  'ATTEMPTED',
  'RESPONDED',
  'QUALIFIED',
  'DISQUALIFIED',
  'ARCHIVED'
] as const;

const prospectPriorities = ['HIGH', 'MEDIUM', 'LOW'] as const;
const prospectAttemptChannels = ['CALL', 'EMAIL', 'SMS'] as const;
const prospectAttemptOutcomes = [
  'NO_ANSWER',
  'LEFT_VOICEMAIL',
  'SENT_EMAIL',
  'REPLIED',
  'BAD_FIT',
  'DO_NOT_CONTACT'
] as const;
function formatDateTime(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(new Date(value))
    : '—';
}

function formatDateTimeLocalInput(value: string | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const pad = (input: number) => String(input).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function formatDateTimeLocalNow() {
  const now = new Date();
  const pad = (input: number) => String(input).padStart(2, '0');

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(
    now.getHours()
  )}:${pad(now.getMinutes())}`;
}

function buildRelativeDate(hoursFromNow: number) {
  const next = new Date();
  next.setHours(next.getHours() + hoursFromNow);
  return next;
}

function formatLabel(value: string | null | undefined) {
  if (!value) return '—';
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function shouldMarkAttemptedStatus(value: string) {
  return value === 'NEW' || value === 'READY' || value === 'IN_PROGRESS' || value === 'ATTEMPTED';
}

async function getBootstrap() {
  const res = await fetch(`${getApiBaseUrl()}/v1/bootstrap`, {
    cache: 'no-store',
    headers: getInternalApiHeaders()
  });

  if (!res.ok) {
    return null;
  }

  return (await res.json()) as BootstrapResponse;
}

async function getProspect(businessId: string, prospectSid: string) {
  const res = await fetch(`${getApiBaseUrl()}/v1/businesses/${businessId}/prospects/${prospectSid}`, {
    cache: 'no-store',
    headers: getInternalApiHeaders()
  });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    throw new Error(`Failed to load prospect: ${res.status}`);
  }

  return (await res.json()) as ProspectDetailResponse;
}

async function getAttempts(businessId: string, prospectSid: string) {
  const res = await fetch(`${getApiBaseUrl()}/v1/businesses/${businessId}/prospects/${prospectSid}/attempts`, {
    cache: 'no-store',
    headers: getInternalApiHeaders()
  });

  if (!res.ok) {
    throw new Error(`Failed to load prospect attempts: ${res.status}`);
  }

  return (await res.json()) as ProspectAttemptsResponse;
}

async function getProspectQueue(businessId: string, status?: string | null) {
  const url = buildProspectsRequestUrl({
    apiBaseUrl: getApiBaseUrl(),
    businessId,
    status: status ? (status as (typeof prospectQueueStatuses)[number]) : null,
    limit: PROSPECT_QUEUE_FETCH_LIMIT
  });

  const res = await fetch(url, {
    cache: 'no-store',
    headers: getInternalApiHeaders()
  });

  if (!res.ok) {
    throw new Error(`Failed to load prospect queue: ${res.status}`);
  }

  return (await res.json()) as ProspectQueueResponse;
}

async function resolveQueueContext(
  businessId: string,
  prospectSid: string,
  queueReturnTo: string | null
) {
  if (!queueReturnTo) {
    return null;
  }

  const status = getQueueStatusFromReturnTo(queueReturnTo);

  try {
    const queueResponse = await getProspectQueue(businessId, status);
    const nextProspectSid = findNextQueueProspectSid(queueResponse.prospects, prospectSid);

    return {
      nextProspectSid,
      nextHref: nextProspectSid
        ? buildProspectDetailHref({
            prospectSid: nextProspectSid,
            returnTo: queueReturnTo
          })
        : null
    };
  } catch {
    return null;
  }
}

export default async function ProspectDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ prospectSid: string }>;
  searchParams: Promise<{ notice?: string; returnTo?: string }>;
}) {
  const { prospectSid } = await params;
  const resolvedSearchParams = await searchParams;
  const bootstrap = await getBootstrap();
  const activeBusiness = bootstrap?.tenant?.businesses[0] ?? null;
  const queueReturnTo =
    resolvedSearchParams.returnTo && resolvedSearchParams.returnTo.startsWith('/prospects')
      ? resolvedSearchParams.returnTo
      : null;
  const returnTo = queueReturnTo ?? '/prospects';
  const noticeMessage =
    resolvedSearchParams.notice === 'saved'
      ? 'Workflow updated.'
      : resolvedSearchParams.notice === 'saved-next'
        ? 'Workflow updated. Moved to next prospect.'
        : resolvedSearchParams.notice === 'attempt-saved'
          ? 'Attempt logged.'
          : resolvedSearchParams.notice === 'attempt-saved-next'
            ? 'Attempt logged. Moved to next prospect.'
            : resolvedSearchParams.notice === 'error'
              ? 'Could not save workflow changes.'
              : resolvedSearchParams.notice === 'attempt-error'
                ? 'Could not save attempt.'
                : resolvedSearchParams.notice === 'shortcut-saved'
                  ? 'Disposition shortcut applied.'
                  : resolvedSearchParams.notice === 'shortcut-saved-next'
                    ? 'Disposition shortcut applied. Moved to next prospect.'
                    : resolvedSearchParams.notice === 'shortcut-error'
                      ? 'Could not apply disposition shortcut.'
                : null;

  if (!activeBusiness) {
    return (
      <main className="min-h-screen bg-[#f7f6f2] px-6 py-10 text-[#111827]">
        <div className="mx-auto max-w-3xl rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="text-xs uppercase tracking-[0.24em] text-black/50">Prospect detail</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">No active business configured</h1>
          <p className="mt-2 text-sm text-black/60">
            Prospect detail cannot load until an active business is available.
          </p>
          <Link
            href={returnTo}
            className="mt-6 inline-flex rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black shadow-sm"
          >
            Back to queue
          </Link>
        </div>
      </main>
    );
  }

  const detailResponse = await getProspect(activeBusiness.id, prospectSid);

  if (!detailResponse) {
    return (
      <main className="min-h-screen bg-[#f7f6f2] px-6 py-10 text-[#111827]">
        <div className="mx-auto max-w-3xl rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="text-xs uppercase tracking-[0.24em] text-black/50">Prospect detail</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Prospect not found</h1>
          <p className="mt-2 text-sm text-black/60">
            We could not find that prospect for the active business.
          </p>
          <Link
            href={returnTo}
            className="mt-6 inline-flex rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black shadow-sm"
          >
            Back to queue
          </Link>
        </div>
      </main>
    );
  }

  const attemptsResponse = await getAttempts(activeBusiness.id, prospectSid);
  const queueContext = await resolveQueueContext(activeBusiness.id, prospectSid, queueReturnTo);
  const prospect = detailResponse.prospect;
  const attempts = attemptsResponse.attempts;
  const title = prospect.contactName || prospect.companyName || prospect.prospectSid;
  const metadataLine = [prospect.prospectSid, activeBusiness.name].filter(Boolean).join(' • ');
  const detailHref = buildProspectDetailHref({
    prospectSid,
    returnTo
  });
  const nextHref = queueContext?.nextHref ?? null;
  const attemptedAtDefaultValue = formatDateTimeLocalNow();

  async function saveWorkflow(formData: FormData, advanceToNext: boolean) {
    'use server';

    const bootstrap = await getBootstrap();
    const currentBusiness = bootstrap?.tenant?.businesses[0] ?? null;

    if (!currentBusiness) {
      redirect(`${detailHref}&notice=error`);
    }

    const status = String(formData.get('status') ?? '').trim();
    const priority = String(formData.get('priority') ?? '').trim();
    const notes = String(formData.get('notes') ?? '').trim();
    const nextActionAtValue = String(formData.get('nextActionAt') ?? '').trim();

    if (!status) {
      redirect(`${detailHref}&notice=error`);
    }

    const nextActionAt = nextActionAtValue ? new Date(nextActionAtValue) : null;

    if (nextActionAt && Number.isNaN(nextActionAt.getTime())) {
      redirect(`${detailHref}&notice=error`);
    }

    let response: Response;

    try {
      response = await fetch(
        `${getApiBaseUrl()}/v1/businesses/${currentBusiness.id}/prospects/${prospectSid}`,
        {
          method: 'PATCH',
          cache: 'no-store',
          headers: {
            ...getInternalApiHeaders(),
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            status,
            priority: priority ? priority : null,
            notes: notes ? notes : null,
            nextActionAt: nextActionAt ? nextActionAt.toISOString() : null
          })
        }
      );
    } catch {
      redirect(`${detailHref}&notice=error`);
    }

    if (!response.ok) {
      redirect(`${detailHref}&notice=error`);
    }

    revalidatePath(`/prospects/${prospectSid}`);

    if (advanceToNext && queueReturnTo) {
      const nextQueueContext = await resolveQueueContext(currentBusiness.id, prospectSid, queueReturnTo);

      if (nextQueueContext?.nextHref) {
        redirect(buildQueueContinuationHref({
          detailHref,
          nextProspectSid: nextQueueContext.nextProspectSid,
          returnTo,
          nextNotice: 'saved-next',
          fallbackNotice: 'saved'
        }));
      }
    }

    redirect(`${detailHref}&notice=saved`);
  }

  async function updateWorkflow(formData: FormData) {
    return saveWorkflow(formData, false);
  }

  async function updateWorkflowAndNext(formData: FormData) {
    return saveWorkflow(formData, true);
  }

  async function logAttemptMutation(formData: FormData, advanceToNext: boolean) {
    'use server';

    const bootstrap = await getBootstrap();
    const currentBusiness = bootstrap?.tenant?.businesses[0] ?? null;

    if (!currentBusiness) {
      redirect(`${detailHref}&notice=attempt-error`);
    }

    const channel = String(formData.get('channel') ?? '').trim();
    const outcome = String(formData.get('outcome') ?? '').trim();
    const note = String(formData.get('note') ?? '').trim();
    const attemptedAtValue = String(formData.get('attemptedAt') ?? '').trim();

    if (!channel || !outcome) {
      redirect(`${detailHref}&notice=attempt-error`);
    }

    const attemptedAt = attemptedAtValue ? new Date(attemptedAtValue) : new Date();

    if (Number.isNaN(attemptedAt.getTime())) {
      redirect(`${detailHref}&notice=attempt-error`);
    }

    let response: Response;

    try {
      response = await fetch(
        `${getApiBaseUrl()}/v1/businesses/${currentBusiness.id}/prospects/${prospectSid}/attempts`,
        {
          method: 'POST',
          cache: 'no-store',
          headers: {
            ...getInternalApiHeaders(),
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            channel,
            outcome,
            note: note ? note : null,
            attemptedAt: attemptedAt.toISOString()
          })
        }
      );
    } catch {
      redirect(`${detailHref}&notice=attempt-error`);
    }

    if (!response.ok) {
      redirect(`${detailHref}&notice=attempt-error`);
    }

    revalidatePath(`/prospects/${prospectSid}`);

    if (advanceToNext && queueReturnTo) {
      const nextQueueContext = await resolveQueueContext(currentBusiness.id, prospectSid, queueReturnTo);

      if (nextQueueContext?.nextHref) {
        redirect(buildQueueContinuationHref({
          detailHref,
          nextProspectSid: nextQueueContext.nextProspectSid,
          returnTo,
          nextNotice: 'attempt-saved-next',
          fallbackNotice: 'attempt-saved'
        }));
      }
    }

    redirect(`${detailHref}&notice=attempt-saved`);
  }

  async function logAttempt(formData: FormData) {
    return logAttemptMutation(formData, false);
  }

  async function logAttemptAndNext(formData: FormData) {
    return logAttemptMutation(formData, true);
  }

  async function applyShortcutMutation(
    options: {
      status: string;
      nextActionAt: Date | null;
      attempt?: {
        channel: (typeof prospectAttemptChannels)[number];
        outcome: (typeof prospectAttemptOutcomes)[number];
        note: string;
      };
    },
    advanceToNext: boolean
  ) {
    'use server';

    const bootstrap = await getBootstrap();
    const currentBusiness = bootstrap?.tenant?.businesses[0] ?? null;

    if (!currentBusiness) {
      redirect(`${detailHref}&notice=shortcut-error`);
    }

    if (options.attempt) {
      let attemptResponse: Response;

      try {
        attemptResponse = await fetch(
          `${getApiBaseUrl()}/v1/businesses/${currentBusiness.id}/prospects/${prospectSid}/attempts`,
          {
            method: 'POST',
            cache: 'no-store',
            headers: {
              ...getInternalApiHeaders(),
              'content-type': 'application/json'
            },
            body: JSON.stringify({
              channel: options.attempt.channel,
              outcome: options.attempt.outcome,
              note: options.attempt.note,
              attemptedAt: new Date().toISOString()
            })
          }
        );
      } catch {
        redirect(`${detailHref}&notice=shortcut-error`);
      }

      if (!attemptResponse.ok) {
        redirect(`${detailHref}&notice=shortcut-error`);
      }
    }

    let updateResponse: Response;

    try {
      updateResponse = await fetch(
        `${getApiBaseUrl()}/v1/businesses/${currentBusiness.id}/prospects/${prospectSid}`,
        {
          method: 'PATCH',
          cache: 'no-store',
          headers: {
            ...getInternalApiHeaders(),
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            status: options.status,
            nextActionAt: options.nextActionAt ? options.nextActionAt.toISOString() : null
          })
        }
      );
    } catch {
      redirect(`${detailHref}&notice=shortcut-error`);
    }

    if (!updateResponse.ok) {
      redirect(`${detailHref}&notice=shortcut-error`);
    }

    revalidatePath(`/prospects/${prospectSid}`);

    if (advanceToNext && queueReturnTo) {
      const nextQueueContext = await resolveQueueContext(currentBusiness.id, prospectSid, queueReturnTo);

      redirect(
        buildQueueContinuationHref({
          detailHref,
          nextProspectSid: nextQueueContext?.nextProspectSid ?? null,
          returnTo,
          nextNotice: 'shortcut-saved-next',
          fallbackNotice: 'shortcut-saved'
        })
      );
    }

    redirect(`${detailHref}&notice=shortcut-saved`);
  }

  async function noAnswerShortcut() {
    'use server';

    const shouldAttempt = shouldMarkAttemptedStatus(prospect.status);

    return applyShortcutMutation(
      {
        status: shouldAttempt ? 'ATTEMPTED' : prospect.status,
        nextActionAt: shouldAttempt ? buildRelativeDate(24) : null,
        attempt: {
          channel: 'CALL',
          outcome: 'NO_ANSWER',
          note: 'No answer. Follow-up scheduled.'
        }
      },
      false
    );
  }

  async function noAnswerShortcutAndNext() {
    'use server';

    const shouldAttempt = shouldMarkAttemptedStatus(prospect.status);

    return applyShortcutMutation(
      {
        status: shouldAttempt ? 'ATTEMPTED' : prospect.status,
        nextActionAt: shouldAttempt ? buildRelativeDate(24) : null,
        attempt: {
          channel: 'CALL',
          outcome: 'NO_ANSWER',
          note: 'No answer. Follow-up scheduled.'
        }
      },
      true
    );
  }

  async function voicemailShortcut() {
    'use server';

    const shouldAttempt = shouldMarkAttemptedStatus(prospect.status);

    return applyShortcutMutation(
      {
        status: shouldAttempt ? 'ATTEMPTED' : prospect.status,
        nextActionAt: shouldAttempt ? buildRelativeDate(48) : null,
        attempt: {
          channel: 'CALL',
          outcome: 'LEFT_VOICEMAIL',
          note: 'Left voicemail. Follow-up scheduled.'
        }
      },
      false
    );
  }

  async function voicemailShortcutAndNext() {
    'use server';

    const shouldAttempt = shouldMarkAttemptedStatus(prospect.status);

    return applyShortcutMutation(
      {
        status: shouldAttempt ? 'ATTEMPTED' : prospect.status,
        nextActionAt: shouldAttempt ? buildRelativeDate(48) : null,
        attempt: {
          channel: 'CALL',
          outcome: 'LEFT_VOICEMAIL',
          note: 'Left voicemail. Follow-up scheduled.'
        }
      },
      true
    );
  }

  async function updateStatusShortcut(nextStatus: string, advanceToNext: boolean) {
    'use server';

    return applyShortcutMutation(
      {
        status: nextStatus,
        nextActionAt: null
      },
      advanceToNext
    );
  }

  async function markResponded() {
    return updateStatusShortcut('RESPONDED', false);
  }

  async function markRespondedAndNext() {
    return updateStatusShortcut('RESPONDED', true);
  }

  async function markQualified() {
    return updateStatusShortcut('QUALIFIED', false);
  }

  async function markQualifiedAndNext() {
    return updateStatusShortcut('QUALIFIED', true);
  }

  async function markDisqualified() {
    return updateStatusShortcut('DISQUALIFIED', false);
  }

  async function markDisqualifiedAndNext() {
    return updateStatusShortcut('DISQUALIFIED', true);
  }

  async function archiveProspect() {
    return updateStatusShortcut('ARCHIVED', false);
  }

  async function archiveProspectAndNext() {
    return updateStatusShortcut('ARCHIVED', true);
  }

  return (
    <main className="min-h-screen bg-[#f7f6f2] px-6 py-10 text-[#111827]">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href={returnTo} className="text-sm font-medium text-[#6b7280] transition hover:text-[#111827]">
              ← Back to queue
            </Link>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">{title}</h1>
            <p className="mt-2 text-sm text-black/60">{metadataLine}</p>
          </div>

          {nextHref ? (
            <Link
              href={nextHref}
              className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black shadow-sm transition hover:border-black/20 hover:bg-black/[0.03]"
            >
              Next in queue
              <span className="ml-2" aria-hidden="true">
                →
              </span>
            </Link>
          ) : null}
        </div>

        {noticeMessage ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${
              resolvedSearchParams.notice === 'saved' ||
              resolvedSearchParams.notice === 'saved-next' ||
              resolvedSearchParams.notice === 'attempt-saved' ||
              resolvedSearchParams.notice === 'attempt-saved-next' ||
              resolvedSearchParams.notice === 'shortcut-saved' ||
              resolvedSearchParams.notice === 'shortcut-saved-next'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-red-200 bg-red-50 text-red-900'
            }`}
          >
            {noticeMessage}
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
            <div className="text-xs uppercase tracking-[0.24em] text-black/50">Prospect overview</div>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-[0.22em] text-black/40">Company</dt>
                <dd className="mt-1 text-sm text-black">{prospect.companyName || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.22em] text-black/40">Contact</dt>
                <dd className="mt-1 text-sm text-black">{prospect.contactName || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.22em] text-black/40">Phone</dt>
                <dd className="mt-1 text-sm text-black">{prospect.contactPhone || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.22em] text-black/40">Email</dt>
                <dd className="mt-1 text-sm text-black">{prospect.contactEmail || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.22em] text-black/40">City</dt>
                <dd className="mt-1 text-sm text-black">{prospect.city || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.22em] text-black/40">State</dt>
                <dd className="mt-1 text-sm text-black">{prospect.state || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.22em] text-black/40">Source</dt>
                <dd className="mt-1 text-sm text-black">{prospect.sourceLabel || '—'}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
            <div className="text-xs uppercase tracking-[0.24em] text-black/50">Workflow / status</div>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-[0.22em] text-black/40">Status</dt>
                <dd className="mt-1 text-sm text-black">{formatLabel(prospect.status)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.22em] text-black/40">Priority</dt>
                <dd className="mt-1 text-sm text-black">{formatLabel(prospect.priority)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.22em] text-black/40">Next action</dt>
                <dd className="mt-1 text-sm text-black">{formatDateTime(prospect.nextActionAt)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.22em] text-black/40">Created</dt>
                <dd className="mt-1 text-sm text-black">{formatDateTime(prospect.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.22em] text-black/40">Updated</dt>
                <dd className="mt-1 text-sm text-black">{formatDateTime(prospect.updatedAt)}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="text-xs uppercase tracking-[0.24em] text-black/50">Update workflow</div>
          <p className="mt-2 text-sm text-black/60">
            Update the prospect record directly, then return to the same detail view.
          </p>

          <form action={updateWorkflow} className="mt-5 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm">
                <div className="text-xs uppercase tracking-[0.22em] text-black/40">Status</div>
                <select
                  name="status"
                  defaultValue={prospect.status}
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-black shadow-sm outline-none ring-0 transition focus:border-black/20"
                >
                  {prospectStatuses.map((value) => (
                    <option key={value} value={value}>
                      {formatLabel(value)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm">
                <div className="text-xs uppercase tracking-[0.22em] text-black/40">Priority</div>
                <select
                  name="priority"
                  defaultValue={prospect.priority ?? ''}
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-black shadow-sm outline-none ring-0 transition focus:border-black/20"
                >
                  <option value="">No priority</option>
                  {prospectPriorities.map((value) => (
                    <option key={value} value={value}>
                      {formatLabel(value)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="space-y-2 text-sm">
              <div className="text-xs uppercase tracking-[0.22em] text-black/40">Notes</div>
              <textarea
                name="notes"
                defaultValue={prospect.notes ?? ''}
                rows={5}
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-sm text-black shadow-sm outline-none ring-0 transition focus:border-black/20"
                placeholder="Add context for the operator team."
              />
            </label>

            <label className="space-y-2 text-sm">
              <div className="text-xs uppercase tracking-[0.22em] text-black/40">Next action</div>
              <input
                name="nextActionAt"
                type="datetime-local"
                defaultValue={formatDateTimeLocalInput(prospect.nextActionAt)}
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-black shadow-sm outline-none ring-0 transition focus:border-black/20"
              />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <p className="text-sm text-black/60">Changes save to the backend and return here with a notice.</p>
              <div className="flex flex-wrap gap-3">
                <button className="rounded-full bg-[#111827] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#0b1120]">
                  Save workflow
                </button>
                <button
                  formAction={updateWorkflowAndNext}
                  className="rounded-full border border-black/10 bg-white px-5 py-2.5 text-sm font-medium text-black shadow-sm transition hover:border-black/20 hover:bg-black/[0.03]"
                >
                  Save and next
                </button>
              </div>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="text-xs uppercase tracking-[0.24em] text-black/50">Log attempt</div>
          <p className="mt-2 text-sm text-black/60">
            Record outreach activity so the next operator sees a clean history.
          </p>

          <form action={logAttempt} className="mt-5 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm">
                <div className="text-xs uppercase tracking-[0.22em] text-black/40">Channel</div>
                <select
                  name="channel"
                  defaultValue="CALL"
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-black shadow-sm outline-none ring-0 transition focus:border-black/20"
                >
                  {prospectAttemptChannels.map((value) => (
                    <option key={value} value={value}>
                      {formatLabel(value)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm">
                <div className="text-xs uppercase tracking-[0.22em] text-black/40">Outcome</div>
                <select
                  name="outcome"
                  defaultValue="LEFT_VOICEMAIL"
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-black shadow-sm outline-none ring-0 transition focus:border-black/20"
                >
                  {prospectAttemptOutcomes.map((value) => (
                    <option key={value} value={value}>
                      {formatLabel(value)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="space-y-2 text-sm">
              <div className="text-xs uppercase tracking-[0.22em] text-black/40">Note</div>
              <textarea
                name="note"
                rows={4}
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-sm text-black shadow-sm outline-none ring-0 transition focus:border-black/20"
                placeholder="Left voicemail and requested a callback after 3 pm."
              />
            </label>

            <label className="space-y-2 text-sm">
              <div className="text-xs uppercase tracking-[0.22em] text-black/40">Attempted at</div>
              <input
                name="attemptedAt"
                type="datetime-local"
                defaultValue={formatDateTimeLocalNow()}
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-black shadow-sm outline-none ring-0 transition focus:border-black/20"
              />
            </label>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
              <button className="rounded-full bg-[#111827] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#0b1120]">
                Save attempt
              </button>
              <button
                formAction={logAttemptAndNext}
                className="rounded-full border border-black/10 bg-white px-5 py-2.5 text-sm font-medium text-black shadow-sm transition hover:border-black/20 hover:bg-black/[0.03]"
              >
                Log and next
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="text-xs uppercase tracking-[0.24em] text-black/50">Disposition shortcuts</div>
          <p className="mt-2 text-sm text-black/60">
            Apply the most common outcomes directly when the call is already clear.
          </p>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-black/10 p-4">
              <div className="text-sm font-medium text-black">No answer</div>
              <p className="mt-1 text-sm text-black/60">Logs a call attempt and schedules follow-up.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <form action={noAnswerShortcut}>
                  <button className="rounded-full bg-[#111827] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#0b1120]">
                    No answer
                  </button>
                </form>
                {nextHref ? (
                  <form action={noAnswerShortcutAndNext}>
                    <button className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black shadow-sm transition hover:border-black/20 hover:bg-black/[0.03]">
                      No answer and next
                    </button>
                  </form>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-black/10 p-4">
              <div className="text-sm font-medium text-black">Left voicemail</div>
              <p className="mt-1 text-sm text-black/60">Logs the voicemail and schedules the next touch.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <form action={voicemailShortcut}>
                  <button className="rounded-full bg-[#111827] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#0b1120]">
                    Left voicemail
                  </button>
                </form>
                {nextHref ? (
                  <form action={voicemailShortcutAndNext}>
                    <button className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black shadow-sm transition hover:border-black/20 hover:bg-black/[0.03]">
                      Voicemail and next
                    </button>
                  </form>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-black/10 p-4">
              <div className="text-sm font-medium text-black">Responded</div>
              <p className="mt-1 text-sm text-black/60">Marks the prospect as replied and clears the queue signal.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <form action={markResponded}>
                  <button className="rounded-full bg-[#111827] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#0b1120]">
                    Responded
                  </button>
                </form>
                {nextHref ? (
                  <form action={markRespondedAndNext}>
                    <button className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black shadow-sm transition hover:border-black/20 hover:bg-black/[0.03]">
                      Responded and next
                    </button>
                  </form>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-black/10 p-4">
              <div className="text-sm font-medium text-black">Qualified</div>
              <p className="mt-1 text-sm text-black/60">Marks the prospect qualified and clears scheduling.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <form action={markQualified}>
                  <button className="rounded-full bg-[#111827] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#0b1120]">
                    Qualified
                  </button>
                </form>
                {nextHref ? (
                  <form action={markQualifiedAndNext}>
                    <button className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black shadow-sm transition hover:border-black/20 hover:bg-black/[0.03]">
                      Qualified and next
                    </button>
                  </form>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-black/10 p-4">
              <div className="text-sm font-medium text-black">Disqualified / archive</div>
              <p className="mt-1 text-sm text-black/60">Clears the queue and marks the record closed.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <form action={markDisqualified}>
                  <button className="rounded-full bg-[#111827] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#0b1120]">
                    Disqualified
                  </button>
                </form>
                <form action={archiveProspect}>
                  <button className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black shadow-sm transition hover:border-black/20 hover:bg-black/[0.03]">
                    Archive
                  </button>
                </form>
                {nextHref ? (
                  <>
                    <form action={markDisqualifiedAndNext}>
                      <button className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black shadow-sm transition hover:border-black/20 hover:bg-black/[0.03]">
                        Disqualified and next
                      </button>
                    </form>
                    <form action={archiveProspectAndNext}>
                      <button className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black shadow-sm transition hover:border-black/20 hover:bg-black/[0.03]">
                        Archive and next
                      </button>
                    </form>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="text-xs uppercase tracking-[0.24em] text-black/50">Notes</div>
          <div className="mt-4 text-sm leading-7 text-black/80">
            {prospect.notes ? prospect.notes : 'No notes recorded.'}
          </div>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white shadow-sm">
          <div className="border-b border-black/10 px-6 py-5">
            <div className="text-xs uppercase tracking-[0.24em] text-black/50">Attempt history</div>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">Latest attempts first</h2>
          </div>

          {attempts.length === 0 ? (
            <div className="px-6 py-8 text-sm text-black/60">No attempts recorded.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-black/[0.03] text-black/60">
                  <tr>
                    <th className="px-6 py-3 font-medium">Attempted</th>
                    <th className="px-6 py-3 font-medium">Channel</th>
                    <th className="px-6 py-3 font-medium">Outcome</th>
                    <th className="px-6 py-3 font-medium">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((attempt) => (
                    <tr key={attempt.id} className="border-t border-black/10 align-top">
                      <td className="px-6 py-4 text-black/70">{formatDateTime(attempt.attemptedAt)}</td>
                      <td className="px-6 py-4 text-black/70">{attempt.channel}</td>
                      <td className="px-6 py-4 text-black/70">{attempt.outcome}</td>
                      <td className="px-6 py-4 text-black/70">{attempt.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
