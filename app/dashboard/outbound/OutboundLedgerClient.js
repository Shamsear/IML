'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  ArrowUpRight,
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  FileText,
  CopyPlus,
  Loader2,
  RotateCcw,
  Trash2,
  UserCheck,
  Edit2,
  X
} from 'lucide-react';
import TransactionActions from '@/components/TransactionActions';
import CopyDeliveryNoteButton from '@/components/CopyDeliveryNoteButton';
import CustomSelect from '@/components/CustomSelect';
import ExportToExcel from '@/components/ExportToExcel';
import TabNav from '@/components/TabNav';
import PageHeader from '@/components/PageHeader';
import Pagination from '@/components/Pagination';
import DeliveryNoteLink from '@/components/DeliveryNoteLink';
import SortableHeader from '@/components/SortableHeader';
import { useTableSort } from '@/hooks/useTableSort';

export default function OutboundLedgerClient({
  transactions = [],
  entityNames = {},
  stores = [],
  supervisorNames = {},
  initialPage = 1,
  initialTab = 'transactions',
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabVal = initialTab || (searchParams ? searchParams.get('tab') : '') || 'transactions';
  const [activeTab, setActiveTab] = useState(tabVal);

  const changeTab = (tab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      params.set('tab', tab);
      window.history.replaceState(null, '', `${pathname}?${params.toString()}`);
    }
  };

  const [pdfLoadingKey, setPdfLoadingKey] = useState(null);

  // Filters for Transactions Tab
  const [productFilter, setProductFilter] = useState(searchParams ? (searchParams.get('q') || searchParams.get('search') || '') : '');
  const [storeId, setStoreId] = useState(searchParams ? (searchParams.get('storeId') || '') : '');
  const [brandId, setBrandId] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Pagination for Transactions Tab
  const itemsPerPage = 25;
  const startPage = initialPage || (searchParams ? parseInt(searchParams.get('page') || '1', 10) : 1);
  const [page, setPage] = useState(startPage > 0 ? startPage : 1);

  // Search and Pagination for Delivery Notes Tab
  const [dnSearch, setDnSearch] = useState('');
  const [dnPage, setDnPage] = useState(1);
  const [expandedDn, setExpandedDn] = useState({});

  const toggleDnExpand = (dnKey) => {
    setExpandedDn(prev => ({
      ...prev,
      [dnKey]: !prev[dnKey]
    }));
  };

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [productFilter, storeId, brandId, categoryFilter]);

  useEffect(() => {
    setDnPage(1);
  }, [dnSearch]);

  const handlePageChange = (newPage) => {
    setPage(newPage);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      params.set('page', String(newPage));
      window.history.replaceState(null, '', `${pathname}?${params.toString()}`);
    }
  };

  // Group by Delivery Note across all transactions
  const deliveryNotesGroups = useMemo(() => {
    const groups = {};
    transactions.forEach(tx => {
      if (tx.deliveryNote) {
        const destId = tx.toEntityId || tx.fromEntityId || 'unknown';
        const key = `${tx.deliveryNote}_${destId}`;
        if (!groups[key]) {
          const destName = tx.toEntityType === 'CLIENT'
            ? (tx.toEntityId || 'Client Possession')
            : (entityNames[tx.toEntityId] || tx.toEntityId || '---');
          groups[key] = {
            deliveryNote: tx.deliveryNote,
            storeId: tx.toEntityId,
            storeName: destName,
            timestamp: tx.timestamp,
            items: []
          };
        }
        groups[key].items.push(tx);
      }
    });
    return Object.values(groups).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [transactions, entityNames]);

  const storeOptions = useMemo(() => [
    { value: '', label: 'All Stores' },
    ...stores.map(s => ({ value: s.id, label: s.name }))
  ], [stores]);

  const brandOptions = useMemo(() => {
    const map = {};
    (transactions || []).forEach(tx => {
      if (tx.product?.brandId && tx.product?.brand?.name) {
        map[tx.product.brandId] = tx.product.brand.name;
      }
    });
    return [{ value: '', label: 'All Brands' }, ...Object.entries(map).map(([id, name]) => ({ value: id, label: name })).sort((a, b) => a.label.localeCompare(b.label))];
  }, [transactions]);

  const categoryOptions = useMemo(() => {
    const set = new Set();
    (transactions || []).forEach(tx => {
      if (tx.product?.category) {
        set.add(tx.product.category);
      }
    });
    return [{ value: '', label: 'All Categories' }, ...Array.from(set).sort().map(cat => ({ value: cat, label: cat }))];
  }, [transactions]);

  // Comprehensive multi-field filtering across all outbound transactions
  const filteredTransactions = useMemo(() => {
    const q = productFilter.trim().toLowerCase();
    return transactions.filter(tx => {
      const matchStore = storeId
        ? (tx.toEntityType === 'STORE' && tx.toEntityId === storeId)
        : true;
      if (!matchStore) return false;

      const matchBrand = brandId ? tx.product?.brandId === brandId : true;
      if (!matchBrand) return false;

      const matchCat = categoryFilter ? tx.product?.category === categoryFilter : true;
      if (!matchCat) return false;

      if (!q) return true;

      const prodName = tx.product?.name?.toLowerCase() || '';
      const prodCode = tx.product?.itemCode?.toLowerCase() || '';
      const brandName = tx.product?.brand?.name?.toLowerCase() || '';
      const catName = tx.product?.category?.toLowerCase() || '';
      const dn = tx.deliveryNote?.toLowerCase() || '';
      const dest = (entityNames[tx.toEntityId] || tx.toEntityId || '').toLowerCase();
      const sup = (tx.deliverySupervisor?.name || supervisorNames[tx.deliverySupervisorId] || '').toLowerCase();
      const notes = tx.notes?.toLowerCase() || '';

      return (
        prodName.includes(q) ||
        prodCode.includes(q) ||
        brandName.includes(q) ||
        catName.includes(q) ||
        dn.includes(q) ||
        dest.includes(q) ||
        sup.includes(q) ||
        notes.includes(q)
      );
    });
  }, [transactions, productFilter, storeId, brandId, categoryFilter, entityNames, supervisorNames]);

  const outboundGetters = useMemo(() => ({
    product: (tx) => tx.product?.name || '',
    date: (tx) => tx.timestamp,
    sku: (tx) => tx.product?.itemCode || '',
    destinationType: (tx) => tx.toEntityType || '',
    destination: (tx) => tx.toEntityType === 'CLIENT' ? (tx.toEntityId || 'Client Possession') : (entityNames[tx.toEntityId] || tx.toEntityId || ''),
    supervisor: (tx) => tx.deliverySupervisor?.name || (tx.deliverySupervisorId ? (supervisorNames[tx.deliverySupervisorId] || tx.deliverySupervisorId) : ''),
    quantity: (tx) => tx.quantity ?? 0,
    deliveryNote: (tx) => tx.deliveryNote || '',
    notes: (tx) => tx.notes || '',
  }), [entityNames, supervisorNames]);

  const {
    sortedItems: sortedTransactions,
    sortField: outboundSortField,
    sortDirection: outboundSortDirection,
    handleSort: handleOutboundSort,
  } = useTableSort(filteredTransactions, 'date', 'desc', outboundGetters);

  const totalPages = Math.ceil(sortedTransactions.length / itemsPerPage);
  const paginatedTransactions = useMemo(() => {
    return sortedTransactions.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  }, [sortedTransactions, page, itemsPerPage]);

  const filteredGroups = useMemo(() => {
    const q = dnSearch.trim().toLowerCase();
    if (!q) return deliveryNotesGroups;
    return deliveryNotesGroups.filter(g =>
      g.deliveryNote.toLowerCase().includes(q) ||
      g.storeName.toLowerCase().includes(q) ||
      g.items.some(item =>
        item.product?.name?.toLowerCase().includes(q) ||
        item.product?.itemCode?.toLowerCase().includes(q)
      )
    );
  }, [deliveryNotesGroups, dnSearch]);

  const totalDnPages = Math.ceil(filteredGroups.length / itemsPerPage);
  const paginatedGroups = useMemo(() => {
    return filteredGroups.slice((dnPage - 1) * itemsPerPage, dnPage * itemsPerPage);
  }, [filteredGroups, dnPage, itemsPerPage]);

  const clearFilters = () => {
    setProductFilter('');
    setStoreId('');
    setBrandId('');
    setCategoryFilter('');
    setPage(1);
    const params = new URLSearchParams(searchParams ? searchParams.toString() : '');
    params.delete('search');
    params.delete('q');
    params.delete('storeId');
    params.set('page', '1');
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `${pathname}?${params.toString()}`);
    }
  };

  return (
    <div className="flex flex-col gap-6 relative">
      <PageHeader
        icon={ArrowUpRight}
        title="Outbound Dispatches"
        description="Audit logs of all stock allocations, promoter issues, and store shipments."
        actions={<>
          <CopyDeliveryNoteButton type="outbound" noteType="Delivery" />
          <ExportToExcel
            data={filteredTransactions.map(tx => ({
              Product: tx.product?.name || '',
              SKU: tx.product?.itemCode || '',
              Barcode: tx.barcode || '',
              Brand: tx.product?.brand?.name || '',
              Category: tx.product?.category || '',
              Date: new Date(tx.timestamp).toLocaleDateString('en-AE', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
              'Dest. Type': tx.toEntityType || '',
              Destination: tx.toEntityType === 'STORE' ? (entityNames[tx.toEntityId] || tx.toEntityId) : (tx.toEntityType === 'SUPERVISOR' ? (supervisorNames[tx.toEntityId] || tx.toEntityId) : tx.toEntityId || ''),
              Supervisor: tx.deliverySupervisor?.name || (tx.deliverySupervisorId ? (supervisorNames[tx.deliverySupervisorId] || tx.deliverySupervisorId) : ''),
              Quantity: tx.quantity,
              'Delivery Note': tx.deliveryNote || '',
              Notes: tx.notes || '',
            }))}
            columns={[
              { header: 'Product', key: 'Product', width: 25 },
              { header: 'SKU', key: 'SKU', width: 14 },
              { header: 'Barcode', key: 'Barcode', width: 22 },
              { header: 'Brand', key: 'Brand', width: 18 },
              { header: 'Category', key: 'Category', width: 18 },
              { header: 'Date', key: 'Date', width: 18 },
              { header: 'Dest. Type', key: 'Dest. Type', width: 12 },
              { header: 'Destination', key: 'Destination', width: 22 },
              { header: 'Supervisor', key: 'Supervisor', width: 18 },
              { header: 'Quantity', key: 'Quantity', width: 10 },
              { header: 'Delivery Note', key: 'Delivery Note', width: 20 },
              { header: 'Notes', key: 'Notes', width: 25 },
            ]}
            filename="IML-Outbound-Ledger"
          />
          <Link 
            href="/dashboard/outbound/new" 
            className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-1.5 sm:py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-xs sm:text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200 whitespace-nowrap"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">New Outbound Dispatch</span>
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
          { key: 'delivery_notes', label: 'Grouped Delivery Notes' },
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
                placeholder="Search by product, SKU, delivery note, store, or supervisor..."
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
              <div className="w-full">
                <CustomSelect
                  options={storeOptions}
                  value={storeId}
                  onChange={setStoreId}
                  placeholder="All Stores"
                />
              </div>
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
                {(productFilter || storeId || brandId || categoryFilter) && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="px-3 py-2.5 text-xs font-semibold text-text-secondary hover:text-danger hover:bg-danger/10 border border-border rounded-lg transition-all whitespace-nowrap flex items-center justify-center shrink-0"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Top Pagination */}
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={sortedTransactions.length}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
            itemLabel="dispatches"
          />

          {/* Mobile Card View */}
          {sortedTransactions.length === 0 ? (
            <div className="md:hidden bg-surface border border-border rounded-xl shadow-sm py-16 text-center flex flex-col items-center gap-3 text-text-muted">
              <ArrowUpRight size={48} className="text-text-muted opacity-30" />
              <h3 className="font-display font-bold text-lg text-text-primary">No matching transactions</h3>
              <p className="text-xs text-text-muted">Try changing your search keywords or store filter.</p>
            </div>
          ) : (
            <div className="md:hidden flex flex-col gap-3">
              {paginatedTransactions.map((tx) => {
                const dateStr = new Date(tx.timestamp).toLocaleDateString('en-AE', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                const destinationName = tx.toEntityType === 'CLIENT' ? (tx.toEntityId || 'Client Possession') : (entityNames[tx.toEntityId] || tx.toEntityId || '---');
                const supName = tx.deliverySupervisor?.name || (tx.deliverySupervisorId ? supervisorNames[tx.deliverySupervisorId] : '');

                return (
                  <div key={tx.id} className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <Link href={`/dashboard/products/${tx.product.id}`} className="font-semibold text-sm text-text-primary block break-words leading-snug hover:text-primary transition-colors">{tx.product.name}</Link>
                        <div className="flex items-center gap-2 text-[11px] text-text-muted mt-0.5">
                          <span>{tx.product.brand?.name || 'General'}</span>
                          {tx.product.itemCode && <span>· SKU: {tx.product.itemCode}</span>}
                        </div>
                      </div>
                      <span className="badge text-[10px] bg-secondary/15 text-secondary border border-secondary/10 flex-shrink-0">{tx.toEntityType}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-secondary font-medium">{dateStr}</span>
                      <span className="font-mono font-bold text-sm text-primary">-{tx.quantity}</span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px]">
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="text-text-secondary font-medium truncate">{destinationName}</span>
                        {supName && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-primary font-semibold mt-0.5">
                            <UserCheck size={11} /> {supName}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <DeliveryNoteLink tx={tx} />
                        <TransactionActions txId={tx.id} notes={tx.notes || ''} deliveryNote={tx.deliveryNote || ''} showDeliveryNote={true} />
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
                <ArrowUpRight size={48} className="text-text-muted opacity-30" />
                <h3 className="font-display font-bold text-lg text-text-primary">No matching transactions</h3>
                <p className="text-xs text-text-muted">Try changing your search keywords or store filter.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border text-[10px] sm:text-[11px] md:text-xs">
                    <thead>
                      <tr className="text-left text-xs font-bold text-text-secondary uppercase tracking-wider bg-surface-elevated/40">
                        <SortableHeader field="product" currentField={outboundSortField} direction={outboundSortDirection} onSort={handleOutboundSort} className="py-2 sm:py-3 pl-4 sm:pl-5 pr-3 sm:pr-4 sticky left-0 bg-surface-sticky z-20 border-r border-border shadow-sm">Product Details</SortableHeader>
                        <SortableHeader field="date" currentField={outboundSortField} direction={outboundSortDirection} onSort={handleOutboundSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Date</SortableHeader>
                        <SortableHeader field="sku" currentField={outboundSortField} direction={outboundSortDirection} onSort={handleOutboundSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">SKU</SortableHeader>
                        <SortableHeader field="destinationType" currentField={outboundSortField} direction={outboundSortDirection} onSort={handleOutboundSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Destination Type</SortableHeader>
                        <SortableHeader field="destination" currentField={outboundSortField} direction={outboundSortDirection} onSort={handleOutboundSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Destination Entity</SortableHeader>
                        <SortableHeader field="supervisor" currentField={outboundSortField} direction={outboundSortDirection} onSort={handleOutboundSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Via Supervisor</SortableHeader>
                        <SortableHeader field="quantity" currentField={outboundSortField} direction={outboundSortDirection} onSort={handleOutboundSort} align="center" className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Quantity</SortableHeader>
                        <SortableHeader field="deliveryNote" currentField={outboundSortField} direction={outboundSortDirection} onSort={handleOutboundSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Delivery Note</SortableHeader>
                        <SortableHeader field="notes" currentField={outboundSortField} direction={outboundSortDirection} onSort={handleOutboundSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Remarks</SortableHeader>
                        <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-text-primary">
                      {paginatedTransactions.map((tx) => {
                        const dateStr = new Date(tx.timestamp).toLocaleDateString('en-AE', { timeZone: 'Asia/Dubai',
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        });

                        const destinationName = tx.toEntityType === 'CLIENT' 
                          ? (tx.toEntityId || 'Client Possession') 
                          : (entityNames[tx.toEntityId] || tx.toEntityId || '---');

                        const supName = tx.deliverySupervisor?.name || (tx.deliverySupervisorId ? supervisorNames[tx.deliverySupervisorId] : '');

                        return (
                          <tr key={tx.id} className="hover:bg-surface-elevated/20 transition-colors group/row">
                            <td className="py-2 sm:py-3 pl-4 sm:pl-5 pr-3 sm:pr-4 min-w-[220px] sticky left-0 bg-surface group-hover/row:bg-surface-elevated z-10 border-r border-border shadow-sm">
                              <div className="flex flex-col">
                                <Link href={`/dashboard/products/${tx.product.id}`} className="font-semibold hover:text-primary transition-colors break-words leading-snug">{tx.product.name}</Link>
                                <span className="text-[11px] text-text-muted mt-0.5">Brand: {tx.product.brand?.name || 'General'}</span>
                              </div>
                            </td>
                            <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap text-xs text-text-secondary font-medium">{dateStr}</td>
                            <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap font-mono text-xs text-text-secondary">{tx.product.itemCode || '---'}</td>
                            <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap">
                              <span className="badge text-[10px] bg-secondary/15 text-secondary border border-secondary/10">{tx.toEntityType}</span>
                            </td>
                            <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 font-semibold text-xs text-text-secondary whitespace-nowrap">{destinationName}</td>
                            <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap">
                              {supName ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                                  <UserCheck size={12} />
                                  {supName}
                                </span>
                              ) : (
                                <span className="text-xs text-text-muted">—</span>
                              )}
                            </td>
                            <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-center font-mono font-bold text-sm whitespace-nowrap text-primary">-{tx.quantity}</td>
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
                                copyType="outbound"
                                copyDnUrl={tx.deliveryNote ? `/dashboard/outbound/new?copyDn=${encodeURIComponent(tx.deliveryNote)}` : null}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Bottom Pagination */}
                <div className="p-4 border-t border-border bg-surface-elevated/20">
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    totalItems={sortedTransactions.length}
                    itemsPerPage={itemsPerPage}
                    onPageChange={handlePageChange}
                    itemLabel="dispatches"
                  />
                </div>
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
                placeholder="Search Delivery Notes, stores, or products..."
                className="w-full pl-9 pr-4 py-2 bg-surface-elevated/50 border border-border rounded-lg text-sm focus:outline-none focus:border-primary transition-colors"
                value={dnSearch}
                onChange={e => setDnSearch(e.target.value)}
              />
              {dnSearch && (
                <button
                  type="button"
                  onClick={() => setDnSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-0.5"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Top Pagination for Delivery Notes */}
          <Pagination
            currentPage={dnPage}
            totalPages={totalDnPages}
            totalItems={filteredGroups.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setDnPage}
            itemLabel="delivery notes"
          />

          <div className="flex flex-col gap-3">
            {filteredGroups.length === 0 ? (
              <div className="py-16 text-center flex flex-col items-center gap-3 text-text-muted bg-surface rounded-xl border border-border">
                <FileText size={48} className="text-text-muted opacity-30" />
                <h3 className="font-display font-bold text-lg text-text-primary">No Delivery Notes found</h3>
                <p className="text-xs text-text-muted">No delivery notes match your search criteria.</p>
              </div>
            ) : (
              paginatedGroups.map(group => {
                const groupKey = `${group.deliveryNote}_${group.storeId}`;
                const isExpanded = expandedDn[groupKey];
                
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
                            <span className="badge text-[10px] bg-secondary/15 text-secondary border border-secondary/10 px-2 py-0.5 rounded uppercase tracking-wider whitespace-nowrap flex-shrink-0">{group.storeName}</span>
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
                        <button
                          onClick={() => router.push(`/dashboard/outbound/${encodeURIComponent(group.deliveryNote)}/edit`)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 font-bold text-xs rounded-lg transition-colors whitespace-nowrap"
                          title="Edit Outbound"
                        >
                          <Edit2 size={13} />
                          <span className="hidden sm:inline">Edit</span>
                        </button>
                        <button
                          onClick={() => router.push(`/dashboard/outbound/new?copyDn=${encodeURIComponent(group.deliveryNote)}`)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-success/10 hover:bg-success/20 text-success border border-success/20 font-bold text-xs rounded-lg transition-colors whitespace-nowrap"
                          title="Duplicate"
                        >
                          <CopyPlus size={13} />
                          <span className="hidden sm:inline">Duplicate</span>
                        </button>
                        {group.items.some(tx => tx.product?.isReturnable) && (
                          <button
                            onClick={() => router.push(`/dashboard/returns?dn=${encodeURIComponent(group.deliveryNote)}`)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 font-bold text-xs rounded-lg transition-colors whitespace-nowrap"
                            title="Return Items"
                          >
                            <RotateCcw size={13} />
                            <span className="hidden sm:inline">Return</span>
                          </button>
                        )}
                        {group.items.some(tx => tx.product?.isDisposable) && (
                          <button
                            onClick={() => router.push(`/dashboard/used?dn=${encodeURIComponent(group.deliveryNote)}`)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-warning/10 hover:bg-warning/20 text-warning border border-warning/20 font-bold text-xs rounded-lg transition-colors whitespace-nowrap"
                            title="Mark Items as Used"
                          >
                            <Trash2 size={13} />
                            <span className="hidden sm:inline">Mark Used</span>
                          </button>
                        )}
                        <a
                          href={`/api/dashboard/returns/delivery-note?date=${new Date(group.timestamp).toISOString().split('T')[0]}&dn=${encodeURIComponent(group.deliveryNote)}`}
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
                                <td className="py-2.5 pl-5 pr-4 font-medium text-xs break-words leading-snug min-w-[200px]">{tx.product?.name}</td>
                                <td className="py-2.5 px-4 text-xs font-mono text-text-secondary whitespace-nowrap">{tx.product?.itemCode || '---'}</td>
                                <td className="py-2.5 px-4 text-xs text-text-secondary whitespace-nowrap">{tx.product?.brand?.name || 'General'}</td>
                                <td className="py-2.5 px-4 text-center font-mono text-xs font-bold text-primary whitespace-nowrap">-{tx.quantity}</td>
                                <td className="py-2.5 px-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                    {tx.product?.isReturnable && (
                                      <button
                                        type="button"
                                        onClick={() => router.push(`/dashboard/returns?dn=${encodeURIComponent(tx.deliveryNote || '')}`)}
                                        className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 font-bold text-[10px] rounded-md transition-colors"
                                      >
                                        <RotateCcw size={10} /> Return
                                      </button>
                                    )}
                                    {tx.product?.isDisposable && (
                                      <button
                                        type="button"
                                        onClick={() => router.push(`/dashboard/used?dn=${encodeURIComponent(tx.deliveryNote || '')}`)}
                                        className="inline-flex items-center gap-1 px-2 py-1 bg-warning/10 hover:bg-warning/20 text-warning border border-warning/20 font-bold text-[10px] rounded-md transition-colors"
                                      >
                                        <Trash2 size={10} /> Mark Used
                                      </button>
                                    )}
                                    <TransactionActions
                                      txId={tx.id}
                                      notes={tx.notes || ''}
                                      deliveryNote={tx.deliveryNote || ''}
                                      showDeliveryNote={true}
                                      copyType="outbound"
                                    />
                                  </div>
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

          {/* Bottom Pagination for Delivery Notes */}
          <Pagination
            currentPage={dnPage}
            totalPages={totalDnPages}
            totalItems={filteredGroups.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setDnPage}
            itemLabel="delivery notes"
          />
        </div>
      )}
    </div>
  );
}
