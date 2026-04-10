'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

function isNavActive(pathname: string, href: string) {
  if (href === '/admin') {
    return pathname === '/admin';
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function AdminNavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = isNavActive(pathname, href);

  return (
    <Link
      href={href}
      className={`text-sm transition-colors ${
        active ? 'text-white font-semibold' : 'text-gray-400 hover:text-white'
      }`}
    >
      {label}
    </Link>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950">
      <nav className="border-b border-gray-800 bg-gray-900 px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold text-white">SkybridgeCX Admin</h1>
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-medium text-white">INTERNAL</span>
          </div>
          <div className="flex items-center gap-6">
            <AdminNavLink href="/admin" label="Dashboard" />
            <AdminNavLink href="/admin/tenants" label="Tenants" />
            <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white">
              ← Back to App
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
