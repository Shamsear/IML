'use client';

import { useState } from 'react';
import { 
  History, ArrowDownLeft, ArrowUpRight, ShieldAlert, RefreshCw, 
  ClipboardList, Calendar, FileText, User, Store, UserCheck, Package, Search
} from 'lucide-react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import CustomSelect from '@/components/CustomSelect';

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filterType, setFilterType] = useState(initialType);
  const [filterProduct, setFilterProduct] = useState(initialProductId);
  const [searchQuery, setSearchQuery] = useState(initialSearch);

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
    router.push(`${pathname}?${params.toString()}`);
  };

  // Debounced search query update
  const handleSearchChange = (val) => {
    setSearchQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      updateUrlParams({ search: val });
    }, 400);
  };

  // Since we query server-side, paginatedTransactions is just initialTransactions
  const paginatedTransactions = initialTransactions;

  return (
    <div className="flex flex-col gap-6 relative">
      <div className="absolute top-0 right-0 pointer-events-none opacity-5 overflow-hidden">
        <History size={250} />
      </div>
      {/* Header */}
      <header className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 pb-5 border-b border-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-text-primary tracking-tight">
            Inventory Ledger Feed
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Audit logs of stock dispatches, returns, rebrands, and damages.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link href="/dashboard/inbound" className="inline-flex items-center gap-2 px-4 py-2.5 bg-success/15 hover:bg-success text-success hover:text-white border border-success/30 rounded-lg text-sm font-semibold transition-colors duration-200">
            <ArrowDownLeft size={16} />
            <span>Inbound (Receive)</span>
          </Link>
          <Link href="/dashboard/outbound" className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary/15 hover:bg-primary text-primary hover:text-white border border-primary/30 rounded-lg text-sm font-semibold transition-colors duration-200">
            <ArrowUpRight size={16} />
            <span>Outbound (Dispatch)</span>
          </Link>
          <Link href="/dashboard/rebrand" className="inline-flex items-center gap-2 px-4 py-2.5 bg-secondary/15 hover:bg-secondary text-secondary hover:text-white border border-secondary/30 rounded-lg text-sm font-semibold transition-colors duration-200">
            <RefreshCw size={16} />
            <span>Rebrand Stock</span>
          </Link>
          <Link href="/dashboard/damage" className="inline-flex items-center gap-2 px-4 py-2.5 bg-danger/15 hover:bg-danger text-danger hover:text-white border border-danger/30 rounded-lg text-sm font-semibold transition-colors duration-200">
            <ShieldAlert size={16} />
            <span>Log Damage</span>
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

        {/* Ledger Table Panel */}
        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm overflow-hidden">
          {paginatedTransactions.length === 0 ? (
            <div className="py-16 text-center flex flex-col items-center gap-3 text-text-muted">
              <History size={48} />
              <h3 className="font-display font-bold text-lg text-text-primary">No Ledger Logs Found</h3>
              <p className="text-sm max-w-xs">Select a movement action above to log stock operations.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto -mx-5">
              <div className="inline-block min-w-full align-middle px-5">
                <table className="min-w-full divide-y divide-border">
                  <thead>
                    <tr className="text-left text-xs font-bold text-text-secondary uppercase tracking-wider">
                      <th className="pb-3 pr-4 sticky left-0 bg-surface z-10 border-r border-border shadow-sm">Product Details</th>
                      <th className="pb-3 px-4">SKU</th>
                      <th className="pb-3 px-4">Transaction Type</th>
                      <th className="pb-3 px-4">Source / From</th>
                      <th className="pb-3 px-4">Destination / To</th>
                      <th className="pb-3 px-4 text-center">Quantity</th>
                      <th className="pb-3 px-4">Delivery Note</th>
                      <th className="pb-3 pl-4">Date &amp; Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-sm text-text-primary">
                    {paginatedTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-surface-elevated/20 transition-colors group/row">
                        <td className="py-3.5 pr-4 whitespace-nowrap sticky left-0 bg-surface group-hover/row:bg-surface-elevated z-10 border-r border-border shadow-sm">
                          <div className="flex flex-col">
                            <span className="font-semibold text-text-primary">{tx.product.name}</span>

                            {tx.receivedBy && (
                              <span className="text-[10px] text-text-secondary mt-1 font-semibold flex items-center gap-1">
                                👤 Received/Processed by: <span className="text-primary font-bold">{tx.receivedBy}</span>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs text-text-secondary">
                          {tx.product.itemCode || '---'}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`badge ${
                            tx.transactionType === 'RECEIVE' || tx.transactionType === 'REBRAND_IN' ? 'badge-success' :
                            tx.transactionType === 'ISSUE' ? 'badge-info' : 
                            tx.transactionType === 'DAMAGE' || tx.transactionType === 'LOST' ? 'badge-danger' : 'badge-warning'
                          }`}>
                            {tx.transactionType}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
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
                        <td className="py-3.5 px-4 whitespace-nowrap">
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
                        <td className="py-3.5 px-4 text-center whitespace-nowrap font-mono font-bold">
                          {tx.quantity}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap text-xs text-text-secondary">
                          {tx.deliveryNote ? (
                            (tx.transactionType === 'RECEIVE' || tx.transactionType === 'RETURN') ? (
                              <Link
                                href={`/api/dashboard/inbound/delivery-note?date=${new Date(tx.timestamp).toISOString().split('T')[0]}&brandId=${tx.product.brandId}&dn=${tx.deliveryNote}`}
                                target="_blank"
                                className="flex items-center gap-1.5 text-success hover:text-success/80 hover:underline transition-colors"
                                title="Download Inbound Delivery Note PDF"
                              >
                                <FileText size={13} />
                                <span className="font-semibold">{tx.deliveryNote}</span>
                              </Link>
                            ) : (tx.transactionType === 'ISSUE' && tx.toEntityType === 'STORE' && tx.toEntityId) ? (
                              <Link
                                href={`/api/dashboard/stores/${tx.toEntityId}/delivery-note?date=${new Date(tx.timestamp).toISOString().split('T')[0]}&brandId=${tx.product.brandId}&dn=${tx.deliveryNote}`}
                                target="_blank"
                                className="flex items-center gap-1.5 text-primary hover:text-primary-hover hover:underline transition-colors"
                                title="Download Delivery Note PDF"
                              >
                                <FileText size={13} />
                                <span className="font-semibold">{tx.deliveryNote}</span>
                              </Link>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <FileText size={13} className="text-text-muted" />
                                <span>{tx.deliveryNote}</span>
                              </div>
                            )
                          ) : (
                            <span className="text-text-muted">N/A</span>
                          )}
                        </td>
                        <td className="py-3.5 pl-4 whitespace-nowrap text-xs text-text-secondary">
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
    </div>
  );
}
