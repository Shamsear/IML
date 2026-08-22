'use client';

export default function DashboardLoading() {
  return (
    <div className="w-full min-h-[60vh] flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-6 text-center">
        {/* Minimal loading indicator — three dots with staggered pulse */}
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-[pulse_1.4s_ease-in-out_infinite]" />
          <span className="w-2 h-2 rounded-full bg-primary animate-[pulse_1.4s_ease-in-out_0.2s_infinite]" />
          <span className="w-2 h-2 rounded-full bg-primary animate-[pulse_1.4s_ease-in-out_0.4s_infinite]" />
        </div>

        <div className="flex flex-col gap-1">
          <h3 className="font-display font-bold text-sm text-text-primary tracking-tight">
            Loading dashboard
          </h3>
          <p className="text-xs text-text-secondary">
            Fetching your inventory data…
          </p>
        </div>
      </div>
    </div>
  );
}
