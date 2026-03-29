import type { ReactNode } from 'react';

export function OperatorDetailPageShell({
  notice,
  children
}: {
  notice?: string | null;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-white p-6 text-black">
      <div className="mx-auto max-w-5xl space-y-6">
        {notice ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
            {notice}
          </div>
        ) : null}
        {children}
      </div>
    </main>
  );
}

export function OperatorDetailHeader({
  returnTo,
  returnContextSummary,
  title,
  badges,
  metadata,
  actions
}: {
  returnTo: string;
  returnContextSummary: string;
  title: ReactNode;
  badges?: ReactNode;
  metadata?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <a href={returnTo} className="text-sm text-neutral-600 underline underline-offset-2">
          ← Back to work queue
        </a>
        <div className="mt-2 text-sm text-neutral-600">Return to: {returnContextSummary}</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
        {badges ? <div className="mt-2 flex flex-wrap gap-2">{badges}</div> : null}
        {metadata ? (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-600">{metadata}</div>
        ) : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </div>
  );
}

export function OperatorActionGuideCard({
  toneClassName,
  emphasis,
  chips,
  primaryAction,
  reason,
  missingInfo
}: {
  toneClassName: string;
  emphasis: string;
  chips?: ReactNode;
  primaryAction: string;
  reason: string;
  missingInfo: string[];
}) {
  return (
    <section className={`rounded-2xl border p-4 ${toneClassName}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-medium">Operator next action</h2>
        <span className="rounded-full border border-current/20 px-2.5 py-1 text-xs font-medium uppercase tracking-wide">
          {emphasis}
        </span>
        {chips}
      </div>
      <div className="mt-3 text-base font-medium">{primaryAction}</div>
      <p className="mt-2 text-sm">{reason}</p>
      <div className="mt-3 text-sm">
        <span className="font-medium">Missing info:</span>{' '}
        {missingInfo.length > 0 ? missingInfo.join(', ') : 'None blocking.'}
      </div>
    </section>
  );
}
