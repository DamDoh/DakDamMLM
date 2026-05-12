'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, User, Calendar, Activity, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/internationalization';
import type { Member } from '@/lib/types';
import { stockistLevelNames } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import RankBadge from '@/components/genealogy/rank-badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface UserDetails {
  user: Member & {
    sponsor?: {
      id: string;
      fullName: string;
      memberId: string;
      email: string;
    } | null;
    company?: {
      id: string;
      name: string;
    } | null;
    wallet?: {
      balance: number;
      currency: string;
    } | null;
    lastActivityDate?: string | null;
    createdAt: string;
    updatedAt: string;
  };
  activity: {
    activeDays: number;
    inactiveDays: number;
    totalDays: number;
    daysSinceLastActivity: number | null;
    lastActivityDate: string | null;
    recentActivities: Array<{
      id: string;
      action: string;
      entity: string;
      createdAt: string;
      changes?: any;
    }>;
  };
}

interface ViewUserDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  member: Member;
}

export default function ViewUserDialog({ isOpen, onOpenChange, member }: ViewUserDialogProps) {
  const [loading, setLoading] = useState(false);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const { toast } = useToast();
  const { t } = useI18n();

  useEffect(() => {
    if (isOpen && member) {
      fetchUserDetails();
    } else {
      setUserDetails(null);
    }
  }, [isOpen, member]);

  const fetchUserDetails = async () => {
    try {
      setLoading(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        toast({
          variant: 'destructive',
          title: 'Authentication Error',
          description: 'Please log in again',
        });
        onOpenChange(false);
        return;
      }

      const response = await fetch(`/api/members/${member.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        // Handle authentication errors (401/403)
        if (response.status === 401 || response.status === 403) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.message || errorData.error || 'Authentication failed';
          
          // Clear invalid token
          if (typeof window !== 'undefined') {
            localStorage.removeItem('auth_token');
          }
          
          toast({
            variant: 'destructive',
            title: 'Session Expired',
            description: 'Your session has expired. Please log in again.',
          });
          
          // Close dialog and redirect to login after a short delay
          onOpenChange(false);
          setTimeout(() => {
            if (typeof window !== 'undefined') {
              window.location.href = '/auth/login';
            }
          }, 1500);
          return;
        }
        
        // Handle other errors
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.error || 'Failed to fetch user details';
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setUserDetails(data);
    } catch (error: any) {
      // Only show error toast if it's not an auth error (already handled above)
      if (error.message && !error.message.includes('Authentication') && !error.message.includes('expired') && !error.message.includes('Invalid')) {
        console.error('Error fetching user details:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.message || 'Failed to load user details',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {t('admin.users.userInformation')}
          </DialogTitle>
          <DialogDescription>
            {t('admin.users.viewDetailedInformation', { fullName: member.fullName })}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="animate-spin h-8 w-8" />
          </div>
        ) : userDetails ? (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">{t('admin.users.overview')}</TabsTrigger>
              <TabsTrigger value="activity">{t('admin.users.activityTab')}</TabsTrigger>
              <TabsTrigger value="details">{t('admin.users.details')}</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              {/* User Profile */}
              <Card>
                <CardHeader>
                  <CardTitle>{t('admin.users.profileInformation')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={userDetails.user.avatarUrl} alt={userDetails.user.fullName} />
                      <AvatarFallback className="text-xl">
                        {userDetails.user.firstName?.charAt(0) || userDetails.user.fullName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold">{userDetails.user.fullName}</h3>
                      <p className="text-sm text-muted-foreground">{userDetails.user.memberId}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <RankBadge rank={userDetails.user.rank} />
                        <Badge variant={userDetails.user.active ? 'default' : 'destructive'} className={cn(
                          userDetails.user.active ? 'bg-green-500' : 'bg-red-500',
                          'text-white'
                        )}>
                          {userDetails.user.active ? t('admin.bi.active') : t('admin.bi.inactive')}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">{t('profile.email')}</label>
                      <p className="text-base">{userDetails.user.email || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">{t('profile.phoneNumber')}</label>
                      <p className="text-base">{userDetails.user.phoneNumber}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">{t('profile.accountType')}</label>
                      <p className="text-base">{userDetails.user.accountType}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">{t('profile.joinDate')}</label>
                      <p className="text-base">
                        {format(new Date(userDetails.user.joinDate), 'PPp')}
                      </p>
                    </div>
                    {userDetails.user.sponsor && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">{t('profile.sponsor')}</label>
                        <p className="text-base">{userDetails.user.sponsor.fullName} ({userDetails.user.sponsor.memberId})</p>
                      </div>
                    )}
                    {userDetails.user.company && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">{t('profile.company')}</label>
                        <p className="text-base">{userDetails.user.company.name}</p>
                      </div>
                    )}
                  </div>

                  {userDetails.user.wallet && (
                    <div className="pt-4 border-t">
                      <label className="text-sm font-medium text-muted-foreground">{t('admin.users.walletBalance')}</label>
                      <p className="text-2xl font-bold">
                        {userDetails.user.wallet.balance.toFixed(2)} {userDetails.user.wallet.currency}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Activity Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    {t('admin.users.activitySummary')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-green-700 dark:text-green-300">{t('admin.users.activeDays')}</p>
                          <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                            {userDetails.activity.activeDays}
                          </p>
                        </div>
                        <TrendingUp className="h-8 w-8 text-green-600 dark:text-green-400" />
                      </div>
                    </div>
                    <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-red-700 dark:text-red-300">{t('admin.users.inactiveDays')}</p>
                          <p className="text-2xl font-bold text-red-900 dark:text-red-100">
                            {userDetails.activity.inactiveDays}
                          </p>
                        </div>
                        <TrendingDown className="h-8 w-8 text-red-600 dark:text-red-400" />
                      </div>
                    </div>
                    <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-blue-700 dark:text-blue-300">{t('admin.users.totalDays')}</p>
                          <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                            {userDetails.activity.totalDays}
                          </p>
                        </div>
                        <Calendar className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>
                  </div>

                  {userDetails.activity.lastActivityDate && (
                    <div className="mt-4 p-4 bg-muted rounded-lg">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{t('admin.users.lastActivity')}</p>
                          <p className="text-base">
                            {format(new Date(userDetails.activity.lastActivityDate), 'PPp')}
                            {userDetails.activity.daysSinceLastActivity !== null && (
                              <span className="text-sm text-muted-foreground ml-2">
                                ({userDetails.activity.daysSinceLastActivity} {t('admin.users.daysAgo')})
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{t('admin.users.recentActivity')}</CardTitle>
                  <CardDescription>
                    {t('admin.users.lastActivities', { count: userDetails.activity.recentActivities.length.toString() })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {userDetails.activity.recentActivities.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('admin.users.action')}</TableHead>
                          <TableHead>{t('admin.users.entity')}</TableHead>
                          <TableHead>{t('admin.users.date')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userDetails.activity.recentActivities.map((activity) => (
                          <TableRow key={activity.id}>
                            <TableCell>
                              <Badge variant="outline">{activity.action}</Badge>
                            </TableCell>
                            <TableCell className="capitalize">{activity.entity}</TableCell>
                            <TableCell>
                              {format(new Date(activity.createdAt), 'PPp')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      {t('admin.users.noRecentActivity')}
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="details" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{t('admin.users.additionalDetails')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">{t('admin.users.teamSizeTotal')}</label>
                      <p className="text-base font-semibold">{userDetails.user.teamSize.total}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('admin.users.left')}: {userDetails.user.teamSize.left} | {t('admin.users.right')}: {userDetails.user.teamSize.right}
                      </p>
                    </div>
                    {userDetails.user.storeOwnerLevel && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">{t('profile.stockistLevel')}</label>
                        <p className="text-base">
                          {stockistLevelNames[userDetails.user.storeOwnerLevel as keyof typeof stockistLevelNames]
                            ? `${userDetails.user.storeOwnerLevel} - ${stockistLevelNames[userDetails.user.storeOwnerLevel as keyof typeof stockistLevelNames]}`
                            : userDetails.user.storeOwnerLevel}
                        </p>
                      </div>
                    )}
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">{t('admin.users.accountCreated')}</label>
                      <p className="text-base">
                        {format(new Date(userDetails.user.createdAt), 'PPp')}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">{t('admin.users.lastUpdated')}</label>
                      <p className="text-base">
                        {format(new Date(userDetails.user.updatedAt), 'PPp')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            {t('admin.users.noUserData')}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('admin.users.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

