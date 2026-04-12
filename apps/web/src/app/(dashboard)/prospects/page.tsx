import type { Metadata } from 'next';
import { getApiBaseUrl, getInternalApiHeaders } from '@/lib/api';
import { getCurrentTenant } from '@/lib/tenant';
import { Card } from '../components/card';
import { EmptyState } from '../components/empty-state';
import { SearchInput } from '../components/search-input';
import { ProspectsTable } from './prospects-table';

export const metadata: Metadata = {
  title: 'Prospects | SkybridgeCX'
};

export const dynamic = 'force-dynamic';

type ProspectRow = {
  prospectSid: string;
  companyName: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  status: string;
  priority: string | null;
  updatedAt: string;
};

type ProspectsApiResponse = {
  ok: true;
  prospects: ProspectRow[];
};

type ProspectsFetchResult =
  | {
      ok: true;
      prospects: ProspectRow[];
    }
  | {
      ok: false;
      status: number;
      message: string;
    };

type ProspectSearchParams = {
  q?: string;
  status?: string;
};

const pipelineStatuses = ['new', 'contacted', 'qualified', 'proposal_sent', 'won', 'lost'] as const;

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

function matchesSearch(prospect: ProspectRow, search: string) {
  if (!search) {
    return true;
  }

  const haystack = [
    prospect.companyName,
    prospect.contactName,
    prospect.contactPhone,
    prospect.contactEmail,
    prospect.status
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(search);
}

function buildProspectsHref(status: string, q: string) {
  const params = new URLSearchParams();

  if (status && status !== 'all') {
    params.set('status', status);
  }

  if (q.trim()) {
    params.set('q', q.trim());
  }

  const query = params.toString();
  return query ? `/prospects?${query}` : '/prospects';
}

async function getProspects(businessId: string): Promise<ProspectsFetchResult> {
  let response: Response;

  try {
    response = await fetch(`${getApiBaseUrl()}/v1/businesses/${businessId}/prospects?limit=200`, {
      cache: 'no-store',
      headers: await getInternalApiHeaders()
    });
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'Could not reach the API. Please try again.'
    };
  }

  if (!response.ok) {
    if (response.status === 403) {
      return {
        ok: false,
        status: 403,
        message: 'Active subscription required to access prospects.'
      };
    }

    return {
      ok: false,
      status: response.status,
      message: `Failed to load prospects (${response.status}).`
    };
  }

  try {
    const data = (await response.json()) as ProspectsApiResponse;

    if (!Array.isArray(data.prospects)) {
      return {
        ok: false,
        status: 500,
        message: 'Prospects response was malformed.'
      };
    }

    return {
      ok: true,
      prospects: data.prospects
    };
  } catch {
    return {
      ok: false,
      status: 500,
      message: 'Could not parse prospects response.'
    };
  }
}

function getPipelineCount(prospects: ProspectRow[], status: (typeof pipelineStatuses)[number]) {
  return prospects.filter((prospect) => {
    const normalizedStatus = normalizeText(prospect.status);

    if (status === 'contacted') {
      return normalizedStatus === 'contacted' || normalizedStatus === 'responded';
    }

    if (status === 'proposal_sent') {
      return normalizedStatus === 'proposal_sent' || normalizedStatus === 'in_progress';
    }

    if (status === 'won') {
      return normalizedStatus === 'won';
    }

    if (status === 'lost') {
      return normalizedStatus === 'lost' || normalizedStatus === 'disqualified';
    }

    return normalizedStatus === status;
  }).length;
}

export default async function ProspectsPage({
  searchParams
}: {
  searchParams: Promise<ProspectSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const search = normalizeText(resolvedSearchParams.q);
  const statusFilter = normalizeText(resolvedSearchParams.status) || 'all';
  const tenant = await getCurrentTenant();
  const activeBusiness = tenant?.businesses[0] ?? null;

  if (!activeBusiness) {
    return (
      <EmptyState
        title="No active business configured"
        description="Prospects are unavailable until an active business is configured for SkybridgeCX."
      />
    );
  }

  const prospectsResponse = await getProspects(activeBusiness.id);

  if (!prospectsResponse.ok) {
    if (prospectsResponse.status === 403) {
      return (
        <EmptyState
          title="Subscription required"
          description="Active subscription required to access prospects."
          actionLabel="Go to billing"
          actionHref="/billing?notice=subscription-required"
        />
      );
    }

    return (
      <EmptyState
        title="Could not load prospects"
        description={prospectsResponse.message}
        actionLabel="Try again"
        actionHref={buildProspectsHref(statusFilter, search)}
      />
    );
  }

  const allProspects = prospectsResponse.prospects;
  const filteredProspects = allProspects.filter((prospect) => {
    const normalizedStatus = normalizeText(prospect.status);
    const statusMatches = statusFilter === 'all' || normalizedStatus === statusFilter;

    return statusMatches && matchesSearch(prospect, search);
  });

  const statusOptions = ['all', ...Array.from(new Set(allProspects.map((prospect) => normalizeText(prospect.status))))]
    .filter((value) => value.length > 0)
    .sort();

  if (!statusOptions.includes(statusFilter)) {
    statusOptions.unshift(statusFilter);
  }

  const returnTo = buildProspectsHref(statusFilter, search);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">Prospects</h1>
        <p className="mt-2 text-sm text-gray-600">
          Manage the SkybridgeCX lead pipeline, prioritize high-value accounts, and track latest outreach progress.
        </p>
      </section>

      <Card title="Pipeline summary" subtitle="Current pipeline stages from active records.">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          {pipelineStatuses.map((status) => (
            <div key={status} className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3">
              <p className="text-sm uppercase tracking-wide text-gray-500 sm:text-xs">{status.replaceAll('_', ' ')}</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">{getPipelineCount(allProspects, status)}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <form action="/prospects" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_auto]">
          <SearchInput
            name="q"
            defaultValue={resolvedSearchParams.q ?? ''}
            placeholder="Search by company, contact, phone, or email"
            aria-label="Search prospects"
          />

          <select
            name="status"
            defaultValue={statusFilter}
            className="min-h-11 rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          >
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {option === 'all'
                  ? 'All statuses'
                  : option
                      .split('_')
                      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                      .join(' ')}
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="min-h-11 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
          >
            Apply
          </button>
        </form>
      </Card>

      {filteredProspects.length === 0 ? (
        <EmptyState
          title="No prospects yet"
          description="No prospects yet. Import prospects via CSV or they will be created automatically from qualified calls."
          actionLabel="Refresh queue"
          actionHref={returnTo}
        />
      ) : (
        <ProspectsTable prospects={filteredProspects} returnTo={returnTo} />
      )}
    </div>
  );
}
