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
      description="The service terms are intentionally short here; operational contracts can still be handled separately."
    >
      <div className="space-y-8 text-sm leading-7 text-[#c8d8e8]">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#5a6a80]">Effective date</p>
          <p className="mt-1 text-[#f0f4f8]">April 13, 2026</p>
        </div>

        <section>
          <h2 className="text-lg font-semibold text-[#f0f4f8]">Use of service</h2>
          <p className="mt-2 text-[#8aa0b8]">
            You agree to use SkyBridgeCX lawfully and are responsible for account activity and compliance
            with telecommunications and privacy regulations.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#f0f4f8]">Billing and subscriptions</h2>
          <p className="mt-2 text-[#8aa0b8]">
            Paid plans are billed on a recurring basis until canceled. Fees are non-refundable except where
            required by law.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#f0f4f8]">Service availability</h2>
          <p className="mt-2 text-[#8aa0b8]">
            We work to keep the service reliable but do not guarantee uninterrupted availability. We may
            update features and infrastructure over time.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#f0f4f8]">Contact</h2>
          <p className="mt-2 text-[#8aa0b8]">
            For legal questions, email{' '}
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
