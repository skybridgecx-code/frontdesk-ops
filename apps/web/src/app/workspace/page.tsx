import { redirect } from 'next/navigation';
import { getApiBaseUrl, getInternalApiHeaders } from '@/lib/api';
import {
  buildFilterHref as buildCallFilterHref,
  buildQueueReviewNextRequestHref as buildCallQueueReviewNextRequestHref
} from '../calls/workflow-urls';
import {
  buildFilterHref as buildProspectFilterHref,
  buildProspectDetailHref,
  buildQueueNoticeHref,
  buildQueueReviewNextRequestHref as buildProspectQueueReviewNextRequestHref
} from '../prospects/workflow-urls';

export const dynamic = 'force-dynamic';

type CallsSummary = {
  ok: true;
  totalCalls: number;
  openCalls: number;
  contactedCalls: number;
  archivedCalls: number;
  unreviewedCalls: number;
  needsReviewCalls: number;
  reviewedCalls: number;
  highUrgencyCalls: number;
  emergencyCalls: number;
};

type ProspectsSummary = {
  ok: true;
  totalProspects: number;
  newProspects: number;
  readyProspects: number;
  inProgressProspects: number;
  attemptedProspects: number;
  respondedProspects: number;
  qualifiedProspects: number;
  disqualifiedProspects: number;
  archivedProspects: number;
  highPriorityProspects: number;
  mediumPriorityProspects: number;
  lowPriorityProspects: number;
};

type BootstrapResponse = {
  ok: true;
  tenant: {
    id: string;
    slug: string;
    name: string;
    businesses: Array<{
      id: string;
      slug: string;
      name: string;
      vertical: string;
      timezone: string;
    }>;
  } | null;
};

async function getCallsSummary() {
  const res = await fetch(`${getApiBaseUrl()}/v1/calls/summary`, {
    cache: 'no-store',
    headers: getInternalApiHeaders()
  });

  if (!res.ok) {
    throw new Error(`Failed to load call summary: ${res.status}`);
  }

  return (await res.json()) as CallsSummary;
}

async function getBootstrap() {
  const res = await fetch(`${getApiBaseUrl()}/v1/bootstrap`, {
    cache: 'no-store',
    headers: getInternalApiHeaders()
  });

  if (!res.ok) {
    throw new Error(`Failed to load bootstrap: ${res.status}`);
  }

  return (await res.json()) as BootstrapResponse;
}

async function getProspectsSummary(input: { tenantId: string; businessId: string }) {
  const params = new URLSearchParams();
  params.set('tenantId', input.tenantId);
  params.set('businessId', input.businessId);

  const res = await fetch(`${getApiBaseUrl()}/v1/prospects/summary?${params.toString()}`, {
    cache: 'no-store',
    headers: getInternalApiHeaders()
  });

  if (!res.ok) {
    throw new Error(`Failed to load prospect summary: ${res.status}`);
  }

  return (await res.json()) as ProspectsSummary;
}

function WorkspaceCount({
  label,
  value
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-black">{value}</div>
    </div>
  );
}

export default async function WorkspacePage() {
  const bootstrap = await getBootstrap();
  const tenant = bootstrap.tenant;
  const activeBusiness = tenant?.businesses[0] ?? null;

  if (!tenant || !activeBusiness) {
    throw new Error('No active tenant/business scope is configured for the operator workspace.');
  }

  const callQueueHref = buildCallFilterHref({
    triageStatus: 'OPEN'
  });
  const prospectQueueHref = buildProspectFilterHref({
    tenantId: tenant.id,
    businessId: activeBusiness.id,
    status: 'READY'
  });

  const [callSummary, prospectSummary] = await Promise.all([
    getCallsSummary(),
    getProspectsSummary({
      tenantId: tenant.id,
      businessId: activeBusiness.id
    })
  ]);

  async function reviewNextCall() {
    'use server';

    const res = await fetch(`${getApiBaseUrl()}${buildCallQueueReviewNextRequestHref(callQueueHref)}`, {
      cache: 'no-store',
      headers: getInternalApiHeaders()
    });

    if (!res.ok) {
      throw new Error(`Failed to load review-next call: ${res.status}`);
    }

    const data = (await res.json()) as { ok: true; callSid: string | null };

    if (!data.callSid) {
      redirect(`/calls?triageStatus=OPEN&notice=no-review-calls`);
    }

    redirect(`/calls/${data.callSid}?returnTo=${encodeURIComponent(callQueueHref)}`);
  }

  async function reviewNextProspect() {
    'use server';

    const res = await fetch(`${getApiBaseUrl()}${buildProspectQueueReviewNextRequestHref(prospectQueueHref)}`, {
      cache: 'no-store',
      headers: getInternalApiHeaders()
    });

    if (!res.ok) {
      throw new Error(`Failed to load review-next prospect: ${res.status}`);
    }

    const data = (await res.json()) as { ok: true; prospectSid: string | null };

    if (!data.prospectSid) {
      redirect(buildQueueNoticeHref(prospectQueueHref, 'no-review-prospects'));
    }

    redirect(buildProspectDetailHref(data.prospectSid, prospectQueueHref));
  }

  return (
    <main className="min-h-screen bg-white p-6 text-black">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="space-y-3 rounded-[2rem] border border-neutral-200 bg-neutral-50 px-6 py-6">
          <div className="text-xs uppercase tracking-[0.24em] text-neutral-500">Operator workspace</div>
          <h1 className="text-4xl font-semibold tracking-tight">Start here.</h1>
          <p className="max-w-3xl text-base leading-7 text-neutral-700">
            This is the operator starting point for the day. Inbound calls and outbound prospects are both visible work
            queues. Open a queue if you need context. Use review next if you need the next item that needs attention.
          </p>
        </header>

        <section className="grid gap-6 xl:grid-cols-2">
          <article className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-[0_18px_60px_rgba(16,24,40,0.04)]">
            <div className="text-xs uppercase tracking-[0.24em] text-neutral-500">Inbound work</div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">Calls</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-neutral-700">
              Use the call queue when the team needs to review completed calls, sort urgency, and make the next contact
              decision without losing context.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <WorkspaceCount label="Open" value={callSummary.openCalls} />
              <WorkspaceCount label="Needs review" value={callSummary.needsReviewCalls} />
              <WorkspaceCount label="Unreviewed" value={callSummary.unreviewedCalls} />
              <WorkspaceCount label="Emergency" value={callSummary.emergencyCalls} />
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a
                href={callQueueHref}
                className="rounded-xl border border-black bg-black px-4 py-2 text-center text-sm text-white"
              >
                Open call queue
              </a>
              <form action={reviewNextCall}>
                <button className="w-full rounded-xl border border-neutral-300 px-4 py-2 text-sm text-black sm:w-auto">
                  Review next
                </button>
              </form>
            </div>
          </article>

          <article className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-[0_18px_60px_rgba(16,24,40,0.04)]">
            <div className="text-xs uppercase tracking-[0.24em] text-neutral-500">Outbound work</div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">Prospects</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-neutral-700">
              Use the prospect queue when the team needs to work follow-up, log activity, and move outreach forward
              with clear status and next-step visibility.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <WorkspaceCount label="Ready" value={prospectSummary.readyProspects} />
              <WorkspaceCount label="New" value={prospectSummary.newProspects} />
              <WorkspaceCount label="Attempted" value={prospectSummary.attemptedProspects} />
              <WorkspaceCount label="High priority" value={prospectSummary.highPriorityProspects} />
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a
                href={prospectQueueHref}
                className="rounded-xl border border-black bg-black px-4 py-2 text-center text-sm text-white"
              >
                Open prospect queue
              </a>
              <form action={reviewNextProspect}>
                <button className="w-full rounded-xl border border-neutral-300 px-4 py-2 text-sm text-black sm:w-auto">
                  Review next
                </button>
              </form>
            </div>
          </article>
        </section>

        <section className="rounded-[2rem] border border-neutral-200 bg-neutral-50 px-6 py-6">
          <div className="text-xs uppercase tracking-[0.24em] text-neutral-500">How to work from here</div>
          <div className="mt-4 grid gap-3 text-sm leading-7 text-neutral-700 md:grid-cols-3">
            <div>Start with calls if new inbound demand or urgent follow-up is the immediate risk.</div>
            <div>Start with prospects if the team needs to keep outbound follow-up moving without drift.</div>
            <div>Use review next when speed matters more than browsing the full queue.</div>
          </div>
        </section>
      </div>
    </main>
  );
}
