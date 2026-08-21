'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Lock, User, Loader2, Eye, EyeOff, HelpCircle, Package, MapPin, Users } from 'lucide-react';

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
      const startTime = performance.now();

      const result = await signIn('credentials', {
        redirect: false,
        username,
        password,
      });

      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔐 Login authentication took: ${duration}ms`);
      }

      if (result?.error) {
        setError('Access Denied. Invalid credentials.');
        setLoading(false);
      } else if (result?.ok) {
        await router.push('/dashboard');
        // Reset loading in case navigation fails
        setLoading(false);
      } else {
        // Unexpected response
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
    <div className="min-h-[100dvh] flex flex-col md:flex-row animate-fade-in" style={{ background: 'var(--bg-base)' }}>
      {/* Left Branding Panel */}
      <div className="hidden md:flex w-full md:w-[42%] relative border-r border-border overflow-hidden">
        {/* Rich gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.08] via-primary/[0.03] to-secondary/[0.05]" />
        
        {/* Subtle dot pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle, var(--text-primary) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex-1 flex flex-col justify-between p-10 lg:p-14">
          <div className="animate-login-slide-in">
            <img 
              src="/IML LOGO H-C.png" 
              alt="IML Group Logo" 
              className="w-14 h-14 object-contain block mb-10"
            />
            
            <h1 className="text-[1.75rem] lg:text-3xl font-display font-extrabold text-text-primary tracking-tight leading-[1.15]">
              IML Group
            </h1>
            <p className="text-sm font-semibold text-text-secondary mt-1.5">
              Inventory Management Portal
            </p>

            {/* Accent divider */}
            <div className="h-[3px] w-10 bg-gradient-to-r from-primary to-primary-light rounded-full my-7" />

            <p className="text-sm text-text-secondary leading-relaxed max-w-xs">
              Manage your marketing inventory, track stock movements, and coordinate retail operations across the UAE.
            </p>

            {/* Capability chips */}
            <div className="flex flex-wrap gap-2 mt-7">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface/80 border border-border rounded-lg text-[10px] font-bold text-text-secondary">
                <Package size={10} className="text-primary" /> Stock Tracking
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface/80 border border-border rounded-lg text-[10px] font-bold text-text-secondary">
                <MapPin size={10} className="text-secondary" /> Multi-Region
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface/80 border border-border rounded-lg text-[10px] font-bold text-text-secondary">
                <Users size={10} className="text-primary" /> Promoter Management
              </span>
            </div>
          </div>

          <div className="text-[10px] text-text-muted mt-8 tracking-wide">
            © 2026 The IML Group. All rights reserved.
          </div>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="flex-1 bg-surface flex flex-col items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[360px] flex flex-col gap-7 animate-form-fade-up">
          {/* Mobile Branding */}
          <div className="md:hidden flex flex-col items-center mb-1">
            <img 
              src="/IML LOGO H-C.png" 
              alt="IML Group Logo" 
              className="w-14 h-14 object-contain mb-3"
            />
            <h1 className="text-2xl font-display font-extrabold text-text-primary tracking-tight">
              IML Group
            </h1>
            <span className="text-[10px] font-bold tracking-wider text-primary uppercase bg-primary/[0.08] border border-primary/[0.12] px-2 py-0.5 rounded-full mt-2">
              Admin Portal
            </span>
          </div>

          {/* Welcome */}
          <div>
            <h2 className="text-2xl font-display font-extrabold text-text-primary tracking-tight">
              Welcome back
            </h2>
            <p className="text-sm text-text-secondary mt-1">
              Sign in to your admin account
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="bg-danger/[0.08] border border-danger/20 text-danger rounded-xl p-3 text-xs font-semibold text-center animate-slide-down">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-secondary">Username</label>
              <div className="relative flex items-center group">
                <User size={15} className="absolute left-3.5 text-text-muted group-focus-within:text-primary pointer-events-none transition-colors duration-200" />
                <input
                  type="text"
                  className="w-full bg-surface-elevated text-text-primary placeholder:text-text-muted border border-border rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/[0.08] transition-all duration-200"
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
                <Lock size={15} className="absolute left-3.5 text-text-muted group-focus-within:text-primary pointer-events-none transition-colors duration-200" />
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full bg-surface-elevated text-text-primary placeholder:text-text-muted border border-border rounded-xl pl-10 pr-12 py-3 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/[0.08] transition-all duration-200"
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
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-text-muted hover:text-text-secondary hover:bg-surface-hover rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer z-10"
                  disabled={loading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 mt-1 px-5 py-3 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-xl shadow-lg shadow-primary/15 hover:shadow-xl hover:shadow-primary/20 transition-all duration-200 group"
              disabled={loading}
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
            </button>
          </form>

          {/* Helper */}
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-text-muted border-t border-border/60 pt-4">
            <HelpCircle size={11} className="text-text-muted" />
            <span>Forgot password? Contact your IML administrator.</span>
          </div>

          {/* Mobile Footer */}
          <div className="md:hidden flex flex-col gap-3 mt-2 pt-4 border-t border-border/60 text-center">
            <p className="text-[11px] text-text-secondary leading-relaxed px-2">
              Manage marketing inventory, track stock movements, and coordinate retail operations across the UAE.
            </p>
            <span className="text-[10px] text-text-muted">
              © 2026 The IML Group. All rights reserved.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
