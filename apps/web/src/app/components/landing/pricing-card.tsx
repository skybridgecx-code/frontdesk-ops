import Link from 'next/link';

type PricingCardProps = {
  name: string;
  price: number;
  callsLabel: string;
  phoneNumbersLabel: string;
  businessesLabel: string;
  features: string[];
  popular?: boolean;
};

export function PricingCard({
  name,
  price,
  callsLabel,
  phoneNumbersLabel,
  businessesLabel,
  features,
  popular = false
}: PricingCardProps) {
  return (
    <article
      className={`relative flex h-full flex-col rounded-xl border bg-white p-6 shadow-sm ${
        popular ? 'border-indigo-600 ring-2 ring-indigo-100' : 'border-gray-200'
      }`}
    >
      {popular ? (
        <span className="absolute right-4 top-4 rounded-full bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white">
          Most Popular
        </span>
      ) : null}

      <h3 className="text-lg font-semibold text-gray-900">{name}</h3>
      <div className="mt-2 flex items-end gap-1">
        <span className="text-4xl font-semibold tracking-tight text-gray-900">${price}</span>
        <span className="pb-1 text-sm text-gray-500">/mo</span>
      </div>

      <ul className="mt-5 space-y-2 text-sm text-gray-700">
        <li>• {callsLabel}</li>
        <li>• {phoneNumbersLabel}</li>
        <li>• {businessesLabel}</li>
      </ul>

      <ul className="mt-5 space-y-2 text-sm text-gray-600">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <span className="mt-0.5 text-indigo-600" aria-hidden="true">
              ✓
            </span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        <Link
          href="/sign-up"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-500"
        >
          Get Started
        </Link>
      </div>
    </article>
  );
}
