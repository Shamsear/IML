'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Package, Search, Store, UserCheck, RotateCcw, CheckCircle2, AlertCircle, Loader2, ChevronDown, ChevronRight, List, History, FileText, X, Tag, Layers } from 'lucide-react';
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

export default function ReturnsClient({
  transactions = [],
  stores = [],
  pastReturns = [],
  supervisors = [],
  initialTab,
  initialDN
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dnVal = initialDN || (searchParams ? searchParams.get('dn') || '' : '');
  const tabVal = initialTab || (searchParams ? searchParams.get('tab') : '') || (dnVal ? 'grouped' : 'transactions');
  const [activeTab, setActiveTab] = useState(tabVal);

  const changeTab = (tab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      params.set('tab', tab);
      window.history.replaceState(null, '', `${pathname}?${params.toString()}`);
    }
  };

  const [searchDN, setSearchDN] = useState(dnVal);
  const [searchStore, setSearchStore] = useState('');
  const [searchSupervisor, setSearchSupervisor] = useState('');
  const [searchBrand, setSearchBrand] = useState('');
  const [searchCategory, setSearchCategory] = useState('');
  const [processingItems, setProcessingItems] = useState({});
  const [expandedGroups, setExpandedGroups] = useState(dnVal ? { [dnVal]: true } : {});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Pagination states
  const [txPage, setTxPage] = useState(1);
  const [groupPage, setGroupPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const itemsPerPage = 25;

  useEffect(() => {
    setTxPage(1);
    setGroupPage(1);
    setHistoryPage(1);
  }, [searchDN, searchStore, searchSupervisor, searchBrand, searchCategory]);

  const supervisorNames = useMemo(() => {
    const map = {};
    supervisors.forEach(s => { map[s.id] = s.name; });
    return map;
  }, [supervisors]);

  const storeMap = useMemo(() => {
    const map = {};
    stores.forEach(s => { map[s.id] = s.name; });
    return map;
  }, [stores]);

  const getSupervisorName = (tx) => {
    return (
      tx.deliverySupervisor?.name ||
      supervisorNames[tx.deliverySupervisorId] ||
      (tx.toEntityType === 'SUPERVISOR' ? supervisorNames[tx.toEntityId] : null) ||
      (tx.fromEntityType === 'SUPERVISOR' ? supervisorNames[tx.fromEntityId] : null) ||
      ''
    );
  };

  const storeOptions = useMemo(() => [
    { value: '', label: 'All Stores' },
    ...stores.map(s => ({ value: s.id, label: s.name }))
  ], [stores]);

  const supervisorOptions = useMemo(() => [
    { value: '', label: 'All Supervisors' },
    ...supervisors.map(s => ({ value: s.id, label: s.name }))
  ], [supervisors]);

  const brandOptions = useMemo(() => {
    const map = {};
    (transactions || []).forEach(tx => {
      if (tx.product?.brandId && tx.product?.brand?.name) {
        map[tx.product.brandId] = tx.product.brand.name;
      }
    });
    return [
      { value: '', label: 'All Brands' },
      ...Object.entries(map).map(([id, name]) => ({ value: id, label: name })).sort((a, b) => a.label.localeCompare(b.label))
    ];
  }, [transactions]);

  const categoryOptions = useMemo(() => {
    const set = new Set();
    (transactions || []).forEach(tx => {
      if (tx.product?.category) {
        set.add(tx.product.category);
      }
    });
    return [
      { value: '', label: 'All Categories' },
      ...Array.from(set).sort().map(cat => ({ value: cat, label: cat }))
    ];
  }, [transactions]);

  // --- Filtering ---
  const filteredTransactions = useMemo(() => {
    const q = (searchDN || '').toLowerCase().trim();

    return (transactions || []).filter(tx => {
      const matchStore = !searchStore || tx.toEntityId === searchStore;
      const matchSupervisor = !searchSupervisor || 
        tx.deliverySupervisorId === searchSupervisor || 
        tx.deliverySupervisor?.id === searchSupervisor ||
        (tx.toEntityType === 'SUPERVISOR' && tx.toEntityId === searchSupervisor);
      const matchBrand = !searchBrand || tx.product?.brandId === searchBrand;
      const matchCategory = !searchCategory || tx.product?.category === searchCategory;

      if (!matchStore || !matchSupervisor || !matchBrand || !matchCategory) return false;
      if (!q) return true;

      const pName = tx.product?.name?.toLowerCase() || '';
      const bName = tx.product?.brand?.name?.toLowerCase() || '';
      const cName = tx.product?.category?.toLowerCase() || '';
      const sku = tx.product?.itemCode?.toLowerCase() || '';
      const dn = tx.deliveryNote?.toLowerCase() || '';
      const storeName = (storeMap[tx.toEntityId] || '').toLowerCase();
      const supName = getSupervisorName(tx).toLowerCase();
      const notes = tx.notes?.toLowerCase() || '';
      const barcode = tx.barcode?.toLowerCase() || '';

      return (
        pName.includes(q) ||
        bName.includes(q) ||
        cName.includes(q) ||
        sku.includes(q) ||
        dn.includes(q) ||
        storeName.includes(q) ||
        supName.includes(q) ||
        notes.includes(q) ||
        barcode.includes(q)
      );
    });
  }, [transactions, searchDN, searchStore, searchSupervisor, searchBrand, searchCategory, storeMap, supervisorNames]);

  const txCustomGetters = useMemo(() => ({
    product: (tx) => tx.product?.name || '',
    date: (tx) => tx.timestamp,
    store: (tx) => stores.find(s => s.id === tx.toEntityId)?.name || '',
    supervisor: (tx) => getSupervisorName(tx),
    available: (tx) => tx.quantity - (tx.returnedQty || 0),
    deliveryNote: (tx) => tx.deliveryNote || '',
    remarks: (tx) => tx.notes || '',
  }), [stores, supervisorNames]);

  const {
    sortedItems: sortedTransactions,
    sortField: txSortField,
    sortDirection: txSortDirection,
    handleSort: handleTxSort,
  } = useTableSort(filteredTransactions, 'date', 'desc', txCustomGetters);

  const totalTxPages = Math.ceil(sortedTransactions.length / itemsPerPage);
  const paginatedTransactions = sortedTransactions.slice((txPage - 1) * itemsPerPage, txPage * itemsPerPage);

  // --- Grouping by Return Note ---
  const deliveryNoteGroups = useMemo(() => {
    const groups = {};
    filteredTransactions.forEach(tx => {
      const key = tx.deliveryNote || 'No DN';
      const sup = getSupervisorName(tx);
      if (!groups[key]) {
        groups[key] = {
          dn: key,
          storeName: stores.find(s => s.id === tx.toEntityId)?.name || 'Unknown',
          storeId: tx.toEntityId,
          supervisorName: sup,
          timestamp: tx.timestamp,
          items: []
        };
      } else if (!groups[key].supervisorName && sup) {
        groups[key].supervisorName = sup;
      }
      groups[key].items.push(tx);
    });
    return Object.values(groups).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [filteredTransactions, stores, supervisorNames]);

  const totalGroupPages = Math.ceil(deliveryNoteGroups.length / itemsPerPage);
  const paginatedGroups = deliveryNoteGroups.slice((groupPage - 1) * itemsPerPage, groupPage * itemsPerPage);

  const filteredHistory = useMemo(() => {
    const q = (searchDN || '').toLowerCase().trim();

    return (pastReturns || []).filter(tx => {
      const matchStore = !searchStore || tx.fromEntityId === searchStore;
      const matchSupervisor = !searchSupervisor || 
        tx.deliverySupervisorId === searchSupervisor || 
        tx.deliverySupervisor?.id === searchSupervisor ||
        (tx.fromEntityType === 'SUPERVISOR' && tx.fromEntityId === searchSupervisor);

      if (!matchStore || !matchSupervisor) return false;
      if (!q) return true;

      const pName = tx.product?.name?.toLowerCase() || '';
      const bName = tx.product?.brand?.name?.toLowerCase() || '';
      const sku = tx.product?.itemCode?.toLowerCase() || '';
      const dn = tx.deliveryNote?.toLowerCase() || '';
      const fromStore = (storeMap[tx.fromEntityId] || tx.fromEntityType || '').toLowerCase();
      const supName = getSupervisorName(tx).toLowerCase();
      const notes = tx.notes?.toLowerCase() || '';
      const barcode = tx.barcode?.toLowerCase() || '';

      return (
        pName.includes(q) ||
        bName.includes(q) ||
        sku.includes(q) ||
        dn.includes(q) ||
        fromStore.includes(q) ||
        supName.includes(q) ||
        notes.includes(q) ||
        barcode.includes(q)
      );
    });
  }, [pastReturns, searchDN, searchStore, searchSupervisor, storeMap, supervisorNames]);

  const historyCustomGetters = useMemo(() => ({
    date: (tx) => tx.timestamp,
    product: (tx) => tx.product?.name || '',
    returnedFrom: (tx) => stores.find(s => s.id === tx.fromEntityId)?.name || tx.fromEntityType || '',
    supervisor: (tx) => getSupervisorName(tx),
    quantity: (tx) => tx.quantity ?? 0,
    notes: (tx) => tx.notes || '',
  }), [stores, supervisorNames]);

  const {
    sortedItems: sortedHistory,
    sortField: historySortField,
    sortDirection: historySortDirection,
    handleSort: handleHistorySort,
  } = useTableSort(filteredHistory, 'date', 'desc', historyCustomGetters);

  const totalHistoryPages = Math.ceil(sortedHistory.length / itemsPerPage);
  const paginatedHistory = sortedHistory.slice((historyPage - 1) * itemsPerPage, historyPage * itemsPerPage);

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
      if (res.success) { 
        setConfirmOpen(true); 
        setProcessingItems({}); 
        router.refresh();
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally { setIsSubmitting(false); }
  };

  const selectedCount = Object.keys(processingItems).length;

  return (
    <div className="flex flex-col gap-6 relative">
      <PageHeader
        icon={RotateCcw}
        title="Stock Returns"
        description="Return issued stock back to the warehouse. Only returnable products appear here."
        actions={<>
          <ExportToExcel
            data={transactions.map(tx => ({
              Product: tx.product?.name || '',
              SKU: tx.product?.itemCode || '',
              Barcode: tx.barcode || '',
              Brand: tx.product?.brand?.name || '',
              Category: tx.product?.category || '',
              Store: stores.find(s => s.id === tx.toEntityId)?.name || tx.toEntityId || '',
              Supervisor: getSupervisorName(tx) || '',
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
              { header: 'Supervisor', key: 'Supervisor', width: 18 },
              { header: 'Quantity', key: 'Quantity', width: 10 },
              { header: 'Delivery Note', key: 'Delivery Note', width: 20 },
              { header: 'Date', key: 'Date', width: 18 },
              { header: 'Notes', key: 'Notes', width: 25 },
            ]}
            filename="IML-Returns"
          />
        </>
      }
      />

      {/* Tabs — horizontally scrollable on mobile */}
      <div className="w-full overflow-x-auto">
        <div className="flex gap-1 bg-surface-elevated/30 border border-border rounded-xl p-1 w-max min-w-full sm:w-fit">
          <button onClick={() => changeTab('transactions')}
            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'transactions' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}>
            <List size={14} />
            <span>All Items</span>
          </button>
          <button onClick={() => changeTab('grouped')}
            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'grouped' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}>
            <ChevronDown size={14} />
            <span className="sm:hidden">By DN</span>
            <span className="hidden sm:inline">By Delivery Notes</span>
          </button>
          <button onClick={() => changeTab('history')}
            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'history' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}>
            <History size={14} />
            <span className="sm:hidden">History</span>
            <span className="hidden sm:inline">Returns History (Undo)</span>
          </button>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col">
        {/* Filters */}
        <div className="p-4 border-b border-border bg-surface-elevated/30 flex flex-col gap-3">
          {/* Top Search Bar */}
          <div className="relative w-full">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Search item, SKU, DN, store, or supervisor..."
              value={searchDN}
              onChange={(e) => setSearchDN(e.target.value)}
              className="w-full bg-surface text-text-primary border border-border rounded-xl pl-10 pr-9 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-semibold shadow-xs"
            />
            {searchDN && (
              <button
                type="button"
                onClick={() => setSearchDN('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-0.5 rounded-full hover:bg-surface-elevated transition-colors"
                title="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Filters Row (Grid: 2 columns on mobile/tablet, 4 columns on desktop + reset) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-center">
            <div className="w-full">
              <CustomSelect
                options={storeOptions}
                value={searchStore}
                onChange={(val) => setSearchStore(val)}
                placeholder="All Stores"
              />
            </div>
            <div className="w-full">
              <CustomSelect
                options={supervisorOptions}
                value={searchSupervisor}
                onChange={(val) => setSearchSupervisor(val)}
                placeholder="All Supervisors"
              />
            </div>
            <div className="w-full">
              <CustomSelect
                options={brandOptions}
                value={searchBrand}
                onChange={(val) => setSearchBrand(val)}
                placeholder="All Brands"
              />
            </div>
            <div className="flex items-center gap-2 w-full">
              <div className="flex-1">
                <CustomSelect
                  options={categoryOptions}
                  value={searchCategory}
                  onChange={(val) => setSearchCategory(val)}
                  placeholder="All Categories"
                />
              </div>
              {(searchDN || searchStore || searchSupervisor || searchBrand || searchCategory) && (
                <button
                  type="button"
                  onClick={() => { setSearchDN(''); setSearchStore(''); setSearchSupervisor(''); setSearchBrand(''); setSearchCategory(''); }}
                  className="px-3 py-2.5 text-xs font-semibold text-text-muted hover:text-danger hover:bg-danger/10 border border-border rounded-lg transition-all flex items-center justify-center gap-1.5 shrink-0"
                  title="Reset all filters"
                >
                  <X size={14} />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>
        </div>

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
                <div className="py-12 text-center text-text-muted flex flex-col items-center gap-2"><Package size={32} className="opacity-20" /><span>No returnable items found.</span></div>
              ) : paginatedTransactions.map(tx => {
                const isSelected = !!processingItems[tx.id];
                const remainingQty = tx.quantity - (tx.returnedQty || 0);
                const itemState = processingItems[tx.id];
                return (
                  <div key={tx.id} className={`bg-surface border rounded-xl p-4 flex flex-col gap-2.5 transition-all ${isSelected ? 'border-primary bg-primary/5' : 'border-border'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <input type="checkbox" checked={isSelected} onChange={(e) => handleSelect(tx.id, e.target.checked)} className="w-4 h-4 rounded accent-primary cursor-pointer" />
                          <Link href={`/dashboard/products/${tx.product?.id}`} className="font-semibold text-sm text-primary hover:text-primary-hover hover:underline transition-colors break-words">
                            {tx.product?.name}
                          </Link>
                          {tx.product?.isReturnable && tx.product?.isDisposable ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/15 text-primary tracking-wider">RETURNABLE &amp; USED</span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-success/15 text-success tracking-wider">RETURNABLE</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-text-muted flex-wrap">
                          <span>{stores.find(s => s.id === tx.toEntityId)?.name || 'Unknown'}</span>
                          {getSupervisorName(tx) && (
                            <>
                              <span>·</span>
                              <span className="inline-flex items-center gap-1 text-primary font-semibold">
                                <UserCheck size={11} />
                                {getSupervisorName(tx)}
                              </span>
                            </>
                          )}
                          <span>·</span>
                          <span>{new Date(tx.timestamp).toLocaleDateString('en-AE', { timeZone: 'Asia/Dubai', day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-sm flex-shrink-0">{remainingQty}</span>
                    </div>
                    {tx.deliveryNote && <div className="mt-1"><DeliveryNoteLink tx={tx} /></div>}
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
                    <th className="py-2.5 sm:py-3 pl-4 sm:pl-5 pr-2 w-10 sticky left-0 bg-surface-elevated z-20"></th>
                    <SortableHeader field="product" currentField={txSortField} direction={txSortDirection} onSort={handleTxSort} className="py-2.5 sm:py-3 pl-3 sm:pl-4 pr-3 sm:pr-5 sticky left-10 bg-surface-elevated z-20 border-r border-border shadow-sm">Product</SortableHeader>
                    <SortableHeader field="date" currentField={txSortField} direction={txSortDirection} onSort={handleTxSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Date</SortableHeader>
                    <SortableHeader field="store" currentField={txSortField} direction={txSortDirection} onSort={handleTxSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Store</SortableHeader>
                    <SortableHeader field="supervisor" currentField={txSortField} direction={txSortDirection} onSort={handleTxSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Supervisor</SortableHeader>
                    <SortableHeader field="available" currentField={txSortField} direction={txSortDirection} onSort={handleTxSort} align="right" className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-right">Available</SortableHeader>
                    <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 w-32">Return Qty</th>
                    <SortableHeader field="deliveryNote" currentField={txSortField} direction={txSortDirection} onSort={handleTxSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Delivery Note</SortableHeader>
                    <SortableHeader field="remarks" currentField={txSortField} direction={txSortDirection} onSort={handleTxSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Remarks</SortableHeader>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {sortedTransactions.length === 0 ? (
                    <tr><td colSpan="9" className="py-12 text-center text-text-muted">
                      <div className="flex flex-col items-center gap-2"><Package size={32} className="opacity-20" /><span>No returnable items found.</span></div>
                    </td></tr>
                  ) : paginatedTransactions.map(tx => {
                    const isSelected = !!processingItems[tx.id];
                    const remainingQty = tx.quantity - (tx.returnedQty || 0);
                    const itemState = processingItems[tx.id];
                    return (
                      <tr key={tx.id} className={`transition-colors group/row ${isSelected ? 'bg-primary/5' : 'hover:bg-surface-elevated/30'}`}>
                        <td className="py-2.5 sm:py-3 pl-4 sm:pl-5 pr-2 sticky left-0 bg-surface group-hover/row:bg-surface-elevated z-10"><input type="checkbox" checked={isSelected} onChange={(e) => handleSelect(tx.id, e.target.checked)} className="w-4 h-4 rounded accent-primary cursor-pointer" /></td>
                        <td className="py-2.5 sm:py-3 pl-3 sm:pl-4 pr-3 sm:pr-5 min-w-[220px] max-w-sm sticky left-10 bg-surface group-hover/row:bg-surface-elevated z-10 border-r border-border shadow-sm" title={tx.product?.name}>
                          <div className="flex flex-col">
                            <Link href={`/dashboard/products/${tx.product?.id}`} className="font-semibold text-primary hover:text-primary-hover hover:underline transition-colors break-words leading-snug">
                              {tx.product?.name}
                            </Link>
                            <div className="flex items-center gap-1.5 flex-wrap mt-1">
                              {tx.product?.itemCode && (
                                <span className="font-mono text-[10px] text-text-muted">
                                  {tx.product.itemCode}
                                </span>
                              )}
                              {tx.product?.isReturnable && tx.product?.isDisposable ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/15 text-primary tracking-wider">RETURNABLE &amp; USED</span>
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-success/15 text-success tracking-wider">RETURNABLE</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap">
                          <div className="font-semibold text-text-primary text-[11px]">{new Date(tx.timestamp).toLocaleDateString('en-AE', { timeZone: 'Asia/Dubai', day: '2-digit', month: 'short', year: 'numeric' })}</div>
                        </td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 font-semibold text-text-primary text-xs whitespace-nowrap">{stores.find(s => s.id === tx.toEntityId)?.name || 'Unknown'}</td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap">
                          {getSupervisorName(tx) ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                              <UserCheck size={12} />
                              {getSupervisorName(tx)}
                            </span>
                          ) : (
                            <span className="text-xs text-text-muted">—</span>
                          )}
                        </td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-right font-mono font-bold text-text-primary">{remainingQty}</td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">
                          <input type="number" min="1" max={remainingQty} disabled={!isSelected}
                            value={itemState?.qty || ''} onChange={(e) => handleChange(tx.id, 'qty', parseInt(e.target.value || '0', 10))}
                            className="w-full bg-surface text-text-primary border border-border rounded-lg px-2 py-1.5 text-xs font-mono disabled:opacity-50 disabled:bg-surface-elevated" />
                        </td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 font-mono text-xs text-text-secondary whitespace-nowrap">
                          <DeliveryNoteLink tx={tx} />
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

          {/* ── TAB: BY RETURN NOTE ── */}
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
                  <span className="font-semibold">No returnable delivery notes found.</span>
                </div>
              ) : paginatedGroups.map(group => {
                const isExpanded = !!expandedGroups[group.dn];
                const allSelected = group.items.length > 0 && group.items.every(tx => !!processingItems[tx.id]);
                const someSelected = group.items.some(tx => !!processingItems[tx.id]);
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
                          className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center cursor-pointer transition-colors ${allSelected ? 'bg-primary border-primary' : someSelected ? 'bg-primary/30 border-primary' : 'border-border bg-surface'}`}
                        >
                          {(allSelected || someSelected) && <div className="w-2.5 h-2.5 bg-white rounded-sm" />}
                        </div>
                        {isExpanded ? <ChevronDown size={17} className="text-text-muted flex-shrink-0" /> : <ChevronRight size={17} className="text-text-muted flex-shrink-0" />}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-text-primary font-mono text-sm truncate">{group.dn}</h3>
                            <span className="text-[10px] bg-secondary/15 text-secondary border border-secondary/10 px-2 py-0.5 rounded uppercase tracking-wider font-bold whitespace-nowrap flex-shrink-0">{group.storeName}</span>
                            {group.supervisorName && (
                              <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded font-bold whitespace-nowrap flex-shrink-0 inline-flex items-center gap-1">
                                <UserCheck size={11} />
                                {group.supervisorName}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-text-secondary mt-0.5">
                            {new Date(group.timestamp).toLocaleDateString('en-AE', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', year: 'numeric' })} · {group.items.length} product(s)
                          </p>
                        </div>
                      </div>
                      {/* Right: action buttons — stop propagation via wrapper */}
                      <div
                        className="flex items-center gap-2 flex-wrap flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <a
                          href={`/api/dashboard/returns/delivery-note?date=${new Date(group.timestamp).toISOString().split('T')[0]}${(group.items[0]?.product?.brandId || group.items[0]?.product?.brand?.id) ? `&brandId=${group.items[0]?.product?.brandId || group.items[0]?.product?.brand?.id}` : ''}&dn=${encodeURIComponent(group.dn)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 font-bold text-xs rounded-lg transition-colors whitespace-nowrap"
                        >
                          <FileText size={13} />
                          PDF
                        </a>
                        <button
                          type="button"
                          onClick={() => handleSelectGroup(group)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors whitespace-nowrap ${allSelected ? 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20' : 'bg-surface-elevated text-text-secondary border-border hover:bg-surface-elevated/60'}`}
                        >
                          {allSelected ? 'Deselect All' : 'Select All'}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Items */}
                    {isExpanded && (
                      <div className="border-t border-border bg-surface/50 overflow-x-auto">
                        <table className="min-w-full divide-y divide-border text-xs">
                          <thead>
                            <tr className="text-left text-[10px] font-bold text-text-secondary uppercase tracking-wider bg-surface-elevated/20">
                              <th className="py-2.5 pl-5 pr-3 w-10"></th>
                              <th className="py-2.5 px-3">Product</th>
                              <th className="py-2.5 px-3">Supervisor</th>
                              <th className="py-2.5 px-3 text-right whitespace-nowrap">Available</th>
                              <th className="py-2.5 px-3 w-28 whitespace-nowrap">Return Qty</th>
                              <th className="py-2.5 px-3">Remarks</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border text-text-primary">
                            {group.items.map(tx => {
                              const isSelected = !!processingItems[tx.id];
                              const remainingQty = tx.quantity - (tx.returnedQty || 0);
                              const itemState = processingItems[tx.id];
                              return (
                                <tr key={tx.id} className={`transition-colors ${isSelected ? 'bg-primary/5' : 'hover:bg-surface-elevated/40'}`}>
                                  <td className="py-2.5 pl-5 pr-3">
                                    <input type="checkbox" checked={isSelected} onChange={(e) => handleSelect(tx.id, e.target.checked)} className="w-4 h-4 rounded accent-primary cursor-pointer" />
                                  </td>
                                  <td className="py-2.5 px-3 font-medium text-xs text-primary">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span>{tx.product?.name}</span>
                                      {tx.product?.isReturnable && tx.product?.isDisposable && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-primary/15 text-primary tracking-wider">RETURNABLE &amp; USED</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 whitespace-nowrap text-xs">
                                    {getSupervisorName(tx) ? (
                                      <span className="inline-flex items-center gap-1 text-primary font-semibold">
                                        <UserCheck size={11} />
                                        {getSupervisorName(tx)}
                                      </span>
                                    ) : (
                                      <span className="text-text-muted">—</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono font-bold text-text-primary text-xs whitespace-nowrap">{remainingQty}</td>
                                  <td className="py-2.5 px-3">
                                    <input type="number" min="1" max={remainingQty} disabled={!isSelected}
                                      value={itemState?.qty || ''} onChange={(e) => handleChange(tx.id, 'qty', parseInt(e.target.value || '0', 10))}
                                      className="w-full bg-surface text-text-primary border border-border rounded-lg px-2 py-1.5 text-xs font-mono disabled:opacity-50 disabled:bg-surface-elevated" />
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <input type="text" placeholder="Notes..." disabled={!isSelected}
                                      value={itemState?.notes || ''} onChange={(e) => handleChange(tx.id, 'notes', e.target.value)}
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

          {/* ── TAB: RETURNS HISTORY ── */}
          {activeTab === 'history' && (
            <>
            {/* Top Pagination */}
            <Pagination
              currentPage={historyPage}
              totalPages={totalHistoryPages}
              totalItems={filteredHistory.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setHistoryPage}
              itemLabel="returns"
            />

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-text-secondary border-collapse">
                <thead className="text-xs uppercase bg-surface-elevated text-text-muted font-bold tracking-wider sticky top-0 z-10 border-b border-border shadow-sm">
                  <tr>
                    <SortableHeader field="date" currentField={historySortField} direction={historySortDirection} onSort={handleHistorySort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Date</SortableHeader>
                    <SortableHeader field="product" currentField={historySortField} direction={historySortDirection} onSort={handleHistorySort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Product</SortableHeader>
                    <SortableHeader field="returnedFrom" currentField={historySortField} direction={historySortDirection} onSort={handleHistorySort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Returned From</SortableHeader>
                    <SortableHeader field="supervisor" currentField={historySortField} direction={historySortDirection} onSort={handleHistorySort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Supervisor</SortableHeader>
                    <SortableHeader field="quantity" currentField={historySortField} direction={historySortDirection} onSort={handleHistorySort} align="center" className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-center">Returned Qty</SortableHeader>
                    <SortableHeader field="notes" currentField={historySortField} direction={historySortDirection} onSort={handleHistorySort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Remarks</SortableHeader>
                    <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-right">Actions / Undo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {sortedHistory.length === 0 ? (
                    <tr><td colSpan="7" className="py-12 text-center text-text-muted">
                      <div className="flex flex-col items-center gap-2"><Package size={32} className="opacity-20" /><span>No returns logs found.</span></div>
                    </td></tr>
                  ) : paginatedHistory.map(tx => {
                    const fromStore = stores.find(s => s.id === tx.fromEntityId)?.name || tx.fromEntityType || 'Store';
                    return (
                      <tr key={tx.id} className="hover:bg-surface-elevated/20 transition-colors">
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap text-xs text-text-secondary font-medium">
                          {new Date(tx.timestamp).toLocaleString('en-AE', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 font-semibold text-text-primary min-w-[200px]">
                          <div className="flex flex-col">
                            <span className="text-primary font-bold break-words">{tx.product?.name}</span>
                            <span className="text-[10px] text-text-muted mt-0.5">Brand: {tx.product?.brand?.name || 'General'}</span>
                          </div>
                        </td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 font-semibold text-xs text-text-secondary">{fromStore}</td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap">
                          {getSupervisorName(tx) ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                              <UserCheck size={12} />
                              {getSupervisorName(tx)}
                            </span>
                          ) : (
                            <span className="text-xs text-text-muted">—</span>
                          )}
                        </td>
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

            {/* Bottom Pagination */}
            <Pagination
              currentPage={historyPage}
              totalPages={totalHistoryPages}
              totalItems={filteredHistory.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setHistoryPage}
              itemLabel="returns"
            />
            </>
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

      <ConfirmModal
        open={confirmOpen}
        onClose={() => { setConfirmOpen(false); router.refresh(); }}
        type="success"
        title="Stock Returned"
        message="Selected items have been returned to the warehouse successfully."
      />
    </div>
  );
}
