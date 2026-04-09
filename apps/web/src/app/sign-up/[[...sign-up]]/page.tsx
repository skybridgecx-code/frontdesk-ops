import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f7f6f2] p-6">
      <SignUp />
    </main>
  );
}
