'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Package, 
  FileText, 
  Download, 
  ArrowDownLeft, 
  Store, 
  Shirt, 
  Undo2, 
  ShieldAlert, 
  X, 
  CheckSquare, 
  Square, 
  Eye, 
  Image as ImageIcon, 
  SlidersHorizontal 
} from 'lucide-react';
import { getOptimizedImageUrl } from '@/lib/imagekit';
import ExportToExcel from '@/components/ExportToExcel';
import { getProductStock } from '@/lib/stock';
import PageHeader from '@/components/PageHeader';
import Pagination from '@/components/Pagination';
import FilterBar from '@/components/FilterBar';
import StockBreakdown from '@/components/StockBreakdown';
import ImageLightbox from '@/components/ImageLightbox';
import AnimatedCounter from '@/components/AnimatedCounter';
import SortableHeader from '@/components/SortableHeader';
import { useTableSort } from '@/hooks/useTableSort';

const PDF_AVAILABLE_COLUMNS = [
  { key: 'brand', label: 'Brand' },
  { key: 'category', label: 'Category' },
  { key: 'purchased', label: 'Purchased' },
  { key: 'warehouse', label: 'Warehouse' },
  { key: 'issued', label: 'Issued' },
  { key: 'used', label: 'Used' },
  { key: 'damage', label: 'Damage' },
  { key: 'lost', label: 'Lost' },
  { key: 'withClient', label: 'With Client' },
  { key: 'reBrand', label: 'Rebrand' },
  { key: 'total', label: 'Total Stock' },
];

export default function ReportsClient({ initialProducts = [], brands = [] }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [lightboxImage, setLightboxImage] = useState(null); // { url, name }

  // PDF Export Modal State
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [pdfSelectedCols, setPdfSelectedCols] = useState(() => PDF_AVAILABLE_COLUMNS.map(c => c.key));
  const [pdfIncludeImages, setPdfIncludeImages] = useState(true);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 25;

  // Reset pagination page on filter/search updates
  React.useEffect(() => {
    setCurrentPage(0);
  }, [searchQuery, selectedBrand, selectedCategory]);

  // Compile products list with computed metrics
  const productsWithStock = (initialProducts || []).map(p => {
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
    return {
      ...p,
      stock
    };
  });

  // Extract list of distinct categories for filtering
  const categories = Array.from(new Set((initialProducts || []).map(p => p.category).filter(Boolean))).sort();

  // Filter products by search and selection inputs
  const filteredProducts = productsWithStock.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (p.itemCode && p.itemCode.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesBrand = selectedBrand === 'ALL' || p.brandId === selectedBrand;
    const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
    return matchesSearch && matchesBrand && matchesCategory;
  });

  // Sorting
  const customSortGetters = {
    name: p => p.name,
    brand: p => p.brand?.name || '',
    category: p => p.category || '',
    purchased: p => p.stock.purchased,
    warehouse: p => p.stock.warehouse,
    issued: p => p.stock.issued,
    used: p => p.stock.used,
    damage: p => p.stock.damage,
    lost: p => p.stock.lost,
    withClient: p => p.stock.withClient,
    reBrand: p => p.stock.reBrand,
    total: p => p.stock.total,
  };

  const { sortedItems: sortedProducts, sortField, sortDirection, handleSort } = useTableSort(
    filteredProducts,
    'name',
    'asc',
    customSortGetters
  );

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

  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage);
  const paginatedProducts = sortedProducts.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);

  const togglePdfColumn = (key) => {
    setPdfSelectedCols(prev => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev; // Keep at least one column
        return prev.filter(k => k !== key);
      } else {
        return [...prev, key];
      }
    });
  };

  const selectAllPdfCols = () => {
    setPdfSelectedCols(PDF_AVAILABLE_COLUMNS.map(c => c.key));
  };

  const getPdfApiUrl = () => {
    const params = new URLSearchParams();
    if (selectedBrand) params.set('brandId', selectedBrand);
    if (selectedCategory) params.set('category', selectedCategory);
    if (searchQuery) params.set('search', searchQuery);
    if (pdfSelectedCols.length > 0) {
      params.set('cols', pdfSelectedCols.join(','));
    }
    if (pdfIncludeImages) {
      params.set('images', '1');
    }
    return `/api/dashboard/reports/pdf?${params.toString()}`;
  };

  const handleOpenPdfPreview = () => {
    const pdfApiUrl = getPdfApiUrl();
    const previewUrl = `/pdf-preview?url=${encodeURIComponent(pdfApiUrl)}&title=${encodeURIComponent('Global Stock Summary Report')}`;
    window.open(previewUrl, '_blank');
    setIsPdfModalOpen(false);
  };

  const handleDirectPdfDownload = () => {
    const pdfApiUrl = getPdfApiUrl();
    const a = document.createElement('a');
    a.href = pdfApiUrl;
    a.download = `Global-Stock-Summary-Report-${new Date().toISOString().split('T')[0]}.pdf`;
    a.target = '_blank';
    a.click();
    setIsPdfModalOpen(false);
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
            onClick={() => setIsPdfModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-primary hover:bg-primary-hover active:scale-[0.98] text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs hover:shadow transition-all duration-150 cursor-pointer"
          >
            <FileText size={15} />
            <span>Export PDF</span>
          </button>
          <ExportToExcel
            data={filteredProducts.map(p => ({
              Image: p.imageUrl || '',
              Product: p.name,
              SKU: p.itemCode || '',
              Brand: p.brand?.name || '',
              Category: p.category || '',
              Purchased: p.stock.purchased,
              Warehouse: p.stock.warehouse,
              Issued: p.stock.issued,
              Used: p.stock.used,
              Damage: p.stock.damage,
              Lost: p.stock.lost,
              'With Client': p.stock.withClient,
              Rebrand: p.stock.reBrand,
              'Total Stock': p.stock.total,
            }))}
            columns={[
              { header: 'Image', key: 'Image', width: 16, isImage: true },
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
              const rows = filteredProducts.map(p => [
                p.name, p.itemCode || '', p.brand?.name || '', p.category || '',
                p.stock.purchased, p.stock.warehouse, p.stock.issued, p.stock.used,
                p.stock.damage, p.stock.lost, p.stock.withClient, p.stock.reBrand, p.stock.total
              ]);
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
                  <div className="min-w-0 flex-1">
                    <Link href={`/dashboard/products/${p.id}`} className="font-semibold text-sm text-text-primary block break-words leading-snug hover:text-primary transition-colors">{p.name}</Link>
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
                  <SortableHeader 
                    field="name" 
                    currentField={sortField} 
                    direction={sortDirection} 
                    onSort={handleSort}
                    className="py-3.5 pl-5 pr-4 whitespace-nowrap sticky left-0 bg-surface-elevated/80 backdrop-blur-sm z-20 border-r border-border/80 shadow-xs print:relative print:bg-transparent print:border-r-0 print:shadow-none"
                  >
                    Product Details
                  </SortableHeader>
                  <SortableHeader field="brand" currentField={sortField} direction={sortDirection} onSort={handleSort} className="py-3.5 px-4 whitespace-nowrap">
                    Brand
                  </SortableHeader>
                  <SortableHeader field="category" currentField={sortField} direction={sortDirection} onSort={handleSort} className="py-3.5 px-4 whitespace-nowrap">
                    Category
                  </SortableHeader>
                  <SortableHeader field="purchased" currentField={sortField} direction={sortDirection} onSort={handleSort} align="center" className="py-3.5 px-4 whitespace-nowrap">
                    Purchased
                  </SortableHeader>
                  <SortableHeader field="warehouse" currentField={sortField} direction={sortDirection} onSort={handleSort} align="center" className="py-3.5 px-4 whitespace-nowrap">
                    Warehouse
                  </SortableHeader>
                  <SortableHeader field="issued" currentField={sortField} direction={sortDirection} onSort={handleSort} align="center" className="py-3.5 px-4 whitespace-nowrap">
                    Issued
                  </SortableHeader>
                  <SortableHeader field="used" currentField={sortField} direction={sortDirection} onSort={handleSort} align="center" className="py-3.5 px-4 whitespace-nowrap">
                    Used
                  </SortableHeader>
                  <SortableHeader field="damage" currentField={sortField} direction={sortDirection} onSort={handleSort} align="center" className="py-3.5 px-4 whitespace-nowrap text-danger">
                    Damage
                  </SortableHeader>
                  <SortableHeader field="lost" currentField={sortField} direction={sortDirection} onSort={handleSort} align="center" className="py-3.5 px-4 whitespace-nowrap text-danger">
                    Lost
                  </SortableHeader>
                  <SortableHeader field="withClient" currentField={sortField} direction={sortDirection} onSort={handleSort} align="center" className="py-3.5 px-4 whitespace-nowrap text-primary">
                    With Client
                  </SortableHeader>
                  <SortableHeader field="reBrand" currentField={sortField} direction={sortDirection} onSort={handleSort} align="center" className="py-3.5 px-4 whitespace-nowrap text-secondary">
                    Rebrand
                  </SortableHeader>
                  <SortableHeader field="total" currentField={sortField} direction={sortDirection} onSort={handleSort} align="center" className="py-3.5 pl-4 pr-5 whitespace-nowrap font-bold text-primary">
                    Total Stock
                  </SortableHeader>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70 text-xs text-text-primary print:divide-y print:divide-gray-400 print:text-[9px]">
                {paginatedProducts.map(p => (
                  <tr key={p.id} className="hover:bg-surface-elevated/30 transition-colors print:hover:bg-transparent">
                    <td className="py-3 pl-5 pr-4 min-w-[220px] sticky left-0 bg-surface z-10 border-r border-border/80 shadow-xs print:relative print:bg-transparent print:border-r-0 print:shadow-none">
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
                        <div className="flex flex-col min-w-0">
                          <Link href={`/dashboard/products/${p.id}`} className="font-semibold text-text-primary print:font-bold break-words leading-snug hover:text-primary transition-colors">{p.name}</Link>
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

      {/* PDF Export Customization Modal */}
      {isPdfModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div 
            className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col scale-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-elevated">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-text-primary">Export PDF Report</h3>
                  <p className="text-xs text-text-secondary">
                    Customize visible columns, photos, and orientation
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPdfModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface border border-transparent hover:border-border transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
              
              {/* Filter Scope Notice */}
              <div className="p-3 bg-surface-elevated/60 border border-border rounded-xl flex items-center justify-between text-xs">
                <div className="flex flex-col">
                  <span className="font-bold text-text-primary">Current Filter Scope:</span>
                  <span className="text-text-muted text-[11px] mt-0.5">
                    Brand: <strong className="text-text-secondary">{selectedBrand === 'ALL' ? 'All Brands' : (brands.find(b => b.id === selectedBrand)?.name || selectedBrand)}</strong> · 
                    Category: <strong className="text-text-secondary">{selectedCategory === 'ALL' ? 'All Categories' : selectedCategory}</strong>
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-bold font-mono text-xs border border-primary/20">
                  {filteredProducts.length} Items
                </span>
              </div>

              {/* Column Selection */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                    <SlidersHorizontal size={13} className="text-primary" />
                    <span>Select Stock Columns ({pdfSelectedCols.length} of {PDF_AVAILABLE_COLUMNS.length})</span>
                  </label>
                  <button
                    type="button"
                    onClick={selectAllPdfCols}
                    className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                  >
                    Select All
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-3 bg-surface-elevated/40 border border-border rounded-xl">
                  {PDF_AVAILABLE_COLUMNS.map((col) => {
                    const isSelected = pdfSelectedCols.includes(col.key);
                    return (
                      <button
                        key={col.key}
                        type="button"
                        onClick={() => togglePdfColumn(col.key)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all text-left cursor-pointer border ${
                          isSelected
                            ? 'bg-primary/10 border-primary/30 text-primary font-semibold'
                            : 'bg-surface border-border text-text-muted hover:text-text-primary'
                        }`}
                      >
                        {isSelected ? (
                          <CheckSquare size={13} className="text-primary shrink-0" />
                        ) : (
                          <Square size={13} className="text-text-muted shrink-0" />
                        )}
                        <span className="truncate">{col.label}</span>
                      </button>
                    );
                  })}
                </div>
                <span className="text-[10px] text-text-muted italic px-1">
                  * Product Details (Name, Photo, SKU) is always included as the primary descriptor column.
                </span>
              </div>

              {/* Product Photos Toggle */}
              <label className="flex items-center justify-between p-3.5 bg-surface-elevated/40 border border-border rounded-xl cursor-pointer hover:bg-surface-elevated/80 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${
                    pdfIncludeImages ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' : 'bg-surface border-border text-text-muted'
                  }`}>
                    <ImageIcon size={18} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-text-primary">
                      Include Product Photos
                    </span>
                    <span className="text-[11px] text-text-muted">
                      Renders high-definition product thumbnail images inside the PDF table
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={pdfIncludeImages}
                  onChange={(e) => setPdfIncludeImages(e.target.checked)}
                  className="w-5 h-5 rounded text-primary focus:ring-primary/20 border-border cursor-pointer accent-primary"
                />
              </label>

            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-between gap-2.5 px-5 py-3.5 border-t border-border bg-surface-elevated">
              <button
                type="button"
                onClick={() => setIsPdfModalOpen(false)}
                className="px-3.5 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary bg-surface border border-border hover:bg-surface-elevated rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDirectPdfDownload}
                  disabled={filteredProducts.length === 0 || pdfSelectedCols.length === 0}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-text-primary bg-surface border border-border hover:bg-surface-elevated rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs hover:shadow"
                >
                  <Download size={13} />
                  <span>Download</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenPdfPreview}
                  disabled={filteredProducts.length === 0 || pdfSelectedCols.length === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-primary hover:bg-primary-hover active:scale-98 rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Eye size={13} />
                  <span>Open PDF Preview</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
