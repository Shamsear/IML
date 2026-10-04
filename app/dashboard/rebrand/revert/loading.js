export default function Loading() {
  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto py-4 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-surface-elevated rounded-xl border border-border" />
        <div className="flex flex-col gap-1.5">
          <div className="h-6 w-48 bg-surface-elevated rounded-md" />
          <div className="h-3.5 w-72 bg-surface-elevated rounded-md" />
        </div>
      </div>

      {/* Card Skeleton 1 */}
      <div className="bg-surface border border-border rounded-2xl p-6 flex flex-col gap-4">
        <div className="h-5 w-40 bg-surface-elevated rounded-md" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-24 bg-surface-elevated/40 rounded-xl" />
          <div className="h-24 md:col-span-2 bg-surface-elevated/40 rounded-xl" />
        </div>
      </div>

      {/* Card Skeleton 2 */}
      <div className="bg-surface border border-border rounded-2xl p-6 flex flex-col gap-4">
        <div className="h-5 w-48 bg-surface-elevated rounded-md" />
        <div className="h-32 bg-surface-elevated/30 rounded-xl" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-10 bg-surface-elevated/40 rounded-xl" />
          <div className="h-10 bg-surface-elevated/40 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
