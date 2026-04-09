import Link from 'next/link';
import type { Metadata } from 'next';
import { getApiBaseUrl, getInternalApiHeaders } from '@/lib/api';
import { getCurrentTenant } from '@/lib/tenant';
import { EmptyState } from '../components/empty-state';
import { MissedCallTextBackSettings } from './missed-call-textback-settings';

export const metadata: Metadata = {
  title: 'Settings | SkybridgeCX'
};

export const dynamic = 'force-dynamic';

type BusinessDetailsResponse = {
  ok: true;
  business: {
    id: string;
    name: string;
    phoneNumbers: Array<{
      id: string;
      e164: string;
      label: string | null;
      isActive: boolean;
      enableMissedCallTextBack: boolean;
    }>;
    agentProfiles: Array<{
      id: string;
      name: string;
      isActive: boolean;
      missedCallTextBackMessage: string | null;
    }>;
  };
};

type SettingsBusiness = {
  id: string;
  name: string;
  phoneNumbers: Array<{
    id: string;
    e164: string;
    label: string | null;
    enableMissedCallTextBack: boolean;
  }>;
  messageProfile: {
    id: string;
    name: string;
    missedCallTextBackMessage: string | null;
  } | null;
};

async function fetchBusinessSettings(businessId: string, headers: Record<string, string>) {
  const response = await fetch(`${getApiBaseUrl()}/v1/businesses/${businessId}`, {
    cache: 'no-store',
    headers
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as BusinessDetailsResponse;
  const activePhoneNumbers = payload.business.phoneNumbers.filter((phoneNumber) => phoneNumber.isActive);
  const messageProfile =
    payload.business.agentProfiles.find((agentProfile) => agentProfile.isActive) ??
    payload.business.agentProfiles[0] ??
    null;

  const settingsBusiness: SettingsBusiness = {
    id: payload.business.id,
    name: payload.business.name,
    phoneNumbers: activePhoneNumbers.map((phoneNumber) => ({
      id: phoneNumber.id,
      e164: phoneNumber.e164,
      label: phoneNumber.label,
      enableMissedCallTextBack: phoneNumber.enableMissedCallTextBack
    })),
    messageProfile: messageProfile
      ? {
          id: messageProfile.id,
          name: messageProfile.name,
          missedCallTextBackMessage: messageProfile.missedCallTextBackMessage
        }
      : null
  };

  return settingsBusiness;
}

function isNonNullBusiness(value: SettingsBusiness | null): value is SettingsBusiness {
  return value !== null;
}

export default async function SettingsPage() {
  const tenant = await getCurrentTenant();

  if (!tenant) {
    return (
      <EmptyState
        title="Settings unavailable"
        description="Your account is not linked to a tenant yet. Contact support if this persists."
      />
    );
  }

  const headers = await getInternalApiHeaders();
  const settingsBusinesses = (
    await Promise.all(tenant.businesses.map((business) => fetchBusinessSettings(business.id, headers)))
  ).filter(isNonNullBusiness);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">Settings</h1>
        <p className="mt-2 text-sm text-gray-600 sm:text-base">
          Configure missed-call follow-up SMS and outbound webhook integrations.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">Missed Call Text-Back</h2>
          <p className="mt-1 text-sm text-gray-600">Manage SMS recovery for unanswered calls and quick hangups.</p>
          <p className="mt-3 text-sm font-medium text-gray-700">Configured below on this page.</p>
        </article>

        <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">Webhooks</h2>
          <p className="mt-1 text-sm text-gray-600">Push leads into CRM and automation tools using signed webhooks.</p>
          <Link
            href="/settings/webhooks"
            className="mt-3 inline-flex min-h-11 items-center rounded-md border border-gray-200 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Manage Webhooks
          </Link>
        </article>
      </section>

      <MissedCallTextBackSettings businesses={settingsBusinesses} />
    </div>
  );
}
