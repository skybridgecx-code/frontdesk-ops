export function formatCallDuration(answeredAt: string | null, completedAt: string | null): string {
  if (!answeredAt || !completedAt) return '—';

  const seconds = Math.round((new Date(completedAt).getTime() - new Date(answeredAt).getTime()) / 1000);
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

export function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);

  if (!Number.isFinite(seconds) || seconds < 0) return 'just now';
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function formatPhoneNumber(phone: string | null): string {
  if (!phone) return 'Unknown';

  const match = phone.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  if (match) return `(${match[1]}) ${match[2]}-${match[3]}`;
  return phone;
}

export function normalizeCallStatus(status: string | null | undefined): string {
  const value = status?.trim().toLowerCase();
  if (!value) return 'pending';

  if (value === 'completed') return 'completed';
  if (value === 'voicemail') return 'voicemail';
  if (value === 'missed') return 'missed';
  if (value === 'pending') return 'pending';
  if (value === 'in-progress' || value === 'in progress' || value === 'in_progress') return 'in-progress';

  if (
    value === 'no-answer' ||
    value === 'no_answer' ||
    value === 'busy' ||
    value === 'failed' ||
    value === 'canceled'
  ) {
    return 'missed';
  }

  if (value === 'ringing') return 'pending';

  return value;
}
