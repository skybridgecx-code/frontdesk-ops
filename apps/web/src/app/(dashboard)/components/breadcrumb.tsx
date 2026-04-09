import Link from 'next/link';

type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap text-sm text-gray-500"
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <span key={`${item.label}-${index}`} className="inline-flex min-w-0 items-center gap-1.5">
            {isLast || !item.href ? (
              <span className="max-w-[16rem] truncate font-medium text-gray-700 sm:max-w-[24rem]">{item.label}</span>
            ) : (
              <Link
                href={item.href}
                className="max-w-[10rem] truncate py-1 text-sm transition hover:text-indigo-600 sm:max-w-none"
              >
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
