'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { getApiBaseUrl, getClientInternalApiHeaders } from '@/lib/api-client';
import { Card } from '../../components/card';

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

type WebhookDelivery = {
  id: string;
  eventType: string;
  responseStatus: number | null;
  responseBody: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  attempts: number;
  createdAt: string;
};

type WebhooksSettingsPanelProps = {
  planKey: string | null;
  planName: string | null;
  availableEvents: string[];
  initialEndpoints: WebhookEndpoint[];
};

type NoticeState = {
  tone: 'success' | 'error';
  message: string;
} | null;

type CreateDraft = {
  url: string;
  description: string;
  events: string[];
};

type EditDraft = {
  url: string;
  description: string;
  events: string[];
};

type DeliveriesResponse = {
  ok: boolean;
  deliveries?: WebhookDelivery[];
  error?: string;
};

type EndpointsResponse = {
  ok: boolean;
  endpoints?: WebhookEndpoint[];
  error?: string;
};

type EndpointMutationResponse = {
  ok: boolean;
  endpoint?: WebhookEndpoint;
  error?: string;
};

type TestWebhookResponse = {
  ok: boolean;
  result?: {
    endpointId: string;
    deliveryId: string | null;
    eventType: string;
    success: boolean;
    statusCode: number | null;
    responseBody: string | null;
  };
  error?: string;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function toErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return 'Request failed.';
  }

  const value = payload as { error?: unknown };

  if (typeof value.error === 'string' && value.error.trim().length > 0) {
    return value.error;
  }

  return 'Request failed.';
}

function toggleEventInList(events: string[], event: string, enabled: boolean) {
  if (enabled) {
    return [...new Set([...events, event])];
  }

  return events.filter((currentEvent) => currentEvent !== event);
}

function signatureExample() {
  return `import crypto from 'node:crypto';

const rawBody = JSON.stringify(req.body);
const header = req.headers['x-skybridgecx-signature'];
const secret = process.env.SKYBRIDGECX_WEBHOOK_SECRET;

const expected = 'sha256=' + crypto
  .createHmac('sha256', secret)
  .update(rawBody)
  .digest('hex');

const valid = crypto.timingSafeEqual(
  Buffer.from(header ?? ''),
  Buffer.from(expected)
);`;
}

export function WebhooksSettingsPanel({
  planKey,
  planName,
  availableEvents,
  initialEndpoints
}: WebhooksSettingsPanelProps) {
  const { getToken } = useAuth();

  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>(initialEndpoints);
  const [createDraft, setCreateDraft] = useState<CreateDraft>({
    url: '',
    description: '',
    events: [availableEvents[0]].filter((value): value is string => Boolean(value))
  });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});
  const [editingIds, setEditingIds] = useState<Record<string, boolean>>({});
  const [editDrafts, setEditDrafts] = useState<Record<string, EditDraft>>({});
  const [expandedDeliveries, setExpandedDeliveries] = useState<Record<string, boolean>>({});
  const [deliveriesByEndpoint, setDeliveriesByEndpoint] = useState<Record<string, WebhookDelivery[]>>({});

  const webhookEnabled = planKey === 'pro' || planKey === 'enterprise';

  const sortedEndpoints = useMemo(() => {
    return [...endpoints].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [endpoints]);

  async function getHeaders() {
    return getClientInternalApiHeaders(() => getToken());
  }

  async function refreshEndpoints() {
    const response = await fetch(`${getApiBaseUrl()}/v1/webhooks`, {
      method: 'GET',
      headers: await getHeaders(),
      cache: 'no-store'
    });

    const payload = (await response.json()) as EndpointsResponse;

    if (!response.ok || !payload.ok || !payload.endpoints) {
      throw new Error(toErrorMessage(payload));
    }

    setEndpoints(payload.endpoints);
  }

  async function createEndpoint() {
    if (!webhookEnabled) {
      return;
    }

    setLoadingId('create');
    setNotice(null);

    try {
      const response = await fetch(`${getApiBaseUrl()}/v1/webhooks`, {
        method: 'POST',
        headers: {
          ...(await getHeaders()),
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          url: createDraft.url.trim(),
          description: createDraft.description.trim() || null,
          events: createDraft.events
        })
      });

      const payload = (await response.json()) as EndpointMutationResponse;

      if (!response.ok || !payload.ok || !payload.endpoint) {
        throw new Error(toErrorMessage(payload));
      }

      const nextEndpoint = payload.endpoint;
      setEndpoints((current) => [nextEndpoint, ...current]);
      setCreateDraft({
        url: '',
        description: '',
        events: [availableEvents[0]].filter((value): value is string => Boolean(value))
      });
      setShowCreateForm(false);
      setNotice({
        tone: 'success',
        message: 'Webhook endpoint created.'
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create webhook endpoint.';
      setNotice({
        tone: 'error',
        message
      });
    } finally {
      setLoadingId(null);
    }
  }

  async function toggleEndpoint(endpoint: WebhookEndpoint) {
    setLoadingId(endpoint.id);
    setNotice(null);

    try {
      const response = await fetch(`${getApiBaseUrl()}/v1/webhooks/${endpoint.id}`, {
        method: 'PATCH',
        headers: {
          ...(await getHeaders()),
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          isActive: !endpoint.isActive
        })
      });

      const payload = (await response.json()) as EndpointMutationResponse;

      if (!response.ok || !payload.ok || !payload.endpoint) {
        throw new Error(toErrorMessage(payload));
      }

      const nextEndpoint = payload.endpoint;
      setEndpoints((current) =>
        current.map((item) => (item.id === endpoint.id ? nextEndpoint : item))
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update webhook endpoint.';
      setNotice({ tone: 'error', message });
    } finally {
      setLoadingId(null);
    }
  }

  function openEdit(endpoint: WebhookEndpoint) {
    setEditingIds((current) => ({
      ...current,
      [endpoint.id]: true
    }));

    setEditDrafts((current) => ({
      ...current,
      [endpoint.id]: {
        url: endpoint.url,
        description: endpoint.description ?? '',
        events: [...endpoint.events]
      }
    }));
  }

  function closeEdit(endpointId: string) {
    setEditingIds((current) => ({
      ...current,
      [endpointId]: false
    }));
  }

  async function saveEdit(endpointId: string) {
    const draft = editDrafts[endpointId];

    if (!draft) {
      return;
    }

    setLoadingId(endpointId);
    setNotice(null);

    try {
      const response = await fetch(`${getApiBaseUrl()}/v1/webhooks/${endpointId}`, {
        method: 'PATCH',
        headers: {
          ...(await getHeaders()),
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          url: draft.url.trim(),
          description: draft.description.trim() || null,
          events: draft.events
        })
      });

      const payload = (await response.json()) as EndpointMutationResponse;

      if (!response.ok || !payload.ok || !payload.endpoint) {
        throw new Error(toErrorMessage(payload));
      }

      const nextEndpoint = payload.endpoint;
      setEndpoints((current) =>
        current.map((item) => (item.id === endpointId ? nextEndpoint : item))
      );

      closeEdit(endpointId);
      setNotice({
        tone: 'success',
        message: 'Webhook endpoint updated.'
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update webhook endpoint.';
      setNotice({ tone: 'error', message });
    } finally {
      setLoadingId(null);
    }
  }

  async function deleteEndpoint(endpointId: string) {
    const confirmed = window.confirm('Delete this webhook endpoint? Existing delivery history will be removed.');

    if (!confirmed) {
      return;
    }

    setLoadingId(endpointId);
    setNotice(null);

    try {
      const response = await fetch(`${getApiBaseUrl()}/v1/webhooks/${endpointId}`, {
        method: 'DELETE',
        headers: await getHeaders()
      });

      const payload = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !payload.ok) {
        throw new Error(toErrorMessage(payload));
      }

      setEndpoints((current) => current.filter((endpoint) => endpoint.id !== endpointId));
      setNotice({
        tone: 'success',
        message: 'Webhook endpoint deleted.'
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete webhook endpoint.';
      setNotice({ tone: 'error', message });
    } finally {
      setLoadingId(null);
    }
  }

  async function sendTest(endpointId: string) {
    setLoadingId(endpointId);
    setNotice(null);

    try {
      const response = await fetch(`${getApiBaseUrl()}/v1/webhooks/${endpointId}/test`, {
        method: 'POST',
        headers: await getHeaders()
      });

      const payload = (await response.json()) as TestWebhookResponse;

      if (!response.ok || !payload.ok || !payload.result) {
        throw new Error(toErrorMessage(payload));
      }

      setNotice({
        tone: payload.result.success ? 'success' : 'error',
        message: payload.result.success
          ? `Test webhook delivered (${payload.result.statusCode ?? 'no status'}).`
          : `Test webhook failed (${payload.result.statusCode ?? 'no status'}).`
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to send test webhook.';
      setNotice({ tone: 'error', message });
    } finally {
      setLoadingId(null);
    }
  }

  async function toggleDeliveries(endpointId: string) {
    const currentlyExpanded = expandedDeliveries[endpointId] ?? false;

    if (currentlyExpanded) {
      setExpandedDeliveries((current) => ({
        ...current,
        [endpointId]: false
      }));
      return;
    }

    setExpandedDeliveries((current) => ({
      ...current,
      [endpointId]: true
    }));

    if (deliveriesByEndpoint[endpointId]) {
      return;
    }

    setLoadingId(endpointId);

    try {
      const response = await fetch(`${getApiBaseUrl()}/v1/webhooks/${endpointId}/deliveries`, {
        method: 'GET',
        headers: await getHeaders(),
        cache: 'no-store'
      });

      const payload = (await response.json()) as DeliveriesResponse;

      if (!response.ok || !payload.ok || !payload.deliveries) {
        throw new Error(toErrorMessage(payload));
      }

      setDeliveriesByEndpoint((current) => ({
        ...current,
        [endpointId]: payload.deliveries ?? []
      }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load webhook deliveries.';
      setNotice({ tone: 'error', message });
    } finally {
      setLoadingId(null);
    }
  }

  async function copySecret(secret: string) {
    try {
      await navigator.clipboard.writeText(secret);
      setNotice({
        tone: 'success',
        message: 'Webhook secret copied to clipboard.'
      });
    } catch {
      setNotice({
        tone: 'error',
        message: 'Failed to copy secret.'
      });
    }
  }

  return (
    <div className="space-y-6">
      <Card
        title="Outbound Webhooks"
        subtitle="Send call and prospect events into ServiceTitan, Jobber, HousecallPro, Zapier, Make, or n8n."
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Current plan: <span className="font-medium text-gray-900">{planName ?? planKey ?? 'Unknown'}</span>
          </p>

          {notice ? (
            <div
              className={`rounded-md px-3 py-2 text-sm ${
                notice.tone === 'success'
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border border-rose-200 bg-rose-50 text-rose-900'
              }`}
            >
              {notice.message}
            </div>
          ) : null}

          {!webhookEnabled ? (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
              <h3 className="text-base font-semibold text-indigo-900">Upgrade Required</h3>
              <p className="mt-1 text-sm text-indigo-800">
                Webhooks are available on Pro and Enterprise plans. Upgrade to connect your CRM and automations.
              </p>
              <a
                href="/billing"
                className="mt-3 inline-flex min-h-11 items-center justify-center rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-500"
              >
                Upgrade Plan
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setShowCreateForm((current) => !current)}
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-500"
              >
                {showCreateForm ? 'Hide Add Webhook' : 'Add Webhook'}
              </button>

              {showCreateForm ? (
                <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <label className="space-y-2 text-sm text-gray-700">
                    <span className="font-medium">Endpoint URL</span>
                    <input
                      value={createDraft.url}
                      onChange={(event) =>
                        setCreateDraft((current) => ({
                          ...current,
                          url: event.target.value
                        }))
                      }
                      placeholder="https://example.com/skybridge-webhook"
                      className="min-h-11 w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                    />
                  </label>

                  <label className="space-y-2 text-sm text-gray-700">
                    <span className="font-medium">Description (optional)</span>
                    <input
                      value={createDraft.description}
                      onChange={(event) =>
                        setCreateDraft((current) => ({
                          ...current,
                          description: event.target.value
                        }))
                      }
                      placeholder="Primary CRM webhook"
                      className="min-h-11 w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                    />
                  </label>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">Events</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {availableEvents.map((eventName) => {
                        const checked = createDraft.events.includes(eventName);

                        return (
                          <label
                            key={eventName}
                            className="flex min-h-11 items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) =>
                                setCreateDraft((current) => ({
                                  ...current,
                                  events: toggleEventInList(current.events, eventName, event.target.checked)
                                }))
                              }
                              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>{eventName}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      void createEndpoint();
                    }}
                    disabled={loadingId === 'create'}
                    className="min-h-11 rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loadingId === 'create' ? 'Saving...' : 'Save Webhook'}
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </Card>

      {sortedEndpoints.map((endpoint) => {
        const isEditing = editingIds[endpoint.id] ?? false;
        const editDraft = editDrafts[endpoint.id];
        const isBusy = loadingId === endpoint.id;
        const showSecret = revealedSecrets[endpoint.id] ?? false;
        const showDeliveries = expandedDeliveries[endpoint.id] ?? false;
        const deliveries = deliveriesByEndpoint[endpoint.id] ?? [];

        return (
          <Card
            key={endpoint.id}
            title={endpoint.description?.trim() || endpoint.url}
            subtitle={endpoint.description ? endpoint.url : 'Webhook endpoint'}
          >
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    endpoint.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {endpoint.isActive ? 'Active' : 'Inactive'}
                </span>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">
                  Created {formatDateTime(endpoint.createdAt)}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {endpoint.events.map((eventName) => (
                  <span key={eventName} className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                    {eventName}
                  </span>
                ))}
              </div>

              <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Webhook Secret</p>
                <p className="mt-1 break-all text-sm text-gray-700">{showSecret ? endpoint.secret : '••••••••••••••••••••••••••••••••'}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setRevealedSecrets((current) => ({
                        ...current,
                        [endpoint.id]: !current[endpoint.id]
                      }))
                    }
                    className="min-h-11 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    {showSecret ? 'Hide Secret' : 'Reveal Secret'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void copySecret(endpoint.secret);
                    }}
                    className="min-h-11 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    Copy Secret
                  </button>
                </div>
              </div>

              {!isEditing ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => {
                      void toggleEndpoint(endpoint);
                    }}
                    className="min-h-11 rounded-md border border-gray-200 px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {endpoint.isActive ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(endpoint)}
                    className="min-h-11 rounded-md border border-gray-200 px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => {
                      void sendTest(endpoint.id);
                    }}
                    className="min-h-11 rounded-md border border-indigo-200 bg-indigo-50 px-3 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Test
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void toggleDeliveries(endpoint.id);
                    }}
                    className="min-h-11 rounded-md border border-gray-200 px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    {showDeliveries ? 'Hide Deliveries' : 'View Deliveries'}
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => {
                      void deleteEndpoint(endpoint.id);
                    }}
                    className="min-h-11 rounded-md border border-rose-200 bg-rose-50 px-3 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Delete
                  </button>
                </div>
              ) : editDraft ? (
                <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <label className="space-y-2 text-sm text-gray-700">
                    <span className="font-medium">Endpoint URL</span>
                    <input
                      value={editDraft.url}
                      onChange={(event) =>
                        setEditDrafts((current) => ({
                          ...current,
                          [endpoint.id]: {
                            ...editDraft,
                            url: event.target.value
                          }
                        }))
                      }
                      className="min-h-11 w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                    />
                  </label>

                  <label className="space-y-2 text-sm text-gray-700">
                    <span className="font-medium">Description</span>
                    <input
                      value={editDraft.description}
                      onChange={(event) =>
                        setEditDrafts((current) => ({
                          ...current,
                          [endpoint.id]: {
                            ...editDraft,
                            description: event.target.value
                          }
                        }))
                      }
                      className="min-h-11 w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                    />
                  </label>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {availableEvents.map((eventName) => {
                      const checked = editDraft.events.includes(eventName);

                      return (
                        <label
                          key={eventName}
                          className="flex min-h-11 items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) =>
                              setEditDrafts((current) => ({
                                ...current,
                                [endpoint.id]: {
                                  ...editDraft,
                                  events: toggleEventInList(editDraft.events, eventName, event.target.checked)
                                }
                              }))
                            }
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>{eventName}</span>
                        </label>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => {
                        void saveEdit(endpoint.id);
                      }}
                      className="min-h-11 rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => closeEdit(endpoint.id)}
                      className="min-h-11 rounded-md border border-gray-200 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}

              {showDeliveries ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="text-sm font-semibold text-gray-900">Recent Deliveries (last 50)</p>

                  {deliveries.length === 0 ? (
                    <p className="mt-2 text-sm text-gray-600">No deliveries yet.</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {deliveries.map((delivery) => {
                        const successful = Boolean(delivery.responseStatus && delivery.responseStatus >= 200 && delivery.responseStatus < 300);

                        return (
                          <div key={delivery.id} className="rounded-md border border-gray-200 bg-white p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium text-gray-800">{delivery.eventType}</span>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                    successful ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                                  }`}
                                >
                                  {delivery.responseStatus ?? 'no status'}
                                </span>
                              </div>
                              <span className="text-xs text-gray-500">{formatDateTime(delivery.createdAt)}</span>
                            </div>
                            {delivery.responseBody ? (
                              <p className="mt-2 text-xs text-gray-600">{delivery.responseBody}</p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </Card>
        );
      })}

      <Card title="Signature Verification" subtitle="Validate X-SkybridgeCX-Signature before accepting webhook data.">
        <pre className="overflow-auto rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
          {signatureExample()}
        </pre>
      </Card>

      {sortedEndpoints.length > 0 ? (
        <div className="flex">
          <button
            type="button"
            onClick={() => {
              void refreshEndpoints();
            }}
            className="min-h-11 rounded-md border border-gray-200 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Refresh Endpoints
          </button>
        </div>
      ) : null}
    </div>
  );
}
