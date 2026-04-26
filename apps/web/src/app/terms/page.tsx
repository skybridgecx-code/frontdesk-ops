import type { Metadata } from 'next';
import Link from 'next/link';
import { SkybridgePublicShell } from '../components/skybridge-public-shell';

export const metadata: Metadata = {
  title: 'Terms of Service | SkyBridgeCX',
  description: 'Terms of service for SkyBridgeCX.'
};

export default function TermsPage() {
  return (
    <SkybridgePublicShell
      eyebrow="Terms"
      title="Clear rules for using SkyBridgeCX."
      description="The service terms are intentionally concise. Operational contracts can be handled separately."
    >
      <div className="space-y-8 text-sm leading-7 text-gray-600">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Effective date</p>
          <p className="mt-1 font-medium text-gray-900">April 13, 2026</p>
        </div>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Use of service</h2>
          <p className="mt-2">
            You agree to use SkyBridgeCX lawfully and are responsible for account activity and compliance with telecommunications and privacy regulations.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Billing and subscriptions</h2>
          <p className="mt-2">
            Paid plans are billed on a recurring basis until canceled. Fees are non-refundable except where required by law.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Service availability</h2>
          <p className="mt-2">
            We work to keep the service reliable but do not guarantee uninterrupted availability. We may update features and infrastructure over time.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Contact</h2>
          <p className="mt-2">
            For legal questions, email{' '}
            <a className="font-semibold text-indigo-600 underline underline-offset-4 hover:text-indigo-500" href="mailto:hello@skybridgecx.com">
              hello@skybridgecx.com
            </a>
            .
          </p>
        </section>

        <Link href="/" className="inline-flex text-sm font-semibold text-indigo-600 transition hover:text-indigo-500">
          ← Back to home
        </Link>
      </div>
    </SkybridgePublicShell>
  );
}
