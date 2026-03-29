import { redirect } from 'next/navigation';
import { buildQueueContextSummary } from '@/app/operator-workflow';
import { getProspectQueueActionHint } from '@/app/queue-action-hints';
import { getApiBaseUrl, getInternalApiHeaders } from '@/lib/api';
import {
  buildFilterHref,
  buildProspectDetailHref,
  buildQueueNoticeHref,
  buildQueueReviewNextRequestHref,
  normalizeLimit,
  normalizePage
} from './workflow-urls';
import { buildApolloImportPayload, buildGooglePlacesImportPayload } from './import-payload';

export const dynamic = 'force-dynamic';

type QueueLastActivityPreview = {
  lastActivityAt: string;
  lastActivityTitle: string;
  lastActivityDetail: string | null;
};

type ProspectAttempt = {
  channel: string;
  outcome: string;
  note: string | null;
  attemptedAt: string;
};

type ProspectRow = {
  prospectSid: string;
  companyName: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  city: string | null;
  state: string | null;
  sourceLabel: string | null;
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
  lastActivityPreview: QueueLastActivityPreview;
};

function formatQueueLastActivityPreview(preview: QueueLastActivityPreview) {
  const time = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(preview.lastActivityAt));
  const detail = preview.lastActivityDetail?.trim();

  return {
    title: preview.lastActivityTitle,
    detailLine: detail ? `${detail} · ${time}` : time
  };
}

type ProspectsResponse = {
  ok: true;
  prospects: ProspectRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type ProspectsSummary = {
  ok: true;
  totalProspects: number;
  newProspects: number;
  readyProspects: number;
  inProgressProspects: number;
  attemptedProspects: number;
  respondedProspects: number;
  qualifiedProspects: number;
  disqualifiedProspects: number;
  archivedProspects: number;
  highPriorityProspects: number;
  mediumPriorityProspects: number;
  lowPriorityProspects: number;
};

type BootstrapResponse = {
  ok: true;
  tenant: {
    id: string;
    slug: string;
    name: string;
    businesses: Array<{
      id: string;
      slug: string;
      name: string;
      vertical: string;
      timezone: string;
    }>;
  } | null;
};

type ProspectsSearchParams = {
  tenantId?: string;
  businessId?: string;
  status?: string;
  priority?: string;
  q?: string;
  page?: string;
  limit?: string;
  notice?: string;
  error?: string;
};

async function getProspects(input: {
  tenantId: string;
  businessId: string;
  status?: string;
  priority?: string;
  q?: string;
  page?: string;
  limit?: string;
}) {
  const params = new URLSearchParams();
  params.set('tenantId', input.tenantId);
  params.set('businessId', input.businessId);
  params.set('limit', normalizeLimit(input.limit));
  params.set('page', normalizePage(input.page));

  if (input.status) params.set('status', input.status);
  if (input.priority) params.set('priority', input.priority);
  if (input.q?.trim()) params.set('q', input.q.trim());

  const res = await fetch(`${getApiBaseUrl()}/v1/prospects?${params.toString()}`, {
    cache: 'no-store',
    headers: getInternalApiHeaders()
  });

  if (!res.ok) {
    throw new Error(`Failed to load prospects: ${res.status}`);
  }

  return (await res.json()) as ProspectsResponse;
}

async function getProspectsSummary(input: { tenantId: string; businessId: string }) {
  const params = new URLSearchParams();
  params.set('tenantId', input.tenantId);
  params.set('businessId', input.businessId);

  const res = await fetch(`${getApiBaseUrl()}/v1/prospects/summary?${params.toString()}`, {
    cache: 'no-store',
    headers: getInternalApiHeaders()
  });

  if (!res.ok) {
    throw new Error(`Failed to load prospect summary: ${res.status}`);
  }

  return (await res.json()) as ProspectsSummary;
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

function FilterLink({
  href,
  label,
  active
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <a
      href={href}
      className={`rounded-xl border px-3 py-2 text-sm ${
        active ? 'border-black bg-black text-white' : 'border-neutral-300 text-black'
      }`}
    >
      {label}
    </a>
  );
}

function SummaryCard({
  label,
  value,
  href
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <a href={href} className="block rounded-2xl border border-neutral-200 p-4 hover:border-neutral-400">
      <div className="text-sm text-neutral-600">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
    </a>
  );
}

function formatDateTime(value: string | null) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}

function formatLocation(prospect: ProspectRow) {
  const parts = [prospect.city, prospect.state].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

function getProspectHeadline(prospect: ProspectRow) {
  if (prospect.serviceInterest?.trim()) {
    return prospect.serviceInterest.trim();
  }

  if (prospect.notes?.trim()) {
    return prospect.notes.trim();
  }

  return 'Prospect record is present but still thin.';
}

function formatSourceLabel(sourceLabel: string | null) {
  if (!sourceLabel) {
    return null;
  }

  if (sourceLabel === 'public_demo_request') {
    return 'Demo request';
  }

  return sourceLabel.replaceAll('_', ' ');
}

function sourceBadgeClass(sourceLabel: string | null) {
  if (sourceLabel === 'public_demo_request') {
    return 'border-violet-300 bg-violet-100 text-violet-900';
  }

  return 'border-neutral-300 bg-white text-neutral-600';
}

function queueHintClass(tone: 'high' | 'normal' | 'low') {
  switch (tone) {
    case 'high':
      return 'border-red-300 bg-red-100 text-red-900';
    case 'low':
      return 'border-neutral-300 bg-neutral-100 text-neutral-600';
    default:
      return 'border-blue-300 bg-blue-100 text-blue-900';
  }
}

function getNoticeMessage(notice: string | undefined, detail: string | undefined) {
  switch (notice) {
    case 'no-review-prospects':
      return 'No prospects currently need attention.';
    case 'google-imported':
      return 'Google Places prospects imported into the outbound queue.';
    case 'apollo-imported':
      return 'Apollo prospects imported into the outbound queue.';
    case 'provider-import-failed':
      return detail
        ? `Prospect import failed: ${detail}`
        : 'Prospect import failed. Check the provider key, filters, or API error details in the server logs.';
    default:
      return null;
  }
}

export default async function ProspectsPage({
  searchParams
}: {
  searchParams: Promise<ProspectsSearchParams>;
}) {
  const resolved = await searchParams;
  const bootstrap = await getBootstrap();
  const bootstrapTenant = bootstrap.tenant;
  const canonicalTenantId = bootstrapTenant?.id ?? null;
  const activeBusiness =
    bootstrapTenant?.businesses.find((business) => business.id === resolved.businessId) ??
    bootstrapTenant?.businesses[0] ??
    null;
  const canonicalBusinessId = activeBusiness?.id ?? null;
  const status = resolved.status;
  const priority = resolved.priority;
  const q = resolved.q?.trim() ?? '';
  const page = normalizePage(resolved.page);
  const limit = normalizeLimit(resolved.limit);
  const noticeMessage = getNoticeMessage(resolved.notice, resolved.error?.trim());

  if (!canonicalTenantId || !canonicalBusinessId) {
    throw new Error('No active tenant/business scope is configured for prospects.');
  }

  const activeScope = {
    tenantId: canonicalTenantId,
    businessId: canonicalBusinessId
  };

  if (
    !status ||
    resolved.tenantId !== canonicalTenantId ||
    resolved.businessId !== canonicalBusinessId
  ) {
    redirect(
      buildFilterHref({
        tenantId: canonicalTenantId,
        businessId: canonicalBusinessId,
        status: 'READY',
        priority,
        q,
        page,
        limit
      })
    );
  }

  const [data, summary] = await Promise.all([
    getProspects({
      tenantId: canonicalTenantId,
      businessId: canonicalBusinessId,
      status,
      priority,
      q,
      page,
      limit
    }),
    getProspectsSummary({
      tenantId: canonicalTenantId,
      businessId: canonicalBusinessId
    })
  ]);
  const prospects = data.prospects.map((prospect) => ({
    ...prospect,
    queueHint: getProspectQueueActionHint({
      status: prospect.status as
        | 'NEW'
        | 'READY'
        | 'IN_PROGRESS'
        | 'ATTEMPTED'
        | 'RESPONDED'
        | 'QUALIFIED'
        | 'DISQUALIFIED'
        | 'ARCHIVED',
      priority: (prospect.priority as 'HIGH' | 'MEDIUM' | 'LOW' | null) ?? null,
      nextActionAt: prospect.nextActionAt,
      lastAttemptAt: prospect.lastAttemptAt,
      respondedAt: prospect.respondedAt,
      archivedAt: prospect.archivedAt,
      contactPhone: prospect.contactPhone,
      contactEmail: prospect.contactEmail,
      contactName: prospect.contactName,
      companyName: prospect.companyName,
      serviceInterest: prospect.serviceInterest,
      notes: prospect.notes,
      sourceLabel: prospect.sourceLabel,
      sourceCategory: null,
      sourceRoleTitle: null,
      attempts: prospect.attempts.map((attempt) => ({
        ...attempt,
        createdAt: attempt.attemptedAt
      }))
    })
  }));

  const currentHref = buildFilterHref({
    tenantId: canonicalTenantId,
    businessId: canonicalBusinessId,
    status,
    priority,
    q,
    page,
    limit
  });
  const queueContextSummary = buildQueueContextSummary({
    currentHref,
    fallbackLabel: 'Ready work queue',
    formatters: {
      status: (value) => (value ? value.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (m) => m.toUpperCase()) : null),
      priority: (value) => (value ? `${value.toLowerCase().replace(/^\w/, (m) => m.toUpperCase())} priority` : null)
    }
  });

  const currentPage = data.page;
  const totalPages = data.totalPages;
  const previousHref =
    currentPage > 1
      ? buildFilterHref({
          tenantId: canonicalTenantId,
          businessId: canonicalBusinessId,
          status,
          priority,
          q,
          page: String(currentPage - 1),
          limit
        })
      : null;
  const nextHref =
    currentPage < totalPages
      ? buildFilterHref({
          tenantId: canonicalTenantId,
          businessId: canonicalBusinessId,
          status,
          priority,
          q,
          page: String(currentPage + 1),
          limit
        })
      : null;

  async function reviewNext() {
    'use server';

    const res = await fetch(`${getApiBaseUrl()}${buildQueueReviewNextRequestHref(currentHref)}`, {
      cache: 'no-store',
      headers: getInternalApiHeaders()
    });

    if (!res.ok) {
      throw new Error(`Failed to load review-next prospect: ${res.status}`);
    }

    const data = (await res.json()) as { ok: true; prospectSid: string | null };

    if (!data.prospectSid) {
      redirect(buildQueueNoticeHref(currentHref, 'no-review-prospects'));
    }

    redirect(buildProspectDetailHref(data.prospectSid, currentHref));
  }

  async function importGooglePlaces(formData: FormData) {
    'use server';

    if (!activeBusiness) {
      redirect(buildQueueNoticeHref(currentHref, 'provider-import-failed', { error: 'No active business available for import.' }));
    }

    let payload;

    try {
      payload = buildGooglePlacesImportPayload(formData);
    } catch (error) {
      redirect(
        buildQueueNoticeHref(currentHref, 'provider-import-failed', {
          error: error instanceof Error ? error.message : 'Invalid Google Places import input.'
        })
      );
    }

    const res = await fetch(
      `${getApiBaseUrl()}/v1/businesses/${activeBusiness.id}/prospects/import/google-places?tenantId=${encodeURIComponent(activeScope.tenantId)}`,
      {
      method: 'POST',
      cache: 'no-store',
      headers: {
        ...getInternalApiHeaders(),
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
      }
    );

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      redirect(
        buildQueueNoticeHref(currentHref, 'provider-import-failed', {
          error: body?.error ?? `Google Places import failed with status ${res.status}.`
        })
      );
    }

    redirect(buildQueueNoticeHref(currentHref, 'google-imported'));
  }

  async function importApollo(formData: FormData) {
    'use server';

    if (!activeBusiness) {
      redirect(buildQueueNoticeHref(currentHref, 'provider-import-failed', { error: 'No active business available for import.' }));
    }

    let payload;

    try {
      payload = buildApolloImportPayload(formData);
    } catch (error) {
      redirect(
        buildQueueNoticeHref(currentHref, 'provider-import-failed', {
          error: error instanceof Error ? error.message : 'Invalid Apollo import input.'
        })
      );
    }

    const res = await fetch(
      `${getApiBaseUrl()}/v1/businesses/${activeBusiness.id}/prospects/import/apollo?tenantId=${encodeURIComponent(activeScope.tenantId)}`,
      {
      method: 'POST',
      cache: 'no-store',
      headers: {
        ...getInternalApiHeaders(),
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
      }
    );

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      redirect(
        buildQueueNoticeHref(currentHref, 'provider-import-failed', {
          error: body?.error ?? `Apollo import failed with status ${res.status}.`
        })
      );
    }

    redirect(buildQueueNoticeHref(currentHref, 'apollo-imported'));
  }

  return (
    <main className="min-h-screen bg-white p-6 text-black">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Outbound work</h1>
            <p className="mt-1 text-sm text-neutral-600">
              Prospect queue with clear status, next actions, and provider-aware follow-up context.
            </p>
          </div>

          <form action={reviewNext}>
            <button className="rounded-xl border border-black bg-black px-4 py-2 text-sm text-white">
              Review next
            </button>
          </form>
        </div>

        {noticeMessage ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
            {noticeMessage}
          </div>
        ) : null}

        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
          <span className="font-medium text-black">Queue context</span>{' '}
          <span>Opening a prospect keeps this view: {queueContextSummary}</span>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 text-sm text-neutral-700">
          <div className="font-medium text-black">Start here</div>
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            <div>1. Start with the first ready prospect, usually `PR_DEMO_101` after reset.</div>
            <div>2. Review contact details, source intelligence, and the latest activity.</div>
            <div>3. Save, log activity, or use `Review next` to keep follow-up moving.</div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <form action={importGooglePlaces} className="space-y-3 rounded-2xl border border-neutral-200 p-4">
            <div>
              <h2 className="text-base font-semibold tracking-tight">Import from Google Places</h2>
              <p className="mt-1 text-sm text-neutral-600">
                Search real local businesses into the outbound queue for{' '}
                <span className="font-medium text-black">{activeBusiness?.name ?? 'the active business'}</span>.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="font-medium">Search query</span>
                <input
                  name="textQuery"
                  placeholder="dentists in Reston VA"
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                  required
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Included type</span>
                <input
                  name="includedType"
                  placeholder="dentist"
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Result count</span>
                <input
                  name="pageSize"
                  type="number"
                  min="1"
                  max="20"
                  defaultValue="5"
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Service interest</span>
                <input
                  name="serviceInterest"
                  placeholder="Commercial HVAC"
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <button
              className="rounded-xl border border-black bg-black px-4 py-2 text-sm text-white disabled:border-neutral-300 disabled:bg-neutral-200 disabled:text-neutral-500"
              disabled={!activeBusiness}
            >
              Import Google leads
            </button>
          </form>

          <form action={importApollo} className="space-y-3 rounded-2xl border border-neutral-200 p-4">
            <div>
              <h2 className="text-base font-semibold tracking-tight">Import from Apollo</h2>
              <p className="mt-1 text-sm text-neutral-600">
                Pull people-search prospects into the same outbound queue without leaving the current workflow.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="font-medium">Keywords</span>
                <input
                  name="qKeywords"
                  placeholder="dentists"
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Titles</span>
                <input
                  name="personTitles"
                  placeholder="operations manager, office manager"
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Organization locations</span>
                <input
                  name="organizationLocations"
                  placeholder={'Virginia, US; Maryland, US'}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Result count</span>
                <input
                  name="perPage"
                  type="number"
                  min="1"
                  max="25"
                  defaultValue="10"
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-2 text-sm md:col-span-2">
                <span className="font-medium">Service interest</span>
                <input
                  name="serviceInterest"
                  placeholder="Commercial maintenance outreach"
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <button
              className="rounded-xl border border-black bg-black px-4 py-2 text-sm text-white disabled:border-neutral-300 disabled:bg-neutral-200 disabled:text-neutral-500"
              disabled={!activeBusiness}
            >
              Import Apollo leads
            </button>
          </form>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
          <span className="font-medium text-black">Queue signals:</span>
          <span className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700">
            Ready now
          </span>
          <span className="rounded-full border border-amber-300 bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">
            Attempted follow-up
          </span>
          <span className="rounded-full border border-blue-300 bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-900">
            Responded / qualified
          </span>
          <span className="rounded-full border border-red-300 bg-red-100 px-2.5 py-1 text-xs font-medium text-red-900">
            High priority
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard
            label="Ready"
            value={summary.readyProspects}
            href={buildFilterHref({ tenantId: canonicalTenantId, businessId: canonicalBusinessId, status: 'READY', limit })}
          />
          <SummaryCard
            label="New"
            value={summary.newProspects}
            href={buildFilterHref({ tenantId: canonicalTenantId, businessId: canonicalBusinessId, status: 'NEW', limit })}
          />
          <SummaryCard
            label="Attempted"
            value={summary.attemptedProspects}
            href={buildFilterHref({
              tenantId: canonicalTenantId,
              businessId: canonicalBusinessId,
              status: 'ATTEMPTED',
              limit
            })}
          />
          <SummaryCard
            label="Responded"
            value={summary.respondedProspects}
            href={buildFilterHref({
              tenantId: canonicalTenantId,
              businessId: canonicalBusinessId,
              status: 'RESPONDED',
              limit
            })}
          />
          <SummaryCard
            label="Qualified"
            value={summary.qualifiedProspects}
            href={buildFilterHref({
              tenantId: canonicalTenantId,
              businessId: canonicalBusinessId,
              status: 'QUALIFIED',
              limit
            })}
          />
          <SummaryCard
            label="Archived"
            value={summary.archivedProspects}
            href={buildFilterHref({
              tenantId: canonicalTenantId,
              businessId: canonicalBusinessId,
              status: 'ARCHIVED',
              limit
            })}
          />
          <SummaryCard
            label="High priority"
            value={summary.highPriorityProspects}
            href={buildFilterHref({
              tenantId: canonicalTenantId,
              businessId: canonicalBusinessId,
              status,
              priority: 'HIGH',
              limit
            })}
          />
          <SummaryCard
            label="Medium priority"
            value={summary.mediumPriorityProspects}
            href={buildFilterHref({
              tenantId: canonicalTenantId,
              businessId: canonicalBusinessId,
              status,
              priority: 'MEDIUM',
              limit
            })}
          />
          <SummaryCard
            label="Low priority"
            value={summary.lowPriorityProspects}
            href={buildFilterHref({
              tenantId: canonicalTenantId,
              businessId: canonicalBusinessId,
              status,
              priority: 'LOW',
              limit
            })}
          />
        </div>

        <div className="space-y-4 rounded-2xl border border-neutral-200 p-4">
          <form action="/prospects" className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1">
              <label htmlFor="q" className="mb-2 block text-sm font-medium">
                Search prospects
              </label>
              <input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="Search by company, contact, source, service interest, or Prospect SID"
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <input type="hidden" name="status" value={status} />
            <input type="hidden" name="tenantId" value={canonicalTenantId} />
            <input type="hidden" name="businessId" value={canonicalBusinessId} />
            {priority ? <input type="hidden" name="priority" value={priority} /> : null}
            <input type="hidden" name="limit" value={limit} />
            <button className="rounded-xl border border-black bg-black px-4 py-2 text-sm text-white">
              Search
            </button>
            <a
              href={buildFilterHref({
                tenantId: canonicalTenantId,
                businessId: canonicalBusinessId,
                status,
                priority,
                limit
              })}
              className="rounded-xl border border-neutral-300 px-4 py-2 text-sm"
            >
              Clear
            </a>
          </form>

          <div>
            <div className="mb-2 text-sm font-medium">Status</div>
            <div className="flex flex-wrap gap-2">
              <FilterLink
                href={buildFilterHref({ tenantId: canonicalTenantId, businessId: canonicalBusinessId, status: 'READY', priority, q, limit })}
                label="Ready"
                active={status === 'READY'}
              />
              <FilterLink
                href={buildFilterHref({ tenantId: canonicalTenantId, businessId: canonicalBusinessId, status: 'NEW', priority, q, limit })}
                label="New"
                active={status === 'NEW'}
              />
              <FilterLink
                href={buildFilterHref({
                  tenantId: canonicalTenantId,
                  businessId: canonicalBusinessId,
                  status: 'ATTEMPTED',
                  priority,
                  q,
                  limit
                })}
                label="Attempted"
                active={status === 'ATTEMPTED'}
              />
              <FilterLink
                href={buildFilterHref({
                  tenantId: canonicalTenantId,
                  businessId: canonicalBusinessId,
                  status: 'RESPONDED',
                  priority,
                  q,
                  limit
                })}
                label="Responded"
                active={status === 'RESPONDED'}
              />
              <FilterLink
                href={buildFilterHref({
                  tenantId: canonicalTenantId,
                  businessId: canonicalBusinessId,
                  status: 'QUALIFIED',
                  priority,
                  q,
                  limit
                })}
                label="Qualified"
                active={status === 'QUALIFIED'}
              />
              <FilterLink
                href={buildFilterHref({
                  tenantId: canonicalTenantId,
                  businessId: canonicalBusinessId,
                  status: 'DISQUALIFIED',
                  priority,
                  q,
                  limit
                })}
                label="Disqualified"
                active={status === 'DISQUALIFIED'}
              />
              <FilterLink
                href={buildFilterHref({
                  tenantId: canonicalTenantId,
                  businessId: canonicalBusinessId,
                  status: 'ARCHIVED',
                  priority,
                  q,
                  limit
                })}
                label="Archived"
                active={status === 'ARCHIVED'}
              />
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium">Priority</div>
            <div className="flex flex-wrap gap-2">
              <FilterLink
                href={buildFilterHref({ tenantId: canonicalTenantId, businessId: canonicalBusinessId, status, q, limit })}
                label="All"
                active={!priority}
              />
              <FilterLink
                href={buildFilterHref({
                  tenantId: canonicalTenantId,
                  businessId: canonicalBusinessId,
                  status,
                  priority: 'HIGH',
                  q,
                  limit
                })}
                label="High"
                active={priority === 'HIGH'}
              />
              <FilterLink
                href={buildFilterHref({
                  tenantId: canonicalTenantId,
                  businessId: canonicalBusinessId,
                  status,
                  priority: 'MEDIUM',
                  q,
                  limit
                })}
                label="Medium"
                active={priority === 'MEDIUM'}
              />
              <FilterLink
                href={buildFilterHref({
                  tenantId: canonicalTenantId,
                  businessId: canonicalBusinessId,
                  status,
                  priority: 'LOW',
                  q,
                  limit
                })}
                label="Low"
                active={priority === 'LOW'}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-neutral-600">
          <div>
            Showing {data.prospects.length} of {data.total} prospects
            {q ? ` for "${q}"` : ''}
          </div>
          <div>
            Page {currentPage} of {totalPages}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-neutral-200">
          <div className="grid grid-cols-[1.8fr_1fr_1fr_1.2fr] gap-4 border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-neutral-600">
            <div>Prospect</div>
            <div>Priority / status</div>
            <div>Next step</div>
            <div>Last activity</div>
          </div>

          <div className="divide-y divide-neutral-200">
            {prospects.map((prospect) => {
              const latestAttempt = prospect.attempts[0];
              const headline = getProspectHeadline(prospect);
              const location = formatLocation(prospect);
              const nextAction = formatDateTime(prospect.nextActionAt);
              const responseTime = formatDateTime(prospect.respondedAt);
              const lastActivity = formatQueueLastActivityPreview(prospect.lastActivityPreview);

              return (
                <div key={prospect.prospectSid} className="grid gap-4 px-4 py-4 md:grid-cols-[1.8fr_1fr_1fr_1.2fr]">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={buildProspectDetailHref(prospect.prospectSid, currentHref)}
                        className="font-semibold tracking-tight underline-offset-2 hover:underline"
                      >
                        {prospect.companyName}
                      </a>
                      <span className="rounded-full border border-neutral-300 px-2 py-0.5 text-xs text-neutral-600">
                        {prospect.prospectSid}
                      </span>
                      {prospect.sourceLabel ? (
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-medium ${sourceBadgeClass(
                            prospect.sourceLabel
                          )}`}
                        >
                          {formatSourceLabel(prospect.sourceLabel)}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-sm text-neutral-700">
                      {[prospect.contactName, prospect.contactPhone, prospect.contactEmail].filter(Boolean).join(' · ') || 'Contact details still thin'}
                    </div>
                    <div className="text-sm text-neutral-600">
                      {location || 'Location not labeled yet'}
                    </div>
                    <div className="text-sm text-black">{headline}</div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-black px-2.5 py-1 text-xs font-medium">
                        {prospect.status.replaceAll('_', ' ')}
                      </span>
                      <span className="rounded-full border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700">
                        {prospect.priority ?? 'NO PRIORITY'}
                      </span>
                    </div>
                    <div className="text-neutral-600">
                      Created {formatDateTime(prospect.createdAt)}
                      {responseTime ? ` · Responded ${responseTime}` : ''}
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-neutral-700">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium ${queueHintClass(prospect.queueHint.tone)}`}
                      >
                        {prospect.queueHint.label}
                      </span>
                      <span className="text-neutral-600">
                        {nextAction ? `Next action ${nextAction}` : 'No next-action time set'}
                      </span>
                    </div>
                    <div>{prospect.queueHint.reason}</div>
                    <div>{prospect.notes?.trim() || 'No additional notes recorded.'}</div>
                  </div>

                  <div className="space-y-2 text-sm text-neutral-700">
                    <div className="font-medium text-neutral-900">{lastActivity.title}</div>
                    <div>{lastActivity.detailLine}</div>
                    <div>{latestAttempt?.note?.trim() || 'No attempt note recorded.'}</div>
                  </div>
                </div>
              );
            })}

            {data.prospects.length === 0 ? (
              <div className="px-4 py-8 text-sm text-neutral-600">No prospects match the current queue scope.</div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-neutral-600">Total prospects: {summary.totalProspects}</div>
          <div className="flex items-center gap-2">
            {previousHref ? (
              <a href={previousHref} className="rounded-xl border border-neutral-300 px-4 py-2 text-sm">
                Previous
              </a>
            ) : (
              <span className="rounded-xl border border-neutral-200 px-4 py-2 text-sm text-neutral-400">Previous</span>
            )}
            {nextHref ? (
              <a href={nextHref} className="rounded-xl border border-neutral-300 px-4 py-2 text-sm">
                Next
              </a>
            ) : (
              <span className="rounded-xl border border-neutral-200 px-4 py-2 text-sm text-neutral-400">Next</span>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
