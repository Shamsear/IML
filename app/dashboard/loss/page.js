import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import TransactionActions from '@/components/TransactionActions';
import ExportToExcel from '@/components/ExportToExcel';
import ServerPagination from '@/components/ServerPagination';

export const metadata = {
  title: 'Loss Ledger - Inventory System',
  description: 'Review and log stock losses and missing items',
};

export default async function LossPage({ searchParams }) {
  const params = await searchParams;
  const page = parseInt(params?.page || '1', 10);
  const pageSize = 25;

  const whereClause = { transactionType: 'LOST' };

  const [transactions, totalCount] = await Promise.all([
    prisma.inventoryTransaction.findMany({
      where: whereClause,
      select: {
        id: true,
        transactionType: true,
        quantity: true,
        fromEntityType: true,
        fromEntityId: true,
        timestamp: true,
        notes: true,
        deliveryNote: true,
        product: {
          select: {
            id: true,
            name: true,
            itemCode: true,
            brandId: true,
            brand: { select: { name: true } }
          }
        }
      },
      orderBy: { timestamp: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.inventoryTransaction.count({ where: whereClause })
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  const [stores, supervisors, staffList] = await Promise.all([
    prisma.store.findMany({ select: { id: true, name: true } }),
    prisma.supervisor.findMany({ select: { id: true, name: true } }),
    prisma.staff.findMany({ select: { id: true, name: true } }),
  ]);

  const entityNames = {};
  stores.forEach(s => { entityNames[s.id] = s.name; });
  supervisors.forEach(s => { entityNames[s.id] = s.name; });
  staffList.forEach(s => { entityNames[s.id] = s.name; });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 pb-5 border-b border-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-text-primary tracking-tight">
            Loss Ledger
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Logs of stock reported as missing, stolen, or unaccounted for.
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <ExportToExcel
            data={transactions.map(tx => ({
              Date: new Date(tx.timestamp).toLocaleDateString('en-AE', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', year: 'numeric' }),
              Product: tx.product?.name || '',
              Brand: tx.product?.brand?.name || '',
              SKU: tx.product?.itemCode || '',
              'Lost From': tx.fromEntityType === 'WAREHOUSE' ? 'Warehouse' : (entityNames[tx.fromEntityId] || tx.fromEntityType || ''),
              Quantity: tx.quantity,
              Notes: tx.notes || '',
            }))}
            columns={[
              { header: 'Date', key: 'Date', width: 18 },
              { header: 'Product', key: 'Product', width: 25 },
              { header: 'Brand', key: 'Brand', width: 18 },
              { header: 'SKU', key: 'SKU', width: 16 },
              { header: 'Lost From', key: 'Lost From', width: 20 },
              { header: 'Quantity', key: 'Quantity', width: 10 },
              { header: 'Notes', key: 'Notes', width: 25 },
            ]}
            filename="IML-Loss-Ledger"
          />
          <Link
            href="/dashboard/loss/new"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-warning hover:bg-warning/90 text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
          >
            <AlertCircle size={15} />
            <span>Report Loss</span>
          </Link>
        </div>
      </header>

      {/* Transactions Table */}
      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        {transactions.length === 0 ? (
          <div className="py-16 text-center flex flex-col items-center gap-3 text-text-muted bg-surface">
            <AlertCircle size={48} className="text-text-muted" />
            <h3 className="font-display font-bold text-lg text-text-primary">No loss reports logged</h3>
            <p className="text-sm max-w-xs">Use the button above to report a missing or lost item.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead>
                <tr className="text-left text-xs font-bold text-text-secondary uppercase tracking-wider bg-surface-elevated/40">
                  <th className="py-3 px-3 sm:px-5">Date</th>
                  <th className="py-3 px-3 sm:px-5">Product Details</th>
                  <th className="py-3 px-3 sm:px-5">SKU</th>
                  <th className="py-3 px-3 sm:px-5">Lost From</th>
                  <th className="py-3 px-3 sm:px-5 text-center">Quantity</th>
                  <th className="py-3 px-3 sm:px-5">Loss Note</th>
                  <th className="py-3 px-3 sm:px-5">Remarks</th>
                  <th className="py-3 px-3 sm:px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-text-primary">
                {transactions.map((tx) => {
                  const dateStr = tx.timestamp.toLocaleDateString('en-AE', { timeZone: 'Asia/Dubai',
                    day: 'numeric', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  });
                  let sourceName = 'Warehouse';
                  if (tx.fromEntityType !== 'WAREHOUSE') {
                    sourceName = entityNames[tx.fromEntityId] || tx.fromEntityType || '---';
                  }
                  return (
                    <tr key={tx.id} className="hover:bg-surface-elevated/20 transition-colors">
                      <td className="py-3.5 px-3 sm:px-5 whitespace-nowrap text-xs text-text-secondary font-medium">{dateStr}</td>
                      <td className="py-3.5 px-3 sm:px-5 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-semibold">{tx.product.name}</span>
                          <span className="text-[11px] text-text-muted mt-0.5">Brand: {tx.product.brand.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 sm:px-5 whitespace-nowrap font-mono text-xs text-text-secondary">{tx.product.itemCode || '---'}</td>
                      <td className="py-3.5 px-3 sm:px-5 font-semibold text-xs text-text-secondary">{sourceName}</td>
                      <td className="py-3.5 px-3 sm:px-5 text-center font-mono font-bold text-sm whitespace-nowrap text-warning">
                        -{tx.quantity}
                      </td>
                      <td className="py-3.5 px-3 sm:px-5 font-mono text-xs text-text-secondary whitespace-nowrap">
                        {tx.deliveryNote ? (
                          <a
                            href={`/api/dashboard/loss/delivery-note?date=${new Date(tx.timestamp).toISOString().split('T')[0]}&brandId=${tx.product.brandId}&dn=${tx.deliveryNote}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary-hover hover:underline transition-colors font-semibold has-tooltip"
                          >
                            {tx.deliveryNote}
                            <span className="tooltip-box">Download Loss Note PDF</span>
                          </a>
                        ) : (
                          <span className="text-text-muted">---</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 sm:px-5 max-w-xs truncate text-xs text-text-secondary" title={tx.notes || ''}>{tx.notes || '---'}</td>
                      <td className="py-3.5 px-3 sm:px-5 text-right">
                        <TransactionActions txId={tx.id} notes={tx.notes || ''} showDeliveryNote={false} />
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
              baseUrl="/dashboard/loss"
              itemLabel="reports"
            />
          </>
        )}
      </div>
    </div>
  );
}

