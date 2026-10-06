import { prisma } from '@/lib/prisma';
import { getStoreInventory } from '@/app/actions/transactions';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { 
  Store, MapPin, Globe, EyeOff, Users, 
  ClipboardCheck, ArrowLeft, Printer, Pencil
} from 'lucide-react';
import Link from 'next/link';
import StoreInventoryTable from './StoreInventoryTable';
import StoreDispatchesList from './StoreDispatchesList';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function StoreDetailPage({ params }) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role?.toUpperCase();
  const isReadOnly = role === 'VIEWER' || role === 'READ_ONLY' || role === 'READONLY';

  const { id } = await params;
  const pageSize = 15;

  // Fetch Store info, staff, and dispatches
  const [store, staff, inventory, dispatches] = await Promise.all([
    prisma.store.findUnique({ where: { id } }),
    prisma.staff.findMany({ where: { storeId: id } }),
    getStoreInventory(id),
    prisma.inventoryTransaction.findMany({
      where: {
        toEntityType: 'STORE',
        toEntityId: id,
        transactionType: 'ISSUE',
      },
      select: {
        id: true,
        quantity: true,
        deliveryNote: true,
        timestamp: true,
        product: {
          select: {
            id: true,
            brand: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: 200,
    })
  ]);

  if (!store) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <h3 className="text-lg font-bold text-text-primary">Store Not Found</h3>
        <Link href="/dashboard/stores" className="inline-flex items-center gap-2 px-4 py-2 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-sm font-semibold transition-colors">
          <ArrowLeft size={16} /> 
          <span>Back to Outlets</span>
        </Link>
      </div>
    );
  }

  // Group dispatches in memory by Date + Brand + Delivery Note
  const groupedDispatchesMap = {};
  for (const tx of dispatches) {
    const dateStr = tx.timestamp.toISOString().split('T')[0];
    const brand = tx.product.brand;
    const brandId = brand.id;
    const brandName = brand.name;
    const dn = tx.deliveryNote || 'UNASSIGNED';

    const groupKey = `${dateStr}_${brandId}_${dn}`;
    if (!groupedDispatchesMap[groupKey]) {
      groupedDispatchesMap[groupKey] = {
        date: dateStr,
        brandId,
        brandName,
        deliveryNote: dn,
        itemCount: 0,
        totalQuantity: 0,
      };
    }
    groupedDispatchesMap[groupKey].itemCount += 1;
    groupedDispatchesMap[groupKey].totalQuantity += tx.quantity;
  }

  const groupedDispatches = Object.values(groupedDispatchesMap).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="flex flex-col gap-6">
      {/* Back & Print Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Link href="/dashboard/stores" className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeft size={16} />
          <span>Back to Outlets</span>
        </Link>

        <div className="flex items-center gap-2">
          {!isReadOnly && (
            <Link 
              href={`/dashboard/stores/${id}/edit`} 
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-xs font-semibold transition-colors"
            >
              <Pencil size={14} />
              <span>Edit Outlet</span>
            </Link>
          )}
          <a 
            href={`/pdf-preview?url=${encodeURIComponent(`/api/dashboard/stores/${id}/delivery-note`)}&title=${encodeURIComponent(`${store.name} Stock Statement`)}`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-colors duration-200"
          >
            <Printer size={16} />
            <span className="hidden sm:inline">Store Stock Statement (PDF)</span>
            <span className="sm:hidden">PDF</span>
          </a>
        </div>
      </div>

      {/* Store Header Card */}
      <div className="bg-surface border border-border rounded-xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center gap-6">
        <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/10 flex items-center justify-center flex-shrink-0">
          <Store size={28} className="text-primary" />
        </div>
        <div className="flex-1 flex flex-col gap-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-display font-extrabold text-text-primary tracking-tight leading-none">{store.name}</h1>
            <span className="badge badge-info text-[10px]">{store.region}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-text-secondary mt-1">
            <MapPin size={14} className="text-text-muted flex-shrink-0" />
            <span>{store.location || 'No physical address logged'}</span>
          </div>
        </div>
        <div className="flex-shrink-0 self-start sm:self-center">
          {store.isPublic ? (
            <span className="badge badge-success"><Globe size={11} /> <span>Public Showcase</span></span>
          ) : (
            <span className="badge badge-warning"><EyeOff size={11} /> <span>Admin Only (Hidden)</span></span>
          )}
        </div>
      </div>

      {/* 1. Stock Placed At Store Panel */}
      <StoreInventoryTable
        inventory={inventory}
        storeId={id}
        pageSize={pageSize}
      />

      {/* 2. Equal 2-Column Bottom Grid for Promoters and Delivery Notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Promoters Panel */}
        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <Users size={18} className="text-secondary" />
            <h3 className="font-display font-bold text-sm text-text-primary">Placed Promoters ({staff.length})</h3>
          </div>
          <div className="flex flex-col gap-2.5">
            {staff.length === 0 ? (
              <div className="py-6 text-center text-xs text-text-muted">No staff placed at this outlet.</div>
            ) : (
              staff.map(person => (
                <div key={person.id} className="p-3 bg-surface-elevated/40 border border-black/5 rounded-lg flex justify-between items-center text-xs">
                  <div className="min-w-0">
                    <strong className="text-text-primary block truncate">{person.name}</strong>
                    <span className="text-text-secondary block mt-0.5">{person.phone || 'No Phone Number'}</span>
                  </div>
                  <span className="badge badge-info text-[9px] flex-shrink-0">Size: {person.shirtSize || 'M'}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Delivery Notes (Dispatches) Panel */}
        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <Printer size={18} className="text-success" />
            <h3 className="font-display font-bold text-sm text-text-primary">Delivery Notes (Dispatches)</h3>
          </div>
          <StoreDispatchesList
            storeId={id}
            groupedDispatches={groupedDispatches}
            pageSize={pageSize}
          />
        </div>
      </div>
    </div>
  );
}
