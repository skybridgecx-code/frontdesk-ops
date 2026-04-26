'use client';

import Link from 'next/link';
import type { RecentActivityRow } from './types';

type RecentActivityProps = {
  rows: RecentActivityRow[];
};

function formatRelativeTime(value: string) {
  const diff    = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1)  return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)   return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatDuration(seconds: number | null) {
  if (seconds === null || seconds < 0) return '—';
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function statusStyle(status: string): React.CSSProperties {
  if (status === 'COMPLETED')                                               return { background: '#D1FAE5', color: '#065F46' };
  if (['NO_ANSWER','BUSY','FAILED','CANCELED'].includes(status))           return { background: '#FEE2E2', color: '#991B1B' };
  return { background: 'var(--surface-3)', color: 'var(--text-secondary)' };
}

function urgencyStyle(urgency: string | null): React.CSSProperties {
  const n = urgency?.toLowerCase() ?? '';
  if (n.includes('high') || n.includes('emergency')) return { background: '#FEE2E2', color: '#991B1B' };
  if (n.includes('medium'))                          return { background: '#FEF3C7', color: '#92400E' };
  if (n.includes('low'))                             return { background: '#D1FAE5', color: '#065F46' };
  return { background: 'var(--surface-3)', color: 'var(--text-secondary)' };
}

function displayCaller(row: RecentActivityRow) {
  return row.extractedName ?? row.fromE164 ?? 'Unknown caller';
}

export function RecentActivity({ rows }: RecentActivityProps) {
  return (
    <div
      className="rounded-xl"
      style={{
        background:   'var(--surface)',
        border:       '1px solid var(--border)',
        boxShadow:    'var(--shadow-sm)',
        overflow:     'hidden',
      }}
    >
      <div className="flex items-start justify-between gap-3 px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div>
          <h2
            className="text-base font-semibold"
            style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
          >
            Recent Activity
          </h2>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Last 20 calls with extraction and text-back status
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
          No recent activity in this period.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto border-collapse text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Time','Caller','Intent','Urgency','Duration','Status','Text-Back'].map((h, i) => (
                  <th
                    key={h}
                    className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide ${
                      i >= 2 && i <= 3 ? 'hidden md:table-cell' :
                      i === 4          ? 'hidden sm:table-cell' :
                      i === 6          ? 'hidden md:table-cell' : ''
                    }`}
                    style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.callSid}
                  className="transition-colors"
                  style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                    {formatRelativeTime(row.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/calls/${row.callSid}`}
                      className="font-medium transition-colors hover:underline"
                      style={{ color: 'var(--accent)', textDecoration: 'none' }}
                    >
                      {displayCaller(row)}
                    </Link>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell" style={{ color: 'var(--text-secondary)', maxWidth: '12rem' }}>
                    <span className="truncate block">{row.extractedIntent ?? '—'}</span>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    {row.extractedUrgency ? (
                      <span
                        className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={urgencyStyle(row.extractedUrgency)}
                      >
                        {row.extractedUrgency}
                      </span>
                    ) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-xs sm:table-cell" style={{ color: 'var(--text-secondary)' }}>
                    {formatDuration(row.durationSeconds)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={statusStyle(row.status)}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    {row.textBackSent ? (
                      <span
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-xs"
                        style={{ background: '#D1FAE5', color: '#065F46' }}
                        aria-label="Text-back sent"
                      >
                        ✓
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
