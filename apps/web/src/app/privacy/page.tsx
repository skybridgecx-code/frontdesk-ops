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
      description="The same dark, direct SkyBridgeCX experience now carries through the policy pages too."
    >
      <div className="space-y-8 text-sm leading-7 text-[#c8d8e8]">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#5a6a80]">Effective date</p>
          <p className="mt-1 text-[#f0f4f8]">April 13, 2026</p>
        </div>

        <section>
          <h2 className="text-lg font-semibold text-[#f0f4f8]">Information we collect</h2>
          <p className="mt-2 text-[#8aa0b8]">
            We collect account, contact, call activity, and service configuration data needed to operate
            SkyBridgeCX.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#f0f4f8]">How we use information</h2>
          <p className="mt-2 text-[#8aa0b8]">
            We use collected data to provide the product, support users, secure the platform, and improve
            service quality.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#f0f4f8]">Data sharing</h2>
          <p className="mt-2 text-[#8aa0b8]">
            We do not sell personal information. We may share data with vendors that help us deliver the
            service and with legal authorities when required by law.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#f0f4f8]">Contact</h2>
          <p className="mt-2 text-[#8aa0b8]">
            For privacy questions, email{' '}
            <a className="font-semibold text-[#00d4ff] underline underline-offset-4" href="mailto:hello@skybridgecx.com">
              hello@skybridgecx.com
            </a>
            .
          </p>
        </section>

        <Link href="/" className="inline-flex text-sm font-semibold text-[#00d4ff] transition hover:text-[#33ddff]">
          Back to home
        </Link>
      </div>
    </SkybridgePublicShell>
  );
}
