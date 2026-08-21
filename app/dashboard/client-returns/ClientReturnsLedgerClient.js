'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Undo2, Plus, Search, ChevronDown, ChevronRight, FileText, BarChart3, Loader2, ArrowLeft, Calendar, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import CopyDeliveryNoteButton from '@/components/CopyDeliveryNoteButton';
import CustomSelect from '@/components/CustomSelect';

export default function ClientReturnsLedgerClient({ transactions, totalCount, totalPages, page, brands }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'dispatched');
  const [pdfLoadingKey, setPdfLoadingKey] = useState(null);

  // Flat Transactions Tab Filters
  const [productFilter, setProductFilter] = useState('');
  const [selectedBrandId, setSelectedBrandId] = useState('');

  // Grouped Return Notes Tab Filters
  const [dnSearch, setDnSearch] = useState('');

  // Expand state for Return Notes
  const [expandedDn, setExpandedDn] = useState({});

  const changeTab = (tab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
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
      if (tx.fromEntityType === 'BRAND' && tx.toEntityType === 'WAREHOUSE') {
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
        const isFromClient = tx.fromEntityType === 'BRAND' && tx.toEntityType === 'WAREHOUSE';
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

  const filteredDispatchedGroups = dispatchedGroups.filter(g =>
    g.deliveryNote.toLowerCase().includes(dnSearch.toLowerCase()) ||
    g.brandName.toLowerCase().includes(dnSearch.toLowerCase())
  );

  const filteredReturnedGroups = returnedGroups.filter(g =>
    g.deliveryNote.toLowerCase().includes(dnSearch.toLowerCase()) ||
    g.brandName.toLowerCase().includes(dnSearch.toLowerCase())
  );

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
      alert(e.message || 'Failed to download Gate Pass PDF.');
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
  const renderGroupedGatePasses = (groups, emptyMessage) => (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-surface border border-border p-4 rounded-xl shadow-sm">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-2.5 text-text-muted" size={16} />
          <input
            type="text"
            placeholder="Search Gate Pass Number or Client..."
            className="w-full bg-surface-elevated text-text-primary placeholder:text-text-muted border border-border rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-primary font-medium"
            value={dnSearch}
            onChange={(e) => setDnSearch(e.target.value)}
          />
        </div>
        <span className="text-[11px] text-text-secondary font-semibold font-mono">
          Showing {groups.length} Gate Pass batches
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {groups.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl p-8 text-center text-text-muted text-xs shadow-sm">
            {emptyMessage}
          </div>
        ) : (
          groups.map(group => {
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
                  <div className="flex items-center gap-3">
                    <div className="text-text-muted">
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono">{group.deliveryNote}</span>
                      <span className="text-[10px] text-text-secondary font-semibold">
                        Date: {dateStr} · Client: <strong className="text-primary">{group.brandName}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    <div className="text-left sm:text-right text-[10px] text-text-secondary font-semibold">
                      <div>Receiver: <strong className="text-text-primary">{group.receivedBy || 'N/A'}</strong></div>
                      <div>Approver: <strong className="text-text-primary">{group.supervisorName || 'N/A'}</strong></div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadPDF(group);
                      }}
                      disabled={pdfLoadingKey === groupKey}
                      className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary hover:text-primary-hover font-bold text-xs rounded-lg transition-colors border border-primary/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                    >
                      {pdfLoadingKey === groupKey ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <FileText size={13} />
                      )}
                      <span>Gate Pass</span>
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border bg-surface-elevated/20 p-4">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-border text-[10px] font-bold text-text-muted uppercase tracking-wider">
                          <th className="py-2 pr-4 font-semibold sticky left-0 bg-surface-sticky z-10 border-r border-border shadow-sm">Product Description</th>
                          <th className="py-2 pr-4 font-semibold">SKU / Item Code</th>
                          <th className="py-2 pr-4 text-center font-semibold">Qty</th>
                          <th className="py-2 font-semibold">Notes / Serials</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {group.items.map((tx, idx) => (
                          <tr key={idx} className="text-xs text-text-primary group/subrow">
                            <td className="py-2.5 pr-4 font-semibold sticky left-0 bg-surface group-hover/subrow:bg-surface-elevated z-10 border-r border-border shadow-sm">{tx.product?.name}</td>
                            <td className="py-2.5 pr-4 font-mono font-bold text-[11px] text-primary">{tx.product?.itemCode || '—'}</td>
                            <td className="py-2.5 pr-4 text-center font-bold">{tx.quantity}</td>
                            <td className="py-2.5 text-text-secondary font-medium leading-relaxed">
                              {tx.notes || (tx.product?.isSerialized ? 'Serialized items' : 'Bulk items')}
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
  );

  // Shared flat transaction table renderer
  const renderFlatTransactions = (txs) => (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-surface border border-border p-4 rounded-xl shadow-sm">
        <div className="relative col-span-1 sm:col-span-2">
          <Search className="absolute left-3 top-2.5 text-text-muted" size={16} />
          <input
            type="text"
            placeholder="Search product name, SKU code..."
            className="w-full bg-surface-elevated text-text-primary placeholder:text-text-muted border border-border rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-primary font-medium"
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
          />
        </div>
        <div className="col-span-1">
          <CustomSelect
            options={brandOptions}
            value={selectedBrandId}
            onChange={setSelectedBrandId}
          />
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden flex flex-col gap-3">
        {txs.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl p-8 text-center text-text-muted text-xs shadow-sm">
            No matching transactions found.
          </div>
        ) : (
          txs.map((tx) => {
            const dateObj = new Date(tx.timestamp);
            const formattedDate = dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
            return (
              <div key={tx.id} className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold text-sm text-text-primary block truncate">{tx.product?.name}</span>
                    <span className="text-[11px] text-text-muted font-mono">{tx.product?.itemCode || 'No SKU'}</span>
                  </div>
                  <span className="font-mono font-bold text-sm flex-shrink-0">{tx.quantity}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-text-secondary font-semibold">{tx.product?.brand?.name || '—'}</span>
                  <span className="text-text-muted">{formattedDate}</span>
                </div>
                {tx.deliveryNote && (
                  <div className="pt-2 border-t border-border/50 text-[11px]">
                    <span className="text-primary font-mono font-bold">Gate Pass: {tx.deliveryNote}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-surface-elevated/40 text-[10px] font-bold text-text-muted uppercase tracking-wider">
              <th className="py-3 px-4 font-semibold sticky left-0 bg-surface-sticky z-10 border-r border-border shadow-sm">Product Description</th>
              <th className="py-3 px-4 font-semibold">Date</th>
              <th className="py-3 px-4 font-semibold">Gate Pass No</th>
              <th className="py-3 px-4 font-semibold">Client Brand</th>
              <th className="py-3 px-4 text-center font-semibold">Qty</th>
              <th className="py-3 px-4 font-semibold">Remarks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {txs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-text-muted text-xs">
                  No matching transactions found.
                </td>
              </tr>
            ) : (
              txs.map((tx) => {
                const dateObj = new Date(tx.timestamp);
                const formattedDate = dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
                const formattedTime = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

                return (
                  <tr key={tx.id} className="text-xs hover:bg-surface-elevated/20 transition-colors group/row">
                    <td className="py-3 px-4 sticky left-0 bg-surface group-hover/row:bg-surface-elevated z-10 border-r border-border shadow-sm">
                      <span className="font-semibold block">{tx.product?.name}</span>
                      <span className="text-[10px] font-mono text-text-muted block mt-0.5">{tx.product?.itemCode || 'No SKU'}</span>
                    </td>
                    <td className="py-3 px-4 font-semibold whitespace-nowrap text-text-secondary">
                      {formattedDate} <span className="text-[10px] font-normal block mt-0.5">{formattedTime}</span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold uppercase text-[11px] whitespace-nowrap">{tx.deliveryNote || '—'}</td>
                    <td className="py-3 px-4 font-bold text-primary">{tx.product?.brand?.name || '—'}</td>
                    <td className="py-3 px-4 text-center font-bold">{tx.quantity}</td>
                    <td className="py-3 px-4 text-text-secondary font-medium max-w-xs truncate">{tx.notes || '—'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
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
          <Link
            href="/dashboard/client-returns/balances"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-surface border border-border text-text-primary hover:bg-surface-elevated font-semibold text-sm rounded-lg shadow-sm transition-all duration-200"
          >
            <BarChart3 size={15} />
            <span>Stock With Clients</span>
          </Link>
          <Link
            href="/dashboard/client-returns/new"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200 whitespace-nowrap"
          >
            <Plus size={16} />
            <span>Return Stock to Client</span>
          </Link>
        </div>
      </header>

      {/* Top-level tabs: Dispatched vs Returned */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          onClick={() => changeTab('dispatched')}
          className={`px-4 py-2 border-b-2 text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center gap-2 ${
            isDispatched
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <ArrowUpRight size={15} />
          Dispatched to Client
          <span className="text-[10px] font-mono text-text-muted">({dispatchedTxs.length})</span>
        </button>
        <button
          onClick={() => changeTab('returned')}
          className={`px-4 py-2 border-b-2 text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center gap-2 ${
            isReturned
              ? 'border-success text-success font-bold'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <ArrowDownLeft size={15} />
          Returned from Client
          <span className="text-[10px] font-mono text-text-muted">({returnedTxs.length})</span>
        </button>
      </div>

      {/* Sub-tabs: Grouped vs Flat — inside the active top tab */}
      <div className="flex items-center gap-1 bg-surface-elevated/30 border border-border rounded-xl p-1 w-fit">
        <button
          onClick={() => changeTab(isReturned ? 'returned' : 'dispatched')}
          className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
            !activeTab.includes('-flat')
              ? 'bg-surface text-text-primary shadow-sm'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          <ChevronDown size={15} />
          By Gate Pass
        </button>
        <button
          onClick={() => changeTab(isReturned ? 'returned-flat' : 'dispatched-flat')}
          className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
            activeTab.includes('-flat')
              ? 'bg-surface text-text-primary shadow-sm'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          All Transactions
        </button>
      </div>

      {/* Content */}
      {activeTab === 'dispatched' && renderGroupedGatePasses(filteredDispatchedGroups, 'No dispatch gate passes logged yet.')}
      {activeTab === 'dispatched-flat' && renderFlatTransactions(filteredDispatchedTxs)}
      {activeTab === 'returned' && renderGroupedGatePasses(filteredReturnedGroups, 'No return gate passes logged yet.')}
      {activeTab === 'returned-flat' && renderFlatTransactions(filteredReturnedTxs)}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-border mt-2 flex-shrink-0">
          <span className="text-xs text-text-secondary font-medium">
            Page <strong>{page}</strong> of {totalPages} ({totalCount} total entries)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => changePage(page - 1)}
              disabled={page <= 1}
              className="px-3.5 py-1.5 border border-border bg-surface text-text-secondary hover:bg-surface-elevated text-xs font-semibold rounded-lg shadow-sm disabled:opacity-40 transition-colors cursor-pointer"
            >
              Previous
            </button>
            <button
              onClick={() => changePage(page + 1)}
              disabled={page >= totalPages}
              className="px-3.5 py-1.5 border border-border bg-surface text-text-secondary hover:bg-surface-elevated text-xs font-semibold rounded-lg shadow-sm disabled:opacity-40 transition-colors cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
