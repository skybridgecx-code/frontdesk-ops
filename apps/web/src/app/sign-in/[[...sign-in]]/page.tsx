import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f7f6f2] p-6">
      <SignIn />
    </main>
  );
}
