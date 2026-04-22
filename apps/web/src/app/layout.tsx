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
  title: 'SkyBridgeCX — AI Front Desk for Home Service Businesses',
  description:
    'SkyBridgeCX answers calls 24/7, captures lead details, and sends instant job alerts for home service businesses.'
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
