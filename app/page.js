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
    <div className="relative min-h-[100dvh] overflow-hidden flex flex-col lg:flex-row" style={{ background: 'var(--bg-base)' }}>
      
      {/* ═══════ LEFT: Bold Visual Identity Panel ═══════ */}
      <div className="relative w-full lg:w-[55%] min-h-[40vh] lg:min-h-[100dvh] overflow-hidden flex flex-col justify-between p-8 sm:p-12 lg:p-16">
        
        {/* Deep gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a4d47] via-[#0f766e] to-[#0d9488]" />
        
        {/* Geometric pattern overlay — logistics flow lines */}
        <div className="absolute inset-0 opacity-[0.07]">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            {/* Horizontal flow lines */}
            <line x1="0" y1="20%" x2="100%" y2="20%" stroke="white" strokeWidth="1" strokeDasharray="8,12" />
            <line x1="0" y1="40%" x2="100%" y2="40%" stroke="white" strokeWidth="1" strokeDasharray="8,12" />
            <line x1="0" y1="60%" x2="100%" y2="60%" stroke="white" strokeWidth="1" strokeDasharray="8,12" />
            <line x1="0" y1="80%" x2="100%" y2="80%" stroke="white" strokeWidth="1" strokeDasharray="8,12" />
            {/* Vertical flow lines */}
            <line x1="20%" y1="0" x2="20%" y2="100%" stroke="white" strokeWidth="1" strokeDasharray="8,12" />
            <line x1="40%" y1="0" x2="40%" y2="100%" stroke="white" strokeWidth="1" strokeDasharray="8,12" />
            <line x1="60%" y1="0" x2="60%" y2="100%" stroke="white" strokeWidth="1" strokeDasharray="8,12" />
            <line x1="80%" y1="0" x2="80%" y2="100%" stroke="white" strokeWidth="1" strokeDasharray="8,12" />
            {/* Diagonal supply chain paths */}
            <line x1="10%" y1="15%" x2="90%" y2="85%" stroke="white" strokeWidth="1.5" strokeDasharray="4,16" />
            <line x1="90%" y1="15%" x2="10%" y2="85%" stroke="white" strokeWidth="1.5" strokeDasharray="4,16" />
            {/* Node dots at intersections */}
            <circle cx="20%" cy="20%" r="3" fill="white" opacity="0.5" />
            <circle cx="40%" cy="40%" r="3" fill="white" opacity="0.5" />
            <circle cx="60%" cy="60%" r="3" fill="white" opacity="0.5" />
            <circle cx="80%" cy="80%" r="3" fill="white" opacity="0.5" />
            <circle cx="20%" cy="80%" r="3" fill="white" opacity="0.5" />
            <circle cx="80%" cy="20%" r="3" fill="white" opacity="0.5" />
          </svg>
        </div>

        {/* Floating ambient orbs */}
        <div className="absolute top-[10%] right-[15%] w-64 h-64 rounded-full bg-white/[0.04] blur-[80px] pointer-events-none" />
        <div className="absolute bottom-[20%] left-[10%] w-48 h-48 rounded-full bg-[#14b8a6]/[0.15] blur-[60px] pointer-events-none" />

        {/* Content */}
        <div className="relative z-10 flex flex-col">
          {/* Logo */}
          <div className="animate-landing-enter">
            <img 
              src="/IML LOGO H-C.png" 
              alt="IML Group" 
              className="w-16 h-16 sm:w-20 sm:h-20 object-contain block brightness-0 invert"
            />
          </div>

          {/* Headline */}
          <div className="mt-10 sm:mt-16 lg:mt-20 max-w-lg animate-landing-enter" style={{ animationDelay: '0.1s' }}>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-[3.5rem] font-display font-extrabold text-white tracking-tight leading-[1.1]">
              Track every<br />
              asset across<br />
              the UAE.
            </h1>
            <p className="mt-5 text-sm sm:text-base text-white/60 leading-relaxed max-w-md">
              Real-time inventory intelligence for logistics teams — from warehouse to storefront.
            </p>
          </div>

          {/* Flow indicators */}
          <div className="mt-10 sm:mt-14 flex flex-col gap-3 animate-landing-enter" style={{ animationDelay: '0.2s' }}>
            {[
              { icon: ArrowDownLeft, text: 'Receive stock at warehouse', color: 'text-emerald-300' },
              { icon: ArrowUpRight, text: 'Dispatch to stores & staff', color: 'text-white' },
              { icon: RefreshCw, text: 'Track returns & rebrands', color: 'text-amber-300' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center ${item.color}`}>
                  <item.icon size={16} />
                </div>
                <span className="text-xs sm:text-sm text-white/50 font-medium">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom stats strip */}
        <div className="relative z-10 mt-12 lg:mt-0 animate-landing-enter" style={{ animationDelay: '0.3s' }}>
          <div className="flex items-center gap-6 sm:gap-10">
            {[
              { value: '7', label: 'UAE Regions' },
              { value: '24/7', label: 'Live Tracking' },
              { value: '100%', label: 'Audit Trail' },
            ].map((stat, i) => (
              <div key={i} className="flex flex-col">
                <span className="text-xl sm:text-2xl font-display font-black text-white">{stat.value}</span>
                <span className="text-[10px] sm:text-[11px] text-white/40 font-semibold uppercase tracking-wider mt-0.5">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════ RIGHT: Access Panel ═══════ */}
      <div className="relative w-full lg:w-[45%] flex flex-col items-center justify-center p-8 sm:p-12 lg:p-16 bg-surface min-h-[60vh] lg:min-h-[100dvh]">
        
        {/* Subtle dot pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, var(--text-primary) 0.8px, transparent 0.8px)',
            backgroundSize: '20px 20px',
          }}
        />

        <div className="relative z-10 w-full max-w-[380px] flex flex-col gap-8 animate-landing-enter" style={{ animationDelay: '0.2s' }}>
          
          {/* Welcome badge */}
          <div className="flex flex-col items-center text-center gap-5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/[0.08] border border-primary/[0.15] text-primary text-[10px] font-bold rounded-full tracking-widest uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Secure Portal
            </div>

            <div className="flex flex-col gap-2">
              <h2 className="text-xl sm:text-2xl font-display font-extrabold text-text-primary tracking-tight">
                Logistics &amp; Campaign<br /> Asset Portal
              </h2>
              <p className="text-text-secondary text-sm leading-relaxed max-w-xs mx-auto">
                Access your inventory dashboard to manage stock, track shipments, and coordinate operations.
              </p>
            </div>
          </div>

          {/* CTA Button */}
          <div className="flex flex-col items-center gap-4">
            <Link 
              href="/dashboard" 
              className="w-full inline-flex items-center justify-center gap-2.5 px-7 py-4 bg-primary hover:bg-primary-hover text-white font-bold text-sm rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-200 group"
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

          {/* Mini feature pills */}
          <div className="flex flex-wrap justify-center gap-2">
            {[
              { icon: Package, text: 'Stock Tracking' },
              { icon: MapPin, text: 'Multi-Region' },
              { icon: Users, text: 'Promoter Management' },
            ].map((feat, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface-elevated border border-border rounded-lg text-[10px] font-bold text-text-secondary">
                <feat.icon size={10} className="text-primary" />
                {feat.text}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom attribution */}
        <div className="absolute bottom-6 left-0 right-0 text-center text-[10px] text-text-muted/60 font-medium tracking-wide">
          © 2026 The IML Group. All rights reserved.
        </div>
      </div>
    </div>
  );
}
