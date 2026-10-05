'use client';

import { useState, useMemo } from 'react';
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
import Pagination from '@/components/Pagination';
import AnimatedCounter from '@/components/AnimatedCounter';
import SortableHeader from '@/components/SortableHeader';
import { useTableSort } from '@/hooks/useTableSort';
import DeliveryNoteLink from '@/components/DeliveryNoteLink';

export default function ProductDetailClient({ product }) {
  const router = useRouter();
  const [lightboxImage, setLightboxImage] = useState(null);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [serialPage, setSerialPage] = useState(1);
  const [txPage, setTxPage] = useState(1);
  const itemsPerPage = 20;

  const serialNumbers = product?.serialNumbers || [];
  const transactions = product?.transactions || [];
  const entityNames = product?.entityNames || {};
  const brand = product?.brand;
  const stock = product?.stock || {};
  const _count = product?._count || {};

  const formatEntity = (type, id) => {
    if (!type && !id) return '---';
    if (id && entityNames[id]) return entityNames[id];
    if (id === 'WH-MAIN' || id === 'MAIN' || type === 'WAREHOUSE') return 'Warehouse';
    if (type === 'SUPPLIER' || type === 'VENDOR') return (id && entityNames[id]) || id || 'Supplier';
    if (type === 'CLIENT' || type === 'DIRECT' || type === 'BRAND') return (id && entityNames[id]) || (id && id !== 'MAIN' ? id : 'Client Possession');
    if (id) return entityNames[id] || id;
    return type === 'WAREHOUSE' ? 'Warehouse' : (type || '---');
  };

  const serialCustomGetters = useMemo(() => ({
    barcode: (s) => s.barcode || '',
    secondaryBarcode: (s) => s.secondaryBarcode || '',
    status: (s) => s.status || '',
    location: (s) => formatEntity(s.currentLocationType, s.currentLocationId),
    manufactureDate: (s) => s.manufactureDate,
    expiryDate: (s) => s.expiryDate,
    createdAt: (s) => s.createdAt,
  }), [entityNames]);

  const {
    sortedItems: sortedSerials,
    sortField: serialSortField,
    sortDirection: serialSortDirection,
    handleSort: handleSerialSort,
  } = useTableSort(serialNumbers, 'barcode', 'asc', serialCustomGetters);

  const totalSerialPages = Math.ceil(sortedSerials.length / itemsPerPage);
  const paginatedSerials = sortedSerials.slice((serialPage - 1) * itemsPerPage, serialPage * itemsPerPage);

  const txCustomGetters = useMemo(() => ({
    date: (tx) => tx.timestamp,
    type: (tx) => tx.transactionType || '',
    from: (tx) => formatEntity(tx.fromEntityType, tx.fromEntityId),
    to: (tx) => formatEntity(tx.toEntityType, tx.toEntityId),
    quantity: (tx) => tx.quantity ?? 0,
    mfgDate: (tx) => tx.manufactureDate,
    expDate: (tx) => tx.expiryDate,
    deliveryNote: (tx) => tx.deliveryNote || '',
    status: (tx) => tx.transactionType || '',
  }), [entityNames]);

  const {
    sortedItems: sortedTxs,
    sortField: txSortField,
    sortDirection: txSortDirection,
    handleSort: handleTxSort,
  } = useTableSort(transactions, 'date', 'desc', txCustomGetters);

  const totalTxPages = Math.ceil(sortedTxs.length / itemsPerPage);
  const paginatedTxs = sortedTxs.slice((txPage - 1) * itemsPerPage, txPage * itemsPerPage);

  const handleDelete = async () => {
    await deleteProduct(product.id);
    router.push('/dashboard/products');
    router.refresh();
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

  const batchCustomGetters = useMemo(() => ({
    manufactureDate: (b) => b.manufactureDate,
    expiryDate: (b) => b.expiryDate,
    quantity: (b) => b.quantity ?? 0,
    status: (b) => (b.isExpired ? 0 : b.isExpiringSoon ? 1 : 2),
  }), []);

  const {
    sortedItems: sortedExpiryBatches,
    sortField: batchSortField,
    sortDirection: batchSortDirection,
    handleSort: handleBatchSort,
  } = useTableSort(expiryBatches, 'expiryDate', 'asc', batchCustomGetters);

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

      {/* Top Section: Image + Info + Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Image & Info */}
        <div className="lg:col-span-1 bg-surface border border-border rounded-xl p-5 flex flex-col gap-4">
          {/* Image */}
          {product.imageUrl ? (
            <img
              src={getOptimizedImageUrl(product.imageUrl, 400, 400)}
              alt={product.name}
              className="w-full aspect-square object-cover bg-background rounded-2xl border border-border cursor-zoom-in hover:brightness-95 transition-all"
              onClick={() => setLightboxImage({ url: product.imageUrl, name: product.name })}
            />
          ) : (
            <div className="w-full aspect-square bg-primary/5 rounded-md border border-border flex items-center justify-center">
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
              <span className="text-2xl font-display font-black text-success block mt-1 tabular-nums">
                <AnimatedCounter value={stock.warehouse} />
              </span>
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
              <span className="text-[10px] font-bold text-primary uppercase tracking-wider block">Issued</span>
              <span className="text-2xl font-display font-black text-primary block mt-1 tabular-nums">
                <AnimatedCounter value={stock.issued} />
              </span>
            </div>
            <div className="bg-secondary/5 border border-secondary/20 rounded-xl p-4 text-center">
              <span className="text-[10px] font-bold text-secondary uppercase tracking-wider block">Used</span>
              <span className="text-2xl font-display font-black text-secondary block mt-1 tabular-nums">
                <AnimatedCounter value={stock.used} />
              </span>
            </div>
            <div className="bg-warning/5 border border-warning/20 rounded-xl p-4 text-center">
              <span className="text-[10px] font-bold text-warning uppercase tracking-wider block">With Client</span>
              <span className="text-2xl font-display font-black text-warning block mt-1 tabular-nums">
                <AnimatedCounter value={stock.withClient} />
              </span>
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
                  <SortableHeader field="manufactureDate" currentField={batchSortField} direction={batchSortDirection} onSort={handleBatchSort} className="pb-2 pr-4">Manufacture Date</SortableHeader>
                  <SortableHeader field="expiryDate" currentField={batchSortField} direction={batchSortDirection} onSort={handleBatchSort} className="pb-2 pr-4">Expiry Date</SortableHeader>
                  <SortableHeader field="quantity" currentField={batchSortField} direction={batchSortDirection} onSort={handleBatchSort} className="pb-2 pr-4">Available Qty</SortableHeader>
                  <SortableHeader field="status" currentField={batchSortField} direction={batchSortDirection} onSort={handleBatchSort} className="pb-2">Status</SortableHeader>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {sortedExpiryBatches.map((b, i) => (
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

      {/* Serial Numbers (if serialized) */}
      {product.isSerialized && serialNumbers.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
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

          {/* Top Pagination for Serials */}
          <Pagination
            currentPage={serialPage}
            totalPages={totalSerialPages}
            totalItems={serialNumbers.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setSerialPage}
            itemLabel="serial numbers"
          />

          {/* Mobile Card View for Serials */}
          <div className="md:hidden flex flex-col divide-y divide-border">
            {paginatedSerials.map((s) => (
              <div key={s.id} className="py-2.5 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-text-primary">{s.barcode}</span>
                  {serialStatusBadge(s.status)}
                </div>
                <div className="flex items-center justify-between text-[11px] text-text-secondary">
                  <span>Location: {formatEntity(s.currentLocationType, s.currentLocationId)}</span>
                  <span>{new Date(s.createdAt).toLocaleDateString('en-AE', { timeZone: 'Asia/Dubai' })}</span>
                </div>
                {s.secondaryBarcode && (
                  <span className="text-[10px] font-mono text-text-muted">Sec: {s.secondaryBarcode}</span>
                )}
              </div>
            ))}
          </div>

          {/* Desktop Table View for Serials */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-[10px] font-bold text-text-secondary uppercase">
                  <SortableHeader field="barcode" currentField={serialSortField} direction={serialSortDirection} onSort={handleSerialSort} className="pb-2 pr-4">Barcode</SortableHeader>
                  {serialNumbers.some(s => s.secondaryBarcode) && <SortableHeader field="secondaryBarcode" currentField={serialSortField} direction={serialSortDirection} onSort={handleSerialSort} className="pb-2 pr-4">Secondary</SortableHeader>}
                  <SortableHeader field="status" currentField={serialSortField} direction={serialSortDirection} onSort={handleSerialSort} className="pb-2 pr-4">Status</SortableHeader>
                  <SortableHeader field="location" currentField={serialSortField} direction={serialSortDirection} onSort={handleSerialSort} className="pb-2 pr-4">Location</SortableHeader>
                  <SortableHeader field="manufactureDate" currentField={serialSortField} direction={serialSortDirection} onSort={handleSerialSort} className="pb-2 pr-4">Mfg Date</SortableHeader>
                  <SortableHeader field="expiryDate" currentField={serialSortField} direction={serialSortDirection} onSort={handleSerialSort} className="pb-2 pr-4">Expiry</SortableHeader>
                  <SortableHeader field="createdAt" currentField={serialSortField} direction={serialSortDirection} onSort={handleSerialSort} className="pb-2">Created</SortableHeader>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {paginatedSerials.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-elevated/20">
                    <td className="py-2 pr-4 font-mono font-semibold">{s.barcode}</td>
                    {serialNumbers.some(s => s.secondaryBarcode) && (
                      <td className="py-2 pr-4 font-mono text-text-secondary text-[10px]">{s.secondaryBarcode || '---'}</td>
                    )}
                    <td className="py-2 pr-4">{serialStatusBadge(s.status)}</td>
                    <td className="py-2 pr-4 text-text-secondary">{formatEntity(s.currentLocationType, s.currentLocationId)}</td>
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
          </div>

          {/* Bottom Pagination for Serials */}
          <Pagination
            currentPage={serialPage}
            totalPages={totalSerialPages}
            totalItems={serialNumbers.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setSerialPage}
            itemLabel="serial numbers"
          />
        </div>
      )}

      {/* Transaction History */}
      {transactions.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
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

          {/* Top Pagination for Transactions */}
          <Pagination
            currentPage={txPage}
            totalPages={totalTxPages}
            totalItems={transactions.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setTxPage}
            itemLabel="transactions"
          />

          {/* Mobile Card View for Transactions */}
          <div className="md:hidden flex flex-col divide-y divide-border">
            {paginatedTxs.map((tx) => (
              <div key={tx.id} className="py-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  {txTypeBadge(tx.transactionType)}
                  <span className="font-mono font-bold text-sm text-text-primary">
                    {tx.quantity} pcs
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-text-secondary">
                  <span>{formatEntity(tx.fromEntityType, tx.fromEntityId)} → {formatEntity(tx.toEntityType, tx.toEntityId)}</span>
                  <span className="text-[11px] text-text-muted">
                    {new Date(tx.timestamp).toLocaleDateString('en-AE', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short' })}
                  </span>
                </div>
                {tx.deliveryNote && (
                  <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px]">
                    <DeliveryNoteLink tx={tx} />
                    {tx.returnStatus && (
                      <span className={`text-[10px] font-bold ${tx.returnStatus === 'RETURNED' ? 'text-success' : 'text-warning'}`}>
                        {tx.returnStatus}{tx.returnedQty ? ` (${tx.returnedQty})` : ''}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop Table View for Transactions */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-[10px] font-bold text-text-secondary uppercase">
                  <SortableHeader field="date" currentField={txSortField} direction={txSortDirection} onSort={handleTxSort} className="pb-2 pr-4">Date</SortableHeader>
                  <SortableHeader field="type" currentField={txSortField} direction={txSortDirection} onSort={handleTxSort} className="pb-2 pr-4">Type</SortableHeader>
                  <SortableHeader field="from" currentField={txSortField} direction={txSortDirection} onSort={handleTxSort} className="pb-2 pr-4">From</SortableHeader>
                  <SortableHeader field="to" currentField={txSortField} direction={txSortDirection} onSort={handleTxSort} className="pb-2 pr-4">To</SortableHeader>
                  <SortableHeader field="quantity" currentField={txSortField} direction={txSortDirection} onSort={handleTxSort} className="pb-2 pr-4">Qty</SortableHeader>
                  {product.trackExpiry && <SortableHeader field="mfgDate" currentField={txSortField} direction={txSortDirection} onSort={handleTxSort} className="pb-2 pr-4">Mfg Date</SortableHeader>}
                  {product.trackExpiry && <SortableHeader field="expDate" currentField={txSortField} direction={txSortDirection} onSort={handleTxSort} className="pb-2 pr-4">Exp Date</SortableHeader>}
                  <SortableHeader field="deliveryNote" currentField={txSortField} direction={txSortDirection} onSort={handleTxSort} className="pb-2 pr-4">Delivery Note</SortableHeader>
                  <SortableHeader field="status" currentField={txSortField} direction={txSortDirection} onSort={handleTxSort} className="pb-2">Status</SortableHeader>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {paginatedTxs.map((tx) => (
                  <tr key={tx.id} className="hover:bg-surface-elevated/20">
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {new Date(tx.timestamp).toLocaleDateString('en-AE', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-2 pr-4">{txTypeBadge(tx.transactionType)}</td>
                    <td className="py-2 pr-4 text-text-secondary font-medium">{formatEntity(tx.fromEntityType, tx.fromEntityId)}</td>
                    <td className="py-2 pr-4 text-text-secondary font-medium">{formatEntity(tx.toEntityType, tx.toEntityId)}</td>
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
                    <td className="py-2 pr-4 text-text-secondary whitespace-nowrap" title={tx.deliveryNote || tx.notes || ''}>
                      <DeliveryNoteLink tx={tx} />
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
          </div>

          {/* Bottom Pagination for Transactions */}
          <Pagination
            currentPage={txPage}
            totalPages={totalTxPages}
            totalItems={transactions.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setTxPage}
            itemLabel="transactions"
          />
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
