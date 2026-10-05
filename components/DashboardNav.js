'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
    label: 'Daily Operations',
    items: [
      { name: 'Inbound (Receive)', href: '/dashboard/inbound', icon: ArrowDownLeft },
      { name: 'Outbound (Dispatch)', href: '/dashboard/outbound', icon: ArrowUpRight },
      { name: 'Returns', href: '/dashboard/returns', icon: RotateCcw },
      { name: 'With Client', href: '/dashboard/client-returns', icon: Undo2 },
      { name: 'Mark as Used', href: '/dashboard/used', icon: Trash2 },
      { name: 'Ledger Logs', href: '/dashboard/transactions', icon: History },
    ],
  },
  {
    label: 'Stock Management',
    items: [
      { name: 'Products', href: '/dashboard/products', icon: Package },
      { name: 'Staff & Promoters', href: '/dashboard/staff', icon: Shirt },
      { name: 'Rebrand Stock', href: '/dashboard/rebrand', icon: RefreshCw },
      { name: 'Report Damage', href: '/dashboard/damage', icon: ShieldAlert },
      { name: 'Report Loss', href: '/dashboard/loss', icon: AlertCircle },
      { name: 'Expiry Tracking', href: '/dashboard/expiry', icon: Calendar },
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

import { useRef, useEffect } from 'react';

export default function DashboardNav({ collapsed }) {
  const pathname = usePathname();
  const currentPath = pathname || '';
  const activeItemRef = useRef(null);

  // Auto-scroll active item into view on reload or route change
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [currentPath]);

  return (
    <nav className="flex flex-col gap-6">
      {navSections.map((section) => (
        <div key={section.label} className="flex flex-col gap-1.5">
          {/* Section label — always rendered, fades */}
          <span className={`px-3 text-[11px] font-bold tracking-wider text-text-muted uppercase transition-opacity duration-200 whitespace-nowrap overflow-hidden ${collapsed ? 'opacity-0 h-0 px-0 py-0 mb-0 pointer-events-none' : 'opacity-100'}`}>
            {section.label}
          </span>
          {/* Divider when collapsed */}
          <div className={`transition-opacity duration-200 h-px bg-border my-1 mx-3 ${collapsed ? 'opacity-100' : 'opacity-0 h-0 my-0 pointer-events-none'}`} />
          
          <div className="flex flex-col gap-1">
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = item.href === '/dashboard' 
                ? currentPath === '/dashboard'
                : (currentPath === item.href || currentPath.startsWith(`${item.href}/`));
              
              return (
                <Link 
                  key={item.href} 
                  href={item.href} 
                  prefetch={false}
                  ref={isActive ? activeItemRef : null}
                  className={`flex items-center rounded-lg text-sm transition-all duration-150 group relative has-tooltip
                    ${collapsed ? 'justify-center p-2.5' : 'px-3 py-2 gap-3'}
                    ${isActive 
                      ? 'text-primary font-semibold bg-primary/10 border border-primary/20 shadow-xs' 
                      : 'text-text-secondary font-medium hover:text-text-primary hover:bg-surface-elevated/70 border border-transparent'
                    }
                  `}
                >
                  <Icon 
                    size={18} 
                    className={`transition-colors duration-150 flex-shrink-0
                      ${isActive ? 'text-primary stroke-[2]' : 'text-text-secondary group-hover:text-text-primary stroke-[1.75]'}
                    `} 
                  />
                  {/* Label — always rendered, fades */}
                  <span className={`truncate transition-opacity duration-200 whitespace-nowrap overflow-hidden ${collapsed ? 'opacity-0 w-0 pointer-events-none' : 'opacity-100'}`}>
                    {item.name}
                  </span>
                  
                  {/* Active indicator dot if collapsed */}
                  {collapsed && isActive && (
                    <div className="absolute right-1.5 top-1.5 w-2 h-2 rounded-full bg-primary ring-2 ring-surface" />
                  )}

                  {/* Tooltip — only rendered in collapsed state */}
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
