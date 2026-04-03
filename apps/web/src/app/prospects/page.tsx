import Link from 'next/link';
import { getApiBaseUrl, getInternalApiHeaders } from '@/lib/api';

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
  createdAt: string;
  updatedAt: string;
};

type ProspectsResponse = {
  ok: true;
  prospects: ProspectRow[];
};

type ProspectSummary = {
  total: number;
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

async function getProspects(businessId: string) {
  const res = await fetch(`${getApiBaseUrl()}/v1/businesses/${businessId}/prospects`, {
    cache: 'no-store',
    headers: getInternalApiHeaders()
  });

  if (!res.ok) {
    throw new Error(`Failed to load prospects: ${res.status}`);
  }

  return (await res.json()) as ProspectsResponse;
}

async function getProspectSummary(businessId: string) {
  const res = await fetch(`${getApiBaseUrl()}/v1/businesses/${businessId}/prospects/summary`, {
    cache: 'no-store',
    headers: getInternalApiHeaders()
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
  value
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-[0.2em] text-black/50">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-black">{value}</div>
    </div>
  );
}

export default async function ProspectsPage() {
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
    getProspects(activeBusiness.id)
  ]);

  const summary = summaryResponse.summary;
  const prospects = prospectsResponse.prospects;

  return (
    <main className="min-h-screen bg-[#f7f6f2] px-6 py-10 text-[#111827]">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-sm uppercase tracking-[0.24em] text-black/50">Operator view</div>
            <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em]">Prospects</h1>
            <p className="mt-2 text-sm text-black/60">
              Active business: <span className="font-medium text-black">{activeBusiness.name}</span>
            </p>
          </div>

          <Link
            href="/"
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black shadow-sm"
          >
            Back to homepage
          </Link>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Total" value={summary.total} />
          <SummaryCard label="New" value={summary.new} />
          <SummaryCard label="Ready" value={summary.ready} />
          <SummaryCard label="In progress" value={summary.inProgress} />
          <SummaryCard label="Attempted" value={summary.attempted} />
          <SummaryCard label="Responded" value={summary.responded} />
          <SummaryCard label="Qualified" value={summary.qualified} />
          <SummaryCard label="Archived" value={summary.archived} />
        </section>

        <section className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
          <div className="border-b border-black/10 px-5 py-4">
            <h2 className="text-lg font-semibold tracking-[-0.02em]">Lead queue</h2>
            <p className="mt-1 text-sm text-black/60">
              Read-only visibility into captured prospects.
            </p>
          </div>

          {prospects.length === 0 ? (
            <div className="px-5 py-10 text-sm text-black/60">No prospects found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-black/[0.03] text-black/60">
                  <tr>
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-5 py-3 font-medium">Phone</th>
                    <th className="px-5 py-3 font-medium">Company</th>
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
                          href={`/prospects/${prospect.prospectSid}`}
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
