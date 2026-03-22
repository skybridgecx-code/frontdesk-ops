import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getApiBaseUrl, getInternalApiHeaders } from '@/lib/api';

export const dynamic = 'force-dynamic';

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
  highUrgencyCalls: number;
  emergencyCalls: number;
};

type CallsSearchParams = {
  triageStatus?: string;
  urgency?: string;
  q?: string;
  page?: string;
  limit?: string;
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

function normalizeLimit(value: string | undefined) {
  return String(Math.min(Math.max(Number(value ?? '25') || 25, 1), 100));
}

function normalizePage(value: string | undefined) {
  return String(Math.max(Number(value ?? '1') || 1, 1));
}

async function getCalls(input: {
  triageStatus?: string;
  urgency?: string;
  q?: string;
  page?: string;
  limit?: string;
}) {
  const params = new URLSearchParams();
  params.set('limit', normalizeLimit(input.limit));
  params.set('page', normalizePage(input.page));

  if (input.triageStatus) params.set('triageStatus', input.triageStatus);
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
  urgency?: string;
  q?: string;
  page?: string;
  limit?: string;
}) {
  const params = new URLSearchParams();

  if (input.triageStatus) params.set('triageStatus', input.triageStatus);
  if (input.urgency) params.set('urgency', input.urgency);
  if (input.q?.trim()) params.set('q', input.q.trim());

  const normalizedPage = normalizePage(input.page);
  if (normalizedPage !== '1') params.set('page', normalizedPage);

  const normalizedLimit = normalizeLimit(input.limit);
  if (normalizedLimit !== '25') params.set('limit', normalizedLimit);

  const query = params.toString();
  return query ? `/calls?${query}` : '/calls';
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
  const urgency = resolved.urgency;
  const q = resolved.q?.trim() ?? '';
  const page = normalizePage(resolved.page);
  const limit = normalizeLimit(resolved.limit);

  if (!triageStatus) {
    redirect(
      buildFilterHref({
        triageStatus: 'OPEN',
        urgency,
        q,
        limit
      })
    );
  }

  const currentHref = buildFilterHref({
    triageStatus,
    urgency,
    q,
    page,
    limit
  });

  const [data, summary] = await Promise.all([
    getCalls({
      triageStatus,
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
          urgency,
          q,
          page: String(currentPage + 1),
          limit
        })
      : null;

  async function markContacted(callSid: string) {
    'use server';

    await fetch(`${getApiBaseUrl()}/v1/calls/${callSid}/mark-contacted`, {
      method: 'POST',
      headers: getInternalApiHeaders()
    });

    revalidatePath('/calls');
    revalidatePath(`/calls/${callSid}`);
    redirect(currentHref);
  }

  async function archiveCall(callSid: string) {
    'use server';

    await fetch(`${getApiBaseUrl()}/v1/calls/${callSid}/archive`, {
      method: 'POST',
      headers: getInternalApiHeaders()
    });

    revalidatePath('/calls');
    revalidatePath(`/calls/${callSid}`);
    redirect(currentHref);
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

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard label="Open" value={summary.openCalls} />
          <SummaryCard label="Contacted" value={summary.contactedCalls} />
          <SummaryCard label="Archived" value={summary.archivedCalls} />
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
            <input type="hidden" name="limit" value={limit} />
            {urgency ? <input type="hidden" name="urgency" value={urgency} /> : null}
            <button className="rounded-xl border border-black bg-black px-4 py-2 text-sm text-white">
              Search
            </button>
            <a
              href={buildFilterHref({ triageStatus, urgency, limit })}
              className="rounded-xl border border-neutral-300 px-4 py-2 text-sm"
            >
              Clear
            </a>
          </form>

          <div>
            <div className="mb-2 text-sm font-medium">Triage</div>
            <div className="flex flex-wrap gap-2">
              <FilterLink
                href={buildFilterHref({ triageStatus: 'OPEN', urgency, q, limit })}
                label="Open"
                active={triageStatus === 'OPEN'}
              />
              <FilterLink
                href={buildFilterHref({ triageStatus: 'CONTACTED', urgency, q, limit })}
                label="Contacted"
                active={triageStatus === 'CONTACTED'}
              />
              <FilterLink
                href={buildFilterHref({ triageStatus: 'ARCHIVED', urgency, q, limit })}
                label="Archived"
                active={triageStatus === 'ARCHIVED'}
              />
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium">Urgency</div>
            <div className="flex flex-wrap gap-2">
              <FilterLink
                href={buildFilterHref({ triageStatus, q, limit })}
                label="All"
                active={!urgency}
              />
              <FilterLink
                href={buildFilterHref({ triageStatus, urgency: 'low', q, limit })}
                label="Low"
                active={urgency === 'low'}
              />
              <FilterLink
                href={buildFilterHref({ triageStatus, urgency: 'medium', q, limit })}
                label="Medium"
                active={urgency === 'medium'}
              />
              <FilterLink
                href={buildFilterHref({ triageStatus, urgency: 'high', q, limit })}
                label="High"
                active={urgency === 'high'}
              />
              <FilterLink
                href={buildFilterHref({ triageStatus, urgency: 'emergency', q, limit })}
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

        <div className="overflow-x-auto rounded-2xl border border-neutral-200">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50">
              <tr className="text-left">
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
              {data.calls.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-neutral-500">
                    No calls matched this queue.
                  </td>
                </tr>
              ) : (
                data.calls.map((call) => (
                  <tr key={call.twilioCallSid} className="border-t border-neutral-200 align-top">
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
                        <form action={markContacted.bind(null, call.twilioCallSid)}>
                          <button className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-left text-sm">
                            Mark contacted
                          </button>
                        </form>
                        <form action={archiveCall.bind(null, call.twilioCallSid)}>
                          <button className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-left text-sm">
                            Archive
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

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
