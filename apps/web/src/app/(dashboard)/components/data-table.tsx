import type { ReactNode } from 'react';

export function DataTable({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={['overflow-hidden rounded-xl border border-white/10 bg-[#0d1320]/88 shadow-[0_22px_70px_rgba(0,0,0,0.22)]', className]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm text-[#c8d8e8]">{children}</table>
      </div>
    </div>
  );
}
