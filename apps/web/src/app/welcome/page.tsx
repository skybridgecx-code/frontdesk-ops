'use client';

import Link from 'next/link';
import { useUser } from '@clerk/nextjs';

export default function WelcomePage() {
  const { user } = useUser();
  const firstName = user?.firstName ?? null;

  return (
    <main className="skybridge-app flex min-h-screen items-center justify-center bg-gray-50 px-6 py-10">
      <div className="w-full max-w-lg text-center">

        {/* Logo mark */}
        <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg">
          <span className="text-3xl">🌤️</span>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
          {firstName ? `You're in, ${firstName}! 🎉` : "You're in! 🎉"}
        </h1>

        <p className="mt-4 text-base leading-7 text-gray-500">
          Thanks for signing up for SkyBridgeCX. We review every new account personally
          and will send you a setup link within{' '}
          <strong className="text-gray-900">24 hours</strong> so we can get your
          AI front desk configured exactly right for your business.
        </p>

        <div className="mt-8 rounded-2xl border border-gray-200 bg-white px-6 py-6 shadow-sm">
          <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-indigo-600">
            What happens next
          </p>

          <div className="space-y-4 text-left">
            {([
              ['📧', 'Check your inbox', "We'll email you a personalized setup link"],
              ['⚡', 'Quick 2-min setup', 'Sky walks you through everything conversationally'],
              ['📞', 'Go live', 'Your AI front desk answers calls 24/7 from day one'],
            ] as [string, string, string][]).map(([emoji, title, desc]) => (
              <div key={title} className="flex items-start gap-3">
                <span className="mt-0.5 text-xl">{emoji}</span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{title}</p>
                  <p className="text-sm text-gray-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-6 text-sm text-gray-500">
          Questions?{' '}
          <a href="mailto:hello@skybridgecx.com" className="text-indigo-600 hover:text-indigo-500">
            hello@skybridgecx.com
          </a>
        </p>

        <div className="mt-6">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">
            ← Back to homepage
          </Link>
        </div>
      </div>
    </main>
  );
}
