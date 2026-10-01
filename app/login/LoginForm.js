'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Lock, User, Loader2, Eye, EyeOff, HelpCircle, ArrowDownLeft, ArrowUpRight, RefreshCw } from 'lucide-react';
import { Morph } from 'cube-motion/react';

export default function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('[LoginForm] handleSubmit invoked with:', username, 'pass length:', password?.length);
    setLoading(true);
    setError('');

    try {
      const result = await signIn('credentials', {
        redirect: false,
        username,
        password,
      });

      console.log('[LoginForm] signIn result:', JSON.stringify(result));

      if (result?.error) {
        setError('Access Denied. Invalid credentials.');
        setLoading(false);
      } else if (result?.ok) {
        console.log('[LoginForm] Redirecting to /dashboard...');
        window.location.href = '/dashboard';
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
    <div className="relative h-[100dvh] overflow-hidden flex flex-col lg:flex-row bg-surface">
      
      {/* ═══════ LEFT: Identity Panel ═══════ */}
      <div className="relative hidden lg:flex w-full lg:w-[50%] h-full overflow-hidden flex-col justify-between p-8 lg:px-14 lg:py-12 bg-primary text-white">
        
        {/* Subtle geometric grid */}
        <div 
          className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col flex-1 justify-between">
          <div>
            <div>
              <img 
                src="/IML LOGO H-C.png" 
                alt="IML Group" 
                className="w-14 h-14 lg:w-16 lg:h-16 object-contain block brightness-0 invert"
              />
            </div>

            <div className="mt-12 max-w-lg">
              <h1 className="text-3xl lg:text-4xl xl:text-5xl font-display font-extrabold text-white tracking-tight leading-[1.1]">
                Inventory<br />
                Operations.
              </h1>
              <p className="mt-4 text-sm text-white/75 leading-relaxed max-w-md">
                Warehouse inventory tracking, receiving, dispatching, and audit controls across the UAE.
              </p>
            </div>
          </div>

          {/* Workflow badges */}
          <div className="flex flex-col gap-3 my-8">
            {[
              { icon: ArrowDownLeft, text: 'Inbound stock receiving & verification' },
              { icon: ArrowUpRight, text: 'Outbound dispatch to stores & field staff' },
              { icon: RefreshCw, text: 'Rebranding, returns & serial tracking' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center text-white/90">
                  <item.icon size={13} className="stroke-[2]" />
                </div>
                <span className="text-xs text-white/80 font-medium">{item.text}</span>
              </div>
            ))}
          </div>

          {/* Footer note */}
          <div className="text-xs text-white/50 font-medium">
            Internal Operations System · IML Group
          </div>
        </div>
      </div>

      {/* ═══════ RIGHT: Login Form Panel ═══════ */}
      <div className="relative w-full lg:w-[50%] h-full flex flex-col items-center justify-center p-6 sm:p-10 lg:p-14 bg-surface">
        <div className="relative z-10 w-full max-w-[340px] flex flex-col gap-6">
          
          <div className="flex flex-col gap-1.5 text-center lg:text-left">
            <h2 className="text-xl sm:text-2xl font-display font-extrabold text-text-primary tracking-tight">
              Sign In
            </h2>
            <p className="text-text-secondary text-xs leading-relaxed">
              Enter your credentials to access the operations dashboard.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="bg-danger/10 border border-danger/20 text-danger rounded-xl p-3 text-xs font-semibold flex items-center gap-2">
              <Lock size={14} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-secondary">Username</label>
              <div className="relative flex items-center group">
                <User size={14} className="absolute left-3 text-text-muted group-focus-within:text-primary pointer-events-none transition-colors" />
                <input
                  type="text"
                  className="w-full bg-surface-elevated text-text-primary placeholder:text-text-muted border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  required
                  disabled={loading}
                  autoComplete="username"
                  suppressHydrationWarning
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-secondary">Password</label>
              <div className="relative flex items-center group">
                <Lock size={14} className="absolute left-3 text-text-muted group-focus-within:text-primary pointer-events-none transition-colors" />
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full bg-surface-elevated text-text-primary placeholder:text-text-muted border border-border rounded-xl pl-9 pr-10 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  autoComplete="current-password"
                  suppressHydrationWarning
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-text-muted hover:text-text-secondary hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
                  disabled={loading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 mt-2 px-6 py-2.5 bg-primary hover:bg-primary-hover text-white font-bold text-sm rounded-xl shadow-xs hover:shadow transition-all duration-150 cursor-pointer disabled:opacity-70"
              disabled={loading}
            >
              <Morph
                active={loading}
                off={<span>Sign In</span>}
                on={
                  <span className="inline-flex items-center gap-2">
                    <Loader2 size={15} className="animate-spin" />
                    <span>Authenticating...</span>
                  </span>
                }
              />
            </button>
          </form>

          {/* Divider */}
          <div className="h-px bg-border/60" />

          {/* Helper */}
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-text-muted">
            <HelpCircle size={11} className="text-text-muted" />
            <span>Forgot credentials? Contact your IML administrator.</span>
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
