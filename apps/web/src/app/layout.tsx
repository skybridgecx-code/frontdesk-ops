import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

function normalizeEnv(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

const clerkPublishableKey = normalizeEnv(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
const clerkSignInUrl = normalizeEnv(process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL) ?? '/sign-in';
const clerkSignUpUrl = normalizeEnv(process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL) ?? '/sign-up';
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
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      signInUrl={clerkSignInUrl}
      signUpUrl={clerkSignUpUrl}
    >
      <html lang="en" className="h-full antialiased">
        <body className="min-h-full flex flex-col">{children}</body>
      </html>
    </ClerkProvider>
  );
}
