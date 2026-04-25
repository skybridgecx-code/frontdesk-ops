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

  const inputClass =
    'w-full rounded-lg border border-white/10 bg-[#080c12] px-3 py-2.5 text-sm text-[#f0f4f8] placeholder:text-[#5a6a80] focus:border-[#00d4ff] focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/25';
  const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-[#5a6a80]';

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d1320] p-8 shadow-[0_30px_60px_rgba(0,0,0,0.45)]">
      <h2 className="mb-1 text-xl font-bold tracking-tight text-[#f0f4f8]">Tell us about your business</h2>
      <p className="mb-6 text-sm text-[#5a6a80]">This is how your AI front desk will greet callers and route their leads.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="business-name" className={labelClass}>
            Business Name
          </label>
          <input
            id="business-name"
            type="text"
            value={businessName}
            onChange={(event) => setBusinessName(event.target.value)}
            placeholder="e.g. Johnson Plumbing"
            className={inputClass}
            required
          />
        </div>

        <div>
          <label htmlFor="industry" className={labelClass}>
            Industry
          </label>
          <select
            id="industry"
            value={industry}
            onChange={(event) => setIndustry(event.target.value)}
            className={inputClass}
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
          <label htmlFor="business-address" className={labelClass}>
            Business Address (optional)
          </label>
          <input
            id="business-address"
            type="text"
            value={businessAddress}
            onChange={(event) => setBusinessAddress(event.target.value)}
            placeholder="123 Main St, Anytown, USA"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="business-phone" className={labelClass}>
            Business Phone (optional)
          </label>
          <input
            id="business-phone"
            type="tel"
            value={businessPhone}
            onChange={(event) => setBusinessPhone(event.target.value)}
            placeholder="(555) 123-4567"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="timezone" className={labelClass}>
            Timezone (optional)
          </label>
          <select
            id="timezone"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            className={inputClass}
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
          className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-[#00d4ff] px-4 py-3 text-sm font-bold tracking-tight text-[#020305] transition hover:bg-[#33ddff] hover:shadow-[0_12px_32px_rgba(0,212,255,0.35)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#020305]/40 border-t-[#020305]" />
              Saving...
            </span>
          ) : (
            'Continue →'
          )}
        </button>

        {errorMessage ? (
          <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">{errorMessage}</p>
        ) : null}
      </form>
    </div>
  );
}
