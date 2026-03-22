import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getApiBaseUrl, getInternalApiHeaders } from '@/lib/api';

export const dynamic = 'force-dynamic';

type CallDetail = {
  twilioCallSid: string;
  twilioStreamSid: string | null;
  status: string;
  triageStatus: string;
  contactedAt: string | null;
  archivedAt: string | null;
  fromE164: string | null;
  toE164: string | null;
  callerTranscript: string | null;
  assistantTranscript: string | null;
  leadName: string | null;
  leadPhone: string | null;
  leadIntent: string | null;
  urgency: string | null;
  serviceAddress: string | null;
  summary: string | null;
  startedAt: string;
  endedAt: string | null;
  phoneNumber: {
    e164: string;
    label: string | null;
    routingMode: string;
  };
  agentProfile: {
    name: string;
    voiceName: string | null;
    isActive: boolean;
  } | null;
  events: Array<{
    type: string;
    sequence: number;
    createdAt: string;
  }>;
};


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

async function getCall(callSid: string) {
  const res = await fetch(`${getApiBaseUrl()}/v1/calls/${callSid}`, {
    cache: 'no-store',
    headers: getInternalApiHeaders()
  });

  if (!res.ok) {
    throw new Error(`Failed to load call: ${res.status}`);
  }

  return (await res.json()) as { ok: true; call: CallDetail };
}

export default async function CallDetailPage({
  params
}: {
  params: Promise<{ callSid: string }>;
}) {
  const { callSid } = await params;
  const data = await getCall(callSid);
  const call = data.call;

  async function markContacted() {
    'use server';

    await fetch(`${getApiBaseUrl()}/v1/calls/${callSid}/mark-contacted`, {
      method: 'POST',
      headers: getInternalApiHeaders()
    });

    revalidatePath('/calls');
    revalidatePath(`/calls/${callSid}`);
    redirect(`/calls/${callSid}`);
  }

  async function archiveCall() {
    'use server';

    await fetch(`${getApiBaseUrl()}/v1/calls/${callSid}/archive`, {
      method: 'POST',
      headers: getInternalApiHeaders()
    });

    revalidatePath('/calls');
    revalidatePath(`/calls/${callSid}`);
    redirect(`/calls/${callSid}`);
  }

  async function rerunExtraction() {
    'use server';

    await fetch(`${getApiBaseUrl()}/v1/calls/${callSid}/extract`, {
      method: 'POST',
      headers: getInternalApiHeaders()
    });

    revalidatePath('/calls');
    revalidatePath(`/calls/${callSid}`);
    redirect(`/calls/${callSid}`);
  }

  return (
    <main className="min-h-screen bg-white text-black p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <a href="/calls" className="text-sm underline underline-offset-2 text-neutral-600">
              ← Back to calls
            </a>
            <h1 className="text-3xl font-semibold tracking-tight mt-2">{call.twilioCallSid}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass(call.status)}`}>
                {call.status}
              </span>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass(call.triageStatus)}`}>
                {call.triageStatus}
              </span>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass(call.urgency)}`}>
                {call.urgency ?? 'no urgency'}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <form action={rerunExtraction}>
              <button className="rounded-xl border border-neutral-300 px-4 py-2 text-sm">
                Extract
              </button>
            </form>
            <form action={markContacted}>
              <button className="rounded-xl border border-neutral-300 px-4 py-2 text-sm">
                Mark contacted
              </button>
            </form>
            <form action={archiveCall}>
              <button className="rounded-xl border border-neutral-300 px-4 py-2 text-sm">
                Archive
              </button>
            </form>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <section className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="font-medium">Lead</h2>
            <div className="mt-3 space-y-2 text-sm">
              <div><span className="text-neutral-500">Name:</span> {call.leadName ?? '—'}</div>
              <div><span className="text-neutral-500">Phone:</span> {call.leadPhone ?? '—'}</div>
              <div><span className="text-neutral-500">Intent:</span> {call.leadIntent ?? '—'}</div>
              <div><span className="text-neutral-500">Urgency:</span> {call.urgency ?? '—'}</div>
              <div><span className="text-neutral-500">Address:</span> {call.serviceAddress ?? '—'}</div>
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="font-medium">Call</h2>
            <div className="mt-3 space-y-2 text-sm">
              <div><span className="text-neutral-500">From:</span> {call.fromE164 ?? '—'}</div>
              <div><span className="text-neutral-500">To:</span> {call.toE164 ?? '—'}</div>
              <div><span className="text-neutral-500">Started:</span> {new Date(call.startedAt).toLocaleString()}</div>
              <div><span className="text-neutral-500">Ended:</span> {call.endedAt ? new Date(call.endedAt).toLocaleString() : '—'}</div>
              <div><span className="text-neutral-500">Number:</span> {call.phoneNumber.label ?? '—'} · {call.phoneNumber.e164}</div>
              <div><span className="text-neutral-500">Routing:</span> {call.phoneNumber.routingMode}</div>
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="font-medium">Agent</h2>
            <div className="mt-3 space-y-2 text-sm">
              <div><span className="text-neutral-500">Name:</span> {call.agentProfile?.name ?? '—'}</div>
              <div><span className="text-neutral-500">Voice:</span> {call.agentProfile?.voiceName ?? '—'}</div>
              <div><span className="text-neutral-500">Active:</span> {call.agentProfile ? String(call.agentProfile.isActive) : '—'}</div>
              <div><span className="text-neutral-500">Contacted:</span> {call.contactedAt ? new Date(call.contactedAt).toLocaleString() : '—'}</div>
              <div><span className="text-neutral-500">Archived:</span> {call.archivedAt ? new Date(call.archivedAt).toLocaleString() : '—'}</div>
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-neutral-200 p-4">
          <h2 className="font-medium">Summary</h2>
          <p className="mt-3 text-sm whitespace-pre-wrap">{call.summary ?? '—'}</p>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="font-medium">Caller transcript</h2>
            <p className="mt-3 text-sm whitespace-pre-wrap">{call.callerTranscript ?? '—'}</p>
          </section>

          <section className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="font-medium">Assistant transcript</h2>
            <p className="mt-3 text-sm whitespace-pre-wrap">{call.assistantTranscript ?? '—'}</p>
          </section>
        </div>

        <section className="rounded-2xl border border-neutral-200 p-4">
          <h2 className="font-medium">Event timeline</h2>
          <div className="mt-3 space-y-2 text-sm">
            {call.events.map((event) => (
              <div key={`${event.sequence}-${event.type}`} className="flex items-start gap-3">
                <div className="w-10 text-neutral-500">{event.sequence}</div>
                <div className="min-w-0 flex-1">
                  <div>{event.type}</div>
                  <div className="text-neutral-500">
                    {new Date(event.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
