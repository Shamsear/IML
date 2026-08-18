'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Package, Search, Store, ArrowLeft, RefreshCw, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { processOutboundReturns } from '@/app/actions/transactions';

export default function ReturnsClient({ transactions, stores }) {
  const searchParams = useSearchParams();
  const initialDN = searchParams.get('dn') || '';
  const [searchDN, setSearchDN] = useState(initialDN);
  const [searchStore, setSearchStore] = useState('');
  const [processingItems, setProcessingItems] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const matchDN = !searchDN || tx.deliveryNote?.toLowerCase().includes(searchDN.toLowerCase());
      const matchStore = !searchStore || tx.toEntityId === searchStore;
      return matchDN && matchStore;
    });
  }, [transactions, searchDN, searchStore]);

  const handleSelect = (txId, isSelected) => {
    setProcessingItems(prev => {
      const tx = transactions.find(t => t.id === txId);
      if (!isSelected) {
        const next = { ...prev };
        delete next[txId];
        return next;
      }
      return {
        ...prev,
        [txId]: {
          actionType: tx.product.isDisposable ? 'USED' : 'RETURN',
          qty: tx.quantity - (tx.returnedQty || 0),
          notes: ''
        }
      };
    });
  };

  const handleChange = (txId, field, value) => {
    setProcessingItems(prev => ({
      ...prev,
      [txId]: {
        ...prev[txId],
        [field]: value
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    const payload = Object.keys(processingItems).map(id => ({
      transactionId: id,
      ...processingItems[id]
    }));

    if (payload.length === 0) {
      setError('Select at least one item to process.');
      return;
    }

    // Validate quantities
    for (const item of payload) {
      if (item.actionType === 'RETURN' && (!item.qty || item.qty <= 0)) {
        setError('Return quantity must be greater than 0');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await processOutboundReturns(payload);
      if (res.success) {
        setSuccess('Processed successfully!');
        setProcessingItems({});
      }
    } catch (err) {
      setError(err.message || 'An error occurred while processing returns');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-fade-in pt-8 relative">
      <div className="absolute top-0 right-0 p-4 -mt-16 pointer-events-none opacity-5">
        <RefreshCw size={250} />
      </div>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 z-10 relative">
        <div className="flex flex-col gap-1">
          <Link href="/dashboard/outbound" className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary-hover mb-2 w-fit transition-colors">
            <ArrowLeft size={14} /> Back to Outbound
          </Link>
          <h1 className="text-3xl font-display font-extrabold text-text-primary tracking-tight flex items-center gap-3">
            <RefreshCw className="text-primary" size={28} />
            Returns & Usage Hub
          </h1>
          <p className="text-sm font-medium text-text-secondary mt-1">
            Process bulk returns, track usage, and automatically update warehouse stock.
          </p>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 border-b border-border bg-surface-elevated/30 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Store size={16} className="text-text-muted" />
            </div>
            <select
              value={searchStore}
              onChange={(e) => setSearchStore(e.target.value)}
              className="w-full bg-surface text-text-primary border border-border rounded-lg pl-10 pr-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-semibold appearance-none"
            >
              <option value="">All Stores</option>
              {stores.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={16} className="text-text-muted" />
            </div>
            <input
              type="text"
              placeholder="Search Delivery Note (e.g. DN-2401)..."
              value={searchDN}
              onChange={(e) => setSearchDN(e.target.value)}
              className="w-full bg-surface text-text-primary border border-border rounded-lg pl-10 pr-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-semibold font-mono"
            />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-text-secondary border-collapse">
              <thead className="text-xs uppercase bg-surface-elevated text-text-muted font-bold tracking-wider sticky top-0 z-10 border-b border-border shadow-sm">
                <tr>
                  <th className="py-3 px-5 w-10">
                  </th>
                  <th className="py-3 px-5">Date & DN</th>
                  <th className="py-3 px-5">Store</th>
                  <th className="py-3 px-5">Product</th>
                  <th className="py-3 px-5 text-right">Available</th>
                  <th className="py-3 px-5">Processing Action</th>
                  <th className="py-3 px-5 w-32">Qty</th>
                  <th className="py-3 px-5">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-text-muted font-medium bg-surface-elevated/10">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Package size={32} className="opacity-20" />
                        <span>No active outbound transactions found.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map(tx => {
                    const isSelected = !!processingItems[tx.id];
                    const remainingQty = tx.quantity - (tx.returnedQty || 0);
                    const itemState = processingItems[tx.id];

                    return (
                      <tr key={tx.id} className={`transition-colors ${isSelected ? 'bg-primary/5' : 'hover:bg-surface-elevated/30'}`}>
                        <td className="py-3 px-5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleSelect(tx.id, e.target.checked)}
                            className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-5 whitespace-nowrap">
                          <div className="font-semibold text-text-primary text-[11px]">{format(new Date(tx.timestamp), 'dd MMM yyyy')}</div>
                          <div className="font-mono text-xs text-text-muted mt-0.5">{tx.deliveryNote || 'No DN'}</div>
                        </td>
                        <td className="py-3 px-5 font-semibold text-text-primary text-xs whitespace-nowrap">
                          {stores.find(s => s.id === tx.toEntityId)?.name || 'Unknown Store'}
                        </td>
                        <td className="py-3 px-5 font-semibold text-primary max-w-[200px] truncate" title={tx.product?.name}>
                          {tx.product?.name}
                          {tx.product?.isDisposable && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-warning/15 text-warning tracking-wider">DISPOSABLE</span>
                          )}
                        </td>
                        <td className="py-3 px-5 text-right font-mono font-bold text-text-primary">
                          {remainingQty}
                        </td>
                        <td className="py-3 px-5">
                          <select
                            disabled={!isSelected}
                            value={itemState?.actionType || (tx.product?.isDisposable ? 'USED' : 'RETURN')}
                            onChange={(e) => handleChange(tx.id, 'actionType', e.target.value)}
                            className="w-full min-w-[140px] bg-surface text-text-primary border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 font-bold disabled:opacity-50 disabled:bg-surface-elevated"
                          >
                            <option value="RETURN">Return to Warehouse</option>
                            <option value="USED">Mark as Used/Consumed</option>
                          </select>
                        </td>
                        <td className="py-3 px-5">
                          <input
                            type="number"
                            min="1"
                            max={remainingQty}
                            disabled={!isSelected || itemState?.actionType === 'USED'}
                            value={itemState?.actionType === 'USED' ? remainingQty : (itemState?.qty || '')}
                            onChange={(e) => handleChange(tx.id, 'qty', parseInt(e.target.value || '0', 10))}
                            className="w-full bg-surface text-text-primary border border-border rounded-lg px-2 py-1.5 text-xs font-mono disabled:opacity-50 disabled:bg-surface-elevated disabled:text-text-muted"
                          />
                        </td>
                        <td className="py-3 px-5">
                          <input
                            type="text"
                            placeholder="Optional notes..."
                            disabled={!isSelected}
                            value={itemState?.notes || ''}
                            onChange={(e) => handleChange(tx.id, 'notes', e.target.value)}
                            className="w-full min-w-[150px] bg-surface text-text-primary border border-border rounded-lg px-2 py-1.5 text-xs disabled:opacity-50 disabled:bg-surface-elevated"
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-border bg-surface flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-col">
              {error && (
                <div className="text-danger text-xs font-bold flex items-center gap-1.5 mb-1 bg-danger/10 px-2 py-1 rounded">
                  <AlertCircle size={14} /> {error}
                </div>
              )}
              {success && (
                <div className="text-success text-xs font-bold flex items-center gap-1.5 mb-1 bg-success/10 px-2 py-1 rounded">
                  <CheckCircle2 size={14} /> {success}
                </div>
              )}
              <span className="text-xs font-semibold text-text-secondary">
                {Object.keys(processingItems).length} item(s) selected for processing.
              </span>
            </div>
            
            <button
              type="submit"
              disabled={isSubmitting || Object.keys(processingItems).length === 0}
              className="px-6 py-2.5 bg-primary hover:bg-primary-hover disabled:bg-primary/50 text-white font-bold text-sm rounded-xl shadow-sm transition-all duration-200 flex items-center gap-2 cursor-pointer w-full sm:w-auto justify-center"
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              <span>Confirm Processing</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

