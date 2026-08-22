'use client';

import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

/**
 * Inline alert banner for success, error, or info messages.
 * Replaces the duplicated success/error JSX across 6+ form pages.
 *
 * @param {Object} props
 * @param {'success'|'error'|'info'} props.type - Visual variant
 * @param {string} props.message - Message text
 * @param {Function} [props.onDismiss] - Called when close button is clicked (optional)
 */
export default function AlertBanner({ type = 'success', message, onDismiss }) {
  if (!message) return null;

  const styles = {
    success: {
      bg: 'bg-success/10 border-success/20 text-success',
      icon: <CheckCircle size={16} className="text-success" />,
    },
    error: {
      bg: 'bg-danger/10 border-danger/20 text-danger',
      icon: <AlertCircle size={16} className="flex-shrink-0" />,
    },
    info: {
      bg: 'bg-primary/10 border-primary/20 text-primary',
      icon: <Info size={16} className="flex-shrink-0" />,
    },
  };

  const s = styles[type] || styles.info;

  return (
    <div className={`${s.bg} border rounded-lg p-4 text-sm font-semibold flex items-center gap-2.5 animate-slide-down`}>
      {s.icon}
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="p-0.5 hover:opacity-70 transition-opacity"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
