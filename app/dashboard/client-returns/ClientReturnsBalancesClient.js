'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, BarChart3, Tag, ClipboardList, Info, X } from 'lucide-react';

export default function ClientReturnsBalancesClient({ balances }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSerialList, setActiveSerialList] = useState(null); // { productName, serials: [...] }

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
              Stock With Clients
            </h1>
            <p className="text-text-secondary text-sm mt-1">
              Real-time summary of inventory balances currently held by client brand owners.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-xl shadow-sm">
          <ClipboardList size={16} />
          <span className="text-xs font-bold font-mono">Total Returned: {totalStockWithClients} items</span>
        </div>
      </header>

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
                          {bal.isSerialized ? (
                            <button
                              type="button"
                              onClick={() => setActiveSerialList({ productName: bal.productName, serials: bal.serialNumbers })}
                              className="px-2.5 py-1 bg-surface border border-border hover:bg-surface-elevated hover:text-primary font-bold text-[10px] rounded transition-all cursor-pointer"
                            >
                              View Serials
                            </button>
                          ) : (
                            <span className="text-[10px] font-semibold text-text-muted italic pr-2">Bulk Item</span>
                          )}
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
                  alert('Serials copied to clipboard!');
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
    </div>
  );
}
