import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentTenant, getOnboardingStatus } from '@/lib/tenant';
import { Card } from '../components/card';

export const metadata: Metadata = {
  title: 'Welcome | SkybridgeCX'
};

function StepRow({
  title,
  description,
  complete,
  action,
  badge
}: {
  title: string;
  description: string;
  complete: boolean;
  action?: {
    label: string;
    href: string;
  };
  badge?: string;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
            complete ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {complete ? '✓' : '•'}
        </span>
        <div>
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <p className="mt-1 text-sm text-gray-600">{description}</p>
        </div>
      </div>

      <div className="w-full shrink-0 sm:w-auto">
        {badge ? (
          <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-sm font-medium text-gray-600 sm:text-xs">
            {badge}
          </span>
        ) : null}

        {action ? (
          <Link
            href={action.href}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 sm:w-auto sm:text-xs"
          >
            {action.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export default async function WelcomePage() {
  const [tenant, onboardingStatus] = await Promise.all([getCurrentTenant(), getOnboardingStatus()]);

  if (onboardingStatus?.isOnboardingComplete) {
    redirect('/dashboard');
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Card title="Welcome to SkybridgeCX!" subtitle="Finish the final setup steps to start handling calls and converting new leads.">
        <div className="space-y-3">
          <StepRow
            title="Your account is set up"
            description={tenant ? `${tenant.name} is linked and ready.` : 'Your account setup is in progress.'}
            complete={Boolean(tenant)}
          />

          <StepRow
            title="Choose your plan"
            description="Activate billing to unlock full dashboard access."
            complete={Boolean(onboardingStatus?.hasSubscription)}
            action={onboardingStatus?.hasSubscription ? undefined : { label: 'Go to billing', href: '/billing' }}
          />

          <StepRow
            title="Connect your phone number"
            description="Number onboarding is the next step after billing."
            complete={Boolean(onboardingStatus?.hasPhoneNumbers)}
            badge={onboardingStatus?.hasPhoneNumbers ? undefined : 'Coming soon'}
          />
        </div>
      </Card>
    </div>
  );
}
