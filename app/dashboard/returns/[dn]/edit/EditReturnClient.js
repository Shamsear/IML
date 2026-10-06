'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  Package,
  Store,
  UserCheck,
  Calendar,
  FileText,
  Info,
  ShieldCheck,
  Tag,
  Hash,
  Plus,
  Trash2,
  Layers,
  ArrowRight
} from 'lucide-react';
import CustomSelect from '@/components/CustomSelect';
import { useToast } from '@/components/Toast';
import { updateReturnTransaction } from '@/app/actions/transactions';
import { getOptimizedImageUrl } from '@/lib/imagekit';
import ImageLightbox from '@/components/ImageLightbox';
import { useUnsavedChanges } from '@/lib/useUnsavedChanges';

export default function EditReturnClient({
  returnTx,
  parentTx,
  store,
  siblingTotal = 0,
  maxReturnableQty = null,
  cleanNotes = '',
  supervisors = [],
  availableStoreBarcodes = [],
  currentSerials = []
}) {
  const router = useRouter();
  const toast = useToast();

  const [lightboxImage, setLightboxImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Initial date formatting
  const initialDate = returnTx.timestamp ? new Date(returnTx.timestamp) : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dtLocal = `${initialDate.getFullYear()}-${pad(initialDate.getMonth() + 1)}-${pad(initialDate.getDate())}T${pad(initialDate.getHours())}:${pad(initialDate.getMinutes())}`;

  // Form State
  const [quantity, setQuantity] = useState(returnTx.quantity || 1);
  const [supervisorId, setSupervisorId] = useState(returnTx.deliverySupervisorId || '');
  const [timestamp, setTimestamp] = useState(dtLocal);
  const [notes, setNotes] = useState(cleanNotes || '');

  // Serialized barcodes state
  const isSerialized = Boolean(returnTx.product?.isSerialized);
  const [selectedBarcodes, setSelectedBarcodes] = useState(currentSerials || []);
  const [barcodeInput, setBarcodeInput] = useState('');

  // Unsaved changes tracking
  const hasChanges = (
    quantity !== returnTx.quantity ||
    supervisorId !== (returnTx.deliverySupervisorId || '') ||
    notes !== cleanNotes ||
    timestamp !== dtLocal ||
    (isSerialized && JSON.stringify(selectedBarcodes) !== JSON.stringify(currentSerials))
  );
  useUnsavedChanges(hasChanges && !loading);

  // Max allowable quantity for this return record
  const maxAllowed = maxReturnableQty !== null ? maxReturnableQty : (parentTx ? parentTx.quantity : null);

  // Supervisor dropdown options
  const supervisorOptions = useMemo(() => {
    return [
      { value: '', label: 'None / Not Assigned' },
      ...supervisors.map(s => ({ value: s.id, label: s.name }))
    ];
  }, [supervisors]);

  // Combined pool of barcodes available to choose for this return:
  // (currently selected ones + whatever is currently available at the store)
  const barcodeOptionsPool = useMemo(() => {
    const set = new Set([...selectedBarcodes, ...availableStoreBarcodes.map(b => b.barcode)]);
    return Array.from(set);
  }, [selectedBarcodes, availableStoreBarcodes]);

  // Handle barcode add
  const handleAddBarcode = (code) => {
    const trimmed = (code || barcodeInput).trim();
    if (!trimmed) return;
    if (selectedBarcodes.includes(trimmed)) {
      toast.error('Already Added', `Barcode ${trimmed} is already selected for this return.`);
      return;
    }
    const next = [...selectedBarcodes, trimmed];
    setSelectedBarcodes(next);
    setQuantity(next.length);
    setBarcodeInput('');
  };

  const handleRemoveBarcode = (code) => {
    const next = selectedBarcodes.filter(b => b !== code);
    setSelectedBarcodes(next);
    setQuantity(next.length);
  };

  // Preview status calculations
  const parsedQty = parseFloat(quantity) || 0;
  const newTotalReturned = siblingTotal + parsedQty;
  const parentTotalQty = parentTx ? parentTx.quantity : null;
  const isFullyReturned = parentTotalQty !== null ? (newTotalReturned >= parentTotalQty - 0.0001) : false;
  const projectedStatus = isFullyReturned ? 'RETURNED' : (newTotalReturned > 0 ? 'PARTIAL' : 'NOT RETURNED');

  const storeName = store?.name || (returnTx.fromEntityType === 'STORE' ? returnTx.fromEntityId : 'Store');

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (parsedQty <= 0) {
      setError('Returned quantity must be greater than 0.');
      return;
    }

    if (maxAllowed !== null && parsedQty > maxAllowed + 0.0001) {
      setError(`Quantity exceeds maximum unreturned items (${maxAllowed}) remaining on the dispatch.`);
      return;
    }

    if (isSerialized && selectedBarcodes.length !== Math.round(parsedQty)) {
      setError(`Selected barcodes count (${selectedBarcodes.length}) must match quantity (${parsedQty}).`);
      return;
    }

    setLoading(true);

    try {
      await updateReturnTransaction(returnTx.id, {
        quantity: parsedQty,
        deliverySupervisorId: supervisorId || null,
        notes,
        timestamp,
        barcodes: isSerialized ? selectedBarcodes : []
      });

      toast.success('Return Updated', `Return ${returnTx.deliveryNote || returnTx.id} was updated successfully.`);
      router.push('/dashboard/returns?tab=history');
      router.refresh();
    } catch (err) {
      console.error('Failed to update return transaction:', err);
      setError(err.message || 'Failed to update return transaction.');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Lightbox Modal */}
      {lightboxImage && (
        <ImageLightbox
          imageUrl={lightboxImage.url}
          altText={lightboxImage.name}
          onClose={() => setLightboxImage(null)}
        />
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/dashboard/returns?tab=history"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-primary transition-colors mb-2"
          >
            <ArrowLeft size={14} />
            <span>Back to Return History</span>
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-black text-text-primary tracking-tight">Edit Return</h1>
            <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-primary/10 text-primary border border-primary/20">
              {returnTx.deliveryNote || returnTx.id}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-success/10 text-success border border-success/20">
              <CheckCircle2 size={12} />
              Delivered to Warehouse
            </span>
          </div>
          <p className="text-sm text-text-secondary mt-1">
            Modify the returned quantity, overseeing supervisor, or return remarks for this return record.
          </p>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm flex items-start gap-3">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Unable to save return changes</p>
            <p className="text-xs opacity-90 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Context Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Product Details Card */}
          <div className="bg-surface border border-border rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-muted">
              <Package size={14} className="text-primary" />
              <span>Returned Product Details</span>
            </div>

            <div className="flex items-start gap-3.5">
              {returnTx.product?.imageUrl ? (
                <img
                  src={getOptimizedImageUrl(returnTx.product.imageUrl, 120, 120)}
                  alt={returnTx.product.name}
                  className="w-16 h-16 rounded-xl object-cover border border-border shrink-0 cursor-zoom-in hover:brightness-95 transition-all shadow-xs"
                  onClick={() => setLightboxImage({ url: returnTx.product.imageUrl, name: returnTx.product.name })}
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-surface-elevated/70 text-text-muted flex items-center justify-center border border-border shrink-0">
                  <Package size={24} className="opacity-40" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <Link
                  href={`/dashboard/products/${returnTx.productId}`}
                  className="font-bold text-base text-text-primary hover:text-primary transition-colors leading-snug line-clamp-2"
                >
                  {returnTx.product?.name || 'Product'}
                </Link>
                <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted mt-1.5">
                  <span className="font-semibold text-text-secondary">{returnTx.product?.brand?.name || 'General Brand'}</span>
                  {returnTx.product?.itemCode && (
                    <>
                      <span>·</span>
                      <span className="font-mono">SKU: {returnTx.product.itemCode}</span>
                    </>
                  )}
                  {returnTx.product?.category && (
                    <>
                      <span>·</span>
                      <span>{returnTx.product.category}</span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-2.5">
                  {isSerialized ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      <Hash size={10} />
                      Serialized
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-surface-elevated text-text-muted border border-border">
                      <Layers size={10} />
                      Bulk Inventory
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Outbound Dispatch Source Card */}
          <div className="bg-surface border border-border rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-muted">
                <Store size={14} className="text-primary" />
                <span>Original Outbound Dispatch</span>
              </div>
              {parentTx?.deliveryNote && (
                <span className="font-mono text-xs font-bold text-text-secondary bg-surface-elevated px-2 py-0.5 rounded border border-border">
                  {parentTx.deliveryNote}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-surface-elevated/40 p-3 rounded-xl border border-border/50">
                <span className="text-text-muted block text-[11px]">Returned From Store</span>
                <span className="font-bold text-text-primary text-sm mt-0.5 block truncate" title={storeName}>
                  {storeName}
                </span>
              </div>

              <div className="bg-surface-elevated/40 p-3 rounded-xl border border-border/50">
                <span className="text-text-muted block text-[11px]">Original Dispatched Qty</span>
                <span className="font-mono font-bold text-text-primary text-sm mt-0.5 block">
                  {parentTx ? `${parentTx.quantity} units` : 'Unknown'}
                </span>
              </div>

              <div className="bg-surface-elevated/40 p-3 rounded-xl border border-border/50">
                <span className="text-text-muted block text-[11px]">Other Active Returns</span>
                <span className="font-mono font-bold text-text-secondary text-sm mt-0.5 block">
                  {siblingTotal} units
                </span>
              </div>

              <div className="bg-surface-elevated/40 p-3 rounded-xl border border-border/50">
                <span className="text-text-muted block text-[11px]">Max Returnable for Dispatch</span>
                <span className="font-mono font-bold text-primary text-sm mt-0.5 block">
                  {maxAllowed !== null ? `${maxAllowed} units` : 'Unlimited'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Editable Fields Card */}
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <RotateCcw size={16} className="text-primary" />
            <h2 className="text-base font-bold text-text-primary">Return Details & Quantity</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Returned Quantity Input */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider">
                Returned Quantity <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max={maxAllowed !== null ? maxAllowed : undefined}
                  step={isSerialized ? '1' : 'any'}
                  value={quantity}
                  disabled={isSerialized} // Serialized quantity is governed by selected barcodes
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full bg-surface-elevated/40 border border-border rounded-xl px-4 py-2.5 text-base font-mono font-bold text-text-primary focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  required
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-text-muted">
                  Units
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-text-muted pt-1">
                <span>Originally recorded: <strong>{returnTx.quantity}</strong></span>
                {maxAllowed !== null && !isSerialized && (
                  <button
                    type="button"
                    onClick={() => setQuantity(maxAllowed)}
                    className="text-primary hover:underline font-semibold"
                  >
                    Set Max ({maxAllowed})
                  </button>
                )}
              </div>
            </div>

            {/* Supervising Supervisor */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider">
                Overseeing Supervisor
              </label>
              <CustomSelect
                options={supervisorOptions}
                value={supervisorId}
                onChange={setSupervisorId}
                placeholder="Select Supervisor..."
              />
              <span className="text-[11px] text-text-muted block pt-1">
                Supervisor who collected or verified the returned goods.
              </span>
            </div>

            {/* Return Date / Time */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider">
                Return Date & Time <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <input
                  type="datetime-local"
                  value={timestamp}
                  onChange={(e) => setTimestamp(e.target.value)}
                  className="w-full bg-surface-elevated/40 border border-border rounded-xl px-4 py-2.5 text-sm font-medium text-text-primary focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  required
                />
              </div>
              <span className="text-[11px] text-text-muted block pt-1">
                Local time when stock arrived back at warehouse.
              </span>
            </div>
          </div>

          {/* Return Remarks / Notes */}
          <div className="space-y-2 pt-2">
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider">
              Return Remarks / Reason
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Promoter completed campaign; items in clean original condition..."
              className="w-full bg-surface-elevated/40 border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
            />
            <span className="text-[11px] text-text-muted block">
              Notes or explanation for this return. Parent outbound tracking reference is preserved automatically.
            </span>
          </div>

          {/* Serialized Barcodes Selector (only if serialized) */}
          {isSerialized && (
            <div className="pt-4 border-t border-border space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                    <Hash size={15} className="text-amber-500" />
                    <span>Returned Serial Barcodes ({selectedBarcodes.length})</span>
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    Select or scan the specific units that were physically returned to the warehouse.
                  </p>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-1 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  {selectedBarcodes.length} Barcode{selectedBarcodes.length !== 1 ? 's' : ''} Selected
                </span>
              </div>

              {/* Barcode Quick Picker from Store Pool */}
              {barcodeOptionsPool.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 bg-surface-elevated/30 rounded-xl border border-border/50 max-h-48 overflow-y-auto">
                  {barcodeOptionsPool.map(barcode => {
                    const isSelected = selectedBarcodes.includes(barcode);
                    return (
                      <button
                        key={barcode}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            handleRemoveBarcode(barcode);
                          } else {
                            handleAddBarcode(barcode);
                          }
                        }}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all border ${
                          isSelected
                            ? 'bg-primary text-white border-primary shadow-xs'
                            : 'bg-surface hover:bg-surface-elevated text-text-secondary border-border'
                        }`}
                      >
                        <span>{barcode}</span>
                        {isSelected ? <CheckCircle2 size={12} /> : <Plus size={12} className="opacity-60" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Real-Time Impact Preview Banner */}
        <div className="bg-surface-elevated/60 border border-border rounded-2xl p-5 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-muted mb-3">
            <Info size={14} className="text-primary" />
            <span>Impact of This Return Update</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="flex items-center gap-3 bg-surface p-3 rounded-xl border border-border/60">
              <div className="w-8 h-8 rounded-lg bg-success/10 text-success flex items-center justify-center shrink-0">
                <Package size={16} />
              </div>
              <div>
                <span className="text-text-muted block text-[11px]">Warehouse Restored</span>
                <span className="font-mono font-bold text-success text-sm">+{parsedQty} units</span>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-surface p-3 rounded-xl border border-border/60">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Store size={16} />
              </div>
              <div>
                <span className="text-text-muted block text-[11px]">Store Remaining At Dispatch</span>
                <span className="font-mono font-bold text-text-primary text-sm">
                  {parentTotalQty !== null ? `${Math.max(0, parentTotalQty - newTotalReturned)} units` : '---'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-surface p-3 rounded-xl border border-border/60">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                <ShieldCheck size={16} />
              </div>
              <div>
                <span className="text-text-muted block text-[11px]">Dispatch Return Status</span>
                <span className={`font-bold text-xs uppercase px-2 py-0.5 rounded inline-block mt-0.5 ${
                  projectedStatus === 'RETURNED'
                    ? 'bg-success/15 text-success'
                    : 'bg-primary/15 text-primary'
                }`}>
                  {projectedStatus}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions Bar */}
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-border">
          <Link
            href="/dashboard/returns?tab=history"
            className="px-5 py-2.5 rounded-xl border border-border text-sm font-semibold text-text-secondary hover:bg-surface-elevated transition-colors"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={loading || parsedQty <= 0}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>Save Return Changes</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
