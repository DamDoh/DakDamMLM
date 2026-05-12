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
  KeyRound,
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
import { useEffect, useState } from 'react';
import type { Notification } from '@/services/server-actions';
import placeholderData from '@/lib/placeholder-images.json';

const imageMap = new Map(placeholderData.images.map(img => [img.id, img]));

const mainMenuItems = [
  { labelKey: 'nav.dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { labelKey: 'nav.binaryTree', icon: GitMerge, href: '/binary' },
  { labelKey: 'nav.inviteMember', icon: UserPlus, href: '/invite' },
];

const businessMenuItems = [
    { labelKey: 'nav.commissions', icon: HandCoins, href: '/commission' },
    { labelKey: 'nav.ecashWallet', icon: Wallet, href: '/ecash' },
    { labelKey: 'nav.orderHistory', icon: History, href: '/orders' },
];

const stockistMenuItems = [
    { labelKey: 'nav.myStock', icon: Boxes, href: '/my-stock' },
];

const storeMenuItems = [
    { labelKey: 'nav.products', icon: Package, href: '/product' },
    { labelKey: 'nav.shoppingCart', icon: ShoppingCart, href: '/cart' },
];

const accountMenuItems = [
    { labelKey: 'nav.profile', icon: User, href: '/profile' },
    { labelKey: 'nav.changePassword', icon: KeyRound, href: '/auth/change-password' },
];

const adminMenuItems = [
  { labelKey: 'nav.adminDashboard', icon: MonitorCheck, href: '/admin/dashboard' },
  { labelKey: 'nav.userManagement', icon: UsersIcon, href: '/admin/user-management' },
  { labelKey: 'nav.manageProducts', icon: Store, href: '/admin/products' },
  { labelKey: 'nav.businessRules', icon: Gavel, href: '/admin/business-rules' },
  { labelKey: 'nav.runCommissions', icon: Settings, href: '/admin/commissions' },
  { labelKey: 'nav.systemValidation', icon: TestTube2, href: '/admin/system-validation' },
  { labelKey: 'nav.compensationPlan', icon: FileText, href: '/admin/compensation-plan' },
  { labelKey: 'nav.genealogy', icon: GitMerge, href: '/binary' },
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


export function TopNav() {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const { logout } = useAuthContext();
  const context = useGenealogyContext();

  const { rootMember, loading } = context || { rootMember: null, loading: true };

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotifLoading, setNotifLoading] = useState(true);

  useEffect(() => {
    if (!rootMember) return;
    fetchNotifications();
  }, [rootMember]);

  const fetchNotifications = async () => {
    if (!rootMember) return;
    try {
      setNotifLoading(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const response = await fetch(`/api/notifications`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (response.ok) {
        const payload = await response.json();
        const notifs: Notification[] = Array.isArray(payload) ? payload : payload.data ?? [];
        setNotifications(notifs);
        setUnreadCount(notifs.filter((n: Notification) => !n.isRead).length);
      } else {
        console.error('Failed to fetch notifications');
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setNotifLoading(false);
    }
  };


  const isAdmin = rootMember?.isAdmin || false;
  const isStockist = !!rootMember?.storeOwnerLevel;

  const handleLogout = () => {
    logout();
    toast({
      title: t('nav.loggedOut'),
      description: t('nav.logoutSuccess'),
    });
    router.push('/auth/login');
  };

  if (loading || !rootMember) {
    return <TopNavSkeleton />;
  }
  
  const isLinkActive = (href: string) => pathname === href || (href !== '/' && pathname.startsWith(href) && href !== '/dashboard');

  const fullName = `${rootMember.firstName || ''} ${rootMember.surname || ''}`.trim();
  const avatarSrc = imageMap.get(rootMember.avatarUrl)?.imageUrl || rootMember.avatarUrl;

  const renderMenuItems = (items: {labelKey: string, icon: any, href: string}[]) => (
      items.map((item) => {
        const label = t(item.labelKey);
        const isActive = isLinkActive(item.href);
        return (
          <SidebarMenuItem key={label}>
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
      })
  );

  return (
    <>
      <SidebarHeader>
          <div className="flex items-center justify-between">
            <Link href="/profile" className="flex items-center gap-3 flex-shrink-0 hover:bg-primary/5 p-1 rounded-lg">
              <div className="relative">
                <Avatar className="h-8 w-8 border-2 border-background shadow-md">
                  <AvatarImage src={avatarSrc} alt={fullName} />
                  <AvatarFallback>{rootMember.firstName?.charAt(0) ?? ''}</AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-background rounded-full"></div>
              </div>
              <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-accent-foreground">{fullName}</p>
                  {rootMember.rank === 'Diamond' && (
                    <Crown className="h-3 w-3 text-yellow-500" />
                  )}
                  {rootMember.rank === 'Gold' && (
                    <Star className="h-3 w-3 text-yellow-600" />
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="capitalize">{rootMember.rank}</span>
                  <span>•</span>
                  <span>{rootMember.accountType}</span>
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
                  {renderMenuItems(mainMenuItems)}
              </SidebarGroup>
              <SidebarSeparator />

              <SidebarGroup className="p-2">
                  <SidebarGroupLabel>{t('nav.myBusiness')}</SidebarGroupLabel>
                  {renderMenuItems(businessMenuItems)}
                  {isStockist && renderMenuItems(stockistMenuItems)}
              </SidebarGroup>
              <SidebarSeparator />

              <SidebarGroup className="p-2">
                  <SidebarGroupLabel>{t('nav.store')}</SidebarGroupLabel>
                  {renderMenuItems(storeMenuItems)}
              </SidebarGroup>
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
