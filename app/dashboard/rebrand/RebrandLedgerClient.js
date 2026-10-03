'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { RefreshCw, Plus, Search, X, Package, FileText, Store, RotateCcw, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import TransactionActions from '@/components/TransactionActions';
import ExportToExcel from '@/components/ExportToExcel';
import Pagination from '@/components/Pagination';
import SortableHeader from '@/components/SortableHeader';
import { useTableSort } from '@/hooks/useTableSort';
import { useToast } from '@/components/Toast';
import { giveBackRebrandTransaction } from '@/app/actions/transactions';
import CustomSelect from '@/components/CustomSelect';

export default function RebrandLedgerClient({
  transactions = [],
  entityNames = {},
  products = [],
  initialPage = 1,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();

  // Give Back Modal state
  const [giveBackTx, setGiveBackTx] = useState(null);
  const [giveBackQty, setGiveBackQty] = useState('');
  const [giveBackProductId, setGiveBackProductId] = useState('');
  const [giveBackNotes, setGiveBackNotes] = useState('');
  const [giveBackLoading, setGiveBackLoading] = useState(false);
  const [giveBackError, setGiveBackError] = useState('');

  // Search & Type Filters
  const [searchTerm, setSearchTerm] = useState(searchParams?.get('q') || searchParams?.get('search') || '');
  const [typeFilter, setTypeFilter] = useState(searchParams?.get('type') || 'ALL');
  const [brandFilter, setBrandFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Pagination
  const itemsPerPage = 25;
  const startPage = initialPage || (searchParams ? parseInt(searchParams.get('page') || '1', 10) : 1);
  const [page, setPage] = useState(startPage > 0 ? startPage : 1);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, typeFilter, brandFilter, categoryFilter]);

  const handlePageChange = (newPage) => {
    setPage(newPage);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      params.set('page', String(newPage));
      window.history.replaceState(null, '', `${pathname}?${params.toString()}`);
    }
  };

  // Precompute map of deliveryNote -> { fromProduct, toProduct } to link paired REBRAND_OUT / REBRAND_IN entries
  const rebrandPairMap = useMemo(() => {
    const map = {};
    (transactions || []).forEach(t => {
      if (!t.deliveryNote) return;
      if (!map[t.deliveryNote]) map[t.deliveryNote] = {};
      if (t.transactionType === 'REBRAND_OUT') {
        map[t.deliveryNote].fromProduct = t.product?.name;
      } else if (t.transactionType === 'REBRAND_IN') {
        map[t.deliveryNote].toProduct = t.product?.name;
      }
    });
    return map;
  }, [transactions]);

  // Extract source (from) product name
  const getFromProductName = (tx) => {
    // 1. If this is an outbound conversion or legacy rebrand record, tx.product IS the source product
    if (tx.transactionType === 'REBRAND_OUT' || tx.transactionType === 'REBRAND') {
      return tx.product?.name || '—';
    }

    // 2. If this is a REBRAND_IN gain, look for the paired REBRAND_OUT product via deliveryNote
    if (tx.deliveryNote && rebrandPairMap[tx.deliveryNote]?.fromProduct) {
      return rebrandPairMap[tx.deliveryNote].fromProduct;
    }

    // 3. Check serial number replacements (replaces -> old serial -> product)
    if (tx.serialNumbers && tx.serialNumbers.length > 0) {
      for (const s of tx.serialNumbers) {
        if (s.serialNumber?.replaces?.product?.name) {
          return s.serialNumber.replaces.product.name;
        }
      }
    }

    // 4. Fallback: Parse notes for 'Rebrand input <- [Source Product]'
    if (tx.notes) {
      const match = tx.notes.match(/Rebrand input <-\s*([^.]+)/i);
      if (match) return match[1].trim();
      const matchLegacy = tx.notes.match(/rebranded from\s+([^.]+)/i);
      if (matchLegacy) return matchLegacy[1].trim();
    }

    return tx.product?.name || '—';
  };

  // Extract target (to) product name
  const getToProductName = (tx) => {
    // 1. If this is a REBRAND_IN gain, tx.product IS the target product
    if (tx.transactionType === 'REBRAND_IN') {
      return tx.product?.name || '—';
    }

    // 2. If this is a REBRAND_OUT loss, look for the paired REBRAND_IN product via deliveryNote
    if (tx.deliveryNote && rebrandPairMap[tx.deliveryNote]?.toProduct) {
      return rebrandPairMap[tx.deliveryNote].toProduct;
    }

    // 3. Check serial number replacement (replacedBy -> new serial -> product)
    if (tx.serialNumbers && tx.serialNumbers.length > 0) {
      for (const s of tx.serialNumbers) {
        if (s.serialNumber?.replacedBy?.product?.name) {
          return s.serialNumber.replacedBy.product.name;
        }
      }
    }

    // 4. Parse notes for 'Rebrand output -> [Target Product]'
    if (tx.notes) {
      const match = tx.notes.match(/Rebrand output ->\s*([^.]+)/i);
      if (match) return match[1].trim();

      const matchLegacy = tx.notes.match(/rebrand(?:ed|ing)?\s+on\s*\(([^)]+)\)/i);
      if (matchLegacy) {
        let val = matchLegacy[1].trim();
        if (val.toLowerCase().startsWith('for ')) val = val.substring(4).trim();
        return val;
      }

      const matchForParen = tx.notes.match(/\(for\s+([^)]+)\)/i);
      if (matchForParen) {
        let val = matchForParen[1].trim();
        if (val.toLowerCase().startsWith('for ')) val = val.substring(4).trim();
        return val;
      }

      const matchFor = tx.notes.match(/for rebranding on\s+([^(]+)\(/i);
      if (matchFor) {
        let val = matchFor[1].trim();
        if (val.toLowerCase().startsWith('for ')) val = val.substring(4).trim();
        return val;
      }
    }

    return '—';
  };

  const getFromName = (tx) => getFromProductName(tx);
  const getToName = (tx) => getToProductName(tx);
  const getDestinationName = (tx) => getToProductName(tx);

  const getTypeName = (tx) => {
    if (tx.transactionType === 'REBRAND_IN') return 'REBRAND IN (Gain)';
    if (tx.transactionType === 'REBRAND_OUT') return 'REBRAND OUT (Loss)';
    return 'REBRAND (Outbound)';
  };

  const handleOpenGiveBack = (tx) => {
    setGiveBackTx(tx);
    const remaining = Math.max(0, tx.quantity - (tx.returnedQty || 0));
    setGiveBackQty(remaining > 0 ? String(remaining) : String(tx.quantity));
    setGiveBackProductId(tx.product?.id || '');
    setGiveBackNotes('');
    setGiveBackError('');
  };

  const handleCloseGiveBack = () => {
    setGiveBackTx(null);
    setGiveBackQty('');
    setGiveBackProductId('');
    setGiveBackNotes('');
    setGiveBackError('');
    setGiveBackLoading(false);
  };

  const handleConfirmGiveBack = async (e) => {
    if (e) e.preventDefault();
    if (!giveBackTx) return;

    const qtyNum = parseFloat(giveBackQty);
    if (!qtyNum || qtyNum <= 0) {
      setGiveBackError('Please enter a valid quantity greater than 0');
      return;
    }

    setGiveBackLoading(true);
    setGiveBackError('');
    try {
      await giveBackRebrandTransaction({
        transactionId: giveBackTx.id,
        quantity: qtyNum,
        targetProductId: giveBackProductId || giveBackTx.product?.id,
        notes: giveBackNotes.trim(),
      });
      toast.success('Give Back Successful', `Returned ${qtyNum} items to source warehouse.`);
      handleCloseGiveBack();
      router.refresh();
    } catch (err) {
      setGiveBackError(err.message || 'Failed to process return to source.');
      setGiveBackLoading(false);
    }
  };

  const typeOptions = [
    { value: 'ALL', label: 'All Rebrand Types' },
    { value: 'REBRAND', label: 'Rebrand (Outbound)' },
    { value: 'REBRAND_OUT', label: 'Rebrand Out (Loss)' },
    { value: 'REBRAND_IN', label: 'Rebrand In (Gain)' },
  ];

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
      if (tx.product?.category) {
        set.add(tx.product.category);
      }
    });
    return [
      { value: 'ALL', label: 'All Categories' },
      ...Array.from(set).sort().map(cat => ({ value: cat, label: cat }))
    ];
  }, [transactions]);

  // Filter items
  const filteredTransactions = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return transactions.filter((tx) => {
      // Type match
      if (typeFilter !== 'ALL' && tx.transactionType !== typeFilter) {
        return false;
      }
      // Brand match
      if (brandFilter !== 'ALL') {
        const bId = tx.product?.brand?.id || tx.product?.brand?.name;
        if (bId !== brandFilter) return false;
      }
      // Category match
      if (categoryFilter !== 'ALL') {
        if (tx.product?.category !== categoryFilter) return false;
      }

      if (!q) return true;

      const pName = tx.product?.name?.toLowerCase() || '';
      const bName = tx.product?.brand?.name?.toLowerCase() || '';
      const cName = tx.product?.category?.toLowerCase() || '';
      const sku = tx.product?.itemCode?.toLowerCase() || '';
      const dn = tx.deliveryNote?.toLowerCase() || '';
      const from = getFromName(tx).toLowerCase();
      const to = getToName(tx).toLowerCase();
      const notes = tx.notes?.toLowerCase() || '';
      const serials = (tx.serialNumbers || []).map((s) => s.serialNumber?.barcode?.toLowerCase() || '').join(' ');

      return (
        pName.includes(q) ||
        bName.includes(q) ||
        cName.includes(q) ||
        sku.includes(q) ||
        dn.includes(q) ||
        from.includes(q) ||
        to.includes(q) ||
        notes.includes(q) ||
        serials.includes(q)
      );
    });
  }, [transactions, searchTerm, typeFilter, brandFilter, categoryFilter, entityNames]);

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
      <div className="bg-surface border border-border rounded-xl p-4 shadow-sm flex flex-col gap-3">
        {/* Top Search Bar */}
        <div className="relative w-full">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search by product, SKU, brand, delivery note, vendor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-surface-elevated/40 text-text-primary border border-border rounded-xl pl-10 pr-9 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-semibold shadow-xs"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
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
              options={typeOptions}
              value={typeFilter}
              onChange={(val) => setTypeFilter(val)}
              placeholder="All Rebrand Types"
            />
          </div>
          <div className="w-full">
            <CustomSelect
              options={brandOptions}
              value={brandFilter}
              onChange={(val) => setBrandFilter(val)}
              placeholder="All Brands"
            />
          </div>
          <div className="flex items-center gap-2 w-full">
            <div className="flex-1">
              <CustomSelect
                options={categoryOptions}
                value={categoryFilter}
                onChange={(val) => setCategoryFilter(val)}
                placeholder="All Categories"
              />
            </div>
            {(searchTerm || typeFilter !== 'ALL' || brandFilter !== 'ALL' || categoryFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => { setSearchTerm(''); setTypeFilter('ALL'); setBrandFilter('ALL'); setCategoryFilter('ALL'); }}
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

                    {/* From & To Product */}
                    <div className="flex flex-col gap-1 text-xs bg-surface-elevated/40 p-2.5 rounded-lg border border-border/50">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[10px] uppercase font-bold text-text-muted shrink-0">From Product:</span>
                        <span className="font-semibold text-text-primary text-xs truncate">{getFromName(tx)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[10px] uppercase font-bold text-text-muted shrink-0">To Product:</span>
                        <span className="font-semibold text-primary text-xs truncate">{getToName(tx)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-text-muted pt-1 border-t border-border/40 gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{dateStr}</span>
                        {tx.returnStatus && (
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider ${
                            tx.returnStatus === 'RETURNED'
                              ? 'bg-success/10 text-success border border-success/20'
                              : 'bg-warning/10 text-warning border border-warning/20'
                          }`}>
                            {tx.returnStatus} ({tx.returnedQty || 0}/{tx.quantity})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {tx.transactionType !== 'REBRAND_IN' && (!tx.returnStatus || tx.returnStatus === 'PARTIAL') && (
                          <button
                            type="button"
                            onClick={() => handleOpenGiveBack(tx)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-secondary/10 hover:bg-secondary/20 text-secondary border border-secondary/20 font-bold text-[10px] transition-colors cursor-pointer"
                            title="Give Back / Return stock to source"
                          >
                            <RotateCcw size={11} />
                            <span>Give Back</span>
                          </button>
                        )}
                        <TransactionActions
                          txId={tx.id}
                          deliveryNote={tx.deliveryNote}
                          notes={tx.notes || ''}
                          showDeliveryNote={false}
                        />
                      </div>
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
                    <SortableHeader field="from" currentField={sortField} direction={sortDirection} onSort={handleSort} className="py-3 px-4">From Product</SortableHeader>
                    <SortableHeader field="to" currentField={sortField} direction={sortDirection} onSort={handleSort} className="py-3 px-4">To Product</SortableHeader>
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
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {tx.returnStatus && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                                tx.returnStatus === 'RETURNED'
                                  ? 'bg-success/10 text-success border border-success/20'
                                  : 'bg-warning/10 text-warning border border-warning/20'
                              }`}>
                                {tx.returnStatus} ({tx.returnedQty || 0}/{tx.quantity})
                              </span>
                            )}
                            {tx.transactionType !== 'REBRAND_IN' && (!tx.returnStatus || tx.returnStatus === 'PARTIAL') && (
                              <button
                                type="button"
                                onClick={() => handleOpenGiveBack(tx)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-secondary/10 hover:bg-secondary/20 text-secondary border border-secondary/20 font-bold text-xs transition-colors cursor-pointer"
                                title="Give Back / Return stock to source"
                              >
                                <RotateCcw size={12} />
                                <span>Give Back</span>
                              </button>
                            )}
                            <TransactionActions
                              txId={tx.id}
                              deliveryNote={tx.deliveryNote}
                              notes={tx.notes || ''}
                              showDeliveryNote={false}
                            />
                          </div>
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

      {/* Give Back to Source Modal */}
      {giveBackTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-scale-up flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-elevated/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-secondary/10 border border-secondary/20 flex items-center justify-center text-secondary">
                  <RotateCcw size={16} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-text-primary">
                    Give Back Rebranded Stock
                  </h3>
                  <p className="text-xs text-text-muted">
                    Return stock back to source warehouse / product
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseGiveBack}
                disabled={giveBackLoading}
                className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleConfirmGiveBack} className="p-6 flex flex-col gap-4">
              {giveBackError && (
                <div className="bg-danger/10 border border-danger/20 text-danger rounded-lg p-3 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{giveBackError}</span>
                </div>
              )}

              {/* Transaction Summary Card */}
              <div className="bg-surface-elevated/40 border border-border rounded-xl p-3.5 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                    Original Rebrand Log
                  </span>
                  {giveBackTx.deliveryNote && (
                    <span className="font-mono text-primary font-semibold text-xs bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                      {giveBackTx.deliveryNote}
                    </span>
                  )}
                </div>
                <div className="text-sm font-bold text-text-primary">
                  {giveBackTx.product?.name}
                </div>
                <div className="flex items-center gap-4 text-xs text-text-secondary pt-1 border-t border-border/50">
                  <div>
                    From Product: <strong className="text-text-primary">{getFromName(giveBackTx)}</strong>
                  </div>
                  <div>→</div>
                  <div>
                    To Product: <strong className="text-text-primary">{getToName(giveBackTx)}</strong>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-text-muted pt-1">
                  <span>
                    Total Dispatched: <strong>{giveBackTx.quantity}</strong>
                  </span>
                  <span>
                    Remaining Unreturned:{' '}
                    <strong className="text-secondary">
                      {Math.max(0, giveBackTx.quantity - (giveBackTx.returnedQty || 0))}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Target / Destination Product */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary">
                  Return to Product Definition
                </label>
                <CustomSelect
                  options={[
                    {
                      value: giveBackTx.product?.id,
                      label: `Original: ${giveBackTx.product?.name} (${giveBackTx.product?.itemCode || 'No SKU'})`,
                    },
                    ...products
                      .filter((p) => p.id !== giveBackTx.product?.id)
                      .map((p) => ({
                        value: p.id,
                        label: `${p.name} (${p.brand?.name || 'General'})`,
                      })),
                  ]}
                  value={giveBackProductId || giveBackTx.product?.id}
                  onChange={(val) => setGiveBackProductId(val)}
                  placeholder="Select product definition..."
                />
                <span className="text-[10px] text-text-muted">
                  The central warehouse stock will be credited back under this product catalog definition.
                </span>
              </div>

              {/* Quantity to Return */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-text-secondary">
                    Quantity to Give Back
                  </label>
                  <span className="text-xs text-text-muted">
                    Max:{' '}
                    <strong className="text-primary">
                      {Math.max(0, giveBackTx.quantity - (giveBackTx.returnedQty || 0))}
                    </strong>
                  </span>
                </div>
                <input
                  type="number"
                  step="any"
                  min="0.001"
                  max={Math.max(0, giveBackTx.quantity - (giveBackTx.returnedQty || 0))}
                  value={giveBackQty}
                  onChange={(e) => setGiveBackQty(e.target.value)}
                  placeholder="Enter quantity"
                  required
                  className="w-full bg-surface-elevated/40 text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 font-mono font-bold"
                />
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary">
                  Remarks / Return Reason (Optional)
                </label>
                <textarea
                  rows={2}
                  value={giveBackNotes}
                  onChange={(e) => setGiveBackNotes(e.target.value)}
                  placeholder="e.g. Advamedia completed rebranding, return unused stock to warehouse..."
                  className="w-full bg-surface-elevated/40 text-text-primary border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={handleCloseGiveBack}
                  disabled={giveBackLoading}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-surface-elevated border border-border transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={giveBackLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-secondary hover:bg-secondary-hover text-white shadow-sm hover:shadow transition-all disabled:opacity-50 cursor-pointer"
                >
                  {giveBackLoading ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw size={13} />
                      <span>Confirm Give Back</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
