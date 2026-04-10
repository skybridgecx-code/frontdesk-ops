'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { getApiBaseUrl, getClientInternalApiHeaders } from '@/lib/api-client';

type GreetingStepProps = {
  onComplete: () => void;
  goBack: () => void;
  businessName: string;
};

type GreetingResponse = {
  success?: boolean;
  error?: string;
};

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

export function GreetingStep({ onComplete, goBack, businessName }: GreetingStepProps) {
  const { getToken } = useAuth();

  const [useDefaultGreeting, setUseDefaultGreeting] = useState(true);
  const [customGreeting, setCustomGreeting] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const defaultGreeting = useMemo(() => {
    const name = businessName.trim().length > 0 ? businessName : 'your business';
    return 'Thanks for calling ' + name + '. How can we help you today?';
  }, [businessName]);

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
            ? { useDefault: true }
            : {
                greeting: customGreeting.trim()
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
    <div className="rounded-2xl border bg-white p-8 shadow-sm">
      <h2 className="mb-1 text-xl font-semibold text-gray-900">Configure your AI greeting</h2>
      <p className="mb-6 text-sm text-gray-500">Choose a default greeting or write your own custom intro.</p>

      <div className="mb-6 rounded-xl bg-blue-50 p-6">
        <p className="mb-1 text-sm font-medium text-blue-600">Default Greeting</p>
        <p className="italic text-blue-900">&quot;{defaultGreeting}&quot;</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="radio"
              name="greeting-mode"
              checked={useDefaultGreeting}
              onChange={() => setUseDefaultGreeting(true)}
            />
            Use default greeting
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="radio"
              name="greeting-mode"
              checked={!useDefaultGreeting}
              onChange={() => setUseDefaultGreeting(false)}
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
              className="w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            <p className="mt-1 text-right text-xs text-gray-500">{customGreeting.length}/500</p>
          </div>
        ) : null}

        <div className="rounded-xl bg-gray-50 p-4">
          <p className="mb-1 text-xs text-gray-500">Your callers will hear:</p>
          <p className="font-medium text-gray-800">&quot;{previewGreeting}&quot;</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <button
            type="button"
            onClick={goBack}
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            ← Back
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Saving...' : 'Continue →'}
          </button>
        </div>

        {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
      </form>
    </div>
  );
}
