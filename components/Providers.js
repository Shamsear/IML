'use client';

import { useEffect } from 'react';
import { SessionProvider } from 'next-auth/react';
import { ToastProvider } from './Toast';

export function Providers({ children }) {
  useEffect(() => {
    // Automatically purge legacy Workbox & RSC caches from browser CacheStorage
    if (typeof window !== 'undefined' && 'caches' in window) {
      const allowedCaches = ['iml-inventory-v2', 'google-fonts-webfonts', 'static-font-assets', 'static-image-assets'];
      caches.keys().then((keys) => {
        keys.forEach((key) => {
          if (!allowedCaches.includes(key)) {
            caches.delete(key);
          }
        });
      }).catch(() => {});
    }

    // Force service worker update check on load
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.update().catch(() => {});
        });
      }).catch(() => {});
    }
  }, []);

  return (
    <SessionProvider>
      <ToastProvider>{children}</ToastProvider>
    </SessionProvider>
  );
}
