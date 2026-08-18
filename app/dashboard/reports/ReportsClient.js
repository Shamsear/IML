'use client';

import React, { useState } from 'react';
import { Package, Search, Filter, Printer, Download, ArrowDownLeft, ArrowUpRight, ShieldAlert, Sparkles } from 'lucide-react';
import CustomSelect from '@/components/CustomSelect';

export default function ReportsClient({ initialProducts, brands }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 25;

  // Reset pagination page on filter/search updates
  React.useEffect(() => {
    setCurrentPage(0);
  }, [searchQuery, selectedBrand, selectedCategory]);

  // Compute stock levels for a product from its transactions
  const getProductStock = (transactions) => {
    let warehouse = 0;
    let outlets = 0;
    let staff = 0;
    let damaged = 0;

    transactions.forEach(t => {
      const qty = t.quantity || 0;
      if (t.transactionType === 'RECEIVE') {
        warehouse += qty;
      } else if (t.transactionType === 'ISSUE') {
        warehouse -= qty;
        if (t.toEntityType === 'STORE') outlets += qty;
        else if (t.toEntityType === 'STAFF' || t.toEntityType === 'SUPERVISOR') staff += qty;
      } else if (t.transactionType === 'RETURN') {
        warehouse += qty;
        if (t.fromEntityType === 'STORE') outlets -= qty;
        else if (t.fromEntityType === 'STAFF' || t.fromEntityType === 'SUPERVISOR') staff -= qty;
      } else if (t.transactionType === 'DAMAGE' || t.transactionType === 'LOST') {
        if (t.fromEntityType === 'WAREHOUSE') warehouse -= qty;
        else if (t.fromEntityType === 'STORE') outlets -= qty;
        else if (t.fromEntityType === 'STAFF' || t.fromEntityType === 'SUPERVISOR') staff -= qty;
        damaged += qty;
      } else if (t.transactionType === 'REBRAND_OUT') {
        warehouse -= qty;
      } else if (t.transactionType === 'REBRAND_IN') {
        warehouse += qty;
      }
    });

    return { warehouse, outlets, staff, damaged, total: warehouse + outlets + staff };
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
    acc.warehouse += p.stock.warehouse;
    acc.outlets += p.stock.outlets;
    acc.staff += p.stock.staff;
    acc.damaged += p.stock.damaged;
    acc.total += p.stock.total;
    return acc;
  }, { warehouse: 0, outlets: 0, staff: 0, damaged: 0, total: 0 });

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
          <button 
            type="button" 
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-sm font-semibold transition-all duration-200"
          >
            <Printer size={15} />
            <span>Print Report</span>
          </button>
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
            {aggregateTotals.outlets}
          </span>
        </div>

        <div className="bg-surface border border-border p-5 rounded-xl shadow-sm print:shadow-none print:border-black print:p-3">
          <span className="text-[10px] font-bold text-text-secondary block uppercase tracking-wider print:text-[8px] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary"></span> Promoters/Staff
          </span>
          <span className="text-2xl font-display font-black text-primary mt-1 block print:text-lg">
            {aggregateTotals.staff}
          </span>
        </div>

        <div className="bg-surface border border-border p-5 rounded-xl shadow-sm print:shadow-none print:border-black print:p-3">
          <span className="text-[10px] font-bold text-danger block uppercase tracking-wider print:text-[8px] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse"></span> Damaged / Lost
          </span>
          <span className="text-2xl font-display font-black text-danger mt-1 block print:text-lg">
            {aggregateTotals.damaged}
          </span>
        </div>
      </section>

      {/* Control filters card */}
      <div className="bg-surface border border-border rounded-xl p-5 shadow-sm flex flex-col sm:flex-row items-center gap-4 print:hidden">
        {/* Search Input */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={15} />
          <input
            type="text"
            placeholder="Search products by name or SKU code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Brand Filter */}
          <div className="flex flex-col gap-1 w-full sm:w-48">
            <label className="text-[10px] font-bold text-text-secondary uppercase">Brand Owner</label>
            <CustomSelect
              options={[{ value: 'ALL', label: 'All Brands' }, ...brands.map(b => ({ value: b.id, label: b.name }))]}
              value={selectedBrand}
              onChange={(val) => setSelectedBrand(val)}
              size="sm"
            />
          </div>

          {/* Category Filter */}
          <div className="flex flex-col gap-1 w-full sm:w-44">
            <label className="text-[10px] font-bold text-text-secondary uppercase">Category</label>
            <CustomSelect
              options={[{ value: 'ALL', label: 'All Categories' }, ...categories.map(cat => ({ value: cat, label: cat }))]}
              value={selectedCategory}
              onChange={(val) => setSelectedCategory(val)}
              size="sm"
            />
          </div>
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
                <tr className="text-left text-xs font-bold text-text-secondary uppercase tracking-wider print:text-[9px] print:text-black">
                  <th className="pb-3 pr-4">Product Details</th>
                  <th className="pb-3 px-4">Brand</th>
                  <th className="pb-3 px-4">Category</th>
                  <th className="pb-3 px-4 text-center">Warehouse</th>
                  <th className="pb-3 px-4 text-center">Outlets</th>
                  <th className="pb-3 px-4 text-center">Staff</th>
                  <th className="pb-3 px-4 text-center text-danger print:text-black">Damaged</th>
                  <th className="pb-3 pl-4 text-center font-bold text-primary print:text-black">Total Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm text-text-primary print:divide-y print:divide-gray-400 print:text-[10px]">
                {paginatedProducts.map(p => (
                  <tr key={p.id} className="hover:bg-surface-elevated/20 transition-colors print:hover:bg-transparent">
                    <td className="py-3.5 pr-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-text-primary print:font-bold">{p.name}</span>
                        <span className="text-xs text-text-muted mt-0.5 font-mono print:text-[8px]">
                          SKU: {p.itemCode || '---'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">{p.brand?.name}</td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="badge bg-surface-elevated text-text-secondary border border-border print:border-0 print:bg-transparent print:p-0">
                        {p.category || '---'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold">{p.stock.warehouse}</td>
                    <td className="py-3.5 px-4 text-center font-mono font-semibold text-text-secondary">{p.stock.outlets}</td>
                    <td className="py-3.5 px-4 text-center font-mono font-semibold text-text-secondary">{p.stock.staff}</td>
                    <td className="py-3.5 px-4 text-center font-mono font-semibold text-danger/80 print:text-black">{p.stock.damaged}</td>
                    <td className="py-3.5 pl-4 text-center font-mono font-extrabold text-primary print:text-black">{p.stock.total}</td>
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

    </div>
  );
}
