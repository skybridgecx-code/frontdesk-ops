import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy | SkybridgeCX',
  description: 'Privacy policy for SkybridgeCX.'
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16 text-gray-900 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-gray-600">Effective date: April 13, 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-7 text-gray-700">
        <section>
          <h2 className="text-base font-semibold text-gray-900">Information we collect</h2>
          <p className="mt-2">
            We collect account, contact, call activity, and service configuration data needed to operate
            SkybridgeCX.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900">How we use information</h2>
          <p className="mt-2">
            We use collected data to provide the product, support users, secure the platform, and improve
            service quality.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900">Data sharing</h2>
          <p className="mt-2">
            We do not sell personal information. We may share data with vendors that help us deliver the
            service and with legal authorities when required by law.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900">Contact</h2>
          <p className="mt-2">
            For privacy questions, email{' '}
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
