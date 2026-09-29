'use client';

import { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';
import { CheckCircle, AlertCircle, X, Info } from 'lucide-react';
import { Rise } from 'cube-motion/react';

// ─── Toast Context ───────────────────────────────────────────────────────────

const ToastContext = createContext(null);

let toastIdCounter = 0;

/**
 * Toast provider — wrap your app in this to enable toasts.
 * Usage: <ToastProvider>{children}</ToastProvider>
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const removeToast = useCallback((id) => {
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback(({ type = 'info', title, message, duration = 4000 }) => {
    const id = ++toastIdCounter;
    setToasts(prev => [...prev, { id, type, title, message }]);

    if (duration > 0) {
      timersRef.current[id] = setTimeout(() => removeToast(id), duration);
    }

    return id;
  }, [removeToast]);

  const toast = useCallback({
    success: (title, message) => addToast({ type: 'success', title, message }),
    error: (title, message) => addToast({ type: 'error', title, message, duration: 6000 }),
    info: (title, message) => addToast({ type: 'info', title, message }),
  }, [addToast]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast container — fixed bottom-right */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Hook to use toast notifications from any client component.
 *
 * Usage:
 *   const toast = useToast();
 *   toast.success('Saved!', 'Product has been created.');
 *   toast.error('Error', 'Something went wrong.');
 */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Graceful fallback if used outside provider
    return {
      success: (title, msg) => console.log(`[Toast:success] ${title}: ${msg}`),
      error: (title, msg) => console.error(`[Toast:error] ${title}: ${msg}`),
      info: (title, msg) => console.log(`[Toast:info] ${title}: ${msg}`),
    };
  }
  return ctx;
}

// ─── Toast Item Component ────────────────────────────────────────────────────
function ToastItem({ toast, onDismiss }) {
  const { type, title, message } = toast;

  const styles = {
    success: {
      bg: 'bg-surface border-success/30 text-success',
      icon: <CheckCircle size={16} className="text-success flex-shrink-0 stroke-[2]" />,
      titleColor: 'text-success font-bold',
    },
    error: {
      bg: 'bg-surface border-danger/30 text-danger',
      icon: <AlertCircle size={16} className="text-danger flex-shrink-0 stroke-[2]" />,
      titleColor: 'text-danger font-bold',
    },
    info: {
      bg: 'bg-surface border-primary/30 text-primary',
      icon: <Info size={16} className="text-primary flex-shrink-0 stroke-[2]" />,
      titleColor: 'text-primary font-bold',
    },
  };

  const s = styles[type] || styles.info;

  return (
    <Rise
      as="div"
      className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-md max-w-sm ${s.bg}`}
    >
      {s.icon}
      <div className="flex-1 min-w-0">
        {title && (
          <p className={`text-xs ${s.titleColor}`}>{title}</p>
        )}
        {message && (
          <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{message}</p>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="p-0.5 text-text-muted hover:text-text-primary transition-colors flex-shrink-0 cursor-pointer"
        type="button"
      >
        <X size={12} />
      </button>
    </Rise>
  );
}
