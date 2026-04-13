import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service | SkybridgeCX',
  description: 'Terms of service for SkybridgeCX.'
};

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16 text-gray-900 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-gray-600">Effective date: April 13, 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-7 text-gray-700">
        <section>
          <h2 className="text-base font-semibold text-gray-900">Use of service</h2>
          <p className="mt-2">
            You agree to use SkybridgeCX lawfully and are responsible for account activity and compliance
            with telecommunications and privacy regulations.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900">Billing and subscriptions</h2>
          <p className="mt-2">
            Paid plans are billed on a recurring basis until canceled. Fees are non-refundable except where
            required by law.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900">Service availability</h2>
          <p className="mt-2">
            We work to keep the service reliable but do not guarantee uninterrupted availability. We may
            update features and infrastructure over time.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900">Contact</h2>
          <p className="mt-2">
            For legal questions, email{' '}
            <a className="font-medium text-indigo-700 underline underline-offset-4" href="mailto:hello@skybridgecx.com">
              hello@skybridgecx.com
            </a>
            .
          </p>
        </section>
      </div>

      <div className="mt-10">
        <Link href="/" className="text-sm font-medium text-indigo-700 underline underline-offset-4">
          Back to home
        </Link>
      </div>
    </main>
  );
}
