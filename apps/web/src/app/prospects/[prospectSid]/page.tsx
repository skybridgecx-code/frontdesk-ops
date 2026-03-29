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
  OperatorDetailPageShell
} from '@/components/operator/detail-shell';
import { getApiBaseUrl, getInternalApiHeaders } from '@/lib/api';
import {
  buildFilterHref,
  buildDetailReviewNextRequestHref,
  buildProspectDetailHref,
  buildQueueNoticeHref,
  buildSaveAndNextHref,
  normalizeReturnTo
} from '../workflow-urls';
import { buildProspectSavePayload, type ProspectSavePayload } from '../form-payload';

export const dynamic = 'force-dynamic';

type ProspectAttempt = {
  channel: string;
  outcome: string;
  note: string | null;
  attemptedAt: string;
  createdAt: string;
};

type ProspectDetail = {
  prospectSid: string;
  companyName: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  city: string | null;
  state: string | null;
  sourceLabel: string | null;
  sourceWebsiteUrl: string | null;
  sourceMapsUrl: string | null;
  sourceLinkedinUrl: string | null;
  sourceCategory: string | null;
  sourceRoleTitle: string | null;
  serviceInterest: string | null;
  notes: string | null;
  status: string;
  priority: string | null;
  nextActionAt: string | null;
  lastAttemptAt: string | null;
  respondedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  attempts: ProspectAttempt[];
  actionGuide: {
    primaryAction: string;
    reason: string;
    attentionLevel: 'high' | 'normal' | 'low';
    missingInfo: string[];
    readyForOutreach: boolean;
    needsReplyHandling: boolean;
    needsQualificationReview: boolean;
  };
};

type ProspectScope = {
  tenantId: string;
  businessId: string;
};

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

function buildScopedProspectPath(prospectSid: string, scope: ProspectScope) {
  const params = new URLSearchParams();
  params.set('tenantId', scope.tenantId);
  params.set('businessId', scope.businessId);
  return `/v1/prospects/${prospectSid}?${params.toString()}`;
}

async function getBootstrap() {
  const res = await fetch(`${getApiBaseUrl()}/v1/bootstrap`, {
    cache: 'no-store',
    headers: getInternalApiHeaders()
  });

  if (!res.ok) {
    throw new Error(`Failed to load bootstrap: ${res.status}`);
  }

  return (await res.json()) as BootstrapResponse;
}

async function getProspect(prospectSid: string, scope: ProspectScope) {
  const res = await fetch(`${getApiBaseUrl()}${buildScopedProspectPath(prospectSid, scope)}`, {
    cache: 'no-store',
    headers: getInternalApiHeaders()
  });

  if (!res.ok) {
    throw new Error(`Failed to load prospect: ${res.status}`);
  }

  return (await res.json()) as { ok: true; prospect: ProspectDetail };
}

async function saveProspectMutation(prospectSid: string, scope: ProspectScope, payload: ProspectSavePayload) {
  return fetch(`${getApiBaseUrl()}${buildScopedProspectPath(prospectSid, scope)}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      ...getInternalApiHeaders()
    },
    body: JSON.stringify(payload)
  });
}

function badgeClass(value: string | null | undefined) {
  switch (value) {
    case 'READY':
      return 'bg-emerald-100 text-emerald-900';
    case 'NEW':
      return 'bg-neutral-100 text-neutral-700';
    case 'ATTEMPTED':
      return 'bg-amber-100 text-amber-900';
    case 'RESPONDED':
    case 'QUALIFIED':
      return 'bg-blue-100 text-blue-900';
    case 'DISQUALIFIED':
      return 'bg-rose-100 text-rose-900';
    case 'ARCHIVED':
      return 'bg-neutral-200 text-neutral-800';
    case 'HIGH':
      return 'bg-red-100 text-red-900';
    case 'MEDIUM':
      return 'bg-yellow-100 text-yellow-900';
    case 'LOW':
      return 'bg-green-100 text-green-900';
    default:
      return 'bg-neutral-100 text-neutral-700';
  }
}

function formatSourceLabel(sourceLabel: string | null) {
  if (!sourceLabel) {
    return '—';
  }

  if (sourceLabel === 'public_demo_request') {
    return 'Demo request';
  }

  return sourceLabel.replaceAll('_', ' ');
}

function sourceBadgeClass(sourceLabel: string | null) {
  if (sourceLabel === 'public_demo_request') {
    return 'bg-violet-100 text-violet-900';
  }

  return 'bg-neutral-100 text-neutral-700';
}

function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : '—';
}

function formatLocation(city: string | null, state: string | null) {
  const parts = [city, state].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : '—';
}

function formatAttemptLabel(attempt: ProspectAttempt) {
  return `${attempt.channel.toLowerCase()} / ${attempt.outcome.toLowerCase().replaceAll('_', ' ')}`;
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

function SourceLink({
  label,
  href
}: {
  label: string;
  href: string | null;
}) {
  return (
    <div>
      <span className="text-neutral-500">{label}:</span>{' '}
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-blue-700 underline underline-offset-2"
        >
          Open
        </a>
      ) : (
        '—'
      )}
    </div>
  );
}

function actionGuideToneClass(value: 'high' | 'normal' | 'low') {
  switch (value) {
    case 'high':
      return 'border-red-200 bg-red-50 text-red-900';
    case 'low':
      return 'border-neutral-200 bg-neutral-50 text-neutral-700';
    default:
      return 'border-blue-200 bg-blue-50 text-blue-900';
  }
}

export default async function ProspectDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ prospectSid: string }>;
  searchParams: Promise<{ tenantId?: string; businessId?: string; returnTo?: string; notice?: string }>;
}) {
  const { prospectSid } = await params;
  const resolvedSearchParams = await searchParams;
  const bootstrap = await getBootstrap();
  const bootstrapTenant = bootstrap.tenant;
  const canonicalTenantId = bootstrapTenant?.id ?? null;
  const activeBusiness =
    bootstrapTenant?.businesses.find((business) => business.id === resolvedSearchParams.businessId) ??
    bootstrapTenant?.businesses[0] ??
    null;
  const canonicalBusinessId = activeBusiness?.id ?? null;

  if (!canonicalTenantId || !canonicalBusinessId) {
    throw new Error('No active tenant/business scope is configured for prospects.');
  }

  const scope = {
    tenantId: canonicalTenantId,
    businessId: canonicalBusinessId
  };
  const fallbackReturnTo = buildFilterHref({
    tenantId: canonicalTenantId,
    businessId: canonicalBusinessId,
    status: 'READY'
  });
  const returnTo = normalizeReturnTo(resolvedSearchParams.returnTo, fallbackReturnTo);

  if (
    resolvedSearchParams.tenantId !== canonicalTenantId ||
    resolvedSearchParams.businessId !== canonicalBusinessId
  ) {
    redirect(buildProspectDetailHref(prospectSid, returnTo));
  }

  const data = await getProspect(prospectSid, scope);
  const prospect = data.prospect;
  const detailHref = buildProspectDetailHref(prospectSid, returnTo);
  const notice = getWorkItemDetailNoticeMessage({
    notice: resolvedSearchParams.notice,
    itemSingular: 'prospect',
    itemPlural: 'prospects',
    customMessages: {
      'attempt-logged': 'Activity logged.',
      archived: 'Prospect archived.'
    }
  });
  const returnContextSummary = buildQueueContextSummary({
    currentHref: returnTo,
    fallbackLabel: 'Ready work queue',
    formatters: {
      status: (value) =>
        value ? value.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (m) => m.toUpperCase()) : null,
      priority: (value) =>
        value ? `${value.toLowerCase().replace(/^\w/, (m) => m.toUpperCase())} priority` : null
    }
  });

  async function saveProspect(formData: FormData) {
    'use server';

    const payload = buildProspectSavePayload(formData);
    const res = await saveProspectMutation(prospectSid, scope, payload);

    if (!res.ok) {
      throw new Error(`Failed to save prospect: ${res.status}`);
    }

    revalidatePath('/prospects');
    revalidatePath(`/prospects/${prospectSid}`);
    redirect(buildDetailNoticeHref(detailHref, 'saved'));
  }

  async function saveAndReviewNext(formData: FormData) {
    'use server';

    const payload = buildProspectSavePayload(formData);
    const res = await saveProspectMutation(prospectSid, scope, payload);

    if (!res.ok) {
      throw new Error(`Failed to save prospect: ${res.status}`);
    }

    revalidatePath('/prospects');
    revalidatePath(`/prospects/${prospectSid}`);

    const nextRes = await fetch(
      `${getApiBaseUrl()}${buildDetailReviewNextRequestHref(returnTo, prospectSid)}`,
      {
        cache: 'no-store',
        headers: getInternalApiHeaders()
      }
    );

    if (!nextRes.ok) {
      throw new Error(`Failed to load review-next prospect: ${nextRes.status}`);
    }

    const nextData = (await nextRes.json()) as { ok: true; prospectSid: string | null };

    redirect(
      resolveReviewNextDetailHref({
        currentItemId: prospectSid,
        nextItemId: nextData.prospectSid,
        returnTo,
        noReviewNotice: 'no-review-prospects',
        buildQueueNoticeHref,
        buildSaveAndNextHref
      })
    );
  }

  async function logAttempt(formData: FormData) {
    'use server';

    const payload = {
      channel: String(formData.get('channel') ?? ''),
      outcome: String(formData.get('outcome') ?? ''),
      note: String(formData.get('note') ?? '').trim() || null
    };

    const attemptParams = new URLSearchParams();
    attemptParams.set('tenantId', scope.tenantId);
    attemptParams.set('businessId', scope.businessId);

    const res = await fetch(`${getApiBaseUrl()}/v1/prospects/${prospectSid}/log-attempt?${attemptParams.toString()}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...getInternalApiHeaders()
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`Failed to log outreach attempt: ${res.status}`);
    }

    revalidatePath('/prospects');
    revalidatePath(`/prospects/${prospectSid}`);
    redirect(buildDetailNoticeHref(detailHref, 'attempt-logged'));
  }

  async function archiveProspect() {
    'use server';

    const archiveParams = new URLSearchParams();
    archiveParams.set('tenantId', scope.tenantId);
    archiveParams.set('businessId', scope.businessId);

    const res = await fetch(`${getApiBaseUrl()}/v1/prospects/${prospectSid}/archive?${archiveParams.toString()}`, {
      method: 'POST',
      headers: getInternalApiHeaders()
    });

    if (!res.ok) {
      throw new Error(`Failed to archive prospect: ${res.status}`);
    }

    revalidatePath('/prospects');
    revalidatePath(`/prospects/${prospectSid}`);
    redirect(buildDetailNoticeHref(detailHref, 'archived'));
  }

  return (
    <OperatorDetailPageShell notice={notice}>
        <OperatorDetailHeader
          returnTo={returnTo}
          returnContextSummary={returnContextSummary}
          title={prospect.companyName}
          badges={
            <>
              <span className="rounded-full border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700">
                {prospect.prospectSid}
              </span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass(prospect.status)}`}>
                {prospect.status.replaceAll('_', ' ')}
              </span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass(prospect.priority)}`}>
                {prospect.priority ?? 'NO PRIORITY'}
              </span>
              {prospect.sourceLabel ? (
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${sourceBadgeClass(prospect.sourceLabel)}`}>
                  {formatSourceLabel(prospect.sourceLabel)}
                </span>
              ) : null}
            </>
          }
          metadata={
            <>
              <span>Location {formatLocation(prospect.city, prospect.state)}</span>
              <span>Source {formatSourceLabel(prospect.sourceLabel)}</span>
              <span>Created {formatDateTime(prospect.createdAt)}</span>
            </>
          }
          actions={
            <form action={archiveProspect}>
              <button className="rounded-xl border border-neutral-300 px-4 py-2 text-sm">
                Archive
              </button>
            </form>
          }
        />

        <section className="rounded-2xl border border-neutral-200 p-4">
          <h2 className="font-medium">Opportunity snapshot</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Best available read-only summary of the prospect and why they are in the outreach queue.
          </p>
          <p className="mt-3 text-sm whitespace-pre-wrap">
            {prospect.serviceInterest ?? prospect.notes ?? 'No service-interest summary recorded yet.'}
          </p>
        </section>

        <OperatorActionGuideCard
          toneClassName={actionGuideToneClass(prospect.actionGuide.attentionLevel)}
          emphasis={prospect.actionGuide.attentionLevel}
          chips={
            <>
              {prospect.actionGuide.readyForOutreach ? (
                <span className="rounded-full border border-current/20 px-2.5 py-1 text-xs font-medium">
                  Ready for outreach
                </span>
              ) : null}
              {prospect.actionGuide.needsReplyHandling ? (
                <span className="rounded-full border border-current/20 px-2.5 py-1 text-xs font-medium">
                  Handle reply
                </span>
              ) : null}
              {prospect.actionGuide.needsQualificationReview ? (
                <span className="rounded-full border border-current/20 px-2.5 py-1 text-xs font-medium">
                  Qualification review
                </span>
              ) : null}
            </>
          }
          primaryAction={prospect.actionGuide.primaryAction}
          reason={prospect.actionGuide.reason}
          missingInfo={prospect.actionGuide.missingInfo}
        />

        <div className="grid gap-4 md:grid-cols-3">
          <section className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="font-medium">Contact facts</h2>
            <div className="mt-3 space-y-2 text-sm">
              <div><span className="text-neutral-500">Company:</span> {prospect.companyName}</div>
              <div><span className="text-neutral-500">Contact:</span> {prospect.contactName ?? '—'}</div>
              <div><span className="text-neutral-500">Phone:</span> {prospect.contactPhone ?? '—'}</div>
              <div><span className="text-neutral-500">Email:</span> {prospect.contactEmail ?? '—'}</div>
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="font-medium">Queue facts</h2>
            <div className="mt-3 space-y-2 text-sm">
              <div><span className="text-neutral-500">Status:</span> {prospect.status.replaceAll('_', ' ')}</div>
              <div><span className="text-neutral-500">Priority:</span> {prospect.priority ?? '—'}</div>
              <div><span className="text-neutral-500">Next action:</span> {formatDateTime(prospect.nextActionAt)}</div>
              <div><span className="text-neutral-500">Last attempt:</span> {formatDateTime(prospect.lastAttemptAt)}</div>
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="font-medium">State facts</h2>
            <div className="mt-3 space-y-2 text-sm">
              <div><span className="text-neutral-500">Responded:</span> {formatDateTime(prospect.respondedAt)}</div>
              <div><span className="text-neutral-500">Archived:</span> {formatDateTime(prospect.archivedAt)}</div>
              <div><span className="text-neutral-500">Updated:</span> {formatDateTime(prospect.updatedAt)}</div>
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-neutral-200 p-4">
          <h2 className="font-medium">Source intelligence</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Imported source facts stay structured here so operator notes stay human-owned.
          </p>
          <div className="mt-3 grid gap-4 md:grid-cols-2 text-sm">
            <div className="space-y-2">
              <div><span className="text-neutral-500">Imported category:</span> {prospect.sourceCategory ?? '—'}</div>
              <div><span className="text-neutral-500">Imported role:</span> {prospect.sourceRoleTitle ?? '—'}</div>
            </div>
            <div className="space-y-2">
              <SourceLink label="Website" href={prospect.sourceWebsiteUrl} />
              <SourceLink label="Maps" href={prospect.sourceMapsUrl} />
              <SourceLink label="LinkedIn" href={prospect.sourceLinkedinUrl} />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-200 p-4">
          <h2 className="font-medium">Operator notes</h2>
          <p className="mt-3 text-sm whitespace-pre-wrap text-neutral-700">
            {prospect.notes ?? 'No operator notes recorded yet.'}
          </p>
        </section>

        <section className="rounded-2xl border border-neutral-200 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-medium">Operator update</h2>
              <p className="mt-1 text-sm text-neutral-600">
                Correct core fields and keep outbound state aligned with the existing backend workflow.
              </p>
            </div>
          </div>

          <form action={saveProspect} className="mt-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm">
                <div className="mb-2 font-medium">Company name</div>
                <input
                  name="companyName"
                  defaultValue={prospect.companyName}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                />
              </label>

              <label className="text-sm">
                <div className="mb-2 font-medium">Contact name</div>
                <input
                  name="contactName"
                  defaultValue={prospect.contactName ?? ''}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                />
              </label>

              <label className="text-sm">
                <div className="mb-2 font-medium">Contact phone</div>
                <input
                  name="contactPhone"
                  defaultValue={prospect.contactPhone ?? ''}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                />
              </label>

              <label className="text-sm">
                <div className="mb-2 font-medium">Contact email</div>
                <input
                  name="contactEmail"
                  defaultValue={prospect.contactEmail ?? ''}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                />
              </label>

              <label className="text-sm">
                <div className="mb-2 font-medium">City</div>
                <input
                  name="city"
                  defaultValue={prospect.city ?? ''}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                />
              </label>

              <label className="text-sm">
                <div className="mb-2 font-medium">State</div>
                <input
                  name="state"
                  defaultValue={prospect.state ?? ''}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                />
              </label>

              <label className="text-sm">
                <div className="mb-2 font-medium">Source</div>
                <input
                  name="sourceLabel"
                  defaultValue={prospect.sourceLabel ?? ''}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                />
              </label>

              <label className="text-sm">
                <div className="mb-2 font-medium">Next action</div>
                <input
                  type="datetime-local"
                  name="nextActionAt"
                  defaultValue={prospect.nextActionAt ? prospect.nextActionAt.slice(0, 16) : ''}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                />
              </label>

              <label className="text-sm">
                <div className="mb-2 font-medium">Status</div>
                <select
                  name="status"
                  defaultValue={prospect.status}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                >
                  <option value="NEW">New</option>
                  <option value="READY">Ready</option>
                  <option value="IN_PROGRESS">In progress</option>
                  <option value="ATTEMPTED">Attempted</option>
                  <option value="RESPONDED">Responded</option>
                  <option value="QUALIFIED">Qualified</option>
                  <option value="DISQUALIFIED">Disqualified</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </label>

              <label className="text-sm">
                <div className="mb-2 font-medium">Priority</div>
                <select
                  name="priority"
                  defaultValue={prospect.priority ?? ''}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                >
                  <option value="">No priority</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </label>

              <label className="text-sm md:col-span-2">
                <div className="mb-2 font-medium">Service interest</div>
                <textarea
                  name="serviceInterest"
                  defaultValue={prospect.serviceInterest ?? ''}
                  rows={4}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                />
              </label>

              <label className="text-sm md:col-span-2">
                <div className="mb-2 font-medium">Notes</div>
                <textarea
                  name="notes"
                  defaultValue={prospect.notes ?? ''}
                  rows={6}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                />
              </label>
            </div>

            <div className="flex flex-col gap-2 md:flex-row md:justify-end">
              <button className="rounded-xl border border-black bg-black px-4 py-2 text-sm text-white">
                Save changes
              </button>
              <button
                formAction={saveAndReviewNext}
                className="rounded-xl border border-neutral-300 px-4 py-2 text-sm"
              >
                Save and review next
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-neutral-200 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-medium">Log activity</h2>
              <p className="mt-1 text-sm text-neutral-600">
                Record one attempt using the existing attempt outcome rules that drive prospect state.
              </p>
            </div>
          </div>

          <form action={logAttempt} className="mt-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm">
                <div className="mb-2 font-medium">Channel</div>
                <select name="channel" defaultValue="CALL" className="w-full rounded-xl border border-neutral-300 px-3 py-2">
                  <option value="CALL">Call</option>
                  <option value="EMAIL">Email</option>
                  <option value="SMS">SMS</option>
                </select>
              </label>

              <label className="text-sm">
                <div className="mb-2 font-medium">Outcome</div>
                <select
                  name="outcome"
                  defaultValue="LEFT_VOICEMAIL"
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                >
                  <option value="LEFT_VOICEMAIL">Left voicemail</option>
                  <option value="NO_ANSWER">No answer</option>
                  <option value="SENT_EMAIL">Sent email</option>
                  <option value="REPLIED">Replied</option>
                  <option value="BAD_FIT">Bad fit</option>
                  <option value="DO_NOT_CONTACT">Do not contact</option>
                </select>
              </label>

              <label className="text-sm md:col-span-2">
                <div className="mb-2 font-medium">Attempt note</div>
                <textarea
                  name="note"
                  rows={4}
                  placeholder="What happened on this outreach attempt?"
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                />
              </label>
            </div>

            <div className="flex justify-end">
              <button className="rounded-xl border border-black bg-black px-4 py-2 text-sm text-white">
                Log attempt
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-neutral-200 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-medium">Attempt timeline</h2>
              <p className="mt-1 text-sm text-neutral-600">
                Read-only history of recent outreach attempts in newest-first order.
              </p>
            </div>
          </div>

          {prospect.attempts.length > 0 ? (
            <div className="mt-4 space-y-3">
              {prospect.attempts.map((attempt) => (
                <div key={`${attempt.attemptedAt}-${attempt.channel}-${attempt.outcome}`} className="rounded-xl border border-neutral-200 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium text-black">{formatAttemptLabel(attempt)}</span>
                    <span className="text-neutral-500">{formatDateTime(attempt.attemptedAt)}</span>
                  </div>
                  <div className="mt-2 text-sm text-neutral-700">
                    {attempt.note ?? 'No attempt note recorded.'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 text-sm text-neutral-600">No outreach attempts recorded yet.</div>
          )}
        </section>

        <section className="rounded-2xl border border-neutral-200 p-4">
          <h2 className="font-medium">Activity history</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <HistoryItem label="Created" value={formatDateTime(prospect.createdAt)} />
            <HistoryItem label="Updated" value={formatDateTime(prospect.updatedAt)} />
            <HistoryItem label="Next action" value={formatDateTime(prospect.nextActionAt)} />
            <HistoryItem label="Last attempt" value={formatDateTime(prospect.lastAttemptAt)} />
            <HistoryItem label="Responded" value={formatDateTime(prospect.respondedAt)} />
            <HistoryItem label="Archived" value={formatDateTime(prospect.archivedAt)} />
          </div>
        </section>
    </OperatorDetailPageShell>
  );
}
