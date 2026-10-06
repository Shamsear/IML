'use client';

import React, { useState, useMemo } from 'react';
import { Package, QrCode, Search, ListTree, ChevronDown, ChevronRight, Layers, FileSpreadsheet, X } from 'lucide-react';
import { getOptimizedImageUrl } from '@/lib/imagekit';
import { getProductStock } from '@/lib/stock';
import StockBreakdown from '@/components/StockBreakdown';
import ImageLightbox from '@/components/ImageLightbox';
import SortableHeader from '@/components/SortableHeader';
import { useTableSort } from '@/hooks/useTableSort';

export default function BrandPortalClient({ brand }) {
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'catalog'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [summarySearch, setSummarySearch] = useState('');
  const [lightboxImage, setLightboxImage] = useState(null); // { url, name }
  const [expandedSections, setExpandedSections] = useState({}); // Default all collapsed

  // Pagination States for Catalog
  const [productPage, setProductPage] = useState(0);
  const itemsPerPage = 24;

  // Reset pages on search/filter changes
  React.useEffect(() => {
    setProductPage(0);
  }, [searchQuery, selectedCategory]);

  // Helper to compute stock with serialized status reconciliation
  const computeProductStock = (p) => {
    const stock = getProductStock(p.transactions);
    if (p.isSerialized && p.serialStats) {
      stock.warehouse = p.serialStats.warehouse;
      stock.withClient = p.serialStats.withClient;
      stock.damage = p.serialStats.damage;
      stock.lost = p.serialStats.lost;
      stock.issued = p.serialStats.issued;
      stock.used = p.serialStats.used;
      stock.total = stock.warehouse;
    }
    return stock;
  };

  // Product map for quick lookup by id
  const productMap = useMemo(() => {
    const map = new Map();
    (brand?.products || []).forEach(p => map.set(p.id, p));
    return map;
  }, [brand?.products]);

  // Parse or Auto-generate Portal Summary Sections
  const summarySections = useMemo(() => {
    let parsedConfig = null;
    if (brand?.portalConfig) {
      try {
        parsedConfig = typeof brand.portalConfig === 'string' 
          ? JSON.parse(brand.portalConfig) 
          : brand.portalConfig;
      } catch (e) {
        console.error('Failed to parse portalConfig:', e);
      }
    }

    const q = summarySearch.trim().toLowerCase();

    // If custom headings config exists
    if (parsedConfig && Array.isArray(parsedConfig.headings) && parsedConfig.headings.length > 0) {
      return parsedConfig.headings.map(h => {
        const items = (h.productIds || [])
          .map(pid => productMap.get(pid))
          .filter(Boolean)
          .map(p => {
            const stock = computeProductStock(p);
            const remark = stock.damage > 0 ? `${stock.damage} Damaged` : '';
            const stockLevel = stock.warehouse > 0 ? 'AVAILABLE' : 'NOT AVAILABLE';

            return {
              product: p,
              availableQty: Math.round(stock.warehouse),
              stockLevel,
              remark,
              stock,
            };
          })
          .filter(({ product: p, remark }) => {
            if (!q) return true;
            return p.name.toLowerCase().includes(q) || 
              (p.itemCode && p.itemCode.toLowerCase().includes(q)) ||
              (remark && remark.toLowerCase().includes(q));
          });

        return {
          id: h.id || h.title,
          title: h.title,
          items,
        };
      }).filter(h => h.items.length > 0 || !q);
    }

    // Default Fallback: Auto-group by Product Category
    const categoryGroups = {};
    (brand?.products || []).forEach(p => {
      const cat = (p.category || 'OTHERS').toUpperCase().trim();
      if (!categoryGroups[cat]) categoryGroups[cat] = [];
      categoryGroups[cat].push(p);
    });

    return Object.keys(categoryGroups).sort().map(cat => {
      const prods = categoryGroups[cat]
        .map(p => {
          const stock = computeProductStock(p);
          const stockLevel = stock.warehouse > 0 ? 'AVAILABLE' : 'NOT AVAILABLE';
          const remark = stock.damage > 0 ? `${stock.damage} Damaged` : '';

          return {
            product: p,
            availableQty: Math.round(stock.warehouse),
            stockLevel,
            remark,
            stock,
          };
        })
        .filter(({ product: p, remark }) => {
          if (!q) return true;
          return p.name.toLowerCase().includes(q) || 
            (p.itemCode && p.itemCode.toLowerCase().includes(q)) ||
            (remark && remark.toLowerCase().includes(q));
        });

      return {
        id: cat,
        title: cat,
        items: prods,
      };
    }).filter(h => h.items.length > 0);
  }, [brand?.portalConfig, brand?.products, productMap, summarySearch]);

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const toggleAllSections = (expand) => {
    const next = {};
    summarySections.forEach(s => {
      next[s.id] = expand;
    });
    setExpandedSections(next);
  };

  // Extract unique categories for this brand
  const uniqueCategories = useMemo(() => {
    const set = new Set();
    (brand?.products || []).forEach(p => {
      if (p.category && p.category.trim()) {
        set.add(p.category.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [brand?.products]);

  // Filter products by search query and category filter for Catalog Tab
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (brand?.products || []).filter(p => {
      const matchesSearch = !q || p.name.toLowerCase().includes(q) ||
        (p.itemCode && p.itemCode.toLowerCase().includes(q));
      
      const matchesCategory = selectedCategory === 'ALL' ||
        (p.category && p.category.trim().toLowerCase() === selectedCategory.toLowerCase());
        
      return matchesSearch && matchesCategory;
    });
  }, [brand?.products, searchQuery, selectedCategory]);

  const customGetters = useMemo(() => ({
    name: (p) => p.name || '',
    itemCode: (p) => p.itemCode || '',
    category: (p) => p.category || '',
    purchased: (p) => computeProductStock(p).purchased,
    warehouse: (p) => computeProductStock(p).warehouse,
    issued: (p) => computeProductStock(p).issued,
    used: (p) => computeProductStock(p).used,
    damage: (p) => computeProductStock(p).damage,
    lost: (p) => computeProductStock(p).lost,
    withClient: (p) => computeProductStock(p).withClient,
    reBrand: (p) => computeProductStock(p).reBrand,
    total: (p) => computeProductStock(p).total,
    stockStatus: (p) => {
      const s = computeProductStock(p);
      return s.total > 0 ? (s.warehouse > 0 ? 2 : 1) : 0;
    },
  }), []);

  const {
    items: sortedProducts,
    sortField,
    sortDirection,
    handleSort,
  } = useTableSort(filteredProducts, {
    defaultSortField: 'name',
    defaultSortDirection: 'asc',
    customGetters,
  });

  const totalProductPages = Math.ceil(sortedProducts.length / itemsPerPage);
  const paginatedProducts = sortedProducts.slice(productPage * itemsPerPage, (productPage + 1) * itemsPerPage);

  return (
    <div className="min-h-[100dvh] bg-background text-text-primary py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-[1920px] w-full mx-auto flex flex-col gap-6">
        
        {/* Portal Branding Header */}
        <header className="bg-surface border border-border p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-center sm:text-left flex-col sm:flex-row">
            {brand.imageUrl ? (
              <div className="relative group">
                <img 
                  src={getOptimizedImageUrl(brand.imageUrl, 150, 150)} 
                  alt={brand.name} 
                  className="w-16 h-16 rounded-lg object-cover border border-border ring-1 ring-inset ring-black/10 dark:ring-white/10 cursor-pointer hover:border-primary transition-colors"
                  onClick={() => setLightboxImage({ url: brand.imageUrl, name: brand.name })}
                  onError={(e) => {
                    if (e.target.src !== brand.imageUrl) {
                      e.target.src = brand.imageUrl;
                    }
                  }}
                />
              </div>
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
                <span className="inline-flex items-center gap-1.5 bg-success/10 text-success text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border border-success/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-success"></span> Live Data
                </span>
              </div>
              <p className="text-text-secondary text-sm mt-1">
                Real-time warehouse inventory summary &amp; product catalog.
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

        {/* Tab Selector */}
        <div className="flex border-b border-border gap-6">
          <button 
            type="button"
            onClick={() => setActiveTab('summary')} 
            className={`pb-3 font-display font-bold text-sm sm:text-base relative flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'summary' ? 'text-primary' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <ListTree size={18} />
            <span>Stock Summary</span>
            {activeTab === 'summary' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
          </button>

          <button 
            type="button"
            onClick={() => setActiveTab('catalog')} 
            className={`pb-3 font-display font-bold text-sm sm:text-base relative flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'catalog' ? 'text-primary' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Package size={18} />
            <span>Product Catalog</span>
            {activeTab === 'catalog' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: STOCK SUMMARY (Categorized Headings format like Excel)             */}
        {/* ========================================================================= */}
        {activeTab === 'summary' && (
          <div className="flex flex-col gap-5">
            {/* Top Toolbar */}
            <div className="bg-surface border border-border p-4 rounded-xl shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={14} />
                <input
                  type="text"
                  placeholder="Filter items across summary headings..."
                  value={summarySearch}
                  onChange={(e) => setSummarySearch(e.target.value)}
                  className="w-full bg-surface-elevated/45 text-text-primary placeholder:text-text-muted border border-border rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-primary transition-colors"
                />
                {summarySearch && (
                  <button onClick={() => setSummarySearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
                    <X size={13} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto text-xs">
                <button
                  type="button"
                  onClick={() => toggleAllSections(true)}
                  className="px-2.5 py-1.5 bg-surface-elevated/60 hover:bg-surface-elevated border border-border rounded-lg text-text-secondary font-semibold transition-colors cursor-pointer"
                >
                  Expand All
                </button>
                <button
                  type="button"
                  onClick={() => toggleAllSections(false)}
                  className="px-2.5 py-1.5 bg-surface-elevated/60 hover:bg-surface-elevated border border-border rounded-lg text-text-secondary font-semibold transition-colors cursor-pointer"
                >
                  Collapse All
                </button>
              </div>
            </div>

            {/* Sections Container */}
            {summarySections.length === 0 ? (
              <div className="py-16 text-center text-xs text-text-muted italic bg-surface rounded-2xl border border-dashed border-border">
                No items found matching your filter criteria.
              </div>
            ) : (
              summarySections.map(section => {
                const isExpanded = summarySearch.trim() ? true : !!expandedSections[section.id];
                const sectionTotalQty = Math.round(
                  section.items.reduce((sum, it) => sum + (Number(it.availableQty) || 0), 0)
                );
                return (
                  <div key={section.id} className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden transition-colors">
                    {/* Section Heading Bar */}
                    <button
                      type="button"
                      onClick={() => toggleSection(section.id)}
                      className={`w-full px-5 py-3.5 bg-surface-elevated/40 hover:bg-surface-elevated/70 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer select-none ${
                        isExpanded ? 'border-b border-border' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {isExpanded ? <ChevronDown size={16} className="text-primary shrink-0 transition-transform duration-150" /> : <ChevronRight size={16} className="text-text-muted shrink-0 transition-transform duration-150" />}
                        <h3 className="font-display font-extrabold text-sm sm:text-base text-text-primary uppercase tracking-wide truncate">
                          {section.title}
                        </h3>
                        <span className="text-[11px] font-bold text-text-muted bg-surface-elevated px-2 py-0.5 rounded-full border border-border/60">
                          {sectionTotalQty} {sectionTotalQty === 1 ? 'item' : 'items'}
                        </span>
                      </div>
                    </button>

                    {/* Section Items Table / Card Content */}
                    {isExpanded && (
                      <div className="overflow-x-auto animate-fade-in">
                        {section.items.length === 0 ? (
                          <div className="py-6 text-center text-xs text-text-muted italic">
                            No products assigned to this heading.
                          </div>
                        ) : (
                          <>
                            {/* Mobile Card List */}
                            <div className="md:hidden divide-y divide-border">
                              {section.items.map(({ product: p, availableQty, stockLevel, remark }) => (
                                <div key={p.id} className="p-4 flex flex-col gap-2 hover:bg-surface-elevated/20 transition-colors">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      {p.imageUrl ? (
                                        <img 
                                          src={getOptimizedImageUrl(p.imageUrl, 80, 80)} 
                                          alt={p.name} 
                                          className="w-9 h-9 rounded object-cover border border-border shrink-0 cursor-pointer"
                                          onClick={() => setLightboxImage({ url: p.imageUrl, name: p.name })}
                                        />
                                      ) : (
                                        <div className="w-9 h-9 rounded bg-primary/5 text-primary flex items-center justify-center text-[10px] font-bold border border-primary/10 shrink-0">
                                          {p.name.substring(0, 2).toUpperCase()}
                                        </div>
                                      )}
                                      <div className="min-w-0 flex-1">
                                        <span className="font-bold text-xs text-text-primary block break-words leading-snug">{p.name}</span>
                                        <span className="text-[10px] font-mono text-text-muted">{p.itemCode || '---'}</span>
                                      </div>
                                    </div>

                                    <span className={`inline-flex px-2 py-0.5 text-[9px] font-bold uppercase rounded shrink-0 border ${
                                      stockLevel === 'AVAILABLE'
                                        ? 'bg-success/10 text-success border-success/20'
                                        : 'bg-danger/10 text-danger border-danger/20'
                                    }`}>
                                      {stockLevel}
                                    </span>
                                  </div>

                                  <div className="flex items-center justify-between text-xs bg-surface-elevated/40 px-3 py-2 rounded-lg border border-border/60">
                                    <span className="text-[10px] text-text-muted font-medium">Available in Warehouse</span>
                                    <span className="font-mono font-bold text-success text-sm">{availableQty}</span>
                                  </div>

                                  {remark && (
                                    <div className="flex items-center justify-between text-xs bg-danger/5 border border-danger/15 px-3 py-1.5 rounded-lg">
                                      <span className="text-[10px] text-danger font-medium uppercase tracking-wider">Remarks</span>
                                      <span className="font-semibold text-danger text-xs">{remark}</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>

                            {/* Desktop Table View */}
                            <table className="min-w-full divide-y divide-border hidden md:table">
                              <thead>
                                <tr className="text-left text-[10px] font-bold text-text-secondary uppercase tracking-wider bg-surface-elevated/20">
                                  <th className="py-2.5 px-4">Item Description</th>
                                  <th className="py-2.5 px-4 text-center w-28">Available Qty</th>
                                  <th className="py-2.5 px-4 text-center w-32">Stock Level</th>
                                  <th className="py-2.5 px-4">Remarks</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border text-xs">
                                {section.items.map(({ product: p, availableQty, stockLevel, remark }) => (
                                  <tr key={p.id} className="hover:bg-surface-elevated/20 transition-colors">
                                    <td className="py-2.5 px-4 min-w-[200px]">
                                      <div className="flex items-center gap-3 min-w-0">
                                        {p.imageUrl ? (
                                          <img 
                                            src={getOptimizedImageUrl(p.imageUrl, 80, 80)} 
                                            alt={p.name} 
                                            className="w-7 h-7 rounded object-cover border border-border shrink-0 cursor-pointer hover:border-primary transition-all"
                                            onClick={() => setLightboxImage({ url: p.imageUrl, name: p.name })}
                                            onError={(e) => { if (e.target.src !== p.imageUrl) e.target.src = p.imageUrl; }}
                                          />
                                        ) : (
                                          <div className="w-7 h-7 rounded bg-primary/5 text-primary flex items-center justify-center font-display font-bold text-[9px] border border-primary/10 shrink-0">
                                            {p.name.substring(0, 2).toUpperCase()}
                                          </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                          <span className="font-semibold text-text-primary block break-words leading-snug">{p.name}</span>
                                          <span className="text-[10px] font-mono text-text-muted">{p.itemCode || '---'}</span>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-2.5 px-4 text-center font-mono font-bold text-text-primary">
                                      <span className={availableQty > 0 ? 'text-success font-extrabold' : 'text-text-muted'}>
                                        {availableQty}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-4 text-center">
                                      <span className={`inline-flex px-2 py-0.5 text-[9px] font-bold uppercase rounded border ${
                                        stockLevel === 'AVAILABLE'
                                          ? 'bg-success/10 text-success border-success/20'
                                          : 'bg-danger/10 text-danger border-danger/20'
                                      }`}>
                                        {stockLevel}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-4 text-xs text-text-secondary max-w-xs truncate" title={remark || ''}>
                                      {remark || '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: PRODUCT CATALOG (Full Operational Stock Breakdown Table)           */}
        {/* ========================================================================= */}
        {activeTab === 'catalog' && (
          <div className="bg-surface border border-border p-5 rounded-2xl shadow-sm flex flex-col gap-4">
            <div className="flex flex-col gap-3 border-b border-border pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Package size={20} className="text-primary" />
                  <h3 className="font-display font-bold text-lg text-text-primary">
                    Product Catalog &amp; Stock Levels
                  </h3>
                </div>
                
                {/* Search Bar */}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={14} />
                  <input
                    type="text"
                    placeholder="Search products by name, SKU..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-surface-elevated/45 text-text-primary placeholder:text-text-muted border border-border rounded-lg pl-9 pr-8 py-1.5 text-xs focus:outline-none focus:border-primary transition-colors"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary cursor-pointer"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Category Filter Pills */}
              {uniqueCategories.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('ALL')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                      selectedCategory === 'ALL'
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-surface-elevated/70 text-text-secondary hover:text-text-primary hover:bg-surface-elevated border border-border/60'
                    }`}
                  >
                    All ({brand?.products?.length || 0})
                  </button>
                  {uniqueCategories.map(cat => {
                    const count = (brand?.products || []).filter(p => p.category?.trim().toLowerCase() === cat.toLowerCase()).length;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                          selectedCategory.toLowerCase() === cat.toLowerCase()
                            ? 'bg-primary text-white shadow-sm'
                            : 'bg-surface-elevated/70 text-text-secondary hover:text-text-primary hover:bg-surface-elevated border border-border/60'
                        }`}
                      >
                        <span>{cat}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                          selectedCategory.toLowerCase() === cat.toLowerCase()
                            ? 'bg-white/20 text-white'
                            : 'bg-surface text-text-muted border border-border/40'
                        }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {filteredProducts.length === 0 ? (
              <div className="py-12 text-center text-xs text-text-muted italic bg-surface-elevated/10 rounded-xl border border-dashed border-border">
                No catalog items found matching your filter criteria.
              </div>
            ) : (
              <>
                {/* Top Product Pagination */}
                {totalProductPages > 1 && (
                  <div className="flex items-center justify-between px-3 py-2 border border-border bg-surface-elevated/20 text-[10px] mb-2 rounded-lg print:hidden">
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
                        className="px-2 py-1 bg-surface border border-border hover:bg-surface-elevated disabled:opacity-50 text-text-secondary disabled:hover:bg-surface rounded-md font-semibold transition-colors duration-150 cursor-pointer"
                      >
                        Prev
                      </button>
                      <button
                        type="button"
                        disabled={productPage === totalProductPages - 1}
                        onClick={() => setProductPage(prev => Math.min(totalProductPages - 1, prev + 1))}
                        className="px-2 py-1 bg-surface border border-border hover:bg-surface-elevated disabled:opacity-50 text-text-secondary disabled:hover:bg-surface rounded-md font-semibold transition-colors duration-150 cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}

                {/* Mobile Card View */}
                <div className="md:hidden flex flex-col gap-3">
                  {paginatedProducts.map(p => {
                    const stock = computeProductStock(p);
                    return (
                      <div key={p.id} className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {p.imageUrl ? (
                              <img src={getOptimizedImageUrl(p.imageUrl, 80, 80)} alt={p.name} className="w-10 h-10 rounded-sm object-cover border border-border flex-shrink-0 cursor-zoom-in hover:brightness-95 transition-all duration-200" onClick={() => setLightboxImage({ url: p.imageUrl, name: p.name })} />
                            ) : (
                              <div className="w-10 h-10 rounded-sm bg-primary/5 text-primary flex items-center justify-center flex-shrink-0 text-[10px] font-bold border border-primary/10">{p.name.substring(0, 2).toUpperCase()}</div>
                            )}
                            <div className="min-w-0 flex-1">
                              <span className="font-semibold text-sm text-text-primary block break-words leading-snug">{p.name}</span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-text-muted font-mono">{p.itemCode || '---'}</span>
                                <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${p.isSerialized ? 'bg-primary/10 text-primary' : 'bg-surface-elevated text-text-secondary'}`}>{p.category || 'Bulk'}</span>
                              </div>
                            </div>
                          </div>
                          <span className="font-mono font-extrabold text-lg text-primary flex-shrink-0">{stock.total}</span>
                        </div>
                        <StockBreakdown stock={stock} compact />
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-border">
                    <thead>
                      <tr className="text-left text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                        <SortableHeader field="name" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} className="pb-2.5 px-3 whitespace-nowrap sticky left-0 bg-surface z-10 border-r border-border shadow-sm">Item Description</SortableHeader>
                        <SortableHeader field="itemCode" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} className="pb-2.5 px-3 whitespace-nowrap">Item Code</SortableHeader>
                        <SortableHeader field="category" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} className="pb-2.5 px-3 whitespace-nowrap">Item Category</SortableHeader>
                        <SortableHeader field="purchased" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} align="center" className="pb-2.5 px-3 whitespace-nowrap">Purchased / Received</SortableHeader>
                        <SortableHeader field="warehouse" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} align="center" className="pb-2.5 px-3 whitespace-nowrap">Available In Warehouse</SortableHeader>
                        <SortableHeader field="issued" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} align="center" className="pb-2.5 px-3 whitespace-nowrap">Issued</SortableHeader>
                        <SortableHeader field="used" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} align="center" className="pb-2.5 px-3 whitespace-nowrap">Used</SortableHeader>
                        <SortableHeader field="damage" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} align="center" className="pb-2.5 px-3 whitespace-nowrap text-danger">Damage</SortableHeader>
                        <SortableHeader field="lost" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} align="center" className="pb-2.5 px-3 whitespace-nowrap text-danger">Lost / Not Found</SortableHeader>
                        <SortableHeader field="withClient" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} align="center" className="pb-2.5 px-3 whitespace-nowrap text-primary">With Client</SortableHeader>
                        <SortableHeader field="reBrand" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} align="center" className="pb-2.5 px-3 whitespace-nowrap text-secondary">Re Brand</SortableHeader>
                        <SortableHeader field="total" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} align="center" className="pb-2.5 px-3 whitespace-nowrap font-bold">Total</SortableHeader>
                        <SortableHeader field="stockStatus" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} align="center" className="pb-2.5 px-3 whitespace-nowrap">Stock Status</SortableHeader>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-xs text-text-primary">
                      {paginatedProducts.map(p => {
                        const stock = computeProductStock(p);
                        return (
                          <tr key={p.id} className="hover:bg-surface-elevated/20 transition-colors">
                            <td className="py-3 px-3 min-w-[220px] sticky left-0 bg-surface z-10 border-r border-border shadow-sm">
                              <div className="flex items-center gap-3">
                                {p.imageUrl ? (
                                  <img 
                                    src={getOptimizedImageUrl(p.imageUrl, 80, 80)} 
                                    alt={p.name} 
                                    className="w-8 h-8 rounded-sm object-cover border border-border cursor-pointer hover:border-primary transition-all flex-shrink-0"
                                    onClick={() => setLightboxImage({ url: p.imageUrl, name: p.name })}
                                    onError={(e) => {
                                      if (e.target.src !== p.imageUrl) {
                                        e.target.src = p.imageUrl;
                                      }
                                    }}
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-sm bg-primary/5 text-primary flex items-center justify-center font-display font-extrabold text-[10px] border border-primary/10 flex-shrink-0">
                                    {p.name.substring(0, 2).toUpperCase()}
                                  </div>
                                )}
                                <div className="flex flex-col min-w-0">
                                  <span className="font-semibold text-text-primary break-words leading-snug">{p.name}</span>
                                  {p.isSerialized && (
                                    <span className="text-[10px] font-semibold text-primary mt-0.5">
                                      <QrCode size={10} className="inline mr-1"/>
                                      {p.category?.toUpperCase().includes('ROUTER') ? 'Router' : 'SIM'} ({p._count?.serialNumbers || 0})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <code className="text-[10px] bg-surface-elevated px-1.5 py-0.5 rounded border border-border">{p.itemCode || '---'}</code>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase
                                ${p.isSerialized ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-surface-elevated text-text-secondary border border-border'}
                              `}>
                                {p.category || 'Bulk'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center font-mono font-semibold whitespace-nowrap">{stock.purchased}</td>
                            <td className="py-3 px-3 text-center font-mono font-semibold whitespace-nowrap">{stock.warehouse}</td>
                            <td className="py-3 px-3 text-center font-mono font-semibold whitespace-nowrap">{stock.issued}</td>
                            <td className="py-3 px-3 text-center font-mono font-semibold whitespace-nowrap">{stock.used}</td>
                            <td className="py-3 px-3 text-center font-mono font-semibold whitespace-nowrap text-danger">{stock.damage}</td>
                            <td className="py-3 px-3 text-center font-mono font-semibold whitespace-nowrap text-danger">{stock.lost}</td>
                            <td className="py-3 px-3 text-center font-mono font-semibold whitespace-nowrap text-primary">{stock.withClient}</td>
                            <td className="py-3 px-3 text-center font-mono font-semibold whitespace-nowrap text-secondary">{stock.reBrand}</td>
                            <td className="py-3 px-3 text-center font-mono font-bold whitespace-nowrap">{stock.total}</td>
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              {stock.warehouse <= 0 ? (
                                <span className="inline-flex items-center px-2 py-0.5 text-[9px] font-bold bg-danger/10 text-danger border border-danger/20 rounded-full font-mono">
                                  Out of Stock
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 text-[9px] font-bold bg-success/10 text-success border border-success/20 rounded-full font-mono">
                                  Available
                                </span>
                              )}
                            </td>
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
                        className="px-2 py-1 bg-surface border border-border hover:bg-surface-elevated disabled:opacity-50 text-text-secondary disabled:hover:bg-surface rounded-md font-semibold transition-colors duration-150 cursor-pointer"
                      >
                        Prev
                      </button>
                      <button
                        type="button"
                        disabled={productPage === totalProductPages - 1}
                        onClick={() => setProductPage(prev => Math.min(totalProductPages - 1, prev + 1))}
                        className="px-2 py-1 bg-surface border border-border hover:bg-surface-elevated disabled:opacity-50 text-text-secondary disabled:hover:bg-surface rounded-md font-semibold transition-colors duration-150 cursor-pointer"
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

      </div>

      <ImageLightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />
    </div>
  );
}
