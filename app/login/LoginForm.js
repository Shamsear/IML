'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Lock, User, Loader2, Eye, EyeOff, HelpCircle, ArrowDownLeft, ArrowUpRight, RefreshCw } from 'lucide-react';

export default function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await signIn('credentials', {
        redirect: false,
        username,
        password,
      });

      if (result?.error) {
        setError('Access Denied. Invalid credentials.');
        setLoading(false);
      } else if (result?.ok) {
        await router.push('/dashboard');
        setLoading(false);
      } else {
        setError('Login failed. Please try again.');
        setLoading(false);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Network error. Check your connection and try again.');
      setLoading(false);
    }
  };

  return (
    <div className="relative h-[100dvh] overflow-hidden flex flex-col lg:flex-row animate-fade-in" style={{ background: 'var(--bg-base)' }}>
      
      {/* ═══════ LEFT: Teal Identity Panel ═══════ */}
      <div className="relative hidden lg:flex w-full lg:w-[55%] h-[45vh] lg:h-full overflow-hidden flex-col justify-between p-5 sm:p-8 lg:px-14 lg:py-8">
        
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
            <div className="animate-login-slide-in">
              <img 
                src="/IML LOGO H-C.png" 
                alt="IML Group" 
                className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 object-contain block brightness-0 invert"
              />
            </div>

            <div className="mt-5 sm:mt-8 lg:mt-10 max-w-lg animate-login-slide-in" style={{ animationDelay: '0.1s' }}>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-[2.75rem] font-display font-extrabold text-white tracking-tight leading-[1.1]">
                Welcome<br />
                back.
              </h1>
              <p className="mt-3 text-xs sm:text-sm text-white/60 leading-relaxed max-w-md">
                Sign in to access your inventory dashboard and manage operations across the UAE.
              </p>
            </div>
          </div>

          {/* Middle: Flow indicators */}
          <div className="my-4 sm:my-6 flex flex-col gap-2 animate-login-slide-in" style={{ animationDelay: '0.2s' }}>
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
          <div className="animate-login-slide-in" style={{ animationDelay: '0.3s' }}>
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

      {/* ═══════ RIGHT: Login Form Panel ═══════ */}
      <div className="relative w-full lg:w-[45%] h-full flex flex-col items-center justify-center p-5 sm:p-8 lg:p-12 bg-surface">
        
        {/* Subtle dot pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, var(--text-primary) 0.8px, transparent 0.8px)',
            backgroundSize: '20px 20px',
          }}
        />

        <div className="relative z-10 w-full max-w-[340px] flex flex-col gap-5 animate-form-fade-up">
          
          {/* Welcome badge */}
          <div className="flex flex-col items-center text-center gap-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/[0.08] border border-primary/[0.15] text-primary text-[10px] font-bold rounded-full tracking-widest uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Secure Portal
            </div>

            <div className="flex flex-col gap-1.5">
              <h2 className="text-lg sm:text-xl font-display font-extrabold text-text-primary tracking-tight">
                Sign in to your account
              </h2>
              <p className="text-text-secondary text-xs leading-relaxed max-w-xs mx-auto">
                Enter your credentials to access the inventory dashboard.
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            {error && (
              <div className="bg-danger/[0.08] border border-danger/20 text-danger rounded-xl p-2.5 text-xs font-semibold text-center animate-slide-down">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-secondary">Username</label>
              <div className="relative flex items-center group">
                <User size={14} className="absolute left-3 text-text-muted group-focus-within:text-primary pointer-events-none transition-colors duration-200" />
                <input
                  type="text"
                  className="w-full bg-surface-elevated text-text-primary placeholder:text-text-muted border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/[0.08] transition-all duration-200"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  required
                  disabled={loading}
                  autoFocus
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-secondary">Password</label>
              <div className="relative flex items-center group">
                <Lock size={14} className="absolute left-3 text-text-muted group-focus-within:text-primary pointer-events-none transition-colors duration-200" />
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full bg-surface-elevated text-text-primary placeholder:text-text-muted border border-border rounded-xl pl-9 pr-10 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/[0.08] transition-all duration-200"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-text-muted hover:text-text-secondary hover:bg-surface-hover rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer z-10"
                  disabled={loading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 mt-1 px-6 py-3 bg-primary hover:bg-primary-hover text-white font-bold text-sm rounded-xl shadow-lg shadow-primary/15 hover:shadow-xl hover:shadow-primary/25 transition-all duration-200"
              disabled={loading}
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
            </button>
          </form>

          {/* Divider */}
          <div className="h-px bg-border/60" />

          {/* Helper */}
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-text-muted">
            <HelpCircle size={11} className="text-text-muted" />
            <span>Forgot password? Contact your IML administrator.</span>
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
