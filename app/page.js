import Link from 'next/link';
import { ShieldCheck, ArrowRight, Lock } from 'lucide-react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect('/dashboard');
  }

  return (
    <div className="relative flex items-center justify-center min-h-[100dvh] bg-background p-4 sm:p-6 overflow-hidden">
      {/* Decorative Warm Accent Ambient Glows */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-secondary/5 blur-[120px] pointer-events-none" />

      {/* Landing Panel */}
      <div className="w-full max-w-lg bg-surface border border-border rounded-2xl p-6 sm:p-8 md:p-10 shadow-lg flex flex-col gap-6 sm:gap-8 relative z-10">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="px-3 py-1 bg-primary/10 border border-primary/20 text-primary text-xs font-bold font-display rounded-full tracking-wider uppercase">
            IML Group
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-text-primary tracking-tight leading-tight">
            Logistics &amp; Campaign Asset Portal
          </h1>
          <p className="text-text-secondary text-sm sm:text-base leading-relaxed max-w-sm">
            Secure tracking of promoter assignments, serialized SIM cards, uniforms, retail POSM stands, and inventory transfers.
          </p>
        </div>

        <div className="flex justify-center">
          <Link 
            href="/dashboard" 
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg hover:shadow-primary/10 transition-colors shadow duration-200"
          >
            <ShieldCheck size={18} />
            <span>Access Dashboard</span>
            <ArrowRight size={16} />
          </Link>
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-text-muted border-t border-border pt-5 text-center">
          <Lock size={12} className="flex-shrink-0" />
          <span>Restricted Access. Authorized IML Logistics Administrator personnel only.</span>
        </div>
      </div>
    </div>
  );
}
