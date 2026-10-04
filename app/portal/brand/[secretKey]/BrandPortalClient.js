'use client';

import React, { useState, useMemo } from 'react';
import { Package, QrCode, Search, X } from 'lucide-react';
import { getOptimizedImageUrl } from '@/lib/imagekit';
import { getProductStock } from '@/lib/stock';
import StockBreakdown from '@/components/StockBreakdown';
import ImageLightbox from '@/components/ImageLightbox';
import SortableHeader from '@/components/SortableHeader';
import { useTableSort } from '@/hooks/useTableSort';

export default function BrandPortalClient({ brand }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [productTypeFilter, setProductTypeFilter] = useState('ALL');
  const [lightboxImage, setLightboxImage] = useState(null); // { url, name }

  // Pagination States
  const [productPage, setProductPage] = useState(0);
  const itemsPerPage = 24;

  // Reset pages on search/filter changes
  React.useEffect(() => {
    setProductPage(0);
  }, [searchQuery, productTypeFilter]);

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

  // Filter products by search query and type filter
  const filteredProducts = (brand?.products || []).filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.itemCode && p.itemCode.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesType = productTypeFilter === 'ALL' ||
      (productTypeFilter === 'SERIALIZED' && p.isSerialized) ||
      (productTypeFilter === 'BULK' && !p.isSerialized);
      
    return matchesSearch && matchesType;
  });

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
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        
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
                Real-time central warehouse stock catalog and inventory levels.
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

        {/* Catalog Section */}
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
                      className="px-2 py-1 bg-surface border border-border hover:bg-surface-elevated disabled:opacity-50 text-text-secondary disabled:hover:bg-surface rounded-md font-semibold transition-colors duration-150"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      disabled={productPage === totalProductPages - 1}
                      onClick={() => setProductPage(prev => Math.min(totalProductPages - 1, prev + 1))}
                      className="px-2 py-1 bg-surface border border-border hover:bg-surface-elevated disabled:opacity-50 text-text-secondary disabled:hover:bg-surface rounded-md font-semibold transition-colors duration-150"
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
                          <div className="min-w-0">
                            <span className="font-semibold text-sm text-text-primary block truncate">{p.name}</span>
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
                          <td className="py-3 px-3 whitespace-nowrap sticky left-0 bg-surface z-10 border-r border-border shadow-sm">
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
                                <span className="font-semibold text-text-primary truncate">{p.name}</span>
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
                            {p.stockCap ? (
                              stock.warehouse <= 0 ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold bg-danger/10 text-danger border border-danger/20 rounded-full font-mono">
                                  Out
                                </span>
                              ) : stock.warehouse < p.stockCap ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold bg-warning/10 text-warning border border-warning/20 rounded-full font-mono animate-pulse">
                                  Low
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold bg-success/10 text-success border border-success/20 rounded-full font-mono">
                                  Ok
                                </span>
                              )
                            ) : (
                              <span className="text-text-muted text-[10px]">---</span>
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
                      className="px-2 py-1 bg-surface border border-border hover:bg-surface-elevated disabled:opacity-50 text-text-secondary disabled:hover:bg-surface rounded-md font-semibold transition-colors duration-150"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      disabled={productPage === totalProductPages - 1}
                      onClick={() => setProductPage(prev => Math.min(totalProductPages - 1, prev + 1))}
                      className="px-2 py-1 bg-surface border border-border hover:bg-surface-elevated disabled:opacity-50 text-text-secondary disabled:hover:bg-surface rounded-md font-semibold transition-colors duration-150"
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
