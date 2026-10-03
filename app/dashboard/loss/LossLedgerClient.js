'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { AlertCircle, Search, X, RefreshCw } from 'lucide-react';
import TransactionActions from '@/components/TransactionActions';
import ExportToExcel from '@/components/ExportToExcel';
import Pagination from '@/components/Pagination';
import SortableHeader from '@/components/SortableHeader';
import CustomSelect from '@/components/CustomSelect';
import { useTableSort } from '@/hooks/useTableSort';

export default function LossLedgerClient({
  transactions = [],
  totalCount = 0,
  initialPage = 1,
  pageSize = 25,
  entityNames = {},
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Filters State
  const [searchQuery, setSearchQuery] = useState(searchParams?.get('q') || '');
  const [brandFilter, setBrandFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');

  // Pagination State
  const [page, setPage] = useState(initialPage || 1);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, brandFilter, categoryFilter, sourceFilter]);

  const handlePageChange = (newPage) => {
    setPage(newPage);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      params.set('page', String(newPage));
      window.history.replaceState(null, '', `${pathname}?${params.toString()}`);
    }
  };

  // Filter Options
  const brandOptions = useMemo(() => {
    const map = {};
    (transactions || []).forEach(tx => {
      if (tx.product?.brand?.name) {
        map[tx.product.brand.id || tx.product.brand.name] = tx.product.brand.name;
      }
    });
    return [
      { value: 'ALL', label: 'All Brands' },
      ...Object.entries(map).map(([id, name]) => ({ value: id, label: name })).sort((a, b) => a.label.localeCompare(b.label))
    ];
  }, [transactions]);

  const categoryOptions = useMemo(() => {
    const set = new Set();
    (transactions || []).forEach(tx => {
      if (tx.product?.category) set.add(tx.product.category);
    });
    return [
      { value: 'ALL', label: 'All Categories' },
      ...Array.from(set).sort().map(cat => ({ value: cat, label: cat }))
    ];
  }, [transactions]);

  const sourceOptions = useMemo(() => {
    const set = new Set();
    (transactions || []).forEach(tx => {
      if (tx.fromEntityType === 'WAREHOUSE') {
        set.add('Warehouse');
      } else if (entityNames[tx.fromEntityId]) {
        set.add(entityNames[tx.fromEntityId]);
      } else if (tx.fromEntityType) {
        set.add(tx.fromEntityType);
      }
    });
    return [
      { value: 'ALL', label: 'All Sources' },
      ...Array.from(set).sort().map(s => ({ value: s, label: s }))
    ];
  }, [transactions, entityNames]);

  const getSourceName = (tx) => {
    if (tx.fromEntityType === 'WAREHOUSE') return 'Warehouse';
    return entityNames?.[tx.fromEntityId] || tx.fromEntityType || '---';
  };

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return (transactions || []).filter(tx => {
      // Brand filter
      if (brandFilter !== 'ALL') {
        const bId = tx.product?.brand?.id || tx.product?.brand?.name;
        if (bId !== brandFilter && tx.product?.brandId !== brandFilter) return false;
      }

      // Category filter
      if (categoryFilter !== 'ALL') {
        if (tx.product?.category !== categoryFilter) return false;
      }

      // Source filter
      if (sourceFilter !== 'ALL') {
        const src = getSourceName(tx);
        if (src !== sourceFilter) return false;
      }

      // Text query
      if (q) {
        const pName = tx.product?.name?.toLowerCase() || '';
        const bName = tx.product?.brand?.name?.toLowerCase() || '';
        const cName = tx.product?.category?.toLowerCase() || '';
        const sku = tx.product?.itemCode?.toLowerCase() || '';
        const dn = tx.deliveryNote?.toLowerCase() || '';
        const notes = tx.notes?.toLowerCase() || '';
        const src = getSourceName(tx).toLowerCase();

        return (
          pName.includes(q) ||
          bName.includes(q) ||
          cName.includes(q) ||
          sku.includes(q) ||
          dn.includes(q) ||
          notes.includes(q) ||
          src.includes(q)
        );
      }

      return true;
    });
  }, [transactions, searchQuery, brandFilter, categoryFilter, sourceFilter, entityNames]);

  const customGetters = useMemo(() => ({
    date: (tx) => (tx.timestamp ? new Date(tx.timestamp).getTime() : 0),
    product: (tx) => tx.product?.name || '',
    brand: (tx) => tx.product?.brand?.name || '',
    sku: (tx) => tx.product?.itemCode || '',
    source: (tx) => getSourceName(tx),
    quantity: (tx) => tx.quantity || 0,
    deliveryNote: (tx) => tx.deliveryNote || '',
    notes: (tx) => tx.notes || '',
  }), [entityNames]);

  const {
    items: sortedTransactions,
    sortField,
    sortDirection,
    handleSort,
  } = useTableSort(filteredTransactions, {
    defaultSortField: 'date',
    defaultSortDirection: 'desc',
    customGetters,
  });

  const totalPages = Math.ceil(sortedTransactions.length / pageSize);
  const paginatedTransactions = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedTransactions.slice(start, start + pageSize);
  }, [sortedTransactions, page, pageSize]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 pb-5 border-b border-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-text-primary tracking-tight">
            Loss Ledger
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Logs of stock reported as missing, stolen, or unaccounted for.
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <ExportToExcel
            data={filteredTransactions.map((tx) => ({
              Date: new Date(tx.timestamp).toLocaleDateString('en-AE', {
                timeZone: 'Asia/Dubai',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              }),
              Product: tx.product?.name || '',
              Brand: tx.product?.brand?.name || '',
              Category: tx.product?.category || '',
              SKU: tx.product?.itemCode || '',
              'Lost From': getSourceName(tx),
              Quantity: tx.quantity,
              'Loss Note': tx.deliveryNote || '',
              Notes: tx.notes || '',
            }))}
            columns={[
              { header: 'Date', key: 'Date', width: 18 },
              { header: 'Product', key: 'Product', width: 25 },
              { header: 'Brand', key: 'Brand', width: 18 },
              { header: 'Category', key: 'Category', width: 18 },
              { header: 'SKU', key: 'SKU', width: 16 },
              { header: 'Lost From', key: 'Lost From', width: 20 },
              { header: 'Quantity', key: 'Quantity', width: 10 },
              { header: 'Loss Note', key: 'Loss Note', width: 20 },
              { header: 'Notes', key: 'Notes', width: 25 },
            ]}
            filename="IML-Loss-Ledger"
          />
          <Link
            href="/dashboard/loss/new"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-warning hover:bg-warning/90 text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
          >
            <AlertCircle size={15} />
            <span>Report Loss</span>
          </Link>
        </div>
      </header>

      {/* Filter Bar */}
      <div className="bg-surface border border-border rounded-xl p-4 shadow-sm flex flex-col gap-3">
        {/* Top Full-Width Search Input */}
        <div className="relative w-full">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search by product, SKU, brand, category, loss note, or source..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-elevated/40 text-text-primary border border-border rounded-xl pl-10 pr-9 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-semibold shadow-xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-0.5 rounded-full hover:bg-surface-elevated transition-colors"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Dropdown Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
          <div className="w-full">
            <CustomSelect
              options={brandOptions}
              value={brandFilter}
              onChange={(val) => setBrandFilter(val)}
              placeholder="All Brands"
            />
          </div>
          <div className="w-full">
            <CustomSelect
              options={categoryOptions}
              value={categoryFilter}
              onChange={(val) => setCategoryFilter(val)}
              placeholder="All Categories"
            />
          </div>
          <div className="flex items-center gap-2 w-full">
            <div className="flex-1">
              <CustomSelect
                options={sourceOptions}
                value={sourceFilter}
                onChange={(val) => setSourceFilter(val)}
                placeholder="All Sources"
              />
            </div>
            {(searchQuery || brandFilter !== 'ALL' || categoryFilter !== 'ALL' || sourceFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setBrandFilter('ALL'); setCategoryFilter('ALL'); setSourceFilter('ALL'); }}
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

      {/* Transactions Table */}
      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
        {sortedTransactions.length === 0 ? (
          <div className="py-16 text-center flex flex-col items-center gap-3 text-text-muted bg-surface">
            <AlertCircle size={48} className="text-text-muted opacity-30" />
            <h3 className="font-display font-bold text-lg text-text-primary">
              No loss reports found
            </h3>
            <p className="text-sm max-w-xs">
              {searchQuery || brandFilter !== 'ALL' || categoryFilter !== 'ALL' || sourceFilter !== 'ALL'
                ? 'Try adjusting your search or filters.'
                : 'Click "Report Loss" to log a missing or lost item.'}
            </p>
            {(searchQuery || brandFilter !== 'ALL' || categoryFilter !== 'ALL' || sourceFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setBrandFilter('ALL'); setCategoryFilter('ALL'); setSourceFilter('ALL'); }}
                className="mt-2 text-xs font-semibold text-primary hover:underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={sortedTransactions.length}
              itemsPerPage={pageSize}
              onPageChange={handlePageChange}
              itemLabel="loss reports"
            />
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead>
                  <tr className="text-left text-xs font-bold text-text-secondary uppercase tracking-wider bg-surface-elevated/40">
                    <SortableHeader field="date" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} className="py-3 px-5">Date</SortableHeader>
                    <SortableHeader field="product" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} className="py-3 px-5">Product Details</SortableHeader>
                    <SortableHeader field="sku" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} className="py-3 px-5">SKU</SortableHeader>
                    <SortableHeader field="source" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} className="py-3 px-5">Lost From</SortableHeader>
                    <SortableHeader field="quantity" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} align="center" className="py-3 px-5">Quantity</SortableHeader>
                    <SortableHeader field="deliveryNote" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} className="py-3 px-5">Loss Note</SortableHeader>
                    <SortableHeader field="notes" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} className="py-3 px-5">Remarks</SortableHeader>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-text-primary">
                  {paginatedTransactions.map((tx) => {
                    const dateObj = new Date(tx.timestamp);
                    const dateStr = dateObj.toLocaleDateString('en-AE', {
                      timeZone: 'Asia/Dubai',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    const sourceName = getSourceName(tx);
                    return (
                      <tr key={tx.id} className="hover:bg-surface-elevated/20 transition-colors">
                        <td className="py-3.5 px-5 whitespace-nowrap text-xs text-text-secondary font-medium">
                          {dateStr}
                        </td>
                        <td className="py-3.5 px-5 whitespace-nowrap">
                          <div className="flex flex-col">
                            <Link
                              href={`/dashboard/products/${tx.product?.id}`}
                              className="font-semibold text-primary hover:text-primary-hover hover:underline transition-colors"
                            >
                              {tx.product?.name}
                            </Link>
                            <span className="text-[11px] text-text-muted mt-0.5">
                              Brand: {tx.product?.brand?.name || 'General'}{tx.product?.category ? ` · ${tx.product.category}` : ''}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-5 whitespace-nowrap font-mono text-xs text-text-secondary">
                          {tx.product?.itemCode || '---'}
                        </td>
                        <td className="py-3.5 px-5 font-semibold text-xs text-text-secondary">
                          {sourceName}
                        </td>
                        <td className="py-3.5 px-3 sm:px-5 text-center font-mono font-bold text-sm whitespace-nowrap text-warning">
                          -{tx.quantity}
                        </td>
                        <td className="py-3.5 px-3 sm:px-5 font-mono text-xs text-text-secondary whitespace-nowrap">
                          {tx.deliveryNote ? (
                            <a
                              href={`/api/dashboard/loss/delivery-note?date=${new Date(tx.timestamp).toISOString().split('T')[0]}&brandId=${tx.product?.brandId}&dn=${tx.deliveryNote}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:text-primary-hover hover:underline transition-colors font-semibold has-tooltip"
                            >
                              {tx.deliveryNote}
                              <span className="tooltip-box">Download Loss Note PDF</span>
                            </a>
                          ) : (
                            <span className="text-text-muted">---</span>
                          )}
                        </td>
                        <td
                          className="py-3.5 px-3 sm:px-5 max-w-xs truncate text-xs text-text-secondary"
                          title={tx.notes || ''}
                        >
                          {tx.notes || '---'}
                        </td>
                        <td className="py-3.5 px-3 sm:px-5 text-right">
                          <TransactionActions
                            txId={tx.id}
                            notes={tx.notes || ''}
                            showDeliveryNote={false}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={sortedTransactions.length}
              itemsPerPage={pageSize}
              onPageChange={handlePageChange}
              itemLabel="loss reports"
            />
          </>
        )}
      </div>
    </div>
  );
}
