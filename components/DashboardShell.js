'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import DashboardNav from '@/components/DashboardNav';
import GlobalSearch from '@/components/GlobalSearch';
import PushSubscriptionBtn from '@/components/PushSubscriptionBtn';
import { PanelLeftClose, PanelLeftOpen, LogOut, Menu, X, Loader2 } from 'lucide-react';

export default function DashboardShell({ user, children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const pathname = usePathname();

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    
    // Show a brief message before redirecting
    setTimeout(() => {
      signOut({ callbackUrl: '/login' });
    }, 800); // Give user time to see the "Signing out..." message
  };

  return (
    <div className="h-[100dvh] overflow-hidden flex bg-background text-text-primary relative">
      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div 
          onClick={() => setMobileOpen(false)} 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
        />
      )}

      {/* Sidebar aside — width transitions, no overflow-hidden or transform on desktop */}
      <aside 
        className={`fixed inset-y-0 left-0 bg-surface z-50 flex flex-col transition-[width] duration-[130ms] ease-[cubic-bezier(0.2,0,0,1)] lg:static lg:h-full ${mobileOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'} ${collapsed ? 'lg:w-[72px]' : 'lg:w-64'}`}
      >
        {/* Logo area */}
        <div className="flex items-center justify-between px-4 h-14 sm:h-16 border-b border-border flex-shrink-0">
          <div className="flex items-center w-full min-w-0">
            {/* Full logo — fades */}
            <div className={`flex items-center gap-2 transition-opacity duration-150 ${(!collapsed || mobileOpen) ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} style={{ position: (!collapsed || mobileOpen) ? 'relative' : 'absolute' }}>
              <img 
                src="/IML LOGO V-C.png" 
                alt="IML Group Logo" 
                className="h-8 w-auto object-contain block max-w-[140px]" 
              />
              <span className="text-[9px] font-bold tracking-wider text-secondary uppercase bg-secondary/10 px-1.5 py-0.5 rounded-md">Admin</span>
            </div>
            {/* Compact logo — fades */}
            <img 
              src="/IML LOGO H-C.png" 
              alt="IML Group Emblem" 
              className={`w-9 h-9 object-contain block transition-opacity duration-150 ${(!collapsed || mobileOpen) ? 'opacity-0 pointer-events-none absolute' : 'opacity-100 mx-auto'}`}
            />
          </div>
          
          {/* Collapse sidebar trigger */}
          <div className="has-tooltip hidden lg:flex flex-shrink-0">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="flex items-center justify-center p-1.5 rounded-md hover:bg-surface-elevated text-text-secondary hover:text-text-primary transition-colors"
              type="button"
            >
              <span className="sr-only">{collapsed ? 'Expand sidebar' : 'Collapse sidebar'}</span>
              {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
            <span className="tooltip-box tooltip-right">{collapsed ? 'Expand sidebar' : 'Collapse sidebar'}</span>
          </div>
          
          {/* Close mobile drawer */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden flex items-center justify-center p-1.5 rounded-md hover:bg-surface-elevated text-text-secondary hover:text-text-primary transition-colors"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation list */}
        <div className={`sidebar-nav flex-1 overflow-y-auto py-4 px-3 transition-[padding] duration-[130ms] ease-[cubic-bezier(0.2,0,0,1)] ${collapsed && !mobileOpen ? 'px-2' : 'px-3'}`}>
          <DashboardNav collapsed={collapsed && !mobileOpen} />
        </div>

        {/* User Info footer inside sidebar */}
        <div className="sidebar-footer p-4 border-t border-border flex items-center justify-between gap-2 bg-surface-elevated/30 relative z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {user?.name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div className={`flex flex-col min-w-0 transition-opacity duration-200 ${(!collapsed || mobileOpen) ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
              <span className="text-xs font-semibold text-text-primary truncate whitespace-nowrap">{user?.name}</span>
              <span className="text-[10px] text-text-secondary truncate whitespace-nowrap">Administrator</span>
            </div>
          </div>
          <div className={`transition-opacity duration-200 ${(!collapsed || mobileOpen) ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className="has-tooltip">
              <button 
                type="button" 
                onClick={() => setShowLogoutModal(true)}
                className="p-2 rounded-md hover:bg-danger/10 hover:text-danger text-text-secondary transition-colors"
                aria-label="Sign Out"
              >
                <LogOut size={15} />
              </button>
              <span className="tooltip-box">Sign Out</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto border-l border-border">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 sm:gap-4 h-14 sm:h-16 px-3 sm:px-6 bg-surface/85 backdrop-blur-md border-b border-border">
          <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0 h-full">
            <button 
              className="lg:hidden p-2 rounded-md hover:bg-surface-elevated text-text-secondary hover:text-text-primary transition-colors flex-shrink-0" 
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <div className="flex-1 min-w-0 h-full flex items-center">
              <GlobalSearch />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0 h-full">
            <PushSubscriptionBtn />
            <div className="hidden sm:block h-6 w-px bg-border" />
            <div className="hidden sm:flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-xs">
                {user?.name?.charAt(0)?.toUpperCase() || 'A'}
              </div>
              <span className="text-sm font-medium text-text-primary">{user?.name}</span>
            </div>
          </div>
        </header>

        {/* Page children wrapped in standard container */}
        <main className="flex-1 overflow-x-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
            {children}
          </div>
        </main>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-[380px] shadow-2xl flex flex-col gap-4 animate-slide-down">
            <div className="flex flex-col gap-1.5 text-center sm:text-left">
              <h3 className="font-display font-extrabold text-base text-text-primary">
                {isSigningOut ? 'Signing Out...' : 'Confirm Sign Out'}
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                {isSigningOut 
                  ? 'Please wait while we securely sign you out...' 
                  : 'Are you sure you want to sign out? You will need to enter your admin credentials again to access the portal.'
                }
              </p>
            </div>
            
            {!isSigningOut && (
              <div className="flex gap-2.5 mt-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowLogoutModal(false)}
                  className="flex-1 sm:flex-initial px-4 py-2 border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex-1 sm:flex-initial px-4 py-2 bg-danger hover:bg-danger-hover text-white rounded-lg text-xs font-bold shadow-md transition-colors inline-flex items-center justify-center gap-2"
                >
                  <LogOut size={14} />
                  <span>Sign Out</span>
                </button>
              </div>
            )}

            {isSigningOut && (
              <div className="flex items-center justify-center gap-2 mt-2 text-primary">
                <Loader2 size={18} className="animate-spin" />
                <span className="text-xs font-semibold">Signing out...</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
