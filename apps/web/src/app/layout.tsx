import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export const metadata: Metadata = {
  title: 'SkybridgeCX | Done-for-you AI front desk for home-service businesses',
  description:
    'SkybridgeCX helps HVAC, plumbing, electrical, roofing, garage door, and locksmith teams capture, qualify, route, and follow up on inbound requests so fewer jobs get missed.'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className="h-full antialiased">
        <body className="min-h-full flex flex-col">{children}</body>
      </html>
    </ClerkProvider>
  );
}
