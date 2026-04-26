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
    if (!response.ok) return { data: null, unavailable: true };
    const payload = (await response.json()) as ApiEnvelope & T;
    if ('ok' in payload && payload.ok === false) return { data: null, unavailable: true };
    return { data: payload, unavailable: false };
  } catch {
    return { data: null, unavailable: true };
  }
}

function formatDateRange(startDate: string, endDate: string) {
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${formatter.format(new Date(startDate))} – ${formatter.format(new Date(endDate))}`;
}

function greetingPrefix(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatPercent(value: number | null | undefined) {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return `${Math.round(n)}%`;
}

function formatDuration(seconds: number | null | undefined) {
  if (!seconds || seconds < 1) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function titleCase(value: string | null | undefined) {
  const n = value?.trim();
  if (!n) return 'Not set';
  return n.split(/[_\s-]+/).filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
}

function compactList(values: Array<string | null | undefined>, fallback: string) {
  const filtered = values.map((v) => v?.trim()).filter((v): v is string => Boolean(v));
  if (filtered.length === 0) return fallback;
  if (filtered.length <= 2) return filtered.join(', ');
  return `${filtered.slice(0, 2).join(', ')} +${filtered.length - 2}`;
}

function getCallId(call: RecentCall) { return call.callSid ?? call.twilioCallSid ?? call.id ?? ''; }
function getCallName(call: RecentCall) { return call.callerName ?? call.leadName ?? formatPhoneNumber(call.callerPhone ?? call.fromE164 ?? null); }
function getCallReason(call: RecentCall) { return call.callReason ?? call.leadIntent ?? call.summary ?? 'No reason captured yet'; }
function getCallDate(call: RecentCall) { return call.createdAt ?? call.startedAt ?? new Date().toISOString(); }
function getProspectDisplayName(p: ProspectRow) { return p.companyName ?? p.contactName ?? p.contactPhone ?? 'New prospect'; }
function getProspectSubtitle(p: ProspectRow) {
  const loc = [p.city, p.state].filter(Boolean).join(', ');
  const contact = p.contactName ?? p.contactPhone ?? p.contactEmail;
  return [contact, loc].filter(Boolean).join(' · ') || 'Lead details pending';
}
function isHighUrgency(call: RecentCall) { const u = call.urgency?.toLowerCase(); return u === 'high' || u === 'emergency'; }
function isMissedCall(call: RecentCall) { const s = normalizeCallStatus(call.callStatus ?? call.status); return s === 'missed' || s === 'voicemail'; }
function isNewProspect(p: ProspectRow) { return p.status?.toLowerCase() === 'new'; }
function isDueProspect(p: ProspectRow) { if (!p.nextActionAt) return false; return new Date(p.nextActionAt).getTime() <= Date.now(); }

function statusTone(value: string | null | undefined): 'emerald' | 'amber' | 'rose' | 'slate' {
  const n = value?.toLowerCase() ?? '';
  if (['active', 'completed', 'answered', 'reviewed', 'won', 'qualified', 'contacted', 'sent'].includes(n)) return 'emerald';
  if (['past_due', 'trialing', 'pending', 'needs_review', 'open', 'medium'].includes(n)) return 'amber';
  if (['missed', 'voicemail', 'failed', 'emergency', 'high', 'lost', 'unpaid'].includes(n)) return 'rose';
  return 'slate';
}

function buildSetupChecklist(input: {
  billingStatus: BillingStatusResponse | null;
  onboardingDetail: OnboardingDetailResponse | null;
  business: BusinessProfile | null;
}) {
  const activePhones = input.business?.phoneNumbers?.filter((p) => p.isActive) ?? [];
  const activeAgents = input.business?.agentProfiles?.filter((a) => a.isActive && a.channel === 'VOICE') ?? [];
  const hasBusinessProfile = Boolean(input.business?.name || input.onboardingDetail?.steps?.businessInfo?.complete);
  const hasBusinessHours = Boolean(input.business?.businessHours?.length);
  const hasServiceAreas = Boolean(input.business?.serviceAreas?.length);
  const billingStatus = input.billingStatus?.status?.toLowerCase() ?? input.onboardingDetail?.steps?.billing?.data?.subscriptionStatus?.toLowerCase() ?? 'none';
  const billingActive = ['active', 'trialing', 'past_due'].includes(billingStatus);

  return [
    { key: 'billing', label: 'Billing active', description: billingActive ? titleCase(billingStatus) : 'Subscription required', complete: billingActive, href: '/billing' },
    { key: 'business', label: 'Business profile', description: input.business?.name ?? input.onboardingDetail?.steps?.businessInfo?.data?.businessName ?? 'Add company details', complete: hasBusinessProfile, href: '/settings' },
    { key: 'phone', label: 'Phone number connected', description: activePhones[0]?.e164 ? formatPhoneNumber(activePhones[0].e164) : 'Connect a line for the AI front desk', complete: activePhones.length > 0 || input.onboardingDetail?.steps?.phoneNumber?.complete === true, href: '/setup/phone' },
    { key: 'voice', label: 'Voice agent ready', description: activeAgents[0]?.voiceName ?? activeAgents[0]?.name ?? 'Choose voice and greeting', complete: activeAgents.length > 0, href: '/settings' },
    { key: 'hours', label: 'Business hours', description: hasBusinessHours ? `${input.business?.businessHours?.length ?? 0} day rules configured` : 'Set normal and after-hours behavior', complete: hasBusinessHours, href: '/settings' },
    { key: 'areas', label: 'Service areas', description: hasServiceAreas ? compactList(input.business?.serviceAreas?.map((a) => a.label) ?? [], 'Configured') : 'Add cities and zip codes you serve', complete: hasServiceAreas, href: '/settings' }
  ];
}

function buildActionQueue(input: {
  checklist: ReturnType<typeof buildSetupChecklist>;
  calls: RecentCall[];
  prospects: ProspectRow[];
  analyticsUnavailable: boolean;
  businessUnavailable: boolean;
}) {
  const actions: Array<{ label: string; description: string; href: string; priority: 'critical' | 'high' | 'normal' }> = [];

  for (const item of input.checklist.filter((e) => !e.complete).slice(0, 3)) {
    actions.push({ label: item.label, description: item.description, href: item.href, priority: item.key === 'billing' || item.key === 'phone' ? 'critical' : 'high' });
  }

  const urgentCalls = input.calls.filter(isHighUrgency);
  if (urgentCalls.length > 0) actions.push({ label: `Review ${urgentCalls.length} urgent call${urgentCalls.length === 1 ? '' : 's'}`, description: 'High-priority calls need owner review or callback.', href: '/calls?urgency=high', priority: 'critical' });

  const missed = input.calls.filter(isMissedCall);
  if (missed.length > 0) actions.push({ label: `Return ${missed.length} missed call${missed.length === 1 ? '' : 's'}`, description: 'Use summaries and transcripts to follow up quickly.', href: '/calls?triageStatus=OPEN', priority: 'high' });

  const due = input.prospects.filter((p) => isNewProspect(p) || isDueProspect(p));
  if (due.length > 0) actions.push({ label: `Work ${due.length} prospect${due.length === 1 ? '' : 's'}`, description: 'Captured leads are waiting for next action.', href: '/prospects?status=new', priority: 'normal' });

  if (input.analyticsUnavailable || input.businessUnavailable) {
    actions.push({ label: 'Check dashboard connection', description: 'Some live data could not be loaded from the API.', href: '/dashboard', priority: 'normal' });
  }

  if (actions.length === 0) {
    actions.push({ label: 'Your command center is ready', description: 'No urgent setup or follow-up items are waiting right now.', href: '/calls', priority: 'normal' });
  }

  return actions.slice(0, 6);
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

// ── Light-theme Badge ──────────────────────────────────────────────────────
function Badge({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'slate' | 'violet' }) {
  const toneClasses = {
    indigo:  'border-indigo-200 bg-indigo-50 text-indigo-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber:   'border-amber-200 bg-amber-50 text-amber-700',
    rose:    'border-rose-200 bg-rose-50 text-rose-700',
    slate:   'border-gray-200 bg-gray-100 text-gray-600',
    violet:  'border-violet-200 bg-violet-50 text-violet-700'
  } satisfies Record<string, string>;

  return <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold', toneClasses[tone])}>{children}</span>;
}

// ── Light-theme Panel card ─────────────────────────────────────────────────
function Panel({ children, className, title, subtitle, action }: { children: React.ReactNode; className?: string; title?: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <section className={cn('rounded-2xl border border-gray-200 bg-white shadow-sm', className)}>
      {title || subtitle || action ? (
        <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div>
            {title ? <h2 className="text-base font-semibold tracking-tight text-gray-900 sm:text-lg">{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-sm leading-6 text-gray-500">{subtitle}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

// ── Light-theme KPI metric card ────────────────────────────────────────────
function CommandMetric({ label, value, detail, tone = 'indigo' }: { label: string; value: string; detail: string; tone?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'violet' }) {
  const toneClasses = {
    indigo:  'text-indigo-600 bg-indigo-50 ring-indigo-200',
    emerald: 'text-emerald-600 bg-emerald-50 ring-emerald-200',
    amber:   'text-amber-600 bg-amber-50 ring-amber-200',
    rose:    'text-rose-600 bg-rose-50 ring-rose-200',
    violet:  'text-violet-600 bg-violet-50 ring-violet-200'
  } satisfies Record<string, string>;

  const [textClass, bgClass, ringClass] = toneClasses[tone].split(' ');

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">{value}</p>
        <span className={cn('rounded-full px-2 py-1 text-xs font-semibold ring-1', textClass, bgClass, ringClass)}>{detail}</span>
      </div>
    </div>
  );
}

// ── Readiness ring (indigo) ────────────────────────────────────────────────
function ReadinessRing({ score }: { score: number }) {
  const safe = Math.max(0, Math.min(100, score));
  const pct = `${safe}%`;
  return (
    <div
      className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full p-2"
      style={{ background: `conic-gradient(#6366F1 ${pct}, #E9EBF0 0)` }}
    >
      <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white text-center ring-1 ring-gray-200">
        <span className="text-2xl font-semibold tracking-tight text-gray-900">{safe}%</span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">ready</span>
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────
function EmptyCommandState({ title, description, href, actionLabel }: { title: string; description: string; href: string; actionLabel: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500 ring-1 ring-indigo-200">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="mt-4 text-base font-semibold text-gray-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">{description}</p>
      <Link href={href} className="mt-5 inline-flex min-h-10 items-center justify-center rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-500">
        {actionLabel}
      </Link>
    </div>
  );
}

// ── Tone badge wrapper ─────────────────────────────────────────────────────
function ToneBadge({ value }: { value: string | null | undefined }) {
  const tone = statusTone(value);
  const mapped = tone === 'emerald' ? 'emerald' : tone === 'amber' ? 'amber' : tone === 'rose' ? 'rose' : 'slate';
  return <Badge tone={mapped}>{titleCase(value)}</Badge>;
}

// ── Page ───────────────────────────────────────────────────────────────────
export default async function SkybridgeCommandCenterPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
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
    activeBusiness ? fetchApi<ProspectsResponse>(`/v1/businesses/${activeBusiness.id}/prospects?limit=8`) : Promise.resolve({ data: null, unavailable: false } satisfies FetchResult<ProspectsResponse>),
    tenant ? fetchApi<BillingStatusResponse>(`/v1/billing/status/${tenant.id}`) : Promise.resolve({ data: null, unavailable: false } satisfies FetchResult<BillingStatusResponse>)
  ]);

  const safeOverview = overviewResult.data ?? emptyOverview(period);
  const safeWebhookHealth = webhookHealthResult.data ?? emptyWebhookHealth(period);
  const recentCalls = callsResult.data?.calls ?? [];
  const recentProspects = prospectsResult.data?.prospects ?? [];
  const business = businessResult.data?.business ?? null;
  const onboardingDetail = onboardingDetailResult.data ?? null;
  const billingStatus = billingResult.data ?? null;

  const activePhones = business?.phoneNumbers?.filter((p) => p.isActive) ?? [];
  const activeAgents = business?.agentProfiles?.filter((a) => a.isActive && a.channel === 'VOICE') ?? [];
  const primaryPhone = activePhones[0] ?? null;
  const primaryAgent = activeAgents[0] ?? primaryPhone?.primaryAgentProfile ?? null;
  const checklist = buildSetupChecklist({ billingStatus, onboardingDetail, business });
  const readinessScore = Math.round((checklist.filter((i) => i.complete).length / checklist.length) * 100);
  const actions = buildActionQueue({ checklist, calls: recentCalls, prospects: recentProspects, analyticsUnavailable: overviewResult.unavailable, businessUnavailable: businessResult.unavailable });

  const urgentCalls = recentCalls.filter(isHighUrgency);
  const missedCalls = recentCalls.filter(isMissedCall);
  const newProspects = recentProspects.filter(isNewProspect);
  const liveStatus = readinessScore >= 85 ? 'Live and ready' : readinessScore >= 50 ? 'Setup in progress' : 'Needs setup';
  const businessName = business?.name ?? onboardingDetail?.steps?.businessInfo?.data?.businessName ?? tenant?.name ?? onboardingStatus?.tenantName ?? 'your business';
  const operatorName = user?.firstName ?? user?.username ?? 'Operator';
  const heading = `${greetingPrefix(new Date().getHours())}, ${operatorName}`;

  return (
    <div className="space-y-6">
      {/* ── Hero / Status header ── */}
      <section className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-500 p-5 shadow-lg sm:p-7 lg:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.12),transparent_55%)]" />
        <div className="relative grid gap-7 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-white/25 bg-white/15 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">AI front desk command center</span>
              <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
                readinessScore >= 85 ? 'border-emerald-300/40 bg-emerald-400/20 text-emerald-100' :
                readinessScore >= 50 ? 'border-amber-300/40 bg-amber-400/20 text-amber-100' :
                'border-rose-300/40 bg-rose-400/20 text-rose-100'
              )}>{liveStatus}</span>
            </div>
            <h1 className="mt-5 max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
              {heading}. Your AI receptionist is the front door for {businessName}.
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-indigo-100 sm:text-lg">
              Track calls, captured leads, missed-call recovery, setup health, and owner actions from one premium control center.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/calls" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-indigo-700 shadow transition hover:bg-indigo-50">
                Review calls
              </Link>
              <Link href="/prospects" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/25 bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20">
                Open lead pipeline
              </Link>
              <Link href="/setup/phone" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/25 bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20">
                Phone setup
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <ReadinessRing score={readinessScore} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">AI front desk status</p>
                <p className="mt-2 text-sm leading-6 text-indigo-100">
                  {primaryPhone ? `${formatPhoneNumber(primaryPhone.e164)} is connected.` : 'No active phone number is connected yet.'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
                    (() => { const s = billingStatus?.status?.toLowerCase() ?? 'none'; return ['active'].includes(s) ? 'border-emerald-300/40 bg-emerald-400/20 text-emerald-100' : ['trialing', 'past_due'].includes(s) ? 'border-amber-300/40 bg-amber-400/20 text-amber-100' : 'border-white/20 bg-white/10 text-white/70'; })()
                  )}>{titleCase(billingStatus?.status ?? 'none')}</span>
                  <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold', primaryAgent ? 'border-emerald-300/40 bg-emerald-400/20 text-emerald-100' : 'border-amber-300/40 bg-amber-400/20 text-amber-100')}>
                    {primaryAgent ? 'Voice ready' : 'Voice pending'}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-5 grid gap-2 text-sm">
              {[
                { label: 'Business', value: businessName },
                { label: 'Language', value: titleCase(onboardingDetail?.steps?.greeting?.data?.language ?? activeAgents[0]?.language) },
                { label: 'Service areas', value: String(business?.serviceAreas?.length ?? 0) }
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between rounded-xl bg-white/10 px-3 py-2.5">
                  <span className="text-indigo-200">{row.label}</span>
                  <span className="max-w-[11rem] truncate font-semibold text-white">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── KPI metrics row ── */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <CommandMetric label="Calls" value={String(safeOverview.totalCalls)} detail={period} tone="indigo" />
        <CommandMetric label="Answered" value={String(safeOverview.answeredCalls)} detail={formatPercent(safeOverview.answerRate)} tone="emerald" />
        <CommandMetric label="Missed" value={String(safeOverview.missedCalls)} detail={`${missedCalls.length} recent`} tone={safeOverview.missedCalls > 0 ? 'rose' : 'emerald'} />
        <CommandMetric label="Leads captured" value={String(safeOverview.totalLeadsExtracted || recentProspects.length)} detail={`${newProspects.length} new`} tone="violet" />
        <CommandMetric label="Urgent queue" value={String(urgentCalls.length)} detail="recent" tone={urgentCalls.length > 0 ? 'rose' : 'emerald'} />
        <CommandMetric label="Text-backs" value={String(safeOverview.textBacksSent)} detail={formatPercent(safeOverview.textBackRate)} tone="amber" />
      </section>

      {/* ── Action queue + Setup checklist ── */}
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <Panel
          title="Owner action queue"
          subtitle="The next best actions for setup, callbacks, and captured leads."
          action={<Badge tone={actions.some((a) => a.priority === 'critical') ? 'rose' : 'emerald'}>{actions.length} item{actions.length === 1 ? '' : 's'}</Badge>}
        >
          <div className="grid gap-3">
            {actions.map((action, index) => (
              <Link
                key={`${action.label}-${index}`}
                href={action.href}
                className="group flex items-start gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 transition hover:border-indigo-200 hover:bg-indigo-50"
              >
                <span className={cn(
                  'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-semibold',
                  action.priority === 'critical' ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-200' :
                  action.priority === 'high' ? 'bg-amber-50 text-amber-600 ring-1 ring-amber-200' :
                  'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200'
                )}>
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-gray-900 group-hover:text-indigo-700">{action.label}</span>
                  <span className="mt-1 block text-sm leading-6 text-gray-500">{action.description}</span>
                </span>
                <span className="text-gray-400 transition group-hover:translate-x-1 group-hover:text-indigo-500">→</span>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel title="Setup checklist" subtitle="Production readiness for the tenant workspace.">
          <div className="space-y-3">
            {checklist.map((item) => (
              <Link key={item.key} href={item.href} className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 transition hover:bg-indigo-50 hover:border-indigo-200">
                <span className={cn(
                  'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  item.complete ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200' : 'bg-amber-50 text-amber-600 ring-1 ring-amber-200'
                )}>
                  {item.complete ? '✓' : '•'}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-gray-900">{item.label}</span>
                  <span className="mt-0.5 block truncate text-xs text-gray-500">{item.description}</span>
                </span>
              </Link>
            ))}
          </div>
        </Panel>
      </section>

      {/* ── Recent calls + Prospects ── */}
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Panel
          title="Recent calls"
          subtitle="Live call history, triage, urgency, and AI summary."
          action={<Link href="/calls" className="text-sm font-semibold text-indigo-600 hover:text-indigo-500">View all →</Link>}
        >
          {callsResult.unavailable ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">Recent calls could not be loaded right now.</div>
          ) : recentCalls.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {recentCalls.slice(0, 6).map((call) => {
                const status = normalizeCallStatus(call.callStatus ?? call.status);
                const detailId = getCallId(call);
                const callDate = getCallDate(call);
                return (
                  <Link key={`${detailId}-${callDate}`} href={detailId ? `/calls/${detailId}` : '/calls'} className="group grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-gray-900 group-hover:text-indigo-600">{getCallName(call)}</p>
                        <ToneBadge value={status} />
                        {call.urgency ? <ToneBadge value={call.urgency} /> : null}
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-gray-500">{getCallReason(call)}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-400">
                        <span>{timeAgo(callDate)}</span>
                        <span>·</span>
                        <span>{formatDuration(call.durationSeconds)}</span>
                        {call.voiceHandling?.textBackOutcome ? (
                          <><span>·</span><span>Text-back {call.voiceHandling.textBackOutcome}</span></>
                        ) : null}
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-gray-400 transition group-hover:translate-x-1 group-hover:text-indigo-500">Open →</span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyCommandState title="No calls yet" description="Once your AI front desk starts answering calls, summaries, urgency, recordings, and follow-up signals will appear here." href="/setup/phone" actionLabel="Set up phone number" />
          )}
        </Panel>

        <Panel
          title="Captured prospects"
          subtitle="Leads created from AI-handled calls and manual imports."
          action={<Link href="/prospects" className="text-sm font-semibold text-indigo-600 hover:text-indigo-500">Open pipeline →</Link>}
        >
          {prospectsResult.unavailable ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">Prospects could not be loaded right now.</div>
          ) : recentProspects.length > 0 ? (
            <div className="space-y-3">
              {recentProspects.slice(0, 6).map((prospect) => (
                <Link key={prospect.prospectSid} href={`/prospects/${prospect.prospectSid}`} className="group block rounded-xl border border-gray-200 bg-gray-50 p-4 transition hover:border-indigo-200 hover:bg-indigo-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900 group-hover:text-indigo-700">{getProspectDisplayName(prospect)}</p>
                      <p className="mt-1 truncate text-xs text-gray-500">{getProspectSubtitle(prospect)}</p>
                    </div>
                    <ToneBadge value={prospect.priority ?? prospect.status} />
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-gray-500">{prospect.serviceInterest ?? prospect.sourceLabel ?? 'Service need will appear after the AI captures or imports it.'}</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                    <span>{prospect.updatedAt ? timeAgo(prospect.updatedAt) : 'Recently updated'}</span>
                    <span className="font-semibold text-indigo-500">Open →</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyCommandState title="No prospects captured yet" description="New leads created from qualified AI-handled calls will appear here with status, service need, priority, and next action." href="/prospects" actionLabel="Open prospects" />
          )}
        </Panel>
      </section>

      {/* ── Detail panels row ── */}
      <section className="grid gap-6 xl:grid-cols-3">
        <Panel title="Phone + voice readiness" subtitle="The line, routing, agent, and recovery features customers depend on.">
          <div className="space-y-3">
            {[
              { label: 'Primary line', value: primaryPhone ? formatPhoneNumber(primaryPhone.e164) : 'Not connected', sub: primaryPhone ? titleCase(primaryPhone.routingMode) : 'Provision or connect a phone number.' },
              { label: 'Voice agent', value: primaryAgent?.name ?? 'No active voice agent', sub: primaryAgent?.voiceName ?? 'Voice selection pending' },
              { label: 'Missed-call recovery', value: primaryPhone?.enableMissedCallTextBack ? 'Text-back enabled' : 'Not enabled', sub: 'Auto-recovery status from the active phone record.' }
            ].map((row) => (
              <div key={row.label} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{row.label}</p>
                <p className="mt-2 text-base font-semibold text-gray-900">{row.value}</p>
                <p className="mt-1 text-sm text-gray-500">{row.sub}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Business intelligence" subtitle="Real setup data that improves call handling quality.">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Business hours</span>
                <span className="font-semibold text-gray-900">{business?.businessHours?.length ?? 0}/7</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-gray-100">
                <div className="h-2 rounded-full bg-indigo-500 transition-all" style={{ width: `${Math.min(100, ((business?.businessHours?.length ?? 0) / 7) * 100)}%` }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Service areas</span>
                <span className="font-semibold text-gray-900">{business?.serviceAreas?.length ?? 0}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(business?.serviceAreas ?? []).slice(0, 6).map((area) => (
                  <Badge key={area.id} tone="slate">{area.label}</Badge>
                ))}
                {(business?.serviceAreas?.length ?? 0) === 0 ? <Badge tone="amber">Add service areas</Badge> : null}
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Greeting intelligence</p>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-gray-500">
                {onboardingDetail?.steps?.greeting?.data?.greeting ?? 'Add a greeting so callers hear a polished, brand-specific opening.'}
              </p>
            </div>
          </div>
        </Panel>

        <Panel title="Reliability signals" subtitle="Live integrations and delivery health from the tenant workspace.">
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">Webhook delivery</p>
                <p className="mt-1 text-xs text-gray-500">{safeWebhookHealth.available ? `${safeWebhookHealth.totalDeliveries} deliveries tracked` : 'No delivery data yet'}</p>
              </div>
              <Badge tone={safeWebhookHealth.available && safeWebhookHealth.successRate >= 95 ? 'emerald' : safeWebhookHealth.available ? 'amber' : 'slate'}>
                {safeWebhookHealth.available ? formatPercent(safeWebhookHealth.successRate) : 'Pending'}
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">Subscription</p>
                <p className="mt-1 text-xs text-gray-500">Controls dashboard and AI front desk access.</p>
              </div>
              <ToneBadge value={billingStatus?.status ?? 'none'} />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">Data window</p>
                <p className="mt-1 text-xs text-gray-500">{formatDateRange(safeOverview.startDate, safeOverview.endDate)}</p>
              </div>
              <div className="flex gap-1.5">
                {(['7d', '30d', '90d'] as const).map((nextPeriod) => (
                  <Link
                    key={nextPeriod}
                    href={`/dashboard?period=${nextPeriod}`}
                    className={cn(
                      'rounded-full px-2.5 py-1 text-xs font-semibold transition',
                      period === nextPeriod ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
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

      {/* ── Bottom workflow banner ── */}
      <section className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-indigo-900">What your customer experiences</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-indigo-700">
              A caller reaches your AI front desk, gets greeted in your business voice, shares the service need, urgency, location, and callback details — then SkyBridgeCX turns that conversation into a call record and lead workflow for your team.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="indigo">Call answer</Badge>
            <Badge tone="violet">Lead extraction</Badge>
            <Badge tone="amber">Missed-call textback</Badge>
            <Badge tone="emerald">Owner follow-up</Badge>
          </div>
        </div>
      </section>
    </div>
  );
}
