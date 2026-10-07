'use client';

import React, { useState } from 'react';
import { Printer, ChevronLeft, ChevronRight, FileText } from 'lucide-react';

export default function StoreDispatchesList({ storeId, groupedDispatches = [], groupedOutward = [], pageSize = 15 }) {
  const [activeTab, setActiveTab] = useState('dispatches');
  const [page, setPage] = useState(1);

  const currentList = activeTab === 'dispatches' ? groupedDispatches : groupedOutward;
  const totalPages = Math.ceil(currentList.length / pageSize);
  const paginatedItems = currentList.slice((page - 1) * pageSize, page * pageSize);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Tab Switcher */}
      <div className="flex items-center gap-1 border-b border-border text-xs pb-1">
        <button
          type="button"
          onClick={() => handleTabChange('dispatches')}
          className={`px-3 py-1.5 font-semibold rounded-t-lg transition-colors cursor-pointer ${
            activeTab === 'dispatches'
              ? 'bg-surface-elevated text-primary border-b-2 border-primary font-bold'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated/40'
          }`}
        >
          Dispatches ({groupedDispatches.length})
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('outward')}
          className={`px-3 py-1.5 font-semibold rounded-t-lg transition-colors cursor-pointer ${
            activeTab === 'outward'
              ? 'bg-surface-elevated text-primary border-b-2 border-primary font-bold'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated/40'
          }`}
        >
          Returns & Write-Offs ({groupedOutward.length})
        </button>
      </div>

      {currentList.length === 0 ? (
        <div className="py-6 text-center text-xs text-text-muted">
          {activeTab === 'dispatches' ? 'No dispatches recorded.' : 'No returns or write-offs recorded for this outlet.'}
        </div>
      ) : (
        <>
          {/* Top Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-3 py-2 border border-border bg-surface-elevated/20 text-[10px] rounded-lg print:hidden">
              <span className="text-text-muted">
                Showing <strong className="text-text-primary">{(page - 1) * pageSize + 1}</strong> to{' '}
                <strong className="text-text-primary">
                  {Math.min(page * pageSize, currentList.length)}
                </strong>{' '}
                of <strong className="text-text-primary">{currentList.length}</strong> notes
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="px-2 py-1 bg-surface border border-border hover:bg-surface-elevated disabled:opacity-50 text-text-secondary rounded-md font-semibold transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={page === totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="px-2 py-1 bg-surface border border-border hover:bg-surface-elevated disabled:opacity-50 text-text-secondary rounded-md font-semibold transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            {paginatedItems.map(item => {
              if (activeTab === 'dispatches') {
                return (
                  <div key={`${item.date}_${item.brandId}_${item.deliveryNote}`} className="p-3 bg-surface-elevated/40 border border-black/5 rounded-lg flex justify-between items-center text-xs">
                    <div className="min-w-0 flex-1 pr-2">
                      <strong className="text-text-primary block truncate font-mono">{item.deliveryNote}</strong>
                      <span className="text-text-secondary block mt-0.5 text-[10px]">
                        {item.date} — {item.brandName} • {item.totalQuantity} units
                      </span>
                    </div>
                    <a
                      href={`/pdf-preview?url=${encodeURIComponent(`/api/dashboard/stores/${storeId}/delivery-note?date=${item.date}&brandId=${item.brandId}&dn=${item.deliveryNote}`)}&title=${encodeURIComponent(item.deliveryNote)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 font-bold text-xs rounded-lg transition-colors whitespace-nowrap flex-shrink-0"
                      title="View / Download Delivery Note PDF"
                    >
                      <FileText size={12} />
                      <span>PDF</span>
                    </a>
                  </div>
                );
              }

              // Outward items (RETURN / DAMAGE / LOST)
              let pdfUrl = '';
              let badgeColor = 'badge-success';
              let typeLabel = 'RETURN';

              if (item.type === 'DAMAGE') {
                pdfUrl = `/api/dashboard/damage/delivery-note?date=${item.date}&brandId=${item.brandId}&dn=${item.deliveryNote}`;
                badgeColor = 'badge-warning';
                typeLabel = 'DAMAGE';
              } else if (item.type === 'LOST') {
                pdfUrl = `/api/dashboard/loss/delivery-note?date=${item.date}&brandId=${item.brandId}&dn=${item.deliveryNote}`;
                badgeColor = 'badge-danger';
                typeLabel = 'LOSS';
              } else {
                pdfUrl = `/api/dashboard/returns/delivery-note?date=${item.date}&dn=${item.deliveryNote}${item.brandId ? `&brandId=${item.brandId}` : ''}`;
                badgeColor = 'badge-success';
                typeLabel = 'RETURN';
              }

              return (
                <div key={`${item.type}_${item.date}_${item.brandId}_${item.deliveryNote}`} className="p-3 bg-surface-elevated/40 border border-black/5 rounded-lg flex justify-between items-center text-xs">
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="flex items-center gap-2">
                      <span className={`badge ${badgeColor} text-[9px] uppercase font-bold tracking-wider`}>
                        {typeLabel}
                      </span>
                      <strong className="text-text-primary truncate font-mono">{item.deliveryNote}</strong>
                    </div>
                    <span className="text-text-secondary block mt-0.5 text-[10px]">
                      {item.date} — {item.brandName} • {item.totalQuantity} units ({item.itemCount} item{item.itemCount > 1 ? 's' : ''})
                    </span>
                    {item.notes && item.notes.includes('Cut from') && (
                      <span className="text-text-muted text-[9px] font-mono block mt-0.5 truncate">
                        {item.notes}
                      </span>
                    )}
                  </div>
                  <a
                    href={`/pdf-preview?url=${encodeURIComponent(pdfUrl)}&title=${encodeURIComponent(item.deliveryNote)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 font-bold text-xs rounded-lg transition-colors whitespace-nowrap flex-shrink-0"
                    title={`View / Download ${typeLabel} Note PDF`}
                  >
                    <FileText size={12} />
                    <span>PDF</span>
                  </a>
                </div>
              );
            })}
          </div>

          {/* Bottom Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-surface-elevated/20 text-[10px] mt-2 rounded-lg">
              <span className="text-text-muted">
                Showing <strong className="text-text-primary">{(page - 1) * pageSize + 1}</strong> to{' '}
                <strong className="text-text-primary">
                  {Math.min(page * pageSize, currentList.length)}
                </strong>{' '}
                of <strong className="text-text-primary">{currentList.length}</strong> notes
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="px-2 py-1 bg-surface border border-border hover:bg-surface-elevated disabled:opacity-50 text-text-secondary rounded-md font-semibold transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={page === totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="px-2 py-1 bg-surface border border-border hover:bg-surface-elevated disabled:opacity-50 text-text-secondary rounded-md font-semibold transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
