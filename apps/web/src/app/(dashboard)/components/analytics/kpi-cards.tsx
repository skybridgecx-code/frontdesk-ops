'use client';

import type { OverviewData } from './types';

type KpiCardsProps = {
  overview: OverviewData;
};

function formatTrend(value: number) {
  const rounded = Math.round(value * 100) / 100;
  const sign    = rounded > 0 ? '+' : '';
  return `${sign}${rounded}%`;
}

function TrendChip({ changePct }: { changePct: number }) {
  const isUp   = changePct > 0;
  const isDown = changePct < 0;
  const color  = isUp ? '#065F46' : isDown ? '#991B1B' : 'var(--text-tertiary)';
  const bg     = isUp ? '#D1FAE5' : isDown ? '#FEE2E2' : 'var(--surface-3)';

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ background: bg, color }}
    >
      <span aria-hidden="true">{isUp ? '↑' : isDown ? '↓' : '·'}</span>
      {formatTrend(changePct)}
    </span>
  );
}

function answerRateColor(rate: number) {
  if (rate >= 80) return '#065F46';
  if (rate >= 60) return '#92400E';
  return '#991B1B';
}

type KpiConfig = {
  label:     string;
  value:     React.ReactNode;
  trend:     number;
  sub:       string;
  iconBg:    string;
  iconColor: string;
  icon:      React.ReactNode;
};

export function KpiCards({ overview }: KpiCardsProps) {
  const cards: KpiConfig[] = [
    {
      label:      'Total Calls',
      value:      overview.totalCalls,
      trend:      overview.comparedToPrevious.totalCalls.changePct,
      sub:        'vs previous period',
      iconBg:     '#EFF6FF',
      iconColor:  '#2563EB',
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
          <path
            d="M6.5 4.5h2.8c.4 0 .8.3.9.7l.9 4.1c.1.4-.1.8-.4 1.1l-1.7 1.7a14.6 14.6 0 0 0 6 6l1.7-1.7c.3-.3.7-.5 1.1-.4l4.1.9c.4.1.7.5.7.9v2.8c0 .5-.4 1-1 1C11.2 22.5 1.5 12.8 1.5 5.5c0-.6.4-1 1-1Z"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      label:      'Answer Rate',
      value:      <span style={{ color: answerRateColor(overview.answerRate) }}>{overview.answerRate}%</span>,
      trend:      overview.comparedToPrevious.answerRate.changePct,
      sub:        `answered ${overview.answeredCalls}`,
      iconBg:     '#D1FAE5',
      iconColor:  '#065F46',
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
          <path d="m5 12 4 4 10-10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      label:      'Leads Captured',
      value:      overview.totalLeadsExtracted,
      trend:      overview.comparedToPrevious.totalLeadsExtracted.changePct,
      sub:        `${overview.leadConversionRate}% conversion`,
      iconBg:     '#EDE9FE',
      iconColor:  '#6D28D9',
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
          <path
            d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 20a6 6 0 0 1 12 0"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
          />
        </svg>
      ),
    },
    {
      label:      'Text-Backs Sent',
      value:      overview.textBacksSent,
      trend:      overview.comparedToPrevious.textBacksSent.changePct,
      sub:        `${overview.textBackRate}% missed recovery`,
      iconBg:     '#FEF3C7',
      iconColor:  '#D97706',
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
          <path d="M4 6h16v10H7l-3 3V6Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      ),
    },
  ];

  return (
    <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {cards.map((card, i) => (
        <article
          key={card.label}
          className="sb-card sb-card-lift rounded-xl p-4 sm:p-5"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                {card.label}
              </p>
              <p
                className="mt-2 text-3xl font-semibold tracking-tight"
                style={{ color: 'var(--text-primary)', letterSpacing: '-0.04em' }}
              >
                {card.value}
              </p>
            </div>
            <span
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: card.iconBg, color: card.iconColor }}
            >
              {card.icon}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <TrendChip changePct={card.trend} />
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {card.sub}
            </span>
          </div>
        </article>
      ))}
    </section>
  );
}
