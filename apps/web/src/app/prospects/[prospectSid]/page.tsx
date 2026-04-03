import Link from 'next/link';
import { notFound } from 'next/navigation';
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

function formatDateTime(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(new Date(value))
    : '—';
}

function formatLabel(value: string | null | undefined) {
  if (!value) return '—';
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
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

export default async function ProspectDetailPage({
  params
}: {
  params: Promise<{ prospectSid: string }>;
}) {
  const { prospectSid } = await params;
  const bootstrap = await getBootstrap();
  const activeBusiness = bootstrap?.tenant?.businesses[0] ?? null;

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
            href="/prospects"
            className="mt-6 inline-flex rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black shadow-sm"
          >
            Back to prospects
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
            href="/prospects"
            className="mt-6 inline-flex rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black shadow-sm"
          >
            Back to prospects
          </Link>
        </div>
      </main>
    );
  }

  const attemptsResponse = await getAttempts(activeBusiness.id, prospectSid);
  const prospect = detailResponse.prospect;
  const attempts = attemptsResponse.attempts;
  const title = prospect.contactName || prospect.companyName || prospect.prospectSid;
  const metadataLine = [prospect.prospectSid, activeBusiness.name].filter(Boolean).join(' • ');

  return (
    <main className="min-h-screen bg-[#f7f6f2] px-6 py-10 text-[#111827]">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/prospects" className="text-sm font-medium text-[#6b7280] transition hover:text-[#111827]">
              ← Back to prospects
            </Link>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">{title}</h1>
            <p className="mt-2 text-sm text-black/60">{metadataLine}</p>
          </div>
        </div>

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
