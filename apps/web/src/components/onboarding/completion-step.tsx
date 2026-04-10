'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { getApiBaseUrl, getClientInternalApiHeaders } from '@/lib/api-client';
import { formatPhoneNumber } from '@/lib/call-utils';

type CompletionStepProps = {
  businessName: string;
  phoneNumber: string | null;
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
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-medium text-gray-900">{value}</p>
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

export function CompletionStep({ businessName, phoneNumber }: CompletionStepProps) {
  const { getToken } = useAuth();
  const [isFinalizing, setIsFinalizing] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

        if (completeResponse.status === 400 && !phoneNumber) {
          const skipResponse = await fetch(getApiBaseUrl() + '/v1/onboarding/skip', {
            method: 'POST',
            headers
          });

          if (!skipResponse.ok) {
            const skipPayload = (await skipResponse.json()) as CompletionResponse;
            throw new Error(parseError(skipPayload));
          }

          if (mounted) {
            setIsFinalizing(false);
          }

          return;
        }

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
  }, [getToken, phoneNumber]);

  return (
    <div className="py-12 text-center">
      <div className="mb-4 text-6xl">🎉</div>
      <h2 className="text-2xl font-bold text-gray-900">You are all set</h2>
      <p className="mx-auto mt-2 max-w-md text-gray-500">
        Your AI receptionist for <strong>{formattedBusinessName}</strong> is ready to take calls.
        {formattedPhone ? (
          <>
            {' '}
            Customers can reach you at <strong>{formattedPhone}</strong>.
          </>
        ) : null}
      </p>

      {isFinalizing ? (
        <div className="mx-auto mt-4 flex w-fit items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600/40 border-t-blue-700" />
          Finalizing setup...
        </div>
      ) : null}

      {errorMessage ? <p className="mt-3 text-sm text-red-600">{errorMessage}</p> : null}

      <div className="mx-auto mt-8 max-w-md rounded-2xl border bg-white p-6 text-left shadow-sm">
        <h3 className="mb-4 font-semibold text-gray-900">Setup Summary</h3>
        <div className="space-y-3">
          <SummaryRow icon="🏢" label="Business" value={formattedBusinessName} />
          <SummaryRow icon="📞" label="Phone" value={formattedPhone ?? 'Not set up'} />
          <SummaryRow icon="💬" label="Greeting" value="Configured" />
        </div>
      </div>

      <div className="mt-8 space-y-3">
        <Link
          href="/dashboard"
          className="inline-block w-full max-w-md rounded-xl bg-blue-600 py-3 text-center font-medium text-white transition hover:bg-blue-700"
        >
          Go to Dashboard →
        </Link>

        <Link
          href="/billing"
          className="inline-block w-full max-w-md rounded-xl border bg-white py-3 text-center font-medium text-gray-700 transition hover:bg-gray-50"
        >
          Choose a Plan
        </Link>
      </div>
    </div>
  );
}
