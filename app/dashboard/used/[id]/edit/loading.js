import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
      <Loader2 size={32} className="animate-spin text-warning" />
      <span className="text-sm font-semibold text-text-muted">Loading consumed record...</span>
    </div>
  );
}
