import type { Metadata } from 'next';
import Link from 'next/link';
import { currentUser } from '@clerk/nextjs/server';
import { getApiBaseUrl, getInternalApiHeaders } from '@/lib/api';
import { getCurrentTenant, getOnboardingStatus } from '@/lib/tenant';
import { formatPhoneNumber, normalizeCallStatus, timeAgo } from '@/lib/call-utils';
import type { AnalyticsPeriod, OverviewData, WebhookHealthData } from '../components/analytics/types';

export const metadata: Metadata = {
  title: 'Command Center | SkyBridgeCX'
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
  routeKind?: string | null;
  triageStatus?: string | null;
  reviewStatus?: string | null;
  callerName?: string | null;
  leadName?: string | null;
  callerPhone?: string | null;
  fromE164?: string | null;
  callReason?: string | null;
  leadIntent?: string | null;
  urgency?: string | null;
  serviceAddress?: string | null;
  summary?: string | null;
  durationSeconds?: number | null;
  textBackSent?: boolean;
  createdAt?: string;
  startedAt?: string;
  endedAt?: string | null;
  completedAt?: string | null;
  voiceHandling?: {
    fallbackUsed?: boolean;
    textBackOutcome?: string | null;
    textBackSkippedReason?: string | null;
  };
  phoneNumber?: {
    e164?: string | null;
    label?: string | null;
  };
  agentProfile?: {
    name?: string | null;
    voiceName?: string | null;
  } | null;
};

type CallsResponse = {
  ok: boolean;
  calls: RecentCall[];
  total?: number;
};

type ProspectRow = {
  prospectSid: string;
  companyName: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  city?: string | null;
  state?: string | null;
  serviceInterest?: string | null;
  sourceLabel?: string | null;
  status: string;
  priority: string | null;
  nextActionAt?: string | null;
  lastAttemptAt?: string | null;
  createdAt?: string;
  updatedAt: string;
};

type ProspectsResponse = {
  ok: boolean;
  prospects: ProspectRow[];
};

type BusinessProfile = {
  id: string;
  name: string;
  legalName?: string | null;
  vertical?: string | null;
  websiteUrl?: string | null;
  timezone?: string | null;
  phoneNumbers?: Array<{
    id: string;
    e164: string;
    label: string | null;
    isActive: boolean;
    routingMode: string;
    enableMissedCallTextBack: boolean;
    primaryAgentProfile?: {
      id: string;
      name: string;
      voiceName: string | null;
      isActive: boolean;
    } | null;
    afterHoursAgentProfile?: {
      id: string;
      name: string;
      voiceName: string | null;
      isActive: boolean;
    } | null;
  }>;
  agentProfiles?: Array<{
    id: string;
    name: string;
    channel: string;
    language: string;
    voiceName: string | null;
    missedCallTextBackMessage?: string | null;
    isActive: boolean;
  }>;
  businessHours?: Array<{
    id: string;
    weekday: string;
    openTime: string | null;
    closeTime: string | null;
    isClosed: boolean;
  }>;
  serviceAreas?: Array<{
    id: string;
    label: string;
    city: string | null;
    state: string | null;
    postalCode: string | null;
  }>;
  locations?: Array<{
    id: string;
    name: string;
    city: string | null;
    state: string | null;
    isPrimary: boolean;
  }>;
};

type BusinessResponse = {
  ok: boolean;
  business: BusinessProfile;
};

type BillingStatusResponse = {
  status: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  trialExpired?: boolean;
  trialEndedAt?: string | null;
};

type OnboardingDetailResponse = {
  onboardingStep?: number;
  onboardingComplete?: boolean;
  isOnboardingComplete?: boolean;
  hasSubscription?: boolean;
  hasBusinesses?: boolean;
  hasPhoneNumbers?: boolean;
  tenantName?: string;
  steps?: {
    businessInfo?: {
      complete?: boolean;
      data?: {
        businessName?: string | null;
        industry?: string | null;
        businessAddress?: string | null;
        businessPhone?: string | null;
        timezone?: string | null;
      };
    };
    greeting?: {
      complete?: boolean;
      data?: {
        greeting?: string | null;
        language?: string | null;
      };
    };
    phoneNumber?: {
      complete?: boolean;
      data?: {
        twilioPhoneNumber?: string | null;
      };
    };
    billing?: {
      complete?: boolean;
      data?: {
        plan?: string | null;
        subscriptionStatus?: string | null;
      };
    };
  };
};

type FetchResult<T> = {
  data: T | null;
  unavailable: boolean;
};

function normalizePeriod(value: string | undefined): AnalyticsPeriod {
  if (value === '7d' || value === '30d' || value === '90d') {
    return value;
  }

  return '30d';
}

function getPeriodStart(period: AnalyticsPeriod) {
  const now = new Date();
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function emptyOverview(period: AnalyticsPeriod): OverviewData {
  const now = new Date();
  const start = getPeriodStart(period);

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

async function fetchApi<T>(path: string): Promise<FetchResult<T>> {
  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      cache: 'no-store',
      headers: await getInternalApiHeaders()
    });

    if (!response.ok) {
      return { data: null, unavailable: true };
    }

    const payload = (await response.json()) as ApiEnvelope & T;
    if ('ok' in payload && payload.ok === false) {
      return { data: null, unavailable: true };
    }

    return { data: payload, unavailable: false };
  } catch {
    return { data: null, unavailable: true };
  }
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
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatPercent(value: number | null | undefined) {
  const numberValue = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return `${Math.round(numberValue)}%`;
}

function formatDuration(seconds: number | null | undefined) {
  if (!seconds || seconds < 1) return '—';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

function titleCase(value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized) return 'Not set';
  return normalized
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function compactList(values: Array<string | null | undefined>, fallback: string) {
  const filtered = values.map((value) => value?.trim()).filter((value): value is string => Boolean(value));
  if (filtered.length === 0) return fallback;
  if (filtered.length <= 2) return filtered.join(', ');
  return `${filtered.slice(0, 2).join(', ')} +${filtered.length - 2}`;
}

function getCallId(call: RecentCall) {
  return call.callSid ?? call.twilioCallSid ?? call.id ?? '';
}

function getCallName(call: RecentCall) {
  return call.callerName ?? call.leadName ?? formatPhoneNumber(call.callerPhone ?? call.fromE164 ?? null);
}

function getCallReason(call: RecentCall) {
  return call.callReason ?? call.leadIntent ?? call.summary ?? 'No reason captured yet';
}

function getCallDate(call: RecentCall) {
  return call.createdAt ?? call.startedAt ?? new Date().toISOString();
}

function getProspectDisplayName(prospect: ProspectRow) {
  return prospect.companyName ?? prospect.contactName ?? prospect.contactPhone ?? 'New prospect';
}

function getProspectSubtitle(prospect: ProspectRow) {
  const location = [prospect.city, prospect.state].filter(Boolean).join(', ');
  const contact = prospect.contactName ?? prospect.contactPhone ?? prospect.contactEmail;
  return [contact, location].filter(Boolean).join(' · ') || 'Lead details pending';
}

function isHighUrgency(call: RecentCall) {
  const urgency = call.urgency?.toLowerCase();
  return urgency === 'high' || urgency === 'emergency';
}

function isMissedCall(call: RecentCall) {
  const status = normalizeCallStatus(call.callStatus ?? call.status);
  return status === 'missed' || status === 'voicemail';
}

function isNewProspect(prospect: ProspectRow) {
  return prospect.status?.toLowerCase() === 'new';
}

function isDueProspect(prospect: ProspectRow) {
  if (!prospect.nextActionAt) return false;
  return new Date(prospect.nextActionAt).getTime() <= Date.now();
}

function statusTone(value: string | null | undefined) {
  const normalized = value?.toLowerCase() ?? '';
  if (['active', 'completed', 'answered', 'reviewed', 'won', 'qualified', 'contacted', 'sent'].includes(normalized)) {
    return 'emerald';
  }
  if (['past_due', 'trialing', 'pending', 'needs_review', 'open', 'medium'].includes(normalized)) {
    return 'amber';
  }
  if (['missed', 'voicemail', 'failed', 'emergency', 'high', 'lost', 'unpaid'].includes(normalized)) {
    return 'rose';
  }
  return 'slate';
}

function buildSetupChecklist(input: {
  billingStatus: BillingStatusResponse | null;
  onboardingDetail: OnboardingDetailResponse | null;
  business: BusinessProfile | null;
}) {
  const activePhones = input.business?.phoneNumbers?.filter((phone) => phone.isActive) ?? [];
  const activeAgents = input.business?.agentProfiles?.filter((profile) => profile.isActive && profile.channel === 'VOICE') ?? [];
  const hasBusinessProfile = Boolean(input.business?.name || input.onboardingDetail?.steps?.businessInfo?.complete);
  const hasBusinessHours = Boolean(input.business?.businessHours?.length);
  const hasServiceAreas = Boolean(input.business?.serviceAreas?.length);
  const billingStatus = input.billingStatus?.status?.toLowerCase() ?? input.onboardingDetail?.steps?.billing?.data?.subscriptionStatus?.toLowerCase() ?? 'none';
  const billingActive = ['active', 'trialing', 'past_due'].includes(billingStatus);

  return [
    {
      key: 'billing',
      label: 'Billing active',
      description: billingActive ? titleCase(billingStatus) : 'Subscription required',
      complete: billingActive,
      href: '/billing'
    },
    {
      key: 'business',
      label: 'Business profile',
      description: input.business?.name ?? input.onboardingDetail?.steps?.businessInfo?.data?.businessName ?? 'Add company details',
      complete: hasBusinessProfile,
      href: '/settings'
    },
    {
      key: 'phone',
      label: 'Phone number connected',
      description: activePhones[0]?.e164 ? formatPhoneNumber(activePhones[0].e164) : 'Connect a line for the AI front desk',
      complete: activePhones.length > 0 || input.onboardingDetail?.steps?.phoneNumber?.complete === true,
      href: '/setup/phone'
    },
    {
      key: 'voice',
      label: 'Voice agent ready',
      description: activeAgents[0]?.voiceName ?? activeAgents[0]?.name ?? 'Choose voice and greeting',
      complete: activeAgents.length > 0,
      href: '/settings'
    },
    {
      key: 'hours',
      label: 'Business hours',
      description: hasBusinessHours ? `${input.business?.businessHours?.length ?? 0} day rules configured` : 'Set normal and after-hours behavior',
      complete: hasBusinessHours,
      href: '/settings'
    },
    {
      key: 'areas',
      label: 'Service areas',
      description: hasServiceAreas
        ? compactList(input.business?.serviceAreas?.map((area) => area.label) ?? [], 'Configured')
        : 'Add cities and zip codes you serve',
      complete: hasServiceAreas,
      href: '/settings'
    }
  ];
}

function buildActionQueue(input: {
  checklist: ReturnType<typeof buildSetupChecklist>;
  calls: RecentCall[];
  prospects: ProspectRow[];
  analyticsUnavailable: boolean;
  businessUnavailable: boolean;
}) {
  const actions: Array<{
    label: string;
    description: string;
    href: string;
    priority: 'critical' | 'high' | 'normal';
  }> = [];

  for (const item of input.checklist.filter((entry) => !entry.complete).slice(0, 3)) {
    actions.push({
      label: item.label,
      description: item.description,
      href: item.href,
      priority: item.key === 'billing' || item.key === 'phone' ? 'critical' : 'high'
    });
  }

  const urgentCalls = input.calls.filter(isHighUrgency);
  if (urgentCalls.length > 0) {
    actions.push({
      label: `Review ${urgentCalls.length} urgent call${urgentCalls.length === 1 ? '' : 's'}`,
      description: 'High-priority calls need owner review or callback.',
      href: '/calls?urgency=high',
      priority: 'critical'
    });
  }

  const missedCalls = input.calls.filter(isMissedCall);
  if (missedCalls.length > 0) {
    actions.push({
      label: `Return ${missedCalls.length} missed call${missedCalls.length === 1 ? '' : 's'}`,
      description: 'Use summaries and transcripts to follow up quickly.',
      href: '/calls?triageStatus=OPEN',
      priority: 'high'
    });
  }

  const dueProspects = input.prospects.filter((prospect) => isNewProspect(prospect) || isDueProspect(prospect));
  if (dueProspects.length > 0) {
    actions.push({
      label: `Work ${dueProspects.length} prospect${dueProspects.length === 1 ? '' : 's'}`,
      description: 'Captured leads are waiting for next action.',
      href: '/prospects?status=new',
      priority: 'normal'
    });
  }

  if (input.analyticsUnavailable || input.businessUnavailable) {
    actions.push({
      label: 'Check dashboard connection',
      description: 'Some live data could not be loaded from the API.',
      href: '/dashboard',
      priority: 'normal'
    });
  }

  if (actions.length === 0) {
    actions.push({
      label: 'Your command center is ready',
      description: 'No urgent setup or follow-up items are waiting right now.',
      href: '/calls',
      priority: 'normal'
    });
  }

  return actions.slice(0, 6);
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function Badge({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'slate' | 'violet' }) {
  const toneClasses = {
    cyan: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200',
    emerald: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
    amber: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
    rose: 'border-rose-400/20 bg-rose-400/10 text-rose-200',
    slate: 'border-white/10 bg-white/[0.04] text-[#8aa0b8]',
    violet: 'border-violet-400/20 bg-violet-400/10 text-violet-200'
  } satisfies Record<string, string>;

  return <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold', toneClasses[tone])}>{children}</span>;
}

function Panel({
  children,
  className,
  title,
  subtitle,
  action
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        'rounded-[1.35rem] border border-white/10 bg-[#0d1320]/88 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur',
        className
      )}
    >
      {title || subtitle || action ? (
        <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div>
            {title ? <h2 className="text-base font-semibold tracking-tight text-[#f0f4f8] sm:text-lg">{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-sm leading-6 text-[#8aa0b8]">{subtitle}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

function CommandMetric({
  label,
  value,
  detail,
  tone = 'cyan'
}: {
  label: string;
  value: string;
  detail: string;
  tone?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'violet';
}) {
  const toneClasses = {
    cyan: 'from-cyan-400/20 text-cyan-200 ring-cyan-400/20',
    emerald: 'from-emerald-400/20 text-emerald-200 ring-emerald-400/20',
    amber: 'from-amber-400/20 text-amber-200 ring-amber-400/20',
    rose: 'from-rose-400/20 text-rose-200 ring-rose-400/20',
    violet: 'from-violet-400/20 text-violet-200 ring-violet-400/20'
  } satisfies Record<string, string>;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className={cn('absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br to-transparent blur-2xl', toneClasses[tone].split(' ')[0])} />
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#5a6a80]">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-3xl font-semibold tracking-[-0.05em] text-[#f0f4f8] sm:text-4xl">{value}</p>
        <span className={cn('rounded-full px-2 py-1 text-xs font-semibold ring-1', toneClasses[tone])}>{detail}</span>
      </div>
    </div>
  );
}

function ReadinessRing({ score }: { score: number }) {
  const safeScore = Math.max(0, Math.min(100, score));

  return (
    <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-[conic-gradient(#00d4ff_var(--score),rgba(255,255,255,0.08)_0)] p-2 [--score:0%]" style={{ '--score': `${safeScore}%` } as React.CSSProperties}>
      <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[#080c12] text-center ring-1 ring-white/10">
        <span className="text-2xl font-semibold tracking-tight text-[#f0f4f8]">{safeScore}%</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5a6a80]">ready</span>
      </div>
    </div>
  );
}

function EmptyCommandState({ title, description, href, actionLabel }: { title: string; description: string; href: string; actionLabel: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.035] p-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200 ring-1 ring-cyan-400/20">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="mt-4 text-base font-semibold text-[#f0f4f8]">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#8aa0b8]">{description}</p>
      <Link href={href} className="mt-5 inline-flex min-h-10 items-center justify-center rounded-xl bg-cyan-400 px-4 text-sm font-semibold text-[#020305] transition hover:bg-cyan-300">
        {actionLabel}
      </Link>
    </div>
  );
}

function ToneBadge({ value }: { value: string | null | undefined }) {
  const tone = statusTone(value);
  const mappedTone = tone === 'emerald' ? 'emerald' : tone === 'amber' ? 'amber' : tone === 'rose' ? 'rose' : 'slate';
  return <Badge tone={mappedTone}>{titleCase(value)}</Badge>;
}

export default async function SkybridgeCommandCenterPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const period = normalizePeriod(resolvedSearchParams.period);
  const periodQuery = `?period=${period}`;
  const user = await currentUser();

  const [tenant, onboardingStatus, overviewResult, webhookHealthResult, callsResult, onboardingDetailResult] = await Promise.all([
    getCurrentTenant(),
    getOnboardingStatus(),
    fetchApi<OverviewData>(`/v1/analytics/overview${periodQuery}`),
    fetchApi<WebhookHealthData>(`/v1/analytics/webhook-health${periodQuery}`),
    fetchApi<CallsResponse>('/v1/calls?page=1&limit=8'),
    fetchApi<OnboardingDetailResponse>('/v1/onboarding/status')
  ]);

  const activeBusiness = tenant?.businesses[0] ?? null;

  const [businessResult, prospectsResult, billingResult] = await Promise.all([
    activeBusiness ? fetchApi<BusinessResponse>(`/v1/businesses/${activeBusiness.id}`) : Promise.resolve({ data: null, unavailable: false } satisfies FetchResult<BusinessResponse>),
    activeBusiness
      ? fetchApi<ProspectsResponse>(`/v1/businesses/${activeBusiness.id}/prospects?limit=8`)
      : Promise.resolve({ data: null, unavailable: false } satisfies FetchResult<ProspectsResponse>),
    tenant ? fetchApi<BillingStatusResponse>(`/v1/billing/status/${tenant.id}`) : Promise.resolve({ data: null, unavailable: false } satisfies FetchResult<BillingStatusResponse>)
  ]);

  const safeOverview = overviewResult.data ?? emptyOverview(period);
  const safeWebhookHealth = webhookHealthResult.data ?? emptyWebhookHealth(period);
  const recentCalls = callsResult.data?.calls ?? [];
  const recentProspects = prospectsResult.data?.prospects ?? [];
  const business = businessResult.data?.business ?? null;
  const onboardingDetail = onboardingDetailResult.data ?? null;
  const billingStatus = billingResult.data ?? null;

  const activePhones = business?.phoneNumbers?.filter((phone) => phone.isActive) ?? [];
  const activeAgents = business?.agentProfiles?.filter((agent) => agent.isActive && agent.channel === 'VOICE') ?? [];
  const primaryPhone = activePhones[0] ?? null;
  const primaryAgent = activeAgents[0] ?? primaryPhone?.primaryAgentProfile ?? null;
  const checklist = buildSetupChecklist({ billingStatus, onboardingDetail, business });
  const readinessScore = Math.round((checklist.filter((item) => item.complete).length / checklist.length) * 100);
  const actions = buildActionQueue({
    checklist,
    calls: recentCalls,
    prospects: recentProspects,
    analyticsUnavailable: overviewResult.unavailable,
    businessUnavailable: businessResult.unavailable
  });

  const urgentCalls = recentCalls.filter(isHighUrgency);
  const missedCalls = recentCalls.filter(isMissedCall);
  const newProspects = recentProspects.filter(isNewProspect);
  const dueProspects = recentProspects.filter(isDueProspect);
  const liveStatus = readinessScore >= 85 ? 'Live and ready' : readinessScore >= 50 ? 'Setup in progress' : 'Needs setup';
  const businessName = business?.name ?? onboardingDetail?.steps?.businessInfo?.data?.businessName ?? tenant?.name ?? onboardingStatus?.tenantName ?? 'your business';
  const operatorName = user?.firstName ?? user?.username ?? 'Operator';
  const heading = `${greetingPrefix(new Date().getHours())}, ${operatorName}`;

  return (
    <div className="space-y-6 text-[#f0f4f8]">
      <section className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#080c12] p-5 shadow-[0_32px_110px_rgba(0,0,0,0.34)] sm:p-7 lg:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(0,212,255,0.18),transparent_28%),radial-gradient(circle_at_80%_0%,rgba(99,102,241,0.18),transparent_30%),linear-gradient(135deg,rgba(13,19,32,0.9),rgba(8,12,18,0.96))]" />
        <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative grid gap-7 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="cyan">AI front desk command center</Badge>
              <Badge tone={readinessScore >= 85 ? 'emerald' : readinessScore >= 50 ? 'amber' : 'rose'}>{liveStatus}</Badge>
            </div>
            <h1 className="mt-5 max-w-4xl text-3xl font-semibold tracking-[-0.06em] text-white sm:text-5xl lg:text-6xl">
              {heading}. Your AI receptionist is the front door for {businessName}.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-[#a7bad0] sm:text-lg">
              Track calls, captured leads, missed-call recovery, setup health, and owner actions from one premium control center. Every number below comes from live tenant data or shows an empty state.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/calls" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-cyan-400 px-5 text-sm font-semibold text-[#020305] shadow-[0_18px_50px_rgba(0,212,255,0.22)] transition hover:bg-cyan-300">
                Review calls
              </Link>
              <Link href="/prospects" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] px-5 text-sm font-semibold text-[#f0f4f8] transition hover:bg-white/[0.09]">
                Open lead pipeline
              </Link>
              <Link href="/setup/phone" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] px-5 text-sm font-semibold text-[#f0f4f8] transition hover:bg-white/[0.09]">
                Phone setup
              </Link>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.05] p-5 backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <ReadinessRing score={readinessScore} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">AI front desk status</p>
                <p className="mt-2 text-sm leading-6 text-[#8aa0b8]">
                  {primaryPhone ? `${formatPhoneNumber(primaryPhone.e164)} is connected.` : 'No active phone number is connected yet.'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ToneBadge value={billingStatus?.status ?? onboardingDetail?.steps?.billing?.data?.subscriptionStatus ?? 'none'} />
                  <Badge tone={primaryAgent ? 'emerald' : 'amber'}>{primaryAgent ? 'Voice ready' : 'Voice pending'}</Badge>
                </div>
              </div>
            </div>
            <div className="mt-5 grid gap-2 text-sm">
              <div className="flex items-center justify-between rounded-2xl bg-white/[0.045] px-3 py-2.5">
                <span className="text-[#8aa0b8]">Business</span>
                <span className="max-w-[11rem] truncate font-semibold text-white">{businessName}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-white/[0.045] px-3 py-2.5">
                <span className="text-[#8aa0b8]">Language</span>
                <span className="font-semibold text-white">{titleCase(onboardingDetail?.steps?.greeting?.data?.language ?? activeAgents[0]?.language)}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-white/[0.045] px-3 py-2.5">
                <span className="text-[#8aa0b8]">Service areas</span>
                <span className="font-semibold text-white">{business?.serviceAreas?.length ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <CommandMetric label="Calls" value={String(safeOverview.totalCalls)} detail={period} tone="cyan" />
        <CommandMetric label="Answered" value={String(safeOverview.answeredCalls)} detail={formatPercent(safeOverview.answerRate)} tone="emerald" />
        <CommandMetric label="Missed" value={String(safeOverview.missedCalls)} detail={`${missedCalls.length} recent`} tone={safeOverview.missedCalls > 0 ? 'rose' : 'emerald'} />
        <CommandMetric label="Leads captured" value={String(safeOverview.totalLeadsExtracted || recentProspects.length)} detail={`${newProspects.length} new`} tone="violet" />
        <CommandMetric label="Urgent queue" value={String(urgentCalls.length)} detail="recent" tone={urgentCalls.length > 0 ? 'rose' : 'emerald'} />
        <CommandMetric label="Text-backs" value={String(safeOverview.textBacksSent)} detail={formatPercent(safeOverview.textBackRate)} tone="amber" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <Panel
          title="Owner action queue"
          subtitle="The next best actions for setup, callbacks, and captured leads."
          action={<Badge tone={actions.some((action) => action.priority === 'critical') ? 'rose' : 'emerald'}>{actions.length} item{actions.length === 1 ? '' : 's'}</Badge>}
        >
          <div className="grid gap-3">
            {actions.map((action, index) => (
              <Link
                key={`${action.label}-${index}`}
                href={action.href}
                className="group flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-400/30 hover:bg-cyan-400/[0.06]"
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-semibold',
                    action.priority === 'critical'
                      ? 'bg-rose-400/10 text-rose-200 ring-1 ring-rose-400/20'
                      : action.priority === 'high'
                        ? 'bg-amber-400/10 text-amber-200 ring-1 ring-amber-400/20'
                        : 'bg-cyan-400/10 text-cyan-200 ring-1 ring-cyan-400/20'
                  )}
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-[#f0f4f8] group-hover:text-cyan-200">{action.label}</span>
                  <span className="mt-1 block text-sm leading-6 text-[#8aa0b8]">{action.description}</span>
                </span>
                <span className="text-[#5a6a80] transition group-hover:translate-x-1 group-hover:text-cyan-200">→</span>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel title="Setup checklist" subtitle="Production readiness for the tenant workspace.">
          <div className="space-y-3">
            {checklist.map((item) => (
              <Link key={item.key} href={item.href} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 transition hover:bg-white/[0.06]">
                <span
                  className={cn(
                    'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    item.complete ? 'bg-emerald-400/10 text-emerald-200 ring-1 ring-emerald-400/20' : 'bg-amber-400/10 text-amber-200 ring-1 ring-amber-400/20'
                  )}
                >
                  {item.complete ? '✓' : '•'}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[#f0f4f8]">{item.label}</span>
                  <span className="mt-0.5 block truncate text-xs text-[#8aa0b8]">{item.description}</span>
                </span>
              </Link>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Panel
          title="Recent calls"
          subtitle="Live call history, triage, urgency, and AI summary."
          action={<Link href="/calls" className="text-sm font-semibold text-cyan-200 hover:text-cyan-100">View all →</Link>}
        >
          {callsResult.unavailable ? (
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">Recent calls could not be loaded right now.</div>
          ) : recentCalls.length > 0 ? (
            <div className="divide-y divide-white/10">
              {recentCalls.slice(0, 6).map((call) => {
                const status = normalizeCallStatus(call.callStatus ?? call.status);
                const detailId = getCallId(call);
                const callDate = getCallDate(call);

                return (
                  <Link key={`${detailId}-${callDate}`} href={detailId ? `/calls/${detailId}` : '/calls'} className="group grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-[#f0f4f8] group-hover:text-cyan-200">{getCallName(call)}</p>
                        <ToneBadge value={status} />
                        {call.urgency ? <ToneBadge value={call.urgency} /> : null}
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-[#8aa0b8]">{getCallReason(call)}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#5a6a80]">
                        <span>{timeAgo(callDate)}</span>
                        <span>·</span>
                        <span>{formatDuration(call.durationSeconds)}</span>
                        {call.voiceHandling?.textBackOutcome ? (
                          <>
                            <span>·</span>
                            <span>Text-back {call.voiceHandling.textBackOutcome}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-[#5a6a80] transition group-hover:translate-x-1 group-hover:text-cyan-200">Open →</span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyCommandState
              title="No calls yet"
              description="Once your AI front desk starts answering calls, summaries, urgency, recordings, and follow-up signals will appear here."
              href="/setup/phone"
              actionLabel="Set up phone number"
            />
          )}
        </Panel>

        <Panel
          title="Captured prospects"
          subtitle="Leads created from AI-handled calls and manual imports."
          action={<Link href="/prospects" className="text-sm font-semibold text-cyan-200 hover:text-cyan-100">Open pipeline →</Link>}
        >
          {prospectsResult.unavailable ? (
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">Prospects could not be loaded right now.</div>
          ) : recentProspects.length > 0 ? (
            <div className="space-y-3">
              {recentProspects.slice(0, 6).map((prospect) => (
                <Link key={prospect.prospectSid} href={`/prospects/${prospect.prospectSid}`} className="group block rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-400/30 hover:bg-cyan-400/[0.06]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#f0f4f8] group-hover:text-cyan-200">{getProspectDisplayName(prospect)}</p>
                      <p className="mt-1 truncate text-xs text-[#8aa0b8]">{getProspectSubtitle(prospect)}</p>
                    </div>
                    <ToneBadge value={prospect.priority ?? prospect.status} />
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#8aa0b8]">{prospect.serviceInterest ?? prospect.sourceLabel ?? 'Service need will appear after the AI captures or imports it.'}</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-[#5a6a80]">
                    <span>{prospect.updatedAt ? timeAgo(prospect.updatedAt) : 'Recently updated'}</span>
                    <span className="font-semibold text-cyan-200">Open →</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyCommandState
              title="No prospects captured yet"
              description="New leads created from qualified AI-handled calls will appear here with status, service need, priority, and next action."
              href="/prospects"
              actionLabel="Open prospects"
            />
          )}
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <Panel title="Phone + voice readiness" subtitle="The line, routing, agent, and recovery features customers depend on.">
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#5a6a80]">Primary line</p>
              <p className="mt-2 text-lg font-semibold text-[#f0f4f8]">{primaryPhone ? formatPhoneNumber(primaryPhone.e164) : 'Not connected'}</p>
              <p className="mt-1 text-sm text-[#8aa0b8]">{primaryPhone ? titleCase(primaryPhone.routingMode) : 'Provision or connect a phone number.'}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#5a6a80]">Voice agent</p>
              <p className="mt-2 text-lg font-semibold text-[#f0f4f8]">{primaryAgent?.name ?? 'No active voice agent'}</p>
              <p className="mt-1 text-sm text-[#8aa0b8]">{primaryAgent?.voiceName ?? 'Voice selection pending'}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#5a6a80]">Missed-call recovery</p>
              <p className="mt-2 text-lg font-semibold text-[#f0f4f8]">{primaryPhone?.enableMissedCallTextBack ? 'Text-back enabled' : 'Not enabled'}</p>
              <p className="mt-1 text-sm text-[#8aa0b8]">Auto-recovery status from the active phone record.</p>
            </div>
          </div>
        </Panel>

        <Panel title="Business intelligence" subtitle="Real setup data that improves call handling quality.">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#8aa0b8]">Business hours</span>
                <span className="font-semibold text-[#f0f4f8]">{business?.businessHours?.length ?? 0}/7</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-white/[0.06]">
                <div className="h-2 rounded-full bg-cyan-400" style={{ width: `${Math.min(100, ((business?.businessHours?.length ?? 0) / 7) * 100)}%` }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#8aa0b8]">Service areas</span>
                <span className="font-semibold text-[#f0f4f8]">{business?.serviceAreas?.length ?? 0}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(business?.serviceAreas ?? []).slice(0, 6).map((area) => (
                  <Badge key={area.id} tone="slate">{area.label}</Badge>
                ))}
                {(business?.serviceAreas?.length ?? 0) === 0 ? <Badge tone="amber">Add service areas</Badge> : null}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#5a6a80]">Greeting intelligence</p>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#8aa0b8]">
                {onboardingDetail?.steps?.greeting?.data?.greeting ?? 'Add a greeting so callers hear a polished, brand-specific opening.'}
              </p>
            </div>
          </div>
        </Panel>

        <Panel title="Reliability signals" subtitle="Live integrations and delivery health from the tenant workspace.">
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div>
                <p className="text-sm font-semibold text-[#f0f4f8]">Webhook delivery</p>
                <p className="mt-1 text-xs text-[#8aa0b8]">{safeWebhookHealth.available ? `${safeWebhookHealth.totalDeliveries} deliveries tracked` : 'No delivery data yet'}</p>
              </div>
              <Badge tone={safeWebhookHealth.available && safeWebhookHealth.successRate >= 95 ? 'emerald' : safeWebhookHealth.available ? 'amber' : 'slate'}>
                {safeWebhookHealth.available ? formatPercent(safeWebhookHealth.successRate) : 'Pending'}
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div>
                <p className="text-sm font-semibold text-[#f0f4f8]">Subscription</p>
                <p className="mt-1 text-xs text-[#8aa0b8]">Controls dashboard and AI front desk access.</p>
              </div>
              <ToneBadge value={billingStatus?.status ?? 'none'} />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div>
                <p className="text-sm font-semibold text-[#f0f4f8]">Data window</p>
                <p className="mt-1 text-xs text-[#8aa0b8]">{formatDateRange(safeOverview.startDate, safeOverview.endDate)}</p>
              </div>
              <div className="flex gap-1.5">
                {(['7d', '30d', '90d'] as const).map((nextPeriod) => (
                  <Link
                    key={nextPeriod}
                    href={`/dashboard?period=${nextPeriod}`}
                    className={cn(
                      'rounded-full px-2.5 py-1 text-xs font-semibold',
                      period === nextPeriod ? 'bg-cyan-400 text-[#020305]' : 'bg-white/[0.06] text-[#8aa0b8] hover:text-[#f0f4f8]'
                    )}
                  >
                    {nextPeriod}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </Panel>
      </section>

      <section className="rounded-[1.35rem] border border-cyan-400/20 bg-cyan-400/[0.06] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.18)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-cyan-100">What your customer experiences</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#a7bad0]">
              A caller reaches your AI front desk, gets greeted in your business voice, shares the service need, urgency, location, and callback details, then SkyBridgeCX turns that conversation into a call record and lead workflow for your team.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="cyan">Call answer</Badge>
            <Badge tone="violet">Lead extraction</Badge>
            <Badge tone="amber">Missed-call textback</Badge>
            <Badge tone="emerald">Owner follow-up</Badge>
          </div>
        </div>
      </section>
    </div>
  );
}
