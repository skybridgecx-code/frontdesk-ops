import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Frontdesk OS Demo | AI Front Desk for Home Services',
  description:
    'Buyer-facing Frontdesk OS demo for home services teams. See how AI call handling, lead capture, and follow-up workflows run in one dashboard.'
};

const proofItems = [
  'Voice routing reaches AI response.create.',
  'Demo-safe simulation mode is available while OpenAI credits are paused.',
  'Dashboard surfaces live-like call, prospect, and activity workflows for walkthroughs.'
];

const capabilities = [
  {
    title: 'Answers inbound calls',
    detail: 'Responds to callers quickly so your business does not miss urgent service opportunities.'
  },
  {
    title: 'Qualifies leads',
    detail: 'Captures intent, urgency, location context, and preferred follow-up timing.'
  },
  {
    title: 'Captures job details',
    detail: 'Records service needs and summary information so office teams can act immediately.'
  },
  {
    title: 'Logs every interaction',
    detail: 'Keeps a searchable call timeline for review, triage, and owner oversight.'
  },
  {
    title: 'Supports follow-up workflows',
    detail: 'Connects calls to pipeline and callback workflows so lead response stays on track.'
  }
];

const ctas = [
  { label: 'View dashboard', href: '/dashboard', tone: 'primary' as const },
  { label: 'View calls', href: '/calls', tone: 'secondary' as const },
  { label: 'View prospects', href: '/prospects', tone: 'secondary' as const }
];

export default function FrontdeskDemoLandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white">
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <section className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-500 p-7 shadow-lg sm:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_0%,rgba(255,255,255,0.14),transparent_58%)]" />
          <div className="relative">
            <div className="inline-flex items-center rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-indigo-100">
              Frontdesk OS Demo
            </div>
            <h1 className="mt-4 max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
              AI Front Desk for Missed Calls, Bookings, and Lead Follow-Up
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-indigo-100 sm:text-lg">
              Built for home services teams that need faster response times, cleaner job intake, and fewer lost opportunities.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {ctas.map((cta) => (
                <Link
                  key={cta.label}
                  href={cta.href}
                  className={
                    cta.tone === 'primary'
                      ? 'inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-indigo-700 shadow transition hover:bg-indigo-50'
                      : 'inline-flex min-h-11 items-center justify-center rounded-xl border border-white/30 bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20'
                  }
                >
                  {cta.label}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-500">The Problem</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">Missed calls and slow follow-up cost real jobs</h2>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-gray-600 sm:text-base">
            In home services, every missed call can mean lost revenue. Teams also lose deals when callback speed is inconsistent or caller details are incomplete.
            Frontdesk OS gives operators one clear system for intake, qualification, and follow-up continuity.
          </p>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">What It Does</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((item) => (
              <article key={item.title} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Demo Proof</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-emerald-900">Current readiness and demo safety</h2>
            </div>
            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
              OpenAI credits currently paused
            </span>
          </div>
          <ul className="mt-4 space-y-2">
            {proofItems.map((item) => (
              <li key={item} className="flex items-start gap-2 rounded-lg border border-emerald-100 bg-white px-3 py-2.5 text-sm text-gray-700">
                <span className="mt-0.5 text-emerald-600">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            The product should not be presented as currently producing audible AI responses to callers until OpenAI credits are restored.
          </p>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-7">
          <h2 className="text-xl font-semibold tracking-tight text-gray-900">Explore the demo experience</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-gray-600">
            Use the links below to walk buyers through the core operating surfaces: command center, call timeline, and prospect workflow.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Link
              href="/dashboard"
              className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
            >
              View dashboard
            </Link>
            <Link
              href="/calls"
              className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
            >
              View calls
            </Link>
            <Link
              href="/prospects"
              className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
            >
              View prospects
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
