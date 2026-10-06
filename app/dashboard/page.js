import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { 
  Tag, Package, Store, Users, FolderGit, 
  ArrowRight, ArrowDownLeft, ArrowUpRight, ShieldAlert, 
  RefreshCw, TrendingUp, AlertTriangle, Eye, History, Shirt, BarChart3, Compass
} from 'lucide-react';
import Link from 'next/link';
import { getOptimizedImageUrl } from '@/lib/imagekit';
import AnimatedCounter from '@/components/AnimatedCounter';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect('/login');
  }

  const role = session.user?.role?.toUpperCase();
  const isReadOnly = role === 'VIEWER' || role === 'READ_ONLY' || role === 'READONLY';

  const [
    brandCount,
    productCount,
    storeCount,
    promoterCount,
    brands,
  ] = await Promise.all([
    prisma.brand.count(),
    prisma.product.count(),
    prisma.store.count(),
    prisma.staff.count(),
    prisma.brand.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        imageUrl: true,
        _count: {
          select: {
            products: true,
            stores: true
          }
        }
      }
    }),
  ]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const stats = [
    { name: 'Brands', count: brandCount, icon: Tag, color: 'text-primary bg-primary/10 border-primary/20', href: '/dashboard/brands' },
    { name: 'Products', count: productCount, icon: Package, color: 'text-secondary bg-secondary/10 border-secondary/20', href: '/dashboard/products' },
    { name: 'Outlets', count: storeCount, icon: Store, color: 'text-warning bg-warning/10 border-warning/20', href: '/dashboard/stores' },
    { name: 'Staff', count: promoterCount, icon: Users, color: 'text-danger bg-danger/10 border-danger/20', href: '/dashboard/staff' },
  ];

  const quickActions = isReadOnly ? [
    { label: 'Audit Ledger Logs', desc: 'Review movement history', href: '/dashboard/transactions', icon: History, color: 'text-primary bg-primary/10 border-primary/20 hover:border-primary/40' },
    { label: 'Products Inventory', desc: 'Browse catalog stock & SKUs', href: '/dashboard/products', icon: Package, color: 'text-secondary bg-secondary/10 border-secondary/20 hover:border-secondary/40' },
    { label: 'Staff Allocations', desc: 'View uniforms & staff logs', href: '/dashboard/staff', icon: Shirt, color: 'text-warning bg-warning/10 border-warning/20 hover:border-warning/40' },
    { label: 'Operational Reports', desc: 'Analytics and report exports', href: '/dashboard/reports', icon: BarChart3, color: 'text-success bg-success/10 border-success/20 hover:border-success/40' },
  ] : [
    { label: 'Receive Stock', desc: 'Log inbound inventory', href: '/dashboard/inbound', icon: ArrowDownLeft, color: 'text-success bg-success/10 border-success/20 hover:border-success/40' },
    { label: 'Dispatch Stock', desc: 'Issue to store or staff', href: '/dashboard/outbound', icon: ArrowUpRight, color: 'text-primary bg-primary/10 border-primary/20 hover:border-primary/40' },
    { label: 'Rebrand Items', desc: 'Swap product labels', href: '/dashboard/rebrand', icon: RefreshCw, color: 'text-secondary bg-secondary/10 border-secondary/20 hover:border-secondary/40' },
    { label: 'Report Damage', desc: 'Log damaged/lost items', href: '/dashboard/damage', icon: ShieldAlert, color: 'text-danger bg-danger/10 border-danger/20 hover:border-danger/40' },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Read-Only Notice Banner */}
      {isReadOnly && (
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-3.5 sm:p-4 flex items-center gap-3 animate-fade-in shadow-xs">
          <div className="w-9 h-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <Eye size={18} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-text-primary">Read-Only Viewer Account</span>
            <span className="text-[11px] text-text-secondary mt-0.5">
              You are signed in with read-only permissions. All catalog items, ledger records, and operational reports are available for review and export. Data creation and editing features are disabled.
            </span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-text-primary tracking-tight">
            {greeting}, {session.user.name}
          </h1>
          <p className="text-text-secondary text-sm">
            Here&apos;s a snapshot of your inventory operations.
          </p>
        </div>
        <Link 
          href="/dashboard/reports" 
          className="inline-flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg text-sm font-semibold text-text-secondary hover:text-text-primary hover:bg-surface-elevated hover:border-border-strong transition-all duration-150 shadow-xs"
        >
          <TrendingUp size={16} />
          <span>View Reports</span>
        </Link>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link 
              href={stat.href} 
              key={stat.name} 
              className="bg-surface border border-border rounded-xl p-3 sm:p-5 flex items-center justify-between shadow-xs hover:shadow-sm hover:border-border-strong transition-all duration-150 group"
            >
              <div className="flex flex-col gap-0.5 sm:gap-1 min-w-0">
                <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider truncate">{stat.name}</span>
                <span className="text-xl sm:text-2xl font-display font-bold text-text-primary group-hover:text-primary transition-colors">
                  <AnimatedCounter value={stat.count} />
                </span>
              </div>
              <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center border flex-shrink-0 ${stat.color}`}>
                <Icon className="w-4 h-4 sm:w-5 sm:h-5 stroke-[1.75]" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* All Brands Grid */}
        <div className="bg-surface border border-border rounded-xl p-5 lg:col-span-2 flex flex-col gap-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Tag size={18} className="text-primary stroke-[1.75]" />
              <h3 className="font-display font-bold text-base text-text-primary">All Brands</h3>
            </div>
            <Link 
              href="/dashboard/brands" 
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover transition-colors"
            >
              <span>{isReadOnly ? 'Browse Brands' : 'Manage Brands'}</span>
              <ArrowRight size={14} />
            </Link>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {brands.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center gap-3 text-text-muted col-span-2">
                <Tag size={36} className="stroke-[1.5]" />
                <p className="text-sm">No brands registered yet.</p>
                {!isReadOnly && (
                  <Link href="/dashboard/brands" className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary-hover shadow-xs transition-all duration-150">
                    Register First Brand
                  </Link>
                )}
              </div>
            ) : (
              brands.map((brand) => (
                <Link 
                  key={brand.id}
                  href={`/dashboard/brands/${brand.id}`}
                  className="bg-surface-elevated/40 border border-border/70 hover:border-primary/30 rounded-xl p-3.5 flex items-center justify-between transition-all duration-150 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {brand.imageUrl ? (
                      <div className="w-11 h-11 bg-white border border-border rounded-md ring-1 ring-inset ring-black/5 dark:ring-white/10 overflow-hidden flex items-center justify-center flex-shrink-0">
                        <img 
                          src={getOptimizedImageUrl(brand.imageUrl, 80, 80)} 
                          alt={brand.name} 
                          className="max-h-full max-w-full object-contain filter group-hover:scale-105 transition-transform duration-200"
                        />
                      </div>
                    ) : (
                      <div className="w-11 h-11 bg-primary/5 border border-primary/15 rounded-md flex items-center justify-center text-primary flex-shrink-0">
                        <Tag size={18} className="stroke-[1.75]" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-text-primary group-hover:text-primary transition-colors truncate">
                        {brand.name}
                      </h4>
                      <span className="text-[11px] text-text-secondary mt-0.5 block truncate max-w-[180px] tabular-nums">
                        {brand._count.products} products • {brand._count.stores} outlets
                      </span>
                    </div>
                  </div>
                  <ArrowRight size={14} className="text-text-muted group-hover:text-primary transition-colors flex-shrink-0" />
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions & Alerts */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          {/* Quick Actions Card */}
          <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2 pb-3 border-b border-border">
              {isReadOnly ? (
                <Compass size={18} className="text-primary" />
              ) : (
                <ShieldAlert size={18} className="text-secondary" />
              )}
              <h3 className="font-display font-bold text-base text-text-primary">
                {isReadOnly ? 'Quick Navigation' : 'Quick Actions'}
              </h3>
            </div>
            
            <div className="flex flex-col gap-2.5">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link 
                    key={action.label} 
                    href={action.href} 
                    className="flex items-center justify-between p-3 bg-surface-elevated/40 border border-black/5 rounded-lg hover:border-primary/25 transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${action.color}`}>
                        <Icon size={18} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-text-primary group-hover:text-primary transition-colors">{action.label}</span>
                        <span className="text-[11px] text-text-secondary mt-0.5">{action.desc}</span>
                      </div>
                    </div>
                    <ArrowRight size={14} className="text-text-muted group-hover:text-primary transition-colors duration-200" />
                  </Link>
                );
              })}
            </div>
          </div>


        </div>
      </div>
    </div>
  );
}
