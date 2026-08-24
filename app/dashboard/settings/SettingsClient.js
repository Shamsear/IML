'use client';

import React, { useState, useEffect } from 'react';
import { Settings, ShieldCheck, Database, Image, Bell, Info, Trash2, CheckCircle2 } from 'lucide-react';
import ConfirmModal from '@/components/ConfirmModal';
import { useToast } from '@/components/Toast';

export default function SettingsClient({ config, user }) {
  const [cacheStatus, setCacheStatus] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState({ title: '', message: '' });
  const [pushStatus, setPushStatus] = useState('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushStatus(Notification.permission);
    } else {
      setPushStatus('unsupported');
    }
  }, []);

  const handleEnableNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.error('Not Supported', 'This browser does not support desktop push notifications.');
      return;
    }
    
    try {
      const permission = await Notification.requestPermission();
      setPushStatus(permission);
      if (permission === 'granted') {
        setConfirmData({ title: 'Notifications Enabled', message: 'Push notifications are now active for this browser.' });
        setConfirmOpen(true);
      } else if (permission === 'denied') {
        toast.error('Permission Denied', 'Please reset site settings in your browser address bar to allow notifications.');
      }
    } catch (err) {
      console.error('Error requesting notification permission:', err);
    }
  };

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
      setConfirmData({ title: 'Cache Cleared', message: 'Service worker registrations and asset cache have been cleared. The page will reload.' });
      setConfirmOpen(true);
    } catch (e) {
      console.error(e);
      setCacheStatus('Failed');
    }
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 font-sans relative">
      <div className="absolute top-0 right-0 pointer-events-none opacity-5 overflow-hidden">
        <Settings size={250} />
      </div>
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

      <ConfirmModal
        open={confirmOpen}
        onClose={() => { setConfirmOpen(false); setCacheStatus(''); setSuccessMsg(''); }}
        type="success"
        title={confirmData.title}
        message={confirmData.message}
      />

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
          
          {/* Browser Push Notifications */}
          <div className="bg-surface border border-border p-6 rounded-2xl shadow-sm flex flex-col gap-4">
            <h3 className="font-display font-bold text-base text-text-primary flex items-center gap-2 pb-2 border-b border-border">
              <Bell size={18} className="text-primary animate-pulse" />
              <span>Browser Push Notifications</span>
            </h3>
            
            <p className="text-xs text-text-secondary leading-relaxed">
              Enable real-time push notifications in this browser to receive automatic alerts when items are inbound, outbound, or overdue.
            </p>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-elevated/40 p-4 rounded-xl border border-border">
              <div>
                <span className="text-[10px] uppercase font-bold text-text-secondary block">Notification Permission</span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-md mt-1 border
                  ${pushStatus === 'granted' ? 'bg-success/10 text-success border-success/20' : 
                    pushStatus === 'denied' ? 'bg-danger/10 text-danger border-danger/20' : 'bg-warning/10 text-warning border-warning/20'}
                `}>
                  {pushStatus === 'granted' ? 'Allowed & Active' : 
                   pushStatus === 'denied' ? 'Blocked by Browser' : 'Not Configured (Default)'}
                </span>
              </div>
              
              <div>
                {pushStatus !== 'granted' && (
                  <button 
                    type="button"
                    onClick={handleEnableNotifications}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer shadow"
                  >
                    <Bell size={14} />
                    <span>Enable Push Notifications</span>
                  </button>
                )}
                {pushStatus === 'granted' && (
                  <span className="text-xs font-semibold text-text-secondary flex items-center gap-1">
                    <CheckCircle2 size={14} className="text-success" />
                    <span>Configured in this browser</span>
                  </span>
                )}
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
