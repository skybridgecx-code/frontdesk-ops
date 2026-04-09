'use client';

import Link from 'next/link';
import type { RecentActivityRow } from './types';

type RecentActivityProps = {
  rows: RecentActivityRow[];
};

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - timestamp);

  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) {
    return 'just now';
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDuration(seconds: number | null) {
  if (seconds === null || seconds < 0) {
    return '—';
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function statusBadgeTone(status: string) {
  if (status === 'COMPLETED') {
    return 'bg-emerald-50 text-emerald-700';
  }

  if (status === 'NO_ANSWER' || status === 'BUSY' || status === 'FAILED' || status === 'CANCELED') {
    return 'bg-rose-50 text-rose-700';
  }

  return 'bg-gray-100 text-gray-700';
}

function urgencyBadgeTone(urgency: string | null) {
  const normalized = urgency?.toLowerCase() ?? '';

  if (normalized.includes('high') || normalized.includes('emergency')) {
    return 'bg-rose-50 text-rose-700';
  }

  if (normalized.includes('medium')) {
    return 'bg-amber-50 text-amber-700';
  }

  if (normalized.includes('low')) {
    return 'bg-emerald-50 text-emerald-700';
  }

  return 'bg-gray-100 text-gray-600';
}

function displayCaller(row: RecentActivityRow) {
  return row.extractedName ?? row.fromE164 ?? 'Unknown caller';
}

export function RecentActivity({ rows }: RecentActivityProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
          <p className="text-sm text-gray-600">Last 20 calls with extraction and text-back status.</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-600">No recent activity in this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Caller</th>
                <th className="hidden px-3 py-2 font-medium md:table-cell">Intent</th>
                <th className="hidden px-3 py-2 font-medium md:table-cell">Urgency</th>
                <th className="hidden px-3 py-2 font-medium sm:table-cell">Duration</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="hidden px-3 py-2 font-medium md:table-cell">Text-Back</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.callSid} className="border-b border-gray-100 text-sm">
                  <td className="px-3 py-3 text-gray-600">{formatRelativeTime(row.createdAt)}</td>
                  <td className="px-3 py-3">
                    <Link href={`/calls/${row.callSid}`} className="inline-flex min-h-11 items-center font-medium text-gray-900 hover:text-indigo-600">
                      {displayCaller(row)}
                    </Link>
                  </td>
                  <td className="hidden px-3 py-3 text-gray-600 md:table-cell">{row.extractedIntent ?? '—'}</td>
                  <td className="hidden px-3 py-3 md:table-cell">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${urgencyBadgeTone(row.extractedUrgency)}`}>
                      {row.extractedUrgency ?? 'unknown'}
                    </span>
                  </td>
                  <td className="hidden px-3 py-3 text-gray-600 sm:table-cell">{formatDuration(row.durationSeconds)}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusBadgeTone(row.status)}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="hidden px-3 py-3 text-gray-600 md:table-cell">{row.textBackSent ? '✓' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
