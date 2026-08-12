'use client';

import { useState } from 'react';
import { 
  History, ArrowDownLeft, ArrowUpRight, ShieldAlert, RefreshCw, 
  ClipboardList, Calendar, FileText, User, Store, UserCheck, Package
} from 'lucide-react';
import Link from 'next/link';

export default function TransactionsClient({ 
  initialTransactions, 
  products 
}) {
  const [transactions] = useState(initialTransactions);
  const [filterType, setFilterType] = useState('ALL');
  const [filterProduct, setFilterProduct] = useState('ALL');

  // Filtered transactions for view table
  const filteredTransactions = transactions.filter(tx => {
    const matchesType = filterType === 'ALL' || tx.transactionType === filterType;
    const matchesProduct = filterProduct === 'ALL' || tx.productId === filterProduct;
    return matchesType && matchesProduct;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 pb-5 border-b border-border">
        <div>
          <h1 className="text-3xl font-display font-extrabold text-text-primary tracking-tight">
            Inventory Ledger Feed
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Audit logs of stock dispatches, returns, rebrands, and damages.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link href="/dashboard/inbound" className="inline-flex items-center gap-2 px-4 py-2.5 bg-success/15 hover:bg-success text-success hover:text-white border border-success/30 rounded-lg text-sm font-semibold transition-all duration-200">
            <ArrowDownLeft size={16} />
            <span>Inbound (Receive)</span>
          </Link>
          <Link href="/dashboard/outbound" className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary/15 hover:bg-primary text-primary hover:text-white border border-primary/30 rounded-lg text-sm font-semibold transition-all duration-200">
            <ArrowUpRight size={16} />
            <span>Outbound (Dispatch)</span>
          </Link>
          <Link href="/dashboard/rebrand" className="inline-flex items-center gap-2 px-4 py-2.5 bg-secondary/15 hover:bg-secondary text-secondary hover:text-white border border-secondary/30 rounded-lg text-sm font-semibold transition-all duration-200">
            <RefreshCw size={16} />
            <span>Rebrand Stock</span>
          </Link>
          <Link href="/dashboard/damage" className="inline-flex items-center gap-2 px-4 py-2.5 bg-danger/15 hover:bg-danger text-danger hover:text-white border border-danger/30 rounded-lg text-sm font-semibold transition-all duration-200">
            <ShieldAlert size={16} />
            <span>Log Damage</span>
          </Link>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex flex-col gap-6">
        {/* Filter Toolbar */}
        <div className="bg-surface border border-border rounded-xl p-4 flex flex-wrap gap-6 items-center shadow-sm">
          <div className="flex items-center gap-2">
            <ClipboardList size={16} className="text-text-secondary" />
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Type:</span>
            <select 
              className="bg-surface-elevated text-text-primary border border-border rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-primary transition-colors" 
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="ALL">All Transactions</option>
              <option value="RECEIVE">Inbound (Receive)</option>
              <option value="ISSUE">Outbound (Dispatch)</option>
              <option value="RETURN">Return</option>
              <option value="DAMAGE">Damage</option>
              <option value="REBRAND_OUT">Rebrand Out</option>
              <option value="REBRAND_IN">Rebrand In</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Package size={16} className="text-text-secondary" />
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Product:</span>
            <select 
              className="bg-surface-elevated text-text-primary border border-border rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-primary transition-colors" 
              value={filterProduct} 
              onChange={(e) => setFilterProduct(e.target.value)}
            >
              <option value="ALL">All Products</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Ledger Table Panel */}
        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm overflow-hidden">
          {filteredTransactions.length === 0 ? (
            <div className="py-16 text-center flex flex-col items-center gap-3 text-text-muted">
              <History size={48} />
              <h3 className="font-display font-bold text-lg text-text-primary">No Ledger Logs Found</h3>
              <p className="text-sm max-w-xs">Select a movement action above to log stock operations.</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-5">
              <div className="inline-block min-w-full align-middle px-5">
                <table className="min-w-full divide-y divide-border">
                  <thead>
                    <tr className="text-left text-xs font-bold text-text-secondary uppercase tracking-wider">
                      <th className="pb-3 pr-4">Product Details</th>
                      <th className="pb-3 px-4">Transaction Type</th>
                      <th className="pb-3 px-4">Source / From</th>
                      <th className="pb-3 px-4">Destination / To</th>
                      <th className="pb-3 px-4 text-center">Quantity</th>
                      <th className="pb-3 px-4">Delivery Note</th>
                      <th className="pb-3 pl-4">Date &amp; Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-sm text-text-primary">
                    {filteredTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-surface-elevated/20 transition-colors">
                        <td className="py-3.5 pr-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-semibold text-text-primary">{tx.product.name}</span>
                            {tx.notes && (
                              <span className="text-xs text-text-secondary italic bg-surface-elevated/45 border-l-2 border-primary px-2 py-0.5 mt-1 rounded-r max-w-xs truncate" title={tx.notes}>
                                {tx.notes}
                              </span>
                            )}
                            {tx.receivedBy && (
                              <span className="text-[10px] text-text-secondary mt-1 font-semibold flex items-center gap-1">
                                👤 Received/Processed by: <span className="text-primary font-bold">{tx.receivedBy}</span>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`badge ${
                            tx.transactionType === 'RECEIVE' || tx.transactionType === 'REBRAND_IN' ? 'badge-success' :
                            tx.transactionType === 'ISSUE' ? 'badge-info' : 
                            tx.transactionType === 'DAMAGE' || tx.transactionType === 'LOST' ? 'badge-danger' : 'badge-warning'
                          }`}>
                            {tx.transactionType}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-xs">
                            {tx.fromEntityType === 'SUPPLIER' && <Store size={14} className="text-success" />}
                            {tx.fromEntityType === 'WAREHOUSE' && <Package size={14} className="text-primary" />}
                            {tx.fromEntityType === 'STORE' && <Store size={14} className="text-secondary" />}
                            {tx.fromEntityType === 'SUPERVISOR' && <UserCheck size={14} className="text-warning" />}
                            <span className="font-semibold">{tx.fromEntityType || 'N/A'}</span>
                            {tx.fromEntityId && (
                              <span className="font-mono text-text-muted bg-surface-elevated px-1.5 py-0.5 rounded text-[10px]">
                                {tx.fromEntityId.slice(-6)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-xs">
                            {tx.toEntityType === 'WAREHOUSE' && <Package size={14} className="text-primary" />}
                            {tx.toEntityType === 'STORE' && <Store size={14} className="text-secondary" />}
                            {tx.toEntityType === 'STAFF' && <User size={14} className="text-success" />}
                            {tx.toEntityType === 'SUPERVISOR' && <UserCheck size={14} className="text-warning" />}
                            {tx.toEntityType === 'CLIENT' && <User size={14} className="text-text-primary" />}
                            <span className="font-semibold">{tx.toEntityType || 'N/A'}</span>
                            {tx.toEntityId && (
                              <span className="font-mono text-text-muted bg-surface-elevated px-1.5 py-0.5 rounded text-[10px]">
                                {tx.toEntityId.slice(-6)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap font-mono font-bold">
                          {tx.quantity}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap text-xs text-text-secondary">
                          <div className="flex items-center gap-1.5">
                            <FileText size={13} className="text-text-muted" />
                            <span>{tx.deliveryNote || 'N/A'}</span>
                          </div>
                        </td>
                        <td className="py-3.5 pl-4 whitespace-nowrap text-xs text-text-secondary">
                          <div className="flex items-center gap-1.5">
                            <Calendar size={13} className="text-text-muted" />
                            <span>{new Date(tx.timestamp).toLocaleString()}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
