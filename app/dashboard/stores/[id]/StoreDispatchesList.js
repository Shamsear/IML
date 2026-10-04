'use client';

import React, { useState } from 'react';
import { Printer, ChevronLeft, ChevronRight, FileText } from 'lucide-react';

export default function StoreDispatchesList({ storeId, groupedDispatches = [], pageSize = 15 }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(groupedDispatches.length / pageSize);
  const paginatedDispatches = groupedDispatches.slice((page - 1) * pageSize, page * pageSize);

  if (groupedDispatches.length === 0) {
    return <div className="py-6 text-center text-xs text-text-muted">No dispatches recorded.</div>;
  }

  return (
    <>
      {/* Top Dispatches Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 border border-border bg-surface-elevated/20 text-[10px] mb-1 rounded-lg print:hidden">
          <span className="text-text-muted">
            Showing <strong className="text-text-primary">{(page - 1) * pageSize + 1}</strong> to{' '}
            <strong className="text-text-primary">
              {Math.min(page * pageSize, groupedDispatches.length)}
            </strong>{' '}
            of <strong className="text-text-primary">{groupedDispatches.length}</strong> notes
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
        {paginatedDispatches.map(disp => (
          <div key={`${disp.date}_${disp.brandId}_${disp.deliveryNote}`} className="p-3 bg-surface-elevated/40 border border-black/5 rounded-lg flex justify-between items-center text-xs">
            <div className="min-w-0 flex-1 pr-2">
              <strong className="text-text-primary block truncate font-mono">{disp.deliveryNote}</strong>
              <span className="text-text-secondary block mt-0.5 text-[10px]">
                {disp.date} — {disp.brandName}
              </span>
            </div>
            <a
              href={`/api/dashboard/stores/${storeId}/delivery-note?date=${disp.date}&brandId=${disp.brandId}&dn=${disp.deliveryNote}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 font-bold text-xs rounded-lg transition-colors whitespace-nowrap flex-shrink-0"
              title="View / Download Delivery Note PDF"
            >
              <FileText size={12} />
              <span>PDF</span>
            </a>
          </div>
        ))}
      </div>

      {/* Dispatches Bottom Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-surface-elevated/20 text-[10px] mt-2 rounded-lg">
          <span className="text-text-muted">
            Showing <strong className="text-text-primary">{(page - 1) * pageSize + 1}</strong> to{' '}
            <strong className="text-text-primary">
              {Math.min(page * pageSize, groupedDispatches.length)}
            </strong>{' '}
            of <strong className="text-text-primary">{groupedDispatches.length}</strong> notes
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
  );
}
