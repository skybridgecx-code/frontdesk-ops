import type { ReactNode } from 'react';

export function DataTable({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={["overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm", className].filter(Boolean).join(' ')}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm text-gray-700">{children}</table>
      </div>
    </div>
  );
}
