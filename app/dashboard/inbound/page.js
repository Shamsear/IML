import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { ArrowDownLeft, Plus, ArrowLeft, History, FileSpreadsheet } from 'lucide-react';

export const metadata = {
  title: 'Inbound Receipts Ledger - Inventory System',
  description: 'Log and review inbound inventory receipts',
};

export default async function InboundPage() {
  // Query all RECEIVE or RETURN transactions
  const transactions = await prisma.inventoryTransaction.findMany({
    where: {
      transactionType: { in: ['RECEIVE', 'RETURN'] },
    },
    select: {
      id: true,
      transactionType: true,
      fromEntityType: true,
      fromEntityId: true,
      quantity: true,
      deliveryNote: true,
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
    }
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-border">
        <div>
          <h1 className="text-3xl font-display font-extrabold text-text-primary tracking-tight">
            Inbound Stock Receipts
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Audit logs of all incoming stock received at the warehouse.
          </p>
        </div>
        <div className="flex gap-2">
          <Link 
            href="/dashboard/inbound/new" 
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
          >
            <Plus size={16} />
            <span>New Inbound Receipt</span>
          </Link>
        </div>
      </header>

      {/* Transactions Table */}
      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        {transactions.length === 0 ? (
          <div className="py-16 text-center flex flex-col items-center gap-3 text-text-muted bg-surface">
            <ArrowDownLeft size={48} className="text-text-muted" />
            <h3 className="font-display font-bold text-lg text-text-primary">No Inbound Receipts logged</h3>
            <p className="text-sm max-w-xs">Click &quot;New Inbound Receipt&quot; to record stock arrivals.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead>
                <tr className="text-left text-xs font-bold text-text-secondary uppercase tracking-wider bg-surface-elevated/40">
                  <th className="py-3 px-5">Date</th>
                  <th className="py-3 px-5">Product Details</th>
                  <th className="py-3 px-5">Type</th>
                  <th className="py-3 px-5">Source / Supplier</th>
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
                          tx.transactionType === 'RECEIVE' 
                            ? 'bg-success/10 border-success/20 text-success' 
                            : 'bg-info/10 border-info/20 text-info'
                        }`}>
                          {tx.transactionType}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <span className="text-xs font-semibold text-text-secondary">
                          {tx.fromEntityType === 'SUPPLIER' ? `Supplier: ${tx.fromEntityId || '---'}` : `${tx.fromEntityType || '---'}`}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-center font-mono font-bold text-sm whitespace-nowrap">
                        +{tx.quantity}
                      </td>
                      <td className="py-3.5 px-5 font-mono text-xs text-text-secondary whitespace-nowrap">
                        {tx.deliveryNote || '---'}
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
        )}
      </div>
    </div>
  );
}
