import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getApiBaseUrl, getInternalApiHeaders } from '@/lib/api';
import {
  buildQueueHref,
  buildProspectsRequestUrl,
  PROSPECT_QUEUE_FETCH_LIMIT,
  prospectQueueStatuses,
  type ProspectQueueStatus
} from './queue-flow';
import { type ProspectReadSignals } from '@frontdesk/domain';
import {
  buildStarterProspectImportBody,
  parseStarterProspectCsv
} from './prospect-csv-import';

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

type ProspectRow = {
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
  lastAttemptAt: string | null;
  nextActionAt: string | null;
  createdAt: string;
  updatedAt: string;
  readState: ProspectReadSignals;
};

type ProspectsResponse = {
  ok: true;
  prospects: ProspectRow[];
};

type ProspectSummary = {
  total: number;
  active: number;
  terminal: number;
  new: number;
  ready: number;
  inProgress: number;
  attempted: number;
  responded: number;
  qualified: number;
  disqualified: number;
  archived: number;
};

type ProspectSummaryResponse = {
  ok: true;
  summary: ProspectSummary;
};

type SummaryCardConfig = {
  label: string;
  value: number;
  href: string;
};

type QueueExecutionState = {
  label: string;
  title: string;
  description: string;
};

type ProspectsSearchParams = {
  status?: string;
  notice?: string;
  error?: string;
  importedCount?: string;
};

function appendQueryParams(href: string, params: Record<string, string | undefined>) {
  const [pathname, query = ''] = href.split('?');
  const searchParams = new URLSearchParams(query);

  for (const [key, value] of Object.entries(params)) {
    if (value && value.trim()) {
      searchParams.set(key, value);
    }
  }

  const nextQuery = searchParams.toString();
  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}

async function getBootstrap() {
  const res = await fetch(`${getApiBaseUrl()}/v1/bootstrap`, {
    cache: 'no-store',
    headers: await getInternalApiHeaders()
  });

  if (!res.ok) {
    return null;
  }

  return (await res.json()) as BootstrapResponse;
}

async function getProspects(businessId: string, status: ProspectQueueStatus) {
  const url = buildProspectsRequestUrl({
    apiBaseUrl: getApiBaseUrl(),
    businessId,
    status,
    limit: PROSPECT_QUEUE_FETCH_LIMIT
  });

  const res = await fetch(url, {
    cache: 'no-store',
    headers: await getInternalApiHeaders()
  });

  if (!res.ok) {
    throw new Error(`Failed to load prospects: ${res.status}`);
  }

  return (await res.json()) as ProspectsResponse;
}

async function getProspectSummary(businessId: string) {
  const res = await fetch(`${getApiBaseUrl()}/v1/businesses/${businessId}/prospects/summary`, {
    cache: 'no-store',
    headers: await getInternalApiHeaders()
  });

  if (!res.ok) {
    throw new Error(`Failed to load prospect summary: ${res.status}`);
  }

  return (await res.json()) as ProspectSummaryResponse;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function formatDateTimeNullable(value: string | null) {
  return value ? formatDateTime(value) : '—';
}

function formatStatus(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatPriority(value: string | null) {
  if (!value) return '—';
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function SummaryCard({
  label,
  value,
  href
}: SummaryCardConfig) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm transition hover:border-black/20 hover:bg-black/[0.02]"
    >
      <div className="text-xs uppercase tracking-[0.2em] text-black/50">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-black">{value}</div>
    </Link>
  );
}

export default async function ProspectsPage({
  searchParams
}: {
  searchParams: Promise<ProspectsSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const activeStatus = prospectQueueStatuses.includes(
    resolvedSearchParams.status?.toUpperCase() as ProspectQueueStatus
  )
    ? (resolvedSearchParams.status!.toUpperCase() as ProspectQueueStatus)
    : 'ALL';

  const bootstrap = await getBootstrap();
  const activeBusiness = bootstrap?.tenant?.businesses[0] ?? null;

  if (!activeBusiness) {
    return (
      <main className="min-h-screen bg-[#f7f6f2] px-6 py-10 text-[#111827]">
        <div className="mx-auto max-w-5xl rounded-2xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-2xl font-semibold tracking-[-0.03em]">Prospects</h1>
          <p className="mt-2 text-sm text-red-700">
            No active business is configured, so operator visibility cannot load.
          </p>
        </div>
      </main>
    );
  }

  const [summaryResponse, prospectsResponse] = await Promise.all([
    getProspectSummary(activeBusiness.id),
    getProspects(activeBusiness.id, activeStatus)
  ]);

  const summary = summaryResponse.summary;
  const prospects = prospectsResponse.prospects;
  const queueHref = buildQueueHref(activeStatus);
  const importNotice =
    resolvedSearchParams.notice === 'csv-imported'
      ? `Imported ${resolvedSearchParams.importedCount ?? '0'} prospects from CSV.`
      : resolvedSearchParams.notice === 'csv-import-error'
        ? `CSV import failed: ${resolvedSearchParams.error?.trim() || 'Please try again.'}`
        : null;
  const actionableProspects = prospects.filter((prospect) => prospect.readState.isActionable);
  const actionableCount = actionableProspects.length;
  const openNextActionable = actionableProspects[0] ?? null;
  const nextReviewCandidate = openNextActionable;
  const currentFilterLabel = activeStatus === 'ALL' ? 'All prospects' : formatStatus(activeStatus);
  const queueReviewActionLabel = activeStatus === 'ALL' ? 'Start queue review' : 'Resume queue review';
  const queueExecutionState: QueueExecutionState =
    summary.total === 0
      ? {
          label: 'empty',
          title: 'No prospects captured yet.',
          description: 'The business has not captured any prospects yet.'
        }
      : prospects.length === 0
        ? {
            label: 'filtered empty',
            title: `No prospects match ${currentFilterLabel.toLowerCase()}.`,
            description: 'Clear the filter or choose another one to reopen the worklist.'
          }
      : summary.active === 0
        ? {
            label: 'completed',
            title: 'No active prospects remain in this queue.',
            description: 'All prospects in the current view are in terminal states.'
          }
        : actionableCount === 0
        ? {
            label: 'blocked / complete',
            title: 'Queue has records, but none are actionable right now.',
            description: 'This queue is effectively complete until a next action is added.'
          }
          : {
              label: 'ready',
              title: 'Queue is ready for execution.',
              description: nextReviewCandidate
                ? `Continue with ${nextReviewCandidate.contactName || nextReviewCandidate.companyName || nextReviewCandidate.prospectSid}.`
                : 'Continue with the first actionable prospect.'
            };

  const summaryCards: SummaryCardConfig[] = [
    { label: 'Total', value: summary.total, href: buildQueueHref('ALL') },
    { label: 'New', value: summary.new, href: buildQueueHref('NEW') },
    { label: 'Ready', value: summary.ready, href: buildQueueHref('READY') },
    { label: 'In progress', value: summary.inProgress, href: buildQueueHref('IN_PROGRESS') },
    { label: 'Attempted', value: summary.attempted, href: buildQueueHref('ATTEMPTED') },
    { label: 'Responded', value: summary.responded, href: buildQueueHref('RESPONDED') },
    { label: 'Qualified', value: summary.qualified, href: buildQueueHref('QUALIFIED') },
    { label: 'Disqualified', value: summary.disqualified, href: buildQueueHref('DISQUALIFIED') },
    { label: 'Archived', value: summary.archived, href: buildQueueHref('ARCHIVED') }
  ];

  const filterCounts: Record<ProspectQueueStatus, number> = {
    ALL: summary.total,
    NEW: summary.new,
    READY: summary.ready,
    IN_PROGRESS: summary.inProgress,
    ATTEMPTED: summary.attempted,
    RESPONDED: summary.responded,
    QUALIFIED: summary.qualified,
    DISQUALIFIED: summary.disqualified,
    ARCHIVED: summary.archived
  };

  async function importStarterCsv(formData: FormData) {
    'use server';

    if (!activeBusiness) {
      redirect(
        appendQueryParams(queueHref, {
          notice: 'csv-import-error',
          error: 'No active business is configured for import.'
        })
      );
    }

    const file = formData.get('csvFile');
    if (!(file instanceof File) || file.size === 0) {
      redirect(
        appendQueryParams(queueHref, {
          notice: 'csv-import-error',
          error: 'Choose a CSV file to import.'
        })
      );
    }

    let rows;
    try {
      rows = parseStarterProspectCsv(await file.text());
    } catch (error) {
      redirect(
        appendQueryParams(queueHref, {
          notice: 'csv-import-error',
          error: error instanceof Error ? error.message : 'Invalid CSV format.'
        })
      );
    }

    if (rows.length === 0) {
      redirect(
        appendQueryParams(queueHref, {
          notice: 'csv-import-error',
          error: 'The CSV file did not contain any prospect rows.'
        })
      );
    }

    const response = await fetch(
      `${getApiBaseUrl()}/v1/businesses/${activeBusiness.id}/prospects/import`,
      {
        method: 'POST',
        cache: 'no-store',
        headers: {
          ...(await getInternalApiHeaders()),
          'content-type': 'application/json'
        },
        body: JSON.stringify(buildStarterProspectImportBody(rows))
      }
    );

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      redirect(
        appendQueryParams(queueHref, {
          notice: 'csv-import-error',
          error: body?.error ?? `CSV import failed with status ${response.status}.`
        })
      );
    }

    const body = (await response.json()) as { importedCount?: number };
    revalidatePath('/prospects');

    redirect(
      appendQueryParams(queueHref, {
        notice: 'csv-imported',
        importedCount: String(body.importedCount ?? rows.length)
      })
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f6f2] px-6 py-10 text-[#111827]">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-sm uppercase tracking-[0.24em] text-black/50">Operator view</div>
            <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em]">Prospects</h1>
            <p className="mt-2 text-sm text-black/60">
              Active business: <span className="font-medium text-black">{activeBusiness.name}</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {openNextActionable ? (
              <Link
                href={{
                  pathname: `/prospects/${openNextActionable.prospectSid}`,
                  query: { returnTo: queueHref }
                }}
                className="rounded-full bg-[#111827] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#0b1120]"
              >
                Open next actionable
              </Link>
            ) : null}
            <Link
              href="/"
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black shadow-sm"
            >
              Back to homepage
            </Link>
          </div>
        </div>

        {importNotice ? (
          <div
            className={`rounded-2xl border px-5 py-4 text-sm shadow-sm ${
              resolvedSearchParams.notice === 'csv-import-error'
                ? 'border-rose-200 bg-rose-50 text-rose-900'
                : 'border-emerald-200 bg-emerald-50 text-emerald-900'
            }`}
          >
            {importNotice}
          </div>
        ) : null}

        <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.24em] text-black/50">CSV import</div>
              <h2 className="text-2xl font-semibold tracking-[-0.04em]">Upload a starter lead list</h2>
              <p className="max-w-3xl text-sm text-black/60">
                Import a CSV with company, trade, city, website, phone, email, address, and notes. Website and address
                are preserved in notes. City and state are parsed when the city field includes both.
              </p>
            </div>

            <form action={importStarterCsv} className="flex w-full max-w-md flex-col gap-3">
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.2em] text-black/50">Starter CSV</span>
                <input
                  name="csvFile"
                  type="file"
                  accept=".csv,text/csv"
                  required
                  className="block w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-black file:mr-4 file:rounded-full file:border-0 file:bg-black file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
                />
              </label>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button className="rounded-full bg-[#111827] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#0b1120]">
                  Import CSV
                </button>
                <div className="text-xs leading-6 text-black/50">
                  Expected headers: company, trade, city, website, phone, email, address, notes
                </div>
              </div>
            </form>
          </div>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="text-xs uppercase tracking-[0.24em] text-black/50">Queue review</div>
              <h2 className="text-2xl font-semibold tracking-[-0.04em]">Execution mode · {currentFilterLabel}</h2>
              <p className="max-w-3xl text-sm text-black/60">
                Enter the current filtered queue, understand what is actionable, and move into the next review step
                without leaving the flow.
              </p>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-black/10 bg-black/[0.02] px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-black/50">Current filter</div>
                  <div className="mt-1 text-sm font-medium text-black">{currentFilterLabel}</div>
                </div>
                <div className="rounded-2xl border border-black/10 bg-black/[0.02] px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-black/50">Queue items</div>
                  <div className="mt-1 text-sm font-medium text-black">{prospects.length}</div>
                </div>
                <div className="rounded-2xl border border-black/10 bg-black/[0.02] px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-black/50">Actionable</div>
                  <div className="mt-1 text-sm font-medium text-black">{actionableCount}</div>
                </div>
                <div className="rounded-2xl border border-black/10 bg-black/[0.02] px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-black/50">Queue state</div>
                  <div className="mt-1 text-sm font-medium text-black">{queueExecutionState.label}</div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {nextReviewCandidate ? (
                <Link
                  href={{
                    pathname: `/prospects/${nextReviewCandidate.prospectSid}`,
                    query: { returnTo: queueHref }
                  }}
                  className="rounded-full bg-[#111827] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#0b1120]"
                >
                  {queueReviewActionLabel}
                </Link>
              ) : (
                <div className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black/40 shadow-sm">
                  {queueExecutionState.label}
                </div>
              )}
              {nextReviewCandidate ? (
                <Link
                  href={{
                    pathname: `/prospects/${nextReviewCandidate.prospectSid}`,
                    query: { returnTo: queueHref }
                  }}
                  className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black shadow-sm transition hover:border-black/20 hover:bg-black/[0.02]"
                >
                  Continue with first actionable
                </Link>
              ) : null}
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-black/50">Execution summary</div>
              <div className="mt-2 space-y-3">
                <div className="text-base font-medium text-black">{queueExecutionState.title}</div>
                <p className="text-sm text-black/70">{queueExecutionState.description}</p>
                <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-black/10 bg-white px-4 py-3">
                    <dt className="text-xs uppercase tracking-[0.2em] text-black/40">Total items</dt>
                    <dd className="mt-1 text-sm font-medium text-black">{prospects.length}</dd>
                  </div>
                  <div className="rounded-2xl border border-black/10 bg-white px-4 py-3">
                    <dt className="text-xs uppercase tracking-[0.2em] text-black/40">Actionable</dt>
                    <dd className="mt-1 text-sm font-medium text-black">{actionableCount}</dd>
                  </div>
                  <div className="rounded-2xl border border-black/10 bg-white px-4 py-3">
                    <dt className="text-xs uppercase tracking-[0.2em] text-black/40">Queue focus</dt>
                    <dd className="mt-1 text-sm font-medium text-black">{currentFilterLabel}</dd>
                  </div>
                  <div className="rounded-2xl border border-black/10 bg-white px-4 py-3">
                    <dt className="text-xs uppercase tracking-[0.2em] text-black/40">Execution state</dt>
                    <dd className="mt-1 text-sm font-medium text-black">{queueExecutionState.label}</dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="rounded-2xl border border-black/10 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-black/50">Next item to review</div>
              {nextReviewCandidate ? (
                <div className="mt-2 space-y-2">
                  <div className="text-base font-medium text-black">
                    {nextReviewCandidate.contactName || nextReviewCandidate.companyName || nextReviewCandidate.prospectSid}
                  </div>
                  <div className="text-sm text-black/70">
                    {nextReviewCandidate.companyName || 'No company name'} · {formatStatus(nextReviewCandidate.status)}
                  </div>
                  <div className="text-sm text-black/70">
                    Next action: {formatDateTimeNullable(nextReviewCandidate.nextActionAt)}
                  </div>
                  <div className="text-xs uppercase tracking-[0.2em] text-black/40">
                    {nextReviewCandidate.readState.queueStateLabel}
                  </div>
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  <div className="text-base font-medium text-black">No actionable item available</div>
                  <p className="text-sm text-black/60">
                    {summary.total === 0
                      ? 'No prospects have been captured yet.'
                      : prospects.length === 0
                        ? `No prospects match ${currentFilterLabel.toLowerCase()}.`
                        : 'Prospects exist in this queue, but none are actionable right now.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <SummaryCard key={card.label} {...card} />
          ))}
        </section>

        <section className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
          <div className="border-b border-black/10 px-5 py-4">
            <h2 className="text-lg font-semibold tracking-[-0.02em]">Lead queue</h2>
            <p className="mt-1 text-sm text-black/60">
              Read-only visibility into captured prospects.
            </p>
          </div>

          <div className="border-b border-black/10 px-5 py-4">
            <div className="flex flex-wrap gap-2">
              {prospectQueueStatuses.map((status) => {
                const isActive = activeStatus === status;

                return (
                  <Link
                    key={status}
                    href={buildQueueHref(status)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      isActive
                        ? 'bg-[#111827] text-white shadow-sm'
                        : 'border border-black/10 bg-white text-black/70 hover:text-black'
                    }`}
                  >
                    <span>{status === 'ALL' ? 'All' : formatStatus(status)}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        isActive ? 'bg-white/15 text-white' : 'bg-black/[0.06] text-black/60'
                      }`}
                    >
                      {filterCounts[status]}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          {prospects.length === 0 ? (
            <div className="px-5 py-10 text-sm text-black/60">
              {summary.total === 0
                ? 'No prospects have been captured yet.'
                : `No prospects match ${currentFilterLabel.toLowerCase()}.`}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-black/[0.03] text-black/60">
                  <tr>
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-5 py-3 font-medium">Phone</th>
                    <th className="px-5 py-3 font-medium">Company</th>
                    <th className="px-5 py-3 font-medium">Next action</th>
                    <th className="px-5 py-3 font-medium">Last attempt</th>
                    <th className="px-5 py-3 font-medium">Queue state</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Priority</th>
                    <th className="px-5 py-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {prospects.map((prospect) => (
                    <tr key={prospect.prospectSid} className="border-t border-black/10 align-top">
                      <td className="px-5 py-4">
                        <Link
                          href={{
                            pathname: `/prospects/${prospect.prospectSid}`,
                            query: { returnTo: queueHref }
                          }}
                          className="font-medium text-black transition hover:text-black/70"
                        >
                          {prospect.contactName || prospect.companyName || prospect.prospectSid}
                        </Link>
                        <div className="mt-1 text-xs text-black/50">
                          {prospect.contactEmail || 'No email'}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-black/70">{prospect.contactPhone || '—'}</td>
                      <td className="px-5 py-4">
                        <div className="text-black/70">{prospect.companyName || '—'}</div>
                        <div className="mt-1 text-xs text-black/50">
                          {[prospect.city, prospect.state].filter(Boolean).join(', ') || prospect.sourceLabel || '—'}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-black/70">{formatDateTimeNullable(prospect.nextActionAt)}</td>
                      <td className="px-5 py-4 text-black/70">{formatDateTimeNullable(prospect.lastAttemptAt)}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            prospect.readState.queueStateLabel === 'overdue'
                              ? 'bg-rose-100 text-rose-900'
                              : prospect.readState.queueStateLabel === 'due now'
                                ? 'bg-amber-100 text-amber-900'
                                : prospect.readState.queueStateLabel === 'upcoming'
                                  ? 'bg-blue-100 text-blue-900'
                                  : 'bg-black/[0.06] text-black/60'
                          }`}
                        >
                          {prospect.readState.queueStateLabel}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-black/70">{formatStatus(prospect.status)}</td>
                      <td className="px-5 py-4 text-black/70">{formatPriority(prospect.priority)}</td>
                      <td className="px-5 py-4 text-black/70">{formatDateTime(prospect.createdAt)}</td>
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
