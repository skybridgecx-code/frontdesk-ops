import type { Metadata } from 'next';

const serviceLines = [
  {
    eyebrow: 'Lead intake design',
    title: 'Turn first contact into a dependable operating flow',
    description:
      'We help service businesses tighten the moment demand first appears, whether it comes through calls, website requests, imports, or manual outreach. The goal is simple: fewer lost opportunities and less ambiguity about what happens next.',
    bullets: [
      'Public lead capture that routes into a real working queue',
      'Cleaner inbound intake structure for operators and dispatch teams',
      'Clear handoff from new lead to next action'
    ]
  },
  {
    eyebrow: 'Outbound follow-up',
    title: 'Work prospects with more consistency and less drift',
    description:
      'MoLeads supports the actual work of follow-up: reviewing a prospect, logging attempts, archiving dead ends, and keeping the queue aligned with what teams are really doing day to day.',
    bullets: [
      'Prospect queue and detail workflow',
      'Attempt logging and next-step visibility',
      'Review-next style routing for faster operator throughput'
    ]
  },
  {
    eyebrow: 'Workflow architecture',
    title: 'Build the system behind the team, not just the front-end',
    description:
      'Good-looking pages are not enough if the data model, transitions, and queue logic are weak. We focus on the underlying operating model so the surface stays trustworthy when real work hits it.',
    bullets: [
      'State-transition design for lead handling',
      'Queue ordering and review logic that stay coherent',
      'Validation and demo baselines for safe iteration'
    ]
  }
];

const engagementPoints = [
  'Service businesses with inbound demand they need to capture reliably',
  'Operators or founders who need tighter follow-up after first contact',
  'Teams replacing scattered notes, forms, and vague handoffs with a real workflow'
];

const outcomes = [
  'Fewer leads dropped between first contact and follow-up',
  'Clearer operator decisions around review, outreach, and archive',
  'A more premium customer-facing front door backed by a real operating system'
];

const clientTypes = ['HVAC and plumbing teams', 'Home-service operators', 'Founder-led local businesses', 'Dispatch-first service orgs'];

const testimonials = [
  {
    quote:
      'Before MoLeads, the problem was not effort. It was that nobody could see the same lead in the same state at the same time.',
    name: 'Patricia Shah',
    role: 'Operations director',
    company: 'Nova Pediatrics'
  },
  {
    quote:
      'The system made our front door feel more premium, but the bigger win was how much calmer the team felt behind the scenes.',
    name: 'Evan Brooks',
    role: 'Founder',
    company: 'Old Town Roofing'
  }
];

export const metadata: Metadata = {
  title: 'Services | MoLeads',
  description: 'Lead intake, follow-up workflow, and operator-system services for service businesses.'
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
                Request consultation
              </a>
            </div>
          </header>

          <div className="max-w-4xl py-18 md:py-24">
            <div className="inline-flex rounded-full border border-white/12 bg-white/6 px-4 py-2 text-xs uppercase tracking-[0.28em] text-[#f0d7af]">
              Premium workflow services
            </div>
            <h1 className="mt-7 text-5xl leading-[0.92] font-semibold tracking-[-0.06em] md:text-7xl">
              We help service businesses build a cleaner lead engine from first contact to follow-up.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-[#d8c9b5] md:text-xl">
              MoLeads is not just a homepage or a form. It is the service layer behind better lead handling: intake,
              queueing, review, outreach, and operator clarity.
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
              Teams that already have demand, but do not trust how it is being worked.
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
              Better follow-up, calmer operations, and a front door that feels premium.
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
            <div className="text-xs uppercase tracking-[0.28em] text-[#8e7054]">What clients notice</div>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-[#17120f] md:text-5xl">
              Better structure changes the feel of the business.
            </h2>
            <p className="mt-6 max-w-md text-base leading-8 text-[#5d4b3d]">
              The company sounds clearer. The team feels less reactive. And new opportunities are easier to work without
              improvising every step.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {testimonials.map((item) => (
              <article
                key={`${item.name}-${item.company}`}
                className="rounded-[1.9rem] border border-[#d9cdc0] bg-[#fffaf3] p-6 shadow-[0_18px_60px_rgba(16,24,40,0.06)]"
              >
                <div className="text-4xl leading-none text-[#c89c54]">“</div>
                <p className="mt-4 text-base leading-8 text-[#3f3127]">{item.quote}</p>
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

      <section className="mx-auto max-w-7xl px-6 py-20 md:px-10 lg:px-12">
        <div className="rounded-[2.25rem] bg-[#17120f] px-8 py-12 text-[#f8f1e7] shadow-[0_32px_120px_rgba(0,0,0,0.24)] md:px-10">
          <div className="max-w-3xl">
            <div className="text-xs uppercase tracking-[0.28em] text-[#dcc8ac]">Next step</div>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] md:text-5xl">
              If the lead path feels messy, that is the place to start.
            </h2>
            <p className="mt-6 text-base leading-8 text-[#d8c9b5]">
              The fastest way to see whether MoLeads fits is to walk through your current intake and follow-up flow,
              then map where leads are getting delayed, lost, or worked inconsistently.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="/contact"
                className="rounded-full bg-[#f8f1e7] px-6 py-3 text-sm font-medium text-[#17120f] transition hover:-translate-y-0.5 hover:bg-white"
              >
                Request consultation
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
