import Link from 'next/link';
import { ArrowRight, Lock, Package, Users, MapPin } from 'lucide-react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect('/dashboard');
  }

  return (
    <div className="relative flex items-center justify-center min-h-[100dvh] overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* Subtle dot grid pattern */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.035]"
        style={{
          backgroundImage: 'radial-gradient(circle, var(--text-primary) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Ambient gradient orbs */}
      <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/[0.06] blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[45%] h-[45%] rounded-full bg-secondary/[0.05] blur-[120px] pointer-events-none" />
      <div className="absolute top-[40%] right-[20%] w-[20%] h-[20%] rounded-full bg-primary-light/[0.04] blur-[100px] pointer-events-none" />

      {/* Landing Card */}
      <div className="w-full max-w-[440px] bg-surface/80 backdrop-blur-sm border border-border rounded-2xl p-8 sm:p-10 shadow-lg flex flex-col gap-8 relative z-10 animate-landing-enter">
        
        {/* Logo + Badge */}
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="relative">
            <img 
              src="/IML LOGO H-C.png" 
              alt="IML Group" 
              className="w-20 h-20 object-contain block"
            />
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/[0.08] border border-primary/[0.15] text-primary text-[10px] font-bold font-display rounded-full tracking-widest uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Secure Access
            </div>

            <h1 className="text-[1.65rem] sm:text-3xl font-display font-extrabold text-text-primary tracking-tight leading-[1.15]">
              Logistics &amp; Campaign<br className="hidden sm:block" /> Asset Portal
            </h1>

            <p className="text-text-secondary text-sm leading-relaxed max-w-[320px]">
              Track promoter assignments, serialized SIM cards, uniforms, retail POSM stands, and inventory transfers across the UAE.
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 py-4 border-y border-border/60">
          <div className="flex flex-col items-center gap-1">
            <Package size={16} className="text-primary/60" />
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Inventory</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <MapPin size={16} className="text-secondary/60" />
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">UAE-wide</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Users size={16} className="text-primary/60" />
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Promoters</span>
          </div>
        </div>

        {/* CTA */}
        <div className="flex flex-col items-center gap-4">
          <Link 
            href="/dashboard" 
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25 transition-all duration-200 group"
          >
            <span>Access Dashboard</span>
            <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform duration-200" />
          </Link>

          <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
            <Lock size={10} className="flex-shrink-0" />
            <span>Authorized IML Logistics personnel only</span>
          </div>
        </div>
      </div>

      {/* Bottom attribution */}
      <div className="absolute bottom-6 left-0 right-0 text-center text-[10px] text-text-muted/60 font-medium tracking-wide">
        © 2026 The IML Group. All rights reserved.
      </div>
    </div>
  );
}
