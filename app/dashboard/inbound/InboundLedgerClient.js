'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { ArrowDownLeft, Plus, Search, ChevronDown, ChevronRight, FileText, CopyPlus, Loader2, Edit2, X } from 'lucide-react';
import TransactionActions from '@/components/TransactionActions';
import CopyDeliveryNoteButton from '@/components/CopyDeliveryNoteButton';
import CustomSelect from '@/components/CustomSelect';
import ExportToExcel from '@/components/ExportToExcel';
import TabNav from '@/components/TabNav';
import PageHeader from '@/components/PageHeader';
import Pagination from '@/components/Pagination';
import DeliveryNoteGroup from '@/components/DeliveryNoteGroup';
import DeliveryNoteLink from '@/components/DeliveryNoteLink';
import SortableHeader from '@/components/SortableHeader';
import { useTableSort } from '@/hooks/useTableSort';

export default function InboundLedgerClient({ transactions = [], totalCount = 0, totalPages = 1, page = 1, entityNames = {} }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'transactions');

  const changeTab = (tab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams ? searchParams.toString() : '');
    params.set('tab', tab);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `${pathname}?${params.toString()}`);
    }
  };
  const [pdfLoadingKey, setPdfLoadingKey] = useState(null);

  // Filters for Transactions Tab
  const [productFilter, setProductFilter] = useState('');
  const [brandId, setBrandId] = useState(''); // '' = all brands
  const [categoryFilter, setCategoryFilter] = useState(''); // '' = all categories

  // Search filter for Receive Notes Tab
  const [dnSearch, setDnSearch] = useState('');

  // Expand state for Receive Notes
  const [expandedDn, setExpandedDn] = useState({});

  const toggleDnExpand = (dnKey) => {
    setExpandedDn(prev => ({
      ...prev,
      [dnKey]: !prev[dnKey]
    }));
  };

  // Derive unique brands from transactions
  const brandOptions = useMemo(() => {
    const map = {};
    (transactions || []).forEach(tx => {
      if (tx.product?.brandId && tx.product?.brand?.name) {
        map[tx.product.brandId] = tx.product.brand.name;
      }
    });
    return [{ value: '', label: 'All Brands' }, ...Object.entries(map).map(([id, name]) => ({ value: id, label: name })).sort((a, b) => a.label.localeCompare(b.label))];
  }, [transactions]);

  // Derive unique categories from transactions
  const categoryOptions = useMemo(() => {
    const set = new Set();
    (transactions || []).forEach(tx => {
      if (tx.product?.category) {
        set.add(tx.product.category);
      }
    });
    return [{ value: '', label: 'All Categories' }, ...Array.from(set).sort().map(cat => ({ value: cat, label: cat }))];
  }, [transactions]);

  // Group by Receive Note + Source Entity ID
  const deliveryNotesGroups = useMemo(() => {
    const groups = {};
    (transactions || []).forEach(tx => {
      if (tx.deliveryNote) {
        const sourceName = tx.fromEntityType === 'STORE' 
          ? (entityNames?.[tx.fromEntityId] || tx.fromEntityId || 'Store')
          : (tx.fromEntityId || 'Supplier');
          
        const key = `${tx.deliveryNote}_${tx.fromEntityId || 'unknown'}`;
        if (!groups[key]) {
          groups[key] = {
            deliveryNote: tx.deliveryNote,
            sourceId: tx.fromEntityId,
            sourceType: tx.fromEntityType,
            sourceName,
            timestamp: tx.timestamp,
            items: []
          };
        }
        groups[key].items.push(tx);
      }
    });
    return Object.values(groups).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [transactions, entityNames]);

  // Filtered transactions for the Ledger tab
  const filteredTransactions = useMemo(() => {
    return (transactions || []).filter(tx => {
      const matchProduct = (tx.product?.name || '').toLowerCase().includes(productFilter.toLowerCase());
      const matchBrand = brandId ? tx.product?.brandId === brandId : true;
      const matchCategory = categoryFilter ? tx.product?.category === categoryFilter : true;
      return matchProduct && matchBrand && matchCategory;
    });
  }, [transactions, productFilter, brandId, categoryFilter]);

  const inboundGetters = useMemo(() => ({
    product: (tx) => tx.product?.name || '',
    date: (tx) => tx.timestamp,
    sku: (tx) => tx.product?.itemCode || '',
    type: (tx) => tx.transactionType || '',
    source: (tx) => tx.fromEntityType === 'STORE' ? (entityNames?.[tx.fromEntityId] || tx.fromEntityId) : (tx.fromEntityId || ''),
    quantity: (tx) => tx.quantity ?? 0,
    deliveryNote: (tx) => tx.deliveryNote || '',
    notes: (tx) => tx.notes || '',
  }), [entityNames]);

  const {
    sortedItems: sortedTransactions,
    sortField: inboundSortField,
    sortDirection: inboundSortDirection,
    handleSort: handleInboundSort,
  } = useTableSort(filteredTransactions, 'date', 'desc', inboundGetters);

  const filteredGroups = deliveryNotesGroups.filter(g => 
    g.deliveryNote.toLowerCase().includes(dnSearch.toLowerCase()) || 
    g.sourceName.toLowerCase().includes(dnSearch.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 relative">
      <PageHeader
        icon={ArrowDownLeft}
        title="Inbound Stock Receipts"
        description="Audit logs of all incoming stock received at the warehouse."
        actions={<>
          <CopyDeliveryNoteButton type="inbound" noteType="Receive" />
          <ExportToExcel
            data={filteredTransactions.map(tx => ({
              Product: tx.product?.name || '',
              SKU: tx.product?.itemCode || '',
              Barcode: tx.barcode || '',
              Brand: tx.product?.brand?.name || '',
              Category: tx.product?.category || '',
              Date: new Date(tx.timestamp).toLocaleDateString('en-AE', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
              Supplier: tx.fromEntityType === 'STORE' ? (entityNames?.[tx.fromEntityId] || tx.fromEntityId) : (tx.fromEntityId || 'Supplier'),
              'Received By': tx.receivedBy || '',
              Quantity: tx.quantity,
              'Receive Note': tx.deliveryNote || '',
              Notes: tx.notes || '',
            }))}
            columns={[
              { header: 'Product', key: 'Product', width: 25 },
              { header: 'SKU', key: 'SKU', width: 14 },
              { header: 'Barcode', key: 'Barcode', width: 22 },
              { header: 'Brand', key: 'Brand', width: 18 },
              { header: 'Category', key: 'Category', width: 18 },
              { header: 'Date', key: 'Date', width: 18 },
              { header: 'Supplier', key: 'Supplier', width: 20 },
              { header: 'Received By', key: 'Received By', width: 18 },
              { header: 'Quantity', key: 'Quantity', width: 10 },
              { header: 'Receive Note', key: 'Receive Note', width: 20 },
              { header: 'Notes', key: 'Notes', width: 25 },
            ]}
            filename="IML-Inbound-Ledger"
          />
          <Link 
            href="/dashboard/inbound/new" 
            className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-1.5 sm:py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-xs sm:text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200 whitespace-nowrap"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">New Inbound Receipt</span>
            <span className="sm:hidden">New</span>
          </Link>
        </>
      }
      />

      {/* Tabs */}
      <TabNav
        activeTab={activeTab}
        onTabChange={changeTab}
        tabs={[
          { key: 'transactions', label: 'Transactions Ledger' },
          { key: 'delivery_notes', label: 'Grouped Receive Notes' },
        ]}
      />

      {activeTab === 'transactions' && (
        <div className="flex flex-col gap-4 animate-fade-in">
          {/* Filters */}
          <div className="flex flex-col gap-3 bg-surface p-4 rounded-xl border border-border shadow-sm">
            {/* Top Search Bar */}
            <div className="w-full relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
              <input
                type="text"
                placeholder="Search by product name..."
                className="w-full pl-10 pr-9 py-2.5 bg-surface text-text-primary border border-border rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-semibold shadow-xs"
                value={productFilter}
                onChange={e => setProductFilter(e.target.value)}
              />
              {productFilter && (
                <button
                  type="button"
                  onClick={() => setProductFilter('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-0.5 rounded-full hover:bg-surface-elevated transition-colors"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Dropdown Filters Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div className="w-full">
                <CustomSelect
                  options={brandOptions}
                  value={brandId}
                  onChange={setBrandId}
                  placeholder="All Brands"
                />
              </div>
              <div className="flex items-center gap-2 w-full">
                <div className="flex-1">
                  <CustomSelect
                    options={categoryOptions}
                    value={categoryFilter}
                    onChange={setCategoryFilter}
                    placeholder="All Categories"
                  />
                </div>
                {(productFilter || brandId || categoryFilter) && (
                  <button
                    type="button"
                    onClick={() => { setProductFilter(''); setBrandId(''); setCategoryFilter(''); }}
                    className="px-3 py-2.5 text-xs font-semibold text-text-secondary hover:text-danger hover:bg-danger/10 border border-border rounded-lg transition-all whitespace-nowrap flex items-center justify-center shrink-0"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Top Pagination */}
          {totalPages > 1 && !productFilter && !brandId && !categoryFilter && (
            <div className="flex items-center justify-between px-5 py-3 border border-border bg-surface rounded-xl shadow-sm text-xs print:hidden">
              <span className="text-text-muted">
                Showing <strong className="text-text-primary">{(page - 1) * 25 + 1}</strong> to{" "}
                <strong className="text-text-primary">{Math.min(page * 25, totalCount)}</strong> of{" "}
                <strong className="text-text-primary">{totalCount}</strong> receipts
              </span>
              <div className="flex items-center gap-1.5">
                <Link href={`/dashboard/inbound?page=${Math.max(1, page - 1)}`} className={`px-2.5 py-1.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary rounded-lg font-semibold transition-all duration-200 ${page === 1 ? 'pointer-events-none opacity-50' : ''}`}>Previous</Link>
                <Link href={`/dashboard/inbound?page=${Math.min(totalPages, page + 1)}`} className={`px-2.5 py-1.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary rounded-lg font-semibold transition-all duration-200 ${page === totalPages ? 'pointer-events-none opacity-50' : ''}`}>Next</Link>
              </div>
            </div>
          )}

          {/* Mobile Card View */}
          {sortedTransactions.length === 0 ? (
            <div className="md:hidden bg-surface border border-border rounded-xl shadow-sm py-16 text-center flex flex-col items-center gap-3 text-text-muted">
              <ArrowDownLeft size={48} className="text-text-muted" />
              <h3 className="font-display font-bold text-lg text-text-primary">No matching transactions</h3>
            </div>
          ) : (
            <div className="md:hidden flex flex-col gap-3">
              {sortedTransactions.map((tx) => {
                const dateStr = new Date(tx.timestamp).toLocaleDateString('en-AE', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                const sourceName = tx.fromEntityType === 'STORE' ? `Store: ${entityNames[tx.fromEntityId] || tx.fromEntityId}` : `Supplier: ${tx.fromEntityId || '---'}`;
                return (
                  <div key={tx.id} className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <Link href={`/dashboard/products/${tx.product.id}`} className="font-semibold text-sm text-text-primary block truncate hover:text-primary transition-colors">{tx.product.name}</Link>
                        <span className="text-[11px] text-text-muted">{tx.product.brand.name}</span>
                      </div>
                      <span className={`badge text-[10px] flex-shrink-0 ${tx.transactionType === 'RECEIVE' ? 'bg-success/10 border-success/20 text-success' : 'bg-info/10 border-info/20 text-info'}`}>
                        {tx.transactionType}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-secondary font-medium">{dateStr}</span>
                      <span className="font-mono font-bold text-sm">+{tx.quantity}</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px]">
                      <span className="text-text-secondary truncate max-w-[60%]">{sourceName}</span>
                      <div className="flex items-center gap-2">
                        <DeliveryNoteLink tx={tx} />
                        <TransactionActions txId={tx.id} notes={tx.notes || ''} deliveryNote={tx.deliveryNote || ''} showDeliveryNote={true} copyDnUrl={tx.deliveryNote ? `/dashboard/inbound/new?copyDn=${tx.deliveryNote}` : null} transactionType={tx.transactionType} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Desktop Table View */}
          <div className="hidden md:block bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
            {sortedTransactions.length === 0 ? (
              <div className="py-16 text-center flex flex-col items-center gap-3 text-text-muted bg-surface">
                <ArrowDownLeft size={48} className="text-text-muted" />
                <h3 className="font-display font-bold text-lg text-text-primary">No matching transactions</h3>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border text-[10px] sm:text-[11px] md:text-xs">
                    <thead>
                      <tr className="text-left text-xs font-bold text-text-secondary uppercase tracking-wider bg-surface-elevated/40">
                        <SortableHeader field="product" currentField={inboundSortField} direction={inboundSortDirection} onSort={handleInboundSort} className="py-2 sm:py-3 pl-4 sm:pl-5 pr-3 sm:pr-4 sticky left-0 bg-surface-sticky z-20 border-r border-border shadow-sm">Product Details</SortableHeader>
                        <SortableHeader field="date" currentField={inboundSortField} direction={inboundSortDirection} onSort={handleInboundSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Date</SortableHeader>
                        <SortableHeader field="sku" currentField={inboundSortField} direction={inboundSortDirection} onSort={handleInboundSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">SKU</SortableHeader>
                        <SortableHeader field="type" currentField={inboundSortField} direction={inboundSortDirection} onSort={handleInboundSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Type</SortableHeader>
                        <SortableHeader field="source" currentField={inboundSortField} direction={inboundSortDirection} onSort={handleInboundSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Source / Supplier</SortableHeader>
                        <SortableHeader field="quantity" currentField={inboundSortField} direction={inboundSortDirection} onSort={handleInboundSort} align="center" className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Quantity</SortableHeader>
                        <SortableHeader field="deliveryNote" currentField={inboundSortField} direction={inboundSortDirection} onSort={handleInboundSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Receive Note</SortableHeader>
                        <SortableHeader field="notes" currentField={inboundSortField} direction={inboundSortDirection} onSort={handleInboundSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Remarks</SortableHeader>
                        <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-text-primary">
                      {sortedTransactions.map((tx) => {
                        const dateStr = new Date(tx.timestamp).toLocaleDateString('en-AE', { timeZone: 'Asia/Dubai',
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        });

                        const sourceName = tx.fromEntityType === 'STORE' 
                          ? `Store: ${entityNames[tx.fromEntityId] || tx.fromEntityId}`
                          : `Supplier: ${tx.fromEntityId || '---'}`;

                        return (
                          <tr key={tx.id} className="hover:bg-surface-elevated/20 transition-colors group/row">
                            <td className="py-2 sm:py-3 pl-4 sm:pl-5 pr-3 sm:pr-4 whitespace-nowrap sticky left-0 bg-surface group-hover/row:bg-surface-elevated/100 z-10 border-r border-border shadow-sm">
                              <div className="flex flex-col">
                                <span className="font-semibold">{tx.product.name}</span>
                                <span className="text-[11px] text-text-muted mt-0.5">Brand: {tx.product.brand.name}</span>
                              </div>
                            </td>
                            <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap text-xs text-text-secondary font-medium">{dateStr}</td>
                            <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap font-mono text-xs text-text-secondary">{tx.product.itemCode || '---'}</td>
                            <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap">
                              <span className={`badge text-[10px] ${tx.transactionType === 'RECEIVE' ? 'bg-success/10 border-success/20 text-success' : 'bg-info/10 border-info/20 text-info'}`}>
                                {tx.transactionType}
                              </span>
                            </td>
                            <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 font-semibold text-xs text-text-secondary whitespace-nowrap">{sourceName}</td>
                            <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-center font-mono font-bold text-sm whitespace-nowrap">+{tx.quantity}</td>
                            <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap font-mono text-xs">
                              <DeliveryNoteLink tx={tx} />
                            </td>
                            <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 max-w-xs truncate text-xs text-text-secondary" title={tx.notes || ''}>{tx.notes || '---'}</td>
                            <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-right">
                              <TransactionActions
                                txId={tx.id}
                                notes={tx.notes || ''}
                                deliveryNote={tx.deliveryNote || ''}
                                showDeliveryNote={true}
                                copyDnUrl={tx.deliveryNote ? `/dashboard/inbound/new?copyDn=${tx.deliveryNote}` : null}
                                transactionType={tx.transactionType}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && !productFilter && !brandId && (
                  <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-surface-elevated/20 text-xs">
                    <span className="text-text-muted">
                      Showing <strong className="text-text-primary">{(page - 1) * 25 + 1}</strong> to{" "}
                      <strong className="text-text-primary">{Math.min(page * 25, totalCount)}</strong> of{" "}
                      <strong className="text-text-primary">{totalCount}</strong> receipts
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Link href={`/dashboard/inbound?page=${Math.max(1, page - 1)}`} className={`px-2.5 py-1.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary rounded-lg font-semibold transition-all duration-200 ${page === 1 ? 'pointer-events-none opacity-50' : ''}`}>Previous</Link>
                      <Link href={`/dashboard/inbound?page=${Math.min(totalPages, page + 1)}`} className={`px-2.5 py-1.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary rounded-lg font-semibold transition-all duration-200 ${page === totalPages ? 'pointer-events-none opacity-50' : ''}`}>Next</Link>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'delivery_notes' && (
        <div className="flex flex-col gap-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row gap-4 bg-surface p-4 rounded-xl border border-border shadow-sm">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
              <input
                type="text"
                placeholder="Search Receive Notes or Suppliers..."
                className="w-full pl-9 pr-4 py-2 bg-surface-elevated/50 border border-border rounded-lg text-sm focus:outline-none focus:border-primary transition-colors"
                value={dnSearch}
                onChange={e => setDnSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {filteredGroups.length === 0 ? (
              <div className="py-16 text-center flex flex-col items-center gap-3 text-text-muted bg-surface rounded-xl border border-border">
                <FileText size={48} className="text-text-muted" />
                <h3 className="font-display font-bold text-lg text-text-primary">No Receive Notes found</h3>
              </div>
            ) : (
              filteredGroups.map(group => {
                const groupKey = `${group.deliveryNote}_${group.sourceId || 'unknown'}`;
                const isExpanded = expandedDn[groupKey];
                const isGroupReturn = group.deliveryNote?.startsWith('RET-') || 
                                     group.deliveryNote?.startsWith('RTN-') || 
                                     group.deliveryNote?.startsWith('CRN-') || 
                                     group.deliveryNote?.startsWith('CRR-') || 
                                     group.items.some(tx => tx.transactionType === 'RETURN' || tx.transactionType === 'CLIENT_RETURN');

                return (
                  <div key={groupKey} className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
                    {/* Group header — stacks on mobile, row on sm+ */}
                    <div
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 cursor-pointer hover:bg-surface-elevated/20 transition-colors"
                      onClick={() => toggleDnExpand(groupKey)}
                    >
                      {/* Left: icon + note info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-lg flex-shrink-0 ${isExpanded ? 'bg-primary text-white' : 'bg-surface-elevated text-text-secondary'}`}>
                          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-text-primary text-sm truncate">{group.deliveryNote}</h3>
                            <span className="badge text-[10px] bg-secondary/15 text-secondary border border-secondary/10 px-2 py-0.5 rounded uppercase tracking-wider whitespace-nowrap flex-shrink-0">{group.sourceName}</span>
                          </div>
                          <p className="text-xs text-text-secondary mt-0.5">
                            {new Date(group.timestamp).toLocaleDateString('en-AE', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · {group.items.length} product(s)
                          </p>
                        </div>
                      </div>
                      {/* Right: action buttons */}
                      <div
                        className="flex items-center gap-2 flex-wrap sm:flex-nowrap flex-shrink-0"
                        onClick={e => e.stopPropagation()}
                      >
                        {!isGroupReturn && (
                          <button
                            onClick={() => router.push(`/dashboard/inbound/${encodeURIComponent(group.deliveryNote)}/edit`)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 font-bold text-xs rounded-lg transition-colors whitespace-nowrap"
                            title="Edit Inbound"
                          >
                            <Edit2 size={13} />
                            <span className="hidden sm:inline">Edit</span>
                          </button>
                        )}
                        <button
                          onClick={() => router.push(`/dashboard/inbound/new?copyDn=${group.deliveryNote}`)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-success/10 hover:bg-success/20 text-success border border-success/20 font-bold text-xs rounded-lg transition-colors whitespace-nowrap"
                          title="Duplicate"
                        >
                          <CopyPlus size={13} />
                          <span className="hidden sm:inline">Duplicate</span>
                        </button>
                        <a
                          href={`/api/dashboard/inbound/delivery-note?date=${new Date(group.timestamp).toISOString().split('T')[0]}&brandId=${group.items[0]?.product.brandId}&dn=${encodeURIComponent(group.deliveryNote)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 font-bold text-xs rounded-lg transition-colors whitespace-nowrap"
                          title="View / Download PDF"
                        >
                          <FileText size={13} />
                          <span>PDF</span>
                        </a>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-border bg-surface/50 overflow-x-auto">
                        <table className="min-w-full divide-y divide-border text-xs">
                          <thead>
                            <tr className="text-left text-[10px] font-bold text-text-secondary uppercase tracking-wider bg-surface-elevated/20">
                              <th className="py-2.5 pl-5 pr-4">Product Name</th>
                              <th className="py-2.5 px-4">SKU</th>
                              <th className="py-2.5 px-4">Brand</th>
                              <th className="py-2.5 px-4 text-center">Qty</th>
                              <th className="py-2.5 px-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border text-text-primary">
                            {group.items.map(tx => (
                              <tr key={tx.id} className="hover:bg-surface-elevated/40 transition-colors">
                                <td className="py-2.5 pl-5 pr-4 font-medium text-xs">{tx.product.name}</td>
                                <td className="py-2.5 px-4 text-xs font-mono text-text-secondary whitespace-nowrap">{tx.product.itemCode || '---'}</td>
                                <td className="py-2.5 px-4 text-xs text-text-secondary whitespace-nowrap">{tx.product.brand.name}</td>
                                <td className="py-2.5 px-4 text-center font-mono text-xs font-bold text-success whitespace-nowrap">+{tx.quantity}</td>
                                <td className="py-2.5 px-4 text-right">
                                  <TransactionActions
                                    txId={tx.id}
                                    notes={tx.notes || ''}
                                    deliveryNote={tx.deliveryNote || ''}
                                    showDeliveryNote={true}
                                    transactionType={tx.transactionType}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
