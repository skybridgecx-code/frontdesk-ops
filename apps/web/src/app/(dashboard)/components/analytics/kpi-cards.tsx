'use client';

import type { OverviewData } from './types';

type KpiCardsProps = {
  overview: OverviewData;
};

function formatTrend(value: number) {
  const rounded = Math.round(value * 100) / 100;
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded}%`;
}

function trendTone(changePct: number) {
  if (changePct > 0) {
    return 'text-emerald-600';
  }

  if (changePct < 0) {
    return 'text-rose-600';
  }

  return 'text-gray-500';
}

function answerRateTone(answerRate: number) {
  if (answerRate >= 80) {
    return 'text-emerald-700';
  }

  if (answerRate >= 60) {
    return 'text-amber-700';
  }

  return 'text-rose-700';
}

function TrendChip({ changePct }: { changePct: number }) {
  const isUp = changePct > 0;
  const isDown = changePct < 0;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${trendTone(changePct)}`}>
      <span aria-hidden="true">{isUp ? '▲' : isDown ? '▼' : '•'}</span>
      {formatTrend(changePct)}
    </span>
  );
}

export function KpiCards({ overview }: KpiCardsProps) {
  return (
    <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-600">Total Calls</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">{overview.totalCalls}</p>
          </div>
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
              <path
                d="M6.5 4.5h2.8c.4 0 .8.3.9.7l.9 4.1c.1.4-.1.8-.4 1.1l-1.7 1.7a14.6 14.6 0 0 0 6 6l1.7-1.7c.3-.3.7-.5 1.1-.4l4.1.9c.4.1.7.5.7.9v2.8c0 .5-.4 1-1 1C11.2 22.5 1.5 12.8 1.5 5.5c0-.6.4-1 1-1Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <TrendChip changePct={overview.comparedToPrevious.totalCalls.changePct} />
          <span className="text-xs text-gray-500">vs previous period</span>
        </div>
      </article>

      <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-600">Answer Rate</p>
            <p className={`mt-2 text-3xl font-semibold tracking-tight ${answerRateTone(overview.answerRate)}`}>
              {overview.answerRate}%
            </p>
          </div>
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
              <path d="m5 12 4 4 10-10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <TrendChip changePct={overview.comparedToPrevious.answerRate.changePct} />
          <span className="text-xs text-gray-500">answered {overview.answeredCalls}</span>
        </div>
      </article>

      <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-600">Leads Captured</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">{overview.totalLeadsExtracted}</p>
          </div>
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
              <path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <TrendChip changePct={overview.comparedToPrevious.totalLeadsExtracted.changePct} />
          <span className="text-xs text-gray-500">{overview.leadConversionRate}% conversion</span>
        </div>
      </article>

      <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-600">Text-Backs Sent</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">{overview.textBacksSent}</p>
          </div>
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-orange-700">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
              <path d="M4 6h16v10H7l-3 3V6Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <TrendChip changePct={overview.comparedToPrevious.textBacksSent.changePct} />
          <span className="text-xs text-gray-500">{overview.textBackRate}% missed recovery</span>
        </div>
      </article>
    </section>
  );
}
