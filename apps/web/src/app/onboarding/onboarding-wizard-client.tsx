'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { getApiBaseUrl, getClientInternalApiHeaders } from '@/lib/api-client';
import { StepProgress } from '@/components/onboarding/step-progress';
import { BusinessInfoStep } from '@/components/onboarding/business-info-step';
import { GreetingStep } from '@/components/onboarding/greeting-step';
import { PhoneNumberStep } from '@/components/onboarding/phone-number-step';
import { CompletionStep } from '@/components/onboarding/completion-step';

type OnboardingStatusResponse = {
  onboardingStep: number;
  onboardingComplete: boolean;
  steps: {
    businessInfo: {
      complete: boolean;
      data: {
        businessName: string | null;
        industry: string | null;
        businessAddress: string | null;
        businessPhone: string | null;
        timezone: string | null;
      };
    };
    greeting: {
      complete: boolean;
      data: {
        greeting: string | null;
      };
    };
    phoneNumber: {
      complete: boolean;
      data: {
        twilioPhoneNumber: string | null;
      };
    };
    billing: {
      complete: boolean;
      data: {
        plan: string;
        subscriptionStatus: string;
      };
    };
  };
};

type ApiErrorPayload = {
  error?: string;
};

function parseError(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return 'Request failed. Please try again.';
  }

  const value = payload as ApiErrorPayload;
  if (typeof value.error === 'string' && value.error.trim().length > 0) {
    return value.error;
  }

  return 'Request failed. Please try again.';
}

function normalizeStep(step: number) {
  if (step <= 0) {
    return 0;
  }

  if (step >= 3) {
    return 3;
  }

  return step;
}

function canAccessDashboard(subscriptionStatus: string | null | undefined) {
  const normalized = subscriptionStatus?.toLowerCase();
  return normalized === 'active' || normalized === 'past_due';
}

function getPostOnboardingHref(subscriptionStatus: string | null | undefined) {
  return canAccessDashboard(subscriptionStatus)
    ? '/dashboard'
    : '/billing?notice=subscription-required';
}

export function OnboardingWizardClient() {
  const router = useRouter();
  const { getToken, isLoaded } = useAuth();

  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [onboardingData, setOnboardingData] = useState<OnboardingStatusResponse | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [skipError, setSkipError] = useState<string | null>(null);
  const [isSkipping, setIsSkipping] = useState(false);

  const effectiveBusinessName = useMemo(() => {
    if (businessName.trim().length > 0) {
      return businessName;
    }

    return onboardingData?.steps.businessInfo.data.businessName ?? '';
  }, [businessName, onboardingData]);

  const completionHref = useMemo(
    () => getPostOnboardingHref(onboardingData?.steps.billing.data.subscriptionStatus),
    [onboardingData]
  );

  const loadStatus = useCallback(async () => {
    if (!isLoaded) {
      return;
    }

    setLoading(true);
    setSkipError(null);

    try {
      const response = await fetch(getApiBaseUrl() + '/v1/onboarding/status', {
        cache: 'no-store',
        headers: await getClientInternalApiHeaders(() => getToken())
      });

      if (!response.ok) {
        const payload = (await response.json()) as ApiErrorPayload;
        setSkipError(parseError(payload));
        return;
      }

      const payload = (await response.json()) as OnboardingStatusResponse;

      if (payload.onboardingComplete) {
        router.push(getPostOnboardingHref(payload.steps.billing.data.subscriptionStatus));
        return;
      }

      setOnboardingData(payload);
      setCurrentStep(normalizeStep(payload.onboardingStep));
      setBusinessName(payload.steps.businessInfo.data.businessName ?? '');
      setPhoneNumber(payload.steps.phoneNumber.data.twilioPhoneNumber ?? null);
    } catch {
      setSkipError('Unable to load onboarding status. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  }, [getToken, isLoaded, router]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function handleSkip() {
    setSkipError(null);
    setIsSkipping(true);

    try {
      const response = await fetch(getApiBaseUrl() + '/v1/onboarding/skip', {
        method: 'POST',
        headers: await getClientInternalApiHeaders(() => getToken())
      });

      if (!response.ok) {
        const payload = (await response.json()) as ApiErrorPayload;
        setSkipError(parseError(payload));
        return;
      }

      const statusResponse = await fetch(getApiBaseUrl() + '/v1/onboarding/status', {
        cache: 'no-store',
        headers: await getClientInternalApiHeaders(() => getToken())
      });

      if (!statusResponse.ok) {
        router.push('/billing?notice=subscription-required');
        return;
      }

      const statusPayload = (await statusResponse.json()) as OnboardingStatusResponse;
      router.push(getPostOnboardingHref(statusPayload.steps.billing.data.subscriptionStatus));
    } catch {
      setSkipError('Unable to skip setup right now. Please try again.');
    } finally {
      setIsSkipping(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-4 py-12">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm text-gray-700 shadow-sm">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400/40 border-t-gray-700" />
            Loading onboarding...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Welcome to SkybridgeCX</h1>
          <p className="mt-2 text-gray-500">Let us set up your AI receptionist in a few quick steps</p>
        </div>

        <StepProgress currentStep={currentStep} />

        {currentStep === 0 ? (
          <BusinessInfoStep
            onComplete={(data) => {
              setBusinessName(data.businessName);
              setCurrentStep(1);
            }}
          />
        ) : null}

        {currentStep === 1 ? (
          <GreetingStep
            onComplete={() => setCurrentStep(2)}
            goBack={() => setCurrentStep(0)}
            businessName={effectiveBusinessName}
          />
        ) : null}

        {currentStep === 2 ? (
          <PhoneNumberStep
            onComplete={(data) => {
              setPhoneNumber(data.phoneNumber);
              setCurrentStep(3);
            }}
            goBack={() => setCurrentStep(1)}
          />
        ) : null}

        {currentStep === 3 ? (
          <CompletionStep
            businessName={effectiveBusinessName}
            phoneNumber={phoneNumber}
            postOnboardingHref={completionHref}
          />
        ) : null}

        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={handleSkip}
            disabled={isSkipping}
            className="text-sm text-gray-400 underline transition hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSkipping ? 'Skipping...' : 'Skip setup for now'}
          </button>

          {skipError ? <p className="mt-2 text-sm text-red-600">{skipError}</p> : null}
        </div>
      </div>
    </div>
  );
}
