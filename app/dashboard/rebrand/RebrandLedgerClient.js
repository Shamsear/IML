'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { RefreshCw, Plus, Search, X, Package, FileText, Store } from 'lucide-react';
import TransactionActions from '@/components/TransactionActions';
import ExportToExcel from '@/components/ExportToExcel';
import Pagination from '@/components/Pagination';
import SortableHeader from '@/components/SortableHeader';
import { useTableSort } from '@/hooks/useTableSort';

export default function RebrandLedgerClient({
  transactions = [],
  entityNames = {},
  initialPage = 1,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Search & Type Filters
  const [searchTerm, setSearchTerm] = useState(searchParams?.get('q') || searchParams?.get('search') || '');
  const [typeFilter, setTypeFilter] = useState(searchParams?.get('type') || 'ALL');

  // Pagination
  const itemsPerPage = 25;
  const startPage = initialPage || (searchParams ? parseInt(searchParams.get('page') || '1', 10) : 1);
  const [page, setPage] = useState(startPage > 0 ? startPage : 1);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, typeFilter]);

  const handlePageChange = (newPage) => {
    setPage(newPage);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      params.set('page', String(newPage));
      window.history.replaceState(null, '', `${pathname}?${params.toString()}`);
    }
  };

  const getFromName = (tx) => {
    if (tx.fromEntityType === 'WAREHOUSE' || tx.fromEntityId === 'WH-MAIN') return 'Main Warehouse';
    if (entityNames[tx.fromEntityId]) return entityNames[tx.fromEntityId];
    if (tx.fromEntityId) return tx.fromEntityId;
    if (tx.fromEntityType) return tx.fromEntityType;
    if (tx.notes && tx.notes.includes('Rebrand input <-')) {
      const match = tx.notes.match(/Rebrand input <-\s*([^.]+)/);
      if (match) return match[1].trim();
    }
    return '—';
  };

  const getToName = (tx) => {
    if (tx.toEntityType === 'WAREHOUSE' || tx.toEntityId === 'WH-MAIN') return 'Main Warehouse';
    if (entityNames[tx.toEntityId]) return entityNames[tx.toEntityId];
    if (tx.toEntityId) return tx.toEntityId;
    if (tx.toEntityType) return tx.toEntityType;
    if (tx.notes && tx.notes.includes('Rebrand output ->')) {
      const match = tx.notes.match(/Rebrand output ->\s*([^.]+)/);
      if (match) return match[1].trim();
    }
    return '—';
  };

  const getDestinationName = (tx) => getToName(tx);

  const getTypeName = (tx) => {
    if (tx.transactionType === 'REBRAND_IN') return 'REBRAND IN (Gain)';
    if (tx.transactionType === 'REBRAND_OUT') return 'REBRAND OUT (Loss)';
    return 'REBRAND (Outbound)';
  };

  // Filter items
  const filteredTransactions = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return transactions.filter((tx) => {
      // Type match
      if (typeFilter !== 'ALL' && tx.transactionType !== typeFilter) {
        return false;
      }
      if (!q) return true;

      const pName = tx.product?.name?.toLowerCase() || '';
      const bName = tx.product?.brand?.name?.toLowerCase() || '';
      const sku = tx.product?.itemCode?.toLowerCase() || '';
      const dn = tx.deliveryNote?.toLowerCase() || '';
      const from = getFromName(tx).toLowerCase();
      const to = getToName(tx).toLowerCase();
      const notes = tx.notes?.toLowerCase() || '';
      const serials = (tx.serialNumbers || []).map((s) => s.serialNumber?.barcode?.toLowerCase() || '').join(' ');

      return (
        pName.includes(q) ||
        bName.includes(q) ||
        sku.includes(q) ||
        dn.includes(q) ||
        from.includes(q) ||
        to.includes(q) ||
        notes.includes(q) ||
        serials.includes(q)
      );
    });
  }, [transactions, searchTerm, typeFilter, entityNames]);

  const customGetters = useMemo(() => ({
    date: (tx) => (tx.timestamp ? new Date(tx.timestamp).getTime() : 0),
    deliveryNote: (tx) => tx.deliveryNote || '',
    product: (tx) => tx.product?.name || '',
    brand: (tx) => tx.product?.brand?.name || '',
    sku: (tx) => tx.product?.itemCode || '',
    from: (tx) => getFromName(tx),
    to: (tx) => getToName(tx),
    destination: (tx) => getToName(tx),
    type: (tx) => getTypeName(tx),
    quantity: (tx) => (tx.transactionType === 'REBRAND_IN' ? tx.quantity : -tx.quantity),
    serials: (tx) => (tx.serialNumbers || []).map((s) => s.serialNumber?.barcode).join(', '),
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

  const totalPages = Math.ceil(sortedTransactions.length / itemsPerPage);
  const paginatedTransactions = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return sortedTransactions.slice(start, start + itemsPerPage);
  }, [sortedTransactions, page, itemsPerPage]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-border">
        <div>
          <h1 className="text-3xl font-display font-extrabold text-text-primary tracking-tight">
            Stock Rebranding Ledger
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Logs of stock items dispatched or converted into different product definitions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportToExcel
            data={filteredTransactions.map((tx) => ({
              Date: new Date(tx.timestamp).toLocaleDateString('en-AE', {
                timeZone: 'Asia/Dubai',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              }),
              'Delivery Note': tx.deliveryNote || '',
              Type: getTypeName(tx),
              Product: tx.product?.name || '',
              Brand: tx.product?.brand?.name || '',
              SKU: tx.product?.itemCode || '',
              From: getFromName(tx),
              To: getToName(tx),
              Quantity: tx.quantity,
              Barcodes: (tx.serialNumbers || []).map((s) => s.serialNumber?.barcode).filter(Boolean).join(', '),
              Notes: tx.notes || '',
            }))}
            columns={[
              { header: 'Date', key: 'Date', width: 18 },
              { header: 'Delivery Note', key: 'Delivery Note', width: 22 },
              { header: 'Type', key: 'Type', width: 18 },
              { header: 'Product', key: 'Product', width: 25 },
              { header: 'Brand', key: 'Brand', width: 18 },
              { header: 'SKU', key: 'SKU', width: 16 },
              { header: 'From', key: 'From', width: 20 },
              { header: 'To', key: 'To', width: 20 },
              { header: 'Quantity', key: 'Quantity', width: 10 },
              { header: 'Barcodes', key: 'Barcodes', width: 22 },
              { header: 'Notes', key: 'Notes', width: 25 },
            ]}
            filename="IML-Rebrand-Ledger"
          />
          <Link
            href="/dashboard/rebrand/new"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
          >
            <Plus size={16} />
            <span>New Rebranding Map</span>
          </Link>
        </div>
      </header>

      {/* Filter Bar */}
      <div className="bg-surface border border-border rounded-xl p-4 shadow-sm flex flex-col sm:flex-row gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search by product, SKU, brand, delivery note, vendor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-surface-elevated/40 text-text-primary border border-border rounded-lg pl-10 pr-9 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-0.5 rounded"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Type Filter */}
        <div className="sm:w-56">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full bg-surface-elevated/40 text-text-primary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-semibold"
          >
            <option value="ALL">All Rebrand Types</option>
            <option value="REBRAND">Rebrand (Outbound)</option>
            <option value="REBRAND_OUT">Rebrand Out (Loss)</option>
            <option value="REBRAND_IN">Rebrand In (Gain)</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
        {sortedTransactions.length === 0 ? (
          <div className="py-16 text-center flex flex-col items-center gap-3 text-text-muted bg-surface">
            <RefreshCw size={48} className="text-text-muted opacity-30" />
            <h3 className="font-display font-bold text-lg text-text-primary">
              No rebranding logs found
            </h3>
            <p className="text-sm max-w-xs">
              {searchTerm || typeFilter !== 'ALL'
                ? 'Try adjusting your search or filters.'
                : 'Click "New Rebranding Map" to execute rebranding transfers.'}
            </p>
            {(searchTerm || typeFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setTypeFilter('ALL');
                }}
                className="mt-2 text-xs font-semibold text-primary hover:underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Top Pagination */}
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={sortedTransactions.length}
              itemsPerPage={itemsPerPage}
              onPageChange={handlePageChange}
              itemLabel="rebranding logs"
            />

            {/* Mobile Card View */}
            <div className="md:hidden flex flex-col divide-y divide-border">
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
                const isGain = tx.transactionType === 'REBRAND_IN';

                return (
                  <div key={tx.id} className="p-4 flex flex-col gap-2.5 hover:bg-surface-elevated/20 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col min-w-0">
                        <Link
                          href={`/dashboard/products/${tx.product?.id}`}
                          className="font-bold text-sm text-primary hover:text-primary-hover transition-colors truncate"
                        >
                          {tx.product?.name}
                        </Link>
                        <span className="text-[11px] text-text-muted">
                          Brand: {tx.product?.brand?.name || 'General'}
                        </span>
                      </div>
                      <span
                        className={`font-mono font-bold text-sm whitespace-nowrap ${
                          isGain ? 'text-success' : 'text-danger'
                        }`}
                      >
                        {isGain ? `+${tx.quantity}` : `-${tx.quantity}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-xs text-text-secondary">
                      {tx.deliveryNote && (
                        <span className="font-mono text-primary font-semibold bg-primary/10 px-1.5 py-0.5 rounded text-[11px]">
                          {tx.deliveryNote}
                        </span>
                      )}
                      <span
                        className={`badge text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          isGain
                            ? 'bg-success/10 border-success/20 text-success'
                            : tx.transactionType === 'REBRAND_OUT'
                            ? 'bg-danger/10 border-danger/20 text-danger'
                            : 'bg-primary/10 border-primary/20 text-primary'
                        }`}
                      >
                        {getTypeName(tx)}
                      </span>
                    </div>

                    {/* From & To Route */}
                    <div className="flex items-center gap-2 text-xs bg-surface-elevated/40 p-2 rounded-lg border border-border/50">
                      <div className="flex items-center gap-1 min-w-0 flex-1">
                        <span className="text-[10px] uppercase font-bold text-text-muted shrink-0">From:</span>
                        <span className="font-semibold text-text-primary text-xs truncate">{getFromName(tx)}</span>
                      </div>
                      <span className="text-text-muted font-bold px-1">→</span>
                      <div className="flex items-center gap-1 min-w-0 flex-1">
                        <span className="text-[10px] uppercase font-bold text-text-muted shrink-0">To:</span>
                        <span className="font-semibold text-text-primary text-xs truncate">{getToName(tx)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-text-muted pt-1 border-t border-border/40">
                      <span>{dateStr}</span>
                      <TransactionActions
                        txId={tx.id}
                        deliveryNote={tx.deliveryNote}
                        notes={tx.notes || ''}
                        showDeliveryNote={false}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead>
                  <tr className="text-left text-xs font-bold text-text-secondary uppercase tracking-wider bg-surface-elevated/40">
                    <SortableHeader field="date" currentField={sortField} direction={sortDirection} onSort={handleSort} className="py-3 px-4">Date</SortableHeader>
                    <SortableHeader field="deliveryNote" currentField={sortField} direction={sortDirection} onSort={handleSort} className="py-3 px-4">Delivery Note</SortableHeader>
                    <SortableHeader field="product" currentField={sortField} direction={sortDirection} onSort={handleSort} className="py-3 px-4">Product Details</SortableHeader>
                    <SortableHeader field="sku" currentField={sortField} direction={sortDirection} onSort={handleSort} className="py-3 px-4">SKU</SortableHeader>
                    <SortableHeader field="from" currentField={sortField} direction={sortDirection} onSort={handleSort} className="py-3 px-4">From</SortableHeader>
                    <SortableHeader field="to" currentField={sortField} direction={sortDirection} onSort={handleSort} className="py-3 px-4">To / Destination</SortableHeader>
                    <SortableHeader field="type" currentField={sortField} direction={sortDirection} onSort={handleSort} className="py-3 px-4">Action Type</SortableHeader>
                    <SortableHeader field="quantity" currentField={sortField} direction={sortDirection} onSort={handleSort} align="center" className="py-3 px-4 text-center">Quantity</SortableHeader>
                    <SortableHeader field="serials" currentField={sortField} direction={sortDirection} onSort={handleSort} className="py-3 px-4">Associated Serials</SortableHeader>
                    <SortableHeader field="notes" currentField={sortField} direction={sortDirection} onSort={handleSort} className="py-3 px-4">Remarks</SortableHeader>
                    <th className="py-3 px-4 text-right">Actions</th>
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
                    const isGain = tx.transactionType === 'REBRAND_IN';

                    return (
                      <tr key={tx.id} className="hover:bg-surface-elevated/20 transition-colors">
                        <td className="py-3.5 px-4 whitespace-nowrap text-xs text-text-secondary font-medium">
                          {dateStr}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs">
                          {tx.deliveryNote ? (
                            <span className="font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                              {tx.deliveryNote}
                            </span>
                          ) : (
                            <span className="text-text-muted">---</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap max-w-xs truncate">
                          <div className="flex flex-col">
                            <Link
                              href={`/dashboard/products/${tx.product?.id}`}
                              className="font-semibold text-primary hover:text-primary-hover hover:underline transition-colors"
                            >
                              {tx.product?.name}
                            </Link>
                            <span className="text-[11px] text-text-muted mt-0.5">
                              Brand: {tx.product?.brand?.name || 'General'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs text-text-secondary">
                          {tx.product?.itemCode || '---'}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap text-xs font-medium text-text-secondary">
                          {getFromName(tx)}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap text-xs font-semibold text-text-primary">
                          {getToName(tx)}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`badge text-[10px] px-2 py-0.5 rounded font-bold ${
                              isGain
                                ? 'bg-success/10 border-success/20 text-success'
                                : tx.transactionType === 'REBRAND_OUT'
                                ? 'bg-danger/10 border-danger/20 text-danger'
                                : 'bg-primary/10 border-primary/20 text-primary'
                            }`}
                          >
                            {getTypeName(tx)}
                          </span>
                        </td>
                        <td
                          className={`py-3.5 px-4 text-center font-mono font-bold text-sm whitespace-nowrap ${
                            isGain ? 'text-success' : 'text-danger'
                          }`}
                        >
                          {isGain ? `+${tx.quantity}` : `-${tx.quantity}`}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {tx.serialNumbers?.length > 0 ? (
                            <span
                              className="max-w-[180px] truncate block text-xs font-mono bg-surface-elevated px-1.5 py-0.5 rounded text-[10px]"
                              title={tx.serialNumbers
                                .map((s) => s.serialNumber?.barcode)
                                .join(', ')}
                            >
                              {tx.serialNumbers
                                .map((s) => s.serialNumber?.barcode)
                                .join(', ')}
                            </span>
                          ) : (
                            <span className="text-xs text-text-muted">—</span>
                          )}
                        </td>
                        <td
                          className="py-3.5 px-4 max-w-xs truncate text-xs text-text-secondary"
                          title={tx.notes || ''}
                        >
                          {tx.notes || '---'}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <TransactionActions
                            txId={tx.id}
                            deliveryNote={tx.deliveryNote}
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

            {/* Bottom Pagination */}
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={sortedTransactions.length}
              itemsPerPage={itemsPerPage}
              onPageChange={handlePageChange}
              itemLabel="rebranding logs"
            />
          </>
        )}
      </div>
    </div>
  );
}
