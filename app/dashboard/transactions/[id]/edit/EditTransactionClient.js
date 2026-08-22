'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Save, Loader2, AlertCircle, Plus, Trash2, Smartphone, QrCode } from 'lucide-react';
import Link from 'next/link';
import CustomSelect from '@/components/CustomSelect';
import { updateFullTransaction, createSingleTransaction } from '@/app/actions/transactions';

export default function EditTransactionClient({ transaction, products, stores }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isCopyMode = searchParams.get('mode') === 'copy';

  
  // Format the existing timestamp nicely for a local datetime-local input
  const initialDate = new Date(transaction.timestamp);
  // Pad function
  const pad = (n) => String(n).padStart(2, '0');
  const dtLocal = `${initialDate.getFullYear()}-${pad(initialDate.getMonth() + 1)}-${pad(initialDate.getDate())}T${pad(initialDate.getHours())}:${pad(initialDate.getMinutes())}`;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    timestamp: dtLocal,
    productId: transaction.productId,
    quantity: transaction.quantity,
    fromEntityType: transaction.fromEntityType || '',
    fromEntityId: transaction.fromEntityId || '',
    toEntityType: transaction.toEntityType || '',
    toEntityId: transaction.toEntityId || '',
    notes: transaction.notes || '',
    deliveryNote: transaction.deliveryNote || '',
  });

  // Extract old barcodes if any (but empty if copy mode)
  const [barcodes, setBarcodes] = useState(
    isCopyMode ? [] : transaction.serialNumbers.map(sn => sn.serialNumber.barcode)
  );
  
  const [newBarcode, setNewBarcode] = useState('');

  const selectedProduct = products.find(p => p.id === formData.productId);
  const isSerialized = selectedProduct?.isSerialized;

  // If copy mode & serialized, quantity must start at 0
  useEffect(() => {
    if (isCopyMode && selectedProduct?.isSerialized) {
      setFormData(prev => ({ ...prev, quantity: 0 }));
    }
  }, [isCopyMode, selectedProduct?.isSerialized]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddBarcode = () => {
    const val = newBarcode.trim();
    if (!val) return;
    if (barcodes.includes(val)) {
      setError(`Barcode ${val} is already added.`);
      return;
    }
    setBarcodes(prev => [...prev, val]);
    setFormData(prev => ({ ...prev, quantity: prev.quantity + 1 }));
    setNewBarcode('');
    setError('');
  };

  const handleRemoveBarcode = (code) => {
    setBarcodes(prev => prev.filter(b => b !== code));
    setFormData(prev => ({ ...prev, quantity: Math.max(0, prev.quantity - 1) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (isSerialized && formData.quantity !== barcodes.length) {
      setError(`Quantity (${formData.quantity}) does not match number of scanned serials (${barcodes.length}).`);
      setLoading(false);
      return;
    }

    try {
      if (isCopyMode) {
        await createSingleTransaction({
          ...formData,
          quantity: parseInt(formData.quantity, 10),
          barcodes,
          transactionType: transaction.transactionType
        });
      } else {
        await updateFullTransaction(transaction.id, {
          ...formData,
          quantity: parseInt(formData.quantity, 10),
          barcodes,
          transactionType: transaction.transactionType
        });
      }
      
      // Navigate back based on transaction type
      if (transaction.transactionType === 'RECEIVE') router.push('/dashboard/inbound');
      else if (transaction.transactionType === 'ISSUE') router.push('/dashboard/outbound');
      else if (transaction.transactionType === 'DAMAGE' || transaction.transactionType === 'LOST') router.push('/dashboard/damage');
      else if (transaction.transactionType.startsWith('REBRAND')) router.push('/dashboard/rebrand');
      else router.push('/dashboard/transactions');
      
    } catch (err) {
      setError(err.message || 'Failed to update transaction');
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <header className="flex items-center gap-4 pb-5 border-b border-border">
        <button 
          onClick={() => router.back()}
          className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-border bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-2xl font-display font-extrabold text-text-primary tracking-tight">
            {isCopyMode ? 'Copy Transaction' : 'Edit Transaction'}
          </h1>
          <p className="text-text-secondary text-sm mt-1 font-mono">
            {isCopyMode ? 'Creating new duplicate' : `ID: ${transaction.id}`}
          </p>
        </div>
        <div className="ml-auto">
          <span className="px-3 py-1 bg-surface-elevated border border-border rounded text-xs font-bold uppercase tracking-wider text-text-secondary">
            {transaction.transactionType}
          </span>
        </div>
      </header>

      {error && (
        <div className="p-4 bg-danger/10 border border-danger/20 rounded-xl flex items-start gap-3 text-danger">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <p className="text-sm font-semibold">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        
        {/* Timestamp */}
        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">Date & Time</h2>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Timestamp</label>
            <input
              type="datetime-local"
              name="timestamp"
              value={formData.timestamp}
              onChange={handleChange}
              required
              className="w-full bg-surface-elevated border border-border rounded-lg px-4 py-2 text-sm text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-colors outline-none"
            />
          </div>
        </div>

        {/* Entities */}
        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-4">Locations & Entities</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">From Type</label>
              <input
                type="text"
                name="fromEntityType"
                value={formData.fromEntityType}
                onChange={handleChange}
                className="w-full bg-surface-elevated border border-border rounded-lg px-4 py-2 text-sm text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-colors outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">From ID</label>
              <input
                type="text"
                name="fromEntityId"
                value={formData.fromEntityId}
                onChange={handleChange}
                className="w-full bg-surface-elevated border border-border rounded-lg px-4 py-2 text-sm text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-colors outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">To Type</label>
              <input
                type="text"
                name="toEntityType"
                value={formData.toEntityType}
                onChange={handleChange}
                className="w-full bg-surface-elevated border border-border rounded-lg px-4 py-2 text-sm text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-colors outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">To ID</label>
              <input
                type="text"
                name="toEntityId"
                value={formData.toEntityId}
                onChange={handleChange}
                className="w-full bg-surface-elevated border border-border rounded-lg px-4 py-2 text-sm text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-colors outline-none"
              />
            </div>
          </div>
        </div>

        {/* Product & Quantity */}
        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">Product Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Product</label>
              <select
                name="productId"
                value={formData.productId}
                onChange={handleChange}
                required
                className="w-full bg-surface-elevated border border-border rounded-lg px-4 py-2.5 text-sm font-semibold text-text-primary focus:border-primary outline-none"
              >
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.itemCode ? `(${p.itemCode})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Quantity</label>
              <input
                type="number"
                name="quantity"
                min="1"
                value={formData.quantity}
                onChange={handleChange}
                readOnly={isSerialized}
                required
                className={`w-full bg-surface-elevated border border-border rounded-lg px-4 py-2.5 text-sm font-mono font-bold focus:border-primary outline-none ${isSerialized ? 'opacity-70' : ''}`}
              />
              {isSerialized && <p className="text-[10px] text-text-muted mt-1">Quantity is auto-calculated for serialized products.</p>}
            </div>
          </div>

          {/* Serialized Barcodes Editor */}
          {isSerialized && (
            <div className="mt-4 border-t border-border pt-4">
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Serial Numbers / Barcodes ({barcodes.length})</label>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newBarcode}
                  onChange={(e) => setNewBarcode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddBarcode())}
                  placeholder="Scan or type barcode"
                  className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={handleAddBarcode}
                  className="px-3 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg flex items-center justify-center transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>

              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 bg-surface-elevated rounded-lg border border-border">
                {barcodes.length === 0 ? (
                  <span className="text-xs text-text-muted italic w-full text-center py-2">No serial numbers attached.</span>
                ) : (
                  barcodes.map((code, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1.5 bg-surface border border-border pl-2 pr-1 py-1 rounded-md text-xs font-mono font-medium">
                      {code}
                      <button
                        type="button"
                        onClick={() => handleRemoveBarcode(code)}
                        className="p-0.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Notes & Delivery Note */}
        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">Additional Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Delivery Note No.</label>
              <input
                type="text"
                name="deliveryNote"
                value={formData.deliveryNote}
                onChange={handleChange}
                placeholder="Optional"
                className="w-full bg-surface-elevated border border-border rounded-lg px-4 py-2 text-sm text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Remarks / Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={2}
                placeholder="Optional notes"
                className="w-full bg-surface-elevated border border-border rounded-lg px-4 py-2 text-sm text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-colors outline-none resize-none"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-4 border-t border-border">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-primary hover:bg-primary-hover disabled:bg-primary/50 text-white font-bold text-sm rounded-lg shadow-lg shadow-primary/20 transition-all cursor-pointer"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            <span>{loading ? 'Saving Changes...' : 'Save Transaction'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
