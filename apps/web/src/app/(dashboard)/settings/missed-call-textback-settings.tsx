'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { getApiBaseUrl, getClientInternalApiHeaders } from '@/lib/api-client';
import { Card } from '../components/card';

type PhoneNumberSetting = {
  id: string;
  e164: string;
  label: string | null;
  enableMissedCallTextBack: boolean;
};

type AgentProfileSetting = {
  id: string;
  name: string;
  missedCallTextBackMessage: string | null;
};

type BusinessSetting = {
  id: string;
  name: string;
  phoneNumbers: PhoneNumberSetting[];
  messageProfile: AgentProfileSetting | null;
};

type MissedCallTextBackSettingsProps = {
  businesses: BusinessSetting[];
};

type BusinessDraft = {
  message: string;
  toggles: Record<string, boolean>;
};

type SaveState = {
  tone: 'success' | 'error';
  message: string;
};

function defaultMessage(businessName: string) {
  return `Hi! Sorry we missed your call to ${businessName}. We got your message and will get back to you shortly. If this is urgent, please call back and we'll prioritize your request. — ${businessName}`;
}

function toInitialDraft(business: BusinessSetting): BusinessDraft {
  const toggles = business.phoneNumbers.reduce<Record<string, boolean>>((accumulator, phoneNumber) => {
    accumulator[phoneNumber.id] = phoneNumber.enableMissedCallTextBack;
    return accumulator;
  }, {});

  return {
    message: business.messageProfile?.missedCallTextBackMessage ?? '',
    toggles
  };
}

async function parseErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as { error?: unknown };
    if (typeof payload.error === 'string' && payload.error.trim().length > 0) {
      return payload.error;
    }
  } catch {
    return `Request failed with status ${response.status}`;
  }

  return `Request failed with status ${response.status}`;
}

export function MissedCallTextBackSettings({ businesses }: MissedCallTextBackSettingsProps) {
  const { getToken } = useAuth();

  const [drafts, setDrafts] = useState<Record<string, BusinessDraft>>(() => {
    const draftEntries = businesses.map((business) => [business.id, toInitialDraft(business)] as const);
    return Object.fromEntries(draftEntries);
  });

  const [savingBusinessId, setSavingBusinessId] = useState<string | null>(null);
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});

  const orderedBusinesses = useMemo(() => businesses, [businesses]);

  async function getHeaders() {
    return getClientInternalApiHeaders(() => getToken());
  }

  function updateToggle(businessId: string, phoneNumberId: string, value: boolean) {
    setDrafts((current) => {
      const existing = current[businessId];
      if (!existing) {
        return current;
      }

      return {
        ...current,
        [businessId]: {
          ...existing,
          toggles: {
            ...existing.toggles,
            [phoneNumberId]: value
          }
        }
      };
    });
  }

  function updateMessage(businessId: string, value: string) {
    setDrafts((current) => {
      const existing = current[businessId];
      if (!existing) {
        return current;
      }

      return {
        ...current,
        [businessId]: {
          ...existing,
          message: value
        }
      };
    });
  }

  async function saveBusinessSettings(business: BusinessSetting) {
    const draft = drafts[business.id];

    if (!draft) {
      return;
    }

    setSavingBusinessId(business.id);
    setSaveStates((current) => {
      const next = { ...current };
      delete next[business.id];
      return next;
    });

    try {
      const headers = await getHeaders();

      for (const phoneNumber of business.phoneNumbers) {
        const response = await fetch(`${getApiBaseUrl()}/v1/phone-numbers/${phoneNumber.id}`, {
          method: 'PATCH',
          headers: {
            ...headers,
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            enableMissedCallTextBack: Boolean(draft.toggles[phoneNumber.id])
          })
        });

        if (!response.ok) {
          throw new Error(await parseErrorMessage(response));
        }
      }

      if (business.messageProfile) {
        const trimmedMessage = draft.message.trim();
        const response = await fetch(`${getApiBaseUrl()}/v1/agent-profiles/${business.messageProfile.id}`, {
          method: 'PATCH',
          headers: {
            ...headers,
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            missedCallTextBackMessage: trimmedMessage.length > 0 ? trimmedMessage : null
          })
        });

        if (!response.ok) {
          throw new Error(await parseErrorMessage(response));
        }
      }

      setSaveStates((current) => ({
        ...current,
        [business.id]: {
          tone: 'success',
          message: 'Missed-call text-back settings saved.'
        }
      }));
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Failed to save missed-call text-back settings.';

      setSaveStates((current) => ({
        ...current,
        [business.id]: {
          tone: 'error',
          message
        }
      }));
    } finally {
      setSavingBusinessId(null);
    }
  }

  if (orderedBusinesses.length === 0) {
    return (
      <Card title="Missed Call Text-Back" subtitle="Recover leads from unanswered calls with an automatic SMS follow-up.">
        <p className="text-sm text-gray-600">Create a business and activate a phone number to configure text-back settings.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card
        title="Missed Call Text-Back"
        subtitle="Automatically send a follow-up SMS when calls are missed, busy, canceled, failed, or disconnect too quickly."
      >
        <p className="text-sm text-gray-600">
          SkyBridgeCX will send an SMS from your business number when a call is missed and text-back is enabled.
        </p>
      </Card>

      {orderedBusinesses.map((business) => {
        const draft = drafts[business.id] ?? toInitialDraft(business);
        const saveState = saveStates[business.id];
        const isSaving = savingBusinessId === business.id;
        const previewMessage = draft.message.trim().length > 0 ? draft.message.trim() : defaultMessage(business.name);

        return (
          <Card
            key={business.id}
            title={business.name}
            subtitle="Configure text-back toggles per number and a custom business follow-up message."
          >
            <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">Active Phone Numbers</h3>

                {business.phoneNumbers.length === 0 ? (
                  <p className="text-sm text-gray-600">No active phone numbers for this business yet.</p>
                ) : (
                  <div className="space-y-2">
                    {business.phoneNumbers.map((phoneNumber) => {
                      const isEnabled = Boolean(draft.toggles[phoneNumber.id]);

                      return (
                        <label
                          key={phoneNumber.id}
                          className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
                        >
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-gray-900">
                              {phoneNumber.label ?? phoneNumber.e164}
                            </span>
                            <span className="block text-sm text-gray-600">{phoneNumber.e164}</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={isEnabled}
                              onChange={(event) => updateToggle(business.id, phoneNumber.id, event.target.checked)}
                              className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>Missed Call Text-Back</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">Custom Message</h3>

                {business.messageProfile ? (
                  <p className="text-sm text-gray-600">
                    Message profile: <span className="font-medium text-gray-800">{business.messageProfile.name}</span>
                  </p>
                ) : (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    No agent profile found for this business. Default message preview will be used until a profile is added.
                  </p>
                )}

                <textarea
                  value={draft.message}
                  onChange={(event) => updateMessage(business.id, event.target.value)}
                  rows={4}
                  placeholder="Optional custom text-back message"
                  className="min-h-11 w-full rounded-md border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                />

                <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                  <p className="text-sm font-medium text-gray-800">SMS Preview</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{previewMessage}</p>
                </div>
              </div>

              {saveState ? (
                <div
                  className={`rounded-md px-3 py-2 text-sm ${
                    saveState.tone === 'success'
                      ? 'border border-emerald-200 bg-emerald-50 text-emerald-900'
                      : 'border border-rose-200 bg-rose-50 text-rose-900'
                  }`}
                >
                  {saveState.message}
                </div>
              ) : null}

              <button
                type="button"
                disabled={isSaving}
                onClick={() => {
                  void saveBusinessSettings(business);
                }}
                className="min-h-11 w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {isSaving ? 'Saving...' : 'Save settings'}
              </button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
