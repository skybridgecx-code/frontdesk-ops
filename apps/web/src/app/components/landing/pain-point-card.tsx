import type { ReactNode } from 'react';

type PainPointCardProps = {
  title: string;
  description: string;
  icon: ReactNode;
};

export function PainPointCard({ title, description, icon }: PainPointCardProps) {
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p>
    </article>
  );
}
