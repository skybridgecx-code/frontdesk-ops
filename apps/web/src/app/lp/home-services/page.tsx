import type { Metadata } from 'next';
import Link from 'next/link';

/**
 * Outreach landing page (/lp/home-services).
 *
 * This is the page Mo pastes in cold emails and SMS bumps. It's intentionally
 * narrower than /, with one above-the-fold CTA: call the demo line. Single
 * column, no nav, fast to read on mobile. Tracks which pitch landed via the
 * `?src=...` query param convention (echoed in the Calendly link).
 */

export const metadata: Metadata = {
  title: 'AI Front Desk for Home-Services Owners | SkyBridgeCX',
  description:
    'Stop losing $5k–$15k/month to missed calls. SkyBridgeCX answers every call 24/7, captures the lead, and texts you the details in 30 seconds. $299/mo, 14-day free trial.',
  robots: { index: true, follow: true }
};

const DEMO_PHONE = process.env.NEXT_PUBLIC_DEMO_PHONE_NUMBER ?? '+1 (888) 555-0124';
const DEMO_PHONE_TEL = DEMO_PHONE.replace(/[^\d+]/g, '');
const BOOKING_URL = process.env.NEXT_PUBLIC_BOOKING_URL ?? 'https://cal.com/skybridgecx/intro';

type FAQ = { q: string; a: string };

const FAQS: FAQ[] = [
  {
    q: 'Will it sound like a robot?',
    a: 'No. It speaks naturally, in English or Spanish, with a warm receptionist tone. The first thing it says is a recording disclosure ("quick heads up, this call is recorded so we can pass details to the team") so you stay clean under TCPA and two-party-consent state laws.'
  },
  {
    q: 'How does it handle emergencies?',
    a: 'It listens for emergency triggers — no heat, gas leak, active flooding, sewer backup, sparks, exposed wires — flags the call as Emergency, reassures the caller, and texts you the lead with "EMERGENCY" tagged inside 30 seconds.'
  },
  {
    q: 'What does it cost vs an answering service?',
    a: '$299/mo Starter (up to 500 calls), $499/mo Pro (unlimited). Compare to $400–$1,000/month for human answering services that still miss details and only work 9–5. There are no contracts and you can cancel anytime.'
  },
  {
    q: 'How fast can I be live?',
    a: 'Under 10 minutes. We provision a number (or port yours), you record a 10-second business intro, and we connect everything. You can run a side-by-side trial alongside your current setup.'
  },
  {
    q: 'Do you quote prices to my callers?',
    a: 'Never. The agent is hard-prompted to refuse: "A technician will give you an exact quote once they see the job." That stays under your control.'
  },
  {
    q: 'What about TCPA / recording laws?',
    a: 'Every AI-handled call opens with the recording disclosure built into the agent prompt. Our privacy policy lists every subprocessor (Twilio, OpenAI, Stripe, etc.) and we will sign a DPA on request. Most home-services SMBs we work with are not aware they were exposed before — fixing this is one of the cleanest reasons to switch.'
  }
];

export default function HomeServicesLandingPage() {
  return (
    <main className="min-h-screen bg-white text-gray-900 antialiased">
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-b from-indigo-50 via-white to-white px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full bg-indigo-600/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-700">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-600" />
            For HVAC, plumbing, electrical, roofing
          </p>
          <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl md:text-6xl">
            Every missed call is a job<br className="hidden sm:block" />{' '}
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              walking to your competitor.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600 sm:text-xl">
            SkyBridgeCX answers every inbound call 24/7 — captures the caller&apos;s name,
            address, problem, and urgency — and texts you the lead inside 30 seconds.
            $299/mo, no contracts, cancel anytime.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <a
              href={`tel:${DEMO_PHONE_TEL}`}
              className="group inline-flex items-center gap-3 rounded-xl bg-indigo-600 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-xl"
            >
              <span className="text-2xl">📞</span>
              <span>
                <span className="block text-xs font-medium uppercase tracking-widest text-indigo-200">
                  Hear it live, right now
                </span>
                <span className="block text-lg font-bold">{DEMO_PHONE}</span>
              </span>
            </a>
            <Link
              href={BOOKING_URL}
              className="inline-flex items-center gap-2 rounded-xl border-2 border-gray-300 px-6 py-4 text-base font-semibold text-gray-900 transition hover:border-gray-900 hover:bg-gray-900 hover:text-white"
            >
              Book a 10-minute demo →
            </Link>
          </div>

          <p className="mt-6 text-sm text-gray-500">
            Setup in under 10 minutes · 14-day free trial · TCPA-aware out of the box
          </p>
        </div>
      </section>

      {/* THE PROBLEM */}
      <section className="border-t border-gray-100 bg-white px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
            What we hear from owners
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            You&apos;re losing $5k–$15k a month and didn&apos;t realize it.
          </h2>
          <div className="mt-8 space-y-5 text-lg text-gray-700">
            <p>
              <span className="font-semibold text-gray-900">~40% of inbound</span> hits when
              you&apos;re on a job, after-hours, or on a weekend. Voicemail kills 70% of those.
              The caller is on Google before your generic vm even ends.
            </p>
            <p>
              Human answering services cost <span className="font-semibold text-gray-900">$400–$1,000/month</span>,
              miss the details a tech actually needs (address? urgency? what&apos;s broken?),
              and can&apos;t handle Spanish-speaking callers.
            </p>
            <p>
              <span className="font-semibold text-gray-900">Every spring/summer</span> the
              demand spikes and the missed-call problem doubles. You feel busier and somehow
              the revenue isn&apos;t.
            </p>
          </div>
        </div>
      </section>

      {/* WHAT YOU GET */}
      <section className="bg-gray-50 px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
            What you get
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            An AI receptionist that never sleeps and texts you the lead.
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {[
              {
                title: 'Answers every call, 24/7/365',
                body:
                  'No phone trees, no menus. Picks up on the second ring, in English or Spanish, in a warm receptionist voice (Sky).'
              },
              {
                title: 'Captures the full lead',
                body:
                  'Name, callback number, service address, problem, urgency, callback window. Read back to confirm. Tagged Emergency when it matters.'
              },
              {
                title: 'Texts you in <30 seconds',
                body:
                  'Lead lands in your inbox and your phone before the caller hangs up. CRM, dashboard, and webhook export included.'
              },
              {
                title: 'Compliance baked in',
                body:
                  'Recording disclosure on every call. CCPA/TCPA-aware privacy policy. DPA on request. Stripe-powered billing.'
              }
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-2 text-gray-600">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="bg-white px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
            Pricing
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            One flat number. Pays for itself the first week.
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-left shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
                Starter
              </p>
              <p className="mt-2 text-4xl font-bold">
                $299<span className="text-base font-medium text-gray-500">/mo</span>
              </p>
              <ul className="mt-6 space-y-2 text-gray-700">
                <li>· Up to 500 inbound calls/mo</li>
                <li>· One phone number (port or new)</li>
                <li>· Bilingual EN/ES</li>
                <li>· Emergency tagging + SMS alerts</li>
                <li>· Dashboard + call recordings</li>
                <li>· Email support</li>
              </ul>
            </div>
            <div className="rounded-2xl border-2 border-indigo-600 bg-indigo-50/40 p-8 text-left shadow-md">
              <p className="text-sm font-semibold uppercase tracking-widest text-indigo-700">
                Pro · most popular
              </p>
              <p className="mt-2 text-4xl font-bold">
                $499<span className="text-base font-medium text-gray-500">/mo</span>
              </p>
              <ul className="mt-6 space-y-2 text-gray-700">
                <li>· Unlimited calls</li>
                <li>· Up to 3 phone numbers</li>
                <li>· Outreach copilot AI drafts</li>
                <li>· Custom agent personality</li>
                <li>· Priority support</li>
                <li>· Webhook export to your CRM</li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/sign-up"
              className="rounded-xl bg-indigo-600 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:-translate-y-0.5 hover:bg-indigo-700"
            >
              Start 14-day free trial
            </Link>
            <Link
              href={BOOKING_URL}
              className="rounded-xl border-2 border-gray-300 px-6 py-4 text-base font-semibold text-gray-900 transition hover:border-gray-900"
            >
              Talk to Mo first
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-gray-100 bg-gray-50 px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
            FAQ
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            The questions every owner asks first.
          </h2>
          <dl className="mt-8 space-y-6">
            {FAQS.map((faq) => (
              <div key={faq.q} className="rounded-2xl border border-gray-200 bg-white p-6">
                <dt className="text-lg font-semibold text-gray-900">{faq.q}</dt>
                <dd className="mt-2 text-gray-700">{faq.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="bg-gradient-to-br from-indigo-600 to-violet-600 px-6 py-16 text-white">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Hear it answer your phone tonight.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-indigo-100">
            Call the demo line. Pretend to be your own customer. If it doesn&apos;t handle the
            call better than your current setup, walk away.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <a
              href={`tel:${DEMO_PHONE_TEL}`}
              className="rounded-xl bg-white px-6 py-4 text-base font-bold text-indigo-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-gray-100"
            >
              📞 Call {DEMO_PHONE}
            </a>
            <Link
              href={BOOKING_URL}
              className="rounded-xl border-2 border-white/60 px-6 py-4 text-base font-semibold text-white transition hover:border-white hover:bg-white/10"
            >
              Book a 10-minute demo
            </Link>
          </div>
        </div>
      </section>

      {/* MINI FOOTER */}
      <footer className="bg-white px-6 py-8 text-center text-sm text-gray-500">
        <p>
          SkyBridgeCX — AI front desk for home-services businesses ·{' '}
          <Link href="/privacy" className="underline underline-offset-4 hover:text-gray-900">
            Privacy
          </Link>{' '}
          ·{' '}
          <Link href="/terms" className="underline underline-offset-4 hover:text-gray-900">
            Terms
          </Link>
        </p>
      </footer>
    </main>
  );
}
