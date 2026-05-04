import type { Metadata } from 'next';
import Link from 'next/link';
import { SkybridgePublicShell } from '../components/skybridge-public-shell';

export const metadata: Metadata = {
  title: 'Privacy Policy | SkyBridgeCX',
  description:
    'How SkyBridgeCX collects, uses, secures, and shares your data — including call recordings, transcripts, and lead information.'
};

const SECTION_HEADING_CLASS = 'text-lg font-semibold text-gray-900';
const SECTION_BODY_CLASS = 'mt-2';

export default function PrivacyPage() {
  return (
    <SkybridgePublicShell
      eyebrow="Privacy"
      title="Your call data stays protected."
      description="We keep your data secure and never sell it. Below is exactly what we collect, how we use it, who we share it with, and how long we keep it."
    >
      <div className="space-y-8 text-sm leading-7 text-gray-600">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Effective date
          </p>
          <p className="mt-1 font-medium text-gray-900">April 27, 2026</p>
        </div>

        <section>
          <h2 className={SECTION_HEADING_CLASS}>1. Who this policy applies to</h2>
          <p className={SECTION_BODY_CLASS}>
            This policy describes how SkyBridgeCX, Inc. ("SkyBridgeCX", "we") handles
            information for two groups: <span className="font-medium text-gray-900">customers</span>{' '}
            (the home-services businesses who sign up for the platform) and{' '}
            <span className="font-medium text-gray-900">callers</span> (people who phone our
            customers' numbers and reach our AI front desk). Different rules apply to each.
          </p>
        </section>

        <section>
          <h2 className={SECTION_HEADING_CLASS}>2. Information we collect</h2>
          <p className={SECTION_BODY_CLASS}>
            <span className="font-medium text-gray-900">From customers:</span> name, business
            name and address, billing email, phone numbers provisioned to the AI front desk,
            payment method (handled by Stripe — we never store full card numbers), and
            authentication identifiers (handled by Clerk).
          </p>
          <p className="mt-3">
            <span className="font-medium text-gray-900">From callers:</span> the caller's phone
            number (as delivered by Twilio), the audio of the conversation, a written transcript
            generated from that audio, and any details the caller provides (name, address,
            problem description, callback preferences). We capture these to deliver the lead to
            the home-services business that owns the line.
          </p>
        </section>

        <section>
          <h2 className={SECTION_HEADING_CLASS}>3. Call recording disclosure</h2>
          <p className={SECTION_BODY_CLASS}>
            Calls answered by the SkyBridgeCX AI front desk are recorded and transcribed. The
            agent discloses the recording at the start of every call. Recordings are stored to
            help the customer service their lead, train and improve the model with the
            customer's permission, and resolve any disputes. If you are calling from a
            two-party-consent jurisdiction (CA, CT, FL, IL, MD, MA, MT, NV, NH, PA, WA and a
            few others) and prefer not to be recorded, please end the call after the disclosure
            and contact the business another way.
          </p>
        </section>

        <section>
          <h2 className={SECTION_HEADING_CLASS}>4. How we use information</h2>
          <p className={SECTION_BODY_CLASS}>
            We use collected data to (a) operate the AI front desk and deliver leads to the
            customer who owns the phone line, (b) provide product support to that customer,
            (c) secure the platform against abuse, fraud, and runaway costs, (d) improve the
            quality of the agent and the lead extraction with the customer's authorization,
            and (e) meet legal obligations.
          </p>
        </section>

        <section>
          <h2 className={SECTION_HEADING_CLASS}>5. Subprocessors</h2>
          <p className={SECTION_BODY_CLASS}>
            We rely on the following vendors to deliver the service. A current Data Processing
            Addendum (DPA) is available on request to{' '}
            <a
              className="font-semibold text-indigo-600 underline underline-offset-4 hover:text-indigo-500"
              href="mailto:privacy@skybridgecx.co"
            >
              privacy@skybridgecx.co
            </a>
            .
          </p>
          <ul className="mt-3 list-inside list-disc space-y-1">
            <li>Twilio — telephony, call recording, SMS</li>
            <li>Retell AI — voice agent runtime (when used)</li>
            <li>OpenAI — speech-to-text, language model, real-time voice</li>
            <li>Stripe — billing and payment processing</li>
            <li>Clerk — authentication</li>
            <li>Resend — transactional email</li>
            <li>AWS / Vercel / DigitalOcean — application hosting</li>
          </ul>
        </section>

        <section>
          <h2 className={SECTION_HEADING_CLASS}>6. Data sharing</h2>
          <p className={SECTION_BODY_CLASS}>
            We do not sell personal information. We share caller data with the home-services
            customer who owns the phone line that was dialed (this is the whole point of the
            service). We share data with the subprocessors listed above strictly to deliver
            the service. We share data with legal authorities when required by valid legal
            process and we will notify the affected customer where the law allows.
          </p>
        </section>

        <section>
          <h2 className={SECTION_HEADING_CLASS}>7. Retention</h2>
          <p className={SECTION_BODY_CLASS}>
            Default retention: call recordings and transcripts are kept for 365 days from the
            call date, then permanently deleted. Lead and customer-account records are kept
            for the duration of the business relationship plus 24 months for accounting and
            legal-defense purposes. Customers can request shorter retention or per-call
            deletion at any time.
          </p>
        </section>

        <section>
          <h2 className={SECTION_HEADING_CLASS}>8. Your rights</h2>
          <p className={SECTION_BODY_CLASS}>
            Depending on where you live, you may have the right to access, correct, port, or
            delete personal information we hold about you, and to object to or restrict
            certain processing. California residents have specific rights under the CCPA/CPRA;
            EU/UK residents under GDPR/UK-GDPR. To exercise any of these rights, email{' '}
            <a
              className="font-semibold text-indigo-600 underline underline-offset-4 hover:text-indigo-500"
              href="mailto:privacy@skybridgecx.co"
            >
              privacy@skybridgecx.co
            </a>
            . We will verify your request and respond within the legally required window
            (typically 30–45 days).
          </p>
        </section>

        <section>
          <h2 className={SECTION_HEADING_CLASS}>9. Security</h2>
          <p className={SECTION_BODY_CLASS}>
            Data is encrypted in transit (TLS 1.2+) and at rest. Access to production systems
            is gated by SSO and MFA. We log administrative actions and review them regularly.
            Customer billing data is handled by Stripe and never touches our servers in
            unencrypted form. Vulnerabilities can be reported to{' '}
            <a
              className="font-semibold text-indigo-600 underline underline-offset-4 hover:text-indigo-500"
              href="mailto:security@skybridgecx.co"
            >
              security@skybridgecx.co
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className={SECTION_HEADING_CLASS}>10. Compliance posture</h2>
          <p className={SECTION_BODY_CLASS}>
            SkyBridgeCX is designed to help home-services customers comply with the TCPA and
            state two-party-consent recording laws by disclosing recording at the start of
            every AI-handled call. The customer remains responsible for outbound contact
            consent and for SMS-related obligations (10DLC registration, opt-out handling) on
            the lines we manage.
          </p>
        </section>

        <section>
          <h2 className={SECTION_HEADING_CLASS}>11. Changes</h2>
          <p className={SECTION_BODY_CLASS}>
            We will post material changes here and update the effective date above. For
            significant changes that affect existing customers we will also notify the
            account email on file at least 14 days before the change takes effect.
          </p>
        </section>

        <section>
          <h2 className={SECTION_HEADING_CLASS}>12. Contact</h2>
          <p className={SECTION_BODY_CLASS}>
            Privacy questions:{' '}
            <a
              className="font-semibold text-indigo-600 underline underline-offset-4 hover:text-indigo-500"
              href="mailto:privacy@skybridgecx.co"
            >
              privacy@skybridgecx.co
            </a>
            . Security:{' '}
            <a
              className="font-semibold text-indigo-600 underline underline-offset-4 hover:text-indigo-500"
              href="mailto:security@skybridgecx.co"
            >
              security@skybridgecx.co
            </a>
            . General:{' '}
            <a
              className="font-semibold text-indigo-600 underline underline-offset-4 hover:text-indigo-500"
              href="mailto:hello@skybridgecx.co"
            >
              hello@skybridgecx.co
            </a>
            .
          </p>
        </section>

        <Link
          href="/"
          className="inline-flex text-sm font-semibold text-indigo-600 transition hover:text-indigo-500"
        >
          ← Back to home
        </Link>
      </div>
    </SkybridgePublicShell>
  );
}
