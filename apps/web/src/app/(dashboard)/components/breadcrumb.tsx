import Link from 'next/link';

type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 items-center gap-1.5 overflow-x-auto whitespace-nowrap text-sm"
      style={{ color: 'var(--text-tertiary)' }}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <span
            key={`${item.label}-${index}`}
            className="inline-flex min-w-0 items-center gap-1.5"
          >
            {isLast || !item.href ? (
              <span
                className="max-w-[16rem] truncate font-medium sm:max-w-[24rem]"
                style={{ color: 'var(--text-primary)' }}
              >
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="max-w-[10rem] truncate py-1 text-sm font-medium transition hover:opacity-70 sm:max-w-none"
                style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}
              >
                {item.label}
              </Link>
            )}
            {!isLast ? (
              <span style={{ color: 'var(--border-mid)' }} aria-hidden="true">
                /
              </span>
            ) : null}
          </span>
        );
      })}
    </nav>
  );
}
