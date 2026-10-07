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
  Package,
  Store,
  UserCheck,
  Calendar,
  FileText,
  Info,
  Tag,
  Hash,
  Trash2,
  Layers,
  ArrowRight
} from 'lucide-react';
import CustomSelect from '@/components/CustomSelect';
import { useToast } from '@/components/Toast';
import { updateUsedTransaction } from '@/app/actions/transactions';
import { getOptimizedImageUrl } from '@/lib/imagekit';
import ImageLightbox from '@/components/ImageLightbox';
import { useUnsavedChanges } from '@/lib/useUnsavedChanges';

export default function EditUsedClient({
  usedTx,
  parentTx,
  store,
  siblingTotal = 0,
  maxUsableQty = null,
  cleanNotes = '',
  supervisors = []
}) {
  const router = useRouter();
  const toast = useToast();

  const [lightboxImage, setLightboxImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Initial date formatting
  const initialDate = usedTx.timestamp ? new Date(usedTx.timestamp) : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dtLocal = `${initialDate.getFullYear()}-${pad(initialDate.getMonth() + 1)}-${pad(initialDate.getDate())}T${pad(initialDate.getHours())}:${pad(initialDate.getMinutes())}`;

  // Form State
  const [quantity, setQuantity] = useState(usedTx.quantity || 1);
  const [supervisorId, setSupervisorId] = useState(usedTx.deliverySupervisorId || '');
  const [timestamp, setTimestamp] = useState(dtLocal);
  const [notes, setNotes] = useState(cleanNotes || '');

  // Unsaved changes tracking
  const hasChanges = (
    quantity !== usedTx.quantity ||
    supervisorId !== (usedTx.deliverySupervisorId || '') ||
    notes !== cleanNotes ||
    timestamp !== dtLocal
  );
  useUnsavedChanges(hasChanges && !loading);

  // Max allowable quantity
  const maxAllowed = maxUsableQty !== null ? maxUsableQty : (parentTx ? parentTx.quantity : null);

  // Supervisor dropdown options
  const supervisorOptions = useMemo(() => {
    return [
      { value: '', label: 'None / Not Assigned' },
      ...supervisors.map(s => ({ value: s.id, label: s.name }))
    ];
  }, [supervisors]);

  // Preview status calculations
  const parsedQty = parseFloat(quantity) || 0;
  const newTotalConsumed = siblingTotal + parsedQty;
  const parentTotalQty = parentTx ? parentTx.quantity : null;
  const isFullyConsumed = parentTotalQty !== null ? (newTotalConsumed >= parentTotalQty - 0.0001) : false;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isNaN(parsedQty) || parsedQty <= 0) {
      setError('Consumed quantity must be greater than 0.');
      return;
    }

    if (maxAllowed !== null && parsedQty > maxAllowed + 0.0001) {
      setError(`Quantity cannot exceed ${maxAllowed}. Only ${maxAllowed} remaining from original dispatch.`);
      return;
    }

    setLoading(true);

    try {
      const payload = {
        quantity: parsedQty,
        deliverySupervisorId: supervisorId || null,
        notes: notes.trim(),
        timestamp: timestamp ? new Date(timestamp).toISOString() : null,
      };

      const res = await updateUsedTransaction(usedTx.id, payload);
      if (res.success) {
        toast.success('Consumed Record Updated', 'Successfully updated consumed quantity and synced parent dispatch.');
        router.push('/dashboard/used?tab=history');
        router.refresh();
      }
    } catch (err) {
      setError(err.message || 'Failed to update consumed record.');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 font-sans relative pb-12">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/used?tab=history"
            className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-border bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors shadow-sm"
            aria-label="Back to Consumed History"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-text-primary tracking-tight">
                Edit Consumed Item
              </h1>
              {usedTx.deliveryNote && (
                <span className="font-mono text-xs font-bold text-warning bg-warning/10 border border-warning/20 px-2.5 py-0.5 rounded-full">
                  {usedTx.deliveryNote}
                </span>
              )}
              <span className="text-xs font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                Used / Consumed
              </span>
            </div>
            <p className="text-text-secondary text-xs sm:text-sm mt-1">
              Modify the consumed quantity, supervisor, date, and remarks for this item.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/used?tab=history"
            className="px-4 py-2 border border-border bg-surface hover:bg-surface-elevated text-text-secondary font-bold text-xs rounded-xl transition-all"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="px-5 py-2 bg-warning hover:bg-warning/80 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            <span>{loading ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </header>

      {error && (
        <div className="p-4 bg-danger/10 border border-danger/20 rounded-xl flex items-center gap-3 text-danger text-sm font-semibold">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Product Details & Parent Dispatch Info */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          {/* Product Info Card */}
          <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm flex flex-col gap-4">
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
              <Package size={14} className="text-primary" /> Product Overview
            </span>

            <div className="flex items-center gap-3.5">
              {usedTx.product?.imageUrl ? (
                <img
                  src={getOptimizedImageUrl(usedTx.product.imageUrl, 120, 120)}
                  alt={usedTx.product?.name || 'Product'}
                  className="w-16 h-16 rounded-xl object-cover border border-border shrink-0 cursor-zoom-in hover:brightness-95 transition-all shadow-sm"
                  onClick={() => setLightboxImage({ url: usedTx.product.imageUrl, name: usedTx.product.name })}
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-surface-elevated text-text-muted flex items-center justify-center border border-border shrink-0">
                  <Package size={24} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <Link
                  href={`/dashboard/products/${usedTx.product?.id}`}
                  className="font-bold text-sm text-text-primary hover:text-primary transition-colors block break-words leading-tight"
                >
                  {usedTx.product?.name}
                </Link>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] font-mono text-text-muted">
                    {usedTx.product?.itemCode || 'No SKU'}
                  </span>
                  <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                    {usedTx.product?.brand?.name || 'General'}
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-3.5 flex flex-col gap-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-text-muted flex items-center gap-1.5">
                  <Store size={13} /> Source Store:
                </span>
                <span className="font-bold text-text-primary">
                  {store?.name || (usedTx.fromEntityType === 'WAREHOUSE' ? 'Central Warehouse' : usedTx.fromEntityType || 'Store')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted flex items-center gap-1.5">
                  <Tag size={13} /> Category:
                </span>
                <span className="font-semibold text-text-secondary">
                  {usedTx.product?.category || 'General'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted flex items-center gap-1.5">
                  <Calendar size={13} /> Logged Date:
                </span>
                <span className="font-medium text-text-secondary">
                  {new Date(usedTx.timestamp).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>

          {/* Parent Dispatch Info Card */}
          {parentTx ? (
            <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm flex flex-col gap-3.5">
              <span className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                <Layers size={14} className="text-info" /> Outbound Dispatch Link
              </span>

              <div className="p-3 bg-surface-elevated/40 border border-border/70 rounded-xl flex flex-col gap-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Outbound Ref:</span>
                  <span className="font-mono font-bold text-primary">
                    {parentTx.deliveryNote || parentTx.id.substring(0, 12)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Dispatched Qty:</span>
                  <span className="font-mono font-bold text-text-primary">
                    {parentTx.quantity}
                  </span>
                </div>
                {siblingTotal > 0 && (
                  <div className="flex items-center justify-between text-text-muted">
                    <span>Other Consumed:</span>
                    <span className="font-mono font-semibold">
                      {siblingTotal}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-border/50 pt-1.5 font-bold">
                  <span className="text-text-secondary">Max Allowable:</span>
                  <span className="font-mono text-warning">
                    {maxAllowed !== null ? maxAllowed : 'Unlimited'}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-text-muted leading-relaxed">
                Modifying this record will automatically adjust the original outbound dispatch status and consumption tracking.
              </p>
            </div>
          ) : (
            <div className="bg-surface border border-border/70 rounded-2xl p-4 shadow-sm flex items-start gap-2.5 text-xs text-text-muted">
              <Info size={16} className="shrink-0 text-text-secondary mt-0.5" />
              <span>
                This consumed record is not linked to a specific outbound dispatch ID. Stock consumption was recorded directly.
              </span>
            </div>
          )}
        </div>

        {/* Right Side: Edit Form Card */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-2xl p-6 shadow-sm flex flex-col gap-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-text-secondary pb-3 border-b border-border flex items-center gap-2">
              <FileText size={15} className="text-primary" /> Modify Consumed Details
            </h2>

            {/* Quantity Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-text-secondary flex items-center justify-between">
                <span>Consumed Quantity <strong className="text-danger">*</strong></span>
                {maxAllowed !== null && (
                  <span className="text-[11px] font-mono text-text-muted">
                    Max allowed: <strong className="text-text-primary">{maxAllowed}</strong>
                  </span>
                )}
              </label>

              <div className="flex items-center gap-3">
                <div className="flex items-center border border-border rounded-xl bg-surface-elevated/40 overflow-hidden shadow-sm">
                  <button
                    type="button"
                    onClick={() => setQuantity(prev => Math.max(1, (parseFloat(prev) || 1) - 1))}
                    disabled={parsedQty <= 1}
                    className="px-3.5 py-2.5 text-text-secondary hover:text-text-primary hover:bg-surface-elevated disabled:opacity-30 transition-colors font-bold text-sm cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={maxAllowed !== null ? maxAllowed : undefined}
                    step="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-24 text-center font-mono font-bold text-sm bg-transparent border-x border-border py-2.5 text-text-primary focus:outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity(prev => {
                      const cur = parseFloat(prev) || 0;
                      if (maxAllowed !== null && cur >= maxAllowed) return cur;
                      return cur + 1;
                    })}
                    disabled={maxAllowed !== null && parsedQty >= maxAllowed}
                    className="px-3.5 py-2.5 text-text-secondary hover:text-text-primary hover:bg-surface-elevated disabled:opacity-30 transition-colors font-bold text-sm cursor-pointer"
                  >
                    +
                  </button>
                </div>

                <span className="text-xs text-text-muted">
                  Units consumed / disposed
                </span>
              </div>
            </div>

            {/* Live Parent Dispatch Impact Preview */}
            {parentTx && (
              <div className="p-3.5 bg-surface-elevated/50 border border-border rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${isFullyConsumed ? 'bg-warning animate-pulse' : 'bg-primary'}`} />
                  <span className="text-text-muted">Parent Dispatch Status Preview:</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-text-secondary">
                    {newTotalConsumed} / {parentTotalQty}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isFullyConsumed ? 'bg-warning/10 text-warning border border-warning/20' : 'bg-primary/10 text-primary border border-primary/20'}`}>
                    {isFullyConsumed ? 'FULLY USED (USED)' : 'PARTIALLY USED (PARTIAL)'}
                  </span>
                </div>
              </div>
            )}

            {/* Supervisor & Date Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-secondary flex items-center gap-1.5">
                  <UserCheck size={13} /> Supervisor / Approver
                </label>
                <CustomSelect
                  options={supervisorOptions}
                  value={supervisorId}
                  onChange={setSupervisorId}
                  placeholder="Select supervisor..."
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-secondary flex items-center gap-1.5">
                  <Calendar size={13} /> Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={timestamp}
                  onChange={(e) => setTimestamp(e.target.value)}
                  className="w-full bg-surface-elevated/40 text-text-primary border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-primary font-medium"
                />
              </div>
            </div>

            {/* Remarks / Reason for Consumption */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-text-secondary flex items-center gap-1.5">
                <FileText size={13} /> Consumption Remarks / Reason
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Broken packaging, expired sampling items, promoter demo usage..."
                className="w-full bg-surface-elevated/40 text-text-primary placeholder:text-text-muted border border-border rounded-xl p-3 text-xs focus:outline-none focus:border-primary resize-none font-medium leading-relaxed"
              />
            </div>

            {/* Footer Buttons */}
            <div className="pt-4 border-t border-border flex items-center justify-between gap-3">
              <div className="text-[11px] text-text-muted">
                {hasChanges ? (
                  <span className="text-warning font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
                    Unsaved modifications
                  </span>
                ) : (
                  <span>No modifications made yet</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/dashboard/used?tab=history"
                  className="px-4 py-2 border border-border bg-surface hover:bg-surface-elevated text-text-secondary font-bold text-xs rounded-xl transition-all"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-warning hover:bg-warning/80 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                >
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  <span>{loading ? 'Saving...' : 'Update Consumed Record'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <ImageLightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />
    </div>
  );
}
