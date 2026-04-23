import type { Metadata } from 'next';
import { getApiBaseUrl, getInternalApiHeaders } from '@/lib/api';
import { CallLogClient } from './call-log-client';

export const metadata: Metadata = {
  title: 'Call Log | SkyBridgeCX'
};

export const dynamic = 'force-dynamic';

type CallRecord = {
  id?: string;
  callSid?: string | null;
  twilioCallSid?: string;
  status?: string;
  callStatus?: string;
  callerName?: string | null;
  leadName?: string | null;
  callerPhone?: string | null;
  fromE164?: string | null;
  callReason?: string | null;
  leadIntent?: string | null;
  voicemailDuration?: number | null;
  durationSeconds?: number | null;
  answeredAt?: string | null;
  completedAt?: string | null;
  endedAt?: string | null;
  createdAt?: string;
  startedAt?: string;
};

type CallsResponse = {
  ok: boolean;
  calls: CallRecord[];
  page: number;
  totalPages: number;
};

type CallsFetchResult =
  | {
      ok: true;
      calls: CallRecord[];
      page: number;
      totalPages: number;
    }
  | {
      ok: false;
      message: string;
      calls: [];
      page: 1;
      totalPages: 1;
    };

async function getCalls(): Promise<CallsFetchResult> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/v1/calls?page=1&limit=25`, {
      cache: 'no-store',
      headers: await getInternalApiHeaders()
    });

    if (!response.ok) {
      return {
        ok: false,
        message: `Failed to load calls (${response.status}).`,
        calls: [],
        page: 1,
        totalPages: 1
      };
    }

    const payload = (await response.json()) as CallsResponse;
    if (!payload.ok || !Array.isArray(payload.calls)) {
      return {
        ok: false,
        message: 'Could not parse calls response.',
        calls: [],
        page: 1,
        totalPages: 1
      };
    }

    return {
      ok: true,
      calls: payload.calls,
      page: payload.page,
      totalPages: payload.totalPages
    };
  } catch {
    return {
      ok: false,
      message: 'Could not reach the API. Please try again.',
      calls: [],
      page: 1,
      totalPages: 1
    };
  }
}

export default async function CallsPage() {
  const callsResponse = await getCalls();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Call Log</h1>
        <p className="text-gray-500 mt-1">All incoming calls to your AI receptionist</p>
      </div>

      <CallLogClient
        initialCalls={callsResponse.calls}
        initialPage={callsResponse.page}
        totalPages={callsResponse.totalPages}
        initialError={callsResponse.ok ? null : callsResponse.message}
      />
    </div>
  );
}
