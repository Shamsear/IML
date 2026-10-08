import Link from 'next/link';
import { ArrowRight, Lock, Package, Users, MapPin, ArrowDownLeft, ArrowUpRight, RefreshCw, ShieldCheck } from 'lucide-react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect('/dashboard');
  }

  return (
    <div className="relative min-h-[100dvh] lg:h-[100dvh] overflow-y-auto lg:overflow-hidden flex flex-col lg:flex-row bg-background" style={{ background: 'var(--bg-base)' }}>
      
      {/* ═══════ LEFT: Bold Visual Identity Panel ═══════ */}
      <div className="relative w-full lg:w-[52%] xl:w-[55%] min-h-[380px] lg:min-h-full overflow-hidden flex flex-col justify-between p-6 sm:p-10 lg:px-14 lg:py-10 flex-shrink-0">
        
        {/* Deep gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#083e39] via-[#0f766e] to-[#0d9488]" />
        
        {/* Geometric pattern overlay */}
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <line x1="0" y1="25%" x2="100%" y2="25%" stroke="white" strokeWidth="1" strokeDasharray="8,12" />
            <line x1="0" y1="50%" x2="100%" y2="50%" stroke="white" strokeWidth="1" strokeDasharray="8,12" />
            <line x1="0" y1="75%" x2="100%" y2="75%" stroke="white" strokeWidth="1" strokeDasharray="8,12" />
            <line x1="25%" y1="0" x2="25%" y2="100%" stroke="white" strokeWidth="1" strokeDasharray="8,12" />
            <line x1="50%" y1="0" x2="50%" y2="100%" stroke="white" strokeWidth="1" strokeDasharray="8,12" />
            <line x1="75%" y1="0" x2="75%" y2="100%" stroke="white" strokeWidth="1" strokeDasharray="8,12" />
            <circle cx="25%" cy="25%" r="3" fill="white" opacity="0.5" />
            <circle cx="75%" cy="75%" r="3" fill="white" opacity="0.5" />
          </svg>
        </div>

        {/* Ambient decorative blur */}
        <div className="absolute top-[10%] right-[15%] w-48 h-48 rounded-full bg-white/[0.04] blur-[60px] pointer-events-none" />
        <div className="absolute bottom-[20%] left-[10%] w-36 h-36 rounded-full bg-[#14b8a6]/[0.15] blur-[50px] pointer-events-none" />

        {/* Content Container */}
        <div className="relative z-10 flex flex-col justify-between h-full gap-6 sm:gap-8">
          
          {/* Top: Logo + Headline */}
          <div>
            <div className="inline-flex items-center gap-3">
              <img 
                src="/IML LOGO H-C.png" 
                alt="IML Group" 
                className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 object-contain block brightness-0 invert"
              />
              <span className="text-xs sm:text-sm font-display font-bold uppercase tracking-widest text-white/80">
                Logistics Hub
              </span>
            </div>

            <div className="mt-4 sm:mt-6 lg:mt-8 max-w-lg">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-[2.6rem] font-display font-black text-white tracking-tight leading-[1.15]">
                Track every asset<br className="hidden sm:inline" /> across the UAE.
              </h1>
              <p className="mt-2.5 sm:mt-3.5 text-xs sm:text-sm text-white/70 leading-relaxed max-w-md">
                Real-time inventory intelligence for warehouse stock, store dispatches, and campaign logistics.
              </p>
            </div>
          </div>

          {/* Middle: Key Flow Highlights (compact on mobile) */}
          <div className="flex flex-col gap-2 sm:gap-2.5 my-auto py-2">
            {[
              { icon: ArrowDownLeft, text: 'Instant warehouse inbound & scanning', color: 'text-emerald-300' },
              { icon: ArrowUpRight, text: 'Dispatch to stores, promoters & staff', color: 'text-white' },
              { icon: RefreshCw, text: 'Automated returns, damages & rebrands', color: 'text-amber-300' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 ${item.color}`}>
                  <item.icon size={13} />
                </div>
                <span className="text-[11px] sm:text-xs text-white/75 font-medium">{item.text}</span>
              </div>
            ))}
          </div>

          {/* Bottom: Region & Audit Metrics */}
          <div className="pt-2 border-t border-white/10">
            <div className="grid grid-cols-3 gap-3 sm:gap-6">
              {[
                { value: '7', label: 'UAE Emirates' },
                { value: '24/7', label: 'Live Audit' },
                { value: '100%', label: 'Traceability' },
              ].map((stat, i) => (
                <div key={i} className="flex flex-col">
                  <span className="text-base sm:text-xl font-display font-black text-white">{stat.value}</span>
                  <span className="text-[9px] sm:text-[10px] text-white/50 font-semibold uppercase tracking-wider mt-0.5">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ RIGHT: Portal Access Panel ═══════ */}
      <div className="relative w-full lg:w-[48%] xl:w-[45%] flex-1 flex flex-col items-center justify-center p-6 sm:p-10 lg:p-12 bg-surface">
        
        {/* Subtle dot pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, var(--text-primary) 0.8px, transparent 0.8px)',
            backgroundSize: '20px 20px',
          }}
        />

        <div className="relative z-10 w-full max-w-[360px] flex flex-col gap-5 sm:gap-6 my-auto">
          
          {/* Welcome badge & Title */}
          <div className="flex flex-col items-center text-center gap-2.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/[0.08] border border-primary/[0.15] text-primary text-[10px] font-bold rounded-full tracking-widest uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Authorized Access
            </div>

            <h2 className="text-xl sm:text-2xl font-display font-extrabold text-text-primary tracking-tight">
              Warehouse Portal
            </h2>
            <p className="text-text-secondary text-xs sm:text-sm leading-relaxed max-w-xs mx-auto">
              Sign in to manage stock levels, issue delivery notes, and coordinate distribution teams.
            </p>
          </div>

          {/* Action CTA Button */}
          <div className="flex flex-col items-center gap-3 w-full">
            <Link 
              href="/login" 
              className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-3.5 sm:py-4 bg-primary hover:bg-primary-hover active:scale-[0.99] text-white font-bold text-sm sm:text-base rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/35 transition-all duration-200 group cursor-pointer"
            >
              <span>Sign In to Dashboard</span>
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform duration-200" />
            </Link>

            <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
              <Lock size={11} className="flex-shrink-0 text-text-muted" />
              <span>Restricted to authorized logistics personnel</span>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-border/60 w-full" />

          {/* Feature Pills */}
          <div className="flex flex-wrap justify-center gap-2">
            {[
              { icon: Package, text: 'Inventory Control' },
              { icon: MapPin, text: 'Multi-Store' },
              { icon: Users, text: 'Promoters' },
              { icon: ShieldCheck, text: 'Secure Audit' },
            ].map((feat, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface-elevated border border-border rounded-lg text-[10px] sm:text-[11px] font-semibold text-text-secondary">
                <feat.icon size={11} className="text-primary" />
                {feat.text}
              </span>
            ))}
          </div>
        </div>

        {/* Footer Attribution */}
        <div className="w-full text-center text-[10px] text-text-muted/60 font-medium tracking-wide mt-6 lg:mt-auto pt-2">
          © 2026 The IML Group. All rights reserved.
        </div>
      </div>
    </div>
  );
}
