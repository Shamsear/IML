'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Package, Edit2, Trash2, ArrowDownLeft, ArrowUpRight,
  RefreshCw, ShieldAlert, AlertCircle, Tag, QrCode, Calendar,
  MapPin, CheckCircle, XCircle, Clock, ExternalLink, Loader2, Copy
} from 'lucide-react';
import { getOptimizedImageUrl } from '@/lib/imagekit';
import { deleteProduct } from '@/app/actions/products';
import PageHeader from '@/components/PageHeader';
import StockBreakdown from '@/components/StockBreakdown';
import ImageLightbox from '@/components/ImageLightbox';
import ConfirmModal from '@/components/ConfirmModal';
import DeleteButton from '@/components/DeleteButton';

export default function ProductDetailClient({ product }) {
  const router = useRouter();
  const [lightboxImage, setLightboxImage] = useState(null);
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  const { stock, brand, serialNumbers, transactions, _count } = product;

  const handleDelete = async () => {
    await deleteProduct(product.id);
    router.push('/dashboard/products');
  };

  // Status badge for serials
  const serialStatusBadge = (status) => {
    const map = {
      AVAILABLE: { bg: 'bg-success/10 text-success border-success/20', label: 'Available' },
      USED: { bg: 'bg-primary/10 text-primary border-primary/20', label: 'Used' },
      DAMAGED: { bg: 'bg-danger/10 text-danger border-danger/20', label: 'Damaged' },
      LOST: { bg: 'bg-danger/10 text-danger border-danger/20', label: 'Lost' },
    };
    const s = map[status] || { bg: 'bg-surface-elevated text-text-secondary border-border', label: status };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${s.bg}`}>
        {s.label}
      </span>
    );
  };

  // Transaction type badge
  const txTypeBadge = (type) => {
    const map = {
      RECEIVE: { bg: 'bg-success/10 text-success', icon: ArrowDownLeft },
      ISSUE: { bg: 'bg-primary/10 text-primary', icon: ArrowUpRight },
      RETURN: { bg: 'bg-warning/10 text-warning', icon: RefreshCw },
      DAMAGE: { bg: 'bg-danger/10 text-danger', icon: ShieldAlert },
      LOST: { bg: 'bg-danger/10 text-danger', icon: AlertCircle },
      REBRAND_OUT: { bg: 'bg-secondary/10 text-secondary', icon: RefreshCw },
      REBRAND_IN: { bg: 'bg-secondary/10 text-secondary', icon: RefreshCw },
      CLIENT_RETURN: { bg: 'bg-warning/10 text-warning', icon: ArrowDownLeft },
    };
    const s = map[type] || { bg: 'bg-surface-elevated text-text-secondary', icon: Package };
    const Icon = s.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${s.bg}`}>
        <Icon size={10} />
        {type.replace('_', ' ')}
      </span>
    );
  };

  // Flags
  const flags = [
    product.isSerialized && { label: 'Serialized', icon: QrCode, color: 'text-primary' },
    product.isReturnable && { label: 'Returnable', icon: RefreshCw, color: 'text-success' },
    product.isDisposable && { label: 'Disposable', icon: Trash2, color: 'text-warning' },
    product.trackExpiry && { label: 'Track Expiry', icon: Calendar, color: 'text-danger' },
    product.stockCap && { label: `Cap: ${product.stockCap}`, icon: Package, color: 'text-secondary' },
    product.isPublic && { label: 'Public', icon: CheckCircle, color: 'text-success' },
  ].filter(Boolean);

  // Compute expiry batches from transactions
  const expiryBatches = (() => {
    if (!product.trackExpiry) return [];
    const batches = {};
    const now = new Date();
    transactions.forEach(tx => {
      const mDate = tx.manufactureDate ? new Date(tx.manufactureDate).toISOString().split('T')[0] : '';
      const eDate = tx.expiryDate ? new Date(tx.expiryDate).toISOString().split('T')[0] : '';
      const key = `${mDate}|${eDate}`;
      if (!batches[key]) {
        batches[key] = {
          manufactureDate: tx.manufactureDate,
          expiryDate: tx.expiryDate,
          quantity: 0,
        };
      }
      if (['RECEIVE', 'RETURN', 'REBRAND_IN'].includes(tx.transactionType)) {
        batches[key].quantity += tx.quantity;
      } else if (['ISSUE', 'DAMAGE', 'LOST', 'REBRAND_OUT'].includes(tx.transactionType)) {
        batches[key].quantity -= tx.quantity;
      }
    });
    return Object.values(batches)
      .filter(b => b.quantity > 0)
      .map(b => ({
        ...b,
        isExpired: b.expiryDate && new Date(b.expiryDate) < now,
        isExpiringSoon: b.expiryDate && !b.isExpired && new Date(b.expiryDate) < new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      }));
  })();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Package}
        title={product.name}
        description={`Product detail — ${brand?.name || 'No Brand'}`}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/inbound/new?productIds=${product.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-success/10 hover:bg-success/20 text-success text-xs font-bold rounded-lg border border-success/20 transition-colors"
            >
              <ArrowDownLeft size={13} />
              Receive
            </Link>
            <Link
              href={`/dashboard/outbound/new?productIds=${product.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-lg border border-primary/20 transition-colors"
            >
              <ArrowUpRight size={13} />
              Issue
            </Link>
            <Link
              href={`/dashboard/products/new?editId=${product.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-surface border border-border hover:bg-surface-elevated text-text-secondary text-xs font-bold rounded-lg transition-colors"
            >
              <Edit2 size={13} />
              Edit
            </Link>
            <DeleteButton onDelete={handleDelete} itemName={product.name} />
          </div>
        }
      />

      {/* Expiry Batches (for products tracking expiry) */}
      {product.trackExpiry && expiryBatches.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-sm text-text-primary flex items-center gap-2">
              <Calendar size={16} className="text-danger" />
              Expiry Batches ({expiryBatches.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-[10px] font-bold text-text-secondary uppercase">
                  <th className="pb-2 pr-4">Manufacture Date</th>
                  <th className="pb-2 pr-4">Expiry Date</th>
                  <th className="pb-2 pr-4">Available Qty</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {expiryBatches.map((b, i) => (
                  <tr key={i} className="hover:bg-surface-elevated/20">
                    <td className="py-2 pr-4 text-text-secondary">
                      {b.manufactureDate ? new Date(b.manufactureDate).toLocaleDateString('en-AE', { timeZone: 'Asia/Dubai' }) : '---'}
                    </td>
                    <td className="py-2 pr-4 text-text-secondary">
                      {b.expiryDate ? new Date(b.expiryDate).toLocaleDateString('en-AE', { timeZone: 'Asia/Dubai' }) : '---'}
                    </td>
                    <td className="py-2 pr-4 font-mono font-bold">{b.quantity}</td>
                    <td className="py-2">
                      {b.isExpired ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-danger/10 text-danger border border-danger/20">Expired</span>
                      ) : b.isExpiringSoon ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-warning/10 text-warning border border-warning/20">Expiring Soon</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-success/10 text-success border border-success/20">Valid</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top Section: Image + Info + Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Image & Info */}
        <div className="lg:col-span-1 bg-surface border border-border rounded-xl p-5 flex flex-col gap-4">
          {/* Image */}
          {product.imageUrl ? (
            <img
              src={getOptimizedImageUrl(product.imageUrl, 400, 400)}
              alt={product.name}
              className="w-full aspect-square object-cover bg-background rounded-lg border border-border cursor-zoom-in hover:brightness-95 transition-all"
              onClick={() => setLightboxImage({ url: product.imageUrl, name: product.name })}
            />
          ) : (
            <div className="w-full aspect-square bg-primary/5 rounded-lg border border-border flex items-center justify-center">
              <Package size={48} className="text-primary/30" />
            </div>
          )}

          {/* Basic Info */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Tag size={14} className="text-primary" />
              <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Brand</span>
              <Link href={`/dashboard/brands/${brand?.id}`} className="text-xs font-bold text-primary hover:underline ml-auto">
                {brand?.name || '---'}
              </Link>
            </div>

            {product.itemCode && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">SKU</span>
                <code className="text-xs font-mono bg-surface-elevated px-2 py-0.5 rounded border border-border ml-auto">
                  {product.itemCode}
                </code>
              </div>
            )}

            {product.category && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Category</span>
                <span className="text-xs font-semibold text-text-primary ml-auto">{product.category}</span>
              </div>
            )}

            {product.size && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Size</span>
                <span className="text-xs font-semibold text-text-primary ml-auto">{product.size}</span>
              </div>
            )}

            {(product.rack || product.shelf) && (
              <div className="flex items-center gap-2">
                <MapPin size={12} className="text-text-muted" />
                <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Location</span>
                <span className="text-xs font-semibold text-text-primary ml-auto">
                  {[product.rack, product.shelf].filter(Boolean).join(' / ')}
                </span>
              </div>
            )}
          </div>

          {/* Flags */}
          {flags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-3 border-t border-border">
              {flags.map((f, i) => {
                const Icon = f.icon;
                return (
                  <span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-surface-elevated border border-border ${f.color}`}>
                    <Icon size={10} />
                    {f.label}
                  </span>
                );
              })}
            </div>
          )}

          {/* Timestamps */}
          <div className="pt-3 border-t border-border flex flex-col gap-1">
            <span className="text-[10px] text-text-muted">
              Created: {new Date(product.createdAt).toLocaleDateString('en-AE', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <span className="text-[10px] text-text-muted">
              Updated: {new Date(product.updatedAt).toLocaleDateString('en-AE', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>

        {/* Stock Breakdown + Quick Stats */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Stock Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-success/5 border border-success/20 rounded-xl p-4 text-center">
              <span className="text-[10px] font-bold text-success uppercase tracking-wider block">Warehouse</span>
              <span className="text-2xl font-display font-black text-success block mt-1">{stock.warehouse}</span>
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
              <span className="text-[10px] font-bold text-primary uppercase tracking-wider block">Issued</span>
              <span className="text-2xl font-display font-black text-primary block mt-1">{stock.issued}</span>
            </div>
            <div className="bg-secondary/5 border border-secondary/20 rounded-xl p-4 text-center">
              <span className="text-[10px] font-bold text-secondary uppercase tracking-wider block">Used</span>
              <span className="text-2xl font-display font-black text-secondary block mt-1">{stock.used}</span>
            </div>
            <div className="bg-warning/5 border border-warning/20 rounded-xl p-4 text-center">
              <span className="text-[10px] font-bold text-warning uppercase tracking-wider block">With Client</span>
              <span className="text-2xl font-display font-black text-warning block mt-1">{stock.withClient}</span>
            </div>
          </div>

          {/* Detailed Stock Breakdown */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <h3 className="font-display font-bold text-sm text-text-primary mb-3">Stock Breakdown</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center">
                <span className="text-[10px] text-text-muted block">Purchased</span>
                <span className="font-mono font-bold text-lg">{stock.purchased}</span>
              </div>
              <div className="text-center">
                <span className="text-[10px] text-text-muted block">Warehouse</span>
                <span className="font-mono font-bold text-lg text-success">{stock.warehouse}</span>
              </div>
              <div className="text-center">
                <span className="text-[10px] text-text-muted block">Issued</span>
                <span className="font-mono font-bold text-lg">{stock.issued}</span>
              </div>
              <div className="text-center">
                <span className="text-[10px] text-text-muted block">Used</span>
                <span className="font-mono font-bold text-lg">{stock.used}</span>
              </div>
              <div className="text-center">
                <span className="text-[10px] text-text-muted block">Damage</span>
                <span className="font-mono font-bold text-lg text-danger">{stock.damage}</span>
              </div>
              <div className="text-center">
                <span className="text-[10px] text-text-muted block">Lost</span>
                <span className="font-mono font-bold text-lg text-danger">{stock.lost}</span>
              </div>
              <div className="text-center">
                <span className="text-[10px] text-text-muted block">With Client</span>
                <span className="font-mono font-bold text-lg text-primary">{stock.withClient}</span>
              </div>
              <div className="text-center">
                <span className="text-[10px] text-text-muted block">Rebrand</span>
                <span className="font-mono font-bold text-lg text-secondary">{stock.reBrand}</span>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-surface border border-border rounded-xl p-4 text-center">
              <span className="text-[10px] text-text-muted block">Transactions</span>
              <span className="font-display font-bold text-lg">{_count.transactions}</span>
            </div>
            <div className="bg-surface border border-border rounded-xl p-4 text-center">
              <span className="text-[10px] text-text-muted block">Serial Numbers</span>
              <span className="font-display font-bold text-lg">{_count.serialNumbers}</span>
            </div>
            <div className="bg-surface border border-border rounded-xl p-4 text-center">
              <span className="text-[10px] text-text-muted block">Total Stock</span>
              <span className="font-display font-bold text-lg text-primary">{stock.total}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Serial Numbers (if serialized) */}
      {product.isSerialized && serialNumbers.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-sm text-text-primary flex items-center gap-2">
              <QrCode size={16} className="text-primary" />
              Serial Numbers ({serialNumbers.length})
            </h3>
            <Link
              href={`/dashboard/products/new?editId=${product.id}`}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Manage Serials →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-[10px] font-bold text-text-secondary uppercase">
                  <th className="pb-2 pr-4">Barcode</th>
                  {serialNumbers.some(s => s.secondaryBarcode) && <th className="pb-2 pr-4">Secondary</th>}
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Location</th>
                  <th className="pb-2 pr-4">Mfg Date</th>
                  <th className="pb-2 pr-4">Expiry</th>
                  <th className="pb-2">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {serialNumbers.slice(0, 20).map((s) => (
                  <tr key={s.id} className="hover:bg-surface-elevated/20">
                    <td className="py-2 pr-4 font-mono font-semibold">{s.barcode}</td>
                    {serialNumbers.some(s => s.secondaryBarcode) && (
                      <td className="py-2 pr-4 font-mono text-text-secondary text-[10px]">{s.secondaryBarcode || '---'}</td>
                    )}
                    <td className="py-2 pr-4">{serialStatusBadge(s.status)}</td>
                    <td className="py-2 pr-4 text-text-secondary">{s.currentLocationType || '---'}</td>
                    <td className="py-2 pr-4 text-text-secondary text-[10px]">
                      {s.manufactureDate ? new Date(s.manufactureDate).toLocaleDateString('en-AE', { timeZone: 'Asia/Dubai' }) : '---'}
                    </td>
                    <td className="py-2 pr-4 text-text-secondary text-[10px]">
                      {s.expiryDate ? new Date(s.expiryDate).toLocaleDateString('en-AE', { timeZone: 'Asia/Dubai' }) : '---'}
                    </td>
                    <td className="py-2 text-text-secondary">
                      {new Date(s.createdAt).toLocaleDateString('en-AE', { timeZone: 'Asia/Dubai' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {serialNumbers.length > 20 && (
              <p className="text-[10px] text-text-muted mt-2 text-center">
                Showing 20 of {serialNumbers.length} serial numbers
              </p>
            )}
          </div>
        </div>
      )}

      {/* Transaction History */}
      {transactions.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-sm text-text-primary flex items-center gap-2">
              <Clock size={16} className="text-primary" />
              Transaction History ({transactions.length})
            </h3>
            <Link
              href={`/dashboard/transactions?productId=${product.id}`}
              className="text-xs font-semibold text-primary hover:underline"
            >
              View All →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-[10px] font-bold text-text-secondary uppercase">
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Type</th>
                  <th className="pb-2 pr-4">From</th>
                  <th className="pb-2 pr-4">To</th>
                  <th className="pb-2 pr-4">Qty</th>
                  {product.trackExpiry && <th className="pb-2 pr-4">Mfg Date</th>}
                  {product.trackExpiry && <th className="pb-2 pr-4">Exp Date</th>}
                  <th className="pb-2 pr-4">Note</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {transactions.slice(0, 20).map((tx) => (
                  <tr key={tx.id} className="hover:bg-surface-elevated/20">
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {new Date(tx.timestamp).toLocaleDateString('en-AE', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-2 pr-4">{txTypeBadge(tx.transactionType)}</td>
                    <td className="py-2 pr-4 text-text-secondary">{tx.fromEntityType || '---'}</td>
                    <td className="py-2 pr-4 text-text-secondary">{tx.toEntityType || '---'}</td>
                    <td className="py-2 pr-4 font-mono font-bold">{tx.quantity}</td>
                    {product.trackExpiry && (
                      <td className="py-2 pr-4 text-text-secondary text-[10px]">
                        {tx.manufactureDate ? new Date(tx.manufactureDate).toLocaleDateString('en-AE', { timeZone: 'Asia/Dubai' }) : '---'}
                      </td>
                    )}
                    {product.trackExpiry && (
                      <td className="py-2 pr-4 text-text-secondary text-[10px]">
                        {tx.expiryDate ? new Date(tx.expiryDate).toLocaleDateString('en-AE', { timeZone: 'Asia/Dubai' }) : '---'}
                      </td>
                    )}
                    <td className="py-2 pr-4 text-text-secondary max-w-[120px] truncate" title={tx.deliveryNote || tx.notes || ''}>
                      {tx.deliveryNote || tx.notes || '---'}
                    </td>
                    <td className="py-2">
                      {tx.returnStatus && (
                        <span className={`text-[10px] font-bold ${tx.returnStatus === 'RETURNED' ? 'text-success' : 'text-warning'}`}>
                          {tx.returnStatus}{tx.returnedQty ? ` (${tx.returnedQty})` : ''}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {transactions.length > 20 && (
              <p className="text-[10px] text-text-muted mt-2 text-center">
                Showing 20 of {transactions.length} transactions
              </p>
            )}
          </div>
        </div>
      )}

      {/* Empty states */}
      {transactions.length === 0 && serialNumbers.length === 0 && (
        <div className="bg-surface border border-border rounded-xl p-8 text-center">
          <Package size={32} className="text-text-muted mx-auto mb-3" />
          <p className="text-sm text-text-secondary">No transactions or serial numbers yet.</p>
          <p className="text-xs text-text-muted mt-1">Receive stock to get started.</p>
        </div>
      )}

      <ImageLightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />
    </div>
  );
}
