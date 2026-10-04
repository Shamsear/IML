export default function GiveBackLoading() {
  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto py-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-surface-elevated/40 rounded-xl" />
        <div className="flex flex-col gap-2">
          <div className="h-6 w-48 bg-surface-elevated/40 rounded-lg" />
          <div className="h-4 w-72 bg-surface-elevated/30 rounded-lg" />
        </div>
      </div>
      <div className="h-64 bg-surface-elevated/20 rounded-2xl border border-border" />
      <div className="h-96 bg-surface-elevated/20 rounded-2xl border border-border" />
    </div>
  );
}
