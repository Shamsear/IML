'use client';

import { useState, useEffect, useRef, useMemo, useTransition } from 'react';
import { 
  History, ArrowDownLeft, ArrowUpRight, ShieldAlert, RefreshCw, 
  ClipboardList, Calendar, FileText, User, Store, UserCheck, Package, Search, Loader2
} from 'lucide-react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import EmptyState from '@/components/EmptyState';
import Link from 'next/link';
import CustomSelect from '@/components/CustomSelect';
import ExportToExcel from '@/components/ExportToExcel';
import SortableHeader from '@/components/SortableHeader';
import DeliveryNoteLink from '@/components/DeliveryNoteLink';
import ImageLightbox from '@/components/ImageLightbox';
import { getOptimizedImageUrl } from '@/lib/imagekit';
import { useTableSort } from '@/hooks/useTableSort';
import { usePermissions } from '@/hooks/usePermissions';

export default function TransactionsClient({ 
  initialTransactions, 
  products,
  totalCount = 0,
  totalPages = 1,
  page = 1,
  initialSearch = '',
  initialType = 'ALL',
  initialProductId = 'ALL',
  entityNames = {}
}) {
  const { isReadOnly } = usePermissions();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [filterType, setFilterType] = useState(initialType);
  const [filterProduct, setFilterProduct] = useState(initialProductId);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [lightboxImage, setLightboxImage] = useState(null);

  useEffect(() => {
    setFilterType(initialType);
    setFilterProduct(initialProductId);
    setSearchQuery(initialSearch);
  }, [initialType, initialProductId, initialSearch]);

  // Reference to prevent searching on mount
  const searchTimeoutRef = useRef(null);

  const updateUrlParams = (newFilters) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (newFilters.page !== undefined) {
      params.set('page', String(newFilters.page));
    } else {
      params.set('page', '1');
    }
    
    if (newFilters.search !== undefined) {
      if (newFilters.search) params.set('search', newFilters.search);
      else params.delete('search');
    }
    if (newFilters.type !== undefined) {
      if (newFilters.type && newFilters.type !== 'ALL') params.set('type', newFilters.type);
      else params.delete('type');
    }
    if (newFilters.productId !== undefined) {
      if (newFilters.productId && newFilters.productId !== 'ALL') params.set('productId', newFilters.productId);
      else params.delete('productId');
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  // Debounced search query update
  const handleSearchChange = (val) => {
    setSearchQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      updateUrlParams({ search: val });
    }, 400);
  };

  const txCustomGetters = useMemo(() => ({
    product: (tx) => tx.product?.name || '',
    sku: (tx) => tx.product?.itemCode || '',
    transactionType: (tx) => tx.transactionType || '',
    from: (tx) => tx.fromEntityType === 'WAREHOUSE' ? 'Warehouse' : tx.fromEntityType === 'SUPPLIER' ? (tx.fromEntityId || 'Supplier') : (entityNames[tx.fromEntityId] || tx.fromEntityType || ''),
    to: (tx) => tx.toEntityType === 'WAREHOUSE' ? 'Warehouse' : (entityNames[tx.toEntityId] || tx.toEntityType || ''),
    quantity: (tx) => tx.quantity ?? 0,
    deliveryNote: (tx) => tx.deliveryNote || '',
    timestamp: (tx) => tx.timestamp,
  }), [entityNames]);

  const {
    sortedItems: sortedTransactions,
    sortField,
    sortDirection,
    handleSort,
  } = useTableSort(initialTransactions, 'timestamp', 'desc', txCustomGetters);

  // Since we query server-side, paginatedTransactions is the sorted list of current page transactions
  const paginatedTransactions = sortedTransactions;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="flex flex-col gap-4 pb-5 border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-text-primary tracking-tight">
              Inventory Ledger Feed
            </h1>
            <p className="text-text-secondary text-sm mt-1">
              Audit logs of stock dispatches, returns, rebrands, and damages.
            </p>
          </div>
          <div className="flex-shrink-0">
            <ExportToExcel
              data={initialTransactions.map(tx => {
                const fromName = tx.fromEntityType === 'WAREHOUSE' 
                  ? 'Warehouse' 
                  : (tx.fromEntityType === 'SUPPLIER' 
                      ? (tx.fromEntityId || 'Supplier') 
                      : (entityNames[tx.fromEntityId] || tx.fromEntityId || tx.fromEntityType || '—'));
                const toName = tx.toEntityType === 'WAREHOUSE' 
                  ? 'Warehouse' 
                  : (entityNames[tx.toEntityId] || tx.toEntityId || tx.toEntityType || '—');

                return {
                  _rawTimestamp: tx.timestamp,
                  Image: tx.product?.imageUrl || '',
                  Date: new Date(tx.timestamp).toLocaleString('en-AE', { 
                    timeZone: 'Asia/Dubai', 
                    day: 'numeric', 
                    month: 'short', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }),
                  Type: tx.transactionType,
                  Product: tx.product?.name || '',
                  Brand: tx.product?.brand?.name || '',
                  Quantity: tx.quantity,
                  'From': fromName,
                  'To': toName,
                  'Delivery Note': tx.deliveryNote || '',
                  Notes: tx.notes || '',
                };
              })}
              columns={[
                { header: 'Image', key: 'Image', width: 16, isImage: true },
                { header: 'Date', key: 'Date', width: 20 },
                { header: 'Type', key: 'Type', width: 16 },
                { header: 'Product', key: 'Product', width: 25 },
                { header: 'Brand', key: 'Brand', width: 18 },
                { header: 'Quantity', key: 'Quantity', width: 10 },
                { header: 'From', key: 'From', width: 22 },
                { header: 'To', key: 'To', width: 22 },
                { header: 'Delivery Note', key: 'Delivery Note', width: 20 },
                { header: 'Notes', key: 'Notes', width: 25 },
              ]}
              filename="IML-Transaction-Ledger"
            />
          </div>
        </div>

        {/* Quick Navigation Action Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Link href="/dashboard/inbound" className="inline-flex items-center gap-2 px-3.5 py-2 bg-success/10 hover:bg-success text-success hover:text-white border border-success/30 rounded-lg text-xs font-bold transition-all duration-200 shadow-sm">
            <ArrowDownLeft size={15} />
            <span>{isReadOnly ? 'Inbound Ledger' : 'Inbound (Receive)'}</span>
          </Link>
          <Link href="/dashboard/outbound" className="inline-flex items-center gap-2 px-3.5 py-2 bg-primary/10 hover:bg-primary text-primary hover:text-white border border-primary/30 rounded-lg text-xs font-bold transition-all duration-200 shadow-sm">
            <ArrowUpRight size={15} />
            <span>{isReadOnly ? 'Outbound Ledger' : 'Outbound (Dispatch)'}</span>
          </Link>
          <Link href="/dashboard/rebrand" className="inline-flex items-center gap-2 px-3.5 py-2 bg-secondary/10 hover:bg-secondary text-secondary hover:text-white border border-secondary/30 rounded-lg text-xs font-bold transition-all duration-200 shadow-sm">
            <RefreshCw size={15} />
            <span>{isReadOnly ? 'Rebrand Ledger' : 'Rebrand Stock'}</span>
          </Link>
          <Link href="/dashboard/damage" className="inline-flex items-center gap-2 px-3.5 py-2 bg-danger/10 hover:bg-danger text-danger hover:text-white border border-danger/30 rounded-lg text-xs font-bold transition-all duration-200 shadow-sm">
            <ShieldAlert size={15} />
            <span>{isReadOnly ? 'Damage Ledger' : 'Log Damage'}</span>
          </Link>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex flex-col gap-6">
        {/* Filter Toolbar */}
        <div className="bg-surface border border-border rounded-xl p-4 flex flex-col md:flex-row items-end gap-4 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end flex-1 w-full">
            {/* Filter by Type */}
            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Filter by Type</label>
              <CustomSelect
                options={[
                  { value: 'ALL', label: 'All Transactions' },
                  { value: 'RECEIVE', label: 'Inbound (Receive)' },
                  { value: 'ISSUE', label: 'Outbound (Dispatch)' },
                  { value: 'RETURN', label: 'Return' },
                  { value: 'DAMAGE', label: 'Damage' },
                  { value: 'REBRAND_OUT', label: 'Rebrand Out' },
                  { value: 'REBRAND_IN', label: 'Rebrand In' },
                ]}
                value={filterType}
                onChange={(val) => { setFilterType(val); updateUrlParams({ type: val }); }}
                size="sm"
              />
            </div>

            {/* Filter by Product */}
            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Filter by Product</label>
              <CustomSelect
                options={[{ value: 'ALL', label: 'All Products' }, ...products.map(p => ({ value: p.id, label: p.name, imageUrl: p.imageUrl, warehouseStock: p.warehouseStock }))]}
                value={filterProduct}
                onChange={(val) => { setFilterProduct(val); updateUrlParams({ productId: val }); }}
                size="sm"
              />
            </div>

            {/* Search Input */}
            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Search Ledger</label>
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={13} />
                <input
                  type="text"
                  placeholder="Search product, delivery note..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg pl-9 pr-4 text-xs focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors h-[34px]"
                />
              </div>
            </div>
          </div>
          <span className="text-xs font-semibold text-text-muted pb-2 flex-shrink-0">{totalCount} logs total</span>
        </div>

        {/* Top Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 bg-surface border border-border rounded-xl shadow-sm text-xs font-semibold print:hidden">
            <span className="text-text-muted">
              Showing <strong className="text-text-primary">{totalCount === 0 ? 0 : (page - 1) * 50 + 1}</strong> to{" "}
              <strong className="text-text-primary">
                {Math.min(page * 50, totalCount)}
              </strong> of{" "}
              <strong className="text-text-primary">{totalCount}</strong> movements
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => updateUrlParams({ page: page - 1 })}
                className="px-2.5 py-1.5 bg-surface border border-border hover:bg-surface-elevated disabled:opacity-50 text-text-secondary disabled:hover:bg-surface disabled:hover:text-text-secondary rounded-lg font-semibold transition-colors duration-200 cursor-pointer"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .map((p, pIdx, arr) => {
                  const prevPage = arr[pIdx - 1];
                  return (
                    <div key={p} className="flex items-center gap-1">
                      {prevPage && p - prevPage > 1 && <span className="text-text-muted px-1">...</span>}
                      <button
                        type="button"
                        onClick={() => updateUrlParams({ page: p })}
                        className={`px-3 py-1.5 border rounded-lg font-semibold transition-all duration-200 cursor-pointer ${
                          p === page
                            ? 'bg-primary border-primary text-white'
                            : 'bg-surface border-border hover:bg-surface-elevated text-text-secondary'
                        }`}
                      >
                        {p}
                      </button>
                    </div>
                  );
                })}
              <button
                type="button"
                disabled={page === totalPages}
                onClick={() => updateUrlParams({ page: page + 1 })}
                className="px-2.5 py-1.5 bg-surface border border-border hover:bg-surface-elevated disabled:opacity-50 text-text-secondary disabled:hover:bg-surface disabled:hover:text-text-secondary rounded-lg font-semibold transition-colors duration-200 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Mobile Card View */}
        {paginatedTransactions.length === 0 ? (
          <div className="md:hidden bg-surface border border-border rounded-xl shadow-sm">
            <EmptyState
              icon={History}
              title="No ledger entries yet"
              description="Stock movements will appear here as you receive, dispatch, and manage inventory."
            />
          </div>
        ) : (
          <div className="md:hidden flex flex-col gap-3">
            {paginatedTransactions.map((tx) => (
              <div key={tx.id} className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-2.5">
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
                      <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0">
                        <Package size={18} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <Link href={`/dashboard/products/${tx.product.id}`} className="font-semibold text-sm text-text-primary block break-words leading-snug hover:text-primary transition-colors">{tx.product.name}</Link>
                      <span className="text-[11px] text-text-muted font-mono">{tx.product.itemCode || ''}</span>
                    </div>
                  </div>
                  <span className={`badge text-[10px] flex-shrink-0 ${
                    tx.transactionType === 'RECEIVE' || tx.transactionType === 'REBRAND_IN' ? 'badge-success' :
                    tx.transactionType === 'ISSUE' ? 'badge-info' : 
                    tx.transactionType === 'DAMAGE' || tx.transactionType === 'LOST' ? 'badge-danger' : 'badge-warning'
                  }`}>
                    {tx.transactionType}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary">
                    {tx.fromEntityType === 'WAREHOUSE' ? 'Warehouse' : (entityNames[tx.fromEntityId] || tx.fromEntityId || '---')}
                    {' → '}
                    {tx.toEntityType === 'WAREHOUSE' ? 'Warehouse' : (entityNames[tx.toEntityId] || tx.toEntityId || '---')}
                  </span>
                  <span className="font-mono font-bold text-sm">{tx.quantity}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px]">
                  <span className="text-text-muted">
                    {new Date(tx.timestamp).toLocaleDateString('en-AE', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  {tx.deliveryNote && (
                    <DeliveryNoteLink tx={tx} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Desktop Table View */}
        <div className="hidden md:block bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
          {paginatedTransactions.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={History}
                title="No ledger entries yet"
                description="Stock movements will appear here as you receive, dispatch, and manage inventory."
              />
            </div>
          ) : (
            <>
              <div className={`overflow-x-auto transition-opacity duration-150 ${isPending ? 'opacity-60 pointer-events-none' : ''}`}>
                <table className="min-w-full divide-y divide-border text-xs">
                  <thead>
                    <tr className="text-left text-xs font-bold text-text-secondary uppercase tracking-wider bg-surface-elevated/40">
                      <SortableHeader field="product" currentField={sortField} direction={sortDirection} onSort={handleSort} className="py-2 sm:py-3 pl-4 sm:pl-5 pr-3 sm:pr-4 sticky left-0 bg-surface-sticky z-20 border-r border-border shadow-sm">Product Details</SortableHeader>
                      <SortableHeader field="sku" currentField={sortField} direction={sortDirection} onSort={handleSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">SKU</SortableHeader>
                      <SortableHeader field="transactionType" currentField={sortField} direction={sortDirection} onSort={handleSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Transaction Type</SortableHeader>
                      <SortableHeader field="from" currentField={sortField} direction={sortDirection} onSort={handleSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Source / From</SortableHeader>
                      <SortableHeader field="to" currentField={sortField} direction={sortDirection} onSort={handleSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Destination / To</SortableHeader>
                      <SortableHeader field="quantity" currentField={sortField} direction={sortDirection} onSort={handleSort} align="center" className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Quantity</SortableHeader>
                      <SortableHeader field="deliveryNote" currentField={sortField} direction={sortDirection} onSort={handleSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Delivery Note</SortableHeader>
                      <SortableHeader field="timestamp" currentField={sortField} direction={sortDirection} onSort={handleSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Date &amp; Time</SortableHeader>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-text-primary">
                    {paginatedTransactions.map((tx) => (
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
                              <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0">
                                <Package size={16} />
                              </div>
                            )}
                            <div className="flex flex-col min-w-0">
                              <Link href={`/dashboard/products/${tx.product.id}`} className="font-semibold text-text-primary hover:text-primary transition-colors break-words leading-snug">{tx.product.name}</Link>

                              {tx.receivedBy && (
                                <span className="text-[10px] text-text-secondary mt-1 font-semibold flex items-center gap-1">
                                  👤 Received/Processed by: <span className="text-primary font-bold">{tx.receivedBy}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap font-mono text-xs text-text-secondary">
                          {tx.product.itemCode || '---'}
                        </td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap">
                          <span className={`badge ${
                            tx.transactionType === 'RECEIVE' || tx.transactionType === 'REBRAND_IN' ? 'badge-success' :
                            tx.transactionType === 'ISSUE' ? 'badge-info' : 
                            tx.transactionType === 'DAMAGE' || tx.transactionType === 'LOST' ? 'badge-danger' : 'badge-warning'
                          }`}>
                            {tx.transactionType}
                          </span>
                        </td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-xs font-semibold">
                            {tx.fromEntityType === 'SUPPLIER' && <Store size={14} className="text-success" />}
                            {tx.fromEntityType === 'WAREHOUSE' && <Package size={14} className="text-primary" />}
                            {tx.fromEntityType === 'STORE' && <Store size={14} className="text-secondary" />}
                            {tx.fromEntityType === 'SUPERVISOR' && <UserCheck size={14} className="text-warning" />}
                            <span className="text-text-primary">
                              {tx.fromEntityType === 'WAREHOUSE' ? 'Warehouse' : 
                               tx.fromEntityType === 'SUPPLIER' ? (tx.fromEntityId || 'Supplier') :
                               (entityNames[tx.fromEntityId] || tx.fromEntityType || 'N/A')}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-xs font-semibold">
                            {tx.toEntityType === 'WAREHOUSE' && <Package size={14} className="text-primary" />}
                            {tx.toEntityType === 'STORE' && <Store size={14} className="text-secondary" />}
                            {tx.toEntityType === 'STAFF' && <User size={14} className="text-success" />}
                            {tx.toEntityType === 'SUPERVISOR' && <UserCheck size={14} className="text-warning" />}
                            {tx.toEntityType === 'CLIENT' && <User size={14} className="text-text-primary" />}
                            <span className="text-text-primary">
                              {tx.toEntityType === 'WAREHOUSE' ? 'Warehouse' :
                               tx.toEntityType === 'CLIENT' ? (tx.toEntityId || 'Client') :
                               (entityNames[tx.toEntityId] || tx.toEntityType || 'N/A')}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-center whitespace-nowrap font-mono font-bold text-sm">
                          {tx.quantity}
                        </td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap text-xs text-text-secondary">
                          <DeliveryNoteLink tx={tx} />
                        </td>
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap text-xs text-text-secondary">
                          <div className="flex items-center gap-1.5">
                            <Calendar size={13} className="text-text-muted" />
                            <span>{new Date(tx.timestamp).toLocaleString('en-AE', { timeZone: 'Asia/Dubai' })}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-surface-elevated/20 text-xs font-semibold">
                <span className="text-text-muted">
                  Showing <strong className="text-text-primary">{totalCount === 0 ? 0 : (page - 1) * 50 + 1}</strong> to{" "}
                  <strong className="text-text-primary">
                    {Math.min(page * 50, totalCount)}
                  </strong> of{" "}
                  <strong className="text-text-primary">{totalCount}</strong> movements
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    disabled={page === 1}
                    onClick={() => updateUrlParams({ page: page - 1 })}
                    className="px-2.5 py-1.5 bg-surface border border-border hover:bg-surface-elevated disabled:opacity-50 text-text-secondary disabled:hover:bg-surface disabled:hover:text-text-secondary rounded-lg font-semibold transition-colors duration-200 cursor-pointer"
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                    .map((p, pIdx, arr) => {
                      const prevPage = arr[pIdx - 1];
                      return (
                        <div key={p} className="flex items-center gap-1">
                          {prevPage && p - prevPage > 1 && <span className="text-text-muted px-1">...</span>}
                          <button
                            type="button"
                            onClick={() => updateUrlParams({ page: p })}
                            className={`px-3 py-1.5 border rounded-lg font-semibold transition-all duration-200 cursor-pointer ${
                              p === page
                                ? 'bg-primary border-primary text-white'
                                : 'bg-surface border-border hover:bg-surface-elevated text-text-secondary'
                            }`}
                          >
                            {p}
                          </button>
                        </div>
                      );
                    })}
                  <button
                    type="button"
                    disabled={page === totalPages}
                    onClick={() => updateUrlParams({ page: page + 1 })}
                    className="px-2.5 py-1.5 bg-surface border border-border hover:bg-surface-elevated disabled:opacity-50 text-text-secondary disabled:hover:bg-surface disabled:hover:text-text-secondary rounded-lg font-semibold transition-colors duration-200 cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
            </>
          )}
        </div>
      </div>

      <ImageLightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />
    </div>
  );
}
