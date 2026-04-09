import type { Metadata } from 'next';
import Link from 'next/link';
import { getApiBaseUrl, getInternalApiHeaders } from '@/lib/api';
import { getCurrentTenant } from '@/lib/tenant';
import { Card } from '../components/card';
import { StatCard } from '../components/stat-card';
import { StatusBadge } from '../components/status-badge';

export const metadata: Metadata = {
  title: 'Dashboard | SkybridgeCX'
};

export const dynamic = 'force-dynamic';

type CallRow = {
  twilioCallSid: string;
  fromE164: string | null;
  leadName: string | null;
  urgency: string | null;
  triageStatus: string;
  startedAt: string;
  durationSeconds: number | null;
};

type CallsResponse = {
  ok: true;
  calls: CallRow[];
};

type CallsSummary = {
  ok: true;
  needsReviewCalls: number;
};

type ProspectSummaryResponse = {
  ok: true;
  summary: {
    new: number;
  };
};

async function getCalls() {
  const response = await fetch(`${getApiBaseUrl()}/v1/calls?limit=50&page=1`, {
    cache: 'no-store',
    headers: await getInternalApiHeaders()
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as CallsResponse;
}

async function getCallSummary() {
  const response = await fetch(`${getApiBaseUrl()}/v1/calls/summary`, {
    cache: 'no-store',
    headers: await getInternalApiHeaders()
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as CallsSummary;
}

async function getProspectSummary(businessId: string) {
  const response = await fetch(`${getApiBaseUrl()}/v1/businesses/${businessId}/prospects/summary`, {
    cache: 'no-store',
    headers: await getInternalApiHeaders()
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as ProspectSummaryResponse;
}

function isToday(value: string) {
  const date = new Date(value);
  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function formatDuration(seconds: number | null) {
  if (seconds === null) {
    return '0m';
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${String(remainder).padStart(2, '0')}s`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}

function AvgDuration({ seconds }: { seconds: number }) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;

  return (
    <>
      {minutes}m {String(remainder).padStart(2, '0')}s
    </>
  );
}

export default async function DashboardOverviewPage() {
  const [tenant, callsData, callSummary] = await Promise.all([getCurrentTenant(), getCalls(), getCallSummary()]);
  const businessId = tenant?.businesses[0]?.id ?? null;
  const prospectsSummary = businessId ? await getProspectSummary(businessId) : null;
  const calls = callsData?.calls ?? [];
  const callsToday = calls.filter((call) => isToday(call.startedAt));
  const callsWithDuration = callsToday.filter((call) => call.durationSeconds != null);
  const averageDurationSeconds =
    callsWithDuration.length > 0
      ? Math.round(
          callsWithDuration.reduce((sum, call) => sum + (call.durationSeconds ?? 0), 0) / callsWithDuration.length
        )
      : 0;
  const recentCalls = calls.slice(0, 5);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div>
          <p className="text-sm font-medium text-indigo-600">SkybridgeCX operations</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">Dashboard overview</h1>
          <p className="mt-2 text-sm text-gray-600">
            Monitor live call intake, lead throughput, and operator workload from one view.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
          <Link
            href="/calls"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 sm:w-auto"
          >
            View All Calls
          </Link>
          <Link
            href="/prospects"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-indigo-50 sm:w-auto"
          >
            View Prospects
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Total Calls Today"
          value={String(callsToday.length)}
          trend="Live"
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
              <path
                d="M6.5 4.5h2.8c.4 0 .8.3.9.7l.9 4.1c.1.4-.1.8-.4 1.1l-1.7 1.7a14.6 14.6 0 0 0 6 6l1.7-1.7c.3-.3.7-.5 1.1-.4l4.1.9c.4.1.7.5.7.9v2.8c0 .5-.4 1-1 1C11.2 22.5 1.5 12.8 1.5 5.5c0-.6.4-1 1-1Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          }
        />
        <StatCard
          label="New Leads Today"
          value={String(prospectsSummary?.summary.new ?? 0)}
          trend="Daily"
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
              <path
                d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 20a6 6 0 0 1 12 0"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          }
        />
        <StatCard
          label="Avg Call Duration"
          value={averageDurationSeconds > 0 ? `${Math.floor(averageDurationSeconds / 60)}m` : '0m'}
          trend="Today"
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
              <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
              <path d="M12 7.5v5l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          }
        />
        <StatCard
          label="Pending Review"
          value={String(callSummary?.needsReviewCalls ?? 0)}
          trend="Queue"
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
              <path
                d="M5 5h14v10H9l-4 4V5Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          }
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card title="Recent calls" subtitle="Latest 5 conversations captured by SkybridgeCX">
          {recentCalls.length === 0 ? (
            <p className="text-sm text-gray-600">No calls available yet.</p>
          ) : (
            <ul className="divide-y divide-gray-200">
              {recentCalls.map((call) => (
                <li key={call.twilioCallSid} className="flex flex-col gap-2 rounded-md py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <Link href={`/calls/${call.twilioCallSid}`} className="inline-flex min-h-11 items-center font-medium text-gray-900 hover:text-indigo-600">
                      {call.leadName ?? call.fromE164 ?? call.twilioCallSid}
                    </Link>
                    <div className="mt-1 text-sm text-gray-500">{formatTime(call.startedAt)}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge value={call.urgency ?? 'unknown'} type="urgency" fallback="Unknown" />
                    <StatusBadge value={call.triageStatus} type="triage" />
                    <span className="text-sm text-gray-500">{formatDuration(call.durationSeconds)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Quick actions" subtitle="Jump directly into daily operations">
          <div className="space-y-3">
            <Link
              href="/calls"
              className="block min-h-11 rounded-md border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 transition hover:border-indigo-200 hover:bg-indigo-50"
            >
              View All Calls
            </Link>
            <Link
              href="/prospects"
              className="block min-h-11 rounded-md border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 transition hover:border-indigo-200 hover:bg-indigo-50"
            >
              View Prospects
            </Link>
            <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
              Average call duration today:{' '}
              <span className="font-medium text-gray-900">
                <AvgDuration seconds={averageDurationSeconds} />
              </span>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
