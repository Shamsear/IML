'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Package, QrCode } from 'lucide-react';
import SortableHeader from '@/components/SortableHeader';
import { useTableSort } from '@/hooks/useTableSort';
import ImageLightbox from '@/components/ImageLightbox';
import { getOptimizedImageUrl } from '@/lib/imagekit';

export default function StoreInventoryTable({
  inventory,
  storeId,
  pageSize = 15,
}) {
  const [page, setPage] = useState(1);
  const [lightboxImage, setLightboxImage] = useState(null);

  const customGetters = useMemo(() => ({
    name: (item) => item.name || '',
    brand: (item) => item.brandName || '',
    quantity: (item) => item.quantity || 0,
    serials: (item) => (item.serials || []).map((s) => s.barcode).join(', '),
  }), []);

  const {
    items: sortedInventory,
    sortField,
    sortDirection,
    handleSort,
  } = useTableSort(inventory, {
    defaultSortField: 'name',
    defaultSortDirection: 'asc',
    customGetters,
  });

  const totalInvPages = Math.ceil(sortedInventory.length / pageSize);
  const paginatedInventory = sortedInventory.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="bg-surface border border-border rounded-xl p-5 shadow-sm flex flex-col gap-4">
      <div className="flex items-center gap-2 pb-3 border-b border-border">
        <Package size={18} className="text-primary" />
        <h3 className="font-display font-bold text-base text-text-primary">
          Current Stock Placed At Store
        </h3>
      </div>

      <div>
        {sortedInventory.length === 0 ? (
          <div className="py-12 text-center flex flex-col items-center gap-3 text-text-muted">
            <Package size={40} className="text-text-muted" />
            <p className="text-sm font-medium">No stock items found in this store currently.</p>
          </div>
        ) : (
          <>
            {/* Top Inventory Pagination */}
            {totalInvPages > 1 && (
              <div className="flex items-center justify-between px-4 py-2.5 border border-border bg-surface-elevated/20 text-xs mb-3 rounded-lg print:hidden">
                <span className="text-text-muted">
                  Showing <strong className="text-text-primary">{(page - 1) * pageSize + 1}</strong> to{' '}
                  <strong className="text-text-primary">
                    {Math.min(page * pageSize, sortedInventory.length)}
                  </strong>{' '}
                  of <strong className="text-text-primary">{sortedInventory.length}</strong> items
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={page === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="px-2.5 py-1.5 bg-surface border border-border hover:bg-surface-elevated disabled:opacity-50 text-text-secondary rounded-lg font-semibold transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={page === totalInvPages}
                    onClick={() => setPage(p => Math.min(totalInvPages, p + 1))}
                    className="px-2.5 py-1.5 bg-surface border border-border hover:bg-surface-elevated disabled:opacity-50 text-text-secondary rounded-lg font-semibold transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto -mx-5">
              <div className="inline-block min-w-full align-middle px-5">
                <table className="min-w-full divide-y divide-border text-sm">
                  <thead>
                    <tr className="text-left text-xs font-bold text-text-secondary uppercase tracking-wider">
                      <SortableHeader field="name" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} className="pb-3 pl-5 pr-4">Product Name</SortableHeader>
                      <SortableHeader field="brand" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} className="pb-3 px-4">Brand</SortableHeader>
                      <SortableHeader field="quantity" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} align="center" className="pb-3 px-4">Quantity</SortableHeader>
                      <SortableHeader field="serials" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} className="pb-3 pl-4">Barcodes / Serials</SortableHeader>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-text-primary">
                    {paginatedInventory.map((item) => (
                      <tr key={item.productId} className="hover:bg-surface-elevated/20 transition-colors">
                        <td className="py-3 pl-5 pr-4 font-semibold">
                          <div className="flex items-center gap-2.5">
                            {item.imageUrl ? (
                              <img
                                src={getOptimizedImageUrl(item.imageUrl, 80, 80)}
                                alt={item.name || 'Product'}
                                className="w-9 h-9 rounded-lg object-cover border border-border shrink-0 cursor-zoom-in hover:brightness-95 transition-all"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLightboxImage({ url: item.imageUrl, name: item.name });
                                }}
                                onError={(e) => {
                                  if (e.target.src !== item.imageUrl) {
                                    e.target.src = item.imageUrl;
                                  }
                                }}
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-lg bg-surface-elevated text-text-muted flex items-center justify-center border border-border shrink-0">
                                <Package size={16} />
                              </div>
                            )}
                            <Link href={`/dashboard/products/${item.productId}`} className="font-semibold text-text-primary hover:text-primary transition-colors">
                              {item.name}
                            </Link>
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="badge badge-info">{item.brandName}</span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-center font-mono font-bold text-base">
                          {item.quantity}
                        </td>
                        <td className="py-3 pl-4 whitespace-nowrap">
                          {item.isSerialized ? (
                            <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                              <QrCode size={13} className="text-success" />
                              <span
                                className="max-w-[240px] truncate font-mono bg-surface-elevated px-1.5 py-0.5 rounded text-[10px]"
                                title={item.serials.map((s) => s.barcode).join(', ')}
                              >
                                {item.serials.map((s) => s.barcode).join(', ')}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-text-muted">Bulk Goods</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden flex flex-col gap-3">
              {paginatedInventory.map((item) => (
                <div
                  key={item.productId}
                  className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-2.5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {item.imageUrl ? (
                        <img
                          src={getOptimizedImageUrl(item.imageUrl, 80, 80)}
                          alt={item.name || 'Product'}
                          className="w-10 h-10 rounded-lg object-cover border border-border shrink-0 cursor-zoom-in hover:brightness-95 transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLightboxImage({ url: item.imageUrl, name: item.name });
                          }}
                          onError={(e) => {
                            if (e.target.src !== item.imageUrl) {
                              e.target.src = item.imageUrl;
                            }
                          }}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-surface-elevated text-text-muted flex items-center justify-center border border-border shrink-0">
                          <Package size={18} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <Link href={`/dashboard/products/${item.productId}`} className="font-bold text-sm text-text-primary hover:text-primary transition-colors block leading-tight">
                          {item.name}
                        </Link>
                        <span className="badge badge-info mt-1 text-[9px]">{item.brandName}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-[10px] text-text-secondary block font-semibold">Qty</span>
                      <span className="font-mono font-black text-lg text-text-primary">
                        {item.quantity}
                      </span>
                    </div>
                  </div>
                  {item.isSerialized ? (
                    <div className="pt-2 border-t border-border/50 flex flex-col gap-1 text-[11px] text-text-secondary">
                      <span className="font-semibold flex items-center gap-1.5">
                        <QrCode size={12} className="text-success" /> Serials:
                      </span>
                      <div className="flex flex-wrap gap-1.5 mt-0.5">
                        {item.serials.map((s) => (
                          <span
                            key={s.barcode}
                            className="font-mono bg-surface-elevated px-1.5 py-0.5 rounded text-[10px] select-all"
                          >
                            {s.barcode}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-border/50 text-[11px] text-text-muted">
                      Bulk Goods
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Inventory Pagination Controls */}
            {totalInvPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-surface-elevated/20 text-xs mt-2 rounded-lg">
                <span className="text-text-muted">
                  Showing <strong className="text-text-primary">{(page - 1) * pageSize + 1}</strong> to{' '}
                  <strong className="text-text-primary">
                    {Math.min(page * pageSize, sortedInventory.length)}
                  </strong>{' '}
                  of <strong className="text-text-primary">{sortedInventory.length}</strong> items
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={page === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="px-2.5 py-1.5 bg-surface border border-border hover:bg-surface-elevated disabled:opacity-50 text-text-secondary rounded-lg font-semibold transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={page === totalInvPages}
                    onClick={() => setPage(p => Math.min(totalInvPages, p + 1))}
                    className="px-2.5 py-1.5 bg-surface border border-border hover:bg-surface-elevated disabled:opacity-50 text-text-secondary rounded-lg font-semibold transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <ImageLightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />
    </div>
  );
}
