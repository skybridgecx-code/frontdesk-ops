interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  completed: { label: 'Completed', className: 'bg-green-100 text-green-800' },
  missed: { label: 'Missed', className: 'bg-red-100 text-red-800' },
  voicemail: { label: 'Voicemail', className: 'bg-purple-100 text-purple-800' },
  'in-progress': { label: 'In Progress', className: 'bg-yellow-100 text-yellow-800' },
  pending: { label: 'Pending', className: 'bg-gray-100 text-gray-600' }
};

function toLabel(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter((part) => part.length > 0)
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join(' ');
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const normalizedStatus = status.trim().toLowerCase();
  const config =
    STATUS_CONFIG[normalizedStatus] ?? {
      label: toLabel(normalizedStatus || 'Unknown'),
      className: 'bg-gray-100 text-gray-600'
    };

  const sizeClass = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${config.className} ${sizeClass}`}>
      {config.label}
    </span>
  );
}
