import Link from 'next/link';

function FooterLogo() {
  return (
    <div className="inline-flex items-center gap-2 text-gray-900">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-xs font-semibold text-white">
        SX
      </span>
      <span className="text-sm font-semibold tracking-tight">SkybridgeCX</span>
    </div>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <FooterLogo />
            <p className="mt-3 text-sm text-gray-600">AI front desk for home service businesses.</p>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-900">Product</p>
              <a href="#features" className="block text-sm text-gray-600 hover:text-gray-900">
                Features
              </a>
              <a href="#pricing" className="block text-sm text-gray-600 hover:text-gray-900">
                Pricing
              </a>
              <a href="#faq" className="block text-sm text-gray-600 hover:text-gray-900">
                FAQ
              </a>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-900">Company</p>
              <Link href="/sign-in" className="block text-sm text-gray-600 hover:text-gray-900">
                Sign In
              </Link>
              <a href="/privacy" className="block text-sm text-gray-600 hover:text-gray-900">
                Privacy Policy
              </a>
              <a href="/terms" className="block text-sm text-gray-600 hover:text-gray-900">
                Terms of Service
              </a>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-900">Social</p>
              <a href="#" className="block text-sm text-gray-600 hover:text-gray-900">
                Twitter/X
              </a>
              <a href="#" className="block text-sm text-gray-600 hover:text-gray-900">
                LinkedIn
              </a>
            </div>
          </div>
        </div>

        <p className="mt-10 text-sm text-gray-500">© 2025 SkybridgeCX. All rights reserved.</p>
      </div>
    </footer>
  );
}
