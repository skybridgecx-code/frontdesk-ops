'use client';

import Link from 'next/link';
import type { WebhookHealthData } from './types';

type WebhookHealthProps = {
  health: WebhookHealthData;
};

export function WebhookHealth({ health }: WebhookHealthProps) {
  if (!health.available) {
    return null;
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Webhook Deliveries</h2>
          <p className="text-sm text-gray-600">Integration reliability for this period.</p>
        </div>
        <span className="inline-flex rounded-full bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-700">
          {health.successRate}% success
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-gray-500">Total</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{health.totalDeliveries}</p>
        </div>
        <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-gray-500">Success</p>
          <p className="mt-1 text-lg font-semibold text-emerald-700">{health.successfulDeliveries}</p>
        </div>
        <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-gray-500">Failed</p>
          <p className="mt-1 text-lg font-semibold text-rose-700">{health.failedDeliveries}</p>
        </div>
      </div>

      <div className="mt-4">
        <Link href="/settings/webhooks" className="inline-flex min-h-11 items-center rounded-md border border-gray-200 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
          View webhook settings
        </Link>
      </div>
    </div>
  );
}
