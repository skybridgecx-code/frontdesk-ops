import type { Metadata } from 'next';
import Link from 'next/link';
import { currentUser } from '@clerk/nextjs/server';
import { getApiBaseUrl, getInternalApiHeaders } from '@/lib/api';
import { KpiCards } from '../components/analytics/kpi-cards';
import { CallVolumeChart } from '../components/analytics/call-volume-chart';
import { IntentChart } from '../components/analytics/intent-chart';
import { UrgencyChart } from '../components/analytics/urgency-chart';
import { PeakHoursChart } from '../components/analytics/peak-hours-chart';
import { RecentActivity } from '../components/analytics/recent-activity';
import { WebhookHealth } from '../components/analytics/webhook-health';
import { PeriodSelector } from '../components/analytics/period-selector';
import { StatusBadge } from '@/components/calls/status-badge';
import { StatusDot } from '@/components/calls/status-dot';
import { formatPhoneNumber, normalizeCallStatus, timeAgo } from '@/lib/call-utils';
import type {
  AnalyticsPeriod,
  CallVolumeData,
  IntentData,
  OverviewData,
  PeakHoursData,
  RecentActivityData,
  UrgencyData,
  WebhookHealthData
} from '../components/analytics/types';

export const metadata: Metadata = {
  title: 'Dashboard | SkybridgeCX'
};

export const dynamic = 'force-dynamic';

type SearchParams = {
  period?: string;
};

type ApiEnvelope = {
  ok: boolean;
};

type RecentCall = {
  id?: string;
  callSid?: string | null;
  twilioCallSid?: string;
  status?: string;
  callStatus?: string;
  callerName?: string | null;
  leadName?: string | null;
  callerPhone?: string | null;
  fromE164?: string | null;
  callReason?: string | null;
  leadIntent?: string | null;
  createdAt?: string;
  startedAt?: string;
};

type RecentCallsResponse = {
  ok: boolean;
  calls: RecentCall[];
};

function normalizePeriod(value: string | undefined): AnalyticsPeriod {
  if (value === '7d' || value === '30d' || value === '90d') {
    return value;
  }

  return '30d';
}

function formatDateRange(startDate: string, endDate: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return `${formatter.format(new Date(startDate))} - ${formatter.format(new Date(endDate))}`;
}

function greetingPrefix(hour: number) {
  if (hour < 12) {
    return 'Good morning';
  }

  if (hour < 18) {
    return 'Good afternoon';
  }

  return 'Good evening';
}

async function fetchAnalytics<T>(path: string): Promise<T | null> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    cache: 'no-store',
    headers: await getInternalApiHeaders()
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as ApiEnvelope & T;
  if (!payload.ok) {
    return null;
  }

  return payload;
}

async function fetchRecentCalls() {
  const response = await fetch(`${getApiBaseUrl()}/v1/calls?page=1&limit=5`, {
    cache: 'no-store',
    headers: await getInternalApiHeaders()
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as RecentCallsResponse;
  if (!payload.ok) {
    return null;
  }

  return payload.calls;
}

function getRecentCallId(call: RecentCall) {
  return call.callSid ?? call.twilioCallSid ?? call.id ?? '';
}

function getRecentCallName(call: RecentCall) {
  const callerName = call.callerName ?? call.leadName;
  if (callerName) {
    return callerName;
  }

  return formatPhoneNumber(call.callerPhone ?? call.fromE164 ?? null);
}

function getRecentCallReason(call: RecentCall) {
  return call.callReason ?? call.leadIntent ?? 'No reason captured';
}

function getRecentCallDate(call: RecentCall) {
  return call.createdAt ?? call.startedAt ?? new Date().toISOString();
}

function emptyOverview(period: AnalyticsPeriod): OverviewData {
  const now = new Date();
  const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  return {
    period,
    startDate: start.toISOString(),
    endDate: now.toISOString(),
    totalCalls: 0,
    answeredCalls: 0,
    missedCalls: 0,
    answerRate: 0,
    avgDurationSeconds: 0,
    totalLeadsExtracted: 0,
    leadConversionRate: 0,
    textBacksSent: 0,
    textBackRate: 0,
    comparedToPrevious: {
      totalCalls: { previous: 0, changePct: 0 },
      answeredCalls: { previous: 0, changePct: 0 },
      missedCalls: { previous: 0, changePct: 0 },
      answerRate: { previous: 0, changePct: 0 },
      avgDurationSeconds: { previous: 0, changePct: 0 },
      totalLeadsExtracted: { previous: 0, changePct: 0 },
      leadConversionRate: { previous: 0, changePct: 0 },
      textBacksSent: { previous: 0, changePct: 0 },
      textBackRate: { previous: 0, changePct: 0 }
    }
  };
}

function emptyCallVolume(period: AnalyticsPeriod): CallVolumeData {
  const now = new Date();

  return {
    period,
    startDate: now.toISOString(),
    endDate: now.toISOString(),
    granularity: 'day',
    data: []
  };
}

function emptyIntent(period: AnalyticsPeriod): IntentData {
  const now = new Date();
  return {
    period,
    startDate: now.toISOString(),
    endDate: now.toISOString(),
    data: []
  };
}

function emptyUrgency(period: AnalyticsPeriod): UrgencyData {
  const now = new Date();
  return {
    period,
    startDate: now.toISOString(),
    endDate: now.toISOString(),
    data: []
  };
}

function emptyPeakHours(period: AnalyticsPeriod): PeakHoursData {
  const now = new Date();
  return {
    period,
    startDate: now.toISOString(),
    endDate: now.toISOString(),
    data: Array.from({ length: 24 }, (_value, hour) => ({ hour, count: 0 }))
  };
}

function emptyRecent(period: AnalyticsPeriod): RecentActivityData {
  const now = new Date();
  return {
    period,
    startDate: now.toISOString(),
    endDate: now.toISOString(),
    data: []
  };
}

function emptyWebhookHealth(period: AnalyticsPeriod): WebhookHealthData {
  const now = new Date();
  return {
    period,
    startDate: now.toISOString(),
    endDate: now.toISOString(),
    available: false,
    totalDeliveries: 0,
    successfulDeliveries: 0,
    failedDeliveries: 0,
    successRate: 0
  };
}

export default async function AnalyticsDashboardPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const period = normalizePeriod(resolvedSearchParams.period);
  const user = await currentUser();

  const query = `?period=${period}`;

  const [overview, callVolume, intents, urgency, peakHours, recentActivity, webhookHealth, recentCalls] = await Promise.all([
    fetchAnalytics<OverviewData>(`/v1/analytics/overview${query}`),
    fetchAnalytics<CallVolumeData>(`/v1/analytics/call-volume${query}`),
    fetchAnalytics<IntentData>(`/v1/analytics/intents${query}`),
    fetchAnalytics<UrgencyData>(`/v1/analytics/urgency${query}`),
    fetchAnalytics<PeakHoursData>(`/v1/analytics/peak-hours${query}`),
    fetchAnalytics<RecentActivityData>(`/v1/analytics/recent-activity${query}`),
    fetchAnalytics<WebhookHealthData>(`/v1/analytics/webhook-health${query}`),
    fetchRecentCalls()
  ]);

  const safeOverview = overview ?? emptyOverview(period);
  const safeCallVolume = callVolume ?? emptyCallVolume(period);
  const safeIntents = intents ?? emptyIntent(period);
  const safeUrgency = urgency ?? emptyUrgency(period);
  const safePeakHours = peakHours ?? emptyPeakHours(period);
  const safeRecentActivity = recentActivity ?? emptyRecent(period);
  const safeWebhookHealth = webhookHealth ?? emptyWebhookHealth(period);
  const safeRecentCalls = recentCalls ?? [];

  const now = new Date();
  const name = user?.firstName ?? user?.username ?? 'Operator';
  const heading = `${greetingPrefix(now.getHours())}, ${name}`;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-cyan-600">Dashboard</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">{heading}</h1>
            <p className="mt-2 text-sm text-gray-600">{formatDateRange(safeOverview.startDate, safeOverview.endDate)}</p>
          </div>

          <PeriodSelector period={period} />
        </div>
      </section>

      <KpiCards overview={safeOverview} />

      {safeOverview.totalCalls === 0 ? (
        <section className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-cyan-50 text-cyan-700">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden="true">
              <path
                d="M6.5 4.5h2.8c.4 0 .8.3.9.7l.9 4.1c.1.4-.1.8-.4 1.1l-1.7 1.7a14.6 14.6 0 0 0 6 6l1.7-1.7c.3-.3.7-.5 1.1-.4l4.1.9c.4.1.7.5.7.9v2.8c0 .5-.4 1-1 1C11.2 22.5 1.5 12.8 1.5 5.5c0-.6.4-1 1-1Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900">No calls yet</h2>
          <p className="mt-2 text-sm text-gray-600">
            Once your AI receptionist starts taking calls, you&apos;ll see analytics here.
          </p>
          <div className="mt-5">
            <Link
              href="/setup/phone"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-indigo-600 px-5 text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
              Set up your phone number
            </Link>
          </div>
        </section>
      ) : (
        <>
          <CallVolumeChart data={safeCallVolume.data} />

          <section className="grid gap-6 xl:grid-cols-2">
            <IntentChart data={safeIntents.data} />
            <UrgencyChart data={safeUrgency.data} />
          </section>

          <PeakHoursChart data={safePeakHours.data} />

          <RecentActivity rows={safeRecentActivity.data} />

          <WebhookHealth health={safeWebhookHealth} />
        </>
      )}

      <div className="mt-8 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent Calls</h2>
          <Link href="/calls" className="text-sm text-blue-600 hover:text-blue-800">
            View all →
          </Link>
        </div>

        {safeRecentCalls.length > 0 ? (
          <div>
            {safeRecentCalls.map((call) => {
              const status = normalizeCallStatus(call.callStatus ?? call.status);
              const detailId = getRecentCallId(call);
              const rowDate = getRecentCallDate(call);

              return (
                <Link
                  key={`${detailId}-${rowDate}`}
                  href={detailId ? `/calls/${detailId}` : '/calls'}
                  className="flex items-center justify-between py-3 border-b last:border-0 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <StatusDot status={status} />
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{getRecentCallName(call)}</p>
                      <p className="text-xs text-gray-500">{getRecentCallReason(call)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">{timeAgo(rowDate)}</p>
                    <StatusBadge status={status} size="sm" />
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-400 text-sm py-8 text-center">
            No calls yet. They&apos;ll show up here once your AI receptionist takes its first call.
          </p>
        )}
      </div>
    </div>
  );
}
