import Link from 'next/link';
import type { ReactNode } from 'react';

export function SkybridgeBrandMark({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-3 text-gray-900 transition hover:text-indigo-600">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-xs font-extrabold tracking-wide text-white">
        SX
      </span>
      <span className="text-lg font-bold tracking-tight">SkyBridgeCX</span>
    </Link>
  );
}

export function SkybridgePublicShell({
  eyebrow,
  title,
  description,
  children
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <main className="skybridge-app min-h-screen bg-gray-50 px-6 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col">
        <header className="flex items-center justify-between border-b border-gray-200 pb-6">
          <SkybridgeBrandMark />
          <Link
            href="/sign-up"
            className="rounded-lg border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50"
          >
            Start free trial
          </Link>
        </header>

        <section className="grid flex-1 gap-12 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:py-24">
          <div className="lg:sticky lg:top-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">{eyebrow}</p>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-6xl">
              {title}
            </h1>
            {description ? <p className="mt-6 max-w-md text-base leading-7 text-gray-500">{description}</p> : null}
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-lg sm:p-8">
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
