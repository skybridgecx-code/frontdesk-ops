'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { getApiBaseUrl, getClientInternalApiHeaders } from '@/lib/api-client';
import { formatPhoneNumber } from '@/lib/call-utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase =
  | 'loading'
  | 'intro'
  | 'biz_name'
  | 'industry'
  | 'biz_details'
  | 'language'
  | 'greeting'
  | 'phone'
  | 'finalizing'
  | 'done';

type ChatMsg = { id: string; role: 'sky' | 'user'; text: string };
type AgentLanguage = 'en' | 'es' | 'bilingual';

// ─── Constants ────────────────────────────────────────────────────────────────

const INDUSTRIES = [
  { label: 'HVAC', value: 'hvac', emoji: '❄️' },
  { label: 'Plumbing', value: 'plumbing', emoji: '🔧' },
  { label: 'Electrical', value: 'electrical', emoji: '⚡' },
  { label: 'Roofing', value: 'roofing', emoji: '🏠' },
  { label: 'Landscaping', value: 'landscaping', emoji: '🌿' },
  { label: 'Cleaning', value: 'cleaning', emoji: '✨' },
  { label: 'Pest Control', value: 'pest-control', emoji: '🐛' },
  { label: 'Painting', value: 'painting', emoji: '🎨' },
  { label: 'General Contractor', value: 'general-contractor', emoji: '🏗️' },
  { label: 'Other', value: 'other', emoji: '🔨' },
];

const TIMEZONES = [
  { label: 'Eastern', sublabel: 'New York', value: 'America/New_York' },
  { label: 'Central', sublabel: 'Chicago', value: 'America/Chicago' },
  { label: 'Mountain', sublabel: 'Denver', value: 'America/Denver' },
  { label: 'Pacific', sublabel: 'Los Angeles', value: 'America/Los_Angeles' },
];

const LANGUAGES = [
  {
    value: 'bilingual' as AgentLanguage,
    label: 'Bilingual',
    sublabel: 'Auto-detects English & Spanish. Recommended for US home services.',
    recommended: true,
  },
  {
    value: 'en' as AgentLanguage,
    label: 'English Only',
    sublabel: 'For predominantly English-speaking service areas.',
  },
  {
    value: 'es' as AgentLanguage,
    label: 'Solo Español',
    sublabel: 'Para negocios con clientes predominantemente hispanohablantes.',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

let msgCounter = 0;
function mkMsg(role: 'sky' | 'user', text: string): ChatMsg {
  return { id: String(++msgCounter), role, text };
}

function canAccessDashboard(status: string | null | undefined) {
  const s = status?.toLowerCase();
  return s === 'active' || s === 'trialing' || s === 'past_due';
}

// ─── Done Screen ──────────────────────────────────────────────────────────────

function DoneScreen({
  businessName,
  phoneNumber,
  dashboardHref,
}: {
  businessName: string;
  phoneNumber: string | null;
  dashboardHref: string;
}) {
  const formatted = phoneNumber ? formatPhoneNumber(phoneNumber) : null;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 40%, #7c3aed 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '24px',
        animation: 'skyFadeIn 0.6s ease forwards',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: '480px' }}>
        <div
          style={{
            fontSize: '72px',
            lineHeight: 1,
            marginBottom: '24px',
            animation: 'skyPopIn 0.5s 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
          }}
        >
          🎉
        </div>
        <p
          style={{
            fontFamily: 'ui-monospace, monospace',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.7)',
            marginBottom: '12px',
          }}
        >
          You&apos;re live
        </p>
        <h1
          style={{
            fontSize: '38px',
            fontWeight: 900,
            letterSpacing: '-0.04em',
            color: '#fff',
            lineHeight: 1.1,
            marginBottom: '16px',
          }}
        >
          {businessName || 'Your business'} is ready.
        </h1>
        <p
          style={{
            color: 'rgba(255,255,255,0.75)',
            fontSize: '16px',
            lineHeight: 1.6,
            marginBottom: formatted ? '12px' : '40px',
          }}
        >
          Sky is answering calls 24/7. Every lead captured, every caller impressed.
        </p>
        {formatted ? (
          <div
            style={{
              display: 'inline-block',
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '12px',
              padding: '12px 24px',
              marginBottom: '40px',
            }}
          >
            <p
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.6)',
                marginBottom: '4px',
              }}
            >
              Your AI phone number
            </p>
            <p
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: '26px',
                fontWeight: 700,
                color: '#fff',
              }}
            >
              {formatted}
            </p>
          </div>
        ) : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
          <Link
            href={dashboardHref}
            style={{
              display: 'inline-block',
              background: '#fff',
              color: '#4338ca',
              fontWeight: 800,
              fontSize: '15px',
              letterSpacing: '-0.01em',
              padding: '14px 40px',
              borderRadius: '14px',
              textDecoration: 'none',
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
          >
            Go to Dashboard →
          </Link>
          {dashboardHref !== '/dashboard' ? null : (
            <Link
              href="/billing"
              style={{
                color: 'rgba(255,255,255,0.65)',
                fontSize: '13px',
                textDecoration: 'underline',
                textUnderlineOffset: '3px',
              }}
            >
              Manage billing
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function OnboardingWizardClient() {
  const router = useRouter();
  const { getToken, isLoaded } = useAuth();
  const { user } = useUser();
  const firstName = user?.firstName ?? null;

  // Chat state
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [skyTyping, setSkyTyping] = useState(false);
  const [phase, setPhase] = useState<Phase>('loading');

  // Business data
  const [bizName, setBizName] = useState('');
  const [industry, setIndustry] = useState('');
  const [bizAddress, setBizAddress] = useState('');
  const [bizPhone, setBizPhone] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [language, setLanguage] = useState<AgentLanguage>('bilingual');
  const [useDefaultGreeting, setUseDefaultGreeting] = useState(true);
  const [customGreeting, setCustomGreeting] = useState('');
  const [areaCode, setAreaCode] = useState('');
  const [provisionedPhone, setProvisionedPhone] = useState<string | null>(null);

  // UI state
  const [nameInput, setNameInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [dashboardHref, setDashboardHref] = useState('/dashboard');
  const [phoneSearching, setPhoneSearching] = useState(false);
  const [skipError, setSkipError] = useState<string | null>(null);
  const [isSkipping, setIsSkipping] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // ── Scroll to bottom whenever messages change ────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, skyTyping, phase]);

  // ── Focus name input when phase is biz_name ─────────────────────────────
  useEffect(() => {
    if (phase === 'biz_name') {
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }, [phase]);

  // ── Message helpers ──────────────────────────────────────────────────────

  function addMsg(msg: ChatMsg) {
    setMessages((prev) => [...prev, msg]);
  }

  async function skySpeak(text: string, delayMs = 900): Promise<void> {
    setSkyTyping(true);
    await new Promise((r) => setTimeout(r, delayMs));
    setSkyTyping(false);
    addMsg(mkMsg('sky', text));
  }

  function userSay(text: string) {
    addMsg(mkMsg('user', text));
  }

  // ── Load onboarding status on mount ─────────────────────────────────────

  const loadStatus = useCallback(async () => {
    if (!isLoaded) return;
    try {
      const headers = await getClientInternalApiHeaders(() => getToken());
      const res = await fetch(getApiBaseUrl() + '/v1/onboarding/status', {
        cache: 'no-store',
        headers,
      });
      if (!res.ok) {
        setPhase('intro');
        void runIntro();
        return;
      }
      const payload = await res.json() as {
        onboardingComplete: boolean;
        onboardingStep: number;
        steps: {
          businessInfo: { complete: boolean; data: { businessName: string | null; industry: string | null; businessAddress: string | null; businessPhone: string | null; timezone: string | null } };
          greeting: { complete: boolean; data: { greeting: string | null; language: AgentLanguage | null } };
          phoneNumber: { complete: boolean; data: { twilioPhoneNumber: string | null } };
          billing: { complete: boolean; data: { plan: string; subscriptionStatus: string } };
        };
      };

      if (payload.onboardingComplete) {
        const href = canAccessDashboard(payload.steps.billing.data.subscriptionStatus) ? '/dashboard' : '/billing?notice=subscription-required';
        router.push(href);
        return;
      }

      // Pre-fill known data
      if (payload.steps.businessInfo.data.businessName) setBizName(payload.steps.businessInfo.data.businessName);
      if (payload.steps.businessInfo.data.industry) setIndustry(payload.steps.businessInfo.data.industry);
      if (payload.steps.businessInfo.data.timezone) setTimezone(payload.steps.businessInfo.data.timezone);
      if (payload.steps.greeting.data.language) setLanguage(payload.steps.greeting.data.language);
      if (payload.steps.phoneNumber.data.twilioPhoneNumber) setProvisionedPhone(payload.steps.phoneNumber.data.twilioPhoneNumber);
      setDashboardHref(canAccessDashboard(payload.steps.billing.data.subscriptionStatus) ? '/dashboard' : '/billing?notice=subscription-required');

      setPhase('intro');
      void runIntro();
    } catch {
      setPhase('intro');
      void runIntro();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getToken, isLoaded, router]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  // ── Intro sequence ───────────────────────────────────────────────────────

  async function runIntro() {
    const greeting = firstName ? `Hey ${firstName} 👋` : 'Hey there 👋';
    await skySpeak(greeting, 600);
    await skySpeak("I'm Sky — your new AI front desk. I answer every call, capture every lead, and make your business sound world-class. 24/7.", 1400);
    await skySpeak("Let's get you set up in about 2 minutes. First things first — what's the name of your business?", 1600);
    setPhase('biz_name');
  }

  // ── Step: Business name ──────────────────────────────────────────────────

  async function handleBizName() {
    const name = nameInput.trim();
    if (!name) return;
    userSay(name);
    setBizName(name);
    setNameInput('');
    await skySpeak(`Love it — ${name} it is. What industry are you in?`, 900);
    setPhase('industry');
  }

  // ── Step: Industry ───────────────────────────────────────────────────────

  async function handleIndustry(value: string, label: string) {
    userSay(label);
    setIndustry(value);
    await skySpeak("Nice. A couple quick details help me route calls and schedule jobs correctly — what's your business address? (Optional — you can skip)", 1000);
    setPhase('biz_details');
  }

  // ── Step: Business details (address, phone, timezone) ───────────────────

  async function handleBizDetails(skip = false) {
    if (!skip && !bizAddress.trim() && !bizPhone.trim()) {
      skip = true;
    }

    setSubmitting(true);
    setApiError(null);

    try {
      const headers = {
        ...(await getClientInternalApiHeaders(() => getToken())),
        'content-type': 'application/json',
      };

      const body: Record<string, string> = {
        businessName: bizName,
        industry,
        timezone,
      };
      if (bizAddress.trim()) body.businessAddress = bizAddress.trim();
      if (bizPhone.trim()) body.businessPhone = bizPhone.trim();

      const res = await fetch(getApiBaseUrl() + '/v1/onboarding/business-info', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const p = await res.json().catch(() => ({})) as { error?: string };
        setApiError(p.error ?? 'Could not save business info. Please try again.');
        setSubmitting(false);
        return;
      }

      if (skip) {
        userSay('Skip for now');
      } else {
        const parts: string[] = [];
        if (bizAddress.trim()) parts.push(bizAddress.trim());
        if (bizPhone.trim()) parts.push(bizPhone.trim());
        userSay(parts.join(' · '));
      }

      await skySpeak("Got it. Now let's configure how Sky greets your callers. Should I handle calls in English, Spanish, or both?", 1000);
      setPhase('language');
    } catch {
      setApiError('Could not save business info. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Step: Language ───────────────────────────────────────────────────────

  async function handleLanguage(value: AgentLanguage, label: string) {
    userSay(label);
    setLanguage(value);

    const name = bizName || 'your business';
    let defaultGreetingPreview = '';
    if (value === 'es') {
      defaultGreetingPreview = `Gracias por llamar a ${name}. ¿En qué le puedo ayudar hoy?`;
    } else if (value === 'bilingual') {
      defaultGreetingPreview = `Thanks for calling ${name}. This is Sky — para español, solo siga hablando. How can I help you today?`;
    } else {
      defaultGreetingPreview = `Thanks for calling ${name}. How can we help you today?`;
    }

    await skySpeak(`Here's how I'll greet your callers:\n\n"${defaultGreetingPreview}"\n\nDoes that work, or would you like to write something custom?`, 1100);
    setPhase('greeting');
  }

  // ── Step: Greeting ───────────────────────────────────────────────────────

  async function handleGreeting(useDef: boolean) {
    setSubmitting(true);
    setApiError(null);
    setUseDefaultGreeting(useDef);

    if (!useDef && customGreeting.trim().length === 0) {
      setApiError('Please enter a custom greeting.');
      setSubmitting(false);
      return;
    }

    try {
      const headers = {
        ...(await getClientInternalApiHeaders(() => getToken())),
        'content-type': 'application/json',
      };

      const body = useDef
        ? { useDefault: true, language }
        : { greeting: customGreeting.trim(), language };

      const res = await fetch(getApiBaseUrl() + '/v1/onboarding/greeting', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const p = await res.json().catch(() => ({})) as { error?: string };
        setApiError(p.error ?? 'Could not save greeting. Please try again.');
        setSubmitting(false);
        return;
      }

      userSay(useDef ? 'That sounds perfect ✓' : `Custom: "${customGreeting.trim()}"`);
      await skySpeak("Now for the most important part — your AI phone number. Callers will reach Sky at this number. Want a specific area code, or should I grab any available?", 1100);
      setPhase('phone');
    } catch {
      setApiError('Could not save greeting. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Step: Phone number ───────────────────────────────────────────────────

  async function handleProvision() {
    const code = areaCode.trim();
    if (code.length > 0 && !/^\d{3}$/.test(code)) {
      setApiError('Area code must be exactly 3 digits.');
      return;
    }

    setPhoneSearching(true);
    setApiError(null);

    try {
      const headers = await getClientInternalApiHeaders(() => getToken());

      // Get business ID
      const bootstrapRes = await fetch(getApiBaseUrl() + '/v1/bootstrap', { method: 'GET', headers });
      const bootstrapPayload = await bootstrapRes.json().catch(() => ({})) as { business?: { id?: string }; defaultBusiness?: { id?: string }; tenant?: { defaultBusinessId?: string } };
      const businessId = bootstrapPayload?.business?.id ?? bootstrapPayload?.defaultBusiness?.id ?? bootstrapPayload?.tenant?.defaultBusinessId ?? null;

      if (!bootstrapRes.ok || !businessId) {
        setApiError('Could not find a default business for this account.');
        setPhoneSearching(false);
        return;
      }

      // Search for a number
      const params = new URLSearchParams({ country: 'US', limit: '1' });
      if (code.length > 0) params.set('areaCode', code);

      const searchRes = await fetch(getApiBaseUrl() + '/v1/provisioning/search-numbers?' + params.toString(), { method: 'GET', headers });
      const searchPayload = await searchRes.json().catch(() => ({})) as { numbers?: Array<{ phoneNumber?: string }> };
      const selectedNumber = Array.isArray(searchPayload.numbers) && searchPayload.numbers[0]?.phoneNumber ? searchPayload.numbers[0].phoneNumber : null;

      if (!searchRes.ok || !selectedNumber) {
        setApiError('Could not find an available phone number right now. Try a different area code or leave it blank.');
        setPhoneSearching(false);
        return;
      }

      // Purchase the number
      const purchaseRes = await fetch(getApiBaseUrl() + '/v1/provisioning/purchase-number', {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ phoneNumber: selectedNumber, businessId }),
      });
      const purchasePayload = await purchaseRes.json().catch(() => ({})) as { phoneNumber?: { e164?: string; phoneNumber?: string } };
      const purchased = purchasePayload.phoneNumber?.e164 ?? purchasePayload.phoneNumber?.phoneNumber ?? null;

      if (!purchaseRes.ok || !purchased) {
        setApiError('Could not provision the number. Please try again.');
        setPhoneSearching(false);
        return;
      }

      setProvisionedPhone(purchased);
      setPhoneSearching(false);
      userSay(code ? `Area code ${code}` : 'Any area code');
      await skySpeak(`You got it — ${formatPhoneNumber(purchased)}. That number is live right now. Customers can call and Sky will answer. Ready to see your dashboard?`, 1200);
      void finalize(purchased);
    } catch {
      setApiError('Unable to provision a phone number right now. Please try again.');
      setPhoneSearching(false);
    }
  }

  async function handleSkipPhone() {
    userSay('Skip for now');
    await skySpeak("No problem — you can add a number anytime from Settings. Let me finish getting things set up for you...", 900);
    void finalize(null);
  }

  // ── Finalize onboarding ──────────────────────────────────────────────────

  async function finalize(phone: string | null) {
    setPhase('finalizing');
    try {
      const headers = await getClientInternalApiHeaders(() => getToken());

      const completeRes = await fetch(getApiBaseUrl() + '/v1/onboarding/complete', {
        method: 'POST',
        headers,
      });

      // Check subscription status for correct redirect
      const statusRes = await fetch(getApiBaseUrl() + '/v1/onboarding/status', {
        cache: 'no-store',
        headers,
      });

      if (statusRes.ok) {
        const statusPayload = await statusRes.json() as { steps?: { billing?: { data?: { subscriptionStatus?: string } } } };
        const subStatus = statusPayload?.steps?.billing?.data?.subscriptionStatus;
        setDashboardHref(canAccessDashboard(subStatus) ? '/dashboard' : '/billing?notice=subscription-required');
      }

      if (phone) setProvisionedPhone(phone);

      // Small pause to let the finalizing spinner breathe
      await new Promise((r) => setTimeout(r, 800));
      setPhase('done');
    } catch {
      // Even if complete call fails, send them to dashboard
      setPhase('done');
    }
  }

  // ── Skip entire onboarding ───────────────────────────────────────────────

  async function handleSkipAll() {
    setIsSkipping(true);
    setSkipError(null);
    try {
      const headers = await getClientInternalApiHeaders(() => getToken());
      const res = await fetch(getApiBaseUrl() + '/v1/onboarding/skip', {
        method: 'POST',
        headers,
      });
      if (!res.ok) {
        const p = await res.json().catch(() => ({})) as { error?: string };
        setSkipError(p.error ?? 'Unable to skip setup right now. Please try again.');
        setIsSkipping(false);
        return;
      }
      const statusRes = await fetch(getApiBaseUrl() + '/v1/onboarding/status', {
        cache: 'no-store',
        headers,
      });
      if (!statusRes.ok) {
        router.push('/billing?notice=subscription-required');
        return;
      }
      const statusPayload = await statusRes.json() as { steps?: { billing?: { data?: { subscriptionStatus?: string } } } };
      const subStatus = statusPayload?.steps?.billing?.data?.subscriptionStatus;
      router.push(canAccessDashboard(subStatus) ? '/dashboard' : '/billing?notice=subscription-required');
    } catch {
      setSkipError('Unable to skip setup right now. Please try again.');
      setIsSkipping(false);
    }
  }

  // ── Render loading ───────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <>
        <SkyStyles />
        <div className="sky-shell">
          <div className="sky-loading">
            <span className="sky-spin" />
            <span>Starting up Sky…</span>
          </div>
        </div>
      </>
    );
  }

  // ── Render done screen ───────────────────────────────────────────────────

  if (phase === 'done') {
    return (
      <>
        <SkyStyles />
        <DoneScreen
          businessName={bizName}
          phoneNumber={provisionedPhone}
          dashboardHref={dashboardHref}
        />
      </>
    );
  }

  // ── Render finalizing ────────────────────────────────────────────────────

  if (phase === 'finalizing') {
    return (
      <>
        <SkyStyles />
        <div className="sky-shell">
          <div className="sky-loading">
            <span className="sky-spin" />
            <span>Activating your AI front desk…</span>
          </div>
        </div>
      </>
    );
  }

  // ── Main chat render ─────────────────────────────────────────────────────

  const defaultGreetingText = (() => {
    const name = bizName || 'your business';
    if (language === 'es') return `Gracias por llamar a ${name}. ¿En qué le puedo ayudar hoy?`;
    if (language === 'bilingual') return `Thanks for calling ${name}. This is Sky — para español, solo siga hablando. How can I help you today?`;
    return `Thanks for calling ${name}. How can we help you today?`;
  })();

  return (
    <>
      <SkyStyles />
      <div className="sky-shell">
        {/* Header */}
        <div className="sky-header">
          <div className="sky-logo">SX</div>
          <div className="sky-header-text">
            <p className="sky-header-title">SkyBridgeCX</p>
            <p className="sky-header-sub">AI Front Desk Setup</p>
          </div>
        </div>

        {/* Chat area */}
        <div className="sky-chat">
          {messages.map((msg) => (
            <div key={msg.id} className={`sky-bubble-wrap sky-bubble-wrap--${msg.role}`}>
              {msg.role === 'sky' && <div className="sky-avatar">Sky</div>}
              <div className={`sky-bubble sky-bubble--${msg.role}`}>
                {msg.text.split('\n').map((line, i) => (
                  <span key={i}>
                    {line}
                    {i < msg.text.split('\n').length - 1 && <br />}
                  </span>
                ))}
              </div>
            </div>
          ))}

          {skyTyping && (
            <div className="sky-bubble-wrap sky-bubble-wrap--sky">
              <div className="sky-avatar">Sky</div>
              <div className="sky-bubble sky-bubble--sky sky-typing">
                <span className="sky-dot" />
                <span className="sky-dot" />
                <span className="sky-dot" />
              </div>
            </div>
          )}

          {/* Phase-specific input panels */}

          {phase === 'biz_name' && !skyTyping && (
            <div className="sky-input-panel sky-fadein">
              <div className="sky-text-row">
                <input
                  ref={nameInputRef}
                  type="text"
                  className="sky-text-input"
                  placeholder="e.g. Austin Pro Plumbing"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleBizName(); }}
                  maxLength={100}
                />
                <button
                  className="sky-send-btn"
                  onClick={() => void handleBizName()}
                  disabled={!nameInput.trim()}
                >
                  →
                </button>
              </div>
            </div>
          )}

          {phase === 'industry' && !skyTyping && (
            <div className="sky-input-panel sky-fadein">
              <div className="sky-chip-grid">
                {INDUSTRIES.map((ind) => (
                  <button
                    key={ind.value}
                    className="sky-chip"
                    onClick={() => void handleIndustry(ind.value, `${ind.emoji} ${ind.label}`)}
                  >
                    <span className="sky-chip-emoji">{ind.emoji}</span>
                    <span>{ind.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {phase === 'biz_details' && !skyTyping && (
            <div className="sky-input-panel sky-fadein">
              <div className="sky-field-group">
                <input
                  type="text"
                  className="sky-text-input"
                  placeholder="Business address (optional)"
                  value={bizAddress}
                  onChange={(e) => setBizAddress(e.target.value)}
                  maxLength={200}
                />
                <input
                  type="tel"
                  className="sky-text-input"
                  placeholder="Business phone (optional)"
                  value={bizPhone}
                  onChange={(e) => setBizPhone(e.target.value)}
                  maxLength={20}
                />
                <div className="sky-tz-row">
                  {TIMEZONES.map((tz) => (
                    <button
                      key={tz.value}
                      className={`sky-tz-chip ${timezone === tz.value ? 'sky-tz-chip--active' : ''}`}
                      onClick={() => setTimezone(tz.value)}
                    >
                      <span className="sky-tz-label">{tz.label}</span>
                      <span className="sky-tz-sub">{tz.sublabel}</span>
                    </button>
                  ))}
                </div>
                {apiError && <p className="sky-error">{apiError}</p>}
                <div className="sky-btn-row">
                  <button
                    className="sky-btn-ghost"
                    onClick={() => void handleBizDetails(true)}
                    disabled={submitting}
                  >
                    Skip for now
                  </button>
                  <button
                    className="sky-btn-primary"
                    onClick={() => void handleBizDetails(false)}
                    disabled={submitting}
                  >
                    {submitting ? 'Saving…' : 'Save & Continue →'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {phase === 'language' && !skyTyping && (
            <div className="sky-input-panel sky-fadein">
              <div className="sky-lang-grid">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.value}
                    className={`sky-lang-card ${language === lang.value ? 'sky-lang-card--active' : ''}`}
                    onClick={() => void handleLanguage(lang.value, lang.label)}
                  >
                    <div className="sky-lang-top">
                      <span className="sky-lang-label">{lang.label}</span>
                      {lang.recommended && <span className="sky-badge">Recommended</span>}
                    </div>
                    <p className="sky-lang-sub">{lang.sublabel}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {phase === 'greeting' && !skyTyping && (
            <div className="sky-input-panel sky-fadein">
              <div className="sky-field-group">
                {!useDefaultGreeting && (
                  <textarea
                    className="sky-textarea"
                    rows={3}
                    maxLength={500}
                    placeholder="Write your custom greeting here..."
                    value={customGreeting}
                    onChange={(e) => setCustomGreeting(e.target.value)}
                  />
                )}
                {apiError && <p className="sky-error">{apiError}</p>}
                <div className="sky-btn-row">
                  {useDefaultGreeting ? (
                    <>
                      <button
                        className="sky-btn-ghost"
                        onClick={() => setUseDefaultGreeting(false)}
                        disabled={submitting}
                      >
                        Customize
                      </button>
                      <button
                        className="sky-btn-primary"
                        onClick={() => void handleGreeting(true)}
                        disabled={submitting}
                      >
                        {submitting ? 'Saving…' : 'Sounds perfect ✓'}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="sky-btn-ghost"
                        onClick={() => { setUseDefaultGreeting(true); setCustomGreeting(''); }}
                        disabled={submitting}
                      >
                        ← Use default
                      </button>
                      <button
                        className="sky-btn-primary"
                        onClick={() => void handleGreeting(false)}
                        disabled={submitting || customGreeting.trim().length === 0}
                      >
                        {submitting ? 'Saving…' : 'Save Custom →'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {phase === 'phone' && !skyTyping && !provisionedPhone && (
            <div className="sky-input-panel sky-fadein">
              <div className="sky-field-group">
                <div className="sky-phone-row">
                  <div className="sky-phone-prefix">+1</div>
                  <input
                    type="text"
                    className="sky-text-input sky-area-input"
                    placeholder="Area code (e.g. 512)"
                    value={areaCode}
                    onChange={(e) => setAreaCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
                    maxLength={3}
                    disabled={phoneSearching}
                  />
                </div>
                {phoneSearching && (
                  <div className="sky-searching">
                    <span className="sky-spin sky-spin--sm" />
                    <span>Searching available numbers…</span>
                  </div>
                )}
                {apiError && <p className="sky-error">{apiError}</p>}
                <div className="sky-btn-row">
                  <button
                    className="sky-btn-ghost"
                    onClick={() => void handleSkipPhone()}
                    disabled={phoneSearching}
                  >
                    Skip for now
                  </button>
                  <button
                    className="sky-btn-primary"
                    onClick={() => void handleProvision()}
                    disabled={phoneSearching}
                  >
                    {phoneSearching ? 'Working…' : 'Get My Number →'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Skip all footer */}
        <div className="sky-footer">
          <button
            className="sky-skip-btn"
            onClick={() => void handleSkipAll()}
            disabled={isSkipping}
          >
            {isSkipping ? 'Skipping…' : 'Skip setup for now'}
          </button>
          {skipError && <p className="sky-error sky-error--center">{skipError}</p>}
        </div>
      </div>
    </>
  );
}

// ─── Styles (injected as a component to avoid global stylesheet churn) ────────

function SkyStyles() {
  return (
    <style>{`
      /* ── Reset / shell ── */
      .sky-shell {
        min-height: 100svh;
        background: #060a10;
        display: flex;
        flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        color: #f0f4f8;
      }

      /* ── Header ── */
      .sky-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 18px 24px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        background: rgba(255,255,255,0.02);
        backdrop-filter: blur(8px);
        position: sticky;
        top: 0;
        z-index: 10;
      }
      .sky-logo {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: linear-gradient(135deg, #4f46e5, #7c3aed);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 900;
        letter-spacing: 0.05em;
        color: #fff;
        flex-shrink: 0;
      }
      .sky-header-title {
        font-size: 15px;
        font-weight: 700;
        color: #f0f4f8;
        line-height: 1.2;
      }
      .sky-header-sub {
        font-size: 11px;
        color: #5a6a80;
      }

      /* ── Chat area ── */
      .sky-chat {
        flex: 1;
        overflow-y: auto;
        padding: 28px 16px 12px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-width: 680px;
        width: 100%;
        margin: 0 auto;
        box-sizing: border-box;
      }

      /* ── Bubble wrappers ── */
      .sky-bubble-wrap {
        display: flex;
        gap: 10px;
        align-items: flex-end;
        animation: skyMsgIn 0.32s ease forwards;
      }
      .sky-bubble-wrap--user {
        flex-direction: row-reverse;
      }

      /* ── Sky avatar ── */
      .sky-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: linear-gradient(135deg, #4f46e5, #7c3aed);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: 800;
        color: #fff;
        flex-shrink: 0;
        letter-spacing: 0.05em;
      }

      /* ── Bubbles ── */
      .sky-bubble {
        max-width: 78%;
        padding: 12px 16px;
        border-radius: 18px;
        font-size: 15px;
        line-height: 1.55;
      }
      .sky-bubble--sky {
        background: #0d1624;
        border: 1px solid rgba(255,255,255,0.08);
        color: #d0dce8;
        border-bottom-left-radius: 4px;
      }
      .sky-bubble--user {
        background: linear-gradient(135deg, #4f46e5, #6366f1);
        color: #fff;
        border-bottom-right-radius: 4px;
      }

      /* ── Typing indicator ── */
      .sky-typing {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 14px 18px;
        min-width: 60px;
      }
      .sky-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #4f46e5;
        animation: skyDot 1.2s ease-in-out infinite;
      }
      .sky-dot:nth-child(2) { animation-delay: 0.2s; }
      .sky-dot:nth-child(3) { animation-delay: 0.4s; }

      /* ── Input panels ── */
      .sky-input-panel {
        margin-top: 6px;
        padding-left: 42px;
      }
      .sky-fadein {
        animation: skyMsgIn 0.28s ease forwards;
      }

      /* ── Text input row ── */
      .sky-text-row {
        display: flex;
        gap: 8px;
      }
      .sky-text-input {
        flex: 1;
        background: #0d1624;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 12px;
        padding: 12px 16px;
        color: #f0f4f8;
        font-size: 15px;
        outline: none;
        transition: border-color 0.15s, box-shadow 0.15s;
      }
      .sky-text-input::placeholder { color: #3a4a5a; }
      .sky-text-input:focus {
        border-color: #4f46e5;
        box-shadow: 0 0 0 3px rgba(79,70,229,0.2);
      }
      .sky-send-btn {
        width: 46px;
        height: 46px;
        border-radius: 12px;
        background: linear-gradient(135deg, #4f46e5, #6366f1);
        color: #fff;
        font-size: 18px;
        border: none;
        cursor: pointer;
        flex-shrink: 0;
        transition: opacity 0.15s, transform 0.15s;
      }
      .sky-send-btn:disabled { opacity: 0.4; cursor: default; }
      .sky-send-btn:not(:disabled):hover { transform: scale(1.05); }

      /* ── Industry chip grid ── */
      .sky-chip-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
      }
      @media (min-width: 400px) {
        .sky-chip-grid { grid-template-columns: repeat(3, 1fr); }
      }
      .sky-chip {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.09);
        background: #0d1624;
        color: #c8d8e8;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: border-color 0.15s, background 0.15s, transform 0.1s;
        text-align: left;
      }
      .sky-chip:hover {
        border-color: #4f46e5;
        background: rgba(79,70,229,0.1);
        transform: translateY(-1px);
      }
      .sky-chip-emoji { font-size: 16px; }

      /* ── Field group ── */
      .sky-field-group {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      /* ── Timezone chips ── */
      .sky-tz-row {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
      }
      @media (min-width: 480px) {
        .sky-tz-row { grid-template-columns: repeat(4, 1fr); }
      }
      .sky-tz-chip {
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,0.09);
        background: #0d1624;
        cursor: pointer;
        text-align: center;
        transition: border-color 0.15s, background 0.15s;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .sky-tz-chip:hover { border-color: rgba(255,255,255,0.2); }
      .sky-tz-chip--active {
        border-color: #4f46e5;
        background: rgba(79,70,229,0.12);
        box-shadow: 0 0 0 1px rgba(79,70,229,0.4);
      }
      .sky-tz-label { font-size: 13px; font-weight: 600; color: #c8d8e8; }
      .sky-tz-sub { font-size: 10px; color: #5a6a80; }

      /* ── Language grid ── */
      .sky-lang-grid {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .sky-lang-card {
        padding: 14px 16px;
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,0.09);
        background: #0d1624;
        cursor: pointer;
        text-align: left;
        transition: border-color 0.15s, background 0.15s, transform 0.1s;
      }
      .sky-lang-card:hover {
        border-color: rgba(79,70,229,0.5);
        transform: translateY(-1px);
      }
      .sky-lang-card--active {
        border-color: #4f46e5;
        background: rgba(79,70,229,0.1);
        box-shadow: 0 0 0 1px rgba(79,70,229,0.4);
      }
      .sky-lang-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 4px;
      }
      .sky-lang-label { font-size: 14px; font-weight: 600; color: #f0f4f8; }
      .sky-lang-sub { font-size: 12px; color: #5a6a80; line-height: 1.4; }
      .sky-badge {
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: #818cf8;
        background: rgba(79,70,229,0.2);
        border: 1px solid rgba(79,70,229,0.4);
        border-radius: 999px;
        padding: 2px 8px;
      }

      /* ── Greeting textarea ── */
      .sky-textarea {
        width: 100%;
        background: #0d1624;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 12px;
        padding: 12px 16px;
        color: #f0f4f8;
        font-size: 14px;
        line-height: 1.55;
        resize: vertical;
        outline: none;
        box-sizing: border-box;
        font-family: inherit;
        transition: border-color 0.15s, box-shadow 0.15s;
      }
      .sky-textarea::placeholder { color: #3a4a5a; }
      .sky-textarea:focus {
        border-color: #4f46e5;
        box-shadow: 0 0 0 3px rgba(79,70,229,0.2);
      }

      /* ── Phone row ── */
      .sky-phone-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .sky-phone-prefix {
        padding: 12px 14px;
        background: #0d1624;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 12px;
        color: #5a6a80;
        font-size: 14px;
        font-family: ui-monospace, monospace;
        flex-shrink: 0;
      }
      .sky-area-input {
        width: 140px;
        flex: none;
        font-family: ui-monospace, monospace;
        font-size: 18px;
        text-align: center;
        letter-spacing: 0.1em;
      }
      .sky-searching {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #818cf8;
        font-size: 13px;
      }

      /* ── Buttons ── */
      .sky-btn-row {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      .sky-btn-primary {
        padding: 11px 22px;
        border-radius: 12px;
        background: linear-gradient(135deg, #4f46e5, #6366f1);
        color: #fff;
        font-size: 14px;
        font-weight: 700;
        border: none;
        cursor: pointer;
        transition: opacity 0.15s, transform 0.1s, box-shadow 0.15s;
      }
      .sky-btn-primary:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 8px 24px rgba(79,70,229,0.4);
      }
      .sky-btn-primary:disabled { opacity: 0.5; cursor: default; }
      .sky-btn-ghost {
        padding: 11px 18px;
        border-radius: 12px;
        background: transparent;
        border: 1px solid rgba(255,255,255,0.1);
        color: #5a6a80;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: border-color 0.15s, color 0.15s;
      }
      .sky-btn-ghost:hover:not(:disabled) {
        border-color: rgba(255,255,255,0.2);
        color: #c8d8e8;
      }
      .sky-btn-ghost:disabled { opacity: 0.4; cursor: default; }

      /* ── Error ── */
      .sky-error {
        font-size: 13px;
        color: #f87171;
        background: rgba(248,113,113,0.1);
        border: 1px solid rgba(248,113,113,0.2);
        border-radius: 8px;
        padding: 8px 12px;
      }
      .sky-error--center { text-align: center; }

      /* ── Footer ── */
      .sky-footer {
        padding: 16px 24px;
        text-align: center;
        border-top: 1px solid rgba(255,255,255,0.05);
      }
      .sky-skip-btn {
        font-size: 12px;
        color: #3a4a5a;
        background: none;
        border: none;
        cursor: pointer;
        text-decoration: underline;
        text-underline-offset: 3px;
        transition: color 0.15s;
      }
      .sky-skip-btn:hover:not(:disabled) { color: #818cf8; }
      .sky-skip-btn:disabled { opacity: 0.5; cursor: default; }

      /* ── Loading ── */
      .sky-loading {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        font-size: 14px;
        color: #5a6a80;
      }
      .sky-spin {
        display: inline-block;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        border: 2px solid rgba(79,70,229,0.2);
        border-top-color: #4f46e5;
        animation: skySpin 0.7s linear infinite;
        flex-shrink: 0;
      }
      .sky-spin--sm {
        width: 13px;
        height: 13px;
      }

      /* ── Keyframes ── */
      @keyframes skyMsgIn {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes skyDot {
        0%, 80%, 100% { transform: translateY(0); opacity: 0.35; }
        40%            { transform: translateY(-5px); opacity: 1; }
      }
      @keyframes skySpin {
        to { transform: rotate(360deg); }
      }
      @keyframes skyFadeIn {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      @keyframes skyPopIn {
        from { opacity: 0; transform: scale(0.4); }
        to   { opacity: 1; transform: scale(1); }
      }
      @keyframes skyFadeUp {
        from { opacity: 0; transform: translateY(24px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `}</style>
  );
}
