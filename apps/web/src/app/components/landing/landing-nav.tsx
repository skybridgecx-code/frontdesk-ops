'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const navLinks = [
  { href: '#features', label: 'Features' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' }
] as const;

function LogoMark() {
  return (
    <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-sm font-semibold text-white">
      SX
    </div>
  );
}

export function LandingNav() {
  const [hasScrolled, setHasScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setHasScrolled(window.scrollY > 10);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-all duration-200 ${
        hasScrolled
          ? 'border-gray-200 bg-white/95 shadow-sm backdrop-blur'
          : 'border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-gray-900">
          <LogoMark />
          <span className="text-base font-semibold tracking-tight">SkybridgeCX</span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-gray-600 transition hover:text-gray-900"
            >
              {link.label}
            </a>
          ))}

          <Link href="/sign-in" className="text-sm font-medium text-gray-600 transition hover:text-gray-900">
            Sign In
          </Link>

          <Link
            href="/sign-up"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            Get Started
          </Link>
        </nav>

        <button
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((value) => !value)}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-gray-200 text-gray-700 md:hidden"
        >
          {mobileOpen ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>

      {mobileOpen ? (
        <div className="border-t border-gray-200 bg-white px-4 pb-4 pt-3 md:hidden">
          <div className="space-y-2">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                {link.label}
              </a>
            ))}

            <Link
              href="/sign-in"
              onClick={() => setMobileOpen(false)}
              className="flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Sign In
            </Link>

            <Link
              href="/sign-up"
              onClick={() => setMobileOpen(false)}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
              Get Started
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
