'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { getApiBaseUrl, getClientInternalApiHeaders } from '@/lib/api-client';
import { formatPhoneNumber } from '@/lib/call-utils';

type CompletionStepProps = {
  businessName: string;
  phoneNumber: string | null;
  postOnboardingHref: string;
  onGoToPhoneStep?: () => void;
};

type CompletionResponse = {
  success?: boolean;
  error?: string;
};

type SummaryRowProps = {
  icon: string;
  label: string;
  value: string;
};

function SummaryRow({ icon, label, value }: SummaryRowProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-lg">{icon}</span>
      <div>
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5a6a80]">{label}</p>
        <p className="text-sm font-medium text-[#f0f4f8]">{value}</p>
      </div>
    </div>
  );
}

function parseError(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return 'Unable to finalize onboarding right now.';
  }

  const value = payload as { error?: unknown };
  if (typeof value.error === 'string' && value.error.trim().length > 0) {
    return value.error;
  }

  return 'Unable to finalize onboarding right now.';
}

export function CompletionStep({ businessName, phoneNumber, postOnboardingHref, onGoToPhoneStep }: CompletionStepProps) {
  const { getToken } = useAuth();
  const [isFinalizing, setIsFinalizing] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const missingPhone = !phoneNumber;
  const primaryCtaLabel =
    postOnboardingHref === '/dashboard' ? 'Go to Dashboard →' : 'Continue to Billing →';

  const formattedBusinessName = useMemo(() => {
    const normalized = businessName.trim();
    return normalized.length > 0 ? normalized : 'your business';
  }, [businessName]);

  const formattedPhone = useMemo(() => {
    if (!phoneNumber) {
      return null;
    }

    return formatPhoneNumber(phoneNumber);
  }, [phoneNumber]);

  useEffect(() => {
    let mounted = true;

    async function finalizeOnboarding() {
      setIsFinalizing(true);
      setErrorMessage(null);

      try {
        const headers = await getClientInternalApiHeaders(() => getToken());

        const completeResponse = await fetch(getApiBaseUrl() + '/v1/onboarding/complete', {
          method: 'POST',
          headers
        });

        if (completeResponse.ok) {
          if (mounted) {
            setIsFinalizing(false);
          }
          return;
        }

        const completePayload = (await completeResponse.json()) as CompletionResponse;

        throw new Error(parseError(completePayload));
      } catch (error) {
        if (!mounted) {
          return;
        }

        if (error instanceof Error && error.message.trim().length > 0) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage('Unable to finalize onboarding right now.');
        }
      } finally {
        if (mounted) {
          setIsFinalizing(false);
        }
      }
    }

    void finalizeOnboarding();

    return () => {
      mounted = false;
    };
  }, [getToken]);

  return (
    <div className="py-12 text-center">
      <div
        className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border text-2xl ${
          missingPhone
            ? 'border-amber-300/30 bg-amber-300/10'
            : 'border-[#00d4ff]/30 bg-[#00d4ff]/10'
        }`}
      >
        {missingPhone ? '📞' : '✓'}
      </div>
      <p
        className={`font-mono text-[10px] font-semibold uppercase tracking-[0.24em] ${
          missingPhone ? 'text-amber-300' : 'text-[#00d4ff]'
        }`}
      >
        {missingPhone ? 'Action Required' : 'Activated'}
      </p>
      <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.04em] text-[#f0f4f8]">
        {missingPhone ? 'Phone number required' : 'You are all set'}
      </h2>
      <p className="mx-auto mt-3 max-w-md text-[#5a6a80]">
        {missingPhone ? (
          <>Provision a business phone number before finishing onboarding.</>
        ) : (
          <>
            Your AI front desk for <span className="font-semibold text-[#c8d8e8]">{formattedBusinessName}</span> is live.
            Customers can reach you at <span className="font-mono text-[#00d4ff]">{formattedPhone}</span>.
          </>
        )}
      </p>

      {isFinalizing ? (
        <div className="mx-auto mt-4 flex w-fit items-center gap-2 rounded-full border border-[#00d4ff]/20 bg-[#00d4ff]/[0.06] px-3 py-1 text-sm text-[#00d4ff]">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#00d4ff]/30 border-t-[#00d4ff]" />
          Finalizing setup...
        </div>
      ) : null}

      {errorMessage ? (
        <p className="mx-auto mt-3 max-w-md rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {errorMessage}
        </p>
      ) : null}

      <div className="mx-auto mt-8 max-w-md rounded-2xl border border-white/10 bg-[#0d1320] p-6 text-left shadow-[0_30px_60px_rgba(0,0,0,0.45)]">
        <h3 className="mb-4 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#00d4ff]">Setup Summary</h3>
        <div className="space-y-3">
          <SummaryRow icon="🏢" label="Business" value={formattedBusinessName} />
          <SummaryRow icon="📞" label="Phone" value={formattedPhone ?? 'Not set up'} />
          <SummaryRow icon="💬" label="Greeting" value="Configured" />
        </div>
      </div>

      <div className="mx-auto mt-8 max-w-md space-y-3">
        {missingPhone ? (
          <button
            type="button"
            onClick={onGoToPhoneStep}
            className="inline-block w-full rounded-xl bg-[#00d4ff] py-3 text-center text-sm font-bold tracking-tight text-[#020305] transition hover:bg-[#33ddff] hover:shadow-[0_12px_32px_rgba(0,212,255,0.35)]"
          >
            Back to Phone Number →
          </button>
        ) : (
          <>
            <Link
              href={postOnboardingHref}
              className="inline-block w-full rounded-xl bg-[#00d4ff] py-3 text-center text-sm font-bold tracking-tight text-[#020305] transition hover:bg-[#33ddff] hover:shadow-[0_12px_32px_rgba(0,212,255,0.35)]"
            >
              {primaryCtaLabel}
            </Link>

            {postOnboardingHref === '/dashboard' ? (
              <Link
                href="/billing"
                className="inline-block w-full rounded-xl border border-white/10 bg-transparent py-3 text-center text-sm font-medium text-[#c8d8e8] transition hover:border-white/25 hover:bg-white/[0.04]"
              >
                Choose a Plan
              </Link>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
