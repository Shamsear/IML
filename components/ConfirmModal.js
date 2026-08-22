'use client';

import { useState } from 'react';
import { CheckCircle, AlertCircle, X, Loader2 } from 'lucide-react';

/**
 * Confirmation / result modal.
 *
 * Modes:
 *  - Info mode (default): Shows success or error message with OK button.
 *    Props: open, onClose, type='success'|'error', title, message
 *
 *  - Confirm mode: Shows a "Are you sure?" dialog with Confirm/Cancel.
 *    Props: open, onClose, onConfirm, type='confirm', title, message,
 *           confirmLabel='Confirm', cancelLabel='Cancel', danger=false
 */
export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  type = 'success',
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  danger = false,
}) {
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const isConfirm = type === 'confirm';
  const isSuccess = type === 'success';
  const isError = type === 'error';

  const Icon = isConfirm
    ? (danger ? AlertCircle : CheckCircle)
    : (isSuccess ? CheckCircle : AlertCircle);

  const handleConfirm = async () => {
    if (!onConfirm) return;
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      // Parent should handle error via toast or state
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden animate-slide-down"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-0">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            isConfirm
              ? (danger ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary')
              : (isSuccess ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger')
          }`}>
            <Icon size={24} />
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 flex flex-col gap-1.5">
          <h3 className="font-display font-extrabold text-base text-text-primary">
            {title}
          </h3>
          <p className="text-sm text-text-secondary leading-relaxed">
            {message}
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-surface-elevated/30 flex justify-end gap-3">
          {isConfirm && (
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-lg text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
              type="button"
            >
              {cancelLabel}
            </button>
          )}
          <button
            onClick={isConfirm ? handleConfirm : onClose}
            disabled={loading}
            className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-xs font-bold text-white transition-colors shadow-md disabled:opacity-50 ${
              isConfirm
                ? (danger ? 'bg-danger hover:bg-danger-hover' : 'bg-primary hover:bg-primary-hover')
                : (isSuccess ? 'bg-primary hover:bg-primary-hover' : 'bg-danger hover:bg-danger-hover')
            }`}
            type="button"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            <span>
              {loading
                ? 'Processing...'
                : isConfirm
                  ? (confirmLabel || 'Confirm')
                  : 'OK'
              }
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
