import Link from 'next/link';
import { ArrowRight, Lock, Package, Users, MapPin, ArrowDownLeft, ArrowUpRight, RefreshCw } from 'lucide-react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect('/dashboard');
  }

  return (
    <div className="relative h-[100dvh] overflow-hidden flex flex-col lg:flex-row" style={{ background: 'var(--bg-base)' }}>
      
      {/* ═══════ LEFT: Bold Visual Identity Panel ═══════ */}
      <div className="relative w-full lg:w-[55%] h-[45vh] lg:h-full overflow-hidden flex flex-col justify-between p-5 sm:p-8 lg:px-14 lg:py-8">
        
        {/* Deep gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a4d47] via-[#0f766e] to-[#0d9488]" />
        
        {/* Geometric pattern overlay */}
        <div className="absolute inset-0 opacity-[0.07]">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <line x1="0" y1="25%" x2="100%" y2="25%" stroke="white" strokeWidth="1" strokeDasharray="8,12" />
            <line x1="0" y1="50%" x2="100%" y2="50%" stroke="white" strokeWidth="1" strokeDasharray="8,12" />
            <line x1="0" y1="75%" x2="100%" y2="75%" stroke="white" strokeWidth="1" strokeDasharray="8,12" />
            <line x1="25%" y1="0" x2="25%" y2="100%" stroke="white" strokeWidth="1" strokeDasharray="8,12" />
            <line x1="50%" y1="0" x2="50%" y2="100%" stroke="white" strokeWidth="1" strokeDasharray="8,12" />
            <line x1="75%" y1="0" x2="75%" y2="100%" stroke="white" strokeWidth="1" strokeDasharray="8,12" />
            <line x1="10%" y1="20%" x2="90%" y2="80%" stroke="white" strokeWidth="1.5" strokeDasharray="4,16" />
            <line x1="90%" y1="20%" x2="10%" y2="80%" stroke="white" strokeWidth="1.5" strokeDasharray="4,16" />
            <circle cx="25%" cy="25%" r="3" fill="white" opacity="0.5" />
            <circle cx="50%" cy="50%" r="3" fill="white" opacity="0.5" />
            <circle cx="75%" cy="75%" r="3" fill="white" opacity="0.5" />
            <circle cx="25%" cy="75%" r="3" fill="white" opacity="0.5" />
            <circle cx="75%" cy="25%" r="3" fill="white" opacity="0.5" />
          </svg>
        </div>

        {/* Floating ambient orbs */}
        <div className="absolute top-[10%] right-[15%] w-48 h-48 rounded-full bg-white/[0.04] blur-[60px] pointer-events-none" />
        <div className="absolute bottom-[20%] left-[10%] w-36 h-36 rounded-full bg-[#14b8a6]/[0.15] blur-[50px] pointer-events-none" />

        {/* Content */}
        <div className="relative z-10 flex flex-col flex-1 justify-between">
          {/* Top: Logo + Headline */}
          <div>
            <div className="animate-landing-enter">
              <img 
                src="/IML LOGO H-C.png" 
                alt="IML Group" 
                className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 object-contain block brightness-0 invert"
              />
            </div>

            <div className="mt-5 sm:mt-8 lg:mt-10 max-w-lg animate-landing-enter" style={{ animationDelay: '0.1s' }}>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-[2.75rem] font-display font-extrabold text-white tracking-tight leading-[1.1]">
                Track every<br />
                asset across<br />
                the UAE.
              </h1>
              <p className="mt-3 text-xs sm:text-sm text-white/60 leading-relaxed max-w-md">
                Real-time inventory intelligence for logistics teams — from warehouse to storefront.
              </p>
            </div>
          </div>

          {/* Middle: Flow indicators */}
          <div className="my-4 sm:my-6 flex flex-col gap-2 animate-landing-enter" style={{ animationDelay: '0.2s' }}>
            {[
              { icon: ArrowDownLeft, text: 'Receive stock at warehouse', color: 'text-emerald-300' },
              { icon: ArrowUpRight, text: 'Dispatch to stores & staff', color: 'text-white' },
              { icon: RefreshCw, text: 'Track returns & rebrands', color: 'text-amber-300' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div className={`w-7 h-7 rounded-md bg-white/10 flex items-center justify-center ${item.color}`}>
                  <item.icon size={14} />
                </div>
                <span className="text-[11px] sm:text-xs text-white/50 font-medium">{item.text}</span>
              </div>
            ))}
          </div>

          {/* Bottom: Stats strip */}
          <div className="animate-landing-enter" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center gap-5 sm:gap-8">
              {[
                { value: '7', label: 'UAE Regions' },
                { value: '24/7', label: 'Live Tracking' },
                { value: '100%', label: 'Audit Trail' },
              ].map((stat, i) => (
                <div key={i} className="flex flex-col">
                  <span className="text-lg sm:text-xl font-display font-black text-white">{stat.value}</span>
                  <span className="text-[9px] sm:text-[10px] text-white/40 font-semibold uppercase tracking-wider mt-0.5">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ RIGHT: Access Panel ═══════ */}
      <div className="relative w-full lg:w-[45%] h-[55vh] lg:h-full flex flex-col items-center justify-center p-5 sm:p-8 lg:p-12 bg-surface">
        
        {/* Subtle dot pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, var(--text-primary) 0.8px, transparent 0.8px)',
            backgroundSize: '20px 20px',
          }}
        />

        <div className="relative z-10 w-full max-w-[340px] flex flex-col gap-5 animate-landing-enter" style={{ animationDelay: '0.2s' }}>
          
          {/* Welcome badge */}
          <div className="flex flex-col items-center text-center gap-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/[0.08] border border-primary/[0.15] text-primary text-[10px] font-bold rounded-full tracking-widest uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Secure Portal
            </div>

            <div className="flex flex-col gap-1.5">
              <h2 className="text-lg sm:text-xl font-display font-extrabold text-text-primary tracking-tight">
                Logistics &amp; Campaign Asset Portal
              </h2>
              <p className="text-text-secondary text-xs leading-relaxed max-w-xs mx-auto">
                Access your inventory dashboard to manage stock, track shipments, and coordinate operations.
              </p>
            </div>
          </div>

          {/* CTA Button */}
          <div className="flex flex-col items-center gap-3">
            <Link 
              href="/dashboard" 
              className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-3.5 bg-primary hover:bg-primary-hover text-white font-bold text-sm rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-200 group"
            >
              <span>Access Dashboard</span>
              <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform duration-200" />
            </Link>

            <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
              <Lock size={10} className="flex-shrink-0" />
              <span>Authorized IML Logistics personnel only</span>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-border/60" />

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-2">
            {[
              { icon: Package, text: 'Stock Tracking' },
              { icon: MapPin, text: 'Multi-Region' },
              { icon: Users, text: 'Promoters' },
            ].map((feat, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface-elevated border border-border rounded-lg text-[10px] font-bold text-text-secondary">
                <feat.icon size={10} className="text-primary" />
                {feat.text}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom attribution */}
        <div className="absolute bottom-4 left-0 right-0 text-center text-[10px] text-text-muted/60 font-medium tracking-wide">
          © 2026 The IML Group. All rights reserved.
        </div>
      </div>
    </div>
  );
}
