import { SignUp } from '@clerk/nextjs';
import { SkybridgeBrandMark } from '../../components/skybridge-public-shell';

const authAppearance = {
  elements: {
    rootBox: 'w-full',
    cardBox: 'w-full shadow-none',
    card: 'w-full rounded-3xl border border-white/10 bg-[#0d1320]/95 shadow-[0_30px_90px_rgba(0,0,0,0.45)]',
    headerTitle: 'text-[#f0f4f8]',
    headerSubtitle: 'text-[#5a6a80]',
    socialButtonsBlockButton: 'border-white/10 bg-[#020305]/70 text-[#f0f4f8] hover:bg-[#00d4ff]/10',
    dividerLine: 'bg-white/10',
    dividerText: 'text-[#5a6a80]',
    formFieldLabel: 'text-[#c8d8e8]',
    formFieldInput: 'border-white/15 bg-[#020305]/70 text-[#f0f4f8] focus:border-[#00d4ff] focus:ring-[#00d4ff]/20',
    formButtonPrimary: 'bg-[#00d4ff] text-[#020305] hover:bg-[#33ddff]',
    footerActionText: 'text-[#5a6a80]',
    footerActionLink: 'text-[#00d4ff] hover:text-[#33ddff]'
  }
};

export default function SignUpPage() {
  return (
    <main className="skybridge-app flex min-h-screen items-center justify-center px-6 py-10">
      <div className="grid w-full max-w-6xl gap-10 lg:grid-cols-[0.9fr_0.8fr] lg:items-center">
        <section className="max-w-xl">
          <SkybridgeBrandMark />
          <p className="mt-10 font-mono text-xs font-semibold uppercase tracking-[0.28em] text-[#00d4ff]">Start trial</p>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-[-0.06em] text-[#f0f4f8] sm:text-6xl">
            Set up your AI front desk in minutes.
          </h1>
          <p className="mt-6 text-base leading-7 text-[#5a6a80]">
            Create your account, complete onboarding, and start routing every missed opportunity into a captured lead.
          </p>
        </section>

        <section className="w-full max-w-md justify-self-center lg:justify-self-end">
          <SignUp forceRedirectUrl="/onboarding" fallbackRedirectUrl="/onboarding" appearance={authAppearance} />
        </section>
      </div>
    </main>
  );
}
