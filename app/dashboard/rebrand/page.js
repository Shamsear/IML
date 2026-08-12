import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { RefreshCw, Plus } from 'lucide-react';

export const metadata = {
  title: 'Stock Rebranding Ledger - Inventory System',
  description: 'Log and review stock rebranding campaigns',
};

export default async function RebrandPage() {
  // Query all REBRAND_OUT or REBRAND_IN transactions
  const transactions = await prisma.inventoryTransaction.findMany({
    where: {
      transactionType: { in: ['REBRAND_OUT', 'REBRAND_IN'] },
    },
    include: {
      product: {
        include: {
          brand: true,
        }
      },
      serialNumbers: {
        include: {
          serialNumber: true
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
            Stock Rebranding Logs
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Logs of stock items modified or converted into different product definitions.
          </p>
        </div>
        <div className="flex gap-2">
          <Link 
            href="/dashboard/rebrand/new" 
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
          >
            <Plus size={16} />
            <span>New Rebranding Map</span>
          </Link>
        </div>
      </header>

      {/* Transactions Table */}
      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        {transactions.length === 0 ? (
          <div className="py-16 text-center flex flex-col items-center gap-3 text-text-muted bg-surface">
            <RefreshCw size={48} className="text-text-muted animate-spin-slow" />
            <h3 className="font-display font-bold text-lg text-text-primary">No rebranding logs recorded</h3>
            <p className="text-sm max-w-xs">Click &quot;New Rebranding Map&quot; to execute rebranding transfers.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead>
                <tr className="text-left text-xs font-bold text-text-secondary uppercase tracking-wider bg-surface-elevated/40">
                  <th className="py-3 px-5">Date</th>
                  <th className="py-3 px-5">Product Details</th>
                  <th className="py-3 px-5">Action Type</th>
                  <th className="py-3 px-5 text-center">Quantity</th>
                  <th className="py-3 px-5">Associated Serials / Barcodes</th>
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
                      <td className="py-3.5 px-5">
                        <div className="flex flex-col">
                          <span className="font-semibold">{tx.product.name}</span>
                          <span className="text-[11px] text-text-muted mt-0.5">Brand: {tx.product.brand.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <span className={`badge text-[10px] ${
                          tx.transactionType === 'REBRAND_IN' 
                            ? 'bg-success/10 border-success/20 text-success' 
                            : 'bg-danger/10 border-danger/20 text-danger'
                        }`}>
                          {tx.transactionType === 'REBRAND_IN' ? 'REBRAND IN (Gain)' : 'REBRAND OUT (Loss)'}
                        </span>
                      </td>
                      <td className={`py-3.5 px-5 text-center font-mono font-bold text-sm whitespace-nowrap ${
                        tx.transactionType === 'REBRAND_IN' ? 'text-success' : 'text-danger'
                      }`}>
                        {tx.transactionType === 'REBRAND_IN' ? `+${tx.quantity}` : `-${tx.quantity}`}
                      </td>
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        {tx.serialNumbers?.length > 0 ? (
                          <span className="max-w-[200px] truncate block text-xs font-mono bg-surface-elevated px-1.5 py-0.5 rounded text-[10px]" title={tx.serialNumbers.map(s => s.serialNumber.barcode).join(', ')}>
                            {tx.serialNumbers.map(s => s.serialNumber.barcode).join(', ')}
                          </span>
                        ) : (
                          <span className="text-xs text-text-muted">No Serials</span>
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
        )}
      </div>
    </div>
  );
}
