'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { RefreshCw, Plus, Search, X, Package, FileText, Store, RotateCcw, AlertCircle, CheckCircle, Loader2, ArrowDownLeft, Clock, CheckCheck, Layers, Undo2, ArrowLeftRight } from 'lucide-react';
import TransactionActions from '@/components/TransactionActions';
import ExportToExcel from '@/components/ExportToExcel';
import Pagination from '@/components/Pagination';
import SortableHeader from '@/components/SortableHeader';
import { useTableSort } from '@/hooks/useTableSort';
import { useToast } from '@/components/Toast';
import CustomSelect from '@/components/CustomSelect';
import DeliveryNoteLink from '@/components/DeliveryNoteLink';
import ImageLightbox from '@/components/ImageLightbox';
import { getOptimizedImageUrl } from '@/lib/imagekit';
import { usePermissions } from '@/hooks/usePermissions';

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
  const { isReadOnly } = usePermissions();

  const [lightboxImage, setLightboxImage] = useState(null);

  // Active status tab: 'ALL' | 'PENDING' | 'COMPLETED'
  const [activeTab, setActiveTab] = useState(searchParams?.get('tab') || 'ALL');

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
  }, [searchTerm, typeFilter, brandFilter, categoryFilter, activeTab]);

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

  // Historical target product mapping traced directly from original Excel sheets (REBRANDING & Purchase)
  const HISTORICAL_REBRAND_TARGETS = {
    'RBD-SAD-210824-001': 'Sadia Promotional Stand (1*1) "Back to School" English',
    'RBD-SAD-250924-001': 'Sadia Promotional Stand (1*1)  Carrefour',
    'RBD-SAD-291024-001': 'Sadia Promotional Stand (1*1) - For Union Coop',
    'RBD-SAD-051124-001': 'Sadia Promotional Stand (1*1) - Generic',
    'RBD-SAD-061124-001': 'Sadia Promotional Stand (1*1) - For LULU New Dec 2024',
    'RBD-SAD-061124-002': 'Sadia Promotional Stand (1*1) - For Union Coop',
    'RBD-SAD-291124-001': 'Sadia Promotional Stand (1*1) - Mortadella',
    'RBD-SAD-291124-002': 'Sadia Promotional Stand (1*1) - Mortadella',
    'RBD-SAD-050225-001': 'Sadia Promotional Stand (1*1) - Generic',
    'RBD-SAD-100225-001': 'Sadia Promotional Stand (1*1) - Ramadan Like a pro',
    'RBD-SAD-120225-001': 'Sadia Promotional Stand (1*1) - Ramadan Like a pro',
    'RBD-SAD-130225-001': 'Sadia Promotional Stand (1*1) - Ramadan Like a pro',
    'RBD-SAD-130525-001': 'Sadia Promotional Stand (1*1) - Generic New 2025 (Buy Scan & Win)',
    'RBD-SAD-200525-001': 'Sadia Promotional Stand (1*1) - Generic New 2025 (Buy Scan & Win)',
    'RBD-SAD-140825-001': 'Sadia Promotional Stand (1*1) "Back to School" English 2025',
    'RBD-SAD-240925-001': 'Sadia Promotional Stand (1*1) "1000 Carrefour Voucher" 2025',
    'RBD-SAD-250925-001': 'Sadia Wooden Chef Stand',
    'RBD-SAD-211025-001': 'Sadia Promotional Stand (1*1) "Win Big With Sadia" 2025',
    'RBD-SAD-101125-001': 'Sadia Promotional Stand (1*1) "Win Big With Sadia" 2025',
    'RBD-SAD-091225-001': 'Sadia Promotional Stand (1*1) - Ramadan 2026',
    'RBD-SAD-260126-001': 'Sadia Promotional Stand (1*1) - Ramadan 2026',
    'RBD-SAD-200426-001': 'Sadia Promotional Stand (1*1) - New Look April 2026',
    'RBD-SAD-180526-001': 'Sadia Promotional Stand (1*1) - New Look April 2026',
    'RBD-SAD-170826-001': 'Sadia Promotional Stand (1*1) - Back To School "AED 40 2026"',
    'RBD-SAD-250826-002': 'Sadia Promotional Stand (1*1) - Back To School "AED 40 2026"',
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

    // 3. For pending rebrands without paired product or explicit note, display '—'
    if (tx.returnStatus === 'PENDING' && !tx.notes?.match(/Rebrand output ->/i)) {
      return '—';
    }

    // 4. Historical delivery note exact target product resolution from Excel
    if (tx.deliveryNote && HISTORICAL_REBRAND_TARGETS[tx.deliveryNote]) {
      return HISTORICAL_REBRAND_TARGETS[tx.deliveryNote];
    }

    // 4. Check serial number replacement (replacedBy -> new serial -> product)
    if (tx.serialNumbers && tx.serialNumbers.length > 0) {
      for (const s of tx.serialNumbers) {
        if (s.serialNumber?.replacedBy?.product?.name) {
          return s.serialNumber.replacedBy.product.name;
        }
      }
    }

    // 5. Parse notes for 'Rebrand output -> [Target Product]'
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
  const isRevertedTx = (tx) => {
    return tx.returnStatus === 'REVERTED' ||
      (tx.deliveryNote && tx.deliveryNote.startsWith('REV-')) ||
      (tx.notes && tx.notes.toLowerCase().includes('reverted rebrand'));
  };

  const getTypeName = (tx) => {
    if (isRevertedTx(tx)) {
      if (tx.transactionType === 'REBRAND_IN') return 'REVERT IN (Gain)';
      if (tx.transactionType === 'REBRAND_OUT') return 'REVERT OUT (Loss)';
      return 'REVERTED';
    }
    if (tx.transactionType === 'REBRAND_IN') return 'REBRAND IN (Gain)';
    if (tx.transactionType === 'REBRAND_OUT') return 'REBRAND OUT (Loss)';
    return 'REBRAND (Outbound)';
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

  const tabCounts = useMemo(() => {
    let pending = 0;
    let completed = 0;
    (transactions || []).forEach(tx => {
      const isRev = isRevertedTx(tx);
      if (isRev) {
        completed++;
        return;
      }
      const isOut = tx.transactionType === 'REBRAND_OUT' || tx.transactionType === 'REBRAND';
      const isIn = tx.transactionType === 'REBRAND_IN';
      const isDone = tx.returnStatus === 'COMPLETED' || tx.returnStatus === 'RETURNED' || isIn;
      if (isOut && (!tx.returnStatus || tx.returnStatus === 'PENDING' || tx.returnStatus === 'PARTIAL')) {
        pending++;
      }
      if (isDone) {
        completed++;
      }
    });
    return {
      all: transactions.length,
      pending,
      completed,
    };
  }, [transactions]);

  // Filter items
  const filteredTransactions = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return transactions.filter((tx) => {
      const isRev = isRevertedTx(tx);

      // Tab filter
      if (activeTab === 'PENDING') {
        if (isRev) return false;
        const isOut = tx.transactionType === 'REBRAND_OUT' || tx.transactionType === 'REBRAND';
        const isPending = !tx.returnStatus || tx.returnStatus === 'PENDING' || tx.returnStatus === 'PARTIAL';
        if (!isOut || !isPending) return false;
      } else if (activeTab === 'COMPLETED') {
        if (isRev) return true;
        const isIn = tx.transactionType === 'REBRAND_IN';
        const isDone = tx.returnStatus === 'COMPLETED' || tx.returnStatus === 'RETURNED';
        if (!isIn && !isDone) return false;
      }

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
  }, [transactions, searchTerm, typeFilter, brandFilter, categoryFilter, activeTab, entityNames]);

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
      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-text-primary tracking-tight">
            Stock Rebranding Ledger
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Logs of stock items dispatched or converted into different product definitions.
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
          <ExportToExcel
            data={filteredTransactions.map((tx) => ({
              _rawTimestamp: tx.timestamp,
              Image: tx.product?.imageUrl || '',
              Date: new Date(tx.timestamp).toLocaleString('en-AE', {
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
              Notes: tx.notes || '',
            }))}
            columns={[
              { header: 'Image', key: 'Image', width: 16, isImage: true },
              { header: 'Date', key: 'Date', width: 20 },
              { header: 'Delivery Note', key: 'Delivery Note', width: 22 },
              { header: 'Type', key: 'Type', width: 18 },
              { header: 'Product', key: 'Product', width: 25 },
              { header: 'Brand', key: 'Brand', width: 18 },
              { header: 'SKU', key: 'SKU', width: 16 },
              { header: 'From', key: 'From', width: 22 },
              { header: 'To', key: 'To', width: 22 },
              { header: 'Quantity', key: 'Quantity', width: 10 },
              { header: 'Notes', key: 'Notes', width: 25 },
            ]}
            filename="IML-Rebrand-Ledger"
          />
          <Link
            href="/dashboard/rebrand/receive"
            className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 bg-success/10 hover:bg-success/20 text-success border border-success/30 font-semibold text-xs sm:text-sm rounded-lg transition-all duration-200 whitespace-nowrap cursor-pointer"
          >
            <ArrowDownLeft size={16} />
            <span>Receive Stock</span>
          </Link>
          <Link
            href="/dashboard/rebrand/give-back"
            className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 bg-secondary/10 hover:bg-secondary/20 text-secondary border border-secondary/30 font-semibold text-xs sm:text-sm rounded-lg transition-all duration-200 whitespace-nowrap cursor-pointer"
          >
            <RotateCcw size={16} />
            <span>Give Back</span>
          </Link>
          <Link
            href="/dashboard/rebrand/new"
            className="inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-1.5 sm:py-2 bg-primary hover:bg-primary-hover text-white font-semibold text-xs sm:text-sm rounded-lg shadow-sm hover:shadow transition-all duration-200 whitespace-nowrap cursor-pointer"
          >
            <Plus size={16} />
            <span>New Rebranding Map</span>
          </Link>
        </div>
      </header>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('ALL')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'ALL'
              ? 'bg-primary text-white shadow-sm'
              : 'bg-surface hover:bg-surface-elevated text-text-secondary border border-border'
          }`}
        >
          <Layers size={14} />
          <span>All Rebrands</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
            activeTab === 'ALL' ? 'bg-white/20 text-white' : 'bg-surface-elevated text-text-muted'
          }`}>
            {tabCounts.all}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('PENDING')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'PENDING'
              ? 'bg-warning text-black shadow-sm'
              : 'bg-surface hover:bg-surface-elevated text-text-secondary border border-border'
          }`}
        >
          <Clock size={14} />
          <span>Pending at Vendor</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
            activeTab === 'PENDING' ? 'bg-black/20 text-black' : 'bg-warning/10 text-warning border border-warning/20'
          }`}>
            {tabCounts.pending}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('COMPLETED')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'COMPLETED'
              ? 'bg-success text-white shadow-sm'
              : 'bg-surface hover:bg-surface-elevated text-text-secondary border border-border'
          }`}
        >
          <CheckCheck size={14} />
          <span>Completed</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
            activeTab === 'COMPLETED' ? 'bg-white/20 text-white' : 'bg-success/10 text-success border border-success/20'
          }`}>
            {tabCounts.completed}
          </span>
        </button>
      </div>

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
            {(searchTerm || typeFilter !== 'ALL' || brandFilter !== 'ALL' || categoryFilter !== 'ALL' || activeTab !== 'ALL') && (
              <button
                type="button"
                onClick={() => { setSearchTerm(''); setTypeFilter('ALL'); setBrandFilter('ALL'); setCategoryFilter('ALL'); setActiveTab('ALL'); }}
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
              {searchTerm || typeFilter !== 'ALL' || activeTab !== 'ALL'
                ? 'Try adjusting your search or filters.'
                : 'Click "New Rebranding Map" to execute rebranding transfers.'}
            </p>
            {(searchTerm || typeFilter !== 'ALL' || activeTab !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setTypeFilter('ALL');
                  setActiveTab('ALL');
                }}
                className="mt-2 text-xs font-semibold text-primary hover:underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <>
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
                const isOutbound = tx.transactionType === 'REBRAND_OUT' || tx.transactionType === 'REBRAND';
                const isReverted = isRevertedTx(tx);
                const isPendingOrPartial = !isReverted && isOutbound && (!tx.returnStatus || tx.returnStatus === 'PENDING' || tx.returnStatus === 'PARTIAL');
                const canRevert = !isReverted && !isPendingOrPartial && !tx.deliveryNote?.startsWith('REV-') && tx.returnStatus !== 'REVERTED';

                return (
                  <div key={tx.id} className="p-4 flex flex-col gap-2.5 hover:bg-surface-elevated/20 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {tx.product?.imageUrl ? (
                          <img
                            src={getOptimizedImageUrl(tx.product.imageUrl, 80, 80)}
                            alt={tx.product.name || 'Product'}
                            className="w-10 h-10 rounded-lg object-cover border border-border shrink-0 cursor-zoom-in hover:brightness-95 transition-all"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLightboxImage({ url: tx.product.imageUrl, name: tx.product.name });
                            }}
                            onError={(e) => {
                              if (e.target.src !== tx.product.imageUrl) {
                                e.target.src = tx.product.imageUrl;
                              }
                            }}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-surface-elevated text-text-muted flex items-center justify-center border border-border shrink-0">
                            <Package size={18} />
                          </div>
                        )}
                        <div className="flex flex-col min-w-0 flex-1">
                          <Link
                            href={`/dashboard/products/${tx.product?.id}`}
                            className="font-bold text-sm text-primary hover:text-primary-hover transition-colors break-words leading-snug"
                          >
                            {tx.product?.name}
                          </Link>
                          <span className="text-[11px] text-text-muted">
                            Brand: {tx.product?.brand?.name || 'General'}
                          </span>
                        </div>
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
                        <DeliveryNoteLink tx={tx} variant="badge" />
                      )}
                      <span
                        className={`badge text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          isReverted
                            ? 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                            : isGain
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

                    <div className="flex items-center justify-between text-[11px] text-text-muted pt-1 border-t border-border/40 gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{dateStr}</span>
                        {(tx.returnStatus || isReverted) && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                            tx.returnStatus === 'REVERTED' || isReverted
                              ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                              : tx.returnStatus === 'RETURNED' || tx.returnStatus === 'COMPLETED'
                              ? 'bg-success/10 text-success border border-success/20'
                              : 'bg-warning/10 text-warning border border-warning/20'
                          }`}>
                            {tx.returnStatus === 'REVERTED' || isReverted ? 'REVERTED' : `${tx.returnStatus} (${tx.returnedQty || 0}/${tx.quantity})`}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isPendingOrPartial && (
                          <Link
                            href={`/dashboard/rebrand/receive?txId=${tx.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-success/10 hover:bg-success/20 text-success border border-success/20 font-bold text-[11px] transition-colors cursor-pointer"
                            title="Receive converted rebranded stock from vendor"
                          >
                            <ArrowDownLeft size={12} />
                            <span>Receive Stock</span>
                          </Link>
                        )}
                        {isPendingOrPartial && (
                          <Link
                            href={`/dashboard/rebrand/give-back?txId=${tx.id}`}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-secondary/10 hover:bg-secondary/20 text-secondary border border-secondary/20 font-bold text-[10px] transition-colors cursor-pointer"
                            title="Give Back / Return unconverted stock to warehouse"
                          >
                            <RotateCcw size={11} />
                            <span>Give Back</span>
                          </Link>
                        )}
                        {canRevert && (
                          <Link
                            href={`/dashboard/rebrand/revert?txId=${tx.id}`}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-bold text-[10px] transition-colors cursor-pointer"
                            title="Revert rebrand conversion back to original product"
                          >
                            <Undo2 size={11} />
                            <span>Revert to Old</span>
                          </Link>
                        )}
                        <TransactionActions
                          txId={tx.id}
                          deliveryNote={tx.deliveryNote}
                          notes={tx.notes || ''}
                          showDeliveryNote={false}
                          copyType="rebrand"
                          transactionType={tx.transactionType}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-border text-xs">
                  <thead>
                    <tr className="text-left text-xs font-bold text-text-secondary uppercase tracking-wider bg-surface-elevated/40">
                      <SortableHeader field="product" currentField={sortField} direction={sortDirection} onSort={handleSort} className="py-2 sm:py-3 pl-4 sm:pl-5 pr-3 sm:pr-4 sticky left-0 bg-surface-sticky z-20 border-r border-border shadow-sm">Product Details</SortableHeader>
                      <SortableHeader field="date" currentField={sortField} direction={sortDirection} onSort={handleSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Date</SortableHeader>
                      <SortableHeader field="deliveryNote" currentField={sortField} direction={sortDirection} onSort={handleSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Delivery Note</SortableHeader>
                      <SortableHeader field="sku" currentField={sortField} direction={sortDirection} onSort={handleSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">SKU</SortableHeader>
                      <SortableHeader field="from" currentField={sortField} direction={sortDirection} onSort={handleSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">From Product</SortableHeader>
                      <SortableHeader field="to" currentField={sortField} direction={sortDirection} onSort={handleSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">To Product</SortableHeader>
                      <SortableHeader field="type" currentField={sortField} direction={sortDirection} onSort={handleSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Action Type</SortableHeader>
                      <SortableHeader field="quantity" currentField={sortField} direction={sortDirection} onSort={handleSort} align="center" className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-center">Quantity</SortableHeader>
                      <SortableHeader field="serials" currentField={sortField} direction={sortDirection} onSort={handleSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Associated Serials</SortableHeader>
                      <SortableHeader field="notes" currentField={sortField} direction={sortDirection} onSort={handleSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Remarks</SortableHeader>
                      <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-right">Actions</th>
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
                    const isOutbound = tx.transactionType === 'REBRAND_OUT' || tx.transactionType === 'REBRAND';
                    const isReverted = isRevertedTx(tx);
                    const isPendingOrPartial = !isReverted && isOutbound && (!tx.returnStatus || tx.returnStatus === 'PENDING' || tx.returnStatus === 'PARTIAL');
                    const canRevert = !isReverted && !isPendingOrPartial && !tx.deliveryNote?.startsWith('REV-') && tx.returnStatus !== 'REVERTED';

                    return (
                      <tr key={tx.id} className="hover:bg-surface-elevated/20 transition-colors group/row">
                        <td className="py-2 sm:py-3 pl-4 sm:pl-5 pr-3 sm:pr-4 min-w-[240px] sticky left-0 bg-surface group-hover/row:bg-surface-elevated z-10 border-r border-border shadow-sm">
                          <div className="flex items-center gap-2.5">
                            {tx.product?.imageUrl ? (
                              <img
                                src={getOptimizedImageUrl(tx.product.imageUrl, 80, 80)}
                                alt={tx.product.name || 'Product'}
                                className="w-9 h-9 rounded-lg object-cover border border-border shrink-0 cursor-zoom-in hover:brightness-95 transition-all"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLightboxImage({ url: tx.product.imageUrl, name: tx.product.name });
                                }}
                                onError={(e) => {
                                  if (e.target.src !== tx.product.imageUrl) {
                                    e.target.src = tx.product.imageUrl;
                                  }
                                }}
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-lg bg-surface-elevated text-text-muted flex items-center justify-center border border-border shrink-0">
                                <Package size={16} />
                              </div>
                            )}
                            <div className="flex flex-col min-w-0">
                              <Link
                                href={`/dashboard/products/${tx.product?.id}`}
                                className="font-semibold text-text-primary hover:text-primary transition-colors break-words leading-snug"
                              >
                                {tx.product?.name}
                              </Link>
                              <span className="text-[11px] text-text-muted mt-0.5">
                                Brand: {tx.product?.brand?.name || 'General'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap text-xs text-text-secondary font-medium">
                          {dateStr}
                        </td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap font-mono text-xs">
                          <DeliveryNoteLink tx={tx} />
                        </td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap font-mono text-xs text-text-secondary">
                          {tx.product?.itemCode || '---'}
                        </td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap text-xs font-medium text-text-secondary">
                          {getFromName(tx)}
                        </td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap text-xs font-semibold text-text-primary">
                          {getToName(tx)}
                        </td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap">
                          <span
                            className={`badge text-[10px] px-2 py-0.5 rounded font-bold ${
                              isReverted
                                ? 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                                : isGain
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
                          className={`py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-center font-mono font-bold text-sm whitespace-nowrap ${
                            isGain ? 'text-success' : 'text-danger'
                          }`}
                        >
                          {isGain ? `+${tx.quantity}` : `-${tx.quantity}`}
                        </td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap">
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
                          className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 max-w-xs truncate text-xs text-text-secondary"
                          title={tx.notes || ''}
                        >
                          {tx.notes || '---'}
                        </td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {(tx.returnStatus || isReverted) && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                                tx.returnStatus === 'REVERTED' || isReverted
                                  ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                                  : tx.returnStatus === 'RETURNED' || tx.returnStatus === 'COMPLETED'
                                  ? 'bg-success/10 text-success border border-success/20'
                                  : 'bg-warning/10 text-warning border border-warning/20'
                              }`}>
                                {tx.returnStatus === 'REVERTED' || isReverted ? 'REVERTED' : `${tx.returnStatus} (${tx.returnedQty || 0}/${tx.quantity})`}
                              </span>
                            )}
                            {isPendingOrPartial && (
                              <Link
                                href={`/dashboard/rebrand/receive?txId=${tx.id}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-success/10 hover:bg-success/20 text-success border border-success/20 font-bold text-xs transition-colors cursor-pointer shadow-2xs"
                                title="Receive converted rebranded stock from vendor"
                              >
                                <ArrowDownLeft size={13} />
                                <span>Receive Stock</span>
                              </Link>
                            )}
                            {isPendingOrPartial && (
                              <Link
                                href={`/dashboard/rebrand/give-back?txId=${tx.id}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-secondary/10 hover:bg-secondary/20 text-secondary border border-secondary/20 font-bold text-xs transition-colors cursor-pointer shadow-2xs"
                                title="Give Back / Return unconverted stock to warehouse"
                              >
                                <RotateCcw size={12} />
                                <span>Give Back</span>
                              </Link>
                            )}
                            {canRevert && (
                              <Link
                                href={`/dashboard/rebrand/revert?txId=${tx.id}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-bold text-xs transition-colors cursor-pointer shadow-2xs"
                                title="Revert rebrand conversion back to original product"
                              >
                                <Undo2 size={12} />
                                <span>Revert to Old</span>
                              </Link>
                            )}
                            <TransactionActions
                              txId={tx.id}
                              deliveryNote={tx.deliveryNote}
                              notes={tx.notes || ''}
                              showDeliveryNote={false}
                              copyType="rebrand"
                              transactionType={tx.transactionType}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-border bg-surface-elevated/20">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={sortedTransactions.length}
                itemsPerPage={itemsPerPage}
                onPageChange={handlePageChange}
              />
            </div>
          </>
        )}
      </div>

      <ImageLightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />
    </div>
  );
}
