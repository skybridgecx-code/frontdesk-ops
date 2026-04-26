import { SignIn } from '@clerk/nextjs';
import { SkybridgeBrandMark } from '../../components/skybridge-public-shell';

const authAppearance = {
  elements: {
    rootBox: 'w-full',
    cardBox: 'w-full shadow-none',
    card: 'w-full rounded-3xl border border-gray-200 bg-white shadow-lg',
    headerTitle: 'text-gray-900',
    headerSubtitle: 'text-gray-500',
    socialButtonsBlockButton: 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
    dividerLine: 'bg-gray-200',
    dividerText: 'text-gray-400',
    formFieldLabel: 'text-gray-700',
    formFieldInput: 'border-gray-200 bg-white text-gray-900 focus:border-indigo-500 focus:ring-indigo-500/20',
    formButtonPrimary: 'bg-indigo-600 text-white hover:bg-indigo-500',
    footerActionText: 'text-gray-500',
    footerActionLink: 'text-indigo-600 hover:text-indigo-500'
  }
};

export default function SignInPage() {
  return (
    <main className="skybridge-app flex min-h-screen items-center justify-center bg-gray-50 px-6 py-10">
      <div className="grid w-full max-w-6xl gap-10 lg:grid-cols-[0.9fr_0.8fr] lg:items-center">
        <section className="max-w-xl">
          <SkybridgeBrandMark />
          <p className="mt-10 text-xs font-semibold uppercase tracking-widest text-indigo-600">Welcome back</p>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-6xl">
            Get back to every captured call.
          </h1>
          <p className="mt-6 text-base leading-7 text-gray-500">
            Sign in to review calls, prospects, billing, and the AI front desk settings that keep your team reachable.
          </p>
        </section>

        <section className="w-full max-w-md justify-self-center lg:justify-self-end">
          <SignIn forceRedirectUrl="/dashboard" fallbackRedirectUrl="/dashboard" appearance={authAppearance} />
        </section>
      </div>
    </main>
  );
}
