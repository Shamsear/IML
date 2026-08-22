'use client';

import { SessionProvider } from 'next-auth/react';
import { ToastProvider } from './Toast';

export function Providers({ children }) {
  return (
    <SessionProvider>
      <ToastProvider>{children}</ToastProvider>
    </SessionProvider>
  );
}
