'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { 
  LayoutDashboard, 
  Tag, 
  Package, 
  Store, 
  UserCheck, 
  Users, 
  FolderGit, 
  History,
  Activity,
  BarChart3,
  Settings,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  RotateCcw,
  Trash2,
  ShieldAlert,
  AlertCircle,
  Shirt,
  Calendar,
  Undo2,
} from 'lucide-react';

const navSections = [
  {
    label: 'Main',
    items: [
      { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Reports', href: '/dashboard/reports', icon: BarChart3 },
    ],
  },
  {
    label: 'Operations',
    items: [
      { name: 'Products', href: '/dashboard/products', icon: Package },
      { name: 'Inbound (Receive)', href: '/dashboard/inbound', icon: ArrowDownLeft },
      { name: 'Outbound (Dispatch)', href: '/dashboard/outbound', icon: ArrowUpRight },
      { name: 'Returns', href: '/dashboard/returns', icon: RotateCcw },
      { name: 'With Client', href: '/dashboard/client-returns', icon: Undo2 },
      { name: 'Mark as Used', href: '/dashboard/used', icon: Trash2 },
      { name: 'Expiry Tracking', href: '/dashboard/expiry', icon: Calendar },
      { name: 'Rebrand Stock', href: '/dashboard/rebrand', icon: RefreshCw },
      { name: 'Report Damage', href: '/dashboard/damage', icon: ShieldAlert },
      { name: 'Report Loss', href: '/dashboard/loss', icon: AlertCircle },
      { name: 'Uniform Assigning', href: '/dashboard/staff', icon: Shirt },
      { name: 'Ledger Logs', href: '/dashboard/transactions', icon: History },
    ],
  },
  {
    label: 'Administration',
    items: [
      { name: 'Brands', href: '/dashboard/brands', icon: Tag },
      { name: 'Stores', href: '/dashboard/stores', icon: Store },
      { name: 'Supervisors', href: '/dashboard/supervisors', icon: UserCheck },
    ],
  },
  {
    label: 'System',
    items: [
      { name: 'Settings', href: '/dashboard/settings', icon: Settings },
    ],
  },
];

export default function DashboardNav({ collapsed }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <nav className="flex flex-col gap-6">
      {navSections.map((section) => (
        <div key={section.label} className="flex flex-col gap-1.5">
          {!collapsed ? (
            <span className="px-3 text-[11px] font-bold tracking-wider text-text-muted uppercase">
              {section.label}
            </span>
          ) : (
            <div className="h-px bg-border my-1 mx-3" />
          )}
          
          <div className="flex flex-col gap-1">
            {section.items.map((item) => {
              const Icon = item.icon;
              let isActive;
              if (item.activePath) {
                // Items with a specific type query param (e.g. Report Damage / Report Loss)
                isActive = pathname.startsWith(item.activePath) && searchParams.get('type') === item.activeType;
              } else {
                isActive = item.href === '/dashboard' 
                  ? pathname === '/dashboard'
                  : pathname.startsWith(item.href);
              }
              
              return (
                <Link 
                  key={item.href} 
                  href={item.href} 
                  className={`flex items-center gap-3 rounded-lg text-sm font-semibold transition-all duration-200 group relative
                    ${collapsed ? 'justify-center p-2.5 has-tooltip' : 'px-3 py-2.5'}
                    ${isActive 
                      ? 'text-primary bg-primary/10 border-l-2 border-primary rounded-l-none' 
                      : 'text-text-secondary hover:text-text-primary hover:bg-black/5'
                    }
                  `}
                >
                  <Icon 
                    size={18} 
                    className={`transition-colors duration-200
                      ${isActive ? 'text-primary' : 'text-text-secondary group-hover:text-text-primary'}
                    `} 
                  />
                  {!collapsed && <span className="truncate">{item.name}</span>}
                  
                  {/* Subtle hover indicator dot if collapsed */}
                  {isActive && collapsed && (
                    <div className="absolute right-1 w-1.5 h-1.5 rounded-full bg-primary" />
                  )}

                  {collapsed && (
                    <span className="tooltip-box tooltip-right">{item.name}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
