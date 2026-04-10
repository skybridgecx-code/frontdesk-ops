export function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: 'bg-green-500',
    missed: 'bg-red-500',
    voicemail: 'bg-purple-500',
    'in-progress': 'bg-yellow-500 animate-pulse',
    pending: 'bg-gray-400'
  };

  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${colors[status] ?? 'bg-gray-400'}`} />;
}
