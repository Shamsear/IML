'use client';

import { CheckCircle, AlertCircle, X } from 'lucide-react';

/**
 * Confirmation modal for success/error messages.
 * Replaces toast notifications that users miss when scrolled down.
 * 
 * @param {Object} props
 * @param {boolean} props.open - Whether the modal is visible
 * @param {Function} props.onClose - Called when user clicks OK or dismisses
 * @param {'success'|'error'} props.type - Visual variant
 * @param {string} props.title - Headline
 * @param {string} props.message - Description text
 */
export default function ConfirmModal({ open, onClose, type = 'success', title, message }) {
  if (!open) return null;

  const isSuccess = type === 'success';
  const Icon = isSuccess ? CheckCircle : AlertCircle;

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
            isSuccess ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
          }`}>
            <Icon size={24} />
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
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
        <div className="px-6 py-4 border-t border-border bg-surface-elevated/30 flex justify-end">
          <button
            onClick={onClose}
            className={`px-6 py-2.5 rounded-lg text-xs font-bold text-white transition-colors shadow-md ${
              isSuccess 
                ? 'bg-primary hover:bg-primary-hover' 
                : 'bg-danger hover:bg-danger-hover'
            }`}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
