'use client';

import Link from 'next/link';
import type { WebhookHealthData } from './types';

type WebhookHealthProps = {
  health: WebhookHealthData;
};

export function WebhookHealth({ health }: WebhookHealthProps) {
  if (!health.available) return null;

  const rate = health.successRate;
  const rateColor = rate >= 95 ? '#065F46' : rate >= 80 ? '#92400E' : '#991B1B';
  const rateBg    = rate >= 95 ? '#D1FAE5' : rate >= 80 ? '#FEF3C7' : '#FEE2E2';

  return (
    <div
      className="rounded-xl p-5"
      style={{
        background:   'var(--surface)',
        border:       '1px solid var(--border)',
        boxShadow:    'var(--shadow-sm)',
      }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2
            className="text-base font-semibold"
            style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
          >
            Webhook Deliveries
          </h2>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Integration reliability for this period
          </p>
        </div>
        <span
          className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{ background: rateBg, color: rateColor }}
        >
          {rate}% success
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total',   value: health.totalDeliveries,       color: 'var(--text-primary)' },
          { label: 'Success', value: health.successfulDeliveries,  color: '#065F46' },
          { label: 'Failed',  value: health.failedDeliveries,      color: '#991B1B' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-lg px-3 py-2.5"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
          >
            <p
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}
            >
              {label}
            </p>
            <p
              className="mt-1 text-xl font-semibold"
              style={{ color, letterSpacing: '-0.03em' }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <Link
          href="/settings/webhooks"
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          style={{
            background:  'var(--surface-2)',
            border:      '1px solid var(--border-mid)',
            color:       'var(--text-primary)',
            textDecoration: 'none',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-3)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
        >
          Webhook settings
          <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
            <path d="m6 3 5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
