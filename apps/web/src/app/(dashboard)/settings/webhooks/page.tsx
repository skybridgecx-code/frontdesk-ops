import Link from 'next/link';
import type { Metadata } from 'next';
import { getApiBaseUrl, getInternalApiHeaders } from '@/lib/api';
import { getCurrentTenant } from '@/lib/tenant';
import { Card } from '../../components/card';
import { EmptyState } from '../../components/empty-state';
import { WebhooksSettingsPanel } from './webhooks-settings-panel';

export const metadata: Metadata = {
  title: 'Webhook Settings | SkyBridgeCX'
};

export const dynamic = 'force-dynamic';

type PlanKey = 'starter' | 'pro' | 'enterprise';

type BillingStatusResponse =
  | {
      status: 'none';
    }
  | {
      status: string;
      planKey?: PlanKey;
      planName?: string;
    };

type WebhookEndpoint = {
  id: string;
  url: string;
  secret: string;
  events: string[];
  isActive: boolean;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

type WebhooksListResponse = {
  ok: boolean;
  events?: string[];
  endpoints?: WebhookEndpoint[];
  error?: string;
};

type BillingPlanFetchResult =
  | {
      ok: true;
      planKey: PlanKey | null;
      planName: string | null;
    }
  | {
      ok: false;
      message: string;
    };

type WebhookSettingsFetchResult =
  | {
      ok: true;
      availableEvents: string[];
      endpoints: WebhookEndpoint[];
    }
  | {
      ok: false;
      message: string;
    };

const DEFAULT_EVENTS = ['call.completed', 'call.recording.ready', 'prospect.created'];

function toPlanFromBilling(payload: BillingStatusResponse): { planKey: PlanKey | null; planName: string | null } {
  if (!('planKey' in payload)) {
    return {
      planKey: null,
      planName: null
    };
  }

  return {
    planKey: payload.planKey ?? null,
    planName: payload.planName ?? null
  };
}

async function getBillingPlan(tenantId: string): Promise<BillingPlanFetchResult> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/v1/billing/status/${tenantId}`, {
      cache: 'no-store',
      headers: await getInternalApiHeaders()
    });

    if (!response.ok) {
      return {
        ok: false,
        message: `Failed to load billing plan (${response.status}).`
      };
    }

    const payload = (await response.json()) as BillingStatusResponse;
    return {
      ok: true,
      ...toPlanFromBilling(payload)
    };
  } catch {
    return {
      ok: false,
      message: 'Could not reach the billing API. Please try again.'
    };
  }
}

async function getWebhookSettings(): Promise<WebhookSettingsFetchResult> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/v1/webhooks`, {
      cache: 'no-store',
      headers: await getInternalApiHeaders()
    });

    if (!response.ok) {
      return {
        ok: false,
        message: `Failed to load webhook settings (${response.status}).`
      };
    }

    const payload = (await response.json()) as WebhooksListResponse;

    if (!payload.ok) {
      return {
        ok: false,
        message: payload.error ?? 'Failed to load webhook settings.'
      };
    }

    return {
      ok: true,
      availableEvents: payload.events?.length ? payload.events : DEFAULT_EVENTS,
      endpoints: payload.endpoints ?? []
    };
  } catch {
    return {
      ok: false,
      message: 'Could not reach the API. Please try again.'
    };
  }
}

export default async function WebhookSettingsPage() {
  const tenant = await getCurrentTenant();

  if (!tenant) {
    return (
      <EmptyState
        title="Settings unavailable"
        description="Your account is not linked to a tenant yet. Contact support if this persists."
      />
    );
  }

  const [billingPlan, webhookSettings] = await Promise.all([
    getBillingPlan(tenant.id),
    getWebhookSettings()
  ]);

  if (!billingPlan.ok || !webhookSettings.ok) {
    const errorMessage = !billingPlan.ok
      ? billingPlan.message
      : !webhookSettings.ok
        ? webhookSettings.message
        : 'Webhook settings could not be loaded.';

    return (
      <EmptyState
        title="Could not load webhook settings"
        description={errorMessage}
        actionLabel="Try again"
        actionHref="/settings/webhooks"
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card title="Webhooks" subtitle="Connect SkyBridgeCX to your CRM and automation workflows.">
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Send lead events directly to ServiceTitan, Jobber, HousecallPro, Zapier, Make, or n8n.
          </p>
          <div>
            <Link
              href="/settings"
              className="inline-flex min-h-11 items-center rounded-md border border-gray-200 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Back to Settings
            </Link>
          </div>
        </div>
      </Card>

      <WebhooksSettingsPanel
        planKey={billingPlan.planKey}
        planName={billingPlan.planName}
        availableEvents={webhookSettings.availableEvents}
        initialEndpoints={webhookSettings.endpoints}
      />
    </div>
  );
}
