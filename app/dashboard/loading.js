'use client';

export default function DashboardLoading() {
  return (
    <div className="w-full min-h-[70vh] flex flex-col items-center justify-center p-6">
      <div className="flex flex-col items-center gap-4 max-w-sm text-center">
        {/* Premium Pulsating Circle Spinner */}
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full border-4 border-primary/10"></div>
          <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
        </div>
        
        <div className="flex flex-col gap-1 mt-2">
          <h3 className="font-display font-bold text-sm text-text-primary">
            Syncing inventory database...
          </h3>
          <p className="text-[11px] text-text-secondary leading-relaxed">
            Please wait while we fetch and compile current stock levels and ledger logs.
          </p>
        </div>

        {/* Pulse Skeleton Mockups */}
        <div className="w-full flex flex-col gap-3 mt-6 animate-pulse">
          <div className="h-9 bg-surface-elevated border border-border/40 rounded-lg w-full"></div>
          <div className="h-20 bg-surface-elevated border border-border/40 rounded-lg w-full"></div>
          <div className="flex gap-2">
            <div className="h-14 bg-surface-elevated border border-border/40 rounded-lg flex-1"></div>
            <div className="h-14 bg-surface-elevated border border-border/40 rounded-lg flex-1"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
