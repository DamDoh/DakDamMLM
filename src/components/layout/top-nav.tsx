'use client';

import {
  User,
  History,
  UserPlus,
  GitMerge,
  HandCoins,
  Wallet,
  ShoppingCart,
  Package,
  LogOut,
  LayoutDashboard,
  Settings,
  Store,
  Crown,
  Star,
  MonitorCheck,
  TestTube2,
  Users as UsersIcon,
  FileText,
  Boxes,
  Gavel,
  Coins,
  GitBranch,
  ListChecks,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  SidebarTrigger,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Skeleton } from '../ui/skeleton';
import { useGenealogyContext } from '@/context/genealogy-context';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/internationalization';
import { useAuthContext } from '@/context/auth-context';
import { useEffect, useState, useMemo } from 'react';
import type { Notification } from '@/services/server-actions';
import placeholderData from '@/lib/placeholder-images.json';
import RankBadge from '@/components/genealogy/rank-badge';
import { cn } from '@/lib/utils';
import { stockistLevels } from '@/lib/types';
import type { StockistLevel } from '@/lib/types';

const imageMap = new Map(placeholderData.images.map(img => [img.id, img]));

const mainMenuItems = [
  { labelKey: 'nav.dashboard', icon: LayoutDashboard, href: '/dashboard', priority: 'high' },
  { labelKey: 'nav.inviteMember', icon: UserPlus, href: '/invite', priority: 'high' },
  { labelKey: 'nav.binaryTree', icon: GitMerge, href: '/binary', priority: 'medium' },
];

const businessMenuItems = [
  { labelKey: 'nav.commissions', icon: HandCoins, href: '/commission', priority: 'high' },
  { labelKey: 'nav.ecashWallet', icon: Wallet, href: '/ecash', priority: 'high' },
  { labelKey: 'nav.orderHistory', icon: History, href: '/orders', priority: 'medium' },
];

// Other stockist-specific menu items
const stockistMenuItems: Array<{ labelKey: string; icon: any; href: string }> = [
  { labelKey: 'nav.manageOrders', icon: ShoppingCart, href: '/adminStock/orders' },
  { labelKey: 'nav.binaryStock', icon: GitBranch, href: '/binary-stock' },
];

const storeMenuItems = [
  { labelKey: 'nav.products', icon: Package, href: '/product', priority: 'high' },
  { labelKey: 'nav.shoppingCart', icon: ShoppingCart, href: '/cart', priority: 'high' },
];

const accountMenuItems = [
  { labelKey: 'nav.profile', icon: User, href: '/profile', priority: 'high' },
];

const adminMenuItems = [
  { labelKey: 'nav.adminDashboard', icon: MonitorCheck, href: '/admin/dashboard' },
  { labelKey: 'nav.userManagement', icon: UsersIcon, href: '/admin/user-management' },
  { labelKey: 'nav.manageProducts', icon: Store, href: '/admin/products' },
  { labelKey: 'nav.manageOrders', icon: ShoppingCart, href: '/admin/orders' },
  { labelKey: 'nav.stockItems', icon: Package, href: '/admin/stock-items' },
  { labelKey: 'nav.binaryStock', icon: GitBranch, href: '/admin/binary-stock' },
  { labelKey: 'nav.businessRules', icon: Gavel, href: '/admin/business-rules' },
  { labelKey: 'nav.runCommissions', icon: Settings, href: '/admin/commissions' },
  { labelKey: 'nav.systemValidation', icon: TestTube2, href: '/admin/system-validation' },
  { labelKey: 'nav.compensationPlan', icon: FileText, href: '/admin/compensation-plan' },
  { labelKey: 'nav.genealogy', icon: GitMerge, href: '/binary' },
  { labelKey: 'nav.eCash', icon: Coins, href: '/e-cash' },
  { labelKey: 'nav.topupRequests', icon: Coins, href: '/admin/topup-requests' },
  { labelKey: 'nav.withdrawalRequests', icon: Coins, href: '/admin/withdrawal-requests' },
  { labelKey: 'register.admin.title', icon: UserPlus, href: '/register/admin' },
];


const TopNavSkeleton = () => (
  <div className="flex h-full w-full flex-col">
    <SidebarHeader>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-5 w-24" />
        </div>
        <Skeleton className="h-7 w-7" />
      </div>
    </SidebarHeader>
    <SidebarContent className="p-2">
      <div className="flex flex-col gap-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </SidebarContent>
    <SidebarFooter>
      <Skeleton className="h-8 w-full" />
    </SidebarFooter>
  </div>
);


// Helper function to convert rank name to translation key
function getRankTranslationKey(rank: string | null | undefined): string {
  if (!rank) return '';
  // Handle special cases with spaces or special characters
  const rankMap: Record<string, string> = {
    'Double President': 'rank.doublePresident',
    'Super Diamond': 'rank.superDiamond',
    'Half STAR': 'rank.halfStar',
    'STAR': 'rank.star',
    'Blue Diamond': 'rank.blueDiamond',
    'Black Diamond': 'rank.blackDiamond',
    'Blue Emerald': 'rank.blueEmerald',
    'Double Diamond': 'rank.doubleDiamond',
  };

  if (rankMap[rank]) {
    return rankMap[rank];
  }

  // Default: lowercase the rank name
  return `rank.${rank.toLowerCase()}`;
}

// Helper function to convert account type to translation key
function getAccountTypeTranslationKey(accountType: string | null | undefined): string {
  if (!accountType) return '';
  return `account.${accountType.toLowerCase()}`;
}

export function TopNav() {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const { logout, user: authUser } = useAuthContext();
  const context = useGenealogyContext();

  // Mobile detection for simplified navigation
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const { rootMember, loading, allMembersMap, userId } = context || { rootMember: null, loading: true, allMembersMap: new Map(), userId: null };

  // Get authenticated user's member data for sidebar profile (always show admin's profile, not viewed member)
  const sidebarMember = useMemo(() => {
    if (!authUser?.id) {
      // If no authenticated user, use rootMember as fallback
      return rootMember;
    }

    // If allMembersMap is available, try to find authenticated user
    if (allMembersMap && allMembersMap.size > 0) {
      const authMember = allMembersMap.get(authUser.id);
      if (authMember) {
        return authMember;
      }
    }

    // Fallback to rootMember if authMember not found
    return rootMember;
  }, [authUser?.id, allMembersMap, rootMember]);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotifLoading, setNotifLoading] = useState(true);

  useEffect(() => {
    if (!sidebarMember) return;

    // Fetch immediately
    fetchNotifications();

    // Set up polling every 60 seconds to avoid rate limiting
    const interval = setInterval(() => {
      fetchNotifications();
    }, 60000);

    return () => clearInterval(interval);
  }, [sidebarMember]);

  const fetchNotifications = async () => {
    if (!sidebarMember) return;
    try {
      setNotifLoading(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

      // Don't fetch if no token
      if (!token) {
        setNotifications([]);
        setUnreadCount(0);
        return;
      }

      const response = await fetch(`/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const payload = await response.json();
        const notifs: Notification[] = Array.isArray(payload) ? payload : payload.data ?? [];
        setNotifications(notifs);
        setUnreadCount(notifs.filter((n: Notification) => !n.isRead).length);
      } else {
        // Get error details from response
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));

        // Handle 401 (Unauthorized) silently - token expired/invalid is expected
        if (response.status === 401) {
          setNotifications([]);
          setUnreadCount(0);
          // Don't show toast for auth errors - user will be redirected to login
        } else if (response.status === 429) {
          // Rate limited - silently handle, will retry on next interval
          console.debug('Rate limited on notifications, will retry later');
          setNotifLoading(false);
        } else {
          // Show toast for other errors
          toast({
            variant: 'destructive',
            title: 'Failed to load notifications',
            description: errorData.message || 'Unable to fetch notifications. Please try again later.',
          });
          setNotifications([]);
          setUnreadCount(0);
        }
      }
    } catch (error) {
      // Only show toast for unexpected errors, not network/auth errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (!errorMessage.includes('token') && !errorMessage.includes('Unauthorized')) {
        toast({
          variant: 'destructive',
          title: 'Error loading notifications',
          description: 'An unexpected error occurred. Please try again later.',
        });
      }
      // Set empty arrays on error to prevent UI issues
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setNotifLoading(false);
    }
  };


  // Use authenticated user's admin status for sidebar, not rootMember (which changes when viewing member downlines)
  const isAdmin = authUser?.isAdmin || false;
  // Use sidebarMember (authenticated user) for stockist check, not rootMember
  const isStockist = !!sidebarMember?.storeOwnerLevel;

  // Check if user has stockist level S, M, C, or D (use sidebarMember for consistency)
  const hasStockistLevel = useMemo(() => {
    if (!sidebarMember?.storeOwnerLevel) return false;
    return stockistLevels.includes(sidebarMember.storeOwnerLevel as StockistLevel);
  }, [sidebarMember?.storeOwnerLevel]);

  // Filter stockist menu items: Level S cannot access Binary Stock
  const filteredStockistMenuItems = useMemo(() => {
    if (sidebarMember?.storeOwnerLevel === 'S') {
      // Exclude Binary Stock for level S
      return stockistMenuItems.filter(item => item.href !== '/binary-stock');
    }
    return stockistMenuItems;
  }, [sidebarMember?.storeOwnerLevel]);

  const handleLogout = () => {
    logout();
    toast({
      title: t('nav.loggedOut'),
      description: t('nav.logoutSuccess'),
    });
    router.push('/auth/login');
  };

  if (loading || !sidebarMember) {
    return <TopNavSkeleton />;
  }

  const isLinkActive = (href: string) => pathname === href || (href !== '/' && pathname.startsWith(href) && href !== '/dashboard');

  // Use sidebarMember (authenticated user) for profile display, not rootMember (viewed member)
  const fullName = `${sidebarMember.firstName || ''} ${sidebarMember.surname || ''}`.trim();
  const avatarSrc = imageMap.get(sidebarMember.avatarUrl)?.imageUrl || sidebarMember.avatarUrl;

  const renderMenuItems = (items: Array<{ labelKey?: string, label?: string, icon: any, href: string, priority?: string, requiresAdminStock?: boolean }>, isMobile = false) => {
    // On mobile, only show high priority items to reduce cognitive load
    const filteredItems = isMobile ? items.filter(item => item.priority === 'high') : items;

    return filteredItems.map((item, index) => {
      let label = item.labelKey ? t(item.labelKey) : (item.label || '');
      // For my-stock link, always show "My Stock"
      if (item.href === '/my-stock') {
        label = t('nav.myStock');
      }
      const isActive = isLinkActive(item.href);
      // Use href as key since it's guaranteed to be unique
      const uniqueKey = item.href || `menu-item-${index}`;
      return (
        <SidebarMenuItem key={uniqueKey}>
          <SidebarMenuButton
            asChild
            isActive={isActive}
            tooltip={label}
            size="sm"
          >
            <Link href={item.href}>
              <item.icon />
              <span className="group-data-[collapsible=icon]:hidden">{label}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    });
  };
    })
  );

  return (
    <>
      <SidebarHeader>
        <div className="flex items-center justify-between">
          <Link href="/profile" className="flex items-center gap-3 flex-shrink-0 hover:bg-primary/5 p-1 rounded-lg">
            <div className="relative">
              <div className="relative">
                {sidebarMember.rank && sidebarMember.rank !== 'Member' ? (
                  /* Show only rank logo when rank is selected */
                  <div className="h-8 w-8 rounded-full overflow-hidden flex items-center justify-center">
                    <RankBadge rank={sidebarMember.rank} className="h-8 w-8 rounded-full" />
                  </div>
                ) : (
                  /* Show avatar when no rank or Member rank */
                  <Avatar className="h-8 w-8 border-2 border-background shadow-md">
                    <AvatarImage src={avatarSrc} alt={fullName} />
                    <AvatarFallback>{sidebarMember.firstName?.charAt(0) ?? ''}</AvatarFallback>
                  </Avatar>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-background rounded-full z-10"></div>
            </div>
            <div className="flex flex-col group-data-[collapsible=icon]:hidden">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-accent-foreground">{fullName}</p>
                {sidebarMember.rank === 'Diamond' && (
                  <Crown className="h-3 w-3 text-yellow-500" />
                )}
                {sidebarMember.rank === 'Gold' && (
                  <Star className="h-3 w-3 text-yellow-600" />
                )}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>{sidebarMember.rank}</span>
                <span>•</span>
                <span>
                  {sidebarMember.accountType
                    ? (() => {
                      const translationKey = getAccountTypeTranslationKey(sidebarMember.accountType);
                      const translated = t(translationKey as any);
                      // Check if translation was successful (not the key itself)
                      return translated && !translated.startsWith('account.') ? translated : sidebarMember.accountType;
                    })()
                    : 'Customer'}
                </span>
                {sidebarMember.storeOwnerLevel && stockistLevels.includes(sidebarMember.storeOwnerLevel as StockistLevel) && (
                  <>
                    <span>•</span>
                    <span className="font-medium text-foreground">{t('nav.stockistLevel')} ({sidebarMember.storeOwnerLevel})</span>
                  </>
                )}
              </div>
            </div>
          </Link>
          <SidebarTrigger className="group-data-[collapsible=icon]:flex" />
        </div>
      </SidebarHeader>

      <SidebarContent className="flex-1 overflow-y-auto p-0">
        <SidebarMenu>
          {isAdmin ? (
            <SidebarGroup className="p-2">
              <SidebarGroupLabel>{t('nav.admin')}</SidebarGroupLabel>
              {renderMenuItems(adminMenuItems)}
              <SidebarSeparator className="my-2" />
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleLogout} tooltip={t('nav.logout')} size="sm">
                  <LogOut />
                  <span className="group-data-[collapsible=icon]:hidden">{t('nav.logout')}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarGroup>
          ) : (
            <>
              <SidebarGroup className="p-2">
                {renderMenuItems(mainMenuItems, isMobile)}
              </SidebarGroup>
              <SidebarSeparator />

              <SidebarGroup className="p-2">
                  <SidebarGroupLabel>{t('nav.myBusiness')}</SidebarGroupLabel>
                  {renderMenuItems(
                    businessMenuItems.filter(item => {
                      // Hide "My Stock" for non-AdminStock users
                      if (item.href === '/my-stock' && (item as any).requiresAdminStock) {
                        return isStockist; // Only show if user is AdminStock
                      }
                      return true;
                    }),
                    isMobile
                  )}
                  {isStockist && !isMobile && renderMenuItems(filteredStockistMenuItems, isMobile)}
              </SidebarGroup>
              {!isMobile && (
                <>
                  <SidebarSeparator />
                  <SidebarGroup className="p-2">
                    <SidebarGroupLabel>{t('nav.store')}</SidebarGroupLabel>
                    {renderMenuItems(storeMenuItems, isMobile)}
                  </SidebarGroup>
                </>
              )}
              <SidebarSeparator />

              <SidebarGroup className="p-2">
                <SidebarGroupLabel>{t('nav.account')}</SidebarGroupLabel>
                {renderMenuItems(accountMenuItems)}
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={handleLogout} tooltip={t('nav.logout')} size="sm">
                    <LogOut />
                    <span className="group-data-[collapsible=icon]:hidden">{t('nav.logout')}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarGroup>
            </>
          )}

        </SidebarMenu>
      </SidebarContent>
    </>
  );
}
