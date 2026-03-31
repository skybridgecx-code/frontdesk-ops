import type { Metadata } from 'next';

const serviceLines = [
  {
    eyebrow: 'Inbound capture',
    title: 'Capture inbound interest without losing the thread',
    description:
      'MoLeads gives home-service teams a better front door for the moment demand first appears. Calls and public requests enter a path built to become real work instead of a disconnected message pile.',
    bullets: [
      'Inbound calls and public requests enter an inspectable workflow',
      'Request details start in a usable intake shape instead of loose notes',
      'The next step is visible as soon as the request arrives'
    ]
  },
  {
    eyebrow: 'First-pass intake',
    title: 'Organize the first pass before work starts drifting',
    description:
      'The product is built to make first-pass intake easier to trust. Routing context, captured details, and workflow state stay visible so the team can understand what happened before they act.',
    bullets: [
      'Visible intake and routing context instead of a black box',
      'Operator review surfaces that show what happened and what changed',
      'A clearer handoff from intake into follow-up work'
    ]
  },
  {
    eyebrow: 'Operator follow-up',
    title: 'Keep follow-up visible until the team actually handles it',
    description:
      'MoLeads is not just intake capture. It supports the operating work after first contact: review, outreach, archive decisions, and queue visibility so follow-up stays actionable instead of fading out.',
    bullets: [
      'Actionable operator queues for inbound and follow-up work',
      'Review and outreach workflows that stay tied to current state',
      'Visible next actions instead of ambiguous handoffs'
    ]
  }
];

const engagementPoints = [
  'HVAC, plumbing, and electrical teams with inbound demand they need to capture reliably',
  'Operators or founders who need tighter follow-up after first contact',
  'Teams replacing scattered notes, forms, and vague handoffs with a real workflow'
];

const outcomes = [
  'Fewer leads dropped between first contact and follow-up',
  'Clearer operator decisions around review, outreach, and archive',
  'A customer-facing front door tied to a real operating system'
];

const clientTypes = ['HVAC and plumbing teams', 'Home-service operators', 'Founder-led local businesses', 'Dispatch-first service orgs'];
const systemTruths = [
  'Inbound calls can be reviewed and worked from a live queue instead of disappearing after the ring stops.',
  'Routing and first-pass intake stay visible so operators can see how work entered the system.',
  'Public requests and follow-up work stay actionable instead of getting buried in disconnected inboxes.'
];

export const metadata: Metadata = {
  title: 'AI Frontdesk for Home-Service Teams | MoLeads',
  description:
    'See how MoLeads helps HVAC, plumbing, and electrical teams capture inbound requests, organize first-pass intake, and keep operator follow-up visible and actionable.'
};

export default function ServicesPage() {
  return (
    <main className="min-h-screen bg-[#f4ede4] text-[#15110e]">
      <section className="relative overflow-hidden bg-[#17120f] text-[#f8f1e7]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.22),_transparent_24%),radial-gradient(circle_at_85%_15%,_rgba(59,130,246,0.16),_transparent_22%),linear-gradient(145deg,_rgba(255,255,255,0.04),_transparent_35%)]" />
        <div className="relative mx-auto max-w-7xl px-6 py-8 md:px-10 lg:px-12">
          <header className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.34em] text-[#dcc8ac]">MoLeads</div>
              <div className="mt-2 text-sm text-[#c7b8a3]">Services</div>
            </div>
            <div className="flex gap-3">
              <a
                href="/"
                className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-[#f8f1e7] transition hover:border-white/40 hover:bg-white/6"
              >
                Home
              </a>
              <a
                href="/contact"
                className="rounded-full bg-[#f8f1e7] px-5 py-2.5 text-sm font-medium text-[#17120f] transition hover:-translate-y-0.5 hover:bg-white"
              >
                Request home-service intake review
              </a>
            </div>
          </header>

          <div className="max-w-4xl py-18 md:py-24">
            <div className="inline-flex rounded-full border border-white/12 bg-white/6 px-4 py-2 text-xs uppercase tracking-[0.28em] text-[#f0d7af]">
              AI frontdesk for intake and follow-up
            </div>
            <h1 className="mt-7 text-5xl leading-[0.92] font-semibold tracking-[-0.06em] md:text-7xl">
              Capture inbound calls or requests, keep intake visible, and give operators a clearer follow-up path.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-[#d8c9b5] md:text-xl">
              MoLeads is an AI frontdesk for HVAC, plumbing, and electrical teams. It captures inbound demand, keeps first-pass intake and routing visible, and helps operators review what happened and follow up with clear next actions.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20 md:px-10 lg:px-12">
        <div className="grid gap-6">
          {serviceLines.map((line) => (
            <article
              key={line.title}
              className="grid gap-8 rounded-[2rem] border border-[#d9cdc0] bg-[#fffaf3] p-7 shadow-[0_24px_80px_rgba(16,24,40,0.06)] lg:grid-cols-[0.7fr_1.3fr]"
            >
              <div>
                <div className="text-xs uppercase tracking-[0.28em] text-[#8e7054]">{line.eyebrow}</div>
                <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[#17120f] md:text-4xl">
                  {line.title}
                </h2>
              </div>
              <div>
                <p className="text-base leading-8 text-[#5d4b3d]">{line.description}</p>
                <div className="mt-6 grid gap-3 md:grid-cols-3">
                  {line.bullets.map((bullet) => (
                    <div key={bullet} className="rounded-2xl border border-[#e3d8cb] bg-[#fbf6ee] px-4 py-4 text-sm leading-7 text-[#3f3127]">
                      {bullet}
                    </div>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-[#d6c9ba] bg-[#f0e7dc]">
        <div className="mx-auto max-w-7xl px-6 py-8 md:px-10 lg:px-12">
          <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.28em] text-[#8a6a4d]">
            <span className="mr-2 text-[#5a4738]">Common fit</span>
            {clientTypes.map((type) => (
              <span key={type} className="rounded-full border border-[#d7c7b6] bg-[#f8f1e8] px-4 py-2">
                {type}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#ddd2c4]">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 md:px-10 lg:grid-cols-2 lg:px-12">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-[#866749]">Who this is for</div>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-[#17120f] md:text-5xl">
              HVAC, plumbing, and electrical teams that already have inbound demand, but do not trust how it gets captured and worked.
            </h2>
            <div className="mt-8 grid gap-3">
              {engagementPoints.map((point) => (
                <div key={point} className="rounded-2xl border border-[#cdbfac] bg-[#f4ece2] px-4 py-4 text-sm leading-7 text-[#3f3127]">
                  {point}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-[#866749]">What better looks like</div>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-[#17120f] md:text-5xl">
              Clearer intake, calmer follow-up, and less ambiguity about what happens next.
            </h2>
            <div className="mt-8 grid gap-3">
              {outcomes.map((outcome) => (
                <div key={outcome} className="rounded-2xl border border-[#cdbfac] bg-[#f4ece2] px-4 py-4 text-sm leading-7 text-[#3f3127]">
                  {outcome}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20 md:px-10 lg:px-12">
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-[#8e7054]">Inspectable workflow</div>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-[#17120f] md:text-5xl">
              The offer only works if capture, intake, and follow-up stay visible after the first message lands.
            </h2>
            <p className="mt-6 max-w-md text-base leading-8 text-[#5d4b3d]">
              This is the useful proof on the page: the workflow does not disappear behind a black box. The team can inspect how requests came in, how first-pass intake was organized, and what still needs action.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {systemTruths.map((item) => (
              <article
                key={item}
                className="rounded-[1.9rem] border border-[#d9cdc0] bg-[#fffaf3] p-6 shadow-[0_18px_60px_rgba(16,24,40,0.06)]"
              >
                <div className="text-lg font-semibold tracking-[-0.03em] text-[#17120f]">Workflow truth</div>
                <p className="mt-4 text-base leading-8 text-[#3f3127]">{item}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20 md:px-10 lg:px-12">
        <div className="rounded-[2.25rem] bg-[#17120f] px-8 py-12 text-[#f8f1e7] shadow-[0_32px_120px_rgba(0,0,0,0.24)] md:px-10">
          <div className="max-w-3xl">
            <div className="text-xs uppercase tracking-[0.28em] text-[#dcc8ac]">Next step</div>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] md:text-5xl">
              Request home-service intake review for the part of your business where inbound work needs a clearer follow-up path.
            </h2>
            <p className="mt-6 text-base leading-8 text-[#d8c9b5]">
              Start with the point where inbound calls or requests come in. The goal is to make first-pass intake visible, keep the details attached, and give operators a clearer path to review and follow up.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="/contact"
                className="rounded-full bg-[#f8f1e7] px-6 py-3 text-sm font-medium text-[#17120f] transition hover:-translate-y-0.5 hover:bg-white"
              >
                Request home-service intake review
              </a>
              <a
                href="/"
                className="rounded-full border border-white/18 px-6 py-3 text-sm font-medium text-[#f8f1e7] transition hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/6"
              >
                Back to home
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
