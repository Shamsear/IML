import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { ArrowUpRight, Plus, History } from 'lucide-react';

export const metadata = {
  title: 'Outbound Dispatches Ledger - Inventory System',
  description: 'Log and review outbound dispatches and allocations',
};

export default async function OutboundPage({ searchParams }) {
  const params = await searchParams;
  const page = parseInt(params?.page || '1', 10);
  const pageSize = 25;

  // Query all ISSUE transactions with skip and take
  const [transactions, totalCount] = await Promise.all([
    prisma.inventoryTransaction.findMany({
      where: {
        transactionType: 'ISSUE',
      },
      select: {
        id: true,
        transactionType: true,
        toEntityType: true,
        toEntityId: true,
        quantity: true,
        deliveryNote: true,
        timestamp: true,
        notes: true,
        product: {
          select: {
            id: true,
            name: true,
            brandId: true,
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
        transactionType: 'ISSUE',
      }
    })
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  // Resolve destination names in memory
  // Outlets, staff, and supervisors can be matched by fromEntityId / toEntityId
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
            Outbound Dispatches
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Audit logs of all stock allocations, promoter issues, and store shipments.
          </p>
        </div>
        <div className="flex gap-2">
          <Link 
            href="/dashboard/outbound/new" 
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
          >
            <Plus size={16} />
            <span>New Outbound Dispatch</span>
          </Link>
        </div>
      </header>

      {/* Transactions Table */}
      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        {transactions.length === 0 ? (
          <div className="py-16 text-center flex flex-col items-center gap-3 text-text-muted bg-surface">
            <ArrowUpRight size={48} className="text-text-muted" />
            <h3 className="font-display font-bold text-lg text-text-primary">No Outbound Dispatches logged</h3>
            <p className="text-sm max-w-xs">Click &quot;New Outbound Dispatch&quot; to register dispatches.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead>
                <tr className="text-left text-xs font-bold text-text-secondary uppercase tracking-wider bg-surface-elevated/40">
                  <th className="py-3 px-5">Date</th>
                  <th className="py-3 px-5">Product Details</th>
                  <th className="py-3 px-5">Destination Type</th>
                  <th className="py-3 px-5">Destination Entity</th>
                  <th className="py-3 px-5 text-center">Quantity</th>
                  <th className="py-3 px-5">Delivery Note</th>
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
                  let destinationName = '---';
                  if (tx.toEntityType === 'CLIENT') {
                    destinationName = tx.toEntityId || 'Client Possession';
                  } else {
                    destinationName = entityNames[tx.toEntityId] || tx.toEntityId || '---';
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
                        <span className="badge text-[10px] bg-secondary/15 text-secondary border border-secondary/10">
                          {tx.toEntityType}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 font-semibold text-xs text-text-secondary whitespace-nowrap">
                        {destinationName}
                      </td>
                      <td className="py-3.5 px-5 text-center font-mono font-bold text-sm whitespace-nowrap text-primary">
                        -{tx.quantity}
                      </td>
                      <td className="py-3.5 px-5 font-mono text-xs text-text-secondary whitespace-nowrap">
                        {tx.deliveryNote && tx.toEntityType === 'STORE' && tx.toEntityId ? (
                          <Link
                            href={`/api/dashboard/stores/${tx.toEntityId}/delivery-note?date=${tx.timestamp.toISOString().split('T')[0]}&brandId=${tx.product.brandId}&dn=${tx.deliveryNote}`}
                            target="_blank"
                            className="text-primary hover:text-primary-hover hover:underline transition-colors font-semibold"
                            title="Download Delivery Note PDF"
                          >
                            {tx.deliveryNote}
                          </Link>
                        ) : (
                          <span>{tx.deliveryNote || '---'}</span>
                        )}
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
                <strong className="text-text-primary">{totalCount}</strong> dispatches
              </span>
              <div className="flex items-center gap-1.5">
                <Link
                  href={`/dashboard/outbound?page=${Math.max(1, page - 1)}`}
                  className={`px-2.5 py-1.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary rounded-lg font-semibold transition-all duration-200 ${
                    page === 1 ? 'pointer-events-none opacity-50' : ''
                  }`}
                >
                  Previous
                </Link>
                <Link
                  href={`/dashboard/outbound?page=${Math.min(totalPages, page + 1)}`}
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
