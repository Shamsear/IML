'use client';

export default function DashboardLoading() {
  return (
    <div className="w-full min-h-[60vh] flex items-center justify-center p-6">
      {/* Glassmorphic Loader Container */}
      <div className="relative bg-surface/40 backdrop-blur-md border border-border/60 rounded-2xl p-8 max-w-[360px] w-full shadow-2xl flex flex-col items-center gap-5 text-center transition-opacity duration-300">
        
        {/* Modern Double Orbit Spinner */}
        <div className="relative w-16 h-16 flex items-center justify-center">
          {/* Inner Pulsing Core */}
          <div className="absolute w-5 h-5 rounded-full bg-primary/20 animate-ping"></div>
          <div className="absolute w-5 h-5 rounded-full bg-primary shadow-[0_0_12px_rgba(var(--color-primary),0.3)]"></div>
          
          {/* Outer Spin Ring */}
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary border-r-primary animate-spin"></div>
          {/* Reverse Outer Spin Ring */}
          <div className="absolute -inset-1 rounded-full border-2 border-transparent border-b-secondary border-l-secondary animate-reverse-spin opacity-50"></div>
        </div>

        <div className="flex flex-col gap-1.5 mt-2">
          <h3 className="font-display font-extrabold text-base text-text-primary tracking-tight">
            Syncing inventory database...
          </h3>
          <p className="text-xs text-text-secondary leading-relaxed">
            Please wait while we load your dashboard.
          </p>
        </div>

        {/* Premium infinite loading progress line */}
        <div className="w-full h-1 bg-surface-elevated rounded-full overflow-hidden relative">
          <div className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-primary to-secondary w-[40%] rounded-full animate-loader-slide"></div>
        </div>
      </div>
    </div>
  );
}
