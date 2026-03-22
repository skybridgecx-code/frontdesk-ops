import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

type CallRow = {
  twilioCallSid: string;
  status: string;
  triageStatus: string;
  fromE164: string | null;
  leadName: string | null;
  leadPhone: string | null;
  leadIntent: string | null;
  urgency: string | null;
  serviceAddress: string | null;
  summary: string | null;
  startedAt: string;
  phoneNumber: {
    e164: string;
    label: string | null;
  };
  agentProfile: {
    name: string | null;
    voiceName: string | null;
  } | null;
};

function getApiBaseUrl() {
  return process.env.FRONTDESK_API_BASE_URL ?? 'http://127.0.0.1:4000';
}

function badgeClass(value: string | null | undefined) {
  switch (value) {
    case 'OPEN':
      return 'bg-amber-100 text-amber-900';
    case 'CONTACTED':
      return 'bg-blue-100 text-blue-900';
    case 'ARCHIVED':
      return 'bg-neutral-200 text-neutral-800';
    case 'high':
      return 'bg-orange-100 text-orange-900';
    case 'emergency':
      return 'bg-red-100 text-red-900';
    case 'medium':
      return 'bg-yellow-100 text-yellow-900';
    case 'low':
      return 'bg-green-100 text-green-900';
    case 'COMPLETED':
      return 'bg-green-100 text-green-900';
    case 'RINGING':
    case 'IN_PROGRESS':
      return 'bg-blue-100 text-blue-900';
    default:
      return 'bg-neutral-100 text-neutral-700';
  }
}

async function getCalls(input: {
  triageStatus?: string;
  urgency?: string;
}) {
  const params = new URLSearchParams();
  params.set('limit', '25');

  if (input.triageStatus) params.set('triageStatus', input.triageStatus);
  if (input.urgency) params.set('urgency', input.urgency);

  const res = await fetch(`${getApiBaseUrl()}/v1/calls?${params.toString()}`, {
    cache: 'no-store'
  });

  if (!res.ok) {
    throw new Error(`Failed to load calls: ${res.status}`);
  }

  return (await res.json()) as { ok: true; calls: CallRow[] };
}

function buildFilterHref(input: {
  triageStatus?: string;
  urgency?: string;
}) {
  const params = new URLSearchParams();

  if (input.triageStatus) params.set('triageStatus', input.triageStatus);
  if (input.urgency) params.set('urgency', input.urgency);

  const query = params.toString();
  return query ? `/calls?${query}` : '/calls';
}

function FilterLink({
  href,
  label,
  active
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <a
      href={href}
      className={`rounded-xl border px-3 py-2 text-sm ${
        active ? 'border-black bg-black text-white' : 'border-neutral-300 text-black'
      }`}
    >
      {label}
    </a>
  );
}

export default async function CallsPage({
  searchParams
}: {
  searchParams: Promise<{ triageStatus?: string; urgency?: string }>;
}) {
  const resolved = await searchParams;
  const triageStatus = resolved.triageStatus;
  const urgency = resolved.urgency;
  const currentHref = buildFilterHref({ triageStatus, urgency });

  const data = await getCalls({
    triageStatus,
    urgency
  });

  async function markContacted(callSid: string) {
    'use server';

    await fetch(`${getApiBaseUrl()}/v1/calls/${callSid}/mark-contacted`, {
      method: 'POST'
    });

    revalidatePath('/calls');
    revalidatePath(`/calls/${callSid}`);
    redirect(currentHref);
  }

  async function archiveCall(callSid: string) {
    'use server';

    await fetch(`${getApiBaseUrl()}/v1/calls/${callSid}/archive`, {
      method: 'POST'
    });

    revalidatePath('/calls');
    revalidatePath(`/calls/${callSid}`);
    redirect(currentHref);
  }

  return (
    <main className="min-h-screen bg-white text-black p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Frontdesk Ops</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Recent calls, extracted lead data, and triage status.
          </p>
        </div>

        <div className="space-y-3 rounded-2xl border border-neutral-200 p-4">
          <div>
            <div className="text-sm font-medium mb-2">Triage</div>
            <div className="flex flex-wrap gap-2">
              <FilterLink href={buildFilterHref({ urgency })} label="All" active={!triageStatus} />
              <FilterLink href={buildFilterHref({ triageStatus: 'OPEN', urgency })} label="Open" active={triageStatus === 'OPEN'} />
              <FilterLink href={buildFilterHref({ triageStatus: 'CONTACTED', urgency })} label="Contacted" active={triageStatus === 'CONTACTED'} />
              <FilterLink href={buildFilterHref({ triageStatus: 'ARCHIVED', urgency })} label="Archived" active={triageStatus === 'ARCHIVED'} />
            </div>
          </div>

          <div>
            <div className="text-sm font-medium mb-2">Urgency</div>
            <div className="flex flex-wrap gap-2">
              <FilterLink href={buildFilterHref({ triageStatus })} label="All" active={!urgency} />
              <FilterLink href={buildFilterHref({ triageStatus, urgency: 'low' })} label="Low" active={urgency === 'low'} />
              <FilterLink href={buildFilterHref({ triageStatus, urgency: 'medium' })} label="Medium" active={urgency === 'medium'} />
              <FilterLink href={buildFilterHref({ triageStatus, urgency: 'high' })} label="High" active={urgency === 'high'} />
              <FilterLink href={buildFilterHref({ triageStatus, urgency: 'emergency' })} label="Emergency" active={urgency === 'emergency'} />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-neutral-200">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Call</th>
                <th className="px-4 py-3 font-medium">Lead</th>
                <th className="px-4 py-3 font-medium">Intent</th>
                <th className="px-4 py-3 font-medium">Urgency</th>
                <th className="px-4 py-3 font-medium">Triage</th>
                <th className="px-4 py-3 font-medium">Started</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.calls.map((call) => (
                <tr key={call.twilioCallSid} className="border-t border-neutral-200 align-top">
                  <td className="px-4 py-3">
                    <a href={`/calls/${call.twilioCallSid}`} className="font-medium underline underline-offset-2">
                      {call.twilioCallSid}
                    </a>
                    <div className="text-neutral-600 mt-1">{call.fromE164 ?? 'Unknown caller'}</div>
                    <div className="text-neutral-500 mt-1">
                      {call.phoneNumber.label ?? 'Number'} · {call.phoneNumber.e164}
                    </div>
                    <div className="text-neutral-500 mt-1">
                      {call.agentProfile?.name ?? 'No agent'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{call.leadName ?? '—'}</div>
                    <div className="text-neutral-600 mt-1">{call.leadPhone ?? '—'}</div>
                    <div className="text-neutral-600 mt-1">{call.serviceAddress ?? '—'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{call.leadIntent ?? '—'}</div>
                    <div className="text-neutral-600 mt-1">{call.summary ?? '—'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass(call.urgency)}`}>
                      {call.urgency ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 space-y-2">
                    <div>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass(call.triageStatus)}`}>
                        {call.triageStatus}
                      </span>
                    </div>
                    <div>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass(call.status)}`}>
                        {call.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {new Date(call.startedAt).toLocaleString('en-US', {
                      dateStyle: 'short',
                      timeStyle: 'short'
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2">
                      <form action={markContacted.bind(null, call.twilioCallSid)}>
                        <button className="rounded-xl border border-neutral-300 px-3 py-2 text-sm w-full text-left">
                          Mark contacted
                        </button>
                      </form>
                      <form action={archiveCall.bind(null, call.twilioCallSid)}>
                        <button className="rounded-xl border border-neutral-300 px-3 py-2 text-sm w-full text-left">
                          Archive
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
