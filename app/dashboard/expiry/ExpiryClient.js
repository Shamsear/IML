'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, AlertTriangle, CheckCircle, Clock, ArrowRight, Package } from 'lucide-react';

export default function ExpiryClient({ initialBatches }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'EXPIRED' | 'NEAR_EXPIRY' | 'GOOD'

  const today = useMemo(() => new Date(), []);

  // Compute status for each batch
  const batchesWithStatus = useMemo(() => {
    return initialBatches.map(batch => {
      if (!batch.expiryDate) {
        return { ...batch, status: 'GOOD', daysRemaining: 9999 };
      }
      
      const expDate = new Date(batch.expiryDate);
      const diffTime = expDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      let status = 'GOOD';
      if (diffDays <= 0) {
        status = 'EXPIRED';
      } else if (diffDays <= 30) {
        status = 'NEAR_EXPIRY';
      }
      
      return {
        ...batch,
        status,
        daysRemaining: diffDays
      };
    });
  }, [initialBatches, today]);

  // Compute Summary Statistics
  const stats = useMemo(() => {
    let expired = 0;
    let nearExpiry = 0;
    let good = 0;

    batchesWithStatus.forEach(b => {
      if (b.status === 'EXPIRED') expired++;
      else if (b.status === 'NEAR_EXPIRY') nearExpiry++;
      else good++;
    });

    return {
      total: batchesWithStatus.length,
      expired,
      nearExpiry,
      good
    };
  }, [batchesWithStatus]);

  // Filtered Batches
  const filteredBatches = useMemo(() => {
    return batchesWithStatus.filter(b => {
      const matchesSearch = 
        b.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.deliveryNote.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.productBrand.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'ALL' || b.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [batchesWithStatus, searchTerm, statusFilter]);

  return (
    <div className="flex flex-col gap-6 font-sans relative">
      <div className="absolute top-0 right-0 pointer-events-none opacity-5 overflow-hidden">
        <AlertTriangle size={250} />
      </div>
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 pb-5 border-b border-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-text-primary tracking-tight">
            Expiry &amp; Batch Tracking
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Monitor product shelf life and batch expiration dates.
          </p>
        </div>
      </header>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-lg text-primary">
            <Package size={24} />
          </div>
          <div>
            <span className="text-text-secondary text-xs font-semibold block">Total Batches</span>
            <span className="text-2xl font-extrabold text-text-primary block mt-0.5">{stats.total}</span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm flex items-center gap-4 cursor-pointer hover:bg-surface-elevated/20 transition-colors" onClick={() => setStatusFilter('EXPIRED')}>
          <div className="p-3 bg-danger/10 rounded-lg text-danger">
            <AlertTriangle size={24} />
          </div>
          <div>
            <span className="text-text-secondary text-xs font-semibold block">Expired Batches</span>
            <span className="text-2xl font-extrabold text-danger block mt-0.5">{stats.expired}</span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm flex items-center gap-4 cursor-pointer hover:bg-surface-elevated/20 transition-colors" onClick={() => setStatusFilter('NEAR_EXPIRY')}>
          <div className="p-3 bg-warning/10 rounded-lg text-warning">
            <Clock size={24} />
          </div>
          <div>
            <span className="text-text-secondary text-xs font-semibold block">Near Expiry (&lt;30 days)</span>
            <span className="text-2xl font-extrabold text-warning block mt-0.5">{stats.nearExpiry}</span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm flex items-center gap-4 cursor-pointer hover:bg-surface-elevated/20 transition-colors" onClick={() => setStatusFilter('GOOD')}>
          <div className="p-3 bg-success/10 rounded-lg text-success">
            <CheckCircle size={24} />
          </div>
          <div>
            <span className="text-text-secondary text-xs font-semibold block">Safe Batches</span>
            <span className="text-2xl font-extrabold text-success block mt-0.5">{stats.good}</span>
          </div>
        </div>
      </div>

      {/* Filter and Search controls */}
      <div className="flex flex-col sm:flex-row gap-4 bg-surface p-4 rounded-xl border border-border shadow-sm">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
          <input
            type="text"
            placeholder="Search by Product name, Supplier, Batch..."
            className="w-full pl-9 pr-4 py-2.5 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Tab-like status selectors */}
        <div className="flex items-center gap-1.5 self-start bg-surface-elevated p-1 rounded-lg border border-border">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${statusFilter === 'ALL' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
          >
            All
          </button>
          <button
            onClick={() => setStatusFilter('EXPIRED')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${statusFilter === 'EXPIRED' ? 'bg-danger text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
          >
            Expired
          </button>
          <button
            onClick={() => setStatusFilter('NEAR_EXPIRY')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${statusFilter === 'NEAR_EXPIRY' ? 'bg-warning text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
          >
            Near Expiry
          </button>
          <button
            onClick={() => setStatusFilter('GOOD')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${statusFilter === 'GOOD' ? 'bg-success text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
          >
            Safe
          </button>
        </div>
      </div>

      {/* Mobile Card View */}
      {filteredBatches.length === 0 ? (
        <div className="md:hidden bg-surface border border-border rounded-xl shadow-sm py-16 text-center flex flex-col items-center gap-3 text-text-muted">
          <AlertTriangle size={48} className="text-text-muted" />
          <h3 className="font-display font-bold text-lg text-text-primary">No tracked batches match criteria</h3>
          <p className="text-sm">Try modifying your query filters above.</p>
        </div>
      ) : (
        <div className="md:hidden flex flex-col gap-3">
          {filteredBatches.map((batch) => {
            const shelfStatus = batch.shelfStatus || 'GOOD';
            return (
              <div key={batch.id} className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {batch.productImage && (
                      <img src={batch.productImage} alt={batch.productName} className="w-8 h-8 object-contain rounded-lg border border-border bg-white mb-1.5" />
                    )}
                    <span className="font-semibold text-sm text-text-primary block truncate">{batch.productName || 'Unknown'}</span>
                    <span className="text-[11px] text-text-muted">{batch.productBrand || '---'} · {batch.productCategory || ''}</span>
                  </div>
                  <span className={`badge text-[10px] flex-shrink-0 ${shelfStatus === 'EXPIRED' ? 'badge-danger' : shelfStatus === 'NEAR_EXPIRY' ? 'badge-warning' : 'badge-success'}`}>
                    {shelfStatus === 'NEAR_EXPIRY' ? 'Near Expiry' : shelfStatus}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div><span className="text-text-muted">Batch:</span> <span className="font-mono font-semibold">{batch.deliveryNote || '---'}</span></div>
                  <div><span className="text-text-muted">Qty:</span> <span className="font-bold">{batch.quantity}</span></div>
                  <div><span className="text-text-muted">Received:</span> <span className="font-semibold">{batch.receivedDate ? new Date(batch.receivedDate).toLocaleDateString() : '---'}</span></div>
                  <div><span className="text-text-muted">Expiry:</span> <span className="font-semibold">{batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString() : '---'}</span></div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Desktop Table View */}
      <div className="hidden md:block bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        {filteredBatches.length === 0 ? (
          <div className="py-16 text-center flex flex-col items-center gap-3 text-text-muted bg-surface">
            <AlertTriangle size={48} className="text-text-muted" />
            <h3 className="font-display font-bold text-lg text-text-primary">No tracked batches match criteria</h3>
            <p className="text-sm">Try modifying your query filters above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-[10px] sm:text-[11px] md:text-xs">
              <thead>
                <tr className="text-left text-xs font-bold text-text-secondary uppercase tracking-wider bg-surface-elevated/40">
                  <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 sticky left-0 bg-surface-sticky z-20 border-r border-border shadow-sm">Product Details</th>
                  <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Batch / DN</th>
                  <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Supplier / Source</th>
                  <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Received Date</th>
                  <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Mfg Date</th>
                  <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Expiry Date</th>
                  <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Shelf Status</th>
                  <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-center">Batch Stock</th>
                  <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-text-primary">
                {filteredBatches.map(batch => {
                  const rcvDateStr = new Date(batch.receivedDate).toLocaleDateString('en-AE', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', year: 'numeric' });
                  const mfgDateStr = batch.manufactureDate ? new Date(batch.manufactureDate).toLocaleDateString('en-AE', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', year: 'numeric' }) : '---';
                  const expDateStr = batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString('en-AE', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', year: 'numeric' }) : '---';

                  let statusBadge = (
                    <span className="badge text-[10px] bg-success/15 text-success border border-success/10">
                      Good ({batch.daysRemaining} days left)
                    </span>
                  );

                  if (batch.status === 'EXPIRED') {
                    statusBadge = (
                      <span className="badge text-[10px] bg-danger/15 text-danger border border-danger/10">
                        EXPIRED ({Math.abs(batch.daysRemaining)} days ago)
                      </span>
                    );
                  } else if (batch.status === 'NEAR_EXPIRY') {
                    statusBadge = (
                      <span className="badge text-[10px] bg-warning/15 text-warning border border-warning/10">
                        Expiring Soon ({batch.daysRemaining} days left)
                      </span>
                    );
                  }

                  return (
                    <tr key={batch.id} className="hover:bg-surface-elevated/20 transition-colors group/row">
                      <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 sticky left-0 bg-surface group-hover/row:bg-surface-elevated z-10 border-r border-border shadow-sm">
                        <div className="flex items-center gap-3">
                          {batch.productImage ? (
                            <img src={batch.productImage} alt={batch.productName} className="w-10 h-10 object-contain rounded-lg border border-border bg-white" />
                          ) : (
                            <div className="w-10 h-10 bg-surface-elevated rounded-lg flex items-center justify-center border border-border text-text-muted">
                              <Package size={16} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="font-semibold text-sm block truncate">{batch.productName}</span>
                            <span className="text-[11px] text-text-muted mt-0.5 block whitespace-nowrap">Brand: {batch.productBrand} • {batch.productCategory}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 font-mono text-xs font-semibold text-text-secondary whitespace-nowrap">{batch.deliveryNote}</td>
                      <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-xs text-text-secondary font-medium whitespace-nowrap">{batch.supplier}</td>
                      <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-xs text-text-secondary whitespace-nowrap">
                        {rcvDateStr} <span className="text-[10px] text-text-muted">(Qty: {batch.receivedQty})</span>
                      </td>
                      <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-xs text-text-secondary whitespace-nowrap">{mfgDateStr}</td>
                      <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-xs font-semibold text-text-secondary whitespace-nowrap">{expDateStr}</td>
                      <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap">{statusBadge}</td>
                      <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-center font-mono font-bold text-sm text-primary">
                        {batch.remainingBatchStock}
                      </td>
                      <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-right">
                        <Link
                          href={`/dashboard/products?search=${encodeURIComponent(batch.productName)}`}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-bold"
                        >
                          <span>Product Detail</span>
                          <ArrowRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
