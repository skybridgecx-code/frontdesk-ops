export function HeroMockup() {
  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div className="absolute -left-8 -top-8 h-32 w-32 rounded-full bg-indigo-200/60 blur-2xl" />
      <div className="absolute -right-8 bottom-0 h-32 w-32 rounded-full bg-sky-200/60 blur-2xl" />

      <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-xl sm:p-5">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-xs font-semibold text-white">
              SX
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Incoming Call</p>
              <p className="text-xs text-gray-500">SkybridgeCX AI Front Desk</p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Live</span>
        </div>

        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Caller</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">Angela M. · (214) 555-0142</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-gray-200 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Intent</p>
              <p className="mt-1 text-sm text-gray-900">A/C not cooling</p>
            </div>
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-rose-600">Urgency</p>
              <p className="mt-1 text-sm font-semibold text-rose-700">Emergency</p>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Service Address</p>
            <p className="mt-1 text-sm text-gray-900">4821 Preston Hollow Dr, Dallas, TX</p>
          </div>

          <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">Summary</p>
            <p className="mt-1 text-sm text-indigo-900">
              Customer reports no cold air and rising indoor temperature. Requested same-day technician dispatch.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
