import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getApiBaseUrl, getInternalApiHeaders } from '@/lib/api';
import { CallsQueueTable } from './calls-queue-table';

export const dynamic = 'force-dynamic';

type CallRow = {
  twilioCallSid: string;
  status: string;
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
  phoneNumber: {
    e164: string;
    label: string | null;
  };
  agentProfile: {
    name: string | null;
    voiceName: string | null;
  } | null;
};

type CallsResponse = {
  ok: true;
  calls: CallRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type CallsSummary = {
  ok: true;
  totalCalls: number;
  openCalls: number;
  contactedCalls: number;
  archivedCalls: number;
  unreviewedCalls: number;
  needsReviewCalls: number;
  reviewedCalls: number;
  highUrgencyCalls: number;
  emergencyCalls: number;
};

type CallsSearchParams = {
  triageStatus?: string;
  reviewStatus?: string;
  urgency?: string;
  q?: string;
  page?: string;
  limit?: string;
  notice?: string;
};

function normalizeLimit(value: string | undefined) {
  return String(Math.min(Math.max(Number(value ?? '25') || 25, 1), 100));
}

function normalizePage(value: string | undefined) {
  return String(Math.max(Number(value ?? '1') || 1, 1));
}

async function getCalls(input: {
  triageStatus?: string;
  reviewStatus?: string;
  urgency?: string;
  q?: string;
  page?: string;
  limit?: string;
}) {
  const params = new URLSearchParams();
  params.set('limit', normalizeLimit(input.limit));
  params.set('page', normalizePage(input.page));

  if (input.triageStatus) params.set('triageStatus', input.triageStatus);
  if (input.reviewStatus) params.set('reviewStatus', input.reviewStatus);
  if (input.urgency) params.set('urgency', input.urgency);
  if (input.q?.trim()) params.set('q', input.q.trim());

  const res = await fetch(`${getApiBaseUrl()}/v1/calls?${params.toString()}`, {
    cache: 'no-store',
    headers: getInternalApiHeaders()
  });

  if (!res.ok) {
    throw new Error(`Failed to load calls: ${res.status}`);
  }

  return (await res.json()) as CallsResponse;
}

async function getCallsSummary() {
  const res = await fetch(`${getApiBaseUrl()}/v1/calls/summary`, {
    cache: 'no-store',
    headers: getInternalApiHeaders()
  });

  if (!res.ok) {
    throw new Error(`Failed to load call summary: ${res.status}`);
  }

  return (await res.json()) as CallsSummary;
}

function buildFilterHref(input: {
  triageStatus?: string;
  reviewStatus?: string;
  urgency?: string;
  q?: string;
  page?: string;
  limit?: string;
  notice?: string;
}) {
  const params = new URLSearchParams();

  if (input.triageStatus) params.set('triageStatus', input.triageStatus);
  if (input.reviewStatus) params.set('reviewStatus', input.reviewStatus);
  if (input.urgency) params.set('urgency', input.urgency);
  if (input.q?.trim()) params.set('q', input.q.trim());

  const normalizedPage = normalizePage(input.page);
  if (normalizedPage !== '1') params.set('page', normalizedPage);

  const normalizedLimit = normalizeLimit(input.limit);
  if (normalizedLimit !== '25') params.set('limit', normalizedLimit);
  if (input.notice) params.set('notice', input.notice);

  const query = params.toString();
  return query ? `/calls?${query}` : '/calls';
}

function buildNoticeHref(currentHref: string, notice: string) {
  const url = new URL(currentHref, 'http://localhost');
  url.searchParams.set('notice', notice);
  return `${url.pathname}${url.search}`;
}

function getNoticeMessage(notice: string | undefined) {
  switch (notice) {
    case 'contacted':
      return 'Call marked contacted.';
    case 'archived':
      return 'Call archived.';
    case 'bulk-contacted':
      return 'Selected calls marked contacted.';
    case 'bulk-archived':
      return 'Selected calls archived.';
    default:
      return null;
  }
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
  value
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 p-4">
      <div className="text-sm text-neutral-600">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

export default async function CallsPage({
  searchParams
}: {
  searchParams: Promise<CallsSearchParams>;
}) {
  const resolved = await searchParams;
  const triageStatus = resolved.triageStatus;
  const reviewStatus = resolved.reviewStatus;
  const urgency = resolved.urgency;
  const q = resolved.q?.trim() ?? '';
  const page = normalizePage(resolved.page);
  const limit = normalizeLimit(resolved.limit);
  const noticeMessage = getNoticeMessage(resolved.notice);

  if (!triageStatus) {
    redirect(
      buildFilterHref({
        triageStatus: 'OPEN',
        reviewStatus,
        urgency,
        q,
        limit
      })
    );
  }

  const currentHref = buildFilterHref({
    triageStatus,
    reviewStatus,
    urgency,
    q,
    page,
    limit
  });

  const [data, summary] = await Promise.all([
    getCalls({
      triageStatus,
      reviewStatus,
      urgency,
      q,
      page,
      limit
    }),
    getCallsSummary()
  ]);

  const currentPage = data.page;
  const totalPages = data.totalPages;
  const previousHref =
    currentPage > 1
      ? buildFilterHref({
          triageStatus,
          reviewStatus,
          urgency,
          q,
          page: String(currentPage - 1),
          limit
        })
      : null;
  const nextHref =
    currentPage < totalPages
      ? buildFilterHref({
          triageStatus,
          reviewStatus,
          urgency,
          q,
          page: String(currentPage + 1),
          limit
        })
      : null;

  async function markContacted(formData: FormData) {
    'use server';

    const callSid = String(formData.get('callSid') ?? '');

    if (!callSid) {
      redirect(currentHref);
    }

    const res = await fetch(`${getApiBaseUrl()}/v1/calls/${callSid}/mark-contacted`, {
      method: 'POST',
      headers: getInternalApiHeaders()
    });

    if (!res.ok) {
      throw new Error(`Failed to mark contacted: ${res.status}`);
    }

    revalidatePath('/calls');
    revalidatePath(`/calls/${callSid}`);
    redirect(buildNoticeHref(currentHref, 'contacted'));
  }

  async function archiveCall(formData: FormData) {
    'use server';

    const callSid = String(formData.get('callSid') ?? '');

    if (!callSid) {
      redirect(currentHref);
    }

    const res = await fetch(`${getApiBaseUrl()}/v1/calls/${callSid}/archive`, {
      method: 'POST',
      headers: getInternalApiHeaders()
    });

    if (!res.ok) {
      throw new Error(`Failed to archive call: ${res.status}`);
    }

    revalidatePath('/calls');
    revalidatePath(`/calls/${callSid}`);
    redirect(buildNoticeHref(currentHref, 'archived'));
  }

  async function bulkMarkContacted(formData: FormData) {
    'use server';

    const callSids = formData
      .getAll('callSids')
      .map((value) => String(value))
      .filter(Boolean);

    if (callSids.length === 0) {
      redirect(currentHref);
    }

    const res = await fetch(`${getApiBaseUrl()}/v1/calls/bulk/mark-contacted`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...getInternalApiHeaders()
      },
      body: JSON.stringify({ callSids })
    });

    if (!res.ok) {
      throw new Error(`Failed to bulk mark contacted: ${res.status}`);
    }

    revalidatePath('/calls');
    for (const callSid of callSids) {
      revalidatePath(`/calls/${callSid}`);
    }

    redirect(buildNoticeHref(currentHref, 'bulk-contacted'));
  }

  async function bulkArchive(formData: FormData) {
    'use server';

    const callSids = formData
      .getAll('callSids')
      .map((value) => String(value))
      .filter(Boolean);

    if (callSids.length === 0) {
      redirect(currentHref);
    }

    const res = await fetch(`${getApiBaseUrl()}/v1/calls/bulk/archive`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...getInternalApiHeaders()
      },
      body: JSON.stringify({ callSids })
    });

    if (!res.ok) {
      throw new Error(`Failed to bulk archive: ${res.status}`);
    }

    revalidatePath('/calls');
    for (const callSid of callSids) {
      revalidatePath(`/calls/${callSid}`);
    }

    redirect(buildNoticeHref(currentHref, 'bulk-archived'));
  }

  return (
    <main className="min-h-screen bg-white p-6 text-black">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Frontdesk Ops</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Searchable call queue with triage actions and urgency visibility.
          </p>
        </div>

        {noticeMessage ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
            {noticeMessage}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard label="Open" value={summary.openCalls} />
          <SummaryCard label="Contacted" value={summary.contactedCalls} />
          <SummaryCard label="Archived" value={summary.archivedCalls} />
          <SummaryCard label="Unreviewed" value={summary.unreviewedCalls} />
          <SummaryCard label="Needs review" value={summary.needsReviewCalls} />
          <SummaryCard label="Reviewed" value={summary.reviewedCalls} />
          <SummaryCard label="High urgency" value={summary.highUrgencyCalls} />
          <SummaryCard label="Emergency" value={summary.emergencyCalls} />
        </div>

        <div className="space-y-4 rounded-2xl border border-neutral-200 p-4">
          <form action="/calls" className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1">
              <label htmlFor="q" className="mb-2 block text-sm font-medium">
                Search queue
              </label>
            <input
              id="q"
                name="q"
                defaultValue={q}
                placeholder="Search by caller, lead, address, summary, or Call SID"
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <input type="hidden" name="triageStatus" value={triageStatus} />
            {reviewStatus ? <input type="hidden" name="reviewStatus" value={reviewStatus} /> : null}
            <input type="hidden" name="limit" value={limit} />
            {urgency ? <input type="hidden" name="urgency" value={urgency} /> : null}
            <button className="rounded-xl border border-black bg-black px-4 py-2 text-sm text-white">
              Search
            </button>
            <a
              href={buildFilterHref({ triageStatus, reviewStatus, urgency, limit })}
              className="rounded-xl border border-neutral-300 px-4 py-2 text-sm"
            >
              Clear
            </a>
          </form>

          <div>
            <div className="mb-2 text-sm font-medium">Triage</div>
            <div className="flex flex-wrap gap-2">
              <FilterLink
                href={buildFilterHref({ triageStatus: 'OPEN', reviewStatus, urgency, q, limit })}
                label="Open"
                active={triageStatus === 'OPEN'}
              />
              <FilterLink
                href={buildFilterHref({ triageStatus: 'CONTACTED', reviewStatus, urgency, q, limit })}
                label="Contacted"
                active={triageStatus === 'CONTACTED'}
              />
              <FilterLink
                href={buildFilterHref({ triageStatus: 'ARCHIVED', reviewStatus, urgency, q, limit })}
                label="Archived"
                active={triageStatus === 'ARCHIVED'}
              />
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium">Review</div>
            <div className="flex flex-wrap gap-2">
              <FilterLink
                href={buildFilterHref({ triageStatus, urgency, q, limit })}
                label="All"
                active={!reviewStatus}
              />
              <FilterLink
                href={buildFilterHref({ triageStatus, reviewStatus: 'UNREVIEWED', urgency, q, limit })}
                label="Unreviewed"
                active={reviewStatus === 'UNREVIEWED'}
              />
              <FilterLink
                href={buildFilterHref({ triageStatus, reviewStatus: 'NEEDS_REVIEW', urgency, q, limit })}
                label="Needs review"
                active={reviewStatus === 'NEEDS_REVIEW'}
              />
              <FilterLink
                href={buildFilterHref({ triageStatus, reviewStatus: 'REVIEWED', urgency, q, limit })}
                label="Reviewed"
                active={reviewStatus === 'REVIEWED'}
              />
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium">Urgency</div>
            <div className="flex flex-wrap gap-2">
              <FilterLink
                href={buildFilterHref({ triageStatus, reviewStatus, q, limit })}
                label="All"
                active={!urgency}
              />
              <FilterLink
                href={buildFilterHref({ triageStatus, reviewStatus, urgency: 'low', q, limit })}
                label="Low"
                active={urgency === 'low'}
              />
              <FilterLink
                href={buildFilterHref({ triageStatus, reviewStatus, urgency: 'medium', q, limit })}
                label="Medium"
                active={urgency === 'medium'}
              />
              <FilterLink
                href={buildFilterHref({ triageStatus, reviewStatus, urgency: 'high', q, limit })}
                label="High"
                active={urgency === 'high'}
              />
              <FilterLink
                href={buildFilterHref({ triageStatus, reviewStatus, urgency: 'emergency', q, limit })}
                label="Emergency"
                active={urgency === 'emergency'}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-neutral-600">
          <div>
            Showing {data.calls.length} of {data.total} calls
            {q ? ` for "${q}"` : ''}
          </div>
          <div>
            Page {currentPage} of {totalPages}
          </div>
        </div>

        <CallsQueueTable
          calls={data.calls}
          currentHref={currentHref}
          queueState={{ triageStatus, reviewStatus, urgency, q }}
          limit={limit}
          markContactedAction={markContacted}
          archiveAction={archiveCall}
          bulkMarkContactedAction={bulkMarkContacted}
          bulkArchiveAction={bulkArchive}
        />

        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-neutral-600">
            Total calls: {summary.totalCalls}
          </div>
          <div className="flex items-center gap-2">
            {previousHref ? (
              <a href={previousHref} className="rounded-xl border border-neutral-300 px-4 py-2 text-sm">
                Previous
              </a>
            ) : (
              <span className="rounded-xl border border-neutral-200 px-4 py-2 text-sm text-neutral-400">
                Previous
              </span>
            )}
            {nextHref ? (
              <a href={nextHref} className="rounded-xl border border-neutral-300 px-4 py-2 text-sm">
                Next
              </a>
            ) : (
              <span className="rounded-xl border border-neutral-200 px-4 py-2 text-sm text-neutral-400">
                Next
              </span>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
