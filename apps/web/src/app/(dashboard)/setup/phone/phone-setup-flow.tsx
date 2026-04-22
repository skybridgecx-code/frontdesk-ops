'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { getApiBaseUrl, getClientInternalApiHeaders } from '@/lib/api-client';
import { Card } from '../../components/card';
import { SearchInput } from '../../components/search-input';

type PhoneSetupFlowProps = {
  tenantName: string;
  businesses: Array<{
    id: string;
    name: string;
  }>;
  hasPhoneNumbers: boolean;
};

type AvailableNumber = {
  phoneNumber: string;
  friendlyName: string;
  locality: string | null;
  region: string | null;
  postalCode: string | null;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
    fax: boolean;
  } | null;
};

type SearchResponse = {
  ok: boolean;
  numbers?: AvailableNumber[];
  error?: string;
};

type PurchasedPhoneNumber = {
  id: string;
  e164: string;
  label: string | null;
};

type PurchaseResponse = {
  ok: boolean;
  phoneNumber?: PurchasedPhoneNumber;
  error?: string;
};

function capabilityText(capabilities: AvailableNumber['capabilities']) {
  if (!capabilities) {
    return 'Voice';
  }

  const values = [
    capabilities.voice ? 'Voice' : null,
    capabilities.sms ? 'SMS' : null,
    capabilities.mms ? 'MMS' : null,
    capabilities.fax ? 'Fax' : null
  ].filter((value): value is string => Boolean(value));

  return values.length > 0 ? values.join(' • ') : 'Voice';
}

function locationText(number: AvailableNumber) {
  const parts = [number.locality, number.region, number.postalCode].filter((value): value is string => Boolean(value));
  return parts.length > 0 ? parts.join(', ') : 'United States';
}

function parseErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return 'Request failed.';
  }

  const value = payload as { error?: unknown };

  if (typeof value.error === 'string' && value.error.trim().length > 0) {
    return value.error;
  }

  return 'Request failed.';
}

export function PhoneSetupFlow({ tenantName, businesses, hasPhoneNumbers }: PhoneSetupFlowProps) {
  const { getToken } = useAuth();

  const [areaCode, setAreaCode] = useState('');
  const [contains, setContains] = useState('');
  const [searching, setSearching] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<AvailableNumber[]>([]);
  const [selectedNumber, setSelectedNumber] = useState<AvailableNumber | null>(null);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>(businesses[0]?.id ?? '');
  const [purchasedNumber, setPurchasedNumber] = useState<PurchasedPhoneNumber | null>(null);

  const canPurchase = useMemo(() => {
    return Boolean(selectedNumber && selectedBusinessId && !purchasing);
  }, [selectedNumber, selectedBusinessId, purchasing]);

  async function getHeaders() {
    return getClientInternalApiHeaders(() => getToken());
  }

  async function searchNumbers() {
    setErrorMessage(null);
    setPurchasedNumber(null);
    setSearching(true);

    try {
      const params = new URLSearchParams({
        country: 'US',
        limit: '10'
      });

      if (areaCode.trim().length > 0) {
        params.set('areaCode', areaCode.trim());
      }

      if (contains.trim().length > 0) {
        params.set('contains', contains.trim());
      }

      const response = await fetch(`${getApiBaseUrl()}/v1/provisioning/search-numbers?${params.toString()}`, {
        method: 'GET',
        headers: await getHeaders(),
        cache: 'no-store'
      });

      const payload = (await response.json()) as SearchResponse;

      if (!response.ok || !payload.ok) {
        setSearchResults([]);
        setSelectedNumber(null);
        setErrorMessage(parseErrorMessage(payload));
        return;
      }

      const numbers = payload.numbers ?? [];
      setSearchResults(numbers);
      setSelectedNumber(numbers[0] ?? null);

      if (numbers.length === 0) {
        setErrorMessage('No numbers matched your search. Try a different area code or pattern.');
      }
    } catch {
      setSearchResults([]);
      setSelectedNumber(null);
      setErrorMessage('Unable to search numbers right now. Please try again.');
    } finally {
      setSearching(false);
    }
  }

  async function purchaseNumber() {
    if (!selectedNumber || !selectedBusinessId) {
      return;
    }

    setErrorMessage(null);
    setPurchasing(true);

    try {
      const response = await fetch(`${getApiBaseUrl()}/v1/provisioning/purchase-number`, {
        method: 'POST',
        headers: {
          ...(await getHeaders()),
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          phoneNumber: selectedNumber.phoneNumber,
          businessId: selectedBusinessId
        })
      });

      const payload = (await response.json()) as PurchaseResponse;

      if (!response.ok || !payload.ok || !payload.phoneNumber) {
        setErrorMessage(parseErrorMessage(payload));
        return;
      }

      setPurchasedNumber(payload.phoneNumber);
    } catch {
      setErrorMessage('Unable to activate this number right now. Please try again.');
    } finally {
      setPurchasing(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Card
        title="Phone Setup"
        subtitle={`Connect a Twilio number for ${tenantName}. Once active, calls are answered by SkyBridgeCX automatically.`}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-2">
            <span className="text-sm font-medium uppercase tracking-wide text-gray-500 sm:text-xs">Area code</span>
            <input
              value={areaCode}
              onChange={(event) => setAreaCode(event.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
              placeholder="703"
              className="min-h-11 w-full rounded-md border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium uppercase tracking-wide text-gray-500 sm:text-xs">Contains</span>
            <SearchInput
              value={contains}
              onChange={(event) => setContains(event.target.value)}
              placeholder="e.g. 777"
            />
          </label>
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={searchNumbers}
            disabled={searching}
            className="min-h-11 w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {searching ? 'Searching...' : 'Search Available Numbers'}
          </button>
        </div>
      </Card>

      {errorMessage ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{errorMessage}</div>
      ) : null}

      <Card title="Step 1: Select a number" subtitle="Pick a number to activate for inbound calls.">
        {searchResults.length === 0 ? (
          <p className="text-sm text-gray-600">Search available numbers to get started.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {searchResults.map((number) => {
              const selected = selectedNumber?.phoneNumber === number.phoneNumber;

              return (
                <button
                  key={number.phoneNumber}
                  type="button"
                  onClick={() => setSelectedNumber(number)}
                  className={`rounded-lg border px-4 py-3 text-left transition ${
                    selected
                      ? 'border-indigo-300 bg-indigo-50 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/40'
                  }`}
                >
                  <div className="text-base font-semibold text-gray-900">{number.friendlyName}</div>
                  <div className="mt-1 text-sm text-gray-500 sm:text-xs">{number.phoneNumber}</div>
                  <div className="mt-2 text-sm text-gray-600 sm:text-xs">{locationText(number)}</div>
                  <div className="mt-1 text-sm text-gray-500 sm:text-xs">{capabilityText(number.capabilities)}</div>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      <Card title="Step 2: Confirm purchase" subtitle="Assign the selected number to a business and activate voice handling.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="text-sm uppercase tracking-wide text-gray-500 sm:text-xs">Selected number</div>
            <div className="mt-2 text-lg font-semibold text-gray-900">
              {selectedNumber ? selectedNumber.friendlyName : 'No number selected'}
            </div>
            <div className="text-sm text-gray-600">{selectedNumber?.phoneNumber ?? 'Search and select a number first.'}</div>
          </div>

          <label className="space-y-2">
            <span className="text-sm font-medium uppercase tracking-wide text-gray-500 sm:text-xs">Business</span>
            <select
              value={selectedBusinessId}
              onChange={(event) => setSelectedBusinessId(event.target.value)}
              disabled={businesses.length <= 1}
              className="min-h-11 w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-50 disabled:text-gray-500"
            >
              {businesses.map((business) => (
                <option key={business.id} value={business.id}>
                  {business.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:flex sm:flex-wrap sm:items-center">
          <button
            type="button"
            onClick={purchaseNumber}
            disabled={!canPurchase}
            className="min-h-11 w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {purchasing ? 'Activating...' : 'Activate This Number'}
          </button>

          {hasPhoneNumbers ? (
            <span className="inline-flex min-h-11 items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-sm font-medium text-emerald-700 sm:min-h-0 sm:text-xs">
              A phone number is already connected
            </span>
          ) : null}
        </div>
      </Card>

      {purchasedNumber ? (
        <Card title="Activation complete" subtitle="Your AI front desk is now live.">
          <p className="text-sm text-gray-700">
            Your AI front desk is live! Calls to <span className="font-semibold text-gray-900">{purchasedNumber.e164}</span>{' '}
            will be answered by SkyBridgeCX.
          </p>

          <div className="mt-4 grid gap-3 sm:flex sm:flex-wrap">
            <Link
              href="/dashboard"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 sm:w-auto"
            >
              Go to Dashboard
            </Link>
            <a
              href={`tel:${purchasedNumber.e164}`}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-indigo-50 sm:w-auto"
            >
              Make a Test Call
            </a>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
