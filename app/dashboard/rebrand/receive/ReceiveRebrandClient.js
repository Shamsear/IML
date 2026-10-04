'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  ArrowDownLeft, 
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
  Sparkles
} from 'lucide-react';
import CustomSelect from '@/components/CustomSelect';
import { useToast } from '@/components/Toast';
import { receiveRebrandItems } from '@/app/actions/transactions';

export default function ReceiveRebrandClient({
  products = [],
  brands = [],
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

  // Brand & Category filters for target product
  const [brandFilter, setBrandFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Datetime
  const [receivedDate, setReceivedDate] = useState(() => {
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

  // Auto-fill quantity with remainingPending when selectedTx changes
  useEffect(() => {
    if (selectedTx) {
      const remaining = Math.max(0, selectedTx.quantity - (selectedTx.returnedQty || 0));
      setQuantity(remaining > 0 ? String(remaining) : String(selectedTx.quantity));

      // Attempt to auto-detect vendor from origin notes or entity
      if (selectedTx.toEntityId && selectedTx.toEntityType === 'VENDOR') {
        setVendorName(selectedTx.toEntityId);
      } else if (selectedTx.notes && selectedTx.notes.toLowerCase().includes('advamedia')) {
        setVendorName('Advamedia');
      }

      // Default brand filter to match origin product brand if available
      if (selectedTx.product?.brand?.id) {
        setBrandFilter(selectedTx.product.brand.id);
      }
    }
  }, [selectedTxId]);

  // Categories list for target selector
  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(products.map(p => p.category).filter(Boolean))).sort();
  }, [products]);

  // Filtered target products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesBrand = brandFilter === 'ALL' || p.brand?.id === brandFilter;
      const matchesCat = categoryFilter === 'ALL' || p.category === categoryFilter;
      return matchesBrand && matchesCat;
    });
  }, [products, brandFilter, categoryFilter]);

  const selectedTargetProd = useMemo(() => {
    return products.find(p => p.id === targetProductId) || null;
  }, [products, targetProductId]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!selectedTx) {
      setError('Please select an outbound rebrand dispatch record.');
      return;
    }

    if (!targetProductId) {
      setError('Please select a target converted product.');
      return;
    }

    const qtyNum = parseFloat(quantity);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setError('Please enter a valid received quantity greater than 0.');
      return;
    }

    if (qtyNum > remainingPending) {
      setError(`Received quantity (${qtyNum}) exceeds the remaining pending quantity (${remainingPending}).`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      await receiveRebrandItems({
        deliveryNote: selectedTx.deliveryNote,
        transactionId: selectedTx.id,
        vendorName: vendorName.trim() || 'Advamedia',
        transactionDate: receivedDate,
        globalNotes: notes.trim(),
        receivedItems: [
          {
            targetProductId,
            quantity: qtyNum,
            notes: notes.trim(),
          }
        ]
      });

      toast.success(
        'Stock Received Successfully',
        `Received ${qtyNum} converted units into Warehouse under ${selectedTx.deliveryNote || 'Rebrand'}.`
      );

      router.push('/dashboard/rebrand?tab=COMPLETED');
      router.refresh();
    } catch (err) {
      console.error('Receive Rebrand error:', err);
      setError(err.message || 'Failed to process received rebrand.');
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
              <div className="w-6 h-6 rounded-lg bg-success/10 border border-success/20 flex items-center justify-center text-success">
                <ArrowDownLeft size={14} />
              </div>
              <h1 className="text-xl font-display font-bold text-text-primary">
                Receive Rebranded Stock
              </h1>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Receive converted product definitions returned from the vendor into warehouse inventory
            </p>
          </div>
        </div>

        <Link
          href="/dashboard/rebrand"
          className="text-xs font-semibold text-text-secondary hover:text-text-primary underline sm:inline hidden"
        >
          View Rebrand Ledger
        </Link>
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
            <Package size={16} className="text-primary" />
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
                <span className="font-mono text-sm font-bold text-primary mt-1">
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
                    Origin Product Sent Out
                  </span>
                  <span className="text-sm font-bold text-text-primary block truncate mt-0.5">
                    {selectedTx.product?.name}
                  </span>
                  <span className="text-xs text-text-muted block">
                    {selectedTx.product?.brand?.name || 'General'} · {selectedTx.product?.category || 'General'}
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
                  Already Received
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
                <Info size={14} className="text-primary shrink-0 mt-0.5" />
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

      {/* 3. Inbound Converted Stock Receipt Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm flex flex-col gap-6">
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <Sparkles size={16} className="text-success" />
            <span className="text-xs font-bold uppercase tracking-wider text-text-primary">
              2. Target Converted Product Details
            </span>
          </div>

          {/* Filter Pills for Target Product */}
          <div className="flex flex-col gap-3">
            {brands.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1 shrink-0">
                  <Tag size={11} /> Brand:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBrandFilter('ALL')}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                      brandFilter === 'ALL'
                        ? 'bg-primary text-white border-primary shadow-xs'
                        : 'bg-surface border-border text-text-secondary hover:border-primary/50'
                    }`}
                  >
                    All Brands
                  </button>
                  {brands.map(b => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setBrandFilter(b.id)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                        brandFilter === b.id
                          ? 'bg-primary text-white border-primary shadow-xs'
                          : 'bg-surface border-border text-text-secondary hover:border-primary/50'
                      }`}
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {uniqueCategories.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1 shrink-0">
                  <Layers size={11} /> Category:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('ALL')}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                      categoryFilter === 'ALL'
                        ? 'bg-primary text-white border-primary shadow-xs'
                        : 'bg-surface border-border text-text-secondary hover:border-primary/50'
                    }`}
                  >
                    All Categories
                  </button>
                  {uniqueCategories.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                        categoryFilter === cat
                          ? 'bg-primary text-white border-primary shadow-xs'
                          : 'bg-surface border-border text-text-secondary hover:border-primary/50'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Target Product CustomSelect */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-secondary">
              Target Converted Product <span className="text-danger">*</span>
            </label>
            <CustomSelect
              options={filteredProducts.map(p => ({
                value: p.id,
                label: `${p.name} (${p.brand?.name || 'General'})${p.itemCode ? ` - SKU: ${p.itemCode}` : ''}`,
                imageUrl: p.imageUrl,
                warehouseStock: p.warehouseStock,
              }))}
              value={targetProductId}
              onChange={val => setTargetProductId(val)}
              placeholder="-- Select Converted Product Definition --"
              required
            />
            {selectedTargetProd && (
              <div className="mt-1 flex items-center gap-2 text-[11px] text-text-muted bg-surface-elevated/40 px-3 py-1.5 rounded-lg border border-border/60">
                <CheckCircle size={12} className="text-success shrink-0" />
                <span>
                  Current Warehouse Stock: <strong>{selectedTargetProd.warehouseStock ?? 0} units</strong>. Stock will increase by <strong>{quantity || 0} units</strong> after receiving.
                </span>
              </div>
            )}
          </div>

          {/* Quantity & Vendor Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Quantity */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-text-secondary">
                  Quantity Received <span className="text-danger">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setQuantity(String(remainingPending))}
                  className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                >
                  Fill Remaining ({remainingPending})
                </button>
              </div>
              <input
                type="number"
                step="any"
                min="0.001"
                max={remainingPending > 0 ? remainingPending : undefined}
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder="Enter received units"
                required
                className="w-full bg-surface text-text-primary border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 font-mono font-bold"
              />
            </div>

            {/* Vendor Name */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-text-secondary">
                  Vendor Name
                </label>
                <div className="flex gap-1">
                  {['Advamedia', 'Vendor'].map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setVendorName(v)}
                      className="text-[10px] font-semibold text-text-muted hover:text-primary cursor-pointer"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={vendorName}
                  onChange={e => setVendorName(e.target.value)}
                  placeholder="e.g. Advamedia"
                  className="w-full bg-surface text-text-primary border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 font-medium pl-9"
                />
                <Building2 size={15} className="absolute left-3 top-3 text-text-muted" />
              </div>
            </div>
          </div>

          {/* Receipt Date & Time */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-secondary">
              Date & Time Received
            </label>
            <div className="relative">
              <input
                type="datetime-local"
                value={receivedDate}
                onChange={e => setReceivedDate(e.target.value)}
                className="w-full bg-surface text-text-primary border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 font-mono pl-9"
              />
              <Calendar size={15} className="absolute left-3 top-3 text-text-muted" />
            </div>
          </div>

          {/* Receipt Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-secondary">
              Receipt Remarks / Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Completed conversion received in excellent condition..."
              className="w-full bg-surface text-text-primary border border-border rounded-xl p-3 text-xs focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
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
            disabled={loading || !selectedTx || !targetProductId || !quantity}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-success hover:bg-success-hover text-white shadow-sm hover:shadow transition-all disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Stocking Into Warehouse...</span>
              </>
            ) : (
              <>
                <ArrowDownLeft size={15} />
                <span>Confirm & Stock Into Warehouse</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
