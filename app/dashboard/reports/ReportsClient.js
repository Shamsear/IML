'use client';

import React, { useState } from 'react';
import { Package, Search, Filter, Printer, Download, ArrowDownLeft, ArrowUpRight, ShieldAlert, Sparkles, X } from 'lucide-react';
import CustomSelect from '@/components/CustomSelect';

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

  // Compute stock levels for a product from its transactions
  const getProductStock = (rawTransactions) => {
    const transactions = [...rawTransactions];

    let totalQtyMarkedUsed = 0;
    transactions.forEach(t => {
      if (t.transactionType === 'ISSUE' && t.fromEntityType !== 'STORE' && t.returnStatus === 'USED') {
        totalQtyMarkedUsed += t.quantity || 0;
      }
    });

    let totalQtyStoreToStaff = 0;
    transactions.forEach(t => {
      if (t.transactionType === 'ISSUE' && t.fromEntityType === 'STORE' && t.toEntityType === 'STAFF') {
        totalQtyStoreToStaff += t.quantity || 0;
      }
    });

    const virtualQty = Math.max(0, totalQtyMarkedUsed - totalQtyStoreToStaff);
    if (virtualQty > 0) {
      transactions.push({
        transactionType: 'ISSUE',
        fromEntityType: 'STORE',
        toEntityType: 'STAFF',
        quantity: virtualQty,
      });
    }

    let purchased = 0;
    let warehouse = 0;
    let issued = 0;
    let used = 0;
    let withClient = 0;
    let damage = 0;
    let lost = 0;
    let reBrand = 0;
    
    transactions.forEach(t => {
      const qty = t.quantity || 0;
      if (t.transactionType === 'RECEIVE') {
        purchased += qty;
        warehouse += qty;
      } else if (t.transactionType === 'ISSUE') {
        if (t.fromEntityType === 'STORE') {
          issued -= qty;
          if (t.toEntityType === 'STAFF') used += qty;
        } else {
          warehouse -= qty;
          if (t.toEntityType === 'STORE' || t.toEntityType === 'SUPERVISOR') issued += qty;
          else if (t.toEntityType === 'STAFF') used += qty;
          else if (t.toEntityType === 'CLIENT') withClient += qty;
        }
      } else if (t.transactionType === 'RETURN') {
        warehouse += qty;
        if (t.fromEntityType === 'STORE' || t.fromEntityType === 'SUPERVISOR') issued -= qty;
        else if (t.fromEntityType === 'STAFF') used -= qty;
        else if (t.fromEntityType === 'CLIENT') withClient -= qty;
      } else if (t.transactionType === 'DAMAGE') {
        if (t.fromEntityType === 'WAREHOUSE') warehouse -= qty;
        else if (t.fromEntityType === 'STORE' || t.fromEntityType === 'SUPERVISOR') issued -= qty;
        else if (t.fromEntityType === 'STAFF') used -= qty;
        else if (t.fromEntityType === 'CLIENT') withClient -= qty;
        damage += qty;
      } else if (t.transactionType === 'LOST') {
        if (t.fromEntityType === 'WAREHOUSE') warehouse -= qty;
        else if (t.fromEntityType === 'STORE' || t.fromEntityType === 'SUPERVISOR') issued -= qty;
        else if (t.fromEntityType === 'STAFF') used -= qty;
        else if (t.fromEntityType === 'CLIENT') withClient -= qty;
        lost += qty;
      } else if (t.transactionType === 'REBRAND_OUT') {
        warehouse -= qty;
        reBrand += qty;
      } else if (t.transactionType === 'REBRAND_IN') {
        warehouse += qty;
      }
    });

    const total = warehouse + issued + used + damage + lost + withClient + reBrand;

    return { purchased, warehouse, issued, used, damage, lost, withClient, reBrand, total };
  };

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
      
      {/* Header View */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-border print:border-b-2 print:border-black print:pb-3">
        <div>
          <h1 className="text-3xl font-display font-extrabold text-text-primary tracking-tight print:text-xl print:font-black">
            Global Stock Summary Report
          </h1>
          <p className="text-text-secondary text-sm mt-1 print:text-xs">
            Comprehensive audit report of stock distributions across Warehouse, Outlets, and Staff
          </p>
        </div>

        {/* Action triggers */}
        <div className="flex items-center gap-2 flex-wrap print:hidden">
          <div className="has-tooltip">
            <button 
              type="button" 
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-sm font-semibold transition-all duration-200"
            >
              <Printer size={15} />
              <span>Print Report</span>
            </button>
            <span className="tooltip-box">Export stock ledger to PDF/Printer</span>
          </div>
        </div>
      </header>

      {/* Aggregate telemetry tiles */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 print:grid-cols-5 print:gap-2">
        <div className="bg-surface border border-border p-5 rounded-xl shadow-sm print:shadow-none print:border-black print:p-3">
          <span className="text-[10px] font-bold text-text-secondary block uppercase tracking-wider print:text-[8px]">Filtered Items</span>
          <span className="text-2xl font-display font-black text-text-primary mt-1 block print:text-lg">
            {filteredProducts.length}
          </span>
        </div>

        <div className="bg-surface border border-border p-5 rounded-xl shadow-sm print:shadow-none print:border-black print:p-3">
          <span className="text-[10px] font-bold text-text-secondary block uppercase tracking-wider print:text-[8px] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-success"></span> Warehouse
          </span>
          <span className="text-2xl font-display font-black text-success mt-1 block print:text-lg">
            {aggregateTotals.warehouse}
          </span>
        </div>

        <div className="bg-surface border border-border p-5 rounded-xl shadow-sm print:shadow-none print:border-black print:p-3">
          <span className="text-[10px] font-bold text-text-secondary block uppercase tracking-wider print:text-[8px] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-warning"></span> Store Outlets
          </span>
          <span className="text-2xl font-display font-black text-warning mt-1 block print:text-lg">
            {aggregateTotals.issued}
          </span>
        </div>

        <div className="bg-surface border border-border p-5 rounded-xl shadow-sm print:shadow-none print:border-black print:p-3">
          <span className="text-[10px] font-bold text-text-secondary block uppercase tracking-wider print:text-[8px] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary"></span> Promoters/Staff
          </span>
          <span className="text-2xl font-display font-black text-primary mt-1 block print:text-lg">
            {aggregateTotals.used}
          </span>
        </div>

        <div className="bg-surface border border-border p-5 rounded-xl shadow-sm print:shadow-none print:border-black print:p-3">
          <span className="text-[10px] font-bold text-danger block uppercase tracking-wider print:text-[8px] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse"></span> Damaged / Lost
          </span>
          <span className="text-2xl font-display font-black text-danger mt-1 block print:text-lg">
            {aggregateTotals.damage + aggregateTotals.lost}
          </span>
        </div>
      </section>

      {/* Control filters card */}
      <div className="bg-surface border border-border rounded-xl p-4 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4 items-end print:hidden">
        {/* Search Input */}
        <div className="flex flex-col gap-1.5 w-full">
          <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Search Catalogue</label>
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={13} />
            <input
              type="text"
              placeholder="Search by name or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg pl-9 pr-4 text-xs focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all h-[34px]"
            />
          </div>
        </div>

        {/* Brand Filter */}
        <div className="flex flex-col gap-1.5 w-full">
          <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Brand Owner</label>
          <CustomSelect
            options={[{ value: 'ALL', label: 'All Brands' }, ...brands.map(b => ({ value: b.id, label: b.name }))]}
            value={selectedBrand}
            onChange={(val) => setSelectedBrand(val)}
            size="sm"
          />
        </div>

        {/* Category Filter */}
        <div className="flex flex-col gap-1.5 w-full">
          <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Category</label>
          <CustomSelect
            options={[{ value: 'ALL', label: 'All Categories' }, ...categories.map(cat => ({ value: cat, label: cat }))]}
            value={selectedCategory}
            onChange={(val) => setSelectedCategory(val)}
            size="sm"
          />
        </div>
      </div>

      {/* Main Stock Report Table */}
      <div className="bg-surface border border-border rounded-xl p-5 shadow-sm print:p-0 print:border-0 print:shadow-none">
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
                  <th className="pb-3 pr-4 whitespace-nowrap font-semibold">Product Details</th>
                  <th className="pb-3 px-4 whitespace-nowrap font-semibold">Brand</th>
                  <th className="pb-3 px-4 whitespace-nowrap font-semibold">Category</th>
                  <th className="pb-3 px-4 text-center whitespace-nowrap font-semibold">Purchased</th>
                  <th className="pb-3 px-4 text-center whitespace-nowrap font-semibold">Warehouse</th>
                  <th className="pb-3 px-4 text-center whitespace-nowrap font-semibold">Issued</th>
                  <th className="pb-3 px-4 text-center whitespace-nowrap font-semibold">Used</th>
                  <th className="pb-3 px-4 text-center text-danger whitespace-nowrap font-semibold print:text-black">Damage</th>
                  <th className="pb-3 px-4 text-center text-danger whitespace-nowrap font-semibold print:text-black">Lost</th>
                  <th className="pb-3 px-4 text-center text-secondary whitespace-nowrap font-semibold print:text-black">Rebrand</th>
                  <th className="pb-3 pl-4 text-center font-bold text-primary whitespace-nowrap print:text-black">Total Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs text-text-primary print:divide-y print:divide-gray-400 print:text-[9px]">
                {paginatedProducts.map(p => (
                  <tr key={p.id} className="hover:bg-surface-elevated/20 transition-colors print:hover:bg-transparent">
                    <td className="py-3.5 pr-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        {p.imageUrl ? (
                          <img 
                            src={p.imageUrl} 
                            alt={p.name} 
                            className="w-8 h-8 rounded-lg object-contain bg-[#fcfbfa] p-0.5 border border-border flex-shrink-0 cursor-zoom-in hover:brightness-95 transition-all duration-200 print:w-6 print:h-6"
                            onClick={() => setLightboxImage({ url: p.imageUrl, name: p.name })}
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 print:hidden">
                            <Package size={15} />
                          </div>
                        )}
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-text-primary print:font-bold whitespace-nowrap">{p.name}</span>
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
                    <td className="py-3.5 px-4 text-center font-mono font-semibold text-secondary/80 print:text-black whitespace-nowrap">{p.stock.reBrand}</td>
                    <td className="py-3.5 pl-4 text-center font-mono font-extrabold text-primary print:text-black whitespace-nowrap">{p.stock.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Reports Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-surface-elevated/20 text-xs mt-4 rounded-lg print:hidden">
              <span className="text-text-muted">
                Showing <strong className="text-text-primary">{currentPage * itemsPerPage + 1}</strong> to{" "}
                <strong className="text-text-primary">
                  {Math.min((currentPage + 1) * itemsPerPage, filteredProducts.length)}
                </strong> of{" "}
                <strong className="text-text-primary">{filteredProducts.length}</strong> products
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage === 0}
                  onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                  className="px-2.5 py-1.5 bg-surface border border-border hover:bg-surface-elevated disabled:opacity-50 text-text-secondary disabled:hover:bg-surface disabled:hover:text-text-secondary rounded-lg font-semibold transition-all duration-200"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={currentPage === totalPages - 1}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                  className="px-2.5 py-1.5 bg-surface border border-border hover:bg-surface-elevated disabled:opacity-50 text-text-secondary disabled:hover:bg-surface disabled:hover:text-text-secondary rounded-lg font-semibold transition-all duration-200"
                >
                  Next
                </button>
              </div>
            </div>
            )}
          </>
        )}
      </div>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 bg-black/90 z-[9999] flex flex-col items-center justify-center p-4 backdrop-blur-sm animate-fade-in cursor-pointer select-none print:hidden"
          onClick={() => setLightboxImage(null)}
        >
          <button 
            type="button"
            className="absolute top-6 right-6 bg-white/10 hover:bg-white/20 text-white w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxImage(null);
            }}
          >
            <X size={20} />
          </button>
          
          <div 
            className="relative max-w-4xl max-h-[80vh] flex flex-col items-center gap-4 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <img 
              src={lightboxImage.url} 
              alt={lightboxImage.name} 
              className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl border border-white/15 animate-scale-up"
            />
            <span className="text-white text-sm font-semibold tracking-wide text-center">
              {lightboxImage.name}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
