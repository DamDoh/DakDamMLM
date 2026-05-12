
'use client';

import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  GitMerge,
  User,
  Store,
  Wallet
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/internationalization';
import { useGenealogyContext } from '@/context/genealogy-context';

export function BottomNav() {
  const { t } = useI18n();
  const pathname = usePathname();
  const context = useGenealogyContext();
  const { rootMember } = context || { rootMember: null };
  const isAdmin = rootMember?.isAdmin || false;

  const allNavItems = [
    { labelKey: 'nav.dashboard', href: '/dashboard', icon: LayoutDashboard },
    { labelKey: 'nav.genealogy', href: '/binary', icon: GitMerge },
    { labelKey: 'nav.store', href: '/product', icon: Store },
    { labelKey: 'nav.ecashWallet', href: '/ecash', icon: Wallet },
    { labelKey: 'nav.profile', href: '/profile', icon: User },
  ];

  // Admins should have access to E-cash wallet (they can receive E-cash from orders)
  const navItems = isAdmin ? allNavItems.filter(item => !['nav.dashboard', 'nav.genealogy'].includes(item.labelKey)) : allNavItems;

  return (
    <div className="md:hidden fixed bottom-0 left-0 z-50 w-full h-16 bg-card border-t border-border">
      <div className="grid h-full max-w-lg grid-cols-5 mx-auto font-medium">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const label = t(item.labelKey);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'inline-flex flex-col items-center justify-center px-2 hover:bg-muted group',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <item.icon className="w-5 h-5 mb-1" />
              <span className="text-xs text-center">{label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
