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
        <path d="M4 18h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M7 15.5V11m5 4.5V7m5 8.5v-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="m6 9 4-3 4 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
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
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
        <path
          d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm8 3a8 8 0 0 0-.1-1.2l2-1.6-2-3.4-2.5 1a8.4 8.4 0 0 0-2-.9L13 3h-2l-.4 2.9a8.4 8.4 0 0 0-2 .9l-2.5-1-2 3.4 2 1.6A8 8 0 0 0 4 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.5-1c.6.4 1.3.7 2 .9L11 21h2l.4-2.9c.7-.2 1.4-.5 2-.9l2.5 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
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
        className="fixed left-4 top-4 z-40 inline-flex h-11 w-11 items-center justify-center rounded-md border border-white/10 bg-[#0d1320] text-[#f0f4f8] shadow-sm lg:hidden"
        aria-label="Open menu"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      <div
        className={`fixed inset-0 z-40 bg-black/65 transition ${isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'} lg:hidden`}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[85vw] max-w-[18rem] flex-col border-r border-white/10 bg-[#080c12]/95 p-4 shadow-[24px_0_80px_rgba(0,0,0,0.38)] backdrop-blur transition-transform sm:p-5 lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:max-w-none lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-8 flex items-center justify-between">
          <Link href="/dashboard" className="group inline-flex items-center gap-3" onClick={() => setIsOpen(false)}>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-[#00d4ff] text-sm font-extrabold text-[#020305]">
              SX
            </span>
            <span className="text-lg font-semibold tracking-tight text-[#f0f4f8] transition group-hover:text-[#00d4ff]">
              SkyBridgeCX
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-[#5a6a80] transition hover:bg-[#00d4ff]/10 hover:text-[#f0f4f8] lg:hidden"
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
                    ? 'bg-[#00d4ff]/12 text-[#00d4ff]'
                    : 'text-[#8aa0b8] hover:bg-[#00d4ff]/10 hover:text-[#f0f4f8]'
                }`}
              >
                <span className={active ? 'text-[#00d4ff]' : 'text-[#5a6a80] group-hover:text-[#00d4ff]'}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-4 border-t border-white/10 pt-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#0d1320] px-3 py-2 text-sm font-medium text-[#8aa0b8] sm:text-xs">
            <span className={`h-2 w-2 rounded-full ${subscriptionUi.dot}`} aria-hidden="true" />
            <span>{subscriptionUi.label}</span>
          </div>
          <div className="flex items-center justify-between rounded-md border border-white/10 bg-[#0d1320] px-3 py-2">
            <span className="text-sm font-medium text-[#c8d8e8]">Account</span>
            <UserButton />
          </div>
        </div>
      </aside>
    </>
  );
}
