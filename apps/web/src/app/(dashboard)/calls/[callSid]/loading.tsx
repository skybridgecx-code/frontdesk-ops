export default function CallDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-4 w-32 rounded bg-gray-200" />

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-6 w-48 rounded bg-gray-200" />
            <div className="h-4 w-36 rounded bg-gray-200" />
          </div>
          <div className="h-6 w-24 rounded-full bg-gray-200" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="rounded-lg bg-gray-100 p-4">
            <div className="h-3 w-24 rounded bg-gray-200" />
            <div className="mt-2 h-5 w-40 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
