'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { getApiBaseUrl, getClientInternalApiHeaders } from '@/lib/api-client';
import { formatPhoneNumber } from '@/lib/call-utils';

type PhoneNumberStepProps = {
  onComplete: (data: { phoneNumber: string | null }) => void;
  goBack: () => void;
};

type PhoneNumberResponse = {
  success?: boolean;
  phoneNumber?: string | null;
  error?: string;
};

type LoadingStage = 'searching' | 'provisioning' | null;

function parseError(payload: unknown, fallbackText?: string) {
  if (!payload || typeof payload !== 'object') {
    const trimmedFallback = fallbackText?.trim();
    if (trimmedFallback && trimmedFallback.length > 0 && trimmedFallback.toLowerCase() !== 'bad request') {
      return trimmedFallback;
    }
    return 'Could not provision a phone number right now. Try another area code or leave the field blank.';
  }

  const value = payload as { error?: unknown };
  if (typeof value.error === 'string' && value.error.trim().length > 0) {
    const normalized = value.error.trim();
    if (normalized.toLowerCase() === 'bad request') {
      return 'Could not provision a phone number right now. Try another area code or leave the field blank.';
    }
    return normalized;
  }

  return 'Could not provision a phone number right now. Try another area code or leave the field blank.';
}

export function PhoneNumberStep({ onComplete, goBack }: PhoneNumberStepProps) {
  const { getToken } = useAuth();

  const [areaCode, setAreaCode] = useState('');
  const [loadingStage, setLoadingStage] = useState<LoadingStage>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [provisionedPhoneNumber, setProvisionedPhoneNumber] = useState<string | null>(null);

  const isLoading = loadingStage !== null;

  const formattedPhoneNumber = useMemo(() => {
    if (!provisionedPhoneNumber) {
      return null;
    }

    return formatPhoneNumber(provisionedPhoneNumber);
  }, [provisionedPhoneNumber]);

  async function handleProvision() {
    const normalizedAreaCode = areaCode.trim();

    if (normalizedAreaCode.length > 0 && !/^\d{3}$/.test(normalizedAreaCode)) {
      setErrorMessage('Area code must be exactly 3 digits.');
      return;
    }

    setErrorMessage(null);
    setLoadingStage('searching');

    let timerId: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      setLoadingStage('provisioning');
    }, 800);

    try {
      const response = await fetch(getApiBaseUrl() + '/v1/onboarding/phone-number', {
        method: 'POST',
        headers: {
          ...(await getClientInternalApiHeaders(() => getToken())),
          'content-type': 'application/json'
        },
        body: JSON.stringify(
          normalizedAreaCode.length > 0
            ? {
                areaCode: normalizedAreaCode
              }
            : {}
        )
      });

      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }

      let payload: PhoneNumberResponse = {};
      const responseText = await response.text();
      if (responseText.trim().length > 0) {
        try {
          payload = JSON.parse(responseText) as PhoneNumberResponse;
        } catch {
          payload = {};
        }
      }

      if (!response.ok || !payload.success || !payload.phoneNumber) {
        setErrorMessage(parseError(payload, response.statusText));
        setLoadingStage(null);
        return;
      }

      setProvisionedPhoneNumber(payload.phoneNumber);
      setLoadingStage(null);
    } catch {
      if (timerId) {
        clearTimeout(timerId);
      }

      setLoadingStage(null);
      setErrorMessage('Unable to provision a phone number right now.');
    }
  }

  return (
    <div className="rounded-2xl border bg-white p-8 shadow-sm">
      <h2 className="mb-1 text-xl font-semibold text-gray-900">Get your AI phone number</h2>
      <p className="mb-6 text-sm text-gray-500">
        We will provision a local phone number for your AI receptionist. Customers call this number and your AI answers instantly.
      </p>

      <div className="mt-4">
        <label htmlFor="area-code" className="text-sm font-medium text-gray-700">
          Preferred area code (optional)
        </label>
        <input
          id="area-code"
          type="text"
          maxLength={3}
          value={areaCode}
          onChange={(event) => setAreaCode(event.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
          placeholder="e.g. 212"
          className="mt-1 w-24 rounded-lg border border-gray-300 p-2 text-center text-lg font-mono text-gray-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
        <p className="mt-1 text-xs text-gray-400">
          We will try to find a number with this area code. Leave blank for any available number.
        </p>
      </div>

      {!provisionedPhoneNumber ? (
        <button
          type="button"
          onClick={handleProvision}
          disabled={isLoading}
          className="mt-6 w-full rounded-xl bg-blue-600 py-3 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? 'Working...' : '🔍 Find & Provision Number'}
        </button>
      ) : null}

      {isLoading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-blue-700">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600/50 border-t-blue-700" />
          {loadingStage === 'searching' ? 'Searching for available numbers...' : 'Provisioning your number...'}
        </div>
      ) : null}

      {provisionedPhoneNumber ? (
        <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-6 text-center">
          <p className="text-sm font-medium text-green-600">Your AI phone number is ready</p>
          <p className="mt-2 text-3xl font-bold text-green-900">{formattedPhoneNumber}</p>
          <p className="mt-2 text-xs text-green-600">Customers can call this number right now</p>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">{errorMessage}</p>
          <p className="mt-1 text-xs text-red-600">You can skip this step and set it up later.</p>
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={goBack}
          className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          ← Back
        </button>

        <button
          type="button"
          onClick={() => onComplete({ phoneNumber: null })}
          className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          Skip this step →
        </button>
      </div>

      {provisionedPhoneNumber ? (
        <button
          type="button"
          onClick={() => onComplete({ phoneNumber: provisionedPhoneNumber })}
          className="mt-4 w-full rounded-xl bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700"
        >
          Continue →
        </button>
      ) : null}
    </div>
  );
}
