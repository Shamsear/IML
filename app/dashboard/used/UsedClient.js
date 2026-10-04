'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Package, Search, Store, Trash2, CheckCircle2, AlertCircle, Loader2, ChevronDown, ChevronRight, List, History } from 'lucide-react';
import { processOutboundReturns } from '@/app/actions/transactions';
import TransactionActions from '@/components/TransactionActions';
import ConfirmModal from '@/components/ConfirmModal';
import ExportToExcel from '@/components/ExportToExcel';
import PageHeader from '@/components/PageHeader';
import Pagination from '@/components/Pagination';
import SortableHeader from '@/components/SortableHeader';
import { useTableSort } from '@/hooks/useTableSort';
import CustomSelect from '@/components/CustomSelect';
import DeliveryNoteLink from '@/components/DeliveryNoteLink';

export default function UsedClient({ transactions = [], stores = [], pastUsed = [] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialDN = searchParams.get('dn') || '';
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || (initialDN ? 'grouped' : 'transactions'));

  const changeTab = (tab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams ? searchParams.toString() : '');
    params.set('tab', tab);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `${pathname}?${params.toString()}`);
    }
  };
  const [searchDN, setSearchDN] = useState(initialDN);
  const [searchStore, setSearchStore] = useState('');
  const [selectedIds, setSelectedIds] = useState({});  // { [txId]: { notes: '' } }
  const [expandedGroups, setExpandedGroups] = useState(initialDN ? { [initialDN]: true } : {});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Pagination states
  const [txPage, setTxPage] = useState(1);
  const [groupPage, setGroupPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const itemsPerPage = 25;

  // Reset pages on filter
  const filteredTransactions = useMemo(() => (transactions || []).filter(tx => {
    const matchDN = !searchDN || tx.deliveryNote?.toLowerCase().includes(searchDN.toLowerCase());
    const matchStore = !searchStore || tx.toEntityId === searchStore;
    return matchDN && matchStore;
  }), [transactions, searchDN, searchStore]);

  const storeOptions = useMemo(() => [
    { value: '', label: 'All Stores' },
    ...stores.map(s => ({ value: s.id, label: s.name }))
  ], [stores]);

  const txCustomGetters = useMemo(() => ({
    product: (tx) => tx.product?.name || '',
    date: (tx) => tx.timestamp,
    store: (tx) => stores.find(s => s.id === tx.toEntityId)?.name || '',
    available: (tx) => tx.quantity - (tx.returnedQty || 0),
    remarks: (tx) => tx.notes || '',
  }), [stores]);

  const {
    sortedItems: sortedTransactions,
    sortField: txSortField,
    sortDirection: txSortDirection,
    handleSort: handleTxSort,
  } = useTableSort(filteredTransactions, 'date', 'desc', txCustomGetters);

  const totalTxPages = Math.ceil(sortedTransactions.length / itemsPerPage);
  const paginatedTransactions = sortedTransactions.slice((txPage - 1) * itemsPerPage, txPage * itemsPerPage);

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

  const totalGroupPages = Math.ceil(deliveryNoteGroups.length / itemsPerPage);
  const paginatedGroups = deliveryNoteGroups.slice((groupPage - 1) * itemsPerPage, groupPage * itemsPerPage);

  const historyCustomGetters = useMemo(() => ({
    date: (tx) => tx.timestamp,
    product: (tx) => tx.product?.name || '',
    store: (tx) => stores.find(s => s.id === tx.fromEntityId)?.name || tx.fromEntityType || '',
    quantity: (tx) => tx.quantity ?? 0,
    notes: (tx) => tx.notes || '',
  }), [stores]);

  const {
    sortedItems: sortedHistory,
    sortField: historySortField,
    sortDirection: historySortDirection,
    handleSort: handleHistorySort,
  } = useTableSort(pastUsed, 'date', 'desc', historyCustomGetters);

  const totalHistoryPages = Math.ceil(sortedHistory.length / itemsPerPage);
  const paginatedHistory = sortedHistory.slice((historyPage - 1) * itemsPerPage, historyPage * itemsPerPage);

  const handleSelect = (txId, isSelected) => {
    setSelectedIds(prev => {
      if (!isSelected) { const next = { ...prev }; delete next[txId]; return next; }
      const tx = transactions.find(t => t.id === txId);
      const remainingQty = tx ? (tx.quantity - (tx.returnedQty || 0)) : 1;
      return { ...prev, [txId]: { notes: '', qty: remainingQty } };
    });
  };

  const handleNotes = (txId, value) => {
    setSelectedIds(prev => ({ ...prev, [txId]: { ...prev[txId], notes: value } }));
  };

  const handleQty = (txId, value) => {
    setSelectedIds(prev => ({ ...prev, [txId]: { ...prev[txId], qty: value } }));
  };

  const handleSelectGroup = (group) => {
    const allSelected = group.items.every(tx => !!selectedIds[tx.id]);
    setSelectedIds(prev => {
      const next = { ...prev };
      if (allSelected) { group.items.forEach(tx => delete next[tx.id]); }
      else {
        group.items.forEach(tx => {
          if (!next[tx.id]) {
            const remainingQty = tx.quantity - (tx.returnedQty || 0);
            next[tx.id] = { notes: '', qty: remainingQty };
          }
        });
      }
      return next;
    });
  };

  const toggleGroup = (dn) => setExpandedGroups(prev => ({ ...prev, [dn]: !prev[dn] }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    const payload = Object.keys(selectedIds).map(id => ({
      transactionId: id,
      actionType: 'USED',
      qty: parseInt(selectedIds[id].qty || '0', 10),
      notes: selectedIds[id].notes || 'Marked as used/consumed',
    }));
    if (payload.length === 0) { setError('Select at least one item to mark as used.'); return; }
    for (const item of payload) {
      if (!item.qty || item.qty <= 0) {
        setError('Quantity to mark as used must be greater than 0.');
        return;
      }
    }
    setIsSubmitting(true);
    try {
      const res = await processOutboundReturns(payload);
      if (res.success) { 
        setConfirmOpen(true); 
        setSelectedIds({}); 
        router.refresh();
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally { setIsSubmitting(false); }
  };

  const selectedCount = Object.keys(selectedIds).length;

  return (
    <div className="flex flex-col gap-6 relative">
      <PageHeader
        icon={Trash2}
        title="Mark as Used / Consumed"
        description="Mark disposable items as fully used. Stock will not return to warehouse."
        actions={<>
          <ExportToExcel
            data={transactions.map(tx => ({
              Product: tx.product?.name || '',
              SKU: tx.product?.itemCode || '',
              Barcode: tx.barcode || '',
              Brand: tx.product?.brand?.name || '',
              Category: tx.product?.category || '',
              Store: stores.find(s => s.id === tx.toEntityId)?.name || tx.toEntityId || '',
              Quantity: tx.quantity,
              'Delivery Note': tx.deliveryNote || '',
              Date: new Date(tx.timestamp).toLocaleDateString('en-AE', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
              Notes: tx.notes || '',
            }))}
            columns={[
              { header: 'Product', key: 'Product', width: 25 },
              { header: 'SKU', key: 'SKU', width: 14 },
              { header: 'Barcode', key: 'Barcode', width: 22 },
              { header: 'Brand', key: 'Brand', width: 18 },
              { header: 'Category', key: 'Category', width: 18 },
              { header: 'Store', key: 'Store', width: 20 },
              { header: 'Quantity', key: 'Quantity', width: 10 },
              { header: 'Delivery Note', key: 'Delivery Note', width: 20 },
              { header: 'Date', key: 'Date', width: 18 },
              { header: 'Notes', key: 'Notes', width: 25 },
            ]}
            filename="IML-Used-Items"
          />
        </>
      }
      />

      {/* Tabs — horizontally scrollable on mobile */}
      <div className="w-full overflow-x-auto">
        <div className="flex gap-1 bg-surface-elevated/30 border border-border rounded-xl p-1 w-max min-w-full sm:w-fit">
          <button onClick={() => changeTab('transactions')}
            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'transactions' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}>
            <List size={14} /> All Items
          </button>
          <button onClick={() => changeTab('grouped')}
            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'grouped' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}>
            <ChevronDown size={14} /> By Delivery Note
          </button>
          <button onClick={() => changeTab('history')}
            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'history' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}>
            <History size={14} />
            <span className="sm:hidden">History</span>
            <span className="hidden sm:inline">Consumed History (Undo)</span>
          </button>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col">
        {/* Filters */}
        {activeTab !== 'history' && (
          <div className="p-4 border-b border-border bg-surface-elevated/30 flex flex-col gap-3">
            <div className="relative w-full">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input type="text" placeholder="Search Delivery Note or store..." value={searchDN}
                onChange={(e) => setSearchDN(e.target.value)}
                className="w-full bg-surface text-text-primary border border-border rounded-xl pl-10 pr-9 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-semibold font-mono shadow-xs" />
              {searchDN && (
                <button
                  type="button"
                  onClick={() => setSearchDN('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-0.5 rounded-full hover:bg-surface-elevated transition-colors"
                >
                  <X size={15} />
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div className="w-full">
                <CustomSelect
                  options={storeOptions}
                  value={searchStore}
                  onChange={(val) => setSearchStore(val)}
                  placeholder="All Stores"
                />
              </div>
              {(searchDN || searchStore) && (
                <div>
                  <button
                    type="button"
                    onClick={() => { setSearchDN(''); setSearchStore(''); }}
                    className="px-3 py-2.5 text-xs font-semibold text-text-secondary hover:text-danger hover:bg-danger/10 border border-border rounded-lg transition-all"
                  >
                    Clear Filters
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col">

          {/* ── TAB: ALL ITEMS ── */}
          {activeTab === 'transactions' && (
            <>
            {/* Top Pagination */}
            <Pagination
              currentPage={txPage}
              totalPages={totalTxPages}
              totalItems={filteredTransactions.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setTxPage}
              itemLabel="items"
            />

            {/* Mobile Card View */}
            <div className="md:hidden flex flex-col gap-3 p-4">
              {filteredTransactions.length === 0 ? (
                <div className="py-12 text-center text-text-muted flex flex-col items-center gap-2"><Package size={32} className="opacity-20" /><span>No disposable items pending.</span></div>
              ) : paginatedTransactions.map(tx => {
                const isSelected = !!selectedIds[tx.id];
                const remainingQty = tx.quantity - (tx.returnedQty || 0);
                return (
                  <div key={tx.id} className={`bg-surface border rounded-xl p-4 flex flex-col gap-2.5 transition-all ${isSelected ? 'border-warning bg-warning/5' : 'border-border'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <input type="checkbox" checked={isSelected} onChange={(e) => handleSelect(tx.id, e.target.checked)} className="w-4 h-4 rounded accent-warning cursor-pointer" />
                          <Link href={`/dashboard/products/${tx.product?.id}`} className="font-semibold text-sm text-warning truncate hover:text-warning transition-colors">{tx.product?.name}</Link>
                          {tx.product?.isReturnable && tx.product?.isDisposable ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/15 text-primary tracking-wider">RETURNABLE &amp; USED</span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-warning/15 text-warning tracking-wider">DISPOSABLE</span>
                          )}
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
                      <div className="pt-2 border-t border-border/50 flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-text-secondary font-semibold">Qty to Mark Used:</span>
                          <input
                            type="number"
                            min={1}
                            max={remainingQty}
                            value={selectedIds[tx.id]?.qty ?? remainingQty}
                            onChange={(e) => handleQty(tx.id, e.target.value)}
                            className="w-20 bg-surface text-text-primary border border-border rounded-lg px-2 py-1 text-xs font-mono font-bold text-center"
                          />
                        </div>
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
                    <th className="py-2.5 sm:py-3 pl-4 sm:pl-5 pr-2 w-10 sticky left-0 bg-surface-elevated z-20"></th>
                    <SortableHeader field="product" currentField={txSortField} direction={txSortDirection} onSort={handleTxSort} className="py-2.5 sm:py-3 pl-3 sm:pl-4 pr-3 sm:pr-5 sticky left-10 bg-surface-elevated z-20 border-r border-border shadow-sm">Product</SortableHeader>
                    <SortableHeader field="date" currentField={txSortField} direction={txSortDirection} onSort={handleTxSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Date &amp; DN</SortableHeader>
                    <SortableHeader field="store" currentField={txSortField} direction={txSortDirection} onSort={handleTxSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Store</SortableHeader>
                    <SortableHeader field="available" currentField={txSortField} direction={txSortDirection} onSort={handleTxSort} align="right" className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-right">Qty to Mark</SortableHeader>
                    <SortableHeader field="remarks" currentField={txSortField} direction={txSortDirection} onSort={handleTxSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Remarks</SortableHeader>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {sortedTransactions.length === 0 ? (
                    <tr><td colSpan="6" className="py-12 text-center text-text-muted">
                      <div className="flex flex-col items-center gap-2"><Package size={32} className="opacity-20" /><span>No disposable items pending.</span></div>
                    </td></tr>
                  ) : paginatedTransactions.map(tx => {
                    const isSelected = !!selectedIds[tx.id];
                    const remainingQty = tx.quantity - (tx.returnedQty || 0);
                    return (
                      <tr key={tx.id} className={`transition-colors group/row ${isSelected ? 'bg-warning/5' : 'hover:bg-surface-elevated/30'}`}>
                        <td className="py-2.5 sm:py-3 pl-4 sm:pl-5 pr-2 sticky left-0 bg-surface group-hover/row:bg-surface-elevated z-10"><input type="checkbox" checked={isSelected} onChange={(e) => handleSelect(tx.id, e.target.checked)} className="w-4 h-4 rounded accent-warning cursor-pointer" /></td>
                        <td className="py-2.5 sm:py-3 pl-3 sm:pl-4 pr-3 sm:pr-5 max-w-[200px] truncate sticky left-10 bg-surface group-hover/row:bg-surface-elevated z-10 border-r border-border shadow-sm" title={tx.product?.name}>
                          <Link href={`/dashboard/products/${tx.product?.id}`} className="font-semibold text-warning hover:text-warning transition-colors">{tx.product?.name}</Link>
                          {tx.product?.isReturnable && tx.product?.isDisposable ? (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/15 text-primary tracking-wider">RETURNABLE &amp; USED</span>
                          ) : (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-warning/15 text-warning tracking-wider">DISPOSABLE</span>
                          )}
                        </td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap">
                          <div className="font-semibold text-text-primary text-[11px]">{new Date(tx.timestamp).toLocaleDateString('en-AE', { timeZone: 'Asia/Dubai', day: '2-digit', month: 'short', year: 'numeric' })}</div>
                          <div className="font-mono text-xs text-text-muted mt-0.5">{tx.deliveryNote || 'No DN'}</div>
                        </td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 font-semibold text-text-primary text-xs whitespace-nowrap">{stores.find(s => s.id === tx.toEntityId)?.name || 'Unknown'}</td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-right font-mono font-bold text-text-primary whitespace-nowrap">
                          {isSelected ? (
                            <input
                              type="number"
                              min={1}
                              max={remainingQty}
                              value={selectedIds[tx.id]?.qty ?? remainingQty}
                              onChange={(e) => handleQty(tx.id, e.target.value)}
                              className="w-16 bg-surface text-text-primary font-mono font-bold text-center border border-warning rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-warning"
                            />
                          ) : (
                            <span>{remainingQty}</span>
                          )}
                        </td>
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

            {/* Bottom Pagination */}
            <Pagination
              currentPage={txPage}
              totalPages={totalTxPages}
              totalItems={filteredTransactions.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setTxPage}
              itemLabel="items"
            />
            </>
          )}

          {/* ── TAB: BY USAGE NOTE ── */}
          {activeTab === 'grouped' && (
            <>
            {/* Top Pagination */}
            <Pagination
              currentPage={groupPage}
              totalPages={totalGroupPages}
              totalItems={deliveryNoteGroups.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setGroupPage}
              itemLabel="delivery notes"
            />

            <div className="flex flex-col divide-y divide-border">
              {deliveryNoteGroups.length === 0 ? (
                <div className="py-16 text-center flex flex-col items-center gap-3 text-text-muted">
                  <Package size={48} className="opacity-20" />
                  <span className="font-semibold">No disposable delivery notes found.</span>
                </div>
              ) : paginatedGroups.map(group => {
                const isExpanded = !!expandedGroups[group.dn];
                const allSelected = group.items.length > 0 && group.items.every(tx => !!selectedIds[tx.id]);
                const someSelected = group.items.some(tx => !!selectedIds[tx.id]);
                return (
                  <div key={group.dn} className="bg-surface">
                    {/* Group Header — stacks on mobile, row on sm+ */}
                    <div
                      onClick={() => toggleGroup(group.dn)}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 cursor-pointer hover:bg-surface-elevated/30 transition-colors gap-3"
                    >
                      {/* Left: checkbox + chevron + info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          onClick={(e) => { e.stopPropagation(); handleSelectGroup(group); }}
                          className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center cursor-pointer transition-colors ${allSelected ? 'bg-warning border-warning' : someSelected ? 'bg-warning/30 border-warning' : 'border-border bg-surface'}`}
                        >
                          {(allSelected || someSelected) && <div className="w-2.5 h-2.5 bg-white rounded-sm" />}
                        </div>
                        {isExpanded ? <ChevronDown size={17} className="text-text-muted flex-shrink-0" /> : <ChevronRight size={17} className="text-text-muted flex-shrink-0" />}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-text-primary font-mono text-sm truncate">{group.dn}</h3>
                            <span className="text-[10px] bg-secondary/15 text-secondary border border-secondary/10 px-2 py-0.5 rounded uppercase tracking-wider font-bold whitespace-nowrap flex-shrink-0">{group.storeName}</span>
                          </div>
                          <p className="text-xs text-text-secondary mt-0.5">
                            {new Date(group.timestamp).toLocaleDateString('en-AE', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', year: 'numeric' })} · {group.items.length} product(s)
                          </p>
                        </div>
                      </div>
                      {/* Right: action button */}
                      <div className="flex flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleSelectGroup(group)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors whitespace-nowrap ${allSelected ? 'bg-warning/10 text-warning border-warning/20 hover:bg-warning/20' : 'bg-surface-elevated text-text-secondary border-border hover:bg-surface-elevated/60'}`}
                        >
                          {allSelected ? 'Deselect All' : 'Select All'}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-border bg-surface/50 overflow-x-auto">
                        <table className="min-w-full divide-y divide-border text-xs">
                          <thead>
                            <tr className="text-left text-[10px] font-bold text-text-secondary uppercase tracking-wider bg-surface-elevated/20">
                              <th className="py-2.5 pl-5 pr-3 w-10"></th>
                              <th className="py-2.5 px-3">Product</th>
                              <th className="py-2.5 px-3 text-right whitespace-nowrap">Qty to Mark</th>
                              <th className="py-2.5 px-3">Remarks</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border text-text-primary">
                            {group.items.map(tx => {
                              const isSelected = !!selectedIds[tx.id];
                              const remainingQty = tx.quantity - (tx.returnedQty || 0);
                              return (
                                <tr key={tx.id} className={`transition-colors ${isSelected ? 'bg-warning/5' : 'hover:bg-surface-elevated/40'}`}>
                                  <td className="py-2.5 pl-5 pr-3">
                                    <input type="checkbox" checked={isSelected} onChange={(e) => handleSelect(tx.id, e.target.checked)} className="w-4 h-4 rounded accent-warning cursor-pointer" />
                                  </td>
                                  <td className="py-2.5 px-3 font-medium text-xs text-warning">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span>{tx.product?.name}</span>
                                      {tx.product?.isReturnable && tx.product?.isDisposable && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-primary/15 text-primary tracking-wider">RETURNABLE &amp; USED</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono font-bold text-text-primary text-xs whitespace-nowrap">
                                    {isSelected ? (
                                      <input
                                        type="number"
                                        min={1}
                                        max={remainingQty}
                                        value={selectedIds[tx.id]?.qty ?? remainingQty}
                                        onChange={(e) => handleQty(tx.id, e.target.value)}
                                        className="w-16 bg-surface text-text-primary font-mono font-bold text-center border border-warning rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-warning"
                                      />
                                    ) : (
                                      <span>{remainingQty}</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <input type="text" placeholder="Notes..." disabled={!isSelected}
                                      value={selectedIds[tx.id]?.notes || ''} onChange={(e) => handleNotes(tx.id, e.target.value)}
                                      className="w-full min-w-[120px] bg-surface text-text-primary border border-border rounded-lg px-2 py-1.5 text-xs disabled:opacity-50 disabled:bg-surface-elevated" />
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

            {/* Bottom Pagination */}
            <Pagination
              currentPage={groupPage}
              totalPages={totalGroupPages}
              totalItems={deliveryNoteGroups.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setGroupPage}
              itemLabel="delivery notes"
            />
            </>
          )}

          {/* ── TAB: CONSUMED HISTORY ── */}
          {activeTab === 'history' && (
            <>
            {/* Top Pagination */}
            <Pagination
              currentPage={historyPage}
              totalPages={totalHistoryPages}
              totalItems={pastUsed.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setHistoryPage}
              itemLabel="entries"
            />

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-text-secondary border-collapse">
                <thead className="text-xs uppercase bg-surface-elevated text-text-muted font-bold tracking-wider sticky top-0 z-10 border-b border-border shadow-sm">
                  <tr>
                    <SortableHeader field="date" currentField={historySortField} direction={historySortDirection} onSort={handleHistorySort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Date</SortableHeader>
                    <SortableHeader field="product" currentField={historySortField} direction={historySortDirection} onSort={handleHistorySort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Product</SortableHeader>
                    <SortableHeader field="store" currentField={historySortField} direction={historySortDirection} onSort={handleHistorySort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Store</SortableHeader>
                    <SortableHeader field="quantity" currentField={historySortField} direction={historySortDirection} onSort={handleHistorySort} align="center" className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-center">Consumed Qty</SortableHeader>
                    <SortableHeader field="notes" currentField={historySortField} direction={historySortDirection} onSort={handleHistorySort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Remarks</SortableHeader>
                    <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-right">Actions / Undo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {sortedHistory.length === 0 ? (
                    <tr><td colSpan="6" className="py-12 text-center text-text-muted">
                      <div className="flex flex-col items-center gap-2"><Package size={32} className="opacity-20" /><span>No consumed logs found.</span></div>
                    </td></tr>
                  ) : paginatedHistory.map(tx => {
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

            {/* Bottom Pagination */}
            <Pagination
              currentPage={historyPage}
              totalPages={totalHistoryPages}
              totalItems={pastUsed.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setHistoryPage}
              itemLabel="entries"
            />
            </>
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

      <ConfirmModal
        open={confirmOpen}
        onClose={() => { setConfirmOpen(false); router.refresh(); }}
        type="success"
        title="Items Marked as Used"
        message="Selected items have been marked as used/consumed. Stock will not return to warehouse."
      />
    </div>
  );
}
