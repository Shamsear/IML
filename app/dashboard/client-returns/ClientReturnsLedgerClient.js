'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Undo2, Plus, Search, ChevronDown, ChevronRight, FileText, BarChart3, Loader2, ArrowLeft, Calendar, ArrowUpRight, ArrowDownLeft, Edit2, ExternalLink, Package } from 'lucide-react';
import TransactionActions from '@/components/TransactionActions';
import CopyDeliveryNoteButton from '@/components/CopyDeliveryNoteButton';
import CustomSelect from '@/components/CustomSelect';
import ExportToExcel from '@/components/ExportToExcel';
import Pagination from '@/components/Pagination';
import { useToast } from '@/components/Toast';
import SortableHeader from '@/components/SortableHeader';
import { useTableSort } from '@/hooks/useTableSort';
import DeliveryNoteLink from '@/components/DeliveryNoteLink';
import ImageLightbox from '@/components/ImageLightbox';
import { getOptimizedImageUrl } from '@/lib/imagekit';
import { usePermissions } from '@/hooks/usePermissions';

export default function ClientReturnsLedgerClient({ transactions, totalCount, totalPages, page, brands }) {
  const router = useRouter();
  const toast = useToast();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isReadOnly } = usePermissions();

  const [lightboxImage, setLightboxImage] = useState(null);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'dispatched');
  const [pdfLoadingKey, setPdfLoadingKey] = useState(null);

  // Flat Transactions Tab Filters
  const [productFilter, setProductFilter] = useState('');
  const [selectedBrandId, setSelectedBrandId] = useState('');

  // Grouped Return Notes Tab Filters
  const [dnSearch, setDnSearch] = useState('');
  const [groupPage, setGroupPage] = useState(1);
  const groupsPerPage = 25;

  // Expand state for Return Notes
  const [expandedDn, setExpandedDn] = useState({});

  const changeTab = (tab) => {
    setActiveTab(tab);
    setGroupPage(1);
    const params = new URLSearchParams(searchParams ? searchParams.toString() : '');
    params.set('tab', tab);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `${pathname}?${params.toString()}`);
    }
  };

  const toggleDnExpand = (dnKey) => {
    setExpandedDn(prev => ({
      ...prev,
      [dnKey]: !prev[dnKey]
    }));
  };

  // Separate transactions by direction
  const { dispatchedTxs, returnedTxs } = useMemo(() => {
    const dispatched = [];
    const returned = [];
    (transactions || []).forEach(tx => {
      const isFromClient = ((tx.fromEntityType === 'BRAND' || tx.fromEntityType === 'CLIENT') && tx.toEntityType === 'WAREHOUSE') || tx.transactionType === 'RETURN' || tx.transactionType === 'CLIENT_RETURN';
      if (isFromClient) {
        returned.push(tx);
      } else {
        dispatched.push(tx);
      }
    });
    return { dispatchedTxs: dispatched, returnedTxs: returned };
  }, [transactions]);

  // Group transactions by Gate Pass — direction-aware
  const buildGroups = (txs) => {
    const groups = {};
    txs.forEach(tx => {
      if (tx.deliveryNote) {
        const isFromClient = ((tx.fromEntityType === 'BRAND' || tx.fromEntityType === 'CLIENT') && tx.toEntityType === 'WAREHOUSE') || tx.transactionType === 'RETURN' || tx.transactionType === 'CLIENT_RETURN';
        const direction = isFromClient ? 'fromClient' : 'toClient';
        const brandId = isFromClient ? tx.fromEntityId : tx.toEntityId;
        const key = `${tx.deliveryNote}_${brandId || 'unknown'}_${direction}`;
        if (!groups[key]) {
          groups[key] = {
            deliveryNote: tx.deliveryNote,
            brandId: brandId,
            direction,
            brandName: tx.product?.brand?.name || 'Client',
            timestamp: tx.timestamp,
            receivedBy: tx.receivedBy,
            supervisorName: tx.deliverySupervisor?.name || '',
            items: []
          };
        }
        groups[key].items.push(tx);
      }
    });
    return Object.values(groups).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  };

  const dispatchedGroups = useMemo(() => buildGroups(dispatchedTxs), [dispatchedTxs]);
  const returnedGroups = useMemo(() => buildGroups(returnedTxs), [returnedTxs]);

  const filteredDispatchedGroups = useMemo(() => {
    return dispatchedGroups.filter(g =>
      g.deliveryNote.toLowerCase().includes(dnSearch.toLowerCase()) ||
      g.brandName.toLowerCase().includes(dnSearch.toLowerCase())
    );
  }, [dispatchedGroups, dnSearch]);

  const filteredReturnedGroups = useMemo(() => {
    return returnedGroups.filter(g =>
      g.deliveryNote.toLowerCase().includes(dnSearch.toLowerCase()) ||
      g.brandName.toLowerCase().includes(dnSearch.toLowerCase())
    );
  }, [returnedGroups, dnSearch]);

  // Gate Pass pagination calculation
  const isGroupedView = !activeTab.includes('-flat');
  const currentActiveGroups = activeTab === 'dispatched' ? filteredDispatchedGroups : filteredReturnedGroups;
  const totalGroupPages = Math.ceil(currentActiveGroups.length / groupsPerPage);
  const paginatedGroups = useMemo(() => {
    const start = (groupPage - 1) * groupsPerPage;
    return currentActiveGroups.slice(start, start + groupsPerPage);
  }, [currentActiveGroups, groupPage, groupsPerPage]);

  const handleGroupPageChange = (newPage) => {
    setGroupPage(newPage);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Filtered flat transaction lists
  const filteredDispatchedTxs = useMemo(() => {
    return dispatchedTxs.filter(tx => {
      const matchProduct = tx.product.name.toLowerCase().includes(productFilter.toLowerCase()) ||
                           (tx.product.itemCode && tx.product.itemCode.toLowerCase().includes(productFilter.toLowerCase()));
      const matchBrand = selectedBrandId ? tx.product.brand?.id === selectedBrandId : true;
      return matchProduct && matchBrand;
    });
  }, [dispatchedTxs, productFilter, selectedBrandId]);

  const filteredReturnedTxs = useMemo(() => {
    return returnedTxs.filter(tx => {
      const matchProduct = tx.product.name.toLowerCase().includes(productFilter.toLowerCase()) ||
                           (tx.product.itemCode && tx.product.itemCode.toLowerCase().includes(productFilter.toLowerCase()));
      const matchBrand = selectedBrandId ? tx.product.brand?.id === selectedBrandId : true;
      return matchProduct && matchBrand;
    });
  }, [returnedTxs, productFilter, selectedBrandId]);

  const brandOptions = useMemo(() => {
    return [
      { value: '', label: 'All Brands' },
      ...brands.map(b => ({ value: b.id, label: b.name }))
    ];
  }, [brands]);

  const handleDownloadPDF = async (group) => {
    const dateStr = new Date(group.timestamp).toISOString().split('T')[0];
    const key = `${group.deliveryNote}_${group.brandId}_${group.direction}`;
    setPdfLoadingKey(key);

    try {
      const isReturnToWarehouse = group.direction === 'fromClient';
      const endpoint = isReturnToWarehouse ? 'return-gate-pass' : 'gate-pass';
      const url = `/api/dashboard/client-returns/${endpoint}?dn=${encodeURIComponent(group.deliveryNote)}&brandId=${group.brandId}&date=${dateStr}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('PDF generation failed');
      const blob = await res.blob();
      const fileUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = isReturnToWarehouse
        ? `IML-ReturnToWarehouse-${group.deliveryNote}.pdf`
        : `IML-ClientReturn-GatePass-${group.deliveryNote}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(fileUrl);
    } catch (e) {
      toast.error('Download Failed', e.message || 'Could not download Gate Pass PDF.');
    } finally {
      setPdfLoadingKey(null);
    }
  };

  const changePage = (newPage) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    router.push(`${pathname}?${params.toString()}`);
  };

  // Shared grouped gate pass list renderer
  const renderGroupedGatePasses = (items, allGroupsCount, emptyMessage) => (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-surface border border-border p-4 rounded-xl shadow-sm">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-2.5 text-text-muted" size={16} />
          <input
            type="text"
            placeholder="Search Gate Pass Number or Client..."
            className="w-full bg-surface-elevated text-text-primary placeholder:text-text-muted border border-border rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-primary font-medium"
            value={dnSearch}
            onChange={(e) => {
              setDnSearch(e.target.value);
              setGroupPage(1);
            }}
          />
        </div>
        <span className="text-[11px] text-text-secondary font-semibold font-mono">
          Showing {allGroupsCount} Gate Pass {allGroupsCount === 1 ? 'batch' : 'batches'}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {items.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl p-8 text-center text-text-muted text-xs shadow-sm">
            {emptyMessage}
          </div>
        ) : (
          items.map(group => {
            const groupKey = `${group.deliveryNote}_${group.brandId}_${group.direction}`;
            const isExpanded = !!expandedDn[groupKey];
            const dateStr = new Date(group.timestamp).toLocaleDateString('en-US', {
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            });

            return (
              <div key={groupKey} className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden transition-all duration-150">
                <div
                  onClick={() => toggleDnExpand(groupKey)}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-surface-elevated/40 select-none"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="text-text-muted flex-shrink-0">
                      {isExpanded ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                    </div>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono truncate">{group.deliveryNote}</span>
                      <span className="text-[10px] text-text-secondary font-semibold">
                        Date: {dateStr} · Client: <strong className="text-primary">{group.brandName}</strong>
                      </span>
                    </div>
                  </div>

                  <div
                    className="flex flex-col sm:flex-row sm:items-center gap-2 flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="text-left sm:text-right text-[10px] text-text-secondary font-semibold">
                      {(() => {
                        const rx = group.receivedBy;
                        const isPlaceholder = !rx || rx.toLowerCase().includes('delivered to client') || rx.toLowerCase() === 'n/a';
                        return <div>Receiver: <strong className="text-text-primary">{isPlaceholder ? '—' : rx}</strong></div>;
                      })()}
                      {(() => {
                        const ap = group.supervisorName;
                        const isPlaceholder = !ap || ap.toLowerCase().includes('delivered to client') || ap.toLowerCase() === 'n/a';
                        return <div>Approver: <strong className="text-text-primary">{isPlaceholder ? '—' : ap}</strong></div>;
                      })()}
                    </div>
                    {!isReadOnly && (
                      <Link
                        href={`/dashboard/client-returns/${encodeURIComponent(group.deliveryNote)}/edit`}
                        className="px-2.5 py-1.5 bg-surface hover:bg-surface-elevated text-text-secondary hover:text-text-primary font-bold text-xs rounded-lg transition-colors border border-border flex items-center gap-1.5 cursor-pointer whitespace-nowrap flex-shrink-0"
                        title="Edit Gate Pass"
                      >
                        <Edit2 size={13} />
                        <span>Edit</span>
                      </Link>
                    )}
                    <a
                      href={`/pdf-preview?url=${encodeURIComponent(`/api/dashboard/client-returns/${group.direction === 'fromClient' ? 'return-gate-pass' : 'gate-pass'}?dn=${encodeURIComponent(group.deliveryNote)}${group.brandId ? `&brandId=${group.brandId}` : ''}&date=${new Date(group.timestamp).toISOString().split('T')[0]}`)}&title=${encodeURIComponent(group.deliveryNote)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 font-bold text-xs rounded-lg transition-colors whitespace-nowrap flex-shrink-0"
                      title="View / Download PDF"
                    >
                      <FileText size={13} />
                      <span>PDF</span>
                    </a>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border bg-surface-elevated/20 overflow-x-auto">
                    <div className="p-4 min-w-[420px]">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-border text-[10px] font-bold text-text-muted uppercase tracking-wider">
                            <th className="py-2 pr-4 font-semibold">Product Description</th>
                            <th className="py-2 pr-4 font-semibold whitespace-nowrap">SKU / Item Code</th>
                            <th className="py-2 pr-4 text-center font-semibold">Qty</th>
                            <th className="py-2 font-semibold">Notes / Serials</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {group.items.map((tx, idx) => (
                            <tr key={idx} className="text-xs text-text-primary hover:bg-surface-elevated/30 transition-colors">
                              <td className="py-2.5 pr-4 min-w-[220px]">
                                <div className="flex items-center gap-2.5">
                                  {tx.product?.imageUrl ? (
                                    <img
                                      src={getOptimizedImageUrl(tx.product.imageUrl, 80, 80)}
                                      alt={tx.product.name || 'Product'}
                                      className="w-8 h-8 rounded-lg object-cover border border-border shrink-0 cursor-zoom-in hover:brightness-95 transition-all"
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
                                    <div className="w-8 h-8 rounded-lg bg-surface-elevated text-text-muted flex items-center justify-center border border-border shrink-0">
                                      <Package size={14} />
                                    </div>
                                  )}
                                  <span className="font-semibold break-words leading-snug">{tx.product?.name}</span>
                                </div>
                              </td>
                              <td className="py-2.5 pr-4 font-mono font-bold text-[11px] text-primary whitespace-nowrap">{tx.product?.itemCode || '—'}</td>
                              <td className="py-2.5 pr-4 text-center font-bold whitespace-nowrap">{tx.quantity}</td>
                              <td className="py-2.5 text-text-secondary font-medium leading-relaxed">
                                {tx.notes || (tx.product?.isSerialized ? 'Serialized items' : 'Bulk items')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );



  const renderFlatTransactions = (txs) => (
    <FlatTransactionTable
      txs={txs}
      brandOptions={brandOptions}
      productFilter={productFilter}
      setProductFilter={setProductFilter}
      selectedBrandId={selectedBrandId}
      setSelectedBrandId={setSelectedBrandId}
      setLightboxImage={setLightboxImage}
      isReadOnly={isReadOnly}
    />
  );

  const isDispatched = activeTab === 'dispatched' || activeTab === 'dispatched-flat';
  const isReturned = activeTab === 'returned' || activeTab === 'returned-flat';

  return (
    <div className="flex flex-col gap-6 relative font-sans">
      <div className="absolute top-0 right-0 pointer-events-none opacity-5 overflow-hidden">
        <Undo2 size={250} />
      </div>

      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 pb-4 sm:pb-5 border-b border-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-text-primary tracking-tight">
            With Client
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Audit logs of stock dispatched to and returned from client brand owners.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 flex-shrink-0">
          <ExportToExcel
            data={transactions.map(tx => ({
              _rawTimestamp: tx.timestamp,
              Image: tx.product?.imageUrl || '',
              Product: tx.product?.name || '',
              Brand: tx.product?.brand?.name || '',
              Type: tx.transactionType || '',
              Quantity: tx.quantity,
              'Delivery Note': tx.deliveryNote || '',
              Date: new Date(tx.timestamp).toLocaleString('en-AE', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
            }))}
            columns={[
              { header: 'Image', key: 'Image', width: 16, isImage: true },
              { header: 'Product', key: 'Product', width: 25 },
              { header: 'Brand', key: 'Brand', width: 18 },
              { header: 'Type', key: 'Type', width: 16 },
              { header: 'Quantity', key: 'Quantity', width: 10 },
              { header: 'Delivery Note', key: 'Delivery Note', width: 20 },
              { header: 'Date', key: 'Date', width: 20 },
            ]}
            filename="IML-Client-Returns-Ledger"
          />
          <Link
            href="/dashboard/client-returns/balances"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-surface border border-border text-text-primary hover:bg-surface-elevated font-semibold text-sm rounded-lg shadow-sm transition-all duration-200"
          >
            <BarChart3 size={15} />
            <span>Stock With Clients</span>
          </Link>
          {!isReadOnly && (
            <Link
              href="/dashboard/client-returns/new"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200 whitespace-nowrap"
            >
              <Plus size={16} />
              <span>Return Stock to Client</span>
            </Link>
          )}
        </div>
      </header>

      {/* Top-level tabs: Dispatched vs Returned — scrollable on mobile */}
      <div className="w-full overflow-x-auto">
        <div className="flex items-center gap-0 border-b border-border w-max min-w-full">
          <button
            onClick={() => changeTab('dispatched')}
            className={`px-3 sm:px-4 py-2.5 border-b-2 text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              isDispatched
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <ArrowUpRight size={14} />
            <span className="sm:hidden">Dispatched</span>
            <span className="hidden sm:inline">Dispatched to Client</span>
            <span className="text-[10px] font-mono text-text-muted">({dispatchedTxs.length})</span>
          </button>
          <button
            onClick={() => changeTab('returned')}
            className={`px-3 sm:px-4 py-2.5 border-b-2 text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              isReturned
                ? 'border-success text-success font-bold'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <ArrowDownLeft size={14} />
            <span className="sm:hidden">Returned</span>
            <span className="hidden sm:inline">Returned from Client</span>
            <span className="text-[10px] font-mono text-text-muted">({returnedTxs.length})</span>
          </button>
        </div>
      </div>

      {/* Sub-tabs: Grouped vs Flat — scrollable on mobile */}
      <div className="w-full overflow-x-auto">
        <div className="flex items-center gap-1 bg-surface-elevated/30 border border-border rounded-xl p-1 w-max min-w-full sm:w-fit">
          <button
            onClick={() => changeTab(isReturned ? 'returned' : 'dispatched')}
            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              !activeTab.includes('-flat')
                ? 'bg-surface text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <ChevronDown size={14} />
            By Gate Pass
          </button>
          <button
            onClick={() => changeTab(isReturned ? 'returned-flat' : 'dispatched-flat')}
            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab.includes('-flat')
                ? 'bg-surface text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            All Transactions
          </button>
        </div>
      </div>

      {/* Top Pagination */}
      {isGroupedView ? (
        <Pagination
          currentPage={groupPage}
          totalPages={totalGroupPages}
          totalItems={currentActiveGroups.length}
          itemsPerPage={groupsPerPage}
          onPageChange={handleGroupPageChange}
          itemLabel="Gate Pass batches"
        />
      ) : (
        totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 bg-surface border border-border rounded-xl shadow-sm text-xs print:hidden">
            <span className="text-text-muted">
              Showing <strong className="text-text-primary">{(page - 1) * 25 + 1}</strong> to{' '}
              <strong className="text-text-primary">{Math.min(page * 25, totalCount)}</strong> of{' '}
              <strong className="text-text-primary">{totalCount}</strong> transactions
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => changePage(page - 1)}
                disabled={page <= 1}
                className="px-2.5 py-1.5 bg-surface border border-border hover:bg-surface-elevated disabled:opacity-50 text-text-secondary disabled:hover:bg-surface rounded-lg font-semibold transition-all cursor-pointer"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => changePage(page + 1)}
                disabled={page >= totalPages}
                className="px-2.5 py-1.5 bg-surface border border-border hover:bg-surface-elevated disabled:opacity-50 text-text-secondary disabled:hover:bg-surface rounded-lg font-semibold transition-all cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )
      )}

      {/* Content */}
      {activeTab === 'dispatched' && renderGroupedGatePasses(paginatedGroups, filteredDispatchedGroups.length, 'No dispatch gate passes logged yet.')}
      {activeTab === 'dispatched-flat' && renderFlatTransactions(filteredDispatchedTxs)}
      {activeTab === 'returned' && renderGroupedGatePasses(paginatedGroups, filteredReturnedGroups.length, 'No return gate passes logged yet.')}
      {activeTab === 'returned-flat' && renderFlatTransactions(filteredReturnedTxs)}

      {/* Bottom Pagination */}
      {isGroupedView ? (
        <Pagination
          currentPage={groupPage}
          totalPages={totalGroupPages}
          totalItems={currentActiveGroups.length}
          itemsPerPage={groupsPerPage}
          onPageChange={handleGroupPageChange}
          itemLabel="Gate Pass batches"
        />
      ) : (
        totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 bg-surface border border-border rounded-xl shadow-sm text-xs print:hidden">
            <span className="text-text-muted">
              Showing <strong className="text-text-primary">{(page - 1) * 25 + 1}</strong> to{' '}
              <strong className="text-text-primary">{Math.min(page * 25, totalCount)}</strong> of{' '}
              <strong className="text-text-primary">{totalCount}</strong> transactions
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => changePage(page - 1)}
                disabled={page <= 1}
                className="px-2.5 py-1.5 bg-surface border border-border hover:bg-surface-elevated disabled:opacity-50 text-text-secondary disabled:hover:bg-surface rounded-lg font-semibold transition-all cursor-pointer"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => changePage(page + 1)}
                disabled={page >= totalPages}
                className="px-2.5 py-1.5 bg-surface border border-border hover:bg-surface-elevated disabled:opacity-50 text-text-secondary disabled:hover:bg-surface rounded-lg font-semibold transition-all cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )
      )}

      <ImageLightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />
    </div>
  );
}

// Shared flat transaction table component
function FlatTransactionTable({ txs, brandOptions, productFilter, setProductFilter, selectedBrandId, setSelectedBrandId, setLightboxImage, isReadOnly }) {
  const [flatPage, setFlatPage] = useState(1);
  const itemsPerPage = 25;

  const customGetters = useMemo(() => ({
    product: (tx) => tx.product?.name || '',
    date: (tx) => tx.timestamp,
    deliveryNote: (tx) => tx.deliveryNote || '',
    brand: (tx) => tx.product?.brand?.name || '',
    quantity: (tx) => tx.quantity ?? 0,
    notes: (tx) => tx.notes || '',
  }), []);

  const {
    sortedItems,
    sortField,
    sortDirection,
    handleSort,
  } = useTableSort(txs, 'date', 'desc', customGetters);

  const totalFlatPages = Math.ceil(sortedItems.length / itemsPerPage);
  const paginatedFlatItems = useMemo(() => {
    const start = (flatPage - 1) * itemsPerPage;
    return sortedItems.slice(start, start + itemsPerPage);
  }, [sortedItems, flatPage, itemsPerPage]);

  const getGatePassEndpoint = (tx) => {
    const isReturn = ['CLIENT_RETURN', 'RETURN'].includes(tx.transactionType) ||
                     (tx.deliveryNote && (
                       tx.deliveryNote.startsWith('RET-') ||
                       tx.deliveryNote.startsWith('RTN-') ||
                       tx.deliveryNote.startsWith('CRN-') ||
                       tx.deliveryNote.startsWith('CRR-')
                     ));
    return isReturn ? 'return-gate-pass' : 'gate-pass';
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-surface border border-border p-4 rounded-xl shadow-sm">
        <div className="relative col-span-1 sm:col-span-2">
          <Search className="absolute left-3 top-2.5 text-text-muted" size={16} />
          <input
            type="text"
            placeholder="Search product name, SKU code..."
            className="w-full bg-surface-elevated text-text-primary placeholder:text-text-muted border border-border rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-primary font-medium"
            value={productFilter}
            onChange={(e) => {
              setProductFilter(e.target.value);
              setFlatPage(1);
            }}
          />
        </div>
        <div className="col-span-1">
          <CustomSelect
            options={brandOptions}
            value={selectedBrandId}
            onChange={(val) => {
              setSelectedBrandId(val);
              setFlatPage(1);
            }}
          />
        </div>
      </div>

      {totalFlatPages > 1 && (
        <Pagination
          currentPage={flatPage}
          totalPages={totalFlatPages}
          totalItems={sortedItems.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setFlatPage}
          itemLabel="transactions"
        />
      )}

      {/* Mobile Card View */}
      <div className="md:hidden flex flex-col gap-3">
        {paginatedFlatItems.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl p-8 text-center text-text-muted text-xs shadow-sm">
            No matching transactions found.
          </div>
        ) : (
          paginatedFlatItems.map((tx) => {
            const dateObj = new Date(tx.timestamp);
            const formattedDate = dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
            return (
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
                      <div className="w-10 h-10 rounded-lg bg-surface-elevated text-text-muted flex items-center justify-center border border-border shrink-0">
                        <Package size={18} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <Link href={`/dashboard/products/${tx.product?.id}`} className="font-semibold text-sm text-text-primary hover:text-primary transition-colors block break-words leading-snug">
                        {tx.product?.name}
                      </Link>
                      <span className="text-[11px] text-text-muted font-mono">{tx.product?.itemCode || 'No SKU'}</span>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-sm flex-shrink-0">{tx.quantity}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-text-secondary font-semibold">{tx.product?.brand?.name || '—'}</span>
                  <span className="text-text-muted">{formattedDate}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px]">
                  <DeliveryNoteLink tx={tx} />
                  <TransactionActions
                    transactionId={tx.id}
                    deliveryNote={tx.deliveryNote}
                    transactionType={tx.transactionType}
                    barcode={tx.barcode}
                    copyType="client-returns"
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-xs">
            <thead>
              <tr className="text-left text-xs font-bold text-text-secondary uppercase tracking-wider bg-surface-elevated/40">
                <SortableHeader field="product" currentField={sortField} direction={sortDirection} onSort={handleSort} className="py-2 sm:py-3 pl-4 sm:pl-5 pr-3 sm:pr-4 sticky left-0 bg-surface-sticky z-20 border-r border-border shadow-sm">Product Details</SortableHeader>
                <SortableHeader field="date" currentField={sortField} direction={sortDirection} onSort={handleSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Date</SortableHeader>
                <SortableHeader field="deliveryNote" currentField={sortField} direction={sortDirection} onSort={handleSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Delivery Note</SortableHeader>
                <SortableHeader field="brand" currentField={sortField} direction={sortDirection} onSort={handleSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Client Brand</SortableHeader>
                <SortableHeader field="quantity" currentField={sortField} direction={sortDirection} onSort={handleSort} align="center" className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Qty</SortableHeader>
                <SortableHeader field="notes" currentField={sortField} direction={sortDirection} onSort={handleSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Remarks</SortableHeader>
                {!isReadOnly && <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-text-primary">
              {paginatedFlatItems.length === 0 ? (
                <tr>
                  <td colSpan={isReadOnly ? 6 : 7} className="py-8 text-center text-text-muted text-xs">
                    No matching transactions found.
                  </td>
                </tr>
              ) : (
                paginatedFlatItems.map((tx) => {
                  const dateObj = new Date(tx.timestamp);
                  const formattedDate = dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
                  const formattedTime = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

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
                            <Link href={`/dashboard/products/${tx.product?.id}`} className="font-semibold text-text-primary hover:text-primary transition-colors break-words leading-snug">
                              {tx.product?.name}
                            </Link>
                            <span className="text-[11px] text-text-muted mt-0.5 font-mono">{tx.product?.itemCode || 'No SKU'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap text-xs text-text-secondary font-medium">
                        <span>{formattedDate}</span>
                        <span className="text-[10px] text-text-muted block mt-0.5">{formattedTime}</span>
                      </td>
                      <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap">
                        <DeliveryNoteLink tx={tx} />
                      </td>
                      <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 font-bold text-primary whitespace-nowrap">{tx.product?.brand?.name || '—'}</td>
                      <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-center font-mono font-bold text-sm whitespace-nowrap">{tx.quantity}</td>
                      <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-text-secondary font-medium max-w-xs truncate text-xs" title={tx.notes || ''}>{tx.notes || '—'}</td>
                      {!isReadOnly && (
                        <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-right whitespace-nowrap">
                          <TransactionActions
                            transactionId={tx.id}
                            deliveryNote={tx.deliveryNote}
                            transactionType={tx.transactionType}
                            barcode={tx.barcode}
                            copyType="client-returns"
                          />
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Pagination */}
        {totalFlatPages > 1 && (
          <div className="p-4 border-t border-border bg-surface-elevated/20">
            <Pagination
              currentPage={flatPage}
              totalPages={totalFlatPages}
              totalItems={sortedItems.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setFlatPage}
              itemLabel="transactions"
            />
          </div>
        )}
      </div>
    </div>
  );
}

