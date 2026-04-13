import type { Metadata } from 'next';
import Link from 'next/link';
import { LandingFooter } from './components/landing/footer';
import { FaqAccordion } from './components/landing/faq-accordion';
import { FeatureCard } from './components/landing/feature-card';
import { HeroMockup } from './components/landing/hero-mockup';
import { LandingNav } from './components/landing/landing-nav';
import { PainPointCard } from './components/landing/pain-point-card';
import { PricingCard } from './components/landing/pricing-card';
import { StepCard } from './components/landing/step-card';
import { TestimonialCard } from './components/landing/testimonial-card';

export const metadata: Metadata = {
  title: 'SkybridgeCX — AI Front Desk for Home Service Businesses',
  description:
    'Never miss another call. SkybridgeCX answers every call 24/7, captures lead details, and sends them to you instantly. Built for HVAC, plumbing, and electrical businesses.',
  openGraph: {
    title: 'SkybridgeCX — AI Front Desk for Home Service Businesses',
    description:
      'Never miss another call. SkybridgeCX answers every call 24/7, captures lead details, and sends them to you instantly. Built for HVAC, plumbing, and electrical businesses.',
    type: 'website'
  }
};

const painPoints = [
  {
    title: 'Missed calls after hours',
    description: '40% of service calls come outside business hours. Voicemail means lost revenue.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" />
        <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    )
  },
  {
    title: 'Expensive answering services',
    description: 'Human answering services cost $400-1,000/mo and still miss details.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <path d="M4 8h16M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.7" />
        <path d="M8 14h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    )
  },
  {
    title: 'No lead tracking',
    description: "Sticky notes and voicemails don't track who called, what they need, or how urgent it is.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <path d="M7 5h10M7 10h10M7 15h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    )
  }
] as const;

const steps = [
  {
    step: '1',
    title: 'Connect Your Number',
    description: 'Pick a local number or port your existing one. Takes 5 minutes.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <path d="M6 4h12v16H6z" stroke="currentColor" strokeWidth="1.7" />
        <path d="M9 7h6M9 17h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    )
  },
  {
    step: '2',
    title: 'AI Answers Every Call',
    description: 'Our AI greets callers naturally, understands their needs, and captures every detail.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <path d="M4 12a8 8 0 1 1 16 0c0 4.4-3.6 8-8 8H7l-3 2v-10Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </svg>
    )
  },
  {
    step: '3',
    title: 'Get Instant Lead Alerts',
    description: 'Name, phone, address, urgency, and job summary delivered to your inbox in 30 seconds.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </svg>
    )
  }
] as const;

const features = [
  {
    title: '24/7 AI Call Answering',
    description: 'Never miss a call, even at 2am',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <path d="M6.5 4.5h2.8c.4 0 .8.3.9.7l.9 4.1c.1.4-.1.8-.4 1.1l-1.7 1.7a14.6 14.6 0 0 0 6 6l1.7-1.7c.3-.3.7-.5 1.1-.4l4.1.9c.4.1.7.5.7.9v2.8c0 .5-.4 1-1 1C11.2 22.5 1.5 12.8 1.5 5.5c0-.6.4-1 1-1Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  },
  {
    title: 'Instant Lead Extraction',
    description: 'Name, phone, address, intent, urgency captured automatically',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <path d="M6 6h12M6 11h12M6 16h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    )
  },
  {
    title: 'Email Alerts in 30 Seconds',
    description: 'Get lead details before the caller hangs up',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </svg>
    )
  },
  {
    title: 'Call Recording & Playback',
    description: 'Listen back to every call from your dashboard',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <path d="M12 4a3 3 0 0 1 3 3v4a3 3 0 1 1-6 0V7a3 3 0 0 1 3-3Z" stroke="currentColor" strokeWidth="1.7" />
        <path d="M6 10a6 6 0 1 0 12 0M12 16v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    )
  },
  {
    title: 'Prospect CRM',
    description: 'Track leads from first call to closed job',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    )
  },
  {
    title: 'Outreach Copilot',
    description: 'AI-drafted follow-up emails and scripts',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <path d="M4 19h4l10-10a2.1 2.1 0 0 0-3-3L5 16v3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </svg>
    )
  }
] as const;

const testimonials = [
  {
    quote: 'We were missing 30% of our after-hours calls. SkybridgeCX catches every one.',
    author: 'Mike R.',
    role: 'HVAC Owner'
  },
  {
    quote: 'Replaced our $800/mo answering service. Better accuracy, fraction of the cost.',
    author: 'Sarah T.',
    role: 'Plumbing Company'
  },
  {
    quote: 'I get a text with the lead details before I even put my tools down.',
    author: 'James K.',
    role: 'Electrical Contractor'
  }
] as const;

type PricingPlan = {
  name: string;
  price: number;
  callsLabel: string;
  phoneNumbersLabel: string;
  businessesLabel: string;
  features: string[];
  popular?: boolean;
};

const pricingPlans: PricingPlan[] = [
  {
    name: 'Starter',
    price: 299,
    callsLabel: '500 calls/month',
    phoneNumbersLabel: '1 phone number',
    businessesLabel: '1 business',
    features: [
      'AI call answering 24/7',
      'Lead extraction & email alerts',
      'Call recording & playback',
      'Basic dashboard & CRM',
      'Email support'
    ]
  },
  {
    name: 'Pro',
    price: 499,
    callsLabel: 'Unlimited calls',
    phoneNumbersLabel: 'Up to 3 phone numbers',
    businessesLabel: '1 business',
    popular: true,
    features: [
      'Everything in Starter',
      'Outreach copilot AI drafts',
      'Priority support',
      'Custom agent personality'
    ]
  },
  {
    name: 'Enterprise',
    price: 999,
    callsLabel: 'Unlimited calls',
    phoneNumbersLabel: 'Up to 10 phone numbers',
    businessesLabel: 'Up to 5 businesses',
    features: [
      'Everything in Pro',
      'Multi-location support',
      'API access & webhooks',
      'Dedicated onboarding',
      'Custom integrations'
    ]
  }
];

const faqItems = [
  {
    question: 'How does the AI answer calls?',
    answer:
      'SkybridgeCX answers with a natural conversation flow tuned for home service calls, not a robotic IVR menu.'
  },
  {
    question: 'Can I keep my existing phone number?',
    answer:
      'Yes. You can port your existing number, or start with a new local number and switch when ready.'
  },
  {
    question: "What if the AI can't handle a call?",
    answer:
      'It can transfer to your team when needed or capture a detailed message with urgency and callback info.'
  },
  {
    question: 'How fast do I get lead notifications?',
    answer: 'Lead notifications are delivered within 30 seconds of the call.'
  },
  {
    question: 'Can I customize what the AI says?',
    answer: 'Yes. You can customize business details, responses, and agent personality by plan.'
  },
  {
    question: 'Is there a contract?',
    answer: 'No. SkybridgeCX is month-to-month and you can cancel anytime.'
  },
  {
    question: 'What types of businesses is this for?',
    answer:
      'HVAC, plumbing, electrical, general contractors, and most other home service businesses.'
  }
] as const;

function SectionHeader({
  title,
  description,
  centered = true
}: {
  title: string;
  description?: string;
  centered?: boolean;
}) {
  return (
    <div className={centered ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}>
      <h2 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">{title}</h2>
      {description ? <p className="mt-3 text-base text-gray-600 sm:text-lg">{description}</p> : null}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <LandingNav />

      <main>
        <section className="relative overflow-hidden bg-gradient-to-b from-indigo-50 via-white to-white pb-20 pt-28 sm:pt-32">
          <div className="absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top,rgba(79,70,229,0.16),transparent_64%)]" />
          <div className="relative mx-auto grid w-full max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl">
                Never Miss Another Call. Your AI Front Desk Works 24/7.
              </h1>
              <p className="mt-6 text-base leading-7 text-gray-600 sm:text-lg">
                SkybridgeCX answers every call, captures every lead, and sends you the details instantly. Built for HVAC,
                plumbing, and electrical businesses.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/sign-up"
                  className="inline-flex min-h-11 items-center justify-center rounded-md bg-indigo-600 px-5 text-sm font-semibold text-white transition hover:bg-indigo-500"
                >
                  Start Free Trial
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex min-h-11 items-center justify-center rounded-md border border-gray-300 bg-white px-5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  See How It Works
                </a>
              </div>

              <div className="mt-8 grid grid-cols-1 gap-2 text-sm text-gray-600 sm:grid-cols-3 sm:gap-3">
                <div className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Card required to start free trial
                </div>
                <div className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Setup in 5 minutes
                </div>
                <div className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Cancel anytime
                </div>
              </div>
            </div>

            <HeroMockup />
          </div>
        </section>

        <section className="bg-white py-16 sm:py-20">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeader
              title="Every Missed Call Is a Lost Job"
              description="Home service demand is high, but missed calls and messy intake quietly kill revenue."
            />

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {painPoints.map((point) => (
                <PainPointCard
                  key={point.title}
                  title={point.title}
                  description={point.description}
                  icon={point.icon}
                />
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="bg-gray-50 py-16 sm:py-20">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeader title="3 Steps to Never Miss a Lead Again" />

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {steps.map((step) => (
                <StepCard
                  key={step.title}
                  step={step.step}
                  title={step.title}
                  description={step.description}
                  icon={step.icon}
                />
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="bg-white py-16 sm:py-20">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeader title="Everything You Need to Capture Every Lead" />

            <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-3">
              {features.map((feature) => (
                <FeatureCard
                  key={feature.title}
                  title={feature.title}
                  description={feature.description}
                  icon={feature.icon}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="bg-gray-50 py-16 sm:py-20">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeader title="Trusted by Home Service Businesses" />

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {testimonials.map((testimonial) => (
                <TestimonialCard
                  key={testimonial.quote}
                  quote={testimonial.quote}
                  author={testimonial.author}
                  role={testimonial.role}
                />
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="bg-white py-16 sm:py-20">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeader title="Simple Pricing. No Hidden Fees." />

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {pricingPlans.map((plan) => (
                <PricingCard
                  key={plan.name}
                  name={plan.name}
                  price={plan.price}
                  callsLabel={plan.callsLabel}
                  phoneNumbersLabel={plan.phoneNumbersLabel}
                  businessesLabel={plan.businessesLabel}
                  popular={plan.popular}
                  features={[...plan.features]}
                />
              ))}
            </div>

            <p className="mt-6 text-center text-sm text-gray-600">
              All plans include a 14-day free trial. Card required to start free trial.
            </p>
          </div>
        </section>

        <section id="faq" className="bg-gray-50 py-16 sm:py-20">
          <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
            <SectionHeader title="Frequently Asked Questions" />
            <div className="mt-10">
              <FaqAccordion items={[...faqItems]} />
            </div>
          </div>
        </section>

        <section className="bg-indigo-900 py-16 sm:py-20">
          <div className="mx-auto w-full max-w-4xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Stop Losing Leads. Start Closing More Jobs.
            </h2>
            <p className="mt-4 text-base text-indigo-100 sm:text-lg">
              Join hundreds of home service businesses using SkybridgeCX to capture every call.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/sign-up"
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-white px-6 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
              >
                Get Started Free
              </Link>
              <a href="mailto:hello@skybridgecx.com" className="text-sm font-medium text-indigo-100 underline underline-offset-4">
                Questions? Email us at hello@skybridgecx.com
              </a>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
