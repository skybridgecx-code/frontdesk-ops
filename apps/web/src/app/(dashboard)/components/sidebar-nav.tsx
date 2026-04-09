'use client';

import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { usePathname } from 'next/navigation';
import { useMemo, useState, type ReactElement } from 'react';

type SidebarNavProps = {
  subscriptionStatus: string | null;
};

type NavItem = {
  href: string;
  label: string;
  icon: ReactElement;
};

const navItems: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
        <path d="M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6V11h-6v9Zm0-11h6V4h-6v5Z" fill="currentColor" />
      </svg>
    )
  },
  {
    href: '/calls',
    label: 'Calls',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
        <path
          d="M6.5 4.5h2.8c.4 0 .8.3.9.7l.9 4.1c.1.4-.1.8-.4 1.1l-1.7 1.7a14.6 14.6 0 0 0 6 6l1.7-1.7c.3-.3.7-.5 1.1-.4l4.1.9c.4.1.7.5.7.9v2.8c0 .5-.4 1-1 1C11.2 22.5 1.5 12.8 1.5 5.5c0-.6.4-1 1-1Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  },
  {
    href: '/prospects',
    label: 'Prospects',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
        <path
          d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 20a6 6 0 0 1 12 0M18 11l4 0M20 9l0 4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    )
  },
  {
    href: '/billing',
    label: 'Billing',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
        <path
          d="M3 8h18M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm0 7h7"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    )
  }
];

function getSubscriptionUi(status: string | null) {
  const normalized = status?.toLowerCase() ?? 'none';

  if (normalized === 'active' || normalized === 'trialing') {
    return {
      dot: 'bg-emerald-500',
      label: 'Subscription active'
    };
  }

  if (normalized === 'past_due' || normalized === 'unpaid') {
    return {
      dot: 'bg-amber-500',
      label: 'Payment issue'
    };
  }

  return {
    dot: 'bg-rose-500',
    label: 'No active subscription'
  };
}

function isItemActive(pathname: string, href: string) {
  if (href === '/dashboard') {
    return pathname === '/dashboard';
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ subscriptionStatus }: SidebarNavProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const subscriptionUi = useMemo(() => getSubscriptionUi(subscriptionStatus), [subscriptionStatus]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed left-4 top-4 z-40 inline-flex h-11 w-11 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 shadow-sm lg:hidden"
        aria-label="Open menu"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      <div
        className={`fixed inset-0 z-40 bg-gray-900/45 transition ${isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'} lg:hidden`}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[85vw] max-w-[18rem] flex-col border-r border-gray-200 bg-white p-4 transition-transform sm:p-5 lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:max-w-none lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-8 flex items-center justify-between">
          <Link href="/dashboard" className="group inline-flex items-center gap-3" onClick={() => setIsOpen(false)}>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-indigo-600 text-sm font-semibold text-white">
              SX
            </span>
            <span className="text-lg font-semibold tracking-tight text-gray-900 transition group-hover:text-indigo-600">
              SkybridgeCX
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 lg:hidden"
            aria-label="Close menu"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const active = isItemActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`group flex min-h-11 items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-700'
                }`}
              >
                <span className={active ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-600'}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-4 border-t border-gray-200 pt-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 sm:text-xs">
            <span className={`h-2 w-2 rounded-full ${subscriptionUi.dot}`} aria-hidden="true" />
            <span>{subscriptionUi.label}</span>
          </div>
          <div className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
            <span className="text-sm font-medium text-gray-700">Account</span>
            <UserButton />
          </div>
        </div>
      </aside>
    </>
  );
}
