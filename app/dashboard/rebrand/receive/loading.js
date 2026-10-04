export default function ReceiveRebrandLoading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse max-w-4xl mx-auto py-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-surface-elevated/40 rounded-xl" />
        <div className="flex flex-col gap-1.5">
          <div className="h-6 bg-surface-elevated/40 rounded-lg w-56" />
          <div className="h-4 bg-surface-elevated/20 rounded-lg w-80" />
        </div>
      </div>
      <div className="h-32 bg-surface-elevated/30 rounded-2xl border border-border" />
      <div className="h-80 bg-surface-elevated/20 rounded-2xl border border-border" />
    </div>
  );
}
