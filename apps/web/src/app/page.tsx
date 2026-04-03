import { redirect } from 'next/navigation';
import { getApiBaseUrl, getInternalApiHeaders } from '@/lib/api';
import { buildPublicLeadPayload } from './home-lead-payload';
import { InteractiveCallFlow } from './interactive-call-flow';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SkybridgeCX | AI front desk for service businesses',
  description:
    'SkybridgeCX answers calls, captures requests, routes urgent work, and keeps follow-up clean for service businesses.'
};

const problemBefore = [
  'The phone rings after hours and nobody picks up.',
  'Hot jobs disappear into voicemail.',
  'Office staff get pulled away by every interruption.',
  'Urgent calls need judgment, not a generic inbox.'
];

const problemAfter = [
  'The call gets answered immediately.',
  'The caller is qualified and logged cleanly.',
  'Urgent work is routed where it belongs.',
  'The next step stays visible until someone handles it.'
];

const howItWorks = [
  {
    step: '01',
    title: 'Connect the business',
    body: 'Point SkybridgeCX at the number and intake path already in use.'
  },
  {
    step: '02',
    title: 'SkybridgeCX handles the call',
    body: 'The caller is answered, qualified, and routed with the right context attached.'
  },
  {
    step: '03',
    title: 'Your team gets the handoff',
    body: 'Booked jobs, summaries, and follow-up details stay visible for the business.'
  }
];

const industries = [
  {
    title: 'HVAC',
    pattern: 'No heat · no cooling · after-hours',
    body: 'After-hours breakdowns, maintenance questions, and urgent callbacks stay covered.'
  },
  {
    title: 'Plumbing',
    pattern: 'Leak · backup · shutoff urgency',
    body: 'Leaks, backups, and emergency jobs need a real answer on the first ring.'
  },
  {
    title: 'Electrical',
    pattern: 'Outage · safety issue · quick triage',
    body: 'Power issues and safety-related calls need clear routing, not voicemail.'
  },
  {
    title: 'Roofing',
    pattern: 'Storm damage · estimate capture',
    body: 'Storm damage and estimate requests need clean intake before they go cold.'
  },
  {
    title: 'Garage Doors',
    pattern: 'Trapped vehicle · broken spring',
    body: 'Stuck-door emergencies and repair calls need quick qualification.'
  },
  {
    title: 'Locksmith',
    pattern: 'Urgent access · immediate dispatch',
    body: 'Urgent access calls should be answered, logged, and routed immediately.'
  }
];

const operationalProof = [
  {
    title: '24/7 coverage',
    body: 'The front desk keeps answering when the office is closed.'
  },
  {
    title: 'Urgent-call routing',
    body: 'Emergency work gets a fast path to the right person.'
  },
  {
    title: 'Clean summaries',
    body: 'The team sees issue, location, urgency, and callback.'
  },
  {
    title: 'Clean handoff',
    body: 'The next step stays visible until someone handles it.'
  }
];

const outcomes = [
  {
    title: 'Fewer missed opportunities',
    body: 'The caller gets handled before the job goes somewhere else.'
  },
  {
    title: 'Faster response to hot leads',
    body: 'Urgent calls surface quickly instead of getting buried.'
  },
  {
    title: 'Less interruption for staff',
    body: 'The office can stay focused without every ring becoming a distraction.'
  },
  {
    title: 'More booked work from inbound demand',
    body: 'The business keeps more of the work that is already trying to come in.'
  }
];

const faqs = [
  {
    question: 'Will it sound robotic?',
    answer:
      'No. It should sound like a calm front desk interaction that gets the basics without overtalking the caller.'
  },
  {
    question: 'What happens after hours?',
    answer:
      'The call still gets answered, the request is captured, and urgent work can be flagged for the next step.'
  },
  {
    question: 'Can it route urgent calls?',
    answer:
      'Yes. Time-sensitive calls can be separated from routine requests and routed with the right context attached.'
  },
  {
    question: 'Can it book appointments?',
    answer:
      'It can capture the request and move qualified calls toward booking or the right follow-up path.'
  },
  {
    question: 'Does it replace my staff?',
    answer:
      'No. It reduces missed calls and repetitive intake so the team can focus on the calls that need a person.'
  },
  {
    question: 'How fast can setup happen?',
    answer:
      'Setup depends on the workflow, but the first pass should stay focused on the number, the call path, and the handoff.'
  }
];

function SectionHeading({
  eyebrow,
  title,
  description,
  centered = false,
  tone = 'light'
}: {
  eyebrow: string;
  title: string;
  description?: string;
  centered?: boolean;
  tone?: 'light' | 'dark';
}) {
  const isDark = tone === 'dark';
  return (
    <div className={centered ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}>
      <div className={`text-xs uppercase tracking-[0.34em] ${isDark ? 'text-[#a5b0ff]' : 'text-[#7c5cff]'}`}>
        {eyebrow}
      </div>
      <h2
        className={`mt-4 text-4xl font-semibold tracking-[-0.06em] md:text-6xl ${isDark ? 'text-white' : 'text-[#0f172a]'}`}
      >
        {title}
      </h2>
      {description ? (
        <p className={`mt-5 text-lg leading-8 ${isDark ? 'text-[#cbd2f0]' : 'text-[#5f6678]'}`}>{description}</p>
      ) : null}
    </div>
  );
}

function HeroScene() {
  return (
    <div className="relative mx-auto w-full max-w-[760px]">
      <div className="absolute -left-12 top-8 h-48 w-48 rounded-full bg-[#7c5cff]/18 blur-3xl animate-glow-pulse" />
      <div className="absolute right-[-2rem] top-0 h-56 w-56 rounded-full bg-[#8bcbff]/16 blur-3xl animate-drift-slow" />
      <div className="absolute left-1/4 bottom-4 h-24 w-24 rounded-full bg-[#10b981]/10 blur-2xl animate-float-slow" />

      <div className="relative overflow-hidden rounded-[3rem] border border-white/12 bg-[linear-gradient(180deg,#050816,#0e1528_48%,#0a1020)] p-5 shadow-[0_50px_130px_rgba(15,23,42,0.32)]">
        <div
          className="absolute inset-0 opacity-35"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
            backgroundSize: '72px 72px'
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(124,92,255,0.24),transparent_22%),radial-gradient(circle_at_78%_18%,rgba(59,130,246,0.18),transparent_18%),radial-gradient(circle_at_50%_70%,rgba(16,185,129,0.10),transparent_24%)]" />

        <div className="relative flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(124,92,255,0.22)]">
              M
            </div>
            <div>
              <div className="text-sm font-semibold tracking-[-0.03em] text-white">SkybridgeCX live</div>
              <div className="text-[11px] uppercase tracking-[0.28em] text-[#a5b0ff]">AI front desk</div>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[11px] uppercase tracking-[0.26em] text-[#eef1ff]">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_6px_rgba(16,185,129,0.12)]" />
            24/7
          </div>
        </div>

        <div className="relative mt-6 grid gap-4 lg:grid-cols-[1.02fr_0.98fr] lg:items-start">
          <div className="space-y-4">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-[0_12px_28px_rgba(15,23,42,0.10)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.32em] text-[#a5b0ff]">Incoming call</div>
                  <div className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-white">
                    Water heater leak
                  </div>
                </div>
                <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-emerald-100">
                  Answered
                </div>
              </div>

              <div className="mt-5 grid gap-3 text-sm text-[#eef1ff]">
                <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.26em] text-[#a5b0ff]">Caller</div>
                  <div className="mt-1 text-white">Mark R. · 703-555-0142</div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.26em] text-[#a5b0ff]">Live signal</div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
                    <div className="h-full w-[62%] rounded-full bg-[linear-gradient(90deg,#7c5cff,#8bcbff)] animate-glow-pulse" />
                  </div>
                  <div className="mt-3 text-white">After hours · urgent</div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.26em] text-[#a5b0ff]">Next step</div>
                  <div className="mt-1 text-white">Route to on-call tech</div>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-[0_12px_28px_rgba(15,23,42,0.10)]">
              <div className="flex items-center justify-between gap-4">
                <div className="text-[11px] uppercase tracking-[0.32em] text-[#a5b0ff]">Conversation summary</div>
                <div className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-[#eef1ff]">
                  Structured
                </div>
              </div>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-[#eef1ff]">
                  2148 Cedar Lane. Callback requested. Urgent leak flagged.
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-[#eef1ff]">
                  The call is ready for the on-call review queue.
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[2rem] border border-[#eadfff] bg-[linear-gradient(180deg,#ffffff,#f6f1ff)] p-5 shadow-[0_24px_70px_rgba(111,63,245,0.14)]">
              <div className="flex items-center justify-between gap-4">
                <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a61e8]">Transcript layer</div>
                <div className="rounded-full bg-[#111827] px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white">
                  Live
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm text-[#4b5563]">
                <div className="rounded-2xl border border-[#ece5ff] bg-white px-4 py-3 shadow-[0_14px_30px_rgba(111,63,245,0.08)]">
                  My water heater is leaking and I need someone tonight.
                </div>
                <div className="rounded-2xl border border-[#ece5ff] bg-white px-4 py-3 shadow-[0_14px_30px_rgba(111,63,245,0.08)]">
                  What is the address, and what is the best callback number?
                </div>
                <div className="rounded-2xl border border-[#ece5ff] bg-[#faf6ff] px-4 py-3">
                  2148 Cedar Lane · fast response needed
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[2rem] border border-[#e3ecff] bg-[linear-gradient(180deg,#f8fbff,#fff)] p-5 shadow-[0_20px_50px_rgba(59,130,246,0.10)]">
                <div className="text-[11px] uppercase tracking-[0.3em] text-[#4674d8]">Issue / location</div>
                <div className="mt-3 text-sm leading-7 text-[#4b5563]">
                  Water heater leak. 2148 Cedar Lane. After-hours urgency.
                </div>
              </div>
              <div className="rounded-[2rem] border border-[#dbeee3] bg-[linear-gradient(180deg,#f6fbf8,#fff)] p-5 shadow-[0_20px_50px_rgba(34,197,94,0.10)]">
                <div className="text-[11px] uppercase tracking-[0.3em] text-[#2e8a57]">Handoff</div>
                <div className="mt-3 text-sm leading-7 text-[#4b5563]">
                  Urgent work routed. The team sees the next move.
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.04))] p-5 text-[#eef1ff] backdrop-blur-xl">
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#a5b0ff]">Ready to route</div>
              <div className="mt-2 text-sm leading-7">
                The next request stays in motion until someone handles it.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type HomeSearchParams = {
  notice?: string;
  error?: string;
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
    return 'Request received. We’ll review it and follow up.';
  }

  if (notice === 'lead-request-failed') {
    return error ? `We could not send the request: ${error}` : 'We could not send the request. Please try again.';
  }

  return null;
}

export default async function Home({
  searchParams
}: {
  searchParams: Promise<HomeSearchParams>;
}) {
  const resolved = await searchParams;
  const bootstrap = await getBootstrap();
  const activeBusiness = bootstrap?.tenant?.businesses[0] ?? null;
  const noticeMessage = getNoticeMessage(resolved.notice, resolved.error?.trim());
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

    const response = await fetch(
      `${getApiBaseUrl()}/v1/businesses/${activeBusiness.id}/prospects/import`,
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

    await response.json() as ImportLeadResponse;

    redirect(buildHomeNoticeHref('lead-requested'));
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f7f6f2] text-[#111827]">
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 opacity-[0.32]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(17,24,39,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(17,24,39,0.045) 1px, transparent 1px)',
            backgroundSize: '72px 72px'
          }}
        />
        <div className="absolute -left-24 top-0 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,rgba(124,92,255,0.18),transparent_68%)] blur-3xl" />
        <div className="absolute right-[-7rem] top-[8rem] h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.10),transparent_70%)] blur-3xl" />
        <div className="absolute left-1/2 top-[34rem] h-[18rem] w-[18rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.08),transparent_68%)] blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-white/60" />
      </div>

      <section id="product" className="relative scroll-mt-24">
        <div className="mx-auto max-w-7xl px-6 pt-4 md:px-10 lg:px-12 lg:pt-6">
          <header className="sticky top-4 z-50 flex items-center justify-between gap-6 rounded-full border border-white/70 bg-white/78 px-5 py-3 shadow-[0_18px_60px_rgba(27,33,64,0.08)] backdrop-blur-xl">
            <a href="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#7c5cff,#b48cff)] text-sm font-semibold text-white shadow-[0_12px_26px_rgba(124,92,255,0.35)]">
                M
              </div>
              <div>
                <div className="text-sm font-semibold tracking-[-0.03em] text-[#111827]">SkybridgeCX</div>
                <div className="text-xs text-[#6b7280]">AI front desk for service businesses</div>
              </div>
            </a>

            <nav className="hidden items-center gap-7 text-sm text-[#4b5563] lg:flex">
              <a href="#product" className="transition hover:text-[#111827]">
                Product
              </a>
              <a href="#how-it-works" className="transition hover:text-[#111827]">
                How It Works
              </a>
              <a href="#industries" className="transition hover:text-[#111827]">
                Industries
              </a>
              <a href="#faq" className="transition hover:text-[#111827]">
                FAQs
              </a>
              <a href="#book-demo" className="transition hover:text-[#111827]">
                Book Demo
              </a>
            </nav>

            <div className="flex items-center gap-3">
              <a
                href="#sample-call"
                className="hidden rounded-full px-4 py-2 text-sm font-medium text-[#111827] transition hover:text-[#0b1120] lg:inline-flex"
              >
                Hear a Sample Call
              </a>
              <a
                href="#book-demo"
                className="inline-flex items-center gap-2 rounded-full bg-[#111827] px-5 py-2.5 text-sm font-medium text-white shadow-[0_16px_32px_rgba(17,24,39,0.18)] transition hover:-translate-y-0.5 hover:bg-[#0b1120]"
              >
                Book a Demo
                <span aria-hidden="true">→</span>
              </a>
            </div>
          </header>

          {noticeMessage && !leadRequested ? (
            <div className="mt-5 rounded-2xl border border-[#f2dfbf] bg-[#fff8ea] px-4 py-3 text-sm text-[#6b4f16] shadow-[0_12px_40px_rgba(111,63,245,0.08)]">
              {noticeMessage}
            </div>
          ) : null}

          <div className="grid gap-12 pb-12 pt-16 lg:grid-cols-[0.96fr_1.04fr] lg:items-center lg:pb-20 lg:pt-24">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#f0e4bf] bg-[#fff4c9] px-4 py-2 text-xs font-medium uppercase tracking-[0.28em] text-[#5c4a12] shadow-[0_10px_24px_rgba(213,179,48,0.12)]">
                <span className="inline-block h-2 w-2 rounded-full bg-[#7c5cff]" />
                Always-on intake for service businesses
              </div>

              <h1 className="mt-8 max-w-4xl text-5xl font-semibold tracking-[-0.08em] text-[#0b1020] md:text-7xl lg:text-[5.8rem] lg:leading-[0.92]">
                Never miss another <span className="italic text-[#7c5cff]">booked job.</span>
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-[#5f6678] md:text-xl">
                SkybridgeCX is the AI front desk for home-service businesses. It answers inbound calls 24/7, qualifies the
                request, routes urgent work, books next steps, and hands your team a clean summary.
              </p>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#book-demo"
                  className="inline-flex items-center justify-center rounded-full bg-[#111827] px-6 py-3.5 text-sm font-medium text-white shadow-[0_20px_40px_rgba(17,24,39,0.18)] transition hover:-translate-y-0.5 hover:bg-[#0b1120]"
                >
                  Book a Demo
                </a>
                <a
                  href="#sample-call"
                  className="inline-flex items-center justify-center rounded-full border border-[#d9dbe6] bg-white px-6 py-3.5 text-sm font-medium text-[#111827] shadow-[0_10px_30px_rgba(17,24,39,0.05)] transition hover:-translate-y-0.5 hover:border-[#c7c9d8] hover:bg-[#fbfbfd]"
                >
                  Hear a Sample Call
                </a>
              </div>

              <div className="mt-10 overflow-hidden rounded-[1.7rem] border border-[#dfe4f0] bg-[linear-gradient(180deg,#ffffff,#f8fafc)] shadow-[0_18px_40px_rgba(17,24,39,0.06)]">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e7ebf3] px-5 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#7c5cff]">Live signals</div>
                  <div className="text-[11px] uppercase tracking-[0.24em] text-[#7b84a1]">
                    Answers after hours · captures callback · routes urgent work
                  </div>
                </div>
                <div className="grid divide-y divide-[#e7ebf3] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                  {[
                    { label: 'Answers after hours', body: 'The call still gets handled.' },
                    { label: 'Captures issue + callback', body: 'The details stay attached.' },
                    { label: 'Routes urgent work', body: 'The right next step moves forward.' }
                  ].map((item) => (
                    <div key={item.label} className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-[#7c5cff]" />
                        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0f172a]">
                          {item.label}
                        </div>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[#5f6678]">{item.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <HeroScene />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10 md:px-10 lg:px-12">
        <div className="grid gap-6 lg:grid-cols-[0.94fr_1.06fr] lg:items-stretch">
          <div className="rounded-[2.25rem] border border-[#dfe4f0] bg-[linear-gradient(180deg,#0f172a,#111827_60%,#0c1325)] p-7 text-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
            <div className="text-xs uppercase tracking-[0.34em] text-[#a5b0ff]">Operational proof</div>
            <div className="mt-4 max-w-lg text-3xl font-semibold tracking-[-0.06em] text-white">
              What the team sees after the call.
            </div>
            <p className="mt-5 max-w-lg text-base leading-8 text-[#cbd2f0]">
              One surface for the details that matter most: what the caller needed, where they were, how urgent it
              is, and what should happen next.
            </p>

            <div className="mt-7 grid gap-3">
              {operationalProof.map((item, index) => (
                <div
                  key={item.title}
                  className="flex gap-4 rounded-2xl border border-white/10 bg-white/6 px-4 py-3 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm"
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-[11px] font-semibold text-white">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">{item.title}</div>
                    <div className="mt-1 text-sm leading-6 text-[#cbd2f0]">{item.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[2.25rem] border border-[#1f2741] bg-[linear-gradient(180deg,#0d1324,#121a31_48%,#0d1426)] p-6 text-white shadow-[0_24px_70px_rgba(15,23,42,0.22)]">
            <div className="absolute right-[-5rem] top-[-5rem] h-44 w-44 rounded-full bg-[#7c5cff]/12 blur-3xl animate-glow-pulse" />
            <div className="absolute left-[-2rem] bottom-[-5rem] h-36 w-36 rounded-full bg-[#8bcbff]/12 blur-3xl animate-drift-slow" />

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="text-xs uppercase tracking-[0.34em] text-[#a5b0ff]">Workflow snapshot</div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] uppercase tracking-[0.26em] text-[#eef1ff]">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Live
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-3 rounded-[1.75rem] border border-white/10 bg-white/6 p-4">
                <div className="text-[11px] uppercase tracking-[0.3em] text-[#a5b0ff]">Captured</div>
                <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-[#eef1ff]">
                  Caller issue captured
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-[#eef1ff]">
                  Callback and location attached
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-[#eef1ff]">
                  Urgency flagged
                </div>
              </div>

              <div className="space-y-4 rounded-[1.75rem] border border-white/10 bg-white/6 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-[11px] uppercase tracking-[0.3em] text-[#a5b0ff]">Handoff state</div>
                  <div className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-[#eef1ff]">
                    Waiting
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/7 px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.28em] text-[#a5b0ff]">Team ready</div>
                  <div className="mt-2 text-sm leading-7 text-[#dce0f5]">
                    The next action is clear. Nothing has to be reconstructed from voicemail or memory.
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.28em] text-[#a5b0ff]">Signal path</div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-[72%] rounded-full bg-[linear-gradient(90deg,#4674d8,#8bcbff)] animate-glow-pulse" />
                  </div>
                  <div className="mt-3 text-sm leading-7 text-[#dce0f5]">
                    Capture, route, and wait for the team review.
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-[1.6rem] border border-white/10 bg-white/6 px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="text-[11px] uppercase tracking-[0.28em] text-[#a5b0ff]">Review queue</div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-[#7b84a1]">Issue · location · urgency · callback</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="problem" className="mx-auto max-w-7xl scroll-mt-24 px-6 py-20 md:px-10 lg:px-12">
        <SectionHeading
          eyebrow="The problem"
          title="Every missed ring is a missed job."
          description="The expensive part is not the call itself. It is the callback that never happens, the urgent job that goes to voicemail, and the owner who keeps getting pulled back to the phone."
        />

        <div className="mt-10 overflow-hidden rounded-[2.25rem] border border-[#dfe4f0] bg-white shadow-[0_18px_50px_rgba(17,24,39,0.05)]">
          <div className="grid gap-0 lg:grid-cols-[1fr_auto_1fr]">
            <div className="bg-[linear-gradient(180deg,#fff7f7,#fff)] p-7">
              <div className="text-xs uppercase tracking-[0.34em] text-[#c45c5c]">Missed ring</div>
              <div className="mt-4 text-3xl font-semibold tracking-[-0.06em] text-[#0f172a]">
                The job starts slipping before anyone answers.
              </div>
              <ul className="mt-6 space-y-4">
                {problemBefore.map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-7 text-[#4b5563]">
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#ef4444]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-center border-y border-[#e7ebf3] bg-[#fafbff] px-6 py-6 lg:border-x lg:border-y-0">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#dbe3f6] bg-white text-[#7c5cff] shadow-[0_12px_24px_rgba(17,24,39,0.06)]">
                  →
                </div>
                <div className="space-y-2 text-[11px] uppercase tracking-[0.28em] text-[#7b84a1]">
                  <div>Voicemail delay</div>
                  <div>Callback gap</div>
                  <div>Owner interruption</div>
                </div>
              </div>
            </div>

            <div className="bg-[linear-gradient(180deg,#f7fbf8,#fff)] p-7">
              <div className="text-xs uppercase tracking-[0.34em] text-[#2e8a57]">Answered ring</div>
              <div className="mt-4 text-3xl font-semibold tracking-[-0.06em] text-[#0f172a]">
                The request stays visible and organized.
              </div>
              <ul className="mt-6 space-y-4">
                {problemAfter.map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-7 text-[#4b5563]">
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#22c55e]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl scroll-mt-24 px-6 py-20 md:px-10 lg:px-12">
        <SectionHeading
          eyebrow="How it works"
          title="Three steps. Clean handoff."
          description="The setup should be simple. The caller should get answered, the details should stay organized, and the business should see the next move clearly."
        />

        <div className="mt-10 grid gap-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-stretch">
          <div className="rounded-[2.25rem] border border-[#1f2741] bg-[linear-gradient(180deg,#0e1426,#111827_60%,#0c1325)] p-7 text-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
            <div className="text-xs uppercase tracking-[0.34em] text-[#a5b0ff]">Connected flow</div>
            <div className="mt-4 max-w-lg text-3xl font-semibold tracking-[-0.06em] text-white">
              One path from ring to handoff.
            </div>
            <p className="mt-5 max-w-lg text-base leading-8 text-[#cbd2f0]">
              The caller gets answered. The request is structured. The business gets a clean next step without
              stitching together notes or voicemails.
            </p>

            <div className="mt-7 space-y-4">
              {howItWorks.map((item) => (
                <div key={item.step} className="flex gap-4 rounded-2xl border border-white/10 bg-white/6 p-4">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-sm font-semibold text-white">
                    {item.step}
                  </div>
                  <div>
                    <div className="text-lg font-medium tracking-[-0.03em] text-white">{item.title}</div>
                    <p className="mt-1 text-sm leading-7 text-[#cbd2f0]">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[2.25rem] border border-[#e7e1d8] bg-[linear-gradient(180deg,#ffffff,#f7f3ff)] p-6 shadow-[0_24px_70px_rgba(111,63,245,0.10)]">
            <div className="absolute right-[-5rem] top-[-5rem] h-44 w-44 rounded-full bg-[#7c5cff]/10 blur-3xl animate-glow-pulse" />
            <div className="absolute left-[-2rem] bottom-[-5rem] h-36 w-36 rounded-full bg-[#8bcbff]/10 blur-3xl animate-drift-slow" />

            <div className="text-xs uppercase tracking-[0.34em] text-[#7a61e8]">System state</div>
            <div className="mt-5 grid gap-4">
              <div className="rounded-[1.6rem] border border-[#1f2741] bg-[linear-gradient(180deg,#0e1426,#141c31)] p-5 text-white shadow-[0_18px_40px_rgba(15,23,42,0.14)]">
                <div className="text-[11px] uppercase tracking-[0.3em] text-[#a5b0ff]">01 · Connect</div>
                <div className="mt-3 text-lg font-medium tracking-[-0.03em] text-white">
                  Bind the number and intake path already in use.
                </div>
              </div>
              <div className="rounded-[1.6rem] border border-[#e3ecff] bg-[linear-gradient(180deg,#f8fbff,#fff)] p-5 shadow-[0_18px_40px_rgba(59,130,246,0.08)]">
                <div className="text-[11px] uppercase tracking-[0.3em] text-[#4674d8]">02 · Answer</div>
                <div className="mt-3 text-lg font-medium tracking-[-0.03em] text-[#0f172a]">
                  SkybridgeCX qualifies and routes while the call is live.
                </div>
              </div>
              <div className="rounded-[1.6rem] border border-[#dbeee3] bg-[linear-gradient(180deg,#f6fbf8,#fff)] p-5 shadow-[0_18px_40px_rgba(34,197,94,0.08)]">
                <div className="text-[11px] uppercase tracking-[0.3em] text-[#2e8a57]">03 · Handoff</div>
                <div className="mt-3 text-lg font-medium tracking-[-0.03em] text-[#0f172a]">
                  The team receives a clear summary and a visible next move.
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-[1.6rem] border border-[#dfe6f6] bg-[#f8fbff] px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="text-[11px] uppercase tracking-[0.28em] text-[#4674d8]">Pipeline rail</div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-[#7b84a1]">Answer · qualify · route</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="sample-call" className="mx-auto max-w-7xl scroll-mt-24 px-6 py-20 md:px-10 lg:px-12">
        <InteractiveCallFlow />
      </section>

      <section id="industries" className="mx-auto max-w-7xl scroll-mt-24 px-6 py-16 md:px-10 lg:px-12">
        <SectionHeading
          eyebrow="Industries"
          title="Built for the businesses that live on the phone."
          description="The call patterns change by trade, but the need is the same."
        />

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {industries.map((item) => (
            <article
              key={item.title}
              className="overflow-hidden rounded-[1.7rem] border border-[#dfe4f0] bg-white shadow-[0_18px_50px_rgba(17,24,39,0.04)]"
            >
              <div className="bg-[linear-gradient(90deg,#0e1426,#151c33)] px-5 py-4 text-white">
                <div className="text-[11px] uppercase tracking-[0.3em] text-[#a5b0ff]">{item.title}</div>
                <div className="mt-2 text-sm font-medium text-white">{item.pattern}</div>
              </div>
              <div className="p-5">
                <p className="text-sm leading-7 text-[#5f6678]">{item.body}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-[#e7e1d8] bg-[#faf8f4] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-[#6b7280]">
                    Urgent
                  </span>
                  <span className="rounded-full border border-[#e7e1d8] bg-[#faf8f4] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-[#6b7280]">
                    After hours
                  </span>
                  <span className="rounded-full border border-[#e7e1d8] bg-[#faf8f4] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-[#6b7280]">
                    Clean handoff
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="outcome" className="mx-auto max-w-7xl scroll-mt-24 px-6 py-20 md:px-10 lg:px-12">
        <SectionHeading
          eyebrow="Outcome"
          title="Less interruption. More booked work."
          description="The owner gets fewer false alarms. The office gets fewer distractions. The business gets more of the demand already calling in."
          centered
        />

        <div className="mt-10 rounded-[2.25rem] border border-[#1f2741] bg-[linear-gradient(180deg,#0e1426,#111827_60%,#0c1325)] p-7 text-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
          <div className="grid gap-6 lg:grid-cols-[0.88fr_1.12fr] lg:items-start">
            <div>
              <div className="text-xs uppercase tracking-[0.34em] text-[#a5b0ff]">Why it matters</div>
              <div className="mt-4 text-3xl font-semibold tracking-[-0.06em] text-white">
                The revenue already calling in stays visible.
              </div>
              <p className="mt-5 max-w-xl text-base leading-8 text-[#cbd2f0]">
                SkybridgeCX cuts the friction between the first ring and the next step, so the business keeps more of the
                  calls that should have become booked work.
              </p>
            </div>

            <div className="grid gap-3">
              {outcomes.map((item, index) => (
                <div
                  key={item.title}
                  className="flex gap-4 rounded-2xl border border-white/10 bg-white/6 px-4 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm"
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-[11px] font-semibold text-white">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">{item.title}</div>
                    <p className="mt-1 text-sm leading-7 text-[#cbd2f0]">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="bg-[#0e1426] py-20 text-white">
        <div className="mx-auto max-w-7xl scroll-mt-24 px-6 md:px-10 lg:px-12">
        <SectionHeading
          eyebrow="FREQUENTLY ASKED QUESTIONS"
          title="Common questions, clear answers."
          centered
          tone="dark"
        />

        <div className="mt-10 grid gap-4">
          {faqs.map((item) => (
            <details
              key={item.question}
              className="group rounded-[1.5rem] border border-white/10 bg-white/5 px-6 py-5 shadow-[0_18px_50px_rgba(15,23,42,0.12)]"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-left text-lg font-semibold tracking-[-0.03em] text-white">
                <span>{item.question}</span>
                <span className="text-[#a5b0ff] transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-4 max-w-3xl text-base leading-8 text-[#cbd2f0]">{item.answer}</p>
            </details>
          ))}
        </div>
        </div>
      </section>

      <section id="book-demo" className="relative overflow-hidden bg-[#0e1426] py-20 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(124,92,255,0.24),transparent_28%),radial-gradient(circle_at_78%_18%,rgba(59,130,246,0.18),transparent_22%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-6 md:px-10 lg:grid-cols-[0.95fr_1.05fr] lg:px-12">
          <div className="max-w-xl">
            <div className="text-xs uppercase tracking-[0.34em] text-[#a5b0ff]">Book a demo</div>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.06em] text-white md:text-6xl">
              Capture more of the revenue already calling you.
            </h2>
            <p className="mt-6 text-base leading-8 text-[#cbd2f0]">
              We’ll walk through how routine, urgent, and after-hours calls would be handled for your business.
            </p>
          </div>

          {leadRequested ? (
            <div className="grid gap-4 rounded-[2rem] border border-emerald-200 bg-[linear-gradient(180deg,#ffffff,#f2fbf5)] p-7 shadow-[0_24px_70px_rgba(17,24,39,0.06)]">
              <div className="text-xs uppercase tracking-[0.34em] text-emerald-700">Demo request received</div>
              <div className="max-w-2xl text-3xl font-semibold tracking-[-0.05em] text-[#0f172a]">
                Thanks. We have your request.
              </div>
              {successWarning ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                  {successWarning}
                </div>
              ) : null}
              <p className="max-w-2xl text-base leading-8 text-[#5f6678]">
                We’ll review the call flow and follow up with the next step.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <a
                  href="/"
                  className="rounded-full bg-[#111827] px-6 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-[#0b1120]"
                >
                  Send another request
                </a>
                <a
                  href="#sample-call"
                  className="rounded-full border border-[#d9dbe6] bg-white px-6 py-3 text-sm font-medium text-[#111827] transition hover:-translate-y-0.5 hover:bg-[#fbfbfd]"
                >
                  Hear a sample call
                </a>
              </div>
            </div>
          ) : (
            <form
              action={requestConsultation}
              className="grid gap-4 rounded-[2rem] border border-white/10 bg-white p-6 text-[#111827] shadow-[0_24px_80px_rgba(17,24,39,0.16)]"
            >
              <div className="grid gap-2">
                <div className="text-xs uppercase tracking-[0.34em] text-[#7c5cff]">Request details</div>
                <p className="text-sm leading-6 text-[#5f6678]">
                  Tell us what calls you want handled. We’ll show how your calls would be answered, qualified, and routed.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-[#111827]">Company name</span>
                  <input
                    name="companyName"
                    placeholder="Sterling Plumbing"
                    required
                    className="w-full rounded-xl border border-[#d9dbe6] bg-[#fbfbfd] px-3 py-2.5 text-sm text-[#111827] placeholder:text-[#8b95a7]"
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-[#111827]">Contact name</span>
                  <input
                    name="contactName"
                    placeholder="Alicia Grant"
                    className="w-full rounded-xl border border-[#d9dbe6] bg-[#fbfbfd] px-3 py-2.5 text-sm text-[#111827] placeholder:text-[#8b95a7]"
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-[#111827]">Phone</span>
                  <input
                    name="contactPhone"
                    placeholder="703-555-0200"
                    className="w-full rounded-xl border border-[#d9dbe6] bg-[#fbfbfd] px-3 py-2.5 text-sm text-[#111827] placeholder:text-[#8b95a7]"
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-[#111827]">Email</span>
                  <input
                    name="contactEmail"
                    type="email"
                    placeholder="owner@example.com"
                    className="w-full rounded-xl border border-[#d9dbe6] bg-[#fbfbfd] px-3 py-2.5 text-sm text-[#111827] placeholder:text-[#8b95a7]"
                  />
                  <span className="block text-xs leading-6 text-[#6b7280]">
                    Add a phone number or email so we know where to follow up.
                  </span>
                </label>
              </div>

              <label className="space-y-2 text-sm">
                <span className="font-medium text-[#111827]">What calls do you want handled?</span>
                <textarea
                  name="serviceInterest"
                  rows={3}
                  placeholder="After-hours emergencies, new estimates, and routine scheduling calls"
                  className="w-full rounded-xl border border-[#d9dbe6] bg-[#fbfbfd] px-3 py-3 text-sm text-[#111827] placeholder:text-[#8b95a7]"
                />
              </label>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-md text-sm leading-6 text-[#5f6678]">
                  We’ll show how routine, urgent, and after-hours calls would be handled for your business.
                </p>
                <button className="rounded-full bg-[#111827] px-6 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-[#0b1120]">
                  Book a 15-minute demo
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      <footer className="border-t border-[#e8e3db] bg-white/80">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 md:px-10 lg:flex-row lg:items-center lg:justify-between lg:px-12">
          <div>
            <div className="text-sm font-semibold tracking-[-0.03em] text-[#111827]">SkybridgeCX</div>
            <p className="mt-1 text-sm text-[#6b7280]">AI front desk for service businesses.</p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-[#4b5563]">
            <a href="#product" className="transition hover:text-[#111827]">
              Product
            </a>
            <a href="#how-it-works" className="transition hover:text-[#111827]">
              How It Works
            </a>
            <a href="#industries" className="transition hover:text-[#111827]">
              Industries
            </a>
            <a href="#faq" className="transition hover:text-[#111827]">
              FAQs
            </a>
            <a href="#book-demo" className="transition hover:text-[#111827]">
              Book Demo
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
