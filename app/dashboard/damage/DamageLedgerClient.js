'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import TransactionActions from '@/components/TransactionActions';
import CopyDeliveryNoteButton from '@/components/CopyDeliveryNoteButton';
import ExportToExcel from '@/components/ExportToExcel';
import ServerPagination from '@/components/ServerPagination';
import SortableHeader from '@/components/SortableHeader';
import { useTableSort } from '@/hooks/useTableSort';

export default function DamageLedgerClient({
  transactions = [],
  totalCount = 0,
  totalPages = 1,
  page = 1,
  pageSize = 25,
  entityNames = {},
}) {
  const customGetters = useMemo(() => ({
    date: (tx) => (tx.timestamp ? new Date(tx.timestamp).getTime() : 0),
    product: (tx) => tx.product?.name || '',
    brand: (tx) => tx.product?.brand?.name || '',
    sku: (tx) => tx.product?.itemCode || '',
    source: (tx) => {
      if (tx.fromEntityType === 'WAREHOUSE') return 'Warehouse';
      return entityNames?.[tx.fromEntityId] || tx.fromEntityType || '';
    },
    quantity: (tx) => tx.quantity || 0,
    deliveryNote: (tx) => tx.deliveryNote || '',
    notes: (tx) => tx.notes || '',
  }), [entityNames]);

  const {
    items: sortedTransactions,
    sortField,
    sortDirection,
    handleSort,
  } = useTableSort(transactions, {
    defaultSortField: 'date',
    defaultSortDirection: 'desc',
    customGetters,
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-border">
        <div>
          <h1 className="text-3xl font-display font-extrabold text-text-primary tracking-tight">
            Damage Ledger
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Logs of stock marked as physically damaged or written off.
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <CopyDeliveryNoteButton type="damage" />
          <ExportToExcel
            data={transactions.map((tx) => ({
              Date: new Date(tx.timestamp).toLocaleDateString('en-AE', {
                timeZone: 'Asia/Dubai',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              }),
              Product: tx.product?.name || '',
              Brand: tx.product?.brand?.name || '',
              SKU: tx.product?.itemCode || '',
              'Lost From':
                tx.fromEntityType === 'WAREHOUSE'
                  ? 'Warehouse'
                  : entityNames?.[tx.fromEntityId] || tx.fromEntityType || '',
              Quantity: tx.quantity,
              'Damage Note': tx.deliveryNote || '',
              Remarks: tx.notes || '',
            }))}
            columns={[
              { header: 'Date', key: 'Date', width: 18 },
              { header: 'Product', key: 'Product', width: 25 },
              { header: 'Brand', key: 'Brand', width: 18 },
              { header: 'SKU', key: 'SKU', width: 16 },
              { header: 'Lost From', key: 'Lost From', width: 20 },
              { header: 'Quantity', key: 'Quantity', width: 10 },
              { header: 'Damage Note', key: 'Damage Note', width: 20 },
              { header: 'Remarks', key: 'Remarks', width: 25 },
            ]}
            filename="IML-Damage-Ledger"
          />
          <Link
            href="/dashboard/damage/new"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-danger hover:bg-danger-hover text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
          >
            <ShieldAlert size={15} />
            <span>Report Damage</span>
          </Link>
        </div>
      </header>

      {/* Transactions Table */}
      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        {transactions.length === 0 ? (
          <div className="py-16 text-center flex flex-col items-center gap-3 text-text-muted bg-surface">
            <ShieldAlert size={48} className="text-text-muted" />
            <h3 className="font-display font-bold text-lg text-text-primary">
              No damage reports logged
            </h3>
            <p className="text-sm max-w-xs">Use the button above to report a damage.</p>
          </div>
        ) : (
          <>
            <ServerPagination
              page={page}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={pageSize}
              baseUrl="/dashboard/damage"
              itemLabel="reports"
              position="top"
            />
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead>
                  <tr className="text-left text-xs font-bold text-text-secondary uppercase tracking-wider bg-surface-elevated/40">
                    <SortableHeader field="date" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} className="py-3 px-5">Date</SortableHeader>
                    <SortableHeader field="product" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} className="py-3 px-5">Product Details</SortableHeader>
                    <SortableHeader field="sku" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} className="py-3 px-5">SKU</SortableHeader>
                    <SortableHeader field="source" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} className="py-3 px-5">Lost From</SortableHeader>
                    <SortableHeader field="quantity" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} align="center" className="py-3 px-5">Quantity</SortableHeader>
                    <SortableHeader field="deliveryNote" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} className="py-3 px-5">Damage Note</SortableHeader>
                    <SortableHeader field="notes" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} className="py-3 px-5">Remarks</SortableHeader>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-text-primary">
                  {sortedTransactions.map((tx) => {
                    const dateObj = new Date(tx.timestamp);
                    const dateStr = dateObj.toLocaleDateString('en-AE', {
                      timeZone: 'Asia/Dubai',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    let sourceName = 'Warehouse';
                    if (tx.fromEntityType !== 'WAREHOUSE') {
                      sourceName = entityNames[tx.fromEntityId] || tx.fromEntityType || '---';
                    }
                    return (
                      <tr key={tx.id} className="hover:bg-surface-elevated/20 transition-colors">
                        <td className="py-3.5 px-5 whitespace-nowrap text-xs text-text-secondary font-medium">
                          {dateStr}
                        </td>
                        <td className="py-3.5 px-5 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-semibold">{tx.product?.name}</span>
                            <span className="text-[11px] text-text-muted mt-0.5">
                              Brand: {tx.product?.brand?.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-5 whitespace-nowrap font-mono text-xs text-text-secondary">
                          {tx.product?.itemCode || '---'}
                        </td>
                        <td className="py-3.5 px-5 font-semibold text-xs text-text-secondary">
                          {sourceName}
                        </td>
                        <td className="py-3.5 px-5 text-center font-mono font-bold text-sm whitespace-nowrap text-danger">
                          -{tx.quantity}
                        </td>
                        <td className="py-3.5 px-5 font-mono text-xs text-text-secondary whitespace-nowrap">
                          {tx.deliveryNote ? (
                            <a
                              href={`/api/dashboard/damage/delivery-note?date=${new Date(tx.timestamp).toISOString().split('T')[0]}&brandId=${tx.product?.brandId}&dn=${tx.deliveryNote}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:text-primary-hover hover:underline transition-colors font-semibold has-tooltip"
                            >
                              {tx.deliveryNote}
                              <span className="tooltip-box">Download Damage Note PDF</span>
                            </a>
                          ) : (
                            <span className="text-text-muted">---</span>
                          )}
                        </td>
                        <td
                          className="py-3.5 px-5 max-w-xs truncate text-xs text-text-secondary"
                          title={tx.notes || ''}
                        >
                          {tx.notes || '---'}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <TransactionActions
                            txId={tx.id}
                            notes={tx.notes || ''}
                            showDeliveryNote={false}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ServerPagination
              page={page}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={pageSize}
              baseUrl="/dashboard/damage"
              itemLabel="reports"
            />
          </>
        )}
      </div>
    </div>
  );
}
