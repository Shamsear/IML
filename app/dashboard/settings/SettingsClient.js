'use client';

import React, { useState } from 'react';
import { Settings, ShieldCheck, Database, Image, Bell, Info, Trash2, CheckCircle2 } from 'lucide-react';

export default function SettingsClient({ config, user }) {
  const [cacheStatus, setCacheStatus] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleClearCache = async () => {
    setCacheStatus('Clearing...');
    try {
      // Clear Service Worker Caches
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) {
          await registration.unregister();
        }
        
        if ('caches' in window) {
          const keys = await caches.keys();
          for (let key of keys) {
            await caches.delete(key);
          }
        }
      }
      
      // Clear LocalStorage
      localStorage.clear();
      
      setCacheStatus('Cleared!');
      setSuccessMsg('Service worker registrations and client asset cache cleared successfully!');
      setTimeout(() => {
        setCacheStatus('');
        setSuccessMsg('');
      }, 3000);
    } catch (e) {
      console.error(e);
      setCacheStatus('Failed');
    }
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 font-sans">
      <header className="pb-5 border-b border-border">
        <h1 className="text-3xl font-display font-extrabold text-text-primary tracking-tight">
          System Control &amp; Settings
        </h1>
        <p className="text-text-secondary text-sm mt-1">
          Review application parameters, cloud system integrations, and client caches
        </p>
      </header>

      {successMsg && (
        <div className="bg-success/10 border border-success/20 text-success rounded-lg p-4 text-xs font-semibold flex items-center gap-2.5 animate-slide-down">
          <CheckCircle2 size={15} />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        
        {/* Left Side: Navigation Info */}
        <div className="md:col-span-1 flex flex-col gap-4">
          <div className="bg-surface border border-border p-5 rounded-2xl shadow-sm">
            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">Settings Panel</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              These settings represent system integrations configured on the Next.js runtime environment. Passwords and keys are protected server-side and cannot be accessed from client browsers.
            </p>
          </div>
          
          <div className="bg-surface border border-border p-5 rounded-2xl shadow-sm flex flex-col gap-3">
            <span className="text-2xs uppercase font-bold text-text-muted">Security Policy</span>
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="text-success flex-shrink-0" size={18} />
              <div className="min-w-0">
                <span className="text-xs font-bold text-text-primary block">SSL Connection Enforced</span>
                <span className="text-[11px] text-text-secondary block mt-0.5 leading-relaxed">
                  All databases and ImageKit interactions require secure transport layer channels.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Configuration Blocks */}
        <div className="md:col-span-2 flex flex-col gap-6">
          
          {/* Cloud Database Integration */}
          <div className="bg-surface border border-border p-6 rounded-2xl shadow-sm flex flex-col gap-4">
            <h3 className="font-display font-bold text-base text-text-primary flex items-center gap-2 pb-2 border-b border-border">
              <Database size={18} className="text-primary" />
              <span>Neon Cloud Database</span>
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-text-secondary block">Connection Status</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-success/10 text-success text-[10px] font-bold rounded-md mt-1 border border-success/20">
                  Connected
                </span>
              </div>
              
              <div>
                <span className="text-[10px] uppercase font-bold text-text-secondary block">Database Provider</span>
                <span className="text-xs text-text-primary block font-semibold mt-1">Neon serverless PostgreSQL</span>
              </div>

              <div className="sm:col-span-2">
                <span className="text-[10px] uppercase font-bold text-text-secondary block">Endpoint Host</span>
                <span className="text-xs text-text-primary block font-mono bg-surface-elevated/40 p-2 border border-border rounded mt-1 truncate">
                  {config.databaseHost}
                </span>
              </div>
            </div>
          </div>

          {/* ImageKit Cloud Storage */}
          <div className="bg-surface border border-border p-6 rounded-2xl shadow-sm flex flex-col gap-4">
            <h3 className="font-display font-bold text-base text-text-primary flex items-center gap-2 pb-2 border-b border-border">
              <Image size={18} className="text-secondary" />
              <span>ImageKit CDN Storage</span>
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-text-secondary block">Integrations Status</span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-md mt-1 border
                  ${config.imageKitStatus === 'Configured' ? 'bg-success/10 text-success border-success/20' : 'bg-danger/10 text-danger border-danger/20'}
                `}>
                  {config.imageKitStatus === 'Configured' ? 'Active' : 'Missing Credentials'}
                </span>
              </div>

              <div className="sm:col-span-2">
                <span className="text-[10px] uppercase font-bold text-text-secondary block">URL CDN Endpoint</span>
                <span className="text-xs text-text-primary block font-mono bg-surface-elevated/40 p-2 border border-border rounded mt-1 truncate">
                  {config.imageKitEndpoint}
                </span>
              </div>
            </div>
          </div>

          {/* Web Push Notifications */}
          <div className="bg-surface border border-border p-6 rounded-2xl shadow-sm flex flex-col gap-4">
            <h3 className="font-display font-bold text-base text-text-primary flex items-center gap-2 pb-2 border-b border-border">
              <Bell size={18} className="text-primary animate-pulse" />
              <span>Web Push Notifications</span>
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-text-secondary block">Credentials Status</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-success/10 text-success text-[10px] font-bold rounded-md mt-1 border border-success/20">
                  {config.vapidStatus}
                </span>
              </div>

              <div className="sm:col-span-2">
                <span className="text-[10px] uppercase font-bold text-text-secondary block">PWA VAPID Public Key</span>
                <span className="text-[10px] text-text-primary block font-mono bg-surface-elevated/40 p-2 border border-border rounded mt-1 break-all">
                  {config.vapidPublicKey}
                </span>
              </div>
            </div>
          </div>

          {/* Diagnostics Utilities */}
          <div className="bg-surface border border-border p-6 rounded-2xl shadow-sm flex flex-col gap-4">
            <h3 className="font-display font-bold text-base text-text-primary flex items-center gap-2 pb-2 border-b border-border">
              <Info size={18} className="text-text-secondary" />
              <span>System Cache &amp; Diagnostics</span>
            </h3>
            
            <p className="text-xs text-text-secondary leading-relaxed">
              If assets (logos, images, text layouts) are not rendering correctly after a code change, you can force-clear your local browser's Service Worker registries and asset cache buckets.
            </p>
            
            <div className="flex justify-start">
              <button 
                type="button"
                onClick={handleClearCache}
                disabled={!!cacheStatus}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-danger/10 hover:bg-danger text-danger hover:text-white rounded-lg text-xs font-bold border border-danger/20 transition-all duration-200"
              >
                <Trash2 size={14} />
                <span>{cacheStatus || 'Clear Browser Application Cache'}</span>
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
