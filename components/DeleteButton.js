'use client';

import { useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';

/**
 * Delete button with confirmation dialog.
 * Replaces the duplicated delete + confirm pattern across CRUD pages.
 *
 * @param {Object} props
 * @param {Function} props.onDelete - Async function called on confirm
 * @param {string} [props.itemName] - Name of the item being deleted (for confirmation text)
 * @param {string} [props.className] - Extra classes
 * @param {string} [props.size] - 'sm' or 'md' (default: 'sm')
 */
export default function DeleteButton({ onDelete, itemName = 'this item', className = '', size = 'sm' }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    setDeleting(true);
    setError('');
    try {
      await onDelete();
      setConfirmOpen(false);
    } catch (e) {
      setError(e.message || 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => { setError(''); setConfirmOpen(true); }}
        className={`inline-flex items-center justify-center rounded-lg font-semibold transition-colors duration-200 bg-danger/10 hover:bg-danger text-danger hover:text-white border border-danger/20 ${
          size === 'sm' ? 'p-2 text-xs' : 'px-4 py-2 text-sm'
        } ${className}`}
      >
        <Trash2 size={size === 'sm' ? 14 : 16} />
      </button>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => !deleting && setConfirmOpen(false)}
        >
          <div
            className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-border">
              <h3 className="font-display font-extrabold text-lg text-text-primary">Delete Item</h3>
            </div>
            <div className="p-6">
              <p className="text-sm text-text-secondary leading-relaxed">
                Are you sure you want to delete <strong>{itemName}</strong>? This action cannot be undone.
              </p>
              {error && (
                <div className="mt-3 p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-xs font-medium">
                  {error}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-5 py-2 bg-danger hover:bg-danger-hover disabled:bg-danger/50 text-white font-bold text-sm rounded-lg shadow-sm transition-colors"
              >
                {deleting && <Loader2 size={14} className="animate-spin" />}
                <span>{deleting ? 'Deleting...' : 'Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
