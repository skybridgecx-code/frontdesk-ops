'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { getApiBaseUrl, getClientInternalApiHeaders } from '@/lib/api-client';

type GreetingStepProps = {
  onComplete: () => void;
  goBack: () => void;
  businessName: string;
  initialLanguage?: AgentLanguage | null;
};

type GreetingResponse = {
  success?: boolean;
  error?: string;
};

type AgentLanguage = 'en' | 'es' | 'bilingual';

const LANGUAGE_OPTIONS: Array<{
  value: AgentLanguage;
  label: string;
  blurb: string;
  recommended?: boolean;
}> = [
  {
    value: 'bilingual',
    label: 'Bilingual (auto-detect)',
    blurb:
      'Sky greets in English + Spanish, then locks to whichever language the caller uses. Recommended for US home-services contractors.',
    recommended: true
  },
  {
    value: 'en',
    label: 'English only',
    blurb: 'Use only when your service area has negligible Spanish-speaking demand.'
  },
  {
    value: 'es',
    label: 'Solo en español',
    blurb: 'Usar cuando su negocio atiende casi exclusivamente a hispanohablantes.'
  }
];

function parseError(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return 'Unable to save greeting. Please try again.';
  }

  const value = payload as { error?: unknown };
  if (typeof value.error === 'string' && value.error.trim().length > 0) {
    return value.error;
  }

  return 'Unable to save greeting. Please try again.';
}

export function GreetingStep({ onComplete, goBack, businessName, initialLanguage }: GreetingStepProps) {
  const { getToken } = useAuth();

  const [useDefaultGreeting, setUseDefaultGreeting] = useState(true);
  const [customGreeting, setCustomGreeting] = useState('');
  const [language, setLanguage] = useState<AgentLanguage>(initialLanguage ?? 'bilingual');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const defaultGreeting = useMemo(() => {
    const name = businessName.trim().length > 0 ? businessName : 'your business';
    if (language === 'es') {
      return 'Gracias por llamar a ' + name + '. ¿En qué le puedo ayudar hoy?';
    }
    if (language === 'bilingual') {
      return (
        'Thanks for calling ' +
        name +
        '. This is Sky — para español, solo siga hablando. How can I help you today?'
      );
    }
    return 'Thanks for calling ' + name + '. How can we help you today?';
  }, [businessName, language]);

  const previewGreeting = useDefaultGreeting
    ? defaultGreeting
    : customGreeting.trim().length > 0
      ? customGreeting.trim()
      : defaultGreeting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!useDefaultGreeting && customGreeting.trim().length === 0) {
      setErrorMessage('Please enter a custom greeting or use the default greeting.');
      return;
    }

    if (!useDefaultGreeting && customGreeting.trim().length > 500) {
      setErrorMessage('Custom greeting cannot exceed 500 characters.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch(getApiBaseUrl() + '/v1/onboarding/greeting', {
        method: 'POST',
        headers: {
          ...(await getClientInternalApiHeaders(() => getToken())),
          'content-type': 'application/json'
        },
        body: JSON.stringify(
          useDefaultGreeting
            ? { useDefault: true, language }
            : {
                greeting: customGreeting.trim(),
                language
              }
        )
      });

      const payload = (await response.json()) as GreetingResponse;
      if (!response.ok || !payload.success) {
        setErrorMessage(parseError(payload));
        return;
      }

      onComplete();
    } catch {
      setErrorMessage('Unable to save greeting. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d1320] p-8 shadow-[0_30px_60px_rgba(0,0,0,0.45)]">
      <h2 className="mb-1 text-xl font-bold tracking-tight text-[#f0f4f8]">Configure your AI greeting</h2>
      <p className="mb-6 text-sm text-[#5a6a80]">This is the first thing every caller hears. Keep it warm and short.</p>

      <div className="mb-6 space-y-3">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5a6a80]">
          Agent Language
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {LANGUAGE_OPTIONS.map((option) => {
            const isActive = language === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setLanguage(option.value)}
                className={[
                  'rounded-xl border p-4 text-left transition',
                  isActive
                    ? 'border-[#00d4ff] bg-[#00d4ff]/[0.08] shadow-[0_0_0_1px_rgba(0,212,255,0.4)]'
                    : 'border-white/10 bg-[#080c12] hover:border-white/25'
                ].join(' ')}
              >
                <div className="flex items-center justify-between">
                  <p className={['text-sm font-semibold', isActive ? 'text-[#f0f4f8]' : 'text-[#c8d8e8]'].join(' ')}>
                    {option.label}
                  </p>
                  {option.recommended ? (
                    <span className="rounded-full border border-[#00d4ff]/40 bg-[#00d4ff]/10 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-[#00d4ff]">
                      Recommended
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[#5a6a80]">{option.blurb}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-[#00d4ff]/20 bg-[#00d4ff]/[0.06] p-5">
        <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#00d4ff]">
          {language === 'es' ? 'Saludo por defecto' : 'Default Greeting'}
        </p>
        <p className="italic text-[#c8d8e8]">&quot;{defaultGreeting}&quot;</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-[#c8d8e8]">
            <input
              type="radio"
              name="greeting-mode"
              checked={useDefaultGreeting}
              onChange={() => setUseDefaultGreeting(true)}
              className="accent-[#00d4ff]"
            />
            Use default greeting
          </label>

          <label className="flex items-center gap-2 text-sm text-[#c8d8e8]">
            <input
              type="radio"
              name="greeting-mode"
              checked={!useDefaultGreeting}
              onChange={() => setUseDefaultGreeting(false)}
              className="accent-[#00d4ff]"
            />
            Write a custom greeting
          </label>
        </div>

        {!useDefaultGreeting ? (
          <div>
            <textarea
              rows={3}
              maxLength={500}
              value={customGreeting}
              onChange={(event) => setCustomGreeting(event.target.value)}
              placeholder="Thanks for calling! We appreciate your business. How can I help you today?"
              className="w-full rounded-lg border border-white/10 bg-[#080c12] p-3 text-sm text-[#f0f4f8] placeholder:text-[#5a6a80] focus:border-[#00d4ff] focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/25"
            />
            <p className="mt-1 text-right text-xs text-[#5a6a80]">{customGreeting.length}/500</p>
          </div>
        ) : null}

        <div className="rounded-xl border border-white/5 bg-[#080c12] p-4">
          <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5a6a80]">
            Your callers will hear:
          </p>
          <p className="font-medium text-[#f0f4f8]">&quot;{previewGreeting}&quot;</p>
        </div>

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-between">
          <button
            type="button"
            onClick={goBack}
            className="rounded-xl border border-white/10 bg-transparent px-4 py-2.5 text-sm font-medium text-[#c8d8e8] transition hover:border-white/25 hover:bg-white/[0.04]"
          >
            ← Back
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl bg-[#00d4ff] px-5 py-2.5 text-sm font-bold tracking-tight text-[#020305] transition hover:bg-[#33ddff] hover:shadow-[0_12px_32px_rgba(0,212,255,0.35)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Continue →'}
          </button>
        </div>

        {errorMessage ? (
          <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">{errorMessage}</p>
        ) : null}
      </form>
    </div>
  );
}
