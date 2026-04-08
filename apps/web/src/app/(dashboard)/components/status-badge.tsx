import { Badge } from './badge';

type StatusBadgeType = 'urgency' | 'triage' | 'review' | 'prospect' | 'subscription';

function toLabel(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function resolveVariant(type: StatusBadgeType, value: string) {
  const normalized = value.toLowerCase();

  if (type === 'urgency') {
    if (normalized === 'emergency') return 'danger';
    if (normalized === 'high') return 'warning';
    if (normalized === 'medium') return 'warning';
    if (normalized === 'low') return 'success';
    return 'default';
  }

  if (type === 'triage') {
    if (normalized === 'open') return 'info';
    if (normalized === 'contacted') return 'success';
    if (normalized === 'archived') return 'default';
    return 'default';
  }

  if (type === 'review') {
    if (normalized === 'needs_review') return 'danger';
    if (normalized === 'reviewed') return 'success';
    if (normalized === 'unreviewed') return 'info';
    return 'default';
  }

  if (type === 'prospect') {
    if (normalized === 'won' || normalized === 'qualified' || normalized === 'responded') return 'success';
    if (normalized === 'lost' || normalized === 'disqualified') return 'danger';
    if (normalized === 'proposal_sent' || normalized === 'in_progress' || normalized === 'attempted') return 'info';
    if (normalized === 'new' || normalized === 'ready') return 'warning';
    return 'default';
  }

  if (normalized === 'active' || normalized === 'trialing') return 'success';
  if (normalized === 'past_due' || normalized === 'unpaid') return 'warning';
  return 'danger';
}

export function StatusBadge({
  value,
  type,
  fallback = 'Unknown'
}: {
  value: string | null | undefined;
  type: StatusBadgeType;
  fallback?: string;
}) {
  const normalizedValue = value?.trim() || '';

  if (!normalizedValue) {
    return <Badge>{fallback}</Badge>;
  }

  return <Badge variant={resolveVariant(type, normalizedValue)}>{toLabel(normalizedValue)}</Badge>;
}
