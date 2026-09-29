'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Package, Printer, Download, ArrowDownLeft, Store, Shirt, Undo2, ShieldAlert } from 'lucide-react';
import { getOptimizedImageUrl } from '@/lib/imagekit';
import ExportToExcel from '@/components/ExportToExcel';
import { getProductStock } from '@/lib/stock';
import PageHeader from '@/components/PageHeader';
import Pagination from '@/components/Pagination';
import FilterBar from '@/components/FilterBar';
import StockBreakdown from '@/components/StockBreakdown';
import ImageLightbox from '@/components/ImageLightbox';
import AnimatedCounter from '@/components/AnimatedCounter';

export default function ReportsClient({ initialProducts, brands }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [lightboxImage, setLightboxImage] = useState(null); // { url, name }

  // Pagination State
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 25;

  // Reset pagination page on filter/search updates
  React.useEffect(() => {
    setCurrentPage(0);
  }, [searchQuery, selectedBrand, selectedCategory]);

  // Compile products list with computed metrics
  const productsWithStock = initialProducts.map(p => {
    const stock = getProductStock(p.transactions);
    return {
      ...p,
      stock
    };
  });

  // Extract list of distinct categories for filtering
  const categories = Array.from(new Set(initialProducts.map(p => p.category).filter(Boolean))).sort();

  // Filter products by search and selection inputs
  const filteredProducts = productsWithStock.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (p.itemCode && p.itemCode.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesBrand = selectedBrand === 'ALL' || p.brandId === selectedBrand;
    const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
    return matchesSearch && matchesBrand && matchesCategory;
  });

  // Aggregate global metrics across the filtered list
  const aggregateTotals = filteredProducts.reduce((acc, p) => {
    acc.purchased += p.stock.purchased;
    acc.warehouse += p.stock.warehouse;
    acc.issued += p.stock.issued;
    acc.used += p.stock.used;
    acc.damage += p.stock.damage;
    acc.lost += p.stock.lost;
    acc.withClient += p.stock.withClient;
    acc.reBrand += p.stock.reBrand;
    acc.total += p.stock.total;
    return acc;
  }, { purchased: 0, warehouse: 0, issued: 0, used: 0, damage: 0, lost: 0, withClient: 0, reBrand: 0, total: 0 });

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col gap-6 font-sans print:p-0 relative">
      <PageHeader
        icon={Package}
        title="Global Stock Summary Report"
        description="Comprehensive audit report of stock distributions across Warehouse, Outlets, and Staff"
        actions={<>
          <button 
            type="button" 
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-primary hover:bg-primary-hover active:scale-[0.98] text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs hover:shadow transition-all duration-150 cursor-pointer"
          >
            <Printer size={15} />
            <span>Export PDF</span>
          </button>
          <ExportToExcel
            data={filteredProducts.map(p => {
              const stock = getProductStock(p.transactions || []);
              return {
                Product: p.name,
                SKU: p.itemCode || '',
                Brand: p.brand?.name || '',
                Category: p.category || '',
                Purchased: stock.purchased,
                Warehouse: stock.warehouse,
                Issued: stock.issued,
                Used: stock.used,
                Damage: stock.damage,
                Lost: stock.lost,
                'With Client': stock.withClient,
                Rebrand: stock.reBrand,
                'Total Stock': stock.total,
              };
            })}
            columns={[
              { header: 'Product', key: 'Product', width: 25 },
              { header: 'SKU', key: 'SKU', width: 14 },
              { header: 'Brand', key: 'Brand', width: 18 },
              { header: 'Category', key: 'Category', width: 16 },
              { header: 'Purchased', key: 'Purchased', width: 12 },
              { header: 'Warehouse', key: 'Warehouse', width: 12 },
              { header: 'Issued', key: 'Issued', width: 12 },
              { header: 'Used', key: 'Used', width: 12 },
              { header: 'Damage', key: 'Damage', width: 10 },
              { header: 'Lost', key: 'Lost', width: 10 },
              { header: 'With Client', key: 'With Client', width: 12 },
              { header: 'Rebrand', key: 'Rebrand', width: 10 },
              { header: 'Total Stock', key: 'Total Stock', width: 12 },
            ]}
            filename="IML-Stock-Report"
            className="!rounded-xl !px-3.5 !py-2 !text-xs sm:!text-sm !font-semibold !shadow-xs hover:!shadow active:scale-[0.98] !border-border/80"
          />
          <button 
            type="button" 
            onClick={() => {
              const headers = ['Product', 'SKU', 'Brand', 'Category', 'Purchased', 'Warehouse', 'Issued', 'Used', 'Damage', 'Lost', 'With Client', 'Rebrand', 'Total Stock'];
              const rows = filteredProducts.map(p => {
                const stock = getProductStock(p.transactions || []);
                return [p.name, p.itemCode || '', p.brand?.name || '', p.category || '', stock.purchased, stock.warehouse, stock.issued, stock.used, stock.damage, stock.lost, stock.withClient, stock.reBrand, stock.total];
              });
              const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = `IML-Stock-Report-${new Date().toISOString().split('T')[0]}.csv`;
              a.click(); URL.revokeObjectURL(url);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-surface border border-border/80 hover:bg-surface-elevated active:scale-[0.98] text-text-secondary hover:text-text-primary rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 cursor-pointer shadow-xs hover:shadow"
          >
            <Download size={15} />
            <span>Export CSV</span>
          </button>
        </>
      }
      />
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3 print:grid-cols-6 print:gap-1.5">
        {/* 1. Filtered Items */}
        <div className="bg-surface border border-border/80 hover:border-border rounded-xl p-3 sm:p-3.5 shadow-xs hover:shadow-sm transition-all duration-150 flex flex-col justify-between min-w-0 print:p-2 print:border-black print:shadow-none">
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider truncate">
              Items
            </span>
            <div className="w-6 h-6 rounded-md bg-surface-elevated text-text-primary border border-border flex items-center justify-center flex-shrink-0">
              <Package size={12} className="stroke-[2.25]" />
            </div>
          </div>
          <div className="mt-1">
            <span className="text-lg sm:text-xl font-display font-black text-text-primary block tracking-tight tabular-nums print:text-base">
              <AnimatedCounter value={filteredProducts.length} />
            </span>
            <span className="text-[10px] font-medium text-text-muted block mt-0.5 truncate print:hidden">
              Active in catalog
            </span>
          </div>
        </div>

        {/* 2. Warehouse Stock */}
        <div className="bg-surface border border-border/80 hover:border-border rounded-xl p-3 sm:p-3.5 shadow-xs hover:shadow-sm transition-all duration-150 flex flex-col justify-between min-w-0 print:p-2 print:border-black print:shadow-none">
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider truncate">
              Warehouse
            </span>
            <div className="w-6 h-6 rounded-md bg-success/10 text-success border border-success/20 flex items-center justify-center flex-shrink-0">
              <ArrowDownLeft size={12} className="stroke-[2.25]" />
            </div>
          </div>
          <div className="mt-1">
            <span className="text-lg sm:text-xl font-display font-black text-text-primary block tracking-tight tabular-nums print:text-base">
              <AnimatedCounter value={aggregateTotals.warehouse} />
            </span>
            <span className="text-[10px] font-medium text-success block mt-0.5 truncate print:hidden">
              Available central
            </span>
          </div>
        </div>

        {/* 3. Store Outlets */}
        <div className="bg-surface border border-border/80 hover:border-border rounded-xl p-3 sm:p-3.5 shadow-xs hover:shadow-sm transition-all duration-150 flex flex-col justify-between min-w-0 print:p-2 print:border-black print:shadow-none">
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider truncate">
              Stores
            </span>
            <div className="w-6 h-6 rounded-md bg-warning/10 text-warning border border-warning/20 flex items-center justify-center flex-shrink-0">
              <Store size={12} className="stroke-[2.25]" />
            </div>
          </div>
          <div className="mt-1">
            <span className="text-lg sm:text-xl font-display font-black text-text-primary block tracking-tight tabular-nums print:text-base">
              <AnimatedCounter value={aggregateTotals.issued} />
            </span>
            <span className="text-[10px] font-medium text-warning block mt-0.5 truncate print:hidden">
              Distributed outlets
            </span>
          </div>
        </div>

        {/* 4. Promoters / Staff */}
        <div className="bg-surface border border-border/80 hover:border-border rounded-xl p-3 sm:p-3.5 shadow-xs hover:shadow-sm transition-all duration-150 flex flex-col justify-between min-w-0 print:p-2 print:border-black print:shadow-none">
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider truncate">
              Staff
            </span>
            <div className="w-6 h-6 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center flex-shrink-0">
              <Shirt size={12} className="stroke-[2.25]" />
            </div>
          </div>
          <div className="mt-1">
            <span className="text-lg sm:text-xl font-display font-black text-text-primary block tracking-tight tabular-nums print:text-base">
              <AnimatedCounter value={aggregateTotals.used} />
            </span>
            <span className="text-[10px] font-medium text-text-muted block mt-0.5 truncate print:hidden">
              Promoters &amp; staff
            </span>
          </div>
        </div>

        {/* 5. With Clients */}
        <div className="bg-surface border border-border/80 hover:border-border rounded-xl p-3 sm:p-3.5 shadow-xs hover:shadow-sm transition-all duration-150 flex flex-col justify-between min-w-0 print:p-2 print:border-black print:shadow-none">
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider truncate">
              Clients
            </span>
            <div className="w-6 h-6 rounded-md bg-secondary/15 text-secondary border border-secondary/25 flex items-center justify-center flex-shrink-0">
              <Undo2 size={12} className="stroke-[2.25]" />
            </div>
          </div>
          <div className="mt-1">
            <span className="text-lg sm:text-xl font-display font-black text-text-primary block tracking-tight tabular-nums print:text-base">
              <AnimatedCounter value={aggregateTotals.withClient} />
            </span>
            <span className="text-[10px] font-medium text-text-muted block mt-0.5 truncate print:hidden">
              Client custody
            </span>
          </div>
        </div>

        {/* 6. Damaged / Lost */}
        <div className="bg-surface border border-border/80 hover:border-border rounded-xl p-3 sm:p-3.5 shadow-xs hover:shadow-sm transition-all duration-150 flex flex-col justify-between min-w-0 print:p-2 print:border-black print:shadow-none">
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider truncate">
              Damage &amp; Loss
            </span>
            <div className="w-6 h-6 rounded-md bg-danger/10 text-danger border border-danger/20 flex items-center justify-center flex-shrink-0">
              <ShieldAlert size={12} className="stroke-[2.25]" />
            </div>
          </div>
          <div className="mt-1">
            <span className="text-lg sm:text-xl font-display font-black text-danger block tracking-tight tabular-nums print:text-base">
              <AnimatedCounter value={aggregateTotals.damage + aggregateTotals.lost} />
            </span>
            <span className="text-[10px] font-medium text-danger/80 block mt-0.5 truncate print:hidden">
              Total write-offs
            </span>
          </div>
        </div>
      </section>

      <FilterBar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by product name or SKU..."
        filters={[
          { label: 'Brand Owner', value: selectedBrand, onChange: setSelectedBrand, options: [{ value: 'ALL', label: 'All Brands' }, ...brands.map(b => ({ value: b.id, label: b.name }))] },
          { label: 'Category', value: selectedCategory, onChange: setSelectedCategory, options: [{ value: 'ALL', label: 'All Categories' }, ...categories.map(cat => ({ value: cat, label: cat }))] },
        ]}
      />

      {/* Top Pagination */}
      <Pagination
        currentPage={currentPage + 1}
        totalPages={totalPages}
        totalItems={filteredProducts.length}
        itemsPerPage={itemsPerPage}
        onPageChange={(page) => setCurrentPage(page - 1)}
        itemLabel="products"
      />

      {/* Mobile Card View */}
      {filteredProducts.length === 0 ? (
        <div className="md:hidden bg-surface border border-border/80 rounded-2xl shadow-xs text-center py-12 text-sm text-text-secondary italic">
          No products match the selected filters.
        </div>
      ) : (
        <div className="md:hidden flex flex-col gap-3 print:hidden">
          {paginatedProducts.map(p => (
            <div key={p.id} className="bg-surface border border-border/80 rounded-2xl p-4 flex flex-col gap-3 shadow-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {p.imageUrl ? (
                    <img src={getOptimizedImageUrl(p.imageUrl, 80, 80)} alt={p.name} className="w-11 h-11 rounded-xl object-cover border border-border/80 flex-shrink-0 cursor-zoom-in hover:brightness-95 transition-all duration-200" onClick={() => setLightboxImage({ url: p.imageUrl, name: p.name })} />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 border border-primary/20"><Package size={18} /></div>
                  )}
                  <div className="min-w-0">
                    <Link href={`/dashboard/products/${p.id}`} className="font-semibold text-sm text-text-primary block truncate hover:text-primary transition-colors">{p.name}</Link>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-text-muted">{p.brand?.name}</span>
                      <span className="badge bg-surface-elevated text-text-secondary border border-border text-[9px]">{p.category || '---'}</span>
                    </div>
                  </div>
                </div>
                <span className="font-mono font-extrabold text-sm px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20 flex-shrink-0 tabular-nums shadow-xs">{p.stock.total}</span>
              </div>
              <StockBreakdown stock={p.stock} />
            </div>
          ))}
        </div>
      )}

      {/* Desktop Table View */}
      <div className="hidden md:block bg-surface border border-border/80 rounded-2xl shadow-xs overflow-hidden print:p-0 print:border-0 print:shadow-none">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16 text-sm text-text-secondary italic">
            No products match the selected filters.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border/80 print:divide-y-2 print:divide-black text-left">
              <thead>
                <tr className="bg-surface-elevated/40 text-[10px] font-bold text-text-secondary uppercase tracking-wider print:text-[9px] print:text-black">
                  <th className="py-3.5 pl-5 pr-4 whitespace-nowrap sticky left-0 bg-surface-elevated/80 backdrop-blur-sm z-20 border-r border-border/80 shadow-xs print:relative print:bg-transparent print:border-r-0 print:shadow-none">Product Details</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Brand</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Category</th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">Purchased</th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">Warehouse</th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">Issued</th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">Used</th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">Damage</th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">Lost</th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">With Client</th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">Rebrand</th>
                  <th className="py-3.5 pl-4 pr-5 text-center font-bold whitespace-nowrap">Total Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70 text-xs text-text-primary print:divide-y print:divide-gray-400 print:text-[9px]">
                {paginatedProducts.map(p => (
                  <tr key={p.id} className="hover:bg-surface-elevated/30 transition-colors print:hover:bg-transparent">
                    <td className="py-3 pl-5 pr-4 whitespace-nowrap sticky left-0 bg-surface z-10 border-r border-border/80 shadow-xs print:relative print:bg-transparent print:border-r-0 print:shadow-none">
                      <div className="flex items-center gap-3">
                        {p.imageUrl ? (
                          <img 
                            src={getOptimizedImageUrl(p.imageUrl, 80, 80)} 
                            alt={p.name} 
                            className="w-9 h-9 rounded-lg object-cover border border-border/80 flex-shrink-0 cursor-zoom-in hover:brightness-95 transition-all duration-200 print:w-6 print:h-6 shadow-xs"
                            onClick={() => setLightboxImage({ url: p.imageUrl, name: p.name })}
                            onError={(e) => {
                              if (e.target.src !== p.imageUrl) {
                                e.target.src = p.imageUrl;
                              }
                            }}
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 border border-primary/20 print:hidden">
                            <Package size={15} />
                          </div>
                        )}
                        <div className="flex flex-col min-w-0 max-w-[220px]">
                          <Link href={`/dashboard/products/${p.id}`} className="font-semibold text-text-primary print:font-bold truncate hover:text-primary transition-colors">{p.name}</Link>
                          <span className="text-[10px] text-text-muted mt-0.5 font-mono print:text-[8px] truncate">
                            SKU: {p.itemCode || '---'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-medium text-text-secondary">{p.brand?.name || '---'}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-surface-elevated/80 border border-border/70 text-text-secondary print:border-0 print:bg-transparent print:p-0">
                        {p.category || '---'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-medium text-text-secondary whitespace-nowrap tabular-nums">{p.stock.purchased}</td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-text-primary whitespace-nowrap tabular-nums">{p.stock.warehouse}</td>
                    <td className="py-3 px-4 text-center font-mono font-medium text-text-secondary whitespace-nowrap tabular-nums">{p.stock.issued}</td>
                    <td className="py-3 px-4 text-center font-mono font-medium text-text-secondary whitespace-nowrap tabular-nums">{p.stock.used}</td>
                    <td className="py-3 px-4 text-center whitespace-nowrap tabular-nums">
                      {p.stock.damage > 0 ? (
                        <span className="inline-block font-mono font-bold text-danger bg-danger/10 px-2 py-0.5 rounded-md border border-danger/20">{p.stock.damage}</span>
                      ) : (
                        <span className="font-mono text-text-muted/40 font-normal">0</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap tabular-nums">
                      {p.stock.lost > 0 ? (
                        <span className="inline-block font-mono font-bold text-danger bg-danger/10 px-2 py-0.5 rounded-md border border-danger/20">{p.stock.lost}</span>
                      ) : (
                        <span className="font-mono text-text-muted/40 font-normal">0</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap tabular-nums">
                      {p.stock.withClient > 0 ? (
                        <span className="font-mono font-bold text-primary">{p.stock.withClient}</span>
                      ) : (
                        <span className="font-mono text-text-muted/40 font-normal">0</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap tabular-nums">
                      {p.stock.reBrand > 0 ? (
                        <span className="font-mono font-bold text-secondary">{p.stock.reBrand}</span>
                      ) : (
                        <span className="font-mono text-text-muted/40 font-normal">0</span>
                      )}
                    </td>
                    <td className="py-3 pl-4 pr-5 text-center whitespace-nowrap tabular-nums">
                      <span className="inline-block font-mono font-extrabold text-xs px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20 shadow-xs">
                        {p.stock.total}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          </>
        )}
      </div>

      <Pagination
        currentPage={currentPage + 1}
        totalPages={totalPages}
        totalItems={filteredProducts.length}
        itemsPerPage={itemsPerPage}
        onPageChange={(page) => setCurrentPage(page - 1)}
        itemLabel="products"
      />

      <ImageLightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />
    </div>
  );
}
