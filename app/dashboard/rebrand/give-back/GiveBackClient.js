'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  RotateCcw, 
  Layers, 
  Tag, 
  Building2, 
  Calendar, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Package, 
  Camera, 
  Info,
  Clock,
  ArrowDownLeft,
  Undo2
} from 'lucide-react';
import CustomSelect from '@/components/CustomSelect';
import { useToast } from '@/components/Toast';
import { giveBackRebrandTransaction } from '@/app/actions/transactions';

export default function GiveBackClient({
  products = [],
  brands = [],
  storeNames = {},
  pendingTransactions = [],
  initialSelectedTx = null,
  initialTxId = '',
  initialDn = '',
}) {
  const router = useRouter();
  const toast = useToast();

  // Selected Outbound Dispatch
  const [selectedTxId, setSelectedTxId] = useState(() => {
    if (initialSelectedTx) return initialSelectedTx.id;
    if (initialTxId) return initialTxId;
    if (pendingTransactions.length > 0) return pendingTransactions[0].id;
    return '';
  });

  const selectedTx = useMemo(() => {
    return pendingTransactions.find(t => t.id === selectedTxId) || initialSelectedTx || null;
  }, [selectedTxId, pendingTransactions, initialSelectedTx]);

  // Form states
  const [targetProductId, setTargetProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [vendorName, setVendorName] = useState('Advamedia');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Datetime
  const [returnedDate, setReturnedDate] = useState(() => {
    const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Dubai' }));
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const hours = String(today.getHours()).padStart(2, '0');
    const minutes = String(today.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  });

  // Calculate pending remaining quantity
  const dispatchedQty = selectedTx ? selectedTx.quantity : 0;
  const alreadyReturned = selectedTx ? (selectedTx.returnedQty || 0) : 0;
  const remainingPending = Math.max(0, dispatchedQty - alreadyReturned);

  // Auto-fill quantity & targetProductId when selectedTx changes
  useEffect(() => {
    if (selectedTx) {
      const remaining = Math.max(0, selectedTx.quantity - (selectedTx.returnedQty || 0));
      setQuantity(remaining > 0 ? String(remaining) : String(selectedTx.quantity));

      // Default targetProductId to original product
      if (selectedTx.product?.id) {
        setTargetProductId(selectedTx.product.id);
      }

      // Resolve human-readable vendor name
      if (selectedTx.toEntityId && storeNames[selectedTx.toEntityId]) {
        setVendorName(storeNames[selectedTx.toEntityId]);
      } else if (selectedTx.toEntityId && selectedTx.toEntityType === 'VENDOR' && !selectedTx.toEntityId.startsWith('STR-')) {
        setVendorName(selectedTx.toEntityId);
      } else if (selectedTx.notes && selectedTx.notes.toLowerCase().includes('advamedia')) {
        setVendorName('Advamedia');
      } else {
        setVendorName('Advamedia');
      }
    }
  }, [selectedTxId, selectedTx, storeNames]);

  // Dynamic calculation of pending balance after this return
  const inputQtyNum = parseFloat(quantity);
  const validQty = !isNaN(inputQtyNum) && inputQtyNum >= 0 ? inputQtyNum : 0;
  const pendingAfterReturn = remainingPending - validQty;

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!selectedTx) {
      setError('Please select an outbound rebrand dispatch record.');
      return;
    }

    const effectiveTargetProductId = targetProductId || selectedTx.product?.id;
    if (!effectiveTargetProductId) {
      setError('Original product reference is missing.');
      return;
    }

    const qtyNum = parseFloat(quantity);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setError('Please enter a valid quantity greater than 0.');
      return;
    }

    if (qtyNum > remainingPending) {
      setError(`Quantity (${qtyNum}) exceeds the remaining pending quantity (${remainingPending}).`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      await giveBackRebrandTransaction({
        transactionId: selectedTx.id,
        quantity: qtyNum,
        targetProductId: effectiveTargetProductId,
        notes: notes.trim(),
      });

      toast.success(
        'Stock Given Back Successfully',
        `Returned ${qtyNum} units back to ${selectedTx.product?.name || 'original product'} in Warehouse.`
      );
      router.push('/dashboard/rebrand');
      router.refresh();
    } catch (err) {
      console.error('Give Back Rebrand error:', err);
      setError(err.message || 'Failed to process give back transaction.');
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto py-4 animate-fade-in pb-16">
      {/* 1. Header Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/rebrand"
            className="p-2 bg-surface hover:bg-surface-elevated border border-border rounded-xl text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-secondary/10 border border-secondary/20 flex items-center justify-center text-secondary">
                <RotateCcw size={14} />
              </div>
              <h1 className="text-xl font-display font-bold text-text-primary">
                Give Back Rebranded Stock
              </h1>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Return unconverted product stock from branding vendor back to original product in central warehouse
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/rebrand/receive"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface hover:bg-surface-elevated border border-border text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowDownLeft size={13} className="text-success" />
            <span>Receive Converted Instead</span>
          </Link>
          <Link
            href="/dashboard/rebrand"
            className="text-xs font-semibold text-text-secondary hover:text-text-primary underline sm:inline hidden"
          >
            Ledger
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/20 text-danger rounded-xl p-4 text-xs font-semibold flex items-center gap-2.5 animate-shake">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Source Outbound Rebrand Dispatch Selector & Overview */}
      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="px-5 py-4 bg-surface-elevated/40 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-secondary" />
            <span className="text-xs font-bold uppercase tracking-wider text-text-primary">
              1. Select Outbound Rebrand Dispatch
            </span>
          </div>

          {pendingTransactions.length > 1 && (
            <div className="min-w-[280px]">
              <CustomSelect
                options={pendingTransactions.map(t => ({
                  value: t.id,
                  label: `${t.deliveryNote || t.id} — ${t.product?.name || 'Product'} (Pending: ${Math.max(0, t.quantity - (t.returnedQty || 0))})`,
                }))}
                value={selectedTxId}
                onChange={val => setSelectedTxId(val)}
                placeholder="-- Switch Outbound Gate Pass --"
              />
            </div>
          )}
        </div>

        {selectedTx ? (
          <div className="p-5 flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Gate Pass Details */}
              <div className="bg-surface-elevated/30 border border-border rounded-xl p-4 flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  Gate Pass Ref
                </span>
                <span className="font-mono text-sm font-bold text-secondary mt-1">
                  {selectedTx.deliveryNote || selectedTx.id}
                </span>
                <div className="flex items-center gap-1.5 text-xs text-text-muted mt-2 pt-2 border-t border-border/40">
                  <Clock size={12} />
                  <span>
                    {selectedTx.timestamp ? new Date(selectedTx.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </span>
                </div>
              </div>

              {/* Origin Dispatched Product */}
              <div className="bg-surface-elevated/30 border border-border rounded-xl p-4 flex items-center gap-3 md:col-span-2">
                {selectedTx.product?.imageUrl ? (
                  <div className="w-12 h-12 rounded-lg bg-white border border-border p-1 flex items-center justify-center shrink-0">
                    <img src={selectedTx.product.imageUrl} alt="" className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-surface-elevated border border-border flex items-center justify-center text-text-muted shrink-0">
                    <Camera size={18} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                    Original Product To Restore
                  </span>
                  <span className="text-sm font-bold text-text-primary block truncate mt-0.5">
                    {selectedTx.product?.name}
                  </span>
                  <span className="text-xs text-text-muted block">
                    {selectedTx.product?.brand?.name || 'General'} · {selectedTx.product?.category || 'General'}
                    {selectedTx.product?.itemCode ? ` · SKU: ${selectedTx.product.itemCode}` : ''}
                  </span>
                </div>
              </div>
            </div>

            {/* Quantity Metrics Card */}
            <div className="grid grid-cols-3 gap-3 bg-surface-elevated/20 border border-border rounded-xl p-3.5 text-center">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  Total Dispatched
                </span>
                <span className="text-base font-extrabold text-text-primary mt-0.5">
                  {dispatchedQty} <span className="text-xs font-normal text-text-muted">units</span>
                </span>
              </div>
              <div className="flex flex-col border-x border-border/60">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  Already Returned
                </span>
                <span className="text-base font-extrabold text-success mt-0.5">
                  {alreadyReturned} <span className="text-xs font-normal text-text-muted">units</span>
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-warning">
                  Pending Remaining
                </span>
                <span className="text-base font-extrabold text-warning mt-0.5">
                  {remainingPending} <span className="text-xs font-normal text-text-muted">units</span>
                </span>
              </div>
            </div>

            {selectedTx.notes && (
              <div className="text-xs text-text-muted bg-surface-elevated/20 rounded-lg p-2.5 border border-border/50 flex items-start gap-2">
                <Info size={14} className="text-secondary shrink-0 mt-0.5" />
                <span><strong>Dispatch Notes:</strong> {selectedTx.notes}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-text-muted">
            No pending outbound rebrand gate passes found.
          </div>
        )}
      </div>

      {/* 3. Give Back Action Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm flex flex-col gap-6">
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <RotateCcw size={16} className="text-secondary" />
            <span className="text-xs font-bold uppercase tracking-wider text-text-primary">
              2. Return to Original Product Details
            </span>
          </div>

          {/* Info Banner */}
          <div className="p-4 bg-secondary/10 border border-secondary/20 rounded-xl flex items-start gap-3">
            <RotateCcw size={18} className="text-secondary shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1 text-xs">
              <span className="font-bold text-secondary text-sm">
                Giving Back to Original Product (Unconverted)
              </span>
              <p className="text-text-secondary leading-relaxed">
                Stock will be returned unconverted and credited directly back under original product: <strong>{selectedTx?.product?.name || 'Origin Product'}</strong> in the central warehouse.
              </p>
            </div>
          </div>

          {/* Quantity & Vendor Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Quantity */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-text-secondary">
                  Quantity to Give Back <span className="text-danger">*</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-text-muted">Pending balance:</span>
                  {validQty === 0 ? (
                    <span className="text-[10px] font-bold text-warning font-mono bg-warning/10 px-1.5 py-0.5 rounded border border-warning/20">
                      {remainingPending} {remainingPending === 1 ? 'unit' : 'units'}
                    </span>
                  ) : pendingAfterReturn > 0 ? (
                    <span className="text-[10px] font-bold text-warning font-mono bg-warning/10 px-1.5 py-0.5 rounded border border-warning/20">
                      {pendingAfterReturn} {pendingAfterReturn === 1 ? 'unit' : 'units'}
                    </span>
                  ) : pendingAfterReturn === 0 ? (
                    <span className="text-[10px] font-bold text-success font-mono bg-success/10 px-1.5 py-0.5 rounded border border-success/20">
                      0 units (Complete)
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-danger font-mono bg-danger/10 px-1.5 py-0.5 rounded border border-danger/20">
                      Exceeds by {Math.abs(pendingAfterReturn)}
                    </span>
                  )}
                </div>
              </div>
              <input
                type="number"
                step="any"
                min="0.001"
                max={remainingPending > 0 ? remainingPending : undefined}
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder="Enter quantity to return"
                required
                className="w-full bg-surface text-text-primary border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 font-mono font-bold"
              />
            </div>

            {/* Vendor Name */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-text-secondary">
                  Vendor / Partner Returning From
                </label>
                <span className="text-[10px] text-text-muted">Branding Partner</span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={vendorName}
                  onChange={e => setVendorName(e.target.value)}
                  placeholder="e.g. Advamedia"
                  className="w-full bg-surface text-text-primary border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 font-medium pl-9"
                />
                <Building2 size={15} className="absolute left-3 top-3 text-text-muted" />
              </div>
            </div>
          </div>

          {/* Date & Time */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-secondary">
              Date & Time Returned
            </label>
            <div className="relative">
              <input
                type="datetime-local"
                value={returnedDate}
                onChange={e => setReturnedDate(e.target.value)}
                className="w-full bg-surface text-text-primary border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 font-mono pl-9"
              />
              <Calendar size={15} className="absolute left-3 top-3 text-text-muted" />
            </div>
          </div>

          {/* Return Remarks */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-secondary">
              Return Remarks / Reason (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Returned unconverted due to branding cancellation / surplus..."
              className="w-full bg-surface text-text-primary border border-border rounded-xl p-3 text-xs focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 resize-none"
            />
          </div>
        </div>

        {/* 4. Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/dashboard/rebrand"
            className="px-5 py-2.5 rounded-xl text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-surface-elevated border border-border transition-colors cursor-pointer"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading || !selectedTx || !quantity}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-secondary hover:bg-secondary-hover shadow-sm hover:shadow transition-all disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Returning to Warehouse...</span>
              </>
            ) : (
              <>
                <RotateCcw size={15} />
                <span>Confirm Give Back &amp; Stock In</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
