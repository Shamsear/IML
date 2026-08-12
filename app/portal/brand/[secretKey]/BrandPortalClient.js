'use client';

import React, { useState } from 'react';
import { Package, QrCode, Search, FileText, ArrowDownLeft, ArrowUpRight, ShieldAlert, Sparkles, Filter } from 'lucide-react';
import { getOptimizedImageUrl } from '@/lib/imagekit';

export default function BrandPortalClient({ brand }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [productTypeFilter, setProductTypeFilter] = useState('ALL');
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL', 'RECEIVE', 'ISSUE', 'DAMAGE'
  const [activeSection, setActiveSection] = useState('catalog'); // 'catalog', 'logs'

  // Pagination States
  const [productPage, setProductPage] = useState(0);
  const [logPage, setLogPage] = useState(0);
  const [mounted, setMounted] = useState(false);
  const itemsPerPage = 24;

  // Reset pages on search/filter changes
  React.useEffect(() => {
    setProductPage(0);
  }, [searchQuery, productTypeFilter]);

  React.useEffect(() => {
    setLogPage(0);
  }, [activeTab, logSearchQuery]);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Helper to compute individual product stock metrics from transactions
  const getProductStock = (transactions) => {
    let warehouse = 0;
    let dispatched = 0;
    let damaged = 0;

    transactions.forEach(t => {
      const qty = t.quantity || 0;
      if (t.transactionType === 'RECEIVE') {
        warehouse += qty;
      } else if (t.transactionType === 'ISSUE') {
        warehouse -= qty;
        if (t.toEntityType === 'STORE' || t.toEntityType === 'STAFF' || t.toEntityType === 'SUPERVISOR' || t.toEntityType === 'CLIENT') {
          dispatched += qty;
        }
      } else if (t.transactionType === 'RETURN') {
        warehouse += qty;
        if (t.fromEntityType === 'STORE' || t.fromEntityType === 'STAFF' || t.fromEntityType === 'SUPERVISOR' || t.fromEntityType === 'CLIENT') {
          dispatched -= qty;
        }
      } else if (t.transactionType === 'DAMAGE' || t.transactionType === 'LOST') {
        if (t.fromEntityType === 'WAREHOUSE') warehouse -= qty;
        else if (t.fromEntityType === 'STORE' || t.fromEntityType === 'SUPERVISOR') dispatched -= qty;
        damaged += qty;
      } else if (t.transactionType === 'REBRAND_OUT') {
        warehouse -= qty;
      } else if (t.transactionType === 'REBRAND_IN') {
        warehouse += qty;
      }
    });

    return { warehouse, dispatched, damaged };
  };

  // Compute aggregated totals for header overview metrics
  const getAggregatedTotals = () => {
    let warehouse = 0;
    let dispatched = 0;
    let damaged = 0;

    brand.products.forEach(p => {
      const metrics = getProductStock(p.transactions);
      warehouse += metrics.warehouse;
      dispatched += metrics.dispatched;
      damaged += metrics.damaged;
    });

    return { warehouse, dispatched, damaged };
  };

  const totals = getAggregatedTotals();

  // Filter products by search query and type filter
  const filteredProducts = brand.products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.itemCode && p.itemCode.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesType = productTypeFilter === 'ALL' ||
      (productTypeFilter === 'SERIALIZED' && p.isSerialized) ||
      (productTypeFilter === 'BULK' && !p.isSerialized);
      
    return matchesSearch && matchesType;
  });

  // Collate all transactions across all products for the log list
  const allTransactions = brand.products.flatMap(p => 
    p.transactions.map(t => ({
      ...t,
      productName: p.name,
      itemCode: p.itemCode
    }))
  ).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Filter logs by transactionType tab selection and search query
  const filteredTransactions = allTransactions.filter(t => {
    const matchesTab = activeTab === 'ALL' ||
      (activeTab === 'RECEIVE' && (t.transactionType === 'RECEIVE' || t.transactionType === 'RETURN' || t.transactionType === 'REBRAND_IN')) ||
      (activeTab === 'ISSUE' && t.transactionType === 'ISSUE') ||
      (activeTab === 'DAMAGE' && (t.transactionType === 'DAMAGE' || t.transactionType === 'LOST'));
      
    const matchesSearch = logSearchQuery === '' ||
      t.productName.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
      (t.itemCode && t.itemCode.toLowerCase().includes(logSearchQuery.toLowerCase())) ||
      (t.notes && t.notes.toLowerCase().includes(logSearchQuery.toLowerCase())) ||
      t.transactionType.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
      (t.fromEntityName && t.fromEntityName.toLowerCase().includes(logSearchQuery.toLowerCase())) ||
      (t.toEntityName && t.toEntityName.toLowerCase().includes(logSearchQuery.toLowerCase()));
      
    return matchesTab && matchesSearch;
  });

  const totalProductPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(productPage * itemsPerPage, (productPage + 1) * itemsPerPage);

  const totalLogPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = filteredTransactions.slice(logPage * itemsPerPage, (logPage + 1) * itemsPerPage);

  // Group transactions helper for rendering
  const getGroupedTransactions = (txs) => {
    const groups = {};
    txs.forEach(t => {
      const date = new Date(t.timestamp);
      let key = date.toISOString().split('T')[0];
      if (mounted) {
        key = date.toLocaleDateString(undefined, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(t);
    });
    return groups;
  };

  const groupedLogs = getGroupedTransactions(paginatedTransactions);

  return (
    <div className="min-h-[100dvh] bg-[#fcfbfa] text-text-primary py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        
        {/* Portal Branding Header */}
        <header className="bg-surface border border-border p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-center sm:text-left flex-col sm:flex-row">
            {brand.imageUrl ? (
              <img 
                src={getOptimizedImageUrl(brand.imageUrl, 150, 150)} 
                alt={brand.name} 
                className="w-16 h-16 rounded-xl object-contain bg-[#fcfbfa] p-1.5 border border-border"
                onError={(e) => {
                  if (e.target.src !== brand.imageUrl) {
                    e.target.src = brand.imageUrl;
                  }
                }}
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-display font-extrabold text-2xl">
                {brand.name.substring(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <h1 className="text-2xl font-display font-extrabold text-text-primary tracking-tight">
                  {brand.name} Partner Portal
                </h1>
                <span className="inline-flex items-center gap-1 bg-success/10 text-success text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border border-success/20">
                  <Sparkles size={10} /> Live Data
                </span>
              </div>
              <p className="text-text-secondary text-sm mt-1">
                Real-time central warehouse stock ledger and distribution overview.
              </p>
            </div>
          </div>
          <div className="text-center sm:text-right">
            <span className="text-[10px] uppercase font-bold text-text-muted block">Partner Access Token</span>
            <span className="text-xs font-mono font-bold text-text-secondary block mt-1 bg-surface-elevated px-3 py-1 rounded-lg border border-border">
              {brand.id.substring(0, 8)}-{brand.secretKey.substring(0, 4)}...
            </span>
          </div>
        </header>

        {/* Aggregate Stock Metrics Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-surface border border-border p-5 rounded-xl shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <Package size={22} />
            </div>
            <div>
              <span className="text-xs font-bold text-text-secondary block uppercase">Catalog Items</span>
              <span className="text-2xl font-display font-black text-text-primary mt-1 block">
                {brand.products.length}
              </span>
            </div>
          </div>

          <div className="bg-surface border border-border p-5 rounded-xl shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-success/10 text-success flex items-center justify-center flex-shrink-0">
              <ArrowDownLeft size={22} />
            </div>
            <div>
              <span className="text-xs font-bold text-text-secondary block uppercase">Warehouse Stock</span>
              <span className="text-2xl font-display font-black text-success mt-1 block">
                {totals.warehouse}
              </span>
            </div>
          </div>

          <div className="bg-surface border border-border p-5 rounded-xl shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-warning/10 text-warning flex items-center justify-center flex-shrink-0">
              <ArrowUpRight size={22} />
            </div>
            <div>
              <span className="text-xs font-bold text-text-secondary block uppercase">Active Dispatches</span>
              <span className="text-2xl font-display font-black text-warning mt-1 block">
                {totals.dispatched}
              </span>
            </div>
          </div>

          <div className="bg-surface border border-border p-5 rounded-xl shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-danger/10 text-danger flex items-center justify-center flex-shrink-0">
              <ShieldAlert size={22} />
            </div>
            <div>
              <span className="text-xs font-bold text-text-secondary block uppercase">Damaged / Lost</span>
              <span className="text-2xl font-display font-black text-danger mt-1 block">
                {totals.damaged}
              </span>
            </div>
          </div>
        </section>

        {/* Tab Selector */}
        <div className="flex border-b border-border gap-6">
          <button 
            onClick={() => setActiveSection('catalog')} 
            className={`pb-3 font-display font-bold text-sm sm:text-base relative flex items-center gap-2 transition-colors ${
              activeSection === 'catalog' ? 'text-primary' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Package size={18} />
            <span>Product Catalog</span>
            {activeSection === 'catalog' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
          </button>
          <button 
            onClick={() => setActiveSection('logs')} 
            className={`pb-3 font-display font-bold text-sm sm:text-base relative flex items-center gap-2 transition-colors ${
              activeSection === 'logs' ? 'text-primary' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <FileText size={18} />
            <span>Warehouse Logs</span>
            {activeSection === 'logs' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
          </button>
        </div>

        {/* Catalog Section */}
        {activeSection === 'catalog' && (
          <div className="bg-surface border border-border p-5 rounded-2xl shadow-sm flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <Package size={20} className="text-primary" />
                <h3 className="font-display font-bold text-lg text-text-primary">
                  Product Catalog &amp; Stock Levels
                </h3>
              </div>
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {/* Search Bar */}
                <div className="relative w-full sm:w-60">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={14} />
                  <input
                    type="text"
                    placeholder="Search products by name, SKU..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-surface-elevated/45 text-text-primary placeholder:text-text-muted border border-border rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                
                {/* Product Type Filter */}
                <div className="flex bg-surface-elevated p-1 rounded-lg border border-border">
                  {['ALL', 'SERIALIZED', 'BULK'].map(type => (
                    <button
                      key={type}
                      onClick={() => setProductTypeFilter(type)}
                      className={`px-3 py-1 text-[10px] font-bold rounded transition-colors uppercase
                        ${productTypeFilter === type 
                          ? 'bg-surface text-primary shadow-sm border border-border/60' 
                          : 'text-text-secondary hover:text-text-primary'
                        }
                      `}
                    >
                      {type === 'ALL' ? 'All' : type.toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="py-12 text-center text-xs text-text-muted italic bg-surface-elevated/10 rounded-xl border border-dashed border-border">
                No catalog items found matching your filter criteria.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border">
                    <thead>
                      <tr className="text-left text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                        <th className="pb-2.5">Product</th>
                        <th className="pb-2.5 px-3">Type</th>
                        <th className="pb-2.5 px-3 text-center">Warehouse</th>
                        <th className="pb-2.5 px-3 text-center">Dispatched</th>
                        <th className="pb-2.5 pl-3 text-center text-danger">Damaged</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-xs text-text-primary">
                      {paginatedProducts.map(p => {
                        const stock = getProductStock(p.transactions);
                        return (
                          <tr key={p.id} className="hover:bg-surface-elevated/20 transition-colors">
                            <td className="py-3">
                              <div className="flex items-center gap-3">
                                {p.imageUrl ? (
                                  <img 
                                    src={getOptimizedImageUrl(p.imageUrl, 80, 80)} 
                                    alt={p.name} 
                                    className="w-8 h-8 rounded-lg object-contain bg-[#fcfbfa] p-0.5 border border-border flex-shrink-0"
                                    onError={(e) => {
                                      if (e.target.src !== p.imageUrl) {
                                        e.target.src = p.imageUrl;
                                      }
                                    }}
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-lg bg-primary/5 text-primary flex items-center justify-center font-display font-extrabold text-[10px] border border-primary/10 flex-shrink-0">
                                    {p.name.substring(0, 2).toUpperCase()}
                                  </div>
                                )}
                                <div className="flex flex-col min-w-0">
                                  <span className="font-semibold text-text-primary truncate">{p.name}</span>
                                  <span className="text-[10px] text-text-secondary mt-0.5 font-mono">
                                    SKU: {p.itemCode || '---'}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase
                                ${p.isSerialized ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-surface-elevated text-text-secondary border border-border'}
                              `}>
                                {p.isSerialized ? (p.category?.toUpperCase() || 'Serialized') : 'Bulk'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center font-mono font-bold">{stock.warehouse}</td>
                            <td className="py-3 px-3 text-center font-mono font-semibold text-text-secondary">{stock.dispatched}</td>
                            <td className="py-3 px-3 text-center font-mono font-semibold text-danger/80">{stock.damaged}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Product Pagination Controls */}
                {totalProductPages > 1 && (
                  <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-surface-elevated/20 text-[10px] mt-2 rounded-lg">
                    <span className="text-text-muted">
                      Showing <strong className="text-text-primary">{productPage * itemsPerPage + 1}</strong> to{" "}
                      <strong className="text-text-primary">
                        {Math.min((productPage + 1) * itemsPerPage, filteredProducts.length)}
                      </strong> of{" "}
                      <strong className="text-text-primary">{filteredProducts.length}</strong> items
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={productPage === 0}
                        onClick={() => setProductPage(prev => Math.max(0, prev - 1))}
                        className="px-2 py-1 bg-surface border border-border hover:bg-surface-elevated disabled:opacity-50 text-text-secondary disabled:hover:bg-surface rounded-md font-semibold transition-all duration-150"
                      >
                        Prev
                      </button>
                      <button
                        type="button"
                        disabled={productPage === totalProductPages - 1}
                        onClick={() => setProductPage(prev => Math.min(totalProductPages - 1, prev + 1))}
                        className="px-2 py-1 bg-surface border border-border hover:bg-surface-elevated disabled:opacity-50 text-text-secondary disabled:hover:bg-surface rounded-md font-semibold transition-all duration-150"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Logs Section */}
        {activeSection === 'logs' && (
          <div className="bg-surface border border-border p-5 rounded-2xl shadow-sm flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <FileText size={20} className="text-secondary" />
                <h3 className="font-display font-bold text-lg text-text-primary">
                  Warehouse Stock Movement Logs
                </h3>
              </div>
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {/* Search Bar */}
                <div className="relative w-full sm:w-60">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={14} />
                  <input
                    type="text"
                    placeholder="Search logs by product, SKU, notes..."
                    value={logSearchQuery}
                    onChange={(e) => setLogSearchQuery(e.target.value)}
                    className="w-full bg-surface-elevated/45 text-text-primary placeholder:text-text-muted border border-border rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                
                {/* Category tabs */}
                <div className="flex bg-surface-elevated p-1 rounded-lg border border-border">
                  {['ALL', 'RECEIVE', 'ISSUE', 'DAMAGE'].map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-3 py-1 text-[10px] font-bold rounded transition-colors uppercase
                        ${activeTab === tab 
                          ? 'bg-surface text-primary shadow-sm border border-border/60' 
                          : 'text-text-secondary hover:text-text-primary'
                        }
                      `}
                    >
                      {tab === 'RECEIVE' ? 'Inbound' : tab === 'ISSUE' ? 'Outbound' : tab === 'ALL' ? 'All' : 'Damage'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              {filteredTransactions.length === 0 ? (
                <div className="py-12 text-center text-xs text-text-muted italic bg-surface-elevated/10 rounded-xl border border-dashed border-border">
                  No stock logs found matching your filters.
                </div>
              ) : (
                Object.keys(groupedLogs).map(dateGroup => (
                  <div key={dateGroup} className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 border-b border-border/40 pb-1.5 mt-2">
                      <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">{dateGroup}</span>
                      <span className="text-[10px] font-mono text-text-muted font-bold">({groupedLogs[dateGroup].length} logs)</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
                      {groupedLogs[dateGroup].map(t => {
                        const isReceive = t.transactionType === 'RECEIVE' || t.transactionType === 'RETURN' || t.transactionType === 'REBRAND_IN';
                        const isDamage = t.transactionType === 'DAMAGE' || t.transactionType === 'LOST';
                        
                        return (
                          <div 
                            key={t.id} 
                            className="p-4 bg-surface-elevated/35 border border-border rounded-xl flex flex-col gap-2 transition-all hover:bg-surface-elevated hover:shadow-sm"
                          >
                            <div className="flex justify-between items-start gap-2">
                              <span className="font-bold text-xs text-text-primary truncate">{t.productName}</span>
                              <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold font-mono px-1.5 py-0.5 rounded uppercase
                                ${isReceive ? 'bg-success/10 text-success' : isDamage ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'}
                              `}>
                                {isReceive ? '+' : '-'}{t.quantity}
                              </span>
                            </div>
                            
                            <div className="flex justify-between items-center text-[10px] text-text-secondary">
                              <span className="capitalize">{t.transactionType.toLowerCase()}</span>
                              <span>{mounted ? new Date(t.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                            </div>

                            {/* Source/Destination Meta */}
                            <div className="text-[10px] text-text-secondary mt-0.5 pt-1.5 border-t border-border/30 flex flex-wrap justify-between items-center gap-1">
                              {t.transactionType === 'RECEIVE' || t.transactionType === 'REBRAND_IN' ? (
                                <>
                                  <span>Source</span>
                                  <span className="text-text-primary font-semibold truncate max-w-[180px]">{t.fromEntityName || 'Supplier'}</span>
                                </>
                              ) : t.transactionType === 'ISSUE' ? (
                                <>
                                  <span>Destination</span>
                                  <span className="text-text-primary font-semibold truncate max-w-[180px]">{t.toEntityName || 'Store'}</span>
                                </>
                              ) : t.transactionType === 'RETURN' ? (
                                <>
                                  <span>Returned From</span>
                                  <span className="text-text-primary font-semibold truncate max-w-[180px]">{t.fromEntityName || 'Store'}</span>
                                </>
                              ) : (
                                <>
                                  <span>Location</span>
                                  <span className="text-text-primary font-semibold truncate max-w-[180px]">{t.fromEntityName || 'Warehouse'}</span>
                                </>
                              )}
                            </div>

                            {t.notes && (
                              <p className="text-[10px] text-text-muted italic border-t border-border/20 pt-1.5 mt-0.5">
                                {t.notes}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Logs Pagination Controls */}
            {totalLogPages > 1 && (
              <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-surface-elevated/20 text-[10px] flex-shrink-0 mt-4 rounded-lg">
                <span className="text-text-muted">
                  Showing <strong className="text-text-primary">{logPage * itemsPerPage + 1}</strong> to{" "}
                  <strong className="text-text-primary">
                    {Math.min((logPage + 1) * itemsPerPage, filteredTransactions.length)}
                  </strong> of{" "}
                  <strong className="text-text-primary">{filteredTransactions.length}</strong> logs
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={logPage === 0}
                    onClick={() => setLogPage(prev => Math.max(0, prev - 1))}
                    className="px-2 py-1 bg-surface border border-border hover:bg-surface-elevated disabled:opacity-50 text-text-secondary disabled:hover:bg-surface rounded-md font-semibold transition-all duration-150"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    disabled={logPage === totalLogPages - 1}
                    onClick={() => setLogPage(prev => Math.min(totalLogPages - 1, prev + 1))}
                    className="px-2 py-1 bg-surface border border-border hover:bg-surface-elevated disabled:opacity-50 text-text-secondary disabled:hover:bg-surface rounded-md font-semibold transition-all duration-150"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
