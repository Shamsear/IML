'use client';

import { useState, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Package, Search, Store, RotateCcw, CheckCircle2, AlertCircle, Loader2, ChevronDown, ChevronRight, List, History, FileText } from 'lucide-react';
import { processOutboundReturns } from '@/app/actions/transactions';
import TransactionActions from '@/components/TransactionActions';

export default function ReturnsClient({ transactions, stores, pastReturns = [] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialDN = searchParams.get('dn') || '';
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || (initialDN ? 'grouped' : 'transactions'));

  const changeTab = (tab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const [searchDN, setSearchDN] = useState(initialDN);
  const [searchStore, setSearchStore] = useState('');
  const [processingItems, setProcessingItems] = useState({});
  const [expandedGroups, setExpandedGroups] = useState(initialDN ? { [initialDN]: true } : {});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // --- Filtering ---
  const filteredTransactions = useMemo(() => transactions.filter(tx => {
    const matchDN = !searchDN || tx.deliveryNote?.toLowerCase().includes(searchDN.toLowerCase());
    const matchStore = !searchStore || tx.toEntityId === searchStore;
    return matchDN && matchStore;
  }), [transactions, searchDN, searchStore]);

  // --- Grouping by Return Note ---
  const deliveryNoteGroups = useMemo(() => {
    const groups = {};
    filteredTransactions.forEach(tx => {
      const key = tx.deliveryNote || 'No DN';
      if (!groups[key]) {
        groups[key] = { dn: key, storeName: stores.find(s => s.id === tx.toEntityId)?.name || 'Unknown', storeId: tx.toEntityId, timestamp: tx.timestamp, items: [] };
      }
      groups[key].items.push(tx);
    });
    return Object.values(groups).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [filteredTransactions, stores]);

  // --- Selection helpers ---
  const handleSelect = (txId, isSelected) => {
    setProcessingItems(prev => {
      const tx = transactions.find(t => t.id === txId);
      if (!isSelected) { const next = { ...prev }; delete next[txId]; return next; }
      return { ...prev, [txId]: { actionType: 'RETURN', qty: tx.quantity - (tx.returnedQty || 0), notes: '' } };
    });
  };

  const handleChange = (txId, field, value) => {
    setProcessingItems(prev => ({ ...prev, [txId]: { ...prev[txId], [field]: value } }));
  };

  const handleSelectGroup = (group) => {
    const allSelected = group.items.every(tx => !!processingItems[tx.id]);
    setProcessingItems(prev => {
      const next = { ...prev };
      if (allSelected) {
        group.items.forEach(tx => delete next[tx.id]);
      } else {
        group.items.forEach(tx => {
          if (!next[tx.id]) next[tx.id] = { actionType: 'RETURN', qty: tx.quantity - (tx.returnedQty || 0), notes: '' };
        });
      }
      return next;
    });
  };

  const toggleGroup = (dn) => setExpandedGroups(prev => ({ ...prev, [dn]: !prev[dn] }));

  // --- Submit ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    const payload = Object.keys(processingItems).map(id => ({ transactionId: id, ...processingItems[id], actionType: 'RETURN' }));
    if (payload.length === 0) { setError('Select at least one item to return.'); return; }
    for (const item of payload) {
      if (!item.qty || item.qty <= 0) { setError('Return quantity must be greater than 0'); return; }
    }
    setIsSubmitting(true);
    try {
      const res = await processOutboundReturns(payload);
      if (res.success) { setSuccess('Stock returned to warehouse successfully!'); setProcessingItems({}); }
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally { setIsSubmitting(false); }
  };

  const selectedCount = Object.keys(processingItems).length;

  return (
    <div className="flex flex-col gap-6 relative">
      <div className="absolute top-0 right-0 pointer-events-none opacity-5 overflow-hidden">
        <RotateCcw size={250} />
      </div>

      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 pb-4 sm:pb-5 border-b border-border z-10 relative">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-text-primary tracking-tight flex items-center gap-3">
            <RotateCcw className="text-primary" size={28} /> Stock Returns
          </h1>
          <p className="text-sm font-medium text-text-secondary mt-1">
            Return issued stock back to the warehouse. Only returnable products appear here.
          </p>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-elevated/30 border border-border rounded-xl p-1 w-fit">
        <button onClick={() => changeTab('transactions')}
          className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${activeTab === 'transactions' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}>
          <List size={15} /> All Items
        </button>
        <button onClick={() => changeTab('grouped')}
          className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${activeTab === 'grouped' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}>
          <ChevronDown size={15} /> By Delivery Notes
        </button>
        <button onClick={() => changeTab('history')}
          className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${activeTab === 'history' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}>
          <History size={15} /> Returns History (Undo)
        </button>
      </div>

      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col">
        {/* Filters */}
        {activeTab !== 'history' && (
          <div className="p-4 border-b border-border bg-surface-elevated/30 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Store size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <select value={searchStore} onChange={(e) => setSearchStore(e.target.value)}
                className="w-full bg-surface text-text-primary border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-semibold appearance-none">
                <option value="">All Stores</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input type="text" placeholder="Search Delivery Note..." value={searchDN}
                onChange={(e) => setSearchDN(e.target.value)}
                className="w-full bg-surface text-text-primary border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-semibold font-mono" />
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col">

          {/* ── TAB: ALL ITEMS ── */}
          {activeTab === 'transactions' && (
            <>
            {/* Mobile Card View */}
            <div className="md:hidden flex flex-col gap-3 p-4">
              {filteredTransactions.length === 0 ? (
                <div className="py-12 text-center text-text-muted flex flex-col items-center gap-2"><Package size={32} className="opacity-20" /><span>No returnable items found.</span></div>
              ) : filteredTransactions.map(tx => {
                const isSelected = !!processingItems[tx.id];
                const remainingQty = tx.quantity - (tx.returnedQty || 0);
                const itemState = processingItems[tx.id];
                return (
                  <div key={tx.id} className={`bg-surface border rounded-xl p-4 flex flex-col gap-2.5 transition-all ${isSelected ? 'border-primary bg-primary/5' : 'border-border'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={isSelected} onChange={(e) => handleSelect(tx.id, e.target.checked)} className="w-4 h-4 rounded accent-primary cursor-pointer" />
                          <span className="font-semibold text-sm text-primary truncate">{tx.product?.name}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-text-muted">
                          <span>{stores.find(s => s.id === tx.toEntityId)?.name || 'Unknown'}</span>
                          <span>·</span>
                          <span>{new Date(tx.timestamp).toLocaleDateString('en-AE', { timeZone: 'Asia/Dubai', day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-sm flex-shrink-0">{remainingQty}</span>
                    </div>
                    {tx.deliveryNote && <div className="text-[11px] text-primary font-mono font-semibold">DN: {tx.deliveryNote}</div>}
                    {isSelected && (
                      <div className="flex gap-2 pt-2 border-t border-border/50">
                        <input type="number" min="1" max={remainingQty} placeholder="Qty" value={itemState?.qty || ''} onChange={(e) => handleChange(tx.id, 'qty', parseInt(e.target.value || '0', 10))} className="w-20 bg-surface text-text-primary border border-border rounded-lg px-2 py-1.5 text-xs font-mono" />
                        <input type="text" placeholder="Notes..." value={itemState?.notes || ''} onChange={(e) => handleChange(tx.id, 'notes', e.target.value)} className="flex-1 bg-surface text-text-primary border border-border rounded-lg px-2 py-1.5 text-xs" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm text-text-secondary border-collapse">
                <thead className="text-xs uppercase bg-surface-elevated text-text-muted font-bold tracking-wider sticky top-0 z-10 border-b border-border shadow-sm">
                  <tr>
                    <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 w-10 sticky left-0 bg-surface-elevated z-20"></th>
                    <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 sticky left-10 bg-surface-elevated z-20 border-r border-border shadow-sm">Product</th>
                    <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Date</th>
                    <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Store</th>
                    <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-right">Available</th>
                    <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 w-32">Return Qty</th>
                    <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Delivery Note</th>
                    <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredTransactions.length === 0 ? (
                    <tr><td colSpan="8" className="py-12 text-center text-text-muted">
                      <div className="flex flex-col items-center gap-2"><Package size={32} className="opacity-20" /><span>No returnable items found.</span></div>
                    </td></tr>
                  ) : filteredTransactions.map(tx => {
                    const isSelected = !!processingItems[tx.id];
                    const remainingQty = tx.quantity - (tx.returnedQty || 0);
                    const itemState = processingItems[tx.id];
                    return (
                      <tr key={tx.id} className={`transition-colors group/row ${isSelected ? 'bg-primary/5' : 'hover:bg-surface-elevated/30'}`}>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 sticky left-0 bg-surface group-hover/row:bg-surface-elevated z-10"><input type="checkbox" checked={isSelected} onChange={(e) => handleSelect(tx.id, e.target.checked)} className="w-4 h-4 rounded accent-primary cursor-pointer" /></td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 font-semibold text-primary max-w-[200px] truncate sticky left-10 bg-surface group-hover/row:bg-surface-elevated z-10 border-r border-border shadow-sm" title={tx.product?.name}>{tx.product?.name}</td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap">
                          <div className="font-semibold text-text-primary text-[11px]">{new Date(tx.timestamp).toLocaleDateString('en-AE', { timeZone: 'Asia/Dubai', day: '2-digit', month: 'short', year: 'numeric' })}</div>
                        </td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 font-semibold text-text-primary text-xs whitespace-nowrap">{stores.find(s => s.id === tx.toEntityId)?.name || 'Unknown'}</td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-right font-mono font-bold text-text-primary">{remainingQty}</td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">
                          <input type="number" min="1" max={remainingQty} disabled={!isSelected}
                            value={itemState?.qty || ''} onChange={(e) => handleChange(tx.id, 'qty', parseInt(e.target.value || '0', 10))}
                            className="w-full bg-surface text-text-primary border border-border rounded-lg px-2 py-1.5 text-xs font-mono disabled:opacity-50 disabled:bg-surface-elevated" />
                        </td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 font-mono text-xs text-text-secondary whitespace-nowrap">
                          {tx.deliveryNote ? (
                            <a
                              href={`/api/dashboard/returns/delivery-note?date=${new Date(tx.timestamp).toISOString().split('T')[0]}&brandId=${tx.product.brandId}&dn=${tx.deliveryNote}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:text-primary-hover hover:underline transition-colors font-semibold has-tooltip"
                            >
                              {tx.deliveryNote}
                              <span className="tooltip-box">Download Delivery Note PDF</span>
                            </a>
                          ) : (
                            <span className="text-text-muted">---</span>
                          )}
                        </td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">
                          <input type="text" placeholder="Optional notes..." disabled={!isSelected}
                            value={itemState?.notes || ''} onChange={(e) => handleChange(tx.id, 'notes', e.target.value)}
                            className="w-full min-w-[150px] bg-surface text-text-primary border border-border rounded-lg px-2 py-1.5 text-xs disabled:opacity-50 disabled:bg-surface-elevated" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}

          {/* ── TAB: BY RETURN NOTE ── */}
          {activeTab === 'grouped' && (
            <div className="flex flex-col divide-y divide-border">
              {deliveryNoteGroups.length === 0 ? (
                <div className="py-16 text-center flex flex-col items-center gap-3 text-text-muted">
                  <Package size={48} className="opacity-20" />
                  <span className="font-semibold">No returnable delivery notes found.</span>
                </div>
              ) : deliveryNoteGroups.map(group => {
                const isExpanded = !!expandedGroups[group.dn];
                const allSelected = group.items.length > 0 && group.items.every(tx => !!processingItems[tx.id]);
                const someSelected = group.items.some(tx => !!processingItems[tx.id]);
                return (
                  <div key={group.dn} className="bg-surface">
                    {/* Group Header */}
                    <div onClick={() => toggleGroup(group.dn)}
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-elevated/30 transition-colors gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div onClick={(e) => { e.stopPropagation(); handleSelectGroup(group); }}
                          className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center cursor-pointer transition-colors ${allSelected ? 'bg-primary border-primary' : someSelected ? 'bg-primary/30 border-primary' : 'border-border bg-surface'}`}>
                          {(allSelected || someSelected) && <div className="w-2.5 h-2.5 bg-white rounded-sm" />}
                        </div>
                        {isExpanded ? <ChevronDown size={18} className="text-text-muted flex-shrink-0" /> : <ChevronRight size={18} className="text-text-muted flex-shrink-0" />}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-text-primary font-mono">{group.dn}</h3>
                            <span className="text-[10px] bg-secondary/15 text-secondary border border-secondary/10 px-2 py-0.5 rounded uppercase tracking-wider font-bold">{group.storeName}</span>
                          </div>
                          <p className="text-xs text-text-secondary mt-0.5">
                            {new Date(group.timestamp).toLocaleDateString('en-AE', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', year: 'numeric' })} • {group.items.length} product(s)
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <a
                          href={`/api/dashboard/returns/delivery-note?date=${new Date(group.timestamp).toISOString().split('T')[0]}&brandId=${group.items[0]?.product.brandId}&dn=${group.dn}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 font-bold text-xs rounded-lg transition-colors"
                        >
                          <FileText size={14} />
                          PDF
                        </a>
                        <button type="button" onClick={(e) => { e.stopPropagation(); handleSelectGroup(group); }}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${allSelected ? 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20' : 'bg-surface-elevated text-text-secondary border-border hover:bg-surface-elevated/60'}`}>
                          {allSelected ? 'Deselect All' : 'Select All'}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Items */}
                    {isExpanded && (
                      <div className="border-t border-border bg-surface/50">
                        <table className="min-w-full divide-y divide-border text-[11px] sm:text-xs md:text-sm">
                          <thead>
                            <tr className="text-left text-xs font-bold text-text-secondary uppercase tracking-wider bg-surface-elevated/20">
                              <th className="py-2.5 px-5 pl-16 w-10"></th>
                              <th className="py-2.5 px-5">Product</th>
                              <th className="py-2.5 px-5 text-right">Available</th>
                              <th className="py-2.5 px-5 w-32">Return Qty</th>
                              <th className="py-2.5 px-5">Remarks</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border text-text-primary">
                            {group.items.map(tx => {
                              const isSelected = !!processingItems[tx.id];
                              const remainingQty = tx.quantity - (tx.returnedQty || 0);
                              const itemState = processingItems[tx.id];
                              return (
                                <tr key={tx.id} className={`transition-colors ${isSelected ? 'bg-primary/5' : 'hover:bg-surface-elevated/40'}`}>
                                  <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 pl-16">
                                    <input type="checkbox" checked={isSelected} onChange={(e) => handleSelect(tx.id, e.target.checked)} className="w-4 h-4 rounded accent-primary cursor-pointer" />
                                  </td>
                                  <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 font-medium text-xs text-primary">{tx.product?.name}</td>
                                  <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-right font-mono font-bold text-text-primary text-xs">{remainingQty}</td>
                                  <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">
                                    <input type="number" min="1" max={remainingQty} disabled={!isSelected}
                                      value={itemState?.qty || ''} onChange={(e) => handleChange(tx.id, 'qty', parseInt(e.target.value || '0', 10))}
                                      className="w-full bg-surface text-text-primary border border-border rounded-lg px-2 py-1.5 text-xs font-mono disabled:opacity-50 disabled:bg-surface-elevated" />
                                  </td>
                                  <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">
                                    <input type="text" placeholder="Optional notes..." disabled={!isSelected}
                                      value={itemState?.notes || ''} onChange={(e) => handleChange(tx.id, 'notes', e.target.value)}
                                      className="w-full min-w-[140px] bg-surface text-text-primary border border-border rounded-lg px-2 py-1.5 text-xs disabled:opacity-50 disabled:bg-surface-elevated" />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── TAB: RETURNS HISTORY ── */}
          {activeTab === 'history' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-text-secondary border-collapse">
                <thead className="text-xs uppercase bg-surface-elevated text-text-muted font-bold tracking-wider sticky top-0 z-10 border-b border-border shadow-sm">
                  <tr>
                    <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Date</th>
                    <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Product</th>
                    <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Returned From</th>
                    <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-center">Returned Qty</th>
                    <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Remarks</th>
                    <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-right">Actions / Undo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {pastReturns.length === 0 ? (
                    <tr><td colSpan="6" className="py-12 text-center text-text-muted">
                      <div className="flex flex-col items-center gap-2"><Package size={32} className="opacity-20" /><span>No returns logs found.</span></div>
                    </td></tr>
                  ) : pastReturns.map(tx => {
                    const fromStore = stores.find(s => s.id === tx.fromEntityId)?.name || tx.fromEntityType || 'Store';
                    return (
                      <tr key={tx.id} className="hover:bg-surface-elevated/20 transition-colors">
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap text-xs text-text-secondary font-medium">
                          {new Date(tx.timestamp).toLocaleString('en-AE', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 font-semibold text-text-primary whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-primary font-bold">{tx.product?.name}</span>
                            <span className="text-[10px] text-text-muted mt-0.5">Brand: {tx.product?.brand?.name || 'General'}</span>
                          </div>
                        </td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 font-semibold text-xs text-text-secondary">{fromStore}</td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-center font-mono font-bold text-success">+{tx.quantity}</td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-xs text-text-secondary max-w-xs truncate" title={tx.notes || ''}>{tx.notes || '---'}</td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-right whitespace-nowrap">
                          <TransactionActions txId={tx.id} notes={tx.notes || ''} showDeliveryNote={false} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          {activeTab !== 'history' && (
            <div className="p-4 border-t border-border bg-surface flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex flex-col">
                {error && <div className="text-danger text-xs font-bold flex items-center gap-1.5 mb-1 bg-danger/10 px-2 py-1 rounded"><AlertCircle size={14} /> {error}</div>}
                {success && <div className="text-success text-xs font-bold flex items-center gap-1.5 mb-1 bg-success/10 px-2 py-1 rounded"><CheckCircle2 size={14} /> {success}</div>}
                <span className="text-xs font-semibold text-text-secondary">{selectedCount} item(s) selected for return.</span>
              </div>
              <button type="submit" disabled={isSubmitting || selectedCount === 0}
                className="px-6 py-2.5 bg-primary hover:bg-primary-hover disabled:bg-primary/50 text-white font-bold text-sm rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer w-full sm:w-auto justify-center">
                {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                <span>Confirm Return</span>
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
