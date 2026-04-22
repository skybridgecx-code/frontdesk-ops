import Link from 'next/link';
import type { ReactNode } from 'react';

export function SkybridgeBrandMark({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-3 text-[#f0f4f8] transition hover:text-[#00d4ff]">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#00d4ff] text-xs font-extrabold tracking-wide text-[#020305]">
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
    <main className="skybridge-app min-h-screen px-6 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col">
        <header className="flex items-center justify-between border-b border-white/10 pb-6">
          <SkybridgeBrandMark />
          <Link
            href="/sign-up"
            className="rounded-lg border border-[#00d4ff]/30 px-4 py-2 text-sm font-semibold text-[#00d4ff] transition hover:bg-[#00d4ff]/10"
          >
            Start free trial
          </Link>
        </header>

        <section className="grid flex-1 gap-12 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:py-24">
          <div className="lg:sticky lg:top-10">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.28em] text-[#00d4ff]">{eyebrow}</p>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-[-0.06em] text-[#f0f4f8] sm:text-6xl">
              {title}
            </h1>
            {description ? <p className="mt-6 max-w-md text-base leading-7 text-[#5a6a80]">{description}</p> : null}
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0d1320]/80 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.42)] backdrop-blur sm:p-8">
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
