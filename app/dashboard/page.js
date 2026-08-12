import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { 
  Tag, Package, Store, Users, FolderGit, 
  ArrowRight, ArrowDownLeft, ArrowUpRight, ShieldAlert, 
  RefreshCw, History, TrendingUp, AlertTriangle
} from 'lucide-react';
import Link from 'next/link';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect('/login');
  }

  const [
    brandCount,
    productCount,
    storeCount,
    promoterCount,
    recentTransactions,
    lowStockProducts,
  ] = await Promise.all([
    prisma.brand.count(),
    prisma.product.count(),
    prisma.store.count(),
    prisma.staff.count(),
    prisma.inventoryTransaction.findMany({
      take: 8,
      orderBy: { timestamp: 'desc' },
      include: {
        product: { select: { name: true } },
      }
    }),
    prisma.product.findMany({
      where: { stockCap: { not: null } },
      select: { id: true, name: true, stockCap: true },
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

  const quickActions = [
    { label: 'Receive Stock', desc: 'Log inbound inventory', href: '/dashboard/inbound', icon: ArrowDownLeft, color: 'text-success bg-success/10 border-success/20 hover:border-success/40' },
    { label: 'Dispatch Stock', desc: 'Issue to store or staff', href: '/dashboard/outbound', icon: ArrowUpRight, color: 'text-primary bg-primary/10 border-primary/20 hover:border-primary/40' },
    { label: 'Rebrand Items', desc: 'Swap product labels', href: '/dashboard/rebrand', icon: RefreshCw, color: 'text-secondary bg-secondary/10 border-secondary/20 hover:border-secondary/40' },
    { label: 'Report Damage', desc: 'Log damaged/lost items', href: '/dashboard/damage', icon: ShieldAlert, color: 'text-danger bg-danger/10 border-danger/20 hover:border-danger/40' },
  ];

  const txTypeColors = {
    RECEIVE: { bg: 'bg-success/10', color: 'text-success', label: 'Inbound' },
    ISSUE: { bg: 'bg-primary/10', color: 'text-primary', label: 'Dispatch' },
    RETURN: { bg: 'bg-warning/10', color: 'text-warning', label: 'Return' },
    DAMAGE: { bg: 'bg-danger/10', color: 'text-danger', label: 'Damage' },
    REBRAND_OUT: { bg: 'bg-danger/10', color: 'text-danger', label: 'Rebrand Out' },
    REBRAND_IN: { bg: 'bg-success/10', color: 'text-success', label: 'Rebrand In' },
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-extrabold text-text-primary tracking-tight">
            {greeting}, {session.user.name}
          </h1>
          <p className="text-text-secondary text-sm">
            Here&apos;s a snapshot of your inventory operations.
          </p>
        </div>
        <Link 
          href="/dashboard/reports" 
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-surface border border-border rounded-lg text-sm font-semibold text-text-secondary hover:text-text-primary hover:bg-surface-elevated hover:border-border-strong transition-all duration-200"
        >
          <TrendingUp size={16} />
          <span>View Reports</span>
        </Link>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link 
              href={stat.href} 
              key={stat.name} 
              className="bg-surface border border-border rounded-xl p-5 flex items-center justify-between shadow-sm hover:shadow-md hover:border-border-strong transition-all duration-200 group"
            >
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">{stat.name}</span>
                <span className="text-2xl font-display font-bold text-text-primary group-hover:text-primary transition-colors">{stat.count}</span>
              </div>
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center border ${stat.color}`}>
                <Icon size={20} />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="bg-surface border border-border rounded-xl p-5 lg:col-span-2 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <History size={18} className="text-primary" />
              <h3 className="font-display font-bold text-base text-text-primary">Recent Activity</h3>
            </div>
            <Link 
              href="/dashboard/transactions" 
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover transition-colors"
            >
              <span>View All</span>
              <ArrowRight size={14} />
            </Link>
          </div>
          
          <div className="flex flex-col gap-3">
            {recentTransactions.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center gap-3 text-text-muted">
                <History size={36} />
                <p className="text-sm">No inventory movements yet.</p>
                <Link href="/dashboard/inbound" className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary-hover shadow-sm transition-all duration-200">
                  Record First Transaction
                </Link>
              </div>
            ) : (
              recentTransactions.map((tx) => {
                const typeInfo = txTypeColors[tx.transactionType] || txTypeColors.ISSUE;
                return (
                  <div key={tx.id} className="flex items-center justify-between p-3.5 bg-surface-elevated/40 border border-black/5 rounded-lg hover:border-border transition-all duration-200">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${typeInfo.color === 'text-success' ? 'bg-success' : typeInfo.color === 'text-primary' ? 'bg-primary' : typeInfo.color === 'text-warning' ? 'bg-warning' : 'bg-danger'}`} />
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-text-primary leading-none">{tx.product.name}</span>
                        <span className="text-2xs text-text-muted mt-1">{new Date(tx.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold text-text-secondary">Qty: {tx.quantity}</span>
                      <span className={`badge ${typeInfo.bg} ${typeInfo.color}`}>
                        {typeInfo.label}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Quick Actions & Alerts */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          {/* Quick Actions Card */}
          <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2 pb-3 border-b border-border">
              <ShieldAlert size={18} className="text-secondary" />
              <h3 className="font-display font-bold text-base text-text-primary">Quick Actions</h3>
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

          {/* Low Stock Alerts */}
          {lowStockProducts.length > 0 && (
            <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-4">
              <div className="flex items-center gap-2 pb-3 border-b border-border">
                <AlertTriangle size={18} className="text-warning" />
                <span className="font-display font-bold text-base text-text-primary">Products with Stock Caps</span>
              </div>
              <div className="flex flex-col gap-2">
                {lowStockProducts.slice(0, 4).map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-surface-elevated/40 border border-black/5 rounded-lg">
                    <span className="text-xs font-semibold text-text-primary truncate max-w-[160px]">{p.name}</span>
                    <span className="badge badge-warning text-[10px]">Cap: {p.stockCap}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
