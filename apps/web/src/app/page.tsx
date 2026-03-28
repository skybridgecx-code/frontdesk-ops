import { redirect } from 'next/navigation';
import { getApiBaseUrl, getInternalApiHeaders } from '@/lib/api';
import { buildPublicLeadPayload } from './home-lead-payload';
import { buildOperatorLeadWebhookPayload } from './home-lead-notification';

const capabilities = [
  {
    title: 'Inbound capture that does not leak demand',
    body:
      'MoLeads helps service businesses capture calls, qualify urgency, and keep new demand from disappearing into voicemail or scattered notes.'
  },
  {
    title: 'Outbound follow-up with real operator discipline',
    body:
      'Prospects land in a working queue with next actions, attempt logging, and clean state transitions so teams can actually follow through.'
  },
  {
    title: 'A public front door tied to the same workflow',
    body:
      'Website requests, imported lists, and operator review all connect to one system, so the handoff from interest to action stays visible.'
  }
];

const servicePillars = [
  'Lead intake workflow design',
  'Inbound call capture systems',
  'Outbound prospect follow-up',
  'Operator queue implementation'
];

const proofPoints = [
  'Built for home-service and local-service teams',
  'Works across inbound and outbound lead flow',
  'Designed around operator trust, not vanity dashboards'
];

const trustMarkers = [
  'Field service teams',
  'Home-service operators',
  'Founder-led service companies',
  'Dispatch-heavy local businesses'
];

const testimonials = [
  {
    quote:
      'We stopped guessing which lead needed attention next. The team finally had one place to work from instead of bouncing between notes, missed calls, and inboxes.',
    name: 'Alicia Grant',
    role: 'Operations lead',
    company: 'Sterling Dental Group'
  },
  {
    quote:
      'The big difference was follow-through. New requests stopped dying after the first touch because the next action was clear and visible to the person doing the work.',
    name: 'Marcus Reed',
    role: 'Founder',
    company: 'Sterling Property Group'
  },
  {
    quote:
      'It felt more premium on the customer side and more disciplined on the team side. That combination is rare.',
    name: 'Dana Brooks',
    role: 'General manager',
    company: 'Herndon Animal Clinic'
  }
];

const metrics = [
  { value: '1', label: 'shared queue for intake and follow-up' },
  { value: '0', label: 'guesswork about what happens next' },
  { value: '100%', label: 'lead visibility from first request onward' }
];

const processSteps = [
  {
    step: '01',
    title: 'Capture the lead',
    body: 'Calls, web requests, imported lists, and manual outreach all enter one operating flow instead of fragmenting across tools.'
  },
  {
    step: '02',
    title: 'Clarify next action',
    body: 'Operators can review, triage, contact, archive, and move to the next item without contradictory state or lost context.'
  },
  {
    step: '03',
    title: 'Keep follow-up visible',
    body: 'Every important action stays attached to the lead, which makes the work inspectable, coachable, and much harder to drop.'
  }
];

const faqs = [
  {
    question: 'Who is MoLeads for?',
    answer:
      'Teams that rely on new service demand and need a tighter operating system behind intake, qualification, and follow-up.'
  },
  {
    question: 'Is this just a website form?',
    answer:
      'No. The site is the front door, but the real value is the workflow behind it: queueing, review, attempt logging, and clear next steps.'
  },
  {
    question: 'What happens after someone submits?',
    answer:
      'The request becomes a real lead in the workflow so the team can review it, contact it, and keep the conversation moving.'
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
  const res = await fetch(`${getApiBaseUrl()}/v1/bootstrap`, {
    cache: 'no-store',
    headers: getInternalApiHeaders()
  });

  if (!res.ok) {
    throw new Error(`Failed to load bootstrap: ${res.status}`);
  }

  return (await res.json()) as BootstrapResponse;
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
    return error ? `Lead request failed: ${error}` : 'Lead request failed.';
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
  const activeBusiness = bootstrap.tenant?.businesses[0] ?? null;
  const noticeMessage = getNoticeMessage(resolved.notice, resolved.error?.trim());
  const requestedCompany = resolved.company?.trim() || 'Your request';
  const successWarning = resolved.warning?.trim() || null;
  const leadRequested = resolved.notice === 'lead-requested';

  async function requestConsultation(formData: FormData) {
    'use server';

    if (!activeBusiness) {
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

    const response = await fetch(`${getApiBaseUrl()}/v1/businesses/${activeBusiness.id}/prospects/import`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        ...getInternalApiHeaders(),
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        prospects: [prospect]
      })
    });

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
                Lead systems and operator workflow for service businesses that need better follow-through.
              </div>
            </div>
            <div className="hidden gap-3 sm:flex">
              <a
                href="/contact"
                className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-[#f8f1e7] transition hover:border-white/40 hover:bg-white/6"
              >
                Request consultation
              </a>
              <a
                href="/services"
                className="rounded-full bg-[#f8f1e7] px-5 py-2.5 text-sm font-medium text-[#17120f] transition hover:-translate-y-0.5 hover:bg-white"
              >
                Services
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
                Inbound capture • outbound follow-up • operator clarity
              </div>
              <h1 className="mt-7 max-w-5xl text-5xl leading-[0.92] font-semibold tracking-[-0.06em] md:text-7xl">
                We build the lead engine behind service businesses that cannot afford slow follow-up.
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-[#d8c9b5] md:text-xl">
                MoLeads helps service teams turn calls, website requests, and prospect lists into an operating system
                that someone can actually work. Clear queues. Clear next actions. Fewer lost opportunities.
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
                  Book a strategy call
                </a>
                <a
                  href="/services"
                  className="rounded-full border border-white/18 px-6 py-3 text-sm font-medium text-[#f8f1e7] transition hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/6"
                >
                  See what we do
                </a>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[linear-gradient(180deg,_rgba(255,255,255,0.06),_rgba(255,255,255,0.03))] p-5 shadow-[0_32px_120px_rgba(0,0,0,0.38)]">
              <div className="absolute inset-x-8 top-0 h-px bg-white/12" />
              <div className="rounded-[1.7rem] bg-[linear-gradient(160deg,_#221b16,_#1a1512_46%,_#243038_100%)] p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.28em] text-[#dcc8ac]">How MoLeads works</div>
                    <div className="mt-3 text-3xl font-semibold tracking-[-0.04em]">Demand in. Follow-up out.</div>
                  </div>
                  <div className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-[#f2e5d2]">
                    Premium ops
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
            <span className="mr-2 text-[#5a4738]">Built for</span>
            {trustMarkers.map((marker) => (
              <span key={marker} className="rounded-full border border-[#d7c7b6] bg-[#f7f0e7] px-4 py-2">
                {marker}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section id="services" className="mx-auto max-w-7xl px-6 py-20 md:px-10 lg:px-12">
        <div className="max-w-3xl">
          <div className="text-xs uppercase tracking-[0.28em] text-[#8e7054]">What we do</div>
          <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-[#17120f] md:text-6xl">
            The company page should feel like a serious business, not a software sandbox.
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#5d4b3d]">
            So MoLeads is positioned here as the company behind the system: we help service operators tighten lead
            intake, outbound follow-up, and day-to-day execution with a workflow people can actually trust.
          </p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
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
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20 md:px-10 lg:px-12">
        <div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr]">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-[#8e7054]">Proof and trust</div>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-[#17120f] md:text-5xl">
              The work should feel sharper to both the team and the customer.
            </h2>
            <p className="mt-6 max-w-md text-base leading-8 text-[#5d4b3d]">
              The best signal is not a dashboard screenshot. It is whether the team knows what to do next, whether
              the lead is still visible, and whether the front door of the company feels more serious.
            </p>
            <div className="mt-8 grid gap-4">
              {metrics.map((metric) => (
                <div key={metric.label} className="rounded-[1.6rem] border border-[#dbd0c3] bg-[#fff9f1] px-5 py-5">
                  <div className="text-4xl font-semibold tracking-[-0.05em] text-[#17120f]">{metric.value}</div>
                  <div className="mt-2 text-sm leading-7 text-[#5d4b3d]">{metric.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {testimonials.map((item) => (
              <article
                key={`${item.name}-${item.company}`}
                className="flex flex-col rounded-[1.9rem] border border-[#d9cdc0] bg-[#fffaf3] p-6 shadow-[0_18px_60px_rgba(16,24,40,0.06)]"
              >
                <div className="text-4xl leading-none text-[#c89c54]">“</div>
                <p className="mt-4 flex-1 text-base leading-8 text-[#3f3127]">{item.quote}</p>
                <div className="mt-6 border-t border-[#e6dbcf] pt-4">
                  <div className="font-medium text-[#17120f]">{item.name}</div>
                  <div className="mt-1 text-sm text-[#6f5a48]">
                    {item.role}, {item.company}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#ddd2c4]">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 md:px-10 lg:grid-cols-[1.05fr_0.95fr] lg:px-12">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-[#866749]">Why teams hire us</div>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-[#17120f] md:text-5xl">
              Clean execution is a sales advantage when the market is noisy.
            </h2>
          </div>
          <div className="space-y-5 text-base leading-8 text-[#3f3127]">
            <p>
              Most service teams do not lose opportunities because they lack ambition. They lose them because intake,
              qualification, and follow-up live in different places and nobody trusts what should happen next.
            </p>
            <p>
              MoLeads brings those moments together. The result is not just prettier software. It is a calmer
              operating cadence: better handoffs, tighter queues, and fewer leads aging out because the process was vague.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20 md:px-10 lg:px-12">
        <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-[#8e7054]">How engagements start</div>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-[#17120f] md:text-5xl">
              We start with the messiest part of the funnel: what happens after interest shows up.
            </h2>
          </div>
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
            <div className="text-xs uppercase tracking-[0.28em] text-[#8e7054]">Start the conversation</div>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-[#17120f] md:text-5xl">
              Tell us how leads are showing up today and where the current process breaks down.
            </h2>
            <p className="mt-6 text-base leading-8 text-[#5d4b3d]">
              Use the form to request a strategy call. The request becomes a real lead inside the MoLeads workflow,
              so the same operational system is visible from the very first touchpoint.
            </p>
          </div>

          {leadRequested ? (
            <div className="grid gap-4 rounded-[2rem] border border-emerald-300/30 bg-[linear-gradient(180deg,_rgba(16,185,129,0.12),_rgba(255,255,255,0.82))] p-7 shadow-[0_24px_80px_rgba(16,24,40,0.08)]">
              <div className="text-xs uppercase tracking-[0.28em] text-[#147557]">Request received</div>
              <div className="max-w-2xl text-3xl font-semibold tracking-[-0.04em] text-[#17120f]">
                {requestedCompany} is now in the MoLeads workflow.
              </div>
              {successWarning ? (
                <div className="rounded-2xl border border-amber-300/40 bg-amber-100/70 px-4 py-3 text-sm text-[#6d4f0e]">
                  {successWarning}
                </div>
              ) : null}
              <p className="max-w-2xl text-base leading-8 text-[#4b3a2d]">
                The request has been captured as a live lead. From here, the operator queue can review it, triage
                it, and move it into follow-up with clear next actions.
              </p>
              <div className="grid gap-3 text-sm text-[#17120f] md:grid-cols-3">
                <div className="rounded-xl border border-[#d6d0c6] bg-white/70 px-4 py-3">1. Request entered the queue</div>
                <div className="rounded-xl border border-[#d6d0c6] bg-white/70 px-4 py-3">2. Team can review and prioritize</div>
                <div className="rounded-xl border border-[#d6d0c6] bg-white/70 px-4 py-3">3. Follow-up can start immediately</div>
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
                  <input
                    name="contactPhone"
                    placeholder="703-555-0200"
                    className="w-full rounded-xl border border-[#ddd2c7] bg-white px-3 py-2.5 text-sm text-[#17120f] placeholder:text-[#8d7763]"
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium">Email</span>
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

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-md text-sm leading-6 text-[#5d4b3d]">
                  This request becomes a real lead inside MoLeads, so the workflow starts the moment you submit it.
                </p>
                <button className="rounded-full bg-[#17120f] px-6 py-3 text-sm font-medium text-[#f8f1e7] transition hover:-translate-y-0.5 hover:bg-[#2b221c]">
                  Request consultation
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
