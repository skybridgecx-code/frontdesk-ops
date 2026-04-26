'use client';

import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { usePathname } from 'next/navigation';
import { useMemo, useState, type ReactElement } from 'react';

type SidebarNavProps = {
  subscriptionStatus: string | null;
};

type NavItem = {
  href:  string;
  label: string;
  icon:  ReactElement;
};

const navItems: NavItem[] = [
  {
    href:  '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    )
  },
  {
    href:  '/calls',
    label: 'Calls',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
        <path
          d="M6.5 4.5h2.8c.4 0 .8.3.9.7l.9 4.1c.1.4-.1.8-.4 1.1l-1.7 1.7a14.6 14.6 0 0 0 6 6l1.7-1.7c.3-.3.7-.5 1.1-.4l4.1.9c.4.1.7.5.7.9v2.8c0 .5-.4 1-1 1C11.2 22.5 1.5 12.8 1.5 5.5c0-.6.4-1 1-1Z"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        />
      </svg>
    )
  },
  {
    href:  '/prospects',
    label: 'Prospects',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
        <path
          d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 20a6 6 0 0 1 12 0M18 11l4 0M20 9l0 4"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
        />
      </svg>
    )
  },
  {
    href:  '/billing',
    label: 'Billing',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
        <path
          d="M3 8h18M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm0 7h7"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
        />
      </svg>
    )
  },
  {
    href:  '/settings',
    label: 'Settings',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
        <path
          d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm8 3a8 8 0 0 0-.1-1.2l2-1.6-2-3.4-2.5 1a8.4 8.4 0 0 0-2-.9L13 3h-2l-.4 2.9a8.4 8.4 0 0 0-2 .9l-2.5-1-2 3.4 2 1.6A8 8 0 0 0 4 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.5-1c.6.4 1.3.7 2 .9L11 21h2l.4-2.9c.7-.2 1.4-.5 2-.9l2.5 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        />
      </svg>
    )
  }
];

function getSubscriptionUi(status: string | null) {
  const normalized = status?.toLowerCase() ?? 'none';
  if (normalized === 'active' || normalized === 'trialing') {
    return { dot: 'bg-emerald-500', label: 'Active', color: 'text-emerald-600' };
  }
  if (normalized === 'past_due' || normalized === 'unpaid') {
    return { dot: 'bg-amber-400', label: 'Payment issue', color: 'text-amber-600' };
  }
  return { dot: 'bg-rose-400', label: 'No subscription', color: 'text-rose-600' };
}

function isItemActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ subscriptionStatus }: SidebarNavProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const subUi = useMemo(() => getSubscriptionUi(subscriptionStatus), [subscriptionStatus]);

  return (
    <>
      {/* Mobile menu trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed left-4 top-4 z-40 inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-white shadow-sm transition hover:bg-gray-50 lg:hidden"
        style={{ borderColor: 'var(--border)' }}
        aria-label="Open menu"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" style={{ color: 'var(--text-primary)' }} aria-hidden="true">
          <path d="M4 7h16M4 12h10M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-200 lg:hidden ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        style={{ background: 'rgba(15,17,23,0.35)', backdropFilter: 'blur(4px)' }}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          width: '15rem',
          minWidth: '15rem',
          maxWidth: '18rem',
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          boxShadow: isOpen ? 'var(--shadow-xl)' : 'none',
          transition: 'transform 260ms cubic-bezier(0.4, 0, 0.2, 1)',
          padding: '1.25rem 0.875rem',
        }}
      >
        {/* Logo */}
        <div style={{ marginBottom: '1.75rem' }}>
          <div className="flex items-center justify-between">
            <Link
              href="/dashboard"
              className="group flex items-center gap-2.5"
              onClick={() => setIsOpen(false)}
              style={{ textDecoration: 'none' }}
            >
              {/* Logo mark */}
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                style={{
                  background: 'linear-gradient(135deg, var(--accent) 0%, #8B5CF6 100%)',
                  boxShadow: '0 2px 8px var(--accent-glow)',
                  letterSpacing: '-0.02em',
                }}
              >
                SX
              </span>
              <div>
                <span
                  className="block text-sm font-semibold leading-tight"
                  style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
                >
                  SkyBridgeCX
                </span>
                <span className="block text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  AI Front Desk
                </span>
              </div>
            </Link>

            {/* Close on mobile */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-gray-100 lg:hidden"
              style={{ color: 'var(--text-tertiary)' }}
              aria-label="Close menu"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Nav label */}
        <p className="mb-1.5 px-2 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
          Menu
        </p>

        {/* Nav items */}
        <nav className="flex-1 space-y-0.5">
          {navItems.map((item, i) => {
            const active = isItemActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className="group flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all"
                style={{
                  background:   active ? 'var(--accent-dim)' : 'transparent',
                  color:        active ? 'var(--accent)'     : 'var(--text-secondary)',
                  animationDelay: `${i * 40}ms`,
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = 'var(--surface-3)';
                    (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                  }
                }}
              >
                {/* Active indicator bar */}
                <span
                  className="absolute left-0 h-6 w-0.5 rounded-r-full transition-all duration-200"
                  style={{
                    background: active ? 'var(--accent)' : 'transparent',
                    opacity: active ? 1 : 0,
                  }}
                  aria-hidden="true"
                />
                <span
                  className="shrink-0 transition-colors"
                  style={{ color: active ? 'var(--accent)' : 'var(--text-tertiary)' }}
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
                {active && (
                  <span
                    className="ml-auto h-1.5 w-1.5 rounded-full"
                    style={{ background: 'var(--accent)' }}
                    aria-hidden="true"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div
          className="mt-auto space-y-3 pt-4"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          {/* Subscription pill */}
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${subUi.dot}`} aria-hidden="true" />
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {subUi.label}
            </span>
          </div>

          {/* User */}
          <div
            className="flex items-center justify-between rounded-lg px-3 py-2"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
          >
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Account
            </span>
            <UserButton />
          </div>
        </div>
      </aside>
    </>
  );
}
