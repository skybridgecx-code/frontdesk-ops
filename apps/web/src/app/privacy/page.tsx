import type { Metadata } from 'next';
import Link from 'next/link';
import { SkybridgePublicShell } from '../components/skybridge-public-shell';

export const metadata: Metadata = {
  title: 'Privacy Policy | SkyBridgeCX',
  description: 'Privacy policy for SkyBridgeCX.'
};

export default function PrivacyPage() {
  return (
    <SkybridgePublicShell
      eyebrow="Privacy"
      title="Your call data stays protected."
      description="We keep your data secure and never sell it. Here's exactly what we collect and how we use it."
    >
      <div className="space-y-8 text-sm leading-7 text-gray-600">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Effective date</p>
          <p className="mt-1 font-medium text-gray-900">April 13, 2026</p>
        </div>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Information we collect</h2>
          <p className="mt-2">
            We collect account, contact, call activity, and service configuration data needed to operate SkyBridgeCX.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">How we use information</h2>
          <p className="mt-2">
            We use collected data to provide the product, support users, secure the platform, and improve service quality.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Data sharing</h2>
          <p className="mt-2">
            We do not sell personal information. We may share data with vendors that help us deliver the service and with legal authorities when required by law.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Contact</h2>
          <p className="mt-2">
            For privacy questions, email{' '}
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
