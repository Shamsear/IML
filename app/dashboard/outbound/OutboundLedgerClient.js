'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { ArrowUpRight, Plus, Search, ChevronDown, ChevronRight, FileText, CopyPlus, Loader2, RotateCcw, Trash2, UserCheck, Edit2 } from 'lucide-react';
import TransactionActions from '@/components/TransactionActions';
import CopyDeliveryNoteButton from '@/components/CopyDeliveryNoteButton';
import CustomSelect from '@/components/CustomSelect';

export default function OutboundLedgerClient({ transactions = [], totalCount = 0, totalPages = 1, page = 1, entityNames = {}, stores = [], supervisorNames = {} }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'transactions');

  const changeTab = (tab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };
  const [pdfLoadingKey, setPdfLoadingKey] = useState(null); // tracks which group's PDF button is loading
  
  // Filters for Transactions Tab
  const [productFilter, setProductFilter] = useState('');
  const [storeId, setStoreId] = useState(''); // '' = all stores

  // Search filter for Delivery Notes Tab
  const [dnSearch, setDnSearch] = useState('');

  // Expand state for Delivery Notes
  const [expandedDn, setExpandedDn] = useState({});

  const toggleDnExpand = (dnKey) => {
    setExpandedDn(prev => ({
      ...prev,
      [dnKey]: !prev[dnKey]
    }));
  };

  // Group by Delivery Note (only for STORE destinations with a DN)
  const deliveryNotesGroups = useMemo(() => {
    const groups = {};
    transactions.forEach(tx => {
      if (tx.deliveryNote && tx.toEntityType === 'STORE' && tx.toEntityId) {
        const key = `${tx.deliveryNote}_${tx.toEntityId}`;
        if (!groups[key]) {
          groups[key] = {
            deliveryNote: tx.deliveryNote,
            storeId: tx.toEntityId,
            storeName: entityNames[tx.toEntityId] || tx.toEntityId,
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

  // Filtered transactions for the Ledger tab
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const matchProduct = tx.product.name.toLowerCase().includes(productFilter.toLowerCase());
      const matchStore = storeId
        ? (tx.toEntityType === 'STORE' && tx.toEntityId === storeId)
        : true;
      return matchProduct && matchStore;
    });
  }, [transactions, productFilter, storeId]);

  const filteredGroups = deliveryNotesGroups.filter(g => 
    g.deliveryNote.toLowerCase().includes(dnSearch.toLowerCase()) || 
    g.storeName.toLowerCase().includes(dnSearch.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 relative">
      <div className="absolute top-0 right-0 pointer-events-none opacity-5 overflow-hidden">
        <ArrowUpRight size={250} />
      </div>
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 pb-4 sm:pb-5 border-b border-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-text-primary tracking-tight">
            Outbound Dispatches
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Audit logs of all stock allocations, promoter issues, and store shipments.
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <CopyDeliveryNoteButton type="outbound" noteType="Delivery" />
          <Link 
            href="/dashboard/outbound/new" 
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200 whitespace-nowrap"
          >
            <Plus size={16} />
            <span>New Outbound Dispatch</span>
          </Link>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-colors ${activeTab === 'transactions' ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border'}`}
          onClick={() => changeTab('transactions')}
        >
          Transactions Ledger
        </button>
        <button
          className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-colors ${activeTab === 'delivery_notes' ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border'}`}
          onClick={() => changeTab('delivery_notes')}
        >
          Grouped Delivery Notes
        </button>
      </div>

      {activeTab === 'transactions' && (
        <div className="flex flex-col gap-4 animate-fade-in">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 bg-surface p-4 rounded-xl border border-border shadow-sm">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
              <input
                type="text"
                placeholder="Search by product name..."
                className="w-full pl-9 pr-4 py-2.5 bg-surface text-text-primary border border-border rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                value={productFilter}
                onChange={e => setProductFilter(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <CustomSelect
                options={storeOptions}
                value={storeId}
                onChange={setStoreId}
                placeholder="All Stores"
              />
            </div>
          </div>

          {/* Mobile Card View */}
          {filteredTransactions.length === 0 ? (
            <div className="md:hidden bg-surface border border-border rounded-xl shadow-sm py-16 text-center flex flex-col items-center gap-3 text-text-muted">
              <ArrowUpRight size={48} className="text-text-muted" />
              <h3 className="font-display font-bold text-lg text-text-primary">No matching transactions</h3>
            </div>
          ) : (
            <div className="md:hidden flex flex-col gap-3">
              {filteredTransactions.map((tx) => {
                const dateStr = new Date(tx.timestamp).toLocaleDateString('en-AE', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                let destinationName = tx.toEntityType === 'CLIENT' ? (tx.toEntityId || 'Client Possession') : (entityNames[tx.toEntityId] || tx.toEntityId || '---');
                return (
                  <div key={tx.id} className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-sm text-text-primary block truncate">{tx.product.name}</span>
                        <span className="text-[11px] text-text-muted">{tx.product.brand.name}</span>
                      </div>
                      <span className="badge text-[10px] bg-secondary/15 text-secondary border border-secondary/10 flex-shrink-0">{tx.toEntityType}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-secondary font-medium">{dateStr}</span>
                      <span className="font-mono font-bold text-sm text-primary">-{tx.quantity}</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px]">
                      <span className="text-text-secondary truncate max-w-[55%]">{destinationName}</span>
                      <div className="flex items-center gap-2">
                        {tx.deliveryNote && tx.toEntityType === 'STORE' && tx.toEntityId && (
                          <Link href={`/api/dashboard/stores/${tx.toEntityId}/delivery-note?date=${new Date(tx.timestamp).toISOString().split('T')[0]}&brandId=${tx.product.brandId}&dn=${tx.deliveryNote}`} target="_blank" className="text-primary font-semibold hover:underline">
                            {tx.deliveryNote}
                          </Link>
                        )}
                        <TransactionActions txId={tx.id} notes={tx.notes || ''} deliveryNote={tx.deliveryNote || ''} showDeliveryNote={tx.toEntityType === 'STORE'} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Desktop Table View */}
          <div className="hidden md:block bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
            {filteredTransactions.length === 0 ? (
              <div className="py-16 text-center flex flex-col items-center gap-3 text-text-muted bg-surface">
                <ArrowUpRight size={48} className="text-text-muted" />
                <h3 className="font-display font-bold text-lg text-text-primary">No matching transactions</h3>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border text-[11px] sm:text-xs md:text-sm">
                    <thead>
                      <tr className="text-left text-xs font-bold text-text-secondary uppercase tracking-wider bg-surface-elevated/40">
                        <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 sticky left-0 bg-surface-sticky z-20 border-r border-border shadow-sm">Product Details</th>
                        <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Date</th>
                        <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">SKU</th>
                        <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Destination Type</th>
                        <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Destination Entity</th>
                        <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Via Supervisor</th>
                        <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-center">Quantity</th>
                        <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Delivery Note</th>
                        <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Remarks</th>
                        <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-text-primary">
                      {filteredTransactions.map((tx) => {
                        const dateStr = new Date(tx.timestamp).toLocaleDateString('en-AE', { timeZone: 'Asia/Dubai',
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        });

                        let destinationName = tx.toEntityType === 'CLIENT' 
                          ? (tx.toEntityId || 'Client Possession') 
                          : (entityNames[tx.toEntityId] || tx.toEntityId || '---');

                        return (
                          <tr key={tx.id} className="hover:bg-surface-elevated/20 transition-colors group/row">
                            <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap sticky left-0 bg-surface group-hover/row:bg-surface-elevated z-10 border-r border-border shadow-sm">
                              <div className="flex flex-col">
                                <span className="font-semibold">{tx.product.name}</span>
                                <span className="text-[11px] text-text-muted mt-0.5">Brand: {tx.product.brand.name}</span>
                              </div>
                            </td>
                            <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap text-xs text-text-secondary font-medium">{dateStr}</td>
                            <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap font-mono text-xs text-text-secondary">{tx.product.itemCode || '---'}</td>
                            <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap">
                              <span className="badge text-[10px] bg-secondary/15 text-secondary border border-secondary/10">{tx.toEntityType}</span>
                            </td>
                            <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 font-semibold text-xs text-text-secondary whitespace-nowrap">{destinationName}</td>
                            <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap">
                              {tx.deliverySupervisorId ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                                  <UserCheck size={12} />
                                  {supervisorNames[tx.deliverySupervisorId] || '---'}
                                </span>
                              ) : (
                                <span className="text-xs text-text-muted">—</span>
                              )}
                            </td>
                            <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-center font-mono font-bold text-sm whitespace-nowrap text-primary">-{tx.quantity}</td>
                            <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 font-mono text-xs text-text-secondary whitespace-nowrap">
                              {tx.deliveryNote && tx.toEntityType === 'STORE' && tx.toEntityId ? (
                                <div className="has-tooltip">
                                  <Link
                                    href={`/api/dashboard/stores/${tx.toEntityId}/delivery-note?date=${new Date(tx.timestamp).toISOString().split('T')[0]}&brandId=${tx.product.brandId}&dn=${tx.deliveryNote}`}
                                    target="_blank"
                                    className="text-primary hover:text-primary-hover hover:underline transition-colors font-semibold"
                                  >
                                    {tx.deliveryNote}
                                  </Link>
                                  <span className="tooltip-box">Download Delivery Note PDF</span>
                                </div>
                              ) : (
                                <span>{tx.deliveryNote || '---'}</span>
                              )}
                            </td>
                            <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 max-w-xs truncate text-xs text-text-secondary" title={tx.notes || ''}>{tx.notes || '---'}</td>
                            <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-right">
                              <TransactionActions
                                txId={tx.id}
                                notes={tx.notes || ''}
                                deliveryNote={tx.deliveryNote || ''}
                                showDeliveryNote={true}
                                copyType="outbound"
                                copyDnUrl={tx.deliveryNote ? `/dashboard/outbound/new?copyDn=${tx.deliveryNote}` : null}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && !productFilter && !storeId && (
                  <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-surface-elevated/20 text-xs">
                    <span className="text-text-muted">
                      Showing <strong className="text-text-primary">{(page - 1) * 25 + 1}</strong> to{" "}
                      <strong className="text-text-primary">{Math.min(page * 25, totalCount)}</strong> of{" "}
                      <strong className="text-text-primary">{totalCount}</strong> dispatches
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Link href={`/dashboard/outbound?page=${Math.max(1, page - 1)}`} className={`px-2.5 py-1.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary rounded-lg font-semibold transition-all duration-200 ${page === 1 ? 'pointer-events-none opacity-50' : ''}`}>Previous</Link>
                      <Link href={`/dashboard/outbound?page=${Math.min(totalPages, page + 1)}`} className={`px-2.5 py-1.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary rounded-lg font-semibold transition-all duration-200 ${page === totalPages ? 'pointer-events-none opacity-50' : ''}`}>Next</Link>
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
                placeholder="Search Delivery Notes or Stores..."
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
                <h3 className="font-display font-bold text-lg text-text-primary">No Delivery Notes found</h3>
              </div>
            ) : (
              filteredGroups.map(group => {
                const groupKey = `${group.deliveryNote}_${group.storeId}`;
                const isExpanded = expandedDn[groupKey];
                
                return (
                  <div key={groupKey} className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
                    <div 
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-elevated/20 transition-colors gap-4"
                      onClick={() => toggleDnExpand(groupKey)}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`p-2 rounded-lg ${isExpanded ? 'bg-primary text-white' : 'bg-surface-elevated text-text-secondary'}`}>
                          {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-3">
                            <h3 className="font-bold text-text-primary">{group.deliveryNote}</h3>
                            <span className="badge text-[10px] bg-secondary/15 text-secondary border border-secondary/10 px-2 py-0.5 rounded uppercase tracking-wider">{group.storeName}</span>
                          </div>
                          <p className="text-xs text-text-secondary mt-1">
                            {new Date(group.timestamp).toLocaleDateString('en-AE', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} • {group.items.length} product(s)
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/dashboard/outbound/${encodeURIComponent(group.deliveryNote)}/edit`);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 font-bold text-xs rounded-lg transition-colors"
                        >
                          <Edit2 size={14} />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/dashboard/outbound/new?copyDn=${group.deliveryNote}`);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-success/10 hover:bg-success/20 text-success border border-success/20 font-bold text-xs rounded-lg transition-colors"
                        >
                          <CopyPlus size={14} />
                          <span>Duplicate</span>
                        </button>
                        {group.items.some(tx => tx.product.isReturnable) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/dashboard/returns?dn=${encodeURIComponent(group.deliveryNote)}`);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 font-bold text-xs rounded-lg transition-colors"
                          >
                            <RotateCcw size={14} />
                            <span>Return</span>
                          </button>
                        )}
                        {group.items.some(tx => tx.product.isDisposable) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/dashboard/used?dn=${encodeURIComponent(group.deliveryNote)}`);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-warning/10 hover:bg-warning/20 text-warning border border-warning/20 font-bold text-xs rounded-lg transition-colors"
                          >
                            <Trash2 size={14} />
                            <span>Mark Used</span>
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPdfLoadingKey(groupKey);
                            const pdfApiUrl = `/api/dashboard/stores/${group.storeId}/delivery-note?date=${new Date(group.timestamp).toISOString().split('T')[0]}&brandId=${group.items[0]?.product.brandId}&dn=${group.deliveryNote}`;
                            router.push(`/pdf-preview?url=${encodeURIComponent(pdfApiUrl)}&title=${encodeURIComponent(group.deliveryNote)}`);
                          }}
                          disabled={pdfLoadingKey === groupKey}
                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs rounded-lg transition-colors border border-primary/20 disabled:opacity-60 disabled:cursor-wait"
                        >
                          {pdfLoadingKey === groupKey ? (
                            <><Loader2 size={13} className="animate-spin" /><span>Loading…</span></>
                          ) : (
                            <span>View PDF</span>
                          )}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-border bg-surface/50 overflow-x-auto">
                        <table className="min-w-full divide-y divide-border text-[11px] sm:text-xs md:text-sm">
                          <thead>
                            <tr className="text-left text-xs font-bold text-text-secondary uppercase tracking-wider bg-surface-elevated/20">
                              <th className="py-2.5 px-5 pl-14">Product Name</th>
                              <th className="py-2.5 px-5">SKU</th>
                              <th className="py-2.5 px-5">Brand</th>
                              <th className="py-2.5 px-5 text-center">Quantity</th>
                              <th className="py-2.5 px-5 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border text-text-primary">
                            {group.items.map(tx => (
                              <tr key={tx.id} className="hover:bg-surface-elevated/40 transition-colors">
                                <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 pl-14 font-medium text-xs">{tx.product.name}</td>
                                <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-xs font-mono text-text-secondary">{tx.product.itemCode || '---'}</td>
                                <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-xs text-text-secondary">{tx.product.brand.name}</td>
                                <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-center font-mono text-xs font-bold text-primary">-{tx.quantity}</td>
                                <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-right">
                                  <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                    {tx.product.isReturnable && (
                                      <button
                                        type="button"
                                        onClick={() => router.push(`/dashboard/returns?dn=${encodeURIComponent(tx.deliveryNote || '')}`)}
                                        className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 font-bold text-[10px] rounded-md transition-colors"
                                      >
                                        <RotateCcw size={10} /> Return
                                      </button>
                                    )}
                                    {tx.product.isDisposable && (
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
        </div>
      )}
    </div>
  );
}
