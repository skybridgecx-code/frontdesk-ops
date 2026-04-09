export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="h-28 animate-pulse rounded-xl border border-gray-200 bg-white" />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_value, index) => (
          <div key={index} className="h-32 animate-pulse rounded-xl border border-gray-200 bg-white" />
        ))}
      </div>

      <div className="h-80 animate-pulse rounded-xl border border-gray-200 bg-white" />

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="h-72 animate-pulse rounded-xl border border-gray-200 bg-white" />
        <div className="h-72 animate-pulse rounded-xl border border-gray-200 bg-white" />
      </div>

      <div className="h-72 animate-pulse rounded-xl border border-gray-200 bg-white" />
      <div className="h-80 animate-pulse rounded-xl border border-gray-200 bg-white" />
    </div>
  );
}
