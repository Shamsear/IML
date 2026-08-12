'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Lock, User, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Performance monitoring
    const startTime = performance.now();

    const result = await signIn('credentials', {
      redirect: false,
      username,
      password,
    });

    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);
    
    // Log performance for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔐 Login authentication took: ${duration}ms`);
    }

    if (result?.error) {
      setError('Access Denied. Invalid credentials.');
      setLoading(false);
    } else {
      router.push('/dashboard');
      // router.refresh(); // Removed: causes extra server round-trip
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Left Branding Panel (visible only on desktop) */}
      <div className="hidden md:flex w-full md:w-[40%] bg-gradient-to-br from-primary/10 via-background to-secondary/5 border-r border-border p-8 md:p-12 flex-col justify-between">
        <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
          <img 
            src="/IML LOGO H-C.png" 
            alt="IML Group Logo" 
            className="w-16 h-16 object-contain mb-8 block" 
          />
          <h1 className="text-3xl font-display font-extrabold text-text-primary tracking-tight leading-tight">
            IML Group
          </h1>
          <p className="text-sm font-semibold text-text-secondary mt-1">
            Inventory Management Portal
          </p>
          <div className="w-12 h-1 bg-primary/30 rounded-full my-6" />
          <p className="text-sm text-text-secondary leading-relaxed">
            Manage your marketing inventory, track stock movements, and coordinate
            retail operations across the UAE.
          </p>
        </div>
        <div className="text-xs text-text-muted mt-8 text-center md:text-left">
          <span>© 2026 The IML Group. All rights reserved.</span>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="flex-1 bg-surface flex flex-col items-center justify-center p-8 sm:p-12">
        <div className="w-full max-w-[360px] flex flex-col gap-6">
          {/* Mobile Header Branding (visible only on mobile) */}
          <div className="md:hidden flex flex-col items-center mb-2">
            <img 
              src="/IML LOGO H-C.png" 
              alt="IML Group Logo" 
              className="w-14 h-14 object-contain mb-3" 
            />
            <h1 className="text-2xl font-display font-extrabold text-text-primary tracking-tight">
              IML Group
            </h1>
            <span className="text-[10px] font-bold tracking-wider text-secondary uppercase bg-secondary/10 px-1.5 py-0.5 rounded mt-1.5">
              Admin Portal
            </span>
          </div>

          <div>
            <h2 className="text-2xl font-display font-extrabold text-text-primary tracking-tight">
              Welcome back
            </h2>
            <p className="text-sm text-text-secondary mt-1">
              Sign in to your admin account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="bg-danger/10 border border-danger/20 text-danger rounded-lg p-3 text-xs font-semibold text-center animate-slide-down">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-secondary">Username</label>
              <div className="relative flex items-center">
                <User size={16} className="absolute left-3 text-text-muted pointer-events-none" />
                <input
                  type="text"
                  className="w-full bg-surface-elevated text-text-primary placeholder:text-text-muted border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-secondary">Password</label>
              <div className="relative flex items-center">
                <Lock size={16} className="absolute left-3 text-text-muted pointer-events-none" />
                <input
                  type="password"
                  className="w-full bg-surface-elevated text-text-primary placeholder:text-text-muted border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 mt-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
              disabled={loading}
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
            </button>
          </form>

          <p className="text-xs text-text-muted text-center mt-2">
            Authorized admin access only
          </p>

          {/* Mobile Marketing & Copyright Info (visible only on mobile) */}
          <div className="md:hidden flex flex-col gap-4 mt-6 pt-5 border-t border-border/60 text-center">
            <p className="text-xs text-text-secondary leading-relaxed px-2">
              Manage your marketing inventory, track stock movements, and coordinate retail operations across the UAE.
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
