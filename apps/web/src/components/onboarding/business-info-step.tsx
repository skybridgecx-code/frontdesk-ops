'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { getApiBaseUrl, getClientInternalApiHeaders } from '@/lib/api-client';

type BusinessInfoStepProps = {
  onComplete: (data: { businessName: string }) => void;
};

type BusinessInfoResponse = {
  success?: boolean;
  error?: string;
};

const INDUSTRY_OPTIONS = [
  { label: 'Plumbing', value: 'plumbing' },
  { label: 'HVAC', value: 'hvac' },
  { label: 'Electrical', value: 'electrical' },
  { label: 'Roofing', value: 'roofing' },
  { label: 'Landscaping', value: 'landscaping' },
  { label: 'Cleaning', value: 'cleaning' },
  { label: 'Pest Control', value: 'pest-control' },
  { label: 'Painting', value: 'painting' },
  { label: 'General Contractor', value: 'general-contractor' },
  { label: 'Other', value: 'other' }
];

const TIMEZONE_OPTIONS = [
  { label: 'Eastern (America/New_York)', value: 'America/New_York' },
  { label: 'Central (America/Chicago)', value: 'America/Chicago' },
  { label: 'Mountain (America/Denver)', value: 'America/Denver' },
  { label: 'Pacific (America/Los_Angeles)', value: 'America/Los_Angeles' }
];

function parseError(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return 'Unable to save business info. Please try again.';
  }

  const value = payload as { error?: unknown };
  if (typeof value.error === 'string' && value.error.trim().length > 0) {
    return value.error;
  }

  return 'Unable to save business info. Please try again.';
}

export function BusinessInfoStep({ onComplete }: BusinessInfoStepProps) {
  const { getToken } = useAuth();

  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return businessName.trim().length >= 2 && industry.trim().length > 0 && !isSubmitting;
  }, [businessName, industry, isSubmitting]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedBusinessName = businessName.trim();
    if (trimmedBusinessName.length < 2) {
      setErrorMessage('Business name must be at least 2 characters.');
      return;
    }

    if (!industry) {
      setErrorMessage('Please select an industry.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch(getApiBaseUrl() + '/v1/onboarding/business-info', {
        method: 'POST',
        headers: {
          ...(await getClientInternalApiHeaders(() => getToken())),
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          businessName: trimmedBusinessName,
          industry,
          businessAddress: businessAddress.trim() || undefined,
          businessPhone: businessPhone.trim() || undefined,
          timezone: timezone.trim() || 'America/New_York'
        })
      });

      const payload = (await response.json()) as BusinessInfoResponse;

      if (!response.ok || !payload.success) {
        setErrorMessage(parseError(payload));
        return;
      }

      onComplete({ businessName: trimmedBusinessName });
    } catch {
      setErrorMessage('Unable to save business info. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-white p-8 shadow-sm">
      <h2 className="mb-1 text-xl font-semibold text-gray-900">Tell us about your business</h2>
      <p className="mb-6 text-sm text-gray-500">This helps us personalize your AI receptionist</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="business-name" className="mb-1 block text-sm font-medium text-gray-700">
            Business Name
          </label>
          <input
            id="business-name"
            type="text"
            value={businessName}
            onChange={(event) => setBusinessName(event.target.value)}
            placeholder="e.g. Johnson Plumbing"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            required
          />
        </div>

        <div>
          <label htmlFor="industry" className="mb-1 block text-sm font-medium text-gray-700">
            Industry
          </label>
          <select
            id="industry"
            value={industry}
            onChange={(event) => setIndustry(event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            required
          >
            <option value="">Select an industry</option>
            {INDUSTRY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="business-address" className="mb-1 block text-sm font-medium text-gray-700">
            Business Address (optional)
          </label>
          <input
            id="business-address"
            type="text"
            value={businessAddress}
            onChange={(event) => setBusinessAddress(event.target.value)}
            placeholder="123 Main St, Anytown, USA"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div>
          <label htmlFor="business-phone" className="mb-1 block text-sm font-medium text-gray-700">
            Business Phone (optional)
          </label>
          <input
            id="business-phone"
            type="tel"
            value={businessPhone}
            onChange={(event) => setBusinessPhone(event.target.value)}
            placeholder="(555) 123-4567"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div>
          <label htmlFor="timezone" className="mb-1 block text-sm font-medium text-gray-700">
            Timezone (optional)
          </label>
          <select
            id="timezone"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            {TIMEZONE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
              Saving...
            </span>
          ) : (
            'Continue →'
          )}
        </button>

        {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
      </form>
    </div>
  );
}
