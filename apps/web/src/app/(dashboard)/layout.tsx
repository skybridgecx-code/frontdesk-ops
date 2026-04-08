import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f7f6f2] text-[#111827]">
      <header className="sticky top-0 z-20 border-b border-black/10 bg-[#f7f6f2]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-3">
          <Link href="/calls" className="text-sm font-semibold tracking-[0.16em] uppercase text-black/70">
            SkybridgeCX Ops
          </Link>
          <UserButton />
        </div>
      </header>
      {children}
    </div>
  );
}
