'use client';

import { useState, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Package, Search, Store, Trash2, CheckCircle2, AlertCircle, Loader2, ChevronDown, ChevronRight, List, History } from 'lucide-react';
import { processOutboundReturns } from '@/app/actions/transactions';
import TransactionActions from '@/components/TransactionActions';

export default function UsedClient({ transactions, stores, pastUsed = [] }) {
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
  const [selectedIds, setSelectedIds] = useState({});  // { [txId]: { notes: '' } }
  const [expandedGroups, setExpandedGroups] = useState(initialDN ? { [initialDN]: true } : {});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const filteredTransactions = useMemo(() => transactions.filter(tx => {
    const matchDN = !searchDN || tx.deliveryNote?.toLowerCase().includes(searchDN.toLowerCase());
    const matchStore = !searchStore || tx.toEntityId === searchStore;
    return matchDN && matchStore;
  }), [transactions, searchDN, searchStore]);

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

  const handleSelect = (txId, isSelected) => {
    setSelectedIds(prev => {
      if (!isSelected) { const next = { ...prev }; delete next[txId]; return next; }
      return { ...prev, [txId]: { notes: '' } };
    });
  };

  const handleNotes = (txId, value) => {
    setSelectedIds(prev => ({ ...prev, [txId]: { ...prev[txId], notes: value } }));
  };

  const handleSelectGroup = (group) => {
    const allSelected = group.items.every(tx => !!selectedIds[tx.id]);
    setSelectedIds(prev => {
      const next = { ...prev };
      if (allSelected) { group.items.forEach(tx => delete next[tx.id]); }
      else { group.items.forEach(tx => { if (!next[tx.id]) next[tx.id] = { notes: '' }; }); }
      return next;
    });
  };

  const toggleGroup = (dn) => setExpandedGroups(prev => ({ ...prev, [dn]: !prev[dn] }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    const payload = Object.keys(selectedIds).map(id => ({
      transactionId: id, actionType: 'USED', qty: 0,
      notes: selectedIds[id].notes || 'Marked as used/consumed',
    }));
    if (payload.length === 0) { setError('Select at least one item to mark as used.'); return; }
    setIsSubmitting(true);
    try {
      const res = await processOutboundReturns(payload);
      if (res.success) { setSuccess('Items marked as used/consumed successfully!'); setSelectedIds({}); }
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally { setIsSubmitting(false); }
  };

  const selectedCount = Object.keys(selectedIds).length;

  return (
    <div className="flex flex-col gap-6 relative">
      <div className="absolute top-0 right-0 pointer-events-none opacity-5 overflow-hidden">
        <Trash2 size={250} />
      </div>
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 pb-4 sm:pb-5 border-b border-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-text-primary tracking-tight flex items-center gap-3">
            <Trash2 className="text-warning" size={28} /> Mark as Used / Consumed
          </h1>
          <p className="text-sm font-medium text-text-secondary mt-1">
            Mark disposable items as fully used. Stock will not return to warehouse.
          </p>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-elevated/30 border border-border rounded-xl p-1 w-fit">
        <button onClick={() => changeTab('transactions')}
          className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors flex items-center gap-2 ${activeTab === 'transactions' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}>
          <List size={15} /> All Items
        </button>
        <button onClick={() => changeTab('grouped')}
          className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors flex items-center gap-2 ${activeTab === 'grouped' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}>
          <ChevronDown size={15} /> By Delivery Note
        </button>
        <button onClick={() => changeTab('history')}
          className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors flex items-center gap-2 ${activeTab === 'history' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}>
          <History size={15} /> Consumed History (Undo)
        </button>
      </div>

      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col">
        {/* Filters */}
        {activeTab !== 'history' && (
          <div className="p-4 border-b border-border bg-surface-elevated/30 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Store size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <select value={searchStore} onChange={(e) => setSearchStore(e.target.value)}
                className="w-full bg-surface text-text-primary border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors font-semibold appearance-none">
                <option value="">All Stores</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input type="text" placeholder="Search Delivery Note..." value={searchDN}
                onChange={(e) => setSearchDN(e.target.value)}
                className="w-full bg-surface text-text-primary border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors font-semibold font-mono" />
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
                <div className="py-12 text-center text-text-muted flex flex-col items-center gap-2"><Package size={32} className="opacity-20" /><span>No disposable items pending.</span></div>
              ) : filteredTransactions.map(tx => {
                const isSelected = !!selectedIds[tx.id];
                const remainingQty = tx.quantity - (tx.returnedQty || 0);
                return (
                  <div key={tx.id} className={`bg-surface border rounded-xl p-4 flex flex-col gap-2.5 transition-all ${isSelected ? 'border-warning bg-warning/5' : 'border-border'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={isSelected} onChange={(e) => handleSelect(tx.id, e.target.checked)} className="w-4 h-4 rounded accent-warning cursor-pointer" />
                          <span className="font-semibold text-sm text-warning truncate">{tx.product?.name}</span>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-warning/15 text-warning tracking-wider">DISPOSABLE</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-text-muted">
                          <span>{stores.find(s => s.id === tx.toEntityId)?.name || 'Unknown'}</span>
                          <span>·</span>
                          <span>{new Date(tx.timestamp).toLocaleDateString('en-AE', { timeZone: 'Asia/Dubai', day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-sm flex-shrink-0">{remainingQty}</span>
                    </div>
                    {tx.deliveryNote && <div className="text-[11px] text-text-muted font-mono">DN: {tx.deliveryNote}</div>}
                    {isSelected && (
                      <div className="pt-2 border-t border-border/50">
                        <input type="text" placeholder="Notes..." value={selectedIds[tx.id]?.notes || ''} onChange={(e) => handleNotes(tx.id, e.target.value)} className="w-full bg-surface text-text-primary border border-border rounded-lg px-2 py-1.5 text-xs" />
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
                    <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Date &amp; DN</th>
                    <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Store</th>
                    <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-right">Qty to Mark</th>
                    <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredTransactions.length === 0 ? (
                    <tr><td colSpan="6" className="py-12 text-center text-text-muted">
                      <div className="flex flex-col items-center gap-2"><Package size={32} className="opacity-20" /><span>No disposable items pending.</span></div>
                    </td></tr>
                  ) : filteredTransactions.map(tx => {
                    const isSelected = !!selectedIds[tx.id];
                    const remainingQty = tx.quantity - (tx.returnedQty || 0);
                    return (
                      <tr key={tx.id} className={`transition-colors group/row ${isSelected ? 'bg-warning/5' : 'hover:bg-surface-elevated/30'}`}>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 sticky left-0 bg-surface group-hover/row:bg-surface-elevated z-10"><input type="checkbox" checked={isSelected} onChange={(e) => handleSelect(tx.id, e.target.checked)} className="w-4 h-4 rounded accent-warning cursor-pointer" /></td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 font-semibold text-warning max-w-[200px] truncate sticky left-10 bg-surface group-hover/row:bg-surface-elevated z-10 border-r border-border shadow-sm" title={tx.product?.name}>
                          {tx.product?.name}
                          <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-warning/15 text-warning tracking-wider">DISPOSABLE</span>
                        </td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap">
                          <div className="font-semibold text-text-primary text-[11px]">{new Date(tx.timestamp).toLocaleDateString('en-AE', { timeZone: 'Asia/Dubai', day: '2-digit', month: 'short', year: 'numeric' })}</div>
                          <div className="font-mono text-xs text-text-muted mt-0.5">{tx.deliveryNote || 'No DN'}</div>
                        </td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 font-semibold text-text-primary text-xs whitespace-nowrap">{stores.find(s => s.id === tx.toEntityId)?.name || 'Unknown'}</td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-right font-mono font-bold text-text-primary">{remainingQty}</td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">
                          <input type="text" placeholder="Optional notes..." disabled={!isSelected}
                            value={selectedIds[tx.id]?.notes || ''} onChange={(e) => handleNotes(tx.id, e.target.value)}
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

          {/* ── TAB: BY USAGE NOTE ── */}
          {activeTab === 'grouped' && (
            <div className="flex flex-col divide-y divide-border">
              {deliveryNoteGroups.length === 0 ? (
                <div className="py-16 text-center flex flex-col items-center gap-3 text-text-muted">
                  <Package size={48} className="opacity-20" />
                  <span className="font-semibold">No disposable delivery notes found.</span>
                </div>
              ) : deliveryNoteGroups.map(group => {
                const isExpanded = !!expandedGroups[group.dn];
                const allSelected = group.items.length > 0 && group.items.every(tx => !!selectedIds[tx.id]);
                const someSelected = group.items.some(tx => !!selectedIds[tx.id]);
                return (
                  <div key={group.dn} className="bg-surface">
                    <div onClick={() => toggleGroup(group.dn)}
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-elevated/30 transition-colors gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div onClick={(e) => { e.stopPropagation(); handleSelectGroup(group); }}
                          className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center cursor-pointer transition-colors ${allSelected ? 'bg-warning border-warning' : someSelected ? 'bg-warning/30 border-warning' : 'border-border bg-surface'}`}>
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
                      <button type="button" onClick={(e) => { e.stopPropagation(); handleSelectGroup(group); }}
                        className={`flex-shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${allSelected ? 'bg-warning/10 text-warning border-warning/20 hover:bg-warning/20' : 'bg-surface-elevated text-text-secondary border-border hover:bg-surface-elevated/60'}`}>
                        {allSelected ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-border bg-surface/50">
                        <table className="min-w-full divide-y divide-border text-[10px] sm:text-[11px] md:text-xs">
                          <thead>
                            <tr className="text-left text-xs font-bold text-text-secondary uppercase tracking-wider bg-surface-elevated/20">
                              <th className="py-2.5 px-5 pl-16 w-10"></th>
                              <th className="py-2.5 px-5">Product</th>
                              <th className="py-2.5 px-5 text-right">Qty to Mark</th>
                              <th className="py-2.5 px-5">Remarks</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border text-text-primary">
                            {group.items.map(tx => {
                              const isSelected = !!selectedIds[tx.id];
                              const remainingQty = tx.quantity - (tx.returnedQty || 0);
                              return (
                                <tr key={tx.id} className={`transition-colors ${isSelected ? 'bg-warning/5' : 'hover:bg-surface-elevated/40'}`}>
                                  <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 pl-16">
                                    <input type="checkbox" checked={isSelected} onChange={(e) => handleSelect(tx.id, e.target.checked)} className="w-4 h-4 rounded accent-warning cursor-pointer" />
                                  </td>
                                  <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 font-medium text-xs text-warning">{tx.product?.name}</td>
                                  <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-right font-mono font-bold text-text-primary text-xs">{remainingQty}</td>
                                  <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">
                                    <input type="text" placeholder="Optional notes..." disabled={!isSelected}
                                      value={selectedIds[tx.id]?.notes || ''} onChange={(e) => handleNotes(tx.id, e.target.value)}
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

          {/* ── TAB: CONSUMED HISTORY ── */}
          {activeTab === 'history' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-text-secondary border-collapse">
                <thead className="text-xs uppercase bg-surface-elevated text-text-muted font-bold tracking-wider sticky top-0 z-10 border-b border-border shadow-sm">
                  <tr>
                    <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Date</th>
                    <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Product</th>
                    <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Store</th>
                    <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-center">Consumed Qty</th>
                    <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Remarks</th>
                    <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-right">Actions / Undo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {pastUsed.length === 0 ? (
                    <tr><td colSpan="6" className="py-12 text-center text-text-muted">
                      <div className="flex flex-col items-center gap-2"><Package size={32} className="opacity-20" /><span>No consumed logs found.</span></div>
                    </td></tr>
                  ) : pastUsed.map(tx => {
                    const fromStore = stores.find(s => s.id === tx.fromEntityId)?.name || tx.fromEntityType || 'Store';
                    return (
                      <tr key={tx.id} className="hover:bg-surface-elevated/20 transition-colors">
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap text-xs text-text-secondary font-medium">
                          {new Date(tx.timestamp).toLocaleString('en-AE', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 font-semibold text-text-primary whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-warning font-bold">{tx.product?.name}</span>
                            <span className="text-[10px] text-text-muted mt-0.5">Brand: {tx.product?.brand?.name || 'General'}</span>
                          </div>
                        </td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 font-semibold text-xs text-text-secondary">{fromStore}</td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-center font-mono font-bold text-warning">-{tx.quantity}</td>
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
                <span className="text-xs font-semibold text-text-secondary">{selectedCount} item(s) selected to mark as used.</span>
              </div>
              <button type="submit" disabled={isSubmitting || selectedCount === 0}
                className="px-6 py-2.5 bg-warning hover:bg-warning/80 disabled:bg-warning/40 text-white font-bold text-sm rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer w-full sm:w-auto justify-center">
                {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                <span>Confirm Used / Consumed</span>
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
