'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Undo2, 
  Layers, 
  Tag, 
  Calendar, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Package, 
  Camera, 
  Info, 
  Clock, 
  ArrowRight,
  RotateCcw,
  MinusCircle,
  PlusCircle,
  ShieldAlert
} from 'lucide-react';
import CustomSelect from '@/components/CustomSelect';
import { useToast } from '@/components/Toast';
import { revertRebrandTransaction } from '@/app/actions/transactions';

export default function RevertRebrandClient({
  products = [],
  brands = [],
  transactions = [],
  initialSelectedTx = null,
  initialTxId = '',
  initialDn = '',
}) {
  const router = useRouter();
  const toast = useToast();

  // Selected Transaction ID
  const [selectedTxId, setSelectedTxId] = useState(() => {
    if (initialSelectedTx) return initialSelectedTx.id;
    if (initialTxId) return initialTxId;
    if (transactions.length > 0) return transactions[0].id;
    return '';
  });

  const selectedTx = useMemo(() => {
    return transactions.find(t => t.id === selectedTxId) || initialSelectedTx || null;
  }, [selectedTxId, transactions, initialSelectedTx]);

  // Form states
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Pair map to resolve from & to products across paired REBRAND_OUT / REBRAND_IN entries
  const rebrandPairMap = useMemo(() => {
    const map = {};
    (transactions || []).forEach(t => {
      if (!t.deliveryNote) return;
      if (!map[t.deliveryNote]) map[t.deliveryNote] = {};
      if (t.transactionType === 'REBRAND_OUT') {
        map[t.deliveryNote].fromProduct = t.product?.name;
      } else if (t.transactionType === 'REBRAND_IN') {
        map[t.deliveryNote].toProduct = t.product?.name;
      }
    });
    return map;
  }, [transactions]);

  // Historical target product mapping traced directly from original Excel sheets
  const HISTORICAL_REBRAND_TARGETS = {
    'RBD-SAD-210824-001': 'Sadia Promotional Stand (1*1) "Back to School" English',
    'RBD-SAD-250924-001': 'Sadia Promotional Stand (1*1)  Carrefour',
    'RBD-SAD-291024-001': 'Sadia Promotional Stand (1*1) - For Union Coop',
    'RBD-SAD-051124-001': 'Sadia Promotional Stand (1*1) - Generic',
    'RBD-SAD-061124-001': 'Sadia Promotional Stand (1*1) - For LULU New Dec 2024',
    'RBD-SAD-061124-002': 'Sadia Promotional Stand (1*1) - For Union Coop',
    'RBD-SAD-291124-001': 'Sadia Promotional Stand (1*1) - Mortadella',
    'RBD-SAD-291124-002': 'Sadia Promotional Stand (1*1) - Mortadella',
    'RBD-SAD-050225-001': 'Sadia Promotional Stand (1*1) - Generic',
    'RBD-SAD-100225-001': 'Sadia Promotional Stand (1*1) - Ramadan Like a pro',
    'RBD-SAD-120225-001': 'Sadia Promotional Stand (1*1) - Ramadan Like a pro',
    'RBD-SAD-130225-001': 'Sadia Promotional Stand (1*1) - Ramadan Like a pro',
    'RBD-SAD-130525-001': 'Sadia Promotional Stand (1*1) - Generic New 2025 (Buy Scan & Win)',
    'RBD-SAD-200525-001': 'Sadia Promotional Stand (1*1) - Generic New 2025 (Buy Scan & Win)',
    'RBD-SAD-140825-001': 'Sadia Promotional Stand (1*1) "Back to School" English 2025',
    'RBD-SAD-240925-001': 'Sadia Promotional Stand (1*1) "1000 Carrefour Voucher" 2025',
    'RBD-SAD-250925-001': 'Sadia Wooden Chef Stand',
    'RBD-SAD-211025-001': 'Sadia Promotional Stand (1*1) "Win Big With Sadia" 2025',
    'RBD-SAD-101125-001': 'Sadia Promotional Stand (1*1) "Win Big With Sadia" 2025',
    'RBD-SAD-091225-001': 'Sadia Promotional Stand (1*1) - Ramadan 2026',
    'RBD-SAD-260126-001': 'Sadia Promotional Stand (1*1) - Ramadan 2026',
    'RBD-SAD-200426-001': 'Sadia Promotional Stand (1*1) - New Look April 2026',
    'RBD-SAD-180526-001': 'Sadia Promotional Stand (1*1) - New Look April 2026',
    'RBD-SAD-170826-001': 'Sadia Promotional Stand (1*1) - Back To School "AED 40 2026"',
    'RBD-SAD-250826-002': 'Sadia Promotional Stand (1*1) - Back To School "AED 40 2026"',
  };

  const getFromProductName = (tx) => {
    if (!tx) return '—';
    if (tx.transactionType === 'REBRAND_OUT' || tx.transactionType === 'REBRAND') {
      return tx.product?.name || '—';
    }
    if (tx.deliveryNote && rebrandPairMap[tx.deliveryNote]?.fromProduct) {
      return rebrandPairMap[tx.deliveryNote].fromProduct;
    }
    if (tx.serialNumbers && tx.serialNumbers.length > 0) {
      for (const s of tx.serialNumbers) {
        if (s.serialNumber?.replaces?.product?.name) {
          return s.serialNumber.replaces.product.name;
        }
      }
    }
    if (tx.notes) {
      const match = tx.notes.match(/Rebrand input <-\s*([^.]+)/i);
      if (match) return match[1].trim();
      const matchLegacy = tx.notes.match(/rebranded from\s+([^.]+)/i);
      if (matchLegacy) return matchLegacy[1].trim();
    }
    return tx.product?.name || '—';
  };

  const getToProductName = (tx) => {
    if (!tx) return '—';
    if (tx.transactionType === 'REBRAND_IN') {
      return tx.product?.name || '—';
    }
    if (tx.deliveryNote && rebrandPairMap[tx.deliveryNote]?.toProduct) {
      return rebrandPairMap[tx.deliveryNote].toProduct;
    }
    if (tx.deliveryNote && HISTORICAL_REBRAND_TARGETS[tx.deliveryNote]) {
      return HISTORICAL_REBRAND_TARGETS[tx.deliveryNote];
    }
    if (tx.serialNumbers && tx.serialNumbers.length > 0) {
      for (const s of tx.serialNumbers) {
        if (s.serialNumber?.replacedBy?.product?.name) {
          return s.serialNumber.replacedBy.product.name;
        }
      }
    }
    if (tx.notes) {
      const match = tx.notes.match(/Rebrand output ->\s*([^.]+)/i);
      if (match) return match[1].trim();
      const matchLegacy = tx.notes.match(/rebrand(?:ed|ing)?\s+on\s*\(([^)]+)\)/i);
      if (matchLegacy) {
        let val = matchLegacy[1].trim();
        if (val.toLowerCase().startsWith('for ')) val = val.substring(4).trim();
        return val;
      }
      const matchForParen = tx.notes.match(/\(for\s+([^)]+)\)/i);
      if (matchForParen) {
        let val = matchForParen[1].trim();
        if (val.toLowerCase().startsWith('for ')) val = val.substring(4).trim();
        return val;
      }
    }
    return '—';
  };

  const fromProdName = useMemo(() => getFromProductName(selectedTx), [selectedTx, rebrandPairMap]);
  const toProdName = useMemo(() => getToProductName(selectedTx), [selectedTx, rebrandPairMap]);

  // Auto-fill quantity when selectedTx changes
  useEffect(() => {
    if (selectedTx) {
      setQuantity(String(selectedTx.quantity || ''));
      setError('');
    }
  }, [selectedTxId, selectedTx]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!selectedTx) {
      setError('Please select a rebrand transaction to revert.');
      return;
    }

    const qtyNum = parseFloat(quantity);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setError('Please enter a valid quantity greater than 0.');
      return;
    }

    if (qtyNum > selectedTx.quantity) {
      setError(`Quantity (${qtyNum}) exceeds the original transaction quantity (${selectedTx.quantity}).`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      await revertRebrandTransaction({
        transactionId: selectedTx.id,
        quantity: qtyNum,
        notes: notes.trim(),
      });

      toast.success(
        'Rebrand Reverted Successfully',
        `Restored ${qtyNum} units from "${toProdName}" back to original product "${fromProdName}".`
      );
      router.push('/dashboard/rebrand');
      router.refresh();
    } catch (err) {
      console.error('Revert Rebrand error:', err);
      setError(err.message || 'Failed to revert rebrand transaction.');
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
              <div className="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                <Undo2 size={14} />
              </div>
              <h1 className="text-xl font-display font-bold text-text-primary">
                Revert Rebrand to Old Product
              </h1>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Restore converted product units in warehouse back to their original product definition
            </p>
          </div>
        </div>

        <Link
          href="/dashboard/rebrand"
          className="text-xs font-semibold text-text-secondary hover:text-text-primary underline sm:inline hidden"
        >
          View Ledger
        </Link>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/20 text-danger rounded-xl p-4 text-xs font-semibold flex items-center gap-2.5 animate-shake">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Select Rebrand Transaction Card */}
      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="px-5 py-4 bg-surface-elevated/40 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-amber-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-text-primary">
              1. Select Rebrand Record to Revert
            </span>
          </div>

          {transactions.length > 1 && (
            <div className="min-w-[280px]">
              <CustomSelect
                options={transactions.map(t => ({
                  value: t.id,
                  label: `${t.deliveryNote || t.id} — ${t.product?.name || 'Product'} (${t.quantity} units)`,
                }))}
                value={selectedTxId}
                onChange={val => setSelectedTxId(val)}
                placeholder="-- Switch Rebrand Record --"
              />
            </div>
          )}
        </div>

        {selectedTx ? (
          <div className="p-5 flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Delivery Note Details */}
              <div className="bg-surface-elevated/30 border border-border rounded-xl p-4 flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  Rebrand Reference
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

              {/* Product Info */}
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
                    Product Under Transaction
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

            {/* Reversion Flow Comparison Box */}
            <div className="bg-surface-elevated/40 border border-border rounded-xl p-4 flex flex-col gap-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                Reversion Inventory Flow:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                {/* Deduct From Converted */}
                <div className="p-3.5 bg-danger/5 border border-danger/20 rounded-xl flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-danger/10 text-danger flex items-center justify-center shrink-0">
                    <MinusCircle size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-danger block">
                      Deduct from Converted
                    </span>
                    <span className="text-xs font-bold text-text-primary block truncate">
                      {toProdName}
                    </span>
                  </div>
                </div>

                {/* Restore Into Original */}
                <div className="p-3.5 bg-success/5 border border-success/20 rounded-xl flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-success/10 text-success flex items-center justify-center shrink-0">
                    <PlusCircle size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-success block">
                      Restore back to Original
                    </span>
                    <span className="text-xs font-bold text-text-primary block truncate">
                      {fromProdName}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {selectedTx.notes && (
              <div className="text-xs text-text-muted bg-surface-elevated/20 rounded-lg p-2.5 border border-border/50 flex items-start gap-2">
                <Info size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <span><strong>Original Notes:</strong> {selectedTx.notes}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-text-muted">
            No active rebrand records available to revert.
          </div>
        )}
      </div>

      {/* 3. Revert Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm flex flex-col gap-6">
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <Undo2 size={16} className="text-amber-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-text-primary">
              2. Reversion Details &amp; Quantity
            </span>
          </div>

          {/* Info Warning Banner */}
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
            <ShieldAlert size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1 text-xs">
              <span className="font-bold text-amber-600 dark:text-amber-400 text-sm">
                Important: Warehouse Stock Restoration
              </span>
              <p className="text-text-secondary leading-relaxed">
                Reverting will subtract <strong>{quantity || selectedTx?.quantity || 0} units</strong> from <strong>{toProdName}</strong> in warehouse stock, credit them back under <strong>{fromProdName}</strong>, and restore any original serialized barcodes to <em>AVAILABLE</em>.
              </p>
            </div>
          </div>

          {/* Quantity to Revert */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-text-secondary">
                Quantity to Revert <span className="text-danger">*</span>
              </label>
              {selectedTx && (
                <span className="text-xs text-text-muted">
                  Max Revertible: <strong className="font-mono text-primary font-bold">{selectedTx.quantity} units</strong>
                </span>
              )}
            </div>
            <input
              type="number"
              step="any"
              min="0.001"
              max={selectedTx ? selectedTx.quantity : undefined}
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              placeholder="Enter quantity to revert"
              required
              className="w-full bg-surface text-text-primary border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 font-mono font-bold"
            />
          </div>

          {/* Reversion Reason / Remarks */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-secondary">
              Reversion Reason / Remarks (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Canceled rebranding initiative, restoring stock to original product definition..."
              className="w-full bg-surface text-text-primary border border-border rounded-xl p-3 text-xs focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 resize-none"
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
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-sm hover:shadow transition-all disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Reverting Rebrand...</span>
              </>
            ) : (
              <>
                <Undo2 size={15} />
                <span>Confirm Revert to Old Product</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
