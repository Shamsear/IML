import { prisma } from '@/lib/prisma';
import { getStoreInventory } from '@/app/actions/transactions';
import { 
  Store, MapPin, Globe, EyeOff, Users, 
  Package, QrCode, ClipboardCheck, ArrowLeft, Printer
} from 'lucide-react';
import Link from 'next/link';

export default async function StoreDetailPage({ params, searchParams }) {
  // Await the params and searchParams objects in Next.js App Router
  const { id } = await params;
  const sParams = await searchParams;

  const invPage = parseInt(sParams?.invPage || '1', 10);
  const dispPage = parseInt(sParams?.dispPage || '1', 10);
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
      }
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

  // Pagination lists and totals
  const totalInvPages = Math.ceil(inventory.length / pageSize);
  const paginatedInventory = inventory.slice((invPage - 1) * pageSize, invPage * pageSize);

  const totalDispPages = Math.ceil(groupedDispatches.length / pageSize);
  const paginatedDispatches = groupedDispatches.slice((dispPage - 1) * pageSize, dispPage * pageSize);

  return (
    <div className="flex flex-col gap-6">
      {/* Back & Print Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Link href="/dashboard/stores" className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeft size={16} />
          <span>Back to Outlets</span>
        </Link>

        <Link 
          href={`/api/dashboard/stores/${id}/delivery-note`} 
          target="_blank" 
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-colors duration-200"
        >
          <Printer size={16} />
          <span>Download Store Stock Statement (PDF)</span>
        </Link>
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
      <div className="bg-surface border border-border rounded-xl p-5 shadow-sm flex flex-col gap-4">
        <div className="flex items-center gap-2 pb-3 border-b border-border">
          <Package size={18} className="text-primary" />
          <h3 className="font-display font-bold text-base text-text-primary">Current Stock Placed At Store</h3>
        </div>

        <div>
          {inventory.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center gap-3 text-text-muted">
              <ClipboardCheck size={36} />
              <p className="text-sm">This store currently holds no active inventory.</p>
              <Link href="/dashboard/outbound" className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary-hover shadow-sm transition-colors duration-200">
                Issue Stock to Outlet
              </Link>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto -mx-5">
                <div className="inline-block min-w-full align-middle px-5">
                  <table className="min-w-full divide-y divide-border text-sm">
                    <thead>
                      <tr className="text-left text-xs font-bold text-text-secondary uppercase tracking-wider">
                        <th className="pb-3 pr-4">Product Name</th>
                        <th className="pb-3 px-4">Brand</th>
                        <th className="pb-3 px-4 text-center">Quantity</th>
                        <th className="pb-3 pl-4">Barcodes / Serials</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-text-primary">
                      {paginatedInventory.map((item) => (
                        <tr key={item.productId} className="hover:bg-surface-elevated/20 transition-colors">
                          <td className="py-3 pr-4 font-semibold">{item.name}</td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="badge badge-info">{item.brandName}</span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-center font-mono font-bold text-base">{item.quantity}</td>
                          <td className="py-3 pl-4 whitespace-nowrap">
                            {item.isSerialized ? (
                              <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                                <QrCode size={13} className="text-success" />
                                <span className="max-w-[240px] truncate font-mono bg-surface-elevated px-1.5 py-0.5 rounded text-[10px]" title={item.serials.map(s => s.barcode).join(', ')}>
                                  {item.serials.map(s => s.barcode).join(', ')}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-text-muted">Bulk Goods</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Inventory Pagination Controls */}
              {totalInvPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-surface-elevated/20 text-xs mt-2 rounded-lg">
                  <span className="text-text-muted">
                    Showing <strong className="text-text-primary">{(invPage - 1) * pageSize + 1}</strong> to{" "}
                    <strong className="text-text-primary">
                      {Math.min(invPage * pageSize, inventory.length)}
                    </strong> of{" "}
                    <strong className="text-text-primary">{inventory.length}</strong> items
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/dashboard/stores/${id}?invPage=${Math.max(1, invPage - 1)}&dispPage=${dispPage}`}
                      className={`px-2.5 py-1.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary rounded-lg font-semibold transition-all duration-200 ${
                        invPage === 1 ? 'pointer-events-none opacity-50' : ''
                      }`}
                    >
                      Previous
                    </Link>
                    <Link
                      href={`/dashboard/stores/${id}?invPage=${Math.min(totalInvPages, invPage + 1)}&dispPage=${dispPage}`}
                      className={`px-2.5 py-1.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary rounded-lg font-semibold transition-all duration-200 ${
                        invPage === totalInvPages ? 'pointer-events-none opacity-50' : ''
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
          <div className="flex flex-col gap-2.5">
            {groupedDispatches.length === 0 ? (
              <div className="py-6 text-center text-xs text-text-muted">No dispatches recorded.</div>
            ) : (
              <>
                <div className="flex flex-col gap-2.5">
                  {paginatedDispatches.map(disp => (
                    <div key={`${disp.date}_${disp.brandId}_${disp.deliveryNote}`} className="p-3 bg-surface-elevated/40 border border-black/5 rounded-lg flex justify-between items-center text-xs">
                      <div className="min-w-0 flex-1 pr-2">
                        <strong className="text-text-primary block truncate font-mono">{disp.deliveryNote}</strong>
                        <span className="text-text-secondary block mt-0.5 text-[10px]">
                          {disp.date} — {disp.brandName}
                        </span>
                      </div>
                      <Link
                        href={`/api/dashboard/stores/${id}/delivery-note?date=${disp.date}&brandId=${disp.brandId}&dn=${disp.deliveryNote}`}
                        target="_blank"
                        className="p-1.5 hover:bg-success/10 text-success rounded-md transition-colors flex-shrink-0"
                        title="Print Delivery Note"
                      >
                        <Printer size={13} />
                      </Link>
                    </div>
                  ))}
                </div>

                {/* Dispatches Pagination Controls */}
                {totalDispPages > 1 && (
                  <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-surface-elevated/20 text-[10px] mt-2 rounded-lg">
                    <span className="text-text-muted">
                      Showing <strong className="text-text-primary">{(dispPage - 1) * pageSize + 1}</strong> to{" "}
                      <strong className="text-text-primary">
                        {Math.min(dispPage * pageSize, groupedDispatches.length)}
                      </strong> of{" "}
                      <strong className="text-text-primary">{groupedDispatches.length}</strong> notes
                    </span>
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/dashboard/stores/${id}?invPage=${invPage}&dispPage=${Math.max(1, dispPage - 1)}`}
                        className={`px-2 py-1 bg-surface border border-border hover:bg-surface-elevated text-text-secondary rounded-md font-semibold transition-colors duration-150 ${
                          dispPage === 1 ? 'pointer-events-none opacity-50' : ''
                        }`}
                      >
                        Prev
                      </Link>
                      <Link
                        href={`/dashboard/stores/${id}?invPage=${invPage}&dispPage=${Math.min(totalDispPages, dispPage + 1)}`}
                        className={`px-2 py-1 bg-surface border border-border hover:bg-surface-elevated text-text-secondary rounded-md font-semibold transition-colors duration-150 ${
                          dispPage === totalDispPages ? 'pointer-events-none opacity-50' : ''
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
      </div>
    </div>
  );
}
