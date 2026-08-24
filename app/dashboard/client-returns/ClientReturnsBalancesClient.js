'use client';

import React, { useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, BarChart3, Tag, ClipboardList, Info, X, RotateCcw, Loader2, CheckCircle, AlertCircle, History, ArrowUpRight, ArrowDownLeft, FileText } from 'lucide-react';
import { returnClientItemsToWarehouse } from '@/app/actions/transactions';
import ExportToExcel from '@/components/ExportToExcel';
import { useToast } from '@/components/Toast';
import TabNav from '@/components/TabNav';

export default function ClientReturnsBalancesClient({ balances, recentTransactions = [] }) {
  const toast = useToast();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSerialList, setActiveSerialList] = useState(null); // { productName, serials: [...] }
  
  // Tab state
  const [activeTab, setActiveTab] = useState('stock'); // 'stock' or 'history'

  // History tab state
  const [historySearch, setHistorySearch] = useState('');
  const [historyDirection, setHistoryDirection] = useState('all'); // 'all', 'toClient', 'fromClient'
  const [historyPdfLoading, setHistoryPdfLoading] = useState(null);
  
  // Return-to-warehouse modal state
  const [returnModal, setReturnModal] = useState(null); // { brandId, brandName, items: [...] }
  const [returnDate, setReturnDate] = useState('');
  const [returnNotes, setReturnNotes] = useState('');
  const [returnSupervisorName, setReturnSupervisorName] = useState('');
  const [returnItems, setReturnItems] = useState([]); // [{ productId, quantity, barcodesInput, notes, isExpanded, error }]
  const [returnLoading, setReturnLoading] = useState(false);
  const [returnError, setReturnError] = useState('');
  const [returnSuccess, setReturnSuccess] = useState('');

  // Filter balances by search query
  const filteredBalances = useMemo(() => {
    return (balances || []).filter(b => {
      const q = searchQuery.toLowerCase();
      return b.brandName.toLowerCase().includes(q) || 
             b.productName.toLowerCase().includes(q) || 
             (b.itemCode && b.itemCode.toLowerCase().includes(q)) || 
             (b.category && b.category.toLowerCase().includes(q));
    });
  }, [balances, searchQuery]);

  // Group balances by Brand for card layout
  const balancesByBrand = useMemo(() => {
    const map = {};
    filteredBalances.forEach(b => {
      if (!map[b.brandId]) {
        map[b.brandId] = {
          brandId: b.brandId,
          brandName: b.brandName,
          items: []
        };
      }
      map[b.brandId].items.push(b);
    });
    return Object.values(map).sort((a, b) => a.brandName.localeCompare(b.brandName));
  }, [filteredBalances]);

  // Calculate total items with clients
  const totalStockWithClients = useMemo(() => {
    return (balances || []).reduce((acc, curr) => acc + curr.quantity, 0);
  }, [balances]);

  // --- History tab helpers ---
  const filteredHistory = useMemo(() => {
    return (recentTransactions || []).filter(tx => {
      const isToClient = tx.toEntityType === 'BRAND';
      const isFromClient = tx.fromEntityType === 'BRAND';
      const direction = isFromClient && tx.toEntityType === 'WAREHOUSE' ? 'fromClient' : 'toClient';

      const matchDirection = historyDirection === 'all' ||
        (historyDirection === 'toClient' && direction === 'toClient') ||
        (historyDirection === 'fromClient' && direction === 'fromClient');

      const q = historySearch.toLowerCase();
      const matchSearch = !q ||
        tx.product?.name?.toLowerCase().includes(q) ||
        tx.product?.itemCode?.toLowerCase().includes(q) ||
        tx.product?.brand?.name?.toLowerCase().includes(q) ||
        tx.deliveryNote?.toLowerCase().includes(q);

      return matchDirection && matchSearch;
    });
  }, [recentTransactions, historySearch, historyDirection]);

  const handleHistoryDownloadPDF = async (tx) => {
    const isFromClient = tx.fromEntityType === 'BRAND' && tx.toEntityType === 'WAREHOUSE';
    const dateStr = new Date(tx.timestamp).toISOString().split('T')[0];
    const brandId = isFromClient ? tx.fromEntityId : tx.toEntityId;
    const key = tx.deliveryNote || tx.id;
    setHistoryPdfLoading(key);

    try {
      const endpoint = isFromClient ? 'return-gate-pass' : 'gate-pass';
      const url = `/api/dashboard/client-returns/${endpoint}?dn=${encodeURIComponent(tx.deliveryNote)}&brandId=${brandId}&date=${dateStr}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('PDF generation failed');
      const blob = await res.blob();
      const fileUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = isFromClient
        ? `IML-ReturnToWarehouse-${tx.deliveryNote}.pdf`
        : `IML-ClientReturn-GatePass-${tx.deliveryNote}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(fileUrl);
    } catch (e) {
      toast.error('Download Failed', e.message || 'Could not download Gate Pass PDF.');
    } finally {
      setHistoryPdfLoading(null);
    }
  };

  // --- Return modal logic ---
  const handleOpenReturnModal = (brandGroup) => {
    const items = brandGroup.items.map(bal => ({
      productId: bal.productId,
      productName: bal.productName,
      itemCode: bal.itemCode,
      maxQty: bal.quantity,
      isSerialized: bal.isSerialized,
      quantity: bal.isSerialized ? 0 : bal.quantity,
      barcodesInput: '',
      notes: '',
      isExpanded: true,
      error: ''
    }));
    setReturnModal({ brandId: brandGroup.brandId, brandName: brandGroup.brandName });
    setReturnItems(items);
    setReturnDate('');
    setReturnNotes('');
    setReturnSupervisorName('');
    setReturnError('');
    setReturnSuccess('');
  };

  const updateReturnItem = (idx, field, val) => {
    setReturnItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: val, error: '' };
      if (field === 'barcodesInput') {
        const barcodes = val.split(/[\n,]+/).map(b => b.trim()).filter(Boolean);
        updated.quantity = barcodes.length;
      }
      return updated;
    }));
  };

  const handleSubmitReturn = async (e) => {
    e.preventDefault();
    setReturnError('');
    setReturnSuccess('');

    if (!returnSupervisorName.trim()) {
      setReturnError('Please enter the received by staff name.');
      return;
    }

    // Validate items
    let hasError = false;
    const updated = returnItems.map(item => {
      if (item.isSerialized) {
        const barcodes = item.barcodesInput.split(/[\n,]+/).map(b => b.trim()).filter(Boolean);
        if (barcodes.length === 0) {
          hasError = true;
          return { ...item, error: 'At least one barcode must be scanned/entered', isExpanded: true };
        }
      } else {
        const q = parseInt(item.quantity, 10);
        if (isNaN(q) || q <= 0) {
          hasError = true;
          return { ...item, error: 'Quantity must be greater than 0', isExpanded: true };
        }
        if (q > item.maxQty) {
          hasError = true;
          return { ...item, error: `Max available: ${item.maxQty}`, isExpanded: true };
        }
      }
      return item;
    });

    if (hasError) {
      setReturnItems(updated);
      return;
    }

    setReturnLoading(true);
    try {
      const payload = {
        brandId: returnModal.brandId,
        deliverySupervisorName: returnSupervisorName.trim(),
        transactionDate: returnDate || null,
        globalNotes: returnNotes || null,
        items: returnItems.map(x => ({
          productId: x.productId,
          quantity: x.quantity,
          barcodes: x.barcodesInput.split(/[\n,]+/).map(b => b.trim()).filter(Boolean),
          notes: x.notes || null
        }))
      };

      const result = await returnClientItemsToWarehouse(payload);

      if (result && result.length > 0) {
        setReturnSuccess('Successfully returned items to warehouse! Generating gate pass PDF...');

        // Download gate pass PDF
        const refNo = result[0].deliveryNote;
        const dateStr = returnDate || new Date().toISOString().split('T')[0];
        const url = `/api/dashboard/client-returns/return-gate-pass?dn=${encodeURIComponent(refNo)}&brandId=${returnModal.brandId}&date=${dateStr}`;
        try {
          const pdfRes = await fetch(url);
          if (pdfRes.ok) {
            const blob = await pdfRes.blob();
            const fileUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = fileUrl;
            a.download = `IML-ClientReturnToWarehouse-${refNo}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(fileUrl);
          }
        } catch (pdfErr) {
          console.error('PDF download failed:', pdfErr);
        }

        setTimeout(() => {
          setReturnModal(null);
          router.refresh();
        }, 2000);
      }
    } catch (err) {
      setReturnError(err.message || 'Failed to return items to warehouse.');
    } finally {
      setReturnLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 font-sans relative">
      <div className="absolute top-0 right-0 pointer-events-none opacity-5 overflow-hidden">
        <BarChart3 size={250} />
      </div>

      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/client-returns" className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-border bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-3xl font-display font-extrabold text-text-primary tracking-tight">
              With Client
            </h1>
            <p className="text-text-secondary text-sm mt-1">
              Real-time summary of inventory balances currently held by client brand owners.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ExportToExcel
            data={filteredBalances.map(b => ({
              Product: b.productName,
              Brand: b.productBrand,
              Category: b.productCategory || '',
              Client: b.clientName || '',
              'Client Type': b.clientType || '',
              Quantity: b.totalQuantity,
              'With Client': b.totalWithClient,
              Dispatched: b.totalDispatched,
              Returned: b.totalReturned,
            }))}
            columns={[
              { header: 'Product', key: 'Product', width: 25 },
              { header: 'Brand', key: 'Brand', width: 18 },
              { header: 'Category', key: 'Category', width: 16 },
              { header: 'Client', key: 'Client', width: 20 },
              { header: 'Client Type', key: 'Client Type', width: 12 },
              { header: 'Quantity', key: 'Quantity', width: 10 },
              { header: 'With Client', key: 'With Client', width: 12 },
              { header: 'Dispatched', key: 'Dispatched', width: 12 },
              { header: 'Returned', key: 'Returned', width: 10 },
            ]}
            filename="IML-Client-Balances"
          />
          <div className="flex items-center gap-1.5 px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-xl shadow-sm">
            <ClipboardList size={16} />
            <span className="text-xs font-bold font-mono">Total with Clients: {totalStockWithClients} items</span>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <TabNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabs={[
          { key: 'stock', label: 'Stock With Clients', icon: <ClipboardList size={15} /> },
          { key: 'history', label: 'History', icon: <History size={15} /> },
        ]}
      />

      {activeTab === 'stock' ? (
        <>
          {/* Filter / Search Bar */}
          <div className="bg-surface border border-border p-4 rounded-xl shadow-sm flex items-center justify-between">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-2.5 text-text-muted" size={16} />
              <input
                type="text"
                placeholder="Filter by Brand, Product Name, SKU..."
                className="w-full bg-surface-elevated text-text-primary placeholder:text-text-muted border border-border rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-primary font-medium"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <span className="hidden sm:inline text-[11px] text-text-secondary font-semibold font-mono">
              Showing {balancesByBrand.length} brands in summary
            </span>
          </div>

          {/* Brand Summary Cards */}
          <div className="grid grid-cols-1 gap-6">
            {balancesByBrand.length === 0 ? (
              <div className="bg-surface border border-border rounded-xl p-12 text-center text-text-muted text-xs shadow-sm">
                No items are currently recorded as "With Client".
              </div>
            ) : (
              balancesByBrand.map(brandGroup => (
                <div key={brandGroup.brandId} className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col gap-4 p-5">
                  <h3 className="font-display font-extrabold text-base text-primary flex items-center gap-2 pb-2.5 border-b border-border">
                    <Tag size={16} />
                    <span>{brandGroup.brandName}</span>
                  </h3>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-border text-[10px] font-bold text-text-muted uppercase tracking-wider">
                          <th className="py-2 pr-4 font-semibold">SKU / Item Code</th>
                          <th className="py-2 pr-4 font-semibold">Product Description</th>
                          <th className="py-2 pr-4 font-semibold">Category</th>
                          <th className="py-2 pr-4 text-center font-semibold">Stock Qty</th>
                          <th className="py-2 font-semibold text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {brandGroup.items.map((bal, idx) => (
                          <tr key={idx} className="text-xs hover:bg-surface-elevated/20 transition-colors">
                            <td className="py-3 pr-4 font-mono font-bold text-[11px] text-primary">{bal.itemCode || '—'}</td>
                            <td className="py-3 pr-4 font-bold text-text-primary">{bal.productName}</td>
                            <td className="py-3 pr-4 text-text-secondary font-semibold">{bal.category || 'General'}</td>
                            <td className="py-3 pr-4 text-center font-extrabold">{bal.quantity}</td>
                            <td className="py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {bal.isSerialized && (
                                  <button
                                    type="button"
                                    onClick={() => setActiveSerialList({ productName: bal.productName, serials: bal.serialNumbers })}
                                    className="px-2.5 py-1 bg-surface border border-border hover:bg-surface-elevated hover:text-primary font-bold text-[10px] rounded transition-all cursor-pointer"
                                  >
                                    View Serials
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    // Open modal pre-filtered to this specific brand group
                                    const brandGroup = balancesByBrand.find(bg => bg.brandId === bal.brandId);
                                    if (brandGroup) handleOpenReturnModal(brandGroup);
                                  }}
                                  className="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 font-bold text-[10px] rounded transition-all cursor-pointer"
                                >
                                  Return to WH
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        /* TAB 2: HISTORY */
        <div className="flex flex-col gap-4">
          {/* History Filters */}
          <div className="bg-surface border border-border p-4 rounded-xl shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-2.5 text-text-muted" size={16} />
              <input
                type="text"
                placeholder="Search by product, SKU, brand, gate pass..."
                className="w-full bg-surface-elevated text-text-primary placeholder:text-text-muted border border-border rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-primary font-medium"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1 bg-surface-elevated p-0.5 rounded-lg border border-border">
              {[
                { value: 'all', label: 'All' },
                { value: 'toClient', label: '→ To Client' },
                { value: 'fromClient', label: '← From Client' },
              ].map((btn) => (
                <button
                  key={btn.value}
                  onClick={() => setHistoryDirection(btn.value)}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                    historyDirection === btn.value
                      ? 'bg-surface text-text-primary shadow-sm border border-border'
                      : 'text-text-secondary hover:text-text-primary border border-transparent'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-text-secondary font-semibold font-mono whitespace-nowrap">
              {filteredHistory.length} transactions
            </span>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden flex flex-col gap-3">
            {filteredHistory.length === 0 ? (
              <div className="bg-surface border border-border rounded-xl p-8 text-center text-text-muted text-xs shadow-sm">No transactions found.</div>
            ) : (
              filteredHistory.map((tx) => {
                const isFromClient = tx.fromEntityType === 'BRAND' && tx.toEntityType === 'WAREHOUSE';
                const dateObj = new Date(tx.timestamp);
                const formattedDate = dateObj.toLocaleDateString('en-AE', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', year: 'numeric' });
                return (
                  <div key={tx.id} className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className={`badge text-[10px] ${isFromClient ? 'badge-success' : 'badge-info'}`}>{isFromClient ? 'From Client' : 'To Client'}</span>
                      <span className="font-mono font-bold text-sm">{tx.quantity}</span>
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-sm text-text-primary block truncate">{tx.product?.name}</span>
                      <span className="text-[11px] text-text-muted">{tx.product?.brand?.name || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px]">
                      <span className="text-text-muted">{formattedDate} · {tx.receivedBy || '—'}</span>
                      {tx.deliveryNote && <span className="text-primary font-mono font-semibold">{tx.deliveryNote}</span>}
                    </div>
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
                  <th className="py-3 px-4 font-semibold">Direction</th>
                  <th className="py-3 px-4 font-semibold">Product</th>
                  <th className="py-3 px-4 font-semibold">Gate Pass</th>
                  <th className="py-3 px-4 font-semibold">Brand</th>
                  <th className="py-3 px-4 text-center font-semibold">Qty</th>
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold">Received By</th>
                  <th className="py-3 px-4 text-right font-semibold">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-text-muted text-xs">
                      No transactions found.
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((tx) => {
                    const isFromClient = tx.fromEntityType === 'BRAND' && tx.toEntityType === 'WAREHOUSE';
                    const direction = isFromClient ? 'fromClient' : 'toClient';
                    const dateObj = new Date(tx.timestamp);
                    const formattedDate = dateObj.toLocaleDateString('en-AE', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', year: 'numeric' });
                    const formattedTime = dateObj.toLocaleTimeString('en-AE', { timeZone: 'Asia/Dubai', hour: '2-digit', minute: '2-digit', hour12: true });

                    return (
                      <tr key={tx.id} className="text-xs hover:bg-surface-elevated/20 transition-colors">
                        <td className="py-3 px-4">
                          {isFromClient ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-success/10 text-success border border-success/20 rounded-full text-[10px] font-bold">
                              <ArrowDownLeft size={10} />
                              From Client
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-[10px] font-bold">
                              <ArrowUpRight size={10} />
                              To Client
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold block">{tx.product?.name}</span>
                          <span className="text-[10px] font-mono text-text-muted block mt-0.5">{tx.product?.itemCode || 'No SKU'}</span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-[11px] whitespace-nowrap">{tx.deliveryNote || '—'}</td>
                        <td className="py-3 px-4 font-bold text-primary">{tx.product?.brand?.name || '—'}</td>
                        <td className="py-3 px-4 text-center font-bold">{tx.quantity}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-semibold text-text-secondary">{formattedDate}</span>
                          <span className="text-[10px] text-text-muted block mt-0.5">{formattedTime}</span>
                        </td>
                        <td className="py-3 px-4 text-text-secondary font-medium">{tx.receivedBy || '—'}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleHistoryDownloadPDF(tx)}
                            disabled={historyPdfLoading === (tx.deliveryNote || tx.id)}
                            className="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary hover:text-primary-hover font-bold text-[10px] rounded-lg transition-colors border border-primary/20 flex items-center gap-1 cursor-pointer disabled:opacity-50 ml-auto"
                          >
                            {historyPdfLoading === (tx.deliveryNote || tx.id) ? (
                              <Loader2 size={11} className="animate-spin" />
                            ) : (
                              <FileText size={11} />
                            )}
                            <span>Gate Pass</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Serial numbers list overlay modal */}
      {activeSerialList && (
        <div className="fixed inset-0 bg-black/80 z-[999] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border rounded-xl p-5 w-full max-w-[480px] shadow-2xl flex flex-col gap-4 animate-slide-down max-h-[90vh]">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="font-display font-bold text-sm text-text-primary flex items-center gap-1.5 min-w-0">
                <Info size={16} className="text-primary flex-shrink-0" />
                <span className="truncate">Serials: {activeSerialList.productName}</span>
              </h3>
              <button 
                type="button" 
                className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors cursor-pointer" 
                onClick={() => setActiveSerialList(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 max-h-[350px]">
              <p className="text-[11px] text-text-secondary leading-relaxed font-sans mb-1 bg-surface-elevated/30 border border-border/40 p-2 rounded">
                Below is the list of active serial number barcodes currently held by the client for this product.
              </p>
              
              <div className="grid grid-cols-2 gap-2">
                {activeSerialList.serials.map((s, idx) => (
                  <div 
                    key={s.id} 
                    className="flex justify-between items-center py-1.5 px-2 bg-surface-elevated/20 border border-border rounded-lg"
                  >
                    <code className="text-text-primary text-[11px] font-mono font-semibold">{s.barcode}</code>
                    <span className="text-[9px] text-text-muted font-bold">#{idx + 1}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <button
                type="button"
                onClick={() => {
                  const text = activeSerialList.serials.map(s => s.barcode).join('\n');
                  navigator.clipboard.writeText(text);
                  toast.success('Copied', 'Serial barcodes copied to clipboard.');
                }}
                className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs rounded-lg transition-colors border border-primary/20 cursor-pointer"
              >
                Copy All to Clipboard
              </button>
              <button
                type="button"
                onClick={() => setActiveSerialList(null)}
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-lg shadow cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return to Warehouse Modal */}
      {returnModal && (
        <div className="fixed inset-0 bg-black/80 z-[999] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border rounded-xl p-5 w-full max-w-[700px] shadow-2xl flex flex-col gap-4 animate-slide-down max-h-[90vh]">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="font-display font-bold text-sm text-text-primary flex items-center gap-1.5 min-w-0">
                <RotateCcw size={16} className="text-primary flex-shrink-0" />
                <span className="truncate">Return to Warehouse — {returnModal.brandName}</span>
              </h3>
              <button 
                type="button" 
                className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors cursor-pointer" 
                onClick={() => setReturnModal(null)}
              >
                <X size={16} />
              </button>
            </div>

            {returnError && (
              <div className="bg-danger/10 border border-danger/20 text-danger rounded-lg p-3 text-xs font-semibold flex items-center gap-2">
                <AlertCircle size={14} className="flex-shrink-0" />
                <span>{returnError}</span>
              </div>
            )}
            {returnSuccess && (
              <div className="bg-success/10 border border-success/20 text-success rounded-lg p-3 text-xs font-semibold flex items-center gap-2">
                <CheckCircle size={14} className="text-success" />
                <span>{returnSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSubmitReturn} className="flex flex-col gap-4 overflow-y-auto pr-1">
              {/* Header fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Received By (Staff) *</label>
                  <input
                    type="text"
                    className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 font-semibold"
                    value={returnSupervisorName}
                    onChange={(e) => setReturnSupervisorName(e.target.value)}
                    placeholder="e.g. John Doe"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Transaction Date</label>
                  <input
                    type="datetime-local"
                    className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 font-semibold font-mono"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Remarks</label>
                  <input
                    type="text"
                    className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary font-semibold"
                    placeholder="e.g. Campaign ended"
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                  />
                </div>
              </div>

              {/* Items list */}
              <div className="flex flex-col gap-3">
                {returnItems.map((item, idx) => (
                  <div 
                    key={idx}
                    className={`bg-surface-elevated/30 border rounded-xl p-4 transition-all ${
                      item.error ? 'border-danger/40 ring-1 ring-danger/20' : 'border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 pb-2 border-b border-border/50 mb-3">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-xs font-bold text-text-primary truncate">{item.productName}</span>
                        <span className="text-[10px] text-text-secondary font-semibold font-mono">
                          SKU: {item.itemCode || '—'} · Max: <strong className="text-primary">{item.maxQty}</strong>
                        </span>
                      </div>
                    </div>

                    {item.error && (
                      <div className="bg-danger/10 border border-danger/20 text-danger rounded-lg p-2 text-[11px] font-semibold flex items-center gap-1.5 mb-2">
                        <AlertCircle size={12} className="flex-shrink-0" />
                        <span>{item.error}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {!item.isSerialized && (
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-semibold text-text-secondary">Return Qty</label>
                          <input
                            type="number"
                            min={1}
                            max={item.maxQty}
                            className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 font-semibold"
                            value={item.quantity || ''}
                            onChange={(e) => updateReturnItem(idx, 'quantity', parseInt(e.target.value, 10) || 0)}
                          />
                        </div>
                      )}

                      {item.isSerialized && (
                        <div className="flex flex-col gap-1.5 sm:col-span-2">
                          <label className="text-[10px] font-semibold text-text-secondary">Scan / Enter Barcodes (comma or newline separated)</label>
                          <textarea
                            rows={3}
                            className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                            placeholder="SIM87600123&#10;SIM87600124"
                            value={item.barcodesInput}
                            onChange={(e) => updateReturnItem(idx, 'barcodesInput', e.target.value)}
                          />
                          <span className="text-[10px] text-text-secondary font-semibold">
                            Parsed: <strong className="text-primary font-extrabold">{item.quantity}</strong> serial(s)
                          </span>
                        </div>
                      )}

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-semibold text-text-secondary">Notes (Optional)</label>
                        <input
                          type="text"
                          className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                          placeholder="Line notes..."
                          value={item.notes}
                          onChange={(e) => updateReturnItem(idx, 'notes', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-2 border-t border-border pt-3">
                <button
                  type="button"
                  onClick={() => setReturnModal(null)}
                  className="px-4 py-2 bg-surface border border-border hover:bg-surface-elevated text-text-secondary font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={returnLoading}
                  className="px-5 py-2 bg-primary hover:bg-primary-hover disabled:bg-primary/50 text-white font-bold text-xs rounded-lg shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {returnLoading ? (
                    <><Loader2 size={14} className="animate-spin" /> Processing...</>
                  ) : (
                    <><RotateCcw size={14} /> Return to Warehouse</>
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
