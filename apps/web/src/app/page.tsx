import { redirect } from 'next/navigation';
import { getApiBaseUrl, getInternalApiHeaders } from '@/lib/api';
import { buildPublicLeadPayload } from './home-lead-payload';
import { buildOperatorLeadWebhookPayload } from './home-lead-notification';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Frontdesk Intake for Service Businesses | MoLeads',
  description:
    'MoLeads captures inbound requests, makes first-pass intake visible, and keeps operator follow-up actionable for service businesses.'
};

const capabilities = [
  {
    title: 'Stop demand from disappearing after first contact',
    body:
      'MoLeads is built for the operational gap after interest appears. Calls, web requests, and outbound follow-up become visible work instead of drifting across inboxes, sticky notes, or memory.'
  },
  {
    title: 'Give operators a next step they can trust',
    body:
      'Queues, status changes, routing context, and activity history stay clear enough for a real operator to move work forward without guessing.'
  },
  {
    title: 'Keep the front door tied to the same follow-up system',
    body:
      'Website requests, imported prospects, and operator review feed the same operating flow, so the handoff from interest to follow-up stays inspectable.'
  }
];

const servicePillars = [
  'Inbound work queue',
  'Outbound work queue',
  'Public request capture',
  'Visible next actions'
];

const proofPoints = [
  'Inbound calls and requests are captured',
  'First-pass intake and routing stay visible',
  'Operators can review and follow up'
];

const workflowProof = [
  {
    title: 'Inbound calls and requests are captured',
    body: 'Calls and public requests do not disappear after first contact. They enter the working system as visible intake instead of falling into disconnected inboxes or memory.'
  },
  {
    title: 'First-pass intake and routing stay visible',
    body: 'The system can show how work entered the queue, how a call was routed, and what context was captured on the first pass instead of hiding that path behind a black box.'
  },
  {
    title: 'Operators can review and follow up',
    body: 'Operators can review current state, see what changed, and move follow-up forward with clear next actions instead of guessing across multiple tools.'
  }
];

const processSteps = [
  {
    step: '01',
    title: 'Inbound calls or requests come in',
    body: 'An inbound call rings or a public request is submitted. Instead of becoming a disconnected event, it enters the working system as visible intake.'
  },
  {
    step: '02',
    title: 'First-pass intake organizes the details',
    body: 'Routing and AI frontdesk handling capture what happened first, so the team can inspect the call path, summary, and context instead of starting from scratch.'
  },
  {
    step: '03',
    title: 'Operators review and act',
    body: 'Operators can see what happened, what changed, and what needs follow-up next without guessing across multiple tools.'
  },
  {
    step: '04',
    title: 'Work stays visible until handled',
    body: 'Follow-up status, activity history, and next actions stay attached to the work item so demand stays actionable until it is actually handled.'
  }
];

const faqs = [
  {
    question: 'Who is MoLeads for?',
    answer:
      'Service businesses that already generate demand but do not trust what happens between first contact and follow-up.'
  },
  {
    question: 'Is this just a website form?',
    answer:
      'No. The site is the front door, but the real product is the operator workflow behind it: queues, review, activity history, and clear next actions.'
  },
  {
    question: 'What happens after someone submits?',
    answer:
      'The request becomes a real work item in the prospect workflow so the team can review it, prioritize it, and start follow-up.'
  }
];

type HomeSearchParams = {
  notice?: string;
  error?: string;
  company?: string;
  warning?: string;
};

type BootstrapResponse = {
  ok: true;
  tenant: {
    id: string;
    businesses: Array<{
      id: string;
      name: string;
    }>;
  } | null;
};

type ImportLeadResponse = {
  ok: true;
  prospects: Array<{
    prospectSid: string;
  }>;
};

async function getBootstrap() {
  try {
    const res = await fetch(`${getApiBaseUrl()}/v1/bootstrap`, {
      cache: 'no-store',
      headers: getInternalApiHeaders()
    });

    if (!res.ok) {
      return null;
    }

    return (await res.json()) as BootstrapResponse;
  } catch {
    return null;
  }
}

function buildHomeNoticeHref(notice: string, extras?: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  params.set('notice', notice);

  for (const [key, value] of Object.entries(extras ?? {})) {
    if (value) {
      params.set(key, value);
    }
  }

  return `/?${params.toString()}`;
}

function getNoticeMessage(notice: string | undefined, error: string | undefined) {
  if (notice === 'lead-requested') {
    return 'Lead request captured. It is now in the operator queue.';
  }

  if (notice === 'lead-request-failed') {
    return error ? `Business intake request failed: ${error}` : 'Business intake request failed.';
  }

  return null;
}

function getAppBaseUrl() {
  return process.env.FRONTDESK_APP_BASE_URL ?? 'http://127.0.0.1:3001';
}

async function notifyOperatorOfLead(input: {
  prospectSid: string;
  lead: ReturnType<typeof buildPublicLeadPayload>;
}) {
  const webhookUrl = process.env.FRONTDESK_OPERATOR_WEBHOOK_URL;

  if (!webhookUrl) {
    return {
      ok: false as const,
      warning: 'Lead was captured, but operator notifications are not configured yet.'
    };
  }

  const payload = buildOperatorLeadWebhookPayload({
    prospectSid: input.prospectSid,
    lead: input.lead,
    appBaseUrl: getAppBaseUrl()
  });

  const response = await fetch(webhookUrl, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    return {
      ok: false as const,
      warning: `Lead was captured, but operator notification failed with status ${response.status}.`
    };
  }

  return { ok: true as const };
}

export default async function Home({
  searchParams
}: {
  searchParams: Promise<HomeSearchParams>;
}) {
  const resolved = await searchParams;
  const bootstrap = await getBootstrap();
  const activeBusiness = bootstrap?.tenant?.businesses[0] ?? null;
  const tenantId = bootstrap?.tenant?.id ?? null;
  const noticeMessage = getNoticeMessage(resolved.notice, resolved.error?.trim());
  const requestedCompany = resolved.company?.trim() || 'Your request';
  const successWarning = resolved.warning?.trim() || null;
  const leadRequested = resolved.notice === 'lead-requested';

  async function requestConsultation(formData: FormData) {
    'use server';

    if (!activeBusiness || !tenantId) {
      redirect(
        buildHomeNoticeHref('lead-request-failed', {
          error: 'No active business is configured for lead capture.'
        })
      );
    }

    let prospect;

    try {
      prospect = buildPublicLeadPayload(formData);
    } catch (error) {
      redirect(
        buildHomeNoticeHref('lead-request-failed', {
          error: error instanceof Error ? error.message : 'Invalid lead request.'
        })
      );
    }

    const response = await fetch(
      `${getApiBaseUrl()}/v1/businesses/${activeBusiness.id}/prospects/import?tenantId=${encodeURIComponent(tenantId)}`,
      {
      method: 'POST',
      cache: 'no-store',
      headers: {
        ...getInternalApiHeaders(),
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        prospects: [prospect]
      })
      }
    );

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      redirect(
        buildHomeNoticeHref('lead-request-failed', {
          error: body?.error ?? `Request failed with status ${response.status}.`
        })
      );
    }

    const imported = (await response.json()) as ImportLeadResponse;
    const prospectSid = imported.prospects[0]?.prospectSid;
    const notificationResult = prospectSid
      ? await notifyOperatorOfLead({
          prospectSid,
          lead: prospect
        })
      : {
          ok: false as const,
          warning: 'Lead was captured, but the created prospect could not be linked for notification.'
        };

    redirect(
      buildHomeNoticeHref('lead-requested', {
        company: prospect.companyName,
        warning: notificationResult.ok ? undefined : notificationResult.warning
      })
    );
  }

  return (
    <main className="min-h-screen bg-[#f3ece2] text-[#15110e]">
      <section className="relative overflow-hidden bg-[#17120f] text-[#f8f1e7]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.22),_transparent_24%),radial-gradient(circle_at_82%_18%,_rgba(96,165,250,0.18),_transparent_20%),linear-gradient(145deg,_rgba(255,255,255,0.04),_transparent_35%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-white/10" />
        <div className="relative mx-auto max-w-7xl px-6 py-8 md:px-10 lg:px-12">
          <header className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.34em] text-[#dcc8ac]">MoLeads</div>
              <div className="mt-2 max-w-sm text-sm text-[#c7b8a3]">
                AI frontdesk workflow for service businesses that need tighter follow-through after first contact.
              </div>
            </div>
            <div className="hidden gap-3 sm:flex">
              <a
                href="/contact"
                className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-[#f8f1e7] transition hover:border-white/40 hover:bg-white/6"
              >
                Request intake review
              </a>
              <a
                href="#how-it-works"
                className="rounded-full bg-[#f8f1e7] px-5 py-2.5 text-sm font-medium text-[#17120f] transition hover:-translate-y-0.5 hover:bg-white"
              >
                See how it works
              </a>
            </div>
          </header>

          {noticeMessage && !leadRequested ? (
            <div className="mt-8 rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-sm text-[#f8f1e7]">
              {noticeMessage}
            </div>
          ) : null}

          <div className="grid gap-14 py-16 lg:grid-cols-[minmax(0,1.08fr)_420px] lg:items-end lg:py-24">
            <div>
              <div className="inline-flex rounded-full border border-white/12 bg-white/6 px-4 py-2 text-xs uppercase tracking-[0.28em] text-[#f0d7af]">
                AI frontdesk for service-business intake and follow-up
              </div>
              <h1 className="mt-7 max-w-5xl text-5xl leading-[0.92] font-semibold tracking-[-0.06em] md:text-7xl">
                AI frontdesk intake and follow-up for service businesses.
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-[#d8c9b5] md:text-xl">
                MoLeads captures inbound calls and public requests, keeps first-pass intake and routing visible, and gives operators a clear follow-up path instead of a black box after first contact.
              </p>
              <div className="mt-8 flex flex-wrap gap-3 text-xs uppercase tracking-[0.22em] text-[#cdb89a]">
                {proofPoints.map((point) => (
                  <span key={point}>{point}</span>
                ))}
              </div>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <a
                  href="/contact"
                  className="rounded-full bg-[#f8f1e7] px-6 py-3 text-sm font-medium text-[#17120f] transition hover:-translate-y-0.5 hover:bg-white"
                >
                  Request intake review
                </a>
                <a
                  href="#how-it-works"
                  className="rounded-full border border-white/18 px-6 py-3 text-sm font-medium text-[#f8f1e7] transition hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/6"
                >
                  See how it works
                </a>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[linear-gradient(180deg,_rgba(255,255,255,0.06),_rgba(255,255,255,0.03))] p-5 shadow-[0_32px_120px_rgba(0,0,0,0.38)]">
              <div className="absolute inset-x-8 top-0 h-px bg-white/12" />
              <div className="rounded-[1.7rem] bg-[linear-gradient(160deg,_#221b16,_#1a1512_46%,_#243038_100%)] p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.28em] text-[#dcc8ac]">How MoLeads works</div>
                    <div className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
                      First contact should create visible operator work.
                    </div>
                  </div>
                  <div className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-[#f2e5d2]">
                    Operator-first
                  </div>
                </div>

                <div className="mt-8 space-y-4">
                  {processSteps.map((item) => (
                    <div key={item.step} className="grid grid-cols-[auto_1fr] gap-4 rounded-2xl border border-white/8 bg-white/5 p-4">
                      <div className="text-xs uppercase tracking-[0.24em] text-[#f0d7af]">{item.step}</div>
                      <div>
                        <div className="text-lg font-medium text-[#f8f1e7]">{item.title}</div>
                        <div className="mt-2 text-sm leading-7 text-[#d8c9b5]">{item.body}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 border-t border-white/10 pt-6">
                  <div className="text-xs uppercase tracking-[0.24em] text-[#dcc8ac]">Core capabilities</div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {servicePillars.map((pillar) => (
                      <span key={pillar} className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-[#f1e3d0]">
                        {pillar}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#ddd0c2] bg-[#efe6da]">
        <div className="mx-auto max-w-7xl px-6 py-8 md:px-10 lg:px-12">
          <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.28em] text-[#8a6a4d]">
            <span className="mr-2 text-[#5a4738]">Best fit</span>
            {[
              'Teams handling inbound demand every day',
              'Operators who need cleaner next actions',
              'Service businesses tired of dropped follow-up',
              'Founders who want visible execution, not just more leads'
            ].map((marker) => (
              <span key={marker} className="rounded-full border border-[#d7c7b6] bg-[#f7f0e7] px-4 py-2">
                {marker}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl px-6 py-20 md:px-10 lg:px-12">
        <div className="max-w-3xl">
          <div className="text-xs uppercase tracking-[0.28em] text-[#8e7054]">How it works</div>
          <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-[#17120f] md:text-6xl">
            Inbound calls or requests come in, first-pass intake keeps the details visible, and operators can follow through from clear next actions.
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#5d4b3d]">
            The flow is simple: demand comes in, routing and intake organize what happened first, operators can review the work, and follow-up stays attached until it is handled.
          </p>
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="grid gap-4">
            {processSteps.map((item) => (
              <div key={item.step} className="grid grid-cols-[64px_1fr] gap-5 border-t border-[#d8cdc0] pt-5">
                <div className="text-sm font-medium tracking-[0.24em] text-[#8e7054]">{item.step}</div>
                <div>
                  <div className="text-xl font-semibold tracking-[-0.03em] text-[#17120f]">{item.title}</div>
                  <p className="mt-2 text-base leading-8 text-[#5d4b3d]">{item.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-5">
            {capabilities.map((item) => (
              <article
                key={item.title}
                className="rounded-[1.8rem] border border-[#d7cdc0] bg-[#fbf7f0] p-7 shadow-[0_20px_60px_rgba(33,24,20,0.06)]"
              >
                <div className="text-lg font-semibold tracking-[-0.03em] text-[#17120f]">{item.title}</div>
                <p className="mt-4 text-base leading-8 text-[#5d4b3d]">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20 md:px-10 lg:px-12">
        <div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr]">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-[#8e7054]">What buyers can inspect</div>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-[#17120f] md:text-5xl">
              The proof is that the workflow stays visible after first contact.
            </h2>
            <p className="mt-6 max-w-md text-base leading-8 text-[#5d4b3d]">
              Buyers should be able to inspect three things quickly: that inbound work is captured, that first-pass intake and routing are visible, and that operators can review and follow up without guessing.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {workflowProof.map((item) => (
              <article
                key={item.title}
                className="flex flex-col rounded-[1.9rem] border border-[#d9cdc0] bg-[#fffaf3] p-6 shadow-[0_18px_60px_rgba(16,24,40,0.06)]"
              >
                <div className="text-lg font-semibold tracking-[-0.03em] text-[#17120f]">{item.title}</div>
                <p className="mt-4 flex-1 text-base leading-8 text-[#3f3127]">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>


      <section className="bg-[#17120f] text-[#f8f1e7]">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 md:px-10 lg:grid-cols-[0.92fr_1.08fr] lg:px-12">
          <div className="max-w-xl">
            <div className="text-xs uppercase tracking-[0.28em] text-[#dcc8ac]">Frequently asked</div>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] md:text-5xl">
              Enough clarity for a buyer. Enough structure for the team behind the work.
            </h2>
          </div>
          <div className="grid gap-4">
            {faqs.map((item) => (
              <div key={item.question} className="rounded-[1.6rem] border border-white/10 bg-white/5 p-6">
                <div className="text-lg font-medium text-[#f8f1e7]">{item.question}</div>
                <p className="mt-3 text-base leading-8 text-[#d8c9b5]">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="mx-auto max-w-7xl px-6 py-20 md:px-10 lg:px-12">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="max-w-xl">
            <div className="text-xs uppercase tracking-[0.28em] text-[#8e7054]">Request intake review</div>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-[#17120f] md:text-5xl">
              Show us where inbound calls or requests need a clearer intake and follow-up path.
            </h2>
            <p className="mt-6 text-base leading-8 text-[#5d4b3d]">
              Use the form to request intake review. Inbound requests are captured as visible work, first-pass intake keeps the details attached, and operators can review and follow up with clear next actions.
            </p>
          </div>

          {leadRequested ? (
            <div className="grid gap-4 rounded-[2rem] border border-emerald-300/30 bg-[linear-gradient(180deg,_rgba(16,185,129,0.12),_rgba(255,255,255,0.82))] p-7 shadow-[0_24px_80px_rgba(16,24,40,0.08)]">
              <div className="text-xs uppercase tracking-[0.28em] text-[#147557]">Request received</div>
              <div className="max-w-2xl text-3xl font-semibold tracking-[-0.04em] text-[#17120f]">
                {requestedCompany} is now in the intake workflow.
              </div>
              {successWarning ? (
                <div className="rounded-2xl border border-amber-300/40 bg-amber-100/70 px-4 py-3 text-sm text-[#6d4f0e]">
                  {successWarning}
                </div>
              ) : null}
              <p className="max-w-2xl text-base leading-8 text-[#4b3a2d]">
                The request has been captured as a live work item. First-pass intake keeps the submitted details attached, then operators can review it, prioritize it, and move it into follow-up with clear next actions.
              </p>
              <div className="grid gap-3 text-sm text-[#17120f] md:grid-cols-3">
                <div className="rounded-xl border border-[#d6d0c6] bg-white/70 px-4 py-3">1. Request is captured as intake work</div>
                <div className="rounded-xl border border-[#d6d0c6] bg-white/70 px-4 py-3">2. First-pass intake organizes the details</div>
                <div className="rounded-xl border border-[#d6d0c6] bg-white/70 px-4 py-3">3. Operators can review and follow up</div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <a
                  href="/"
                  className="rounded-full bg-[#17120f] px-6 py-3 text-sm font-medium text-[#f8f1e7] transition hover:-translate-y-0.5 hover:bg-[#2b221c]"
                >
                  Submit another request
                </a>
                <a
                  href="/prospects?status=READY"
                  className="rounded-full border border-[#17120f]/15 px-6 py-3 text-sm font-medium text-[#17120f] transition hover:-translate-y-0.5 hover:border-[#17120f] hover:bg-white/70"
                >
                  Open operator queue
                </a>
              </div>
            </div>
          ) : (
            <form
              action={requestConsultation}
              className="grid gap-4 rounded-[2rem] border border-[#d9cdc0] bg-[#fffaf3] p-6 shadow-[0_24px_80px_rgba(16,24,40,0.08)]"
            >
              <div className="grid gap-2">
                <div className="text-xs uppercase tracking-[0.28em] text-[#8e7054]">Business intake details</div>
                <p className="max-w-2xl text-sm leading-7 text-[#5d4b3d]">
                  Send the business, contact, and intake context the team needs to understand the request on the first pass.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="font-medium">Company name</span>
                  <input
                    name="companyName"
                    placeholder="Sterling Dental Group"
                    required
                    className="w-full rounded-xl border border-[#ddd2c7] bg-white px-3 py-2.5 text-sm text-[#17120f] placeholder:text-[#8d7763]"
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium">Contact name</span>
                  <input
                    name="contactName"
                    placeholder="Alicia Grant"
                    className="w-full rounded-xl border border-[#ddd2c7] bg-white px-3 py-2.5 text-sm text-[#17120f] placeholder:text-[#8d7763]"
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium">Phone</span>
                  <span className="block text-xs leading-6 text-[#7b6654]">Add a direct callback number if phone follow-up is the best next step.</span>
                  <input
                    name="contactPhone"
                    placeholder="703-555-0200"
                    className="w-full rounded-xl border border-[#ddd2c7] bg-white px-3 py-2.5 text-sm text-[#17120f] placeholder:text-[#8d7763]"
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium">Email</span>
                  <span className="block text-xs leading-6 text-[#7b6654]">Use email when that is the best contact path or when phone is not available.</span>
                  <input
                    name="contactEmail"
                    type="email"
                    placeholder="owner@example.com"
                    className="w-full rounded-xl border border-[#ddd2c7] bg-white px-3 py-2.5 text-sm text-[#17120f] placeholder:text-[#8d7763]"
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium">City</span>
                  <input
                    name="city"
                    placeholder="Reston"
                    className="w-full rounded-xl border border-[#ddd2c7] bg-white px-3 py-2.5 text-sm text-[#17120f] placeholder:text-[#8d7763]"
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium">State</span>
                  <input
                    name="state"
                    placeholder="VA"
                    className="w-full rounded-xl border border-[#ddd2c7] bg-white px-3 py-2.5 text-sm text-[#17120f] placeholder:text-[#8d7763]"
                  />
                </label>
              </div>

              <label className="space-y-2 text-sm">
                <span className="font-medium">What are you trying to improve?</span>
                <span className="block text-xs leading-6 text-[#7b6654]">Describe the intake or follow-up part of the workflow that currently feels messy.</span>
                <input
                  name="serviceInterest"
                  placeholder="Lead intake, follow-up, and operator visibility"
                  className="w-full rounded-xl border border-[#ddd2c7] bg-white px-3 py-2.5 text-sm text-[#17120f] placeholder:text-[#8d7763]"
                />
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-medium">Notes</span>
                <textarea
                  name="notes"
                  rows={4}
                  placeholder="Tell us where leads are getting lost, delayed, or handled inconsistently."
                  className="w-full rounded-xl border border-[#ddd2c7] bg-white px-3 py-2.5 text-sm text-[#17120f] placeholder:text-[#8d7763]"
                />
              </label>

              <div className="rounded-2xl border border-[#ddd2c7] bg-[#fbf6ee] px-4 py-4">
                <div className="text-xs uppercase tracking-[0.24em] text-[#8e7054]">What happens after submit</div>
                <div className="mt-3 grid gap-2 text-sm leading-7 text-[#3f3127]">
                  <div>1. The request is captured as intake work.</div>
                  <div>2. First-pass intake organizes the business and contact details.</div>
                  <div>3. Operators can review it and move follow-up forward.</div>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-md text-sm leading-6 text-[#5d4b3d]">
                  The request stays visible in the workflow instead of disappearing into a generic website inbox.
                </p>
                <button className="rounded-full bg-[#17120f] px-6 py-3 text-sm font-medium text-[#f8f1e7] transition hover:-translate-y-0.5 hover:bg-[#2b221c]">
                  Request intake review
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
