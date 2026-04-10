'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { getApiBaseUrl, getClientInternalApiHeaders } from '@/lib/api-client';

type ManageSubscriptionButtonProps = {
  tenantId: string;
};

type PortalSessionResponse = {
  url?: string;
};

export function ManageSubscriptionButton({ tenantId }: ManageSubscriptionButtonProps) {
  const { getToken } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleManageSubscription() {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(getApiBaseUrl() + '/v1/billing/portal', {
        method: 'POST',
        headers: {
          ...(await getClientInternalApiHeaders(() => getToken())),
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          tenantId
        })
      });

      const payload = (await response.json()) as PortalSessionResponse;

      if (!response.ok || !payload.url) {
        throw new Error('Failed to open billing portal');
      }

      window.location.href = payload.url;
    } catch {
      setErrorMessage('Failed to open billing portal. Try again.');
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start sm:items-end">
      <button
        onClick={() => {
          void handleManageSubscription();
        }}
        disabled={isLoading}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:cursor-not-allowed disabled:bg-blue-400"
      >
        {isLoading ? 'Loading...' : 'Manage Subscription'}
      </button>
      {errorMessage ? (
        <p className="mt-2 text-sm text-red-600">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
