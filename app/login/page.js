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

    const result = await signIn('credentials', {
      redirect: false,
      username,
      password,
    });

    if (result?.error) {
      setError('Access Denied. Invalid credentials.');
      setLoading(false);
    } else {
      router.push('/dashboard');
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-background to-secondary/5 animate-fade-in">
      <div className="w-full max-w-[400px] flex flex-col gap-6">
        
        {/* Centered Brand Logo and Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <img 
            src="/IML LOGO H-C.png" 
            alt="IML Group Logo" 
            className="w-14 h-14 object-contain mb-1 block" 
          />
          <h1 className="text-xl font-display font-extrabold text-text-primary tracking-tight leading-tight">
            The IML Group
          </h1>
          <p className="text-[10px] font-bold tracking-widest text-secondary uppercase bg-secondary/10 px-2.5 py-0.5 rounded-full">
            Inventory Management Portal
          </p>
        </div>

        {/* Centered Glassmorphic Login Form Card */}
        <div className="bg-surface/65 backdrop-blur-md border border-border/80 rounded-2xl p-6 sm:p-8 shadow-2xl flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-display font-extrabold text-text-primary">
              Welcome back
            </h2>
            <p className="text-xs text-text-secondary">
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

          <p className="text-[10px] text-text-muted text-center">
            Authorized admin access only
          </p>
        </div>

        {/* Stacked Description & Copyright Notice Footer */}
        <div className="flex flex-col items-center text-center gap-4 mt-2 px-2">
          <p className="text-xs text-text-secondary leading-relaxed max-w-[320px]">
            Manage your marketing inventory, track stock movements, and coordinate retail operations across the UAE.
          </p>
          
          <div className="w-8 h-px bg-border/60" />
          
          <p className="text-[10px] text-text-muted">
            © {new Date().getFullYear()} The IML Group. All rights reserved.
          </p>
        </div>

      </div>
    </div>
  );
}
