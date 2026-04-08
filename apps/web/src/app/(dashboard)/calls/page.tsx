import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getApiBaseUrl, getInternalApiHeaders } from '@/lib/api';
import { Card } from '../components/card';
import { SearchInput } from '../components/search-input';
import { CallsQueueTable } from './calls-queue-table';

export const metadata: Metadata = {
  title: 'Calls | SkybridgeCX'
};

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
  startedAt: string;
  durationSeconds: number | null;
};

type CallsResponse = {
  ok: true;
  calls: CallRow[];
  total: number;
};

type CallsSummary = {
  ok: true;
  openCalls: number;
  contactedCalls: number;
  archivedCalls: number;
};

type CallsSearchParams = {
  filter?: string;
  q?: string;
};

const filterOptions = ['all', 'pending', 'contacted', 'archived'] as const;

type CallsFilter = (typeof filterOptions)[number];

function resolveFilter(value: string | undefined): CallsFilter {
  if (value && filterOptions.includes(value as CallsFilter)) {
    return value as CallsFilter;
  }

  return 'all';
}

function buildCallsHref(filter: CallsFilter, q: string) {
  const params = new URLSearchParams();

  if (filter !== 'all') {
    params.set('filter', filter);
  }

  if (q.trim()) {
    params.set('q', q.trim());
  }

  const query = params.toString();
  return query ? `/calls?${query}` : '/calls';
}

async function getCalls(filter: CallsFilter, q: string) {
  const params = new URLSearchParams({
    page: '1',
    limit: '100'
  });

  if (filter === 'pending') {
    params.set('triageStatus', 'OPEN');
  } else if (filter === 'contacted') {
    params.set('triageStatus', 'CONTACTED');
  } else if (filter === 'archived') {
    params.set('triageStatus', 'ARCHIVED');
  }

  if (q.trim()) {
    params.set('q', q.trim());
  }

  const response = await fetch(`${getApiBaseUrl()}/v1/calls?${params.toString()}`, {
    cache: 'no-store',
    headers: await getInternalApiHeaders()
  });

  if (!response.ok) {
    throw new Error(`Failed to load calls: ${response.status}`);
  }

  return (await response.json()) as CallsResponse;
}

async function getSummary() {
  const response = await fetch(`${getApiBaseUrl()}/v1/calls/summary`, {
    cache: 'no-store',
    headers: await getInternalApiHeaders()
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as CallsSummary;
}

export default async function CallsPage({
  searchParams
}: {
  searchParams: Promise<CallsSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const filter = resolveFilter(resolvedSearchParams.filter);
  const search = resolvedSearchParams.q?.trim() ?? '';
  const currentHref = buildCallsHref(filter, search);

  const [callsResponse, summary] = await Promise.all([getCalls(filter, search), getSummary()]);

  async function markContacted(formData: FormData) {
    'use server';

    const callSid = String(formData.get('callSid') ?? '').trim();

    if (!callSid) {
      redirect(currentHref);
    }

    const response = await fetch(`${getApiBaseUrl()}/v1/calls/${callSid}/mark-contacted`, {
      method: 'POST',
      headers: await getInternalApiHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to mark contacted: ${response.status}`);
    }

    revalidatePath('/calls');
    revalidatePath(`/calls/${callSid}`);
    redirect(currentHref);
  }

  async function archiveCall(formData: FormData) {
    'use server';

    const callSid = String(formData.get('callSid') ?? '').trim();

    if (!callSid) {
      redirect(currentHref);
    }

    const response = await fetch(`${getApiBaseUrl()}/v1/calls/${callSid}/archive`, {
      method: 'POST',
      headers: await getInternalApiHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to archive call: ${response.status}`);
    }

    revalidatePath('/calls');
    revalidatePath(`/calls/${callSid}`);
    redirect(currentHref);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-indigo-600">SkybridgeCX queue</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">Calls</h1>
            <p className="mt-2 text-sm text-gray-600">
              Review inbound conversations, prioritize urgent needs, and update outreach triage in one place.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-indigo-50"
          >
            Back to Dashboard
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-gray-500">Pending review</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900">{summary?.openCalls ?? 0}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Contacted</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900">{summary?.contactedCalls ?? 0}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Archived</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900">{summary?.archivedCalls ?? 0}</p>
        </Card>
      </section>

      <Card>
        <form action="/calls" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
          <SearchInput
            name="q"
            defaultValue={search}
            placeholder="Search by caller name or phone"
            aria-label="Search calls"
          />
          <div className="flex items-center gap-2">
            <input type="hidden" name="filter" value={filter} />
            <button
              type="submit"
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
            >
              Search
            </button>
            <Link
              href={buildCallsHref(filter, '')}
              className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-indigo-50"
            >
              Clear
            </Link>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {filterOptions.map((option) => {
            const active = option === filter;
            const label =
              option === 'all'
                ? 'All'
                : option === 'pending'
                  ? 'Pending Review'
                  : option === 'contacted'
                    ? 'Contacted'
                    : 'Archived';

            return (
              <Link
                key={option}
                href={buildCallsHref(option, search)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? 'bg-indigo-600 text-white'
                    : 'border border-gray-200 bg-white text-gray-600 hover:bg-indigo-50 hover:text-indigo-700'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </Card>

      <CallsQueueTable
        calls={callsResponse.calls}
        returnTo={currentHref}
        markContactedAction={markContacted}
        archiveAction={archiveCall}
      />

      <p className="text-sm text-gray-500">Showing {callsResponse.calls.length} results.</p>
    </div>
  );
}
