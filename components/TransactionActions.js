'use client';

import { useState } from 'react';
import { Edit2, Trash2, Loader2, X, CopyPlus } from 'lucide-react';
import { deleteTransaction } from '@/app/actions/transactions';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getTransactionNoteName } from '@/lib/transactionHelpers';

export default function TransactionActions({ txId, deliveryNote, notes, showDeliveryNote, copyType = 'inbound', transactionType = null }) {
  const router = useRouter();

  // Delete state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Determine note name based on type
  const noteName = transactionType 
    ? getTransactionNoteName(transactionType, deliveryNote)
    : (copyType === 'inbound' ? 'Receive Note' : copyType === 'outbound' ? 'Delivery Note' : 'Note');

  const handleOpenDelete = (e) => {
    e.stopPropagation();
    setDeleteError('');
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteTransaction(txId);
      setDeleteOpen(false);
      router.refresh();
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete transaction.');
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1.5">
        <div className="has-tooltip">
          <Link
            href={
              deliveryNote && (copyType === 'inbound' || copyType === 'outbound')
                ? `/dashboard/${copyType}/${encodeURIComponent(deliveryNote)}/edit`
                : `/dashboard/transactions/${txId}/edit`
            }
            className="p-1.5 rounded-md text-text-muted hover:text-primary hover:bg-primary/10 transition-colors"
            aria-label={deliveryNote && (copyType === 'inbound' || copyType === 'outbound') ? `Edit entire ${noteName}` : 'Edit transaction'}
          >
            <Edit2 size={13} />
          </Link>
          <span className="tooltip-box tooltip-left">
            {deliveryNote && (copyType === 'inbound' || copyType === 'outbound') ? `Edit entire ${noteName}` : "Edit transaction"}
          </span>
        </div>
        <div className="has-tooltip">
          <Link
            href={
              deliveryNote
                ? `/dashboard/${copyType}/new?copyDn=${deliveryNote}`
                : `/dashboard/${copyType}/new?copyTxId=${txId}`
            }
            className="p-1.5 rounded-md text-text-muted hover:text-success hover:bg-success/10 transition-colors"
            aria-label={deliveryNote ? `Duplicate full ${noteName.toLowerCase()}` : 'Duplicate transaction'}
          >
            <CopyPlus size={13} />
          </Link>
          <span className="tooltip-box tooltip-left">
            {deliveryNote ? `Duplicate full ${noteName.toLowerCase()}` : `Duplicate transaction`}
          </span>
        </div>
        <div className="has-tooltip">
          <button
            type="button"
            onClick={handleOpenDelete}
            className="p-1.5 rounded-md text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
            aria-label="Delete transaction"
          >
            <Trash2 size={13} />
          </button>
          <span className="tooltip-box tooltip-left">Undo / Delete transaction</span>
        </div>
      </div>

      {deleteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setDeleteOpen(false)}
        >
          <div
            className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-sm flex flex-col gap-0 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-border bg-surface flex items-center justify-between">
              <h3 className="font-display font-extrabold text-lg text-text-primary">Undo / Delete Transaction</h3>
              <button
                onClick={() => setDeleteOpen(false)}
                className="text-text-muted hover:text-text-primary transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 bg-surface flex flex-col gap-4">
              <p className="text-sm text-text-secondary leading-relaxed">
                Are you sure you want to undo/delete this transaction? This action will permanently remove this record from the ledger and revert any associated stock changes.
              </p>

              {deleteError && (
                <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-xs font-medium">
                  {deleteError}
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-surface-elevated border-t border-border flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="inline-flex items-center justify-center gap-2 px-5 py-2 bg-danger hover:bg-danger-hover disabled:bg-danger/50 text-white font-bold text-sm rounded-lg shadow-sm transition-colors shadow-sm"
              >
                {deleting && <Loader2 size={16} className="animate-spin" />}
                <span>{deleting ? 'Processing...' : 'Confirm Undo / Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
