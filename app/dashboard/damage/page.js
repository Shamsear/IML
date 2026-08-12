import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { ShieldAlert, Plus } from 'lucide-react';

export const metadata = {
  title: 'Damage & Loss Ledger - Inventory System',
  description: 'Review and log stock damages or losses',
};

export default async function DamagePage({ searchParams }) {
  const params = await searchParams;
  const page = parseInt(params?.page || '1', 10);
  const pageSize = 25;

  // Query all DAMAGE or LOST transactions with skip and take
  const [transactions, totalCount] = await Promise.all([
    prisma.inventoryTransaction.findMany({
      where: {
        transactionType: { in: ['DAMAGE', 'LOST'] },
      },
      select: {
        id: true,
        transactionType: true,
        quantity: true,
        fromEntityType: true,
        fromEntityId: true,
        timestamp: true,
        notes: true,
        product: {
          select: {
            id: true,
            name: true,
            brand: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        timestamp: 'desc',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.inventoryTransaction.count({
      where: {
        transactionType: { in: ['DAMAGE', 'LOST'] },
      }
    })
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  // Resolve location entity names in memory
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
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-border">
        <div>
          <h1 className="text-3xl font-display font-extrabold text-text-primary tracking-tight">
            Damage &amp; Loss Ledger
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Logs of stock marked as damaged, wasted, or lost.
          </p>
        </div>
        <div className="flex gap-2">
          <Link 
            href="/dashboard/damage/new" 
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-danger hover:bg-danger-hover text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
          >
            <Plus size={16} />
            <span>Report Damage / Loss</span>
          </Link>
        </div>
      </header>

      {/* Transactions Table */}
      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        {transactions.length === 0 ? (
          <div className="py-16 text-center flex flex-col items-center gap-3 text-text-muted bg-surface">
            <ShieldAlert size={48} className="text-text-muted" />
            <h3 className="font-display font-bold text-lg text-text-primary">No damage reports logged</h3>
            <p className="text-sm max-w-xs">Click &quot;Report Damage / Loss&quot; to register wastage logs.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead>
                <tr className="text-left text-xs font-bold text-text-secondary uppercase tracking-wider bg-surface-elevated/40">
                  <th className="py-3 px-5">Date</th>
                  <th className="py-3 px-5">Product Details</th>
                  <th className="py-3 px-5">Report Type</th>
                  <th className="py-3 px-5">Lost From</th>
                  <th className="py-3 px-5 text-center">Quantity</th>
                  <th className="py-3 px-5">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-text-primary">
                {transactions.map((tx) => {
                  const dateStr = tx.timestamp.toLocaleDateString('en-AE', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  // Resolve name
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
                          <span className="font-semibold">{tx.product.name}</span>
                          <span className="text-[11px] text-text-muted mt-0.5">Brand: {tx.product.brand.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <span className={`badge text-[10px] ${
                          tx.transactionType === 'DAMAGE' 
                            ? 'bg-danger/10 border-danger/20 text-danger' 
                            : 'bg-warning/10 border-warning/20 text-warning'
                        }`}>
                          {tx.transactionType}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 font-semibold text-xs text-text-secondary">
                        {sourceName}
                      </td>
                      <td className="py-3.5 px-5 text-center font-mono font-bold text-sm whitespace-nowrap text-danger">
                        -{tx.quantity}
                      </td>
                      <td className="py-3.5 px-5 max-w-xs truncate text-xs text-text-secondary" title={tx.notes || ''}>
                        {tx.notes || '---'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-surface-elevated/20 text-xs">
              <span className="text-text-muted">
                Showing <strong className="text-text-primary">{(page - 1) * pageSize + 1}</strong> to{" "}
                <strong className="text-text-primary">
                  {Math.min(page * pageSize, totalCount)}
                </strong> of{" "}
                <strong className="text-text-primary">{totalCount}</strong> reports
              </span>
              <div className="flex items-center gap-1.5">
                <Link
                  href={`/dashboard/damage?page=${Math.max(1, page - 1)}`}
                  className={`px-2.5 py-1.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary rounded-lg font-semibold transition-all duration-200 ${
                    page === 1 ? 'pointer-events-none opacity-50' : ''
                  }`}
                >
                  Previous
                </Link>
                <Link
                  href={`/dashboard/damage?page=${Math.min(totalPages, page + 1)}`}
                  className={`px-2.5 py-1.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary rounded-lg font-semibold transition-all duration-200 ${
                    page === totalPages ? 'pointer-events-none opacity-50' : ''
                  }`}
                >
                  Next
                </Link>
              </div>
            </div>
          )}
          </>
        )}
      </div>
    </div>
  );
}
