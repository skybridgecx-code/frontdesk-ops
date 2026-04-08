import Link from 'next/link';

type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-gray-500">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <span key={`${item.label}-${index}`} className="inline-flex items-center gap-2">
            {isLast || !item.href ? (
              <span className="font-medium text-gray-700">{item.label}</span>
            ) : (
              <Link href={item.href} className="transition hover:text-indigo-600">
                {item.label}
              </Link>
            )}
            {!isLast ? <span className="text-gray-300">/</span> : null}
          </span>
        );
      })}
    </nav>
  );
}
