'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Package, Printer, Download } from 'lucide-react';
import { getOptimizedImageUrl } from '@/lib/imagekit';
import ExportToExcel from '@/components/ExportToExcel';
import { getProductStock } from '@/lib/stock';
import PageHeader from '@/components/PageHeader';
import Pagination from '@/components/Pagination';
import FilterBar from '@/components/FilterBar';
import StockBreakdown from '@/components/StockBreakdown';
import ImageLightbox from '@/components/ImageLightbox';

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
      <div className="absolute top-0 right-0 pointer-events-none opacity-5 overflow-hidden print:hidden">
        <Package size={250} />
      </div>
      
      <PageHeader
        icon={Package}
        title="Global Stock Summary Report"
        description="Comprehensive audit report of stock distributions across Warehouse, Outlets, and Staff"
        actions={<>
          <button 
            type="button" 
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-bold shadow-md hover:shadow-lg transition-all duration-200"
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
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-sm font-bold transition-all duration-200"
          >
            <Download size={15} />
            <span>Export CSV</span>
          </button>
        </>
      }
      />
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 print:grid-cols-6 print:gap-1.5">
        <div className="bg-surface border border-border p-4 rounded-xl shadow-sm print:shadow-none print:border-black print:p-3">
          <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider print:text-[8px] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-text-primary"></span> Filtered Items
          </span>
          <span className="text-xl font-display font-black text-text-primary mt-1.5 block print:text-lg">
            {filteredProducts.length}
          </span>
        </div>

        <div className="bg-surface border border-border p-4 rounded-xl shadow-sm print:shadow-none print:border-black print:p-3">
          <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider print:text-[8px] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-success"></span> Warehouse
          </span>
          <span className="text-xl font-display font-black text-success mt-1.5 block print:text-lg">
            {aggregateTotals.warehouse}
          </span>
        </div>

        <div className="bg-surface border border-border p-4 rounded-xl shadow-sm print:shadow-none print:border-black print:p-3">
          <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider print:text-[8px] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-warning"></span> Store Outlets
          </span>
          <span className="text-xl font-display font-black text-warning mt-1.5 block print:text-lg">
            {aggregateTotals.issued}
          </span>
        </div>

        <div className="bg-surface border border-border p-4 rounded-xl shadow-sm print:shadow-none print:border-black print:p-3">
          <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider print:text-[8px] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary"></span> Promoters/Staff
          </span>
          <span className="text-xl font-display font-black text-primary mt-1.5 block print:text-lg">
            {aggregateTotals.used}
          </span>
        </div>

        <div className="bg-surface border border-border p-4 rounded-xl shadow-sm print:shadow-none print:border-black print:p-3">
          <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider print:text-[8px] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/70"></span> With Clients
          </span>
          <span className="text-xl font-display font-black text-primary/80 mt-1.5 block print:text-lg">
            {aggregateTotals.withClient}
          </span>
        </div>

        <div className="bg-surface border border-border p-4 rounded-xl shadow-sm print:shadow-none print:border-black print:p-3">
          <span className="text-[10px] font-bold text-danger uppercase tracking-wider print:text-[8px] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse"></span> Damaged / Lost
          </span>
          <span className="text-xl font-display font-black text-danger mt-1.5 block print:text-lg">
            {aggregateTotals.damage + aggregateTotals.lost}
          </span>
        </div>
      </section>

      <FilterBar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by name or SKU..."
        filters={[
          { label: 'Brand Owner', value: selectedBrand, onChange: setSelectedBrand, options: [{ value: 'ALL', label: 'All Brands' }, ...brands.map(b => ({ value: b.id, label: b.name }))] },
          { label: 'Category', value: selectedCategory, onChange: setSelectedCategory, options: [{ value: 'ALL', label: 'All Categories' }, ...categories.map(cat => ({ value: cat, label: cat }))] },
        ]}
      />

      {/* Mobile Card View */}
      {filteredProducts.length === 0 ? (
        <div className="md:hidden bg-surface border border-border rounded-xl shadow-sm text-center py-12 text-sm text-text-secondary italic">
          No products match the selected filters.
        </div>
      ) : (
        <div className="md:hidden flex flex-col gap-3 print:hidden">
          {paginatedProducts.map(p => (
            <div key={p.id} className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {p.imageUrl ? (
                    <img src={getOptimizedImageUrl(p.imageUrl, 80, 80)} alt={p.name} className="w-10 h-10 rounded-sm object-cover border border-border flex-shrink-0 cursor-zoom-in hover:brightness-95 transition-all duration-200" onClick={() => setLightboxImage({ url: p.imageUrl, name: p.name })} />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0"><Package size={18} /></div>
                  )}
                  <div className="min-w-0">
                    <Link href={`/dashboard/products/${p.id}`} className="font-semibold text-sm text-text-primary block truncate hover:text-primary transition-colors">{p.name}</Link>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-text-muted">{p.brand?.name}</span>
                      <span className="badge bg-surface-elevated text-text-secondary border border-border text-[9px]">{p.category || '---'}</span>
                    </div>
                  </div>
                </div>
                <span className="font-mono font-extrabold text-lg text-primary flex-shrink-0">{p.stock.total}</span>
              </div>
              <StockBreakdown stock={p.stock} />
            </div>
          ))}
        </div>
      )}

      {/* Desktop Table View */}
      <div className="hidden md:block bg-surface border border-border rounded-xl p-5 shadow-sm print:p-0 print:border-0 print:shadow-none">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12 text-sm text-text-secondary italic">
            No products match the selected filters.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border print:divide-y-2 print:divide-black">
              <thead>
                <tr className="text-left text-xs font-bold text-text-secondary uppercase tracking-wider print:text-[9px] print:text-black border-b border-border">
                  <th className="pb-3 pr-4 whitespace-nowrap font-semibold sticky left-0 bg-surface z-10 border-r border-border shadow-sm print:relative print:bg-transparent print:border-r-0 print:shadow-none">Product Details</th>
                  <th className="pb-3 px-4 whitespace-nowrap font-semibold">Brand</th>
                  <th className="pb-3 px-4 whitespace-nowrap font-semibold">Category</th>
                  <th className="pb-3 px-4 text-center whitespace-nowrap font-semibold">Purchased</th>
                  <th className="pb-3 px-4 text-center whitespace-nowrap font-semibold">Warehouse</th>
                  <th className="pb-3 px-4 text-center whitespace-nowrap font-semibold">Issued</th>
                  <th className="pb-3 px-4 text-center whitespace-nowrap font-semibold">Used</th>
                  <th className="pb-3 px-4 text-center text-danger whitespace-nowrap font-semibold print:text-black">Damage</th>
                  <th className="pb-3 px-4 text-center text-danger whitespace-nowrap font-semibold print:text-black">Lost</th>
                  <th className="pb-3 px-4 text-center text-primary whitespace-nowrap font-semibold print:text-black">With Client</th>
                  <th className="pb-3 px-4 text-center text-secondary whitespace-nowrap font-semibold print:text-black">Rebrand</th>
                  <th className="pb-3 pl-4 text-center font-bold text-primary whitespace-nowrap print:text-black">Total Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs text-text-primary print:divide-y print:divide-gray-400 print:text-[9px]">
                {paginatedProducts.map(p => (
                  <tr key={p.id} className="hover:bg-surface-elevated/20 transition-colors print:hover:bg-transparent">
                    <td className="py-3.5 pr-4 whitespace-nowrap sticky left-0 bg-surface z-10 border-r border-border shadow-sm print:relative print:bg-transparent print:border-r-0 print:shadow-none">
                      <div className="flex items-center gap-3">
                        {p.imageUrl ? (
                          <img 
                            src={getOptimizedImageUrl(p.imageUrl, 80, 80)} 
                            alt={p.name} 
                            className="w-8 h-8 rounded-sm object-cover border border-border flex-shrink-0 cursor-zoom-in hover:brightness-95 transition-all duration-200 print:w-6 print:h-6"
                            onClick={() => setLightboxImage({ url: p.imageUrl, name: p.name })}
                            onError={(e) => {
                              if (e.target.src !== p.imageUrl) {
                                e.target.src = p.imageUrl;
                              }
                            }}
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 print:hidden">
                            <Package size={15} />
                          </div>
                        )}
                        <div className="flex flex-col min-w-0">
                          <Link href={`/dashboard/products/${p.id}`} className="font-semibold text-text-primary print:font-bold whitespace-nowrap hover:text-primary transition-colors">{p.name}</Link>
                          <span className="text-[10px] text-text-muted mt-0.5 font-mono print:text-[8px] whitespace-nowrap">
                            SKU: {p.itemCode || '---'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">{p.brand?.name}</td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="badge bg-surface-elevated text-text-secondary border border-border print:border-0 print:bg-transparent print:p-0">
                        {p.category || '---'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-semibold whitespace-nowrap">{p.stock.purchased}</td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold whitespace-nowrap">{p.stock.warehouse}</td>
                    <td className="py-3.5 px-4 text-center font-mono font-semibold text-text-secondary whitespace-nowrap">{p.stock.issued}</td>
                    <td className="py-3.5 px-4 text-center font-mono font-semibold text-text-secondary whitespace-nowrap">{p.stock.used}</td>
                    <td className="py-3.5 px-4 text-center font-mono font-semibold text-danger/80 print:text-black whitespace-nowrap">{p.stock.damage}</td>
                    <td className="py-3.5 px-4 text-center font-mono font-semibold text-danger/80 print:text-black whitespace-nowrap">{p.stock.lost}</td>
                    <td className="py-3.5 px-4 text-center font-mono font-semibold text-primary print:text-black whitespace-nowrap">{p.stock.withClient}</td>
                    <td className="py-3.5 px-4 text-center font-mono font-semibold text-secondary/80 print:text-black whitespace-nowrap">{p.stock.reBrand}</td>
                    <td className="py-3.5 pl-4 text-center font-mono font-extrabold text-primary print:text-black whitespace-nowrap">{p.stock.total}</td>
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
