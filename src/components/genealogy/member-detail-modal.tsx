'use client';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Member } from '@/lib/types';
import { useEffect, useState } from 'react';
import { Loader2, User, Calendar, Users, TrendingUp, Award, DollarSign, CheckCircle, XCircle, Mail, Phone, Briefcase, Store, Activity, TrendingDown, Clock, Hash, Building, RefreshCw, GitBranch, BarChart3 } from 'lucide-react';
import RankBadge from './rank-badge';
import { useI18n } from '@/lib/internationalization';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface MemberDetailModalProps {
  member: Member | null;
  isOpen: boolean;
  onClose: () => void;
}

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
    ecashBalance?: number;
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

interface MemberDetails {
  member: Member;
  sponsorInfo?: {
    id: string;
    memberId: string;
    fullName: string;
  } | null;
  placementParentInfo?: {
    id: string;
    memberId: string;
    fullName: string;
  } | null;
  pvData: {
    oldPV: number;
    newPV: number;
    totalPV: number;
    walletBalance: number;
    weakPV: number;
    strongPV: number;
    leftWaitingPV?: number;
    rightWaitingPV?: number;
  };
  bonuses: {
    stockBonus: number;
    dailyMatchBonus: number;
    binaryBonus: number;
    matchingBonus: number;
    totalBonus: number;
  } | null;
  team: {
    directRecruits: number;
    totalDownline: number;
    monthlyTeam: number;
  };
  maintainStatus: string;
  maintenanceDaysRemaining?: number;
  isMaintained?: boolean;
  canViewBonuses?: boolean;
}

export default function MemberDetailModal({ member, isOpen, onClose }: MemberDetailModalProps) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [memberDetails, setMemberDetails] = useState<MemberDetails | null>(null);

  useEffect(() => {
    if (member && isOpen) {
      fetchMemberDetails(member.id);
      fetchMemberBonusDetails(member.id);
    } else {
      setUserDetails(null);
      setMemberDetails(null);
    }
  }, [member, isOpen]);

  const fetchMemberDetails = async (memberId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/members/${memberId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUserDetails(data);
      } else {
        console.error('Failed to fetch member details');
      }
    } catch (error) {
      console.error('Failed to fetch member details:', error);
    }
  };

  const fetchMemberBonusDetails = async (memberId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/members/${memberId}/details`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMemberDetails(data);
      } else {
        console.error('Failed to fetch member bonus details');
      }
    } catch (error) {
      console.error('Failed to fetch member bonus details:', error);
    }
  };

  useEffect(() => {
    if (member && isOpen) {
      setLoading(true);
      Promise.all([fetchMemberDetails(member.id), fetchMemberBonusDetails(member.id)])
        .finally(() => setLoading(false));
    }
  }, [member, isOpen]);

  if (!member) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {t('admin.users.userInformation') || 'User Information'}
          </DialogTitle>
          <DialogDescription>
            {t('admin.users.viewDetailedInformation', { fullName: member.fullName }) || `View detailed information about ${member.fullName}`}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="animate-spin h-8 w-8" />
          </div>
        ) : userDetails ? (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">{t('admin.users.overview') || 'Overview'}</TabsTrigger>
              <TabsTrigger value="activity">{t('admin.users.activityTab') || 'Activity'}</TabsTrigger>
              <TabsTrigger value="details">{t('admin.users.details') || 'Details'}</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              {/* Profile Information */}
              <Card>
                <CardHeader>
                  <CardTitle>{t('admin.users.profileInformation') || 'Profile Information'}</CardTitle>
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
                          {userDetails.user.active ? t('admin.bi.active') || 'Active' : t('admin.bi.inactive') || 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">{t('profile.email') || 'Email'}</label>
                      <p className="text-base">{userDetails.user.email || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">{t('profile.phoneNumber') || 'Phone Number'}</label>
                      <p className="text-base">{userDetails.user.phoneNumber || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">{t('profile.accountType') || 'Account Type'}</label>
                      <p className="text-base">{userDetails.user.accountType || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">{t('profile.joinDate') || 'Join Date'}</label>
                      <p className="text-base">
                        {format(new Date(userDetails.user.joinDate || userDetails.user.createdAt), 'PPp')}
                      </p>
                    </div>
                    {userDetails.user.sponsor ? (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">{t('profile.sponsor') || 'Sponsor'}</label>
                        <p className="text-base">{userDetails.user.sponsor.fullName} ({userDetails.user.sponsor.memberId})</p>
                      </div>
                    ) : memberDetails?.sponsorInfo ? (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">{t('profile.sponsor') || 'Sponsor'}</label>
                        <p className="text-base">{memberDetails.sponsorInfo.fullName} ({memberDetails.sponsorInfo.memberId})</p>
                      </div>
                    ) : null}
                    {userDetails.user.company && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">{t('profile.company') || 'Company'}</label>
                        <p className="text-base">{userDetails.user.company.name}</p>
                      </div>
                    )}
                    {memberDetails?.placementParentInfo && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">{t('genealogy.upline') || 'Upline'}</label>
                        <p className="text-base">{memberDetails.placementParentInfo.fullName} ({memberDetails.placementParentInfo.memberId})</p>
                      </div>
                    )}
                  </div>

                  {/* E-Cash Balance - only visible to the member themselves, admin, or admin stock */}
                  {(userDetails.user.ecashBalance !== undefined) && memberDetails?.canViewBonuses && (
                    <div className="pt-4 border-t">
                      <label className="text-sm font-medium text-muted-foreground">{t('nav.eCash') || 'E-Cash Balance'}</label>
                      <p className="text-2xl font-bold">
                        {Number(userDetails.user.ecashBalance || 0).toFixed(2)} USD
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Bonuses & Performance */}
              {memberDetails && (
                <Card className="border-2 border-green-100 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-green-600" />
                      {t('genealogy.bonusesPerformance') || 'Bonuses & Performance'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Bonus information - only visible to the member themselves, admin, or admin stock */}
                    {memberDetails.canViewBonuses && memberDetails.bonuses && (
                      <>
                        <div className="flex justify-between items-center py-3 px-4 bg-white rounded-lg border border-gray-200 hover:border-green-300 transition-colors">
                          <span className="text-gray-700 font-medium">{t('genealogy.stockistBonus') || 'Stockist Bonus'}:</span>
                          <span className="font-bold text-gray-900 text-lg">${Number(memberDetails.bonuses.stockBonus || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center py-3 px-4 bg-white rounded-lg border border-gray-200 hover:border-green-300 transition-colors">
                          <span className="text-gray-700 font-medium">{t('genealogy.dailyMatchBonus') || 'Daily Match Bonus'}:</span>
                          <span className="font-bold text-gray-900 text-lg">${Number(memberDetails.bonuses.dailyMatchBonus || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center py-3 px-4 bg-white rounded-lg border border-gray-200 hover:border-green-300 transition-colors">
                          <span className="text-gray-700 font-medium">{t('genealogy.binaryBonus') || 'Binary Bonus'}:</span>
                          <span className="font-bold text-gray-900 text-lg">${Number(memberDetails.bonuses.binaryBonus || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center py-3 px-4 bg-white rounded-lg border border-gray-200 hover:border-green-300 transition-colors">
                          <span className="text-gray-700 font-medium">{t('genealogy.matchingBonus') || 'Matching Bonus'}:</span>
                          <span className="font-bold text-gray-900 text-lg">${Number(memberDetails.bonuses.matchingBonus || 0).toFixed(2)}</span>
                        </div>
                      </>
                    )}
                    {/* These fields are always visible to sponsors/parents viewing downlines */}
                    <div className="flex justify-between items-center py-3 px-4 bg-white rounded-lg border border-gray-200 hover:border-blue-200 transition-colors">
                      <span className="text-gray-700 font-medium">{t('genealogy.leftWaiting') || 'Left Waiting'}:</span>
                      <span className="font-bold text-blue-600 text-lg">{Number(memberDetails.pvData?.leftWaitingPV ?? 0).toFixed(0)} PV</span>
                    </div>
                    <div className="flex justify-between items-center py-3 px-4 bg-white rounded-lg border border-gray-200 hover:border-emerald-200 transition-colors">
                      <span className="text-gray-700 font-medium">{t('genealogy.rightWaiting') || 'Right Waiting'}:</span>
                      <span className="font-bold text-emerald-600 text-lg">{Number(memberDetails.pvData?.rightWaitingPV ?? 0).toFixed(0)} PV</span>
                    </div>
                    <div className="flex justify-between items-center py-3 px-4 bg-white rounded-lg border border-gray-200 hover:border-green-300 transition-colors">
                      <span className="text-gray-700 font-medium">{t('genealogy.maintainStatus') || 'Maintain Status'}:</span>
                      <span className={`font-bold text-lg ${memberDetails.isMaintained ? 'text-green-700' : 'text-red-600'}`}>
                        {memberDetails.isMaintained && memberDetails.maintenanceDaysRemaining 
                          ? t('genealogy.maintenanceDays', { days: String(memberDetails.maintenanceDaysRemaining) }) || `Maintenance (${memberDetails.maintenanceDaysRemaining} days)`
                          : t('genealogy.notMaintain') || 'Not Maintain'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-3 px-4 bg-white rounded-lg border border-gray-200 hover:border-green-300 transition-colors">
                      <span className="text-gray-700 font-medium">{t('genealogy.teamMonthly') || 'Team Monthly'}:</span>
                      <span className="font-bold text-gray-900 text-lg">{memberDetails.team.monthlyTeam || 0}</span>
                    </div>
                    {/* Total Bonus - only visible when bonus details are visible */}
                    {memberDetails.canViewBonuses && memberDetails.bonuses && (
                      <div className="flex justify-between items-center py-4 px-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border-2 border-green-300 mt-4">
                        <span className="text-green-800 font-bold text-lg">{t('genealogy.totalBonus') || 'Total Bonus'}:</span>
                        <span className="text-2xl font-bold text-green-700">${Number(memberDetails.bonuses.totalBonus || 0).toFixed(2)}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Activity Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    {t('admin.users.activitySummary') || 'Activity Summary (Last 30 Days)'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-green-700 dark:text-green-300">{t('admin.users.activeDays') || 'Active Days'}</p>
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
                          <p className="text-sm font-medium text-red-700 dark:text-red-300">{t('admin.users.inactiveDays') || 'Inactive Days'}</p>
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
                          <p className="text-sm font-medium text-blue-700 dark:text-blue-300">{t('admin.users.totalDays') || 'Total Days'}</p>
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
                          <p className="text-sm font-medium">{t('admin.users.lastActivity') || 'Last Activity'}</p>
                          <p className="text-base">
                            {format(new Date(userDetails.activity.lastActivityDate), 'PPp')}
                            {userDetails.activity.daysSinceLastActivity !== null && (
                              <span className="text-sm text-muted-foreground ml-2">
                                ({userDetails.activity.daysSinceLastActivity} {t('admin.users.daysAgo') || 'days ago'})
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
                  <CardTitle>{t('admin.users.recentActivity') || 'Recent Activity'}</CardTitle>
                  <CardDescription>
                    {t('admin.users.lastActivities', { count: userDetails.activity.recentActivities.length.toString() }) || `Last ${userDetails.activity.recentActivities.length} activities`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {userDetails.activity.recentActivities.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('admin.users.action') || 'Action'}</TableHead>
                          <TableHead>{t('admin.users.type') || 'Type'}</TableHead>
                          <TableHead>{t('admin.users.entity') || 'Entity'}</TableHead>
                          <TableHead>{t('admin.users.date') || 'Date'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userDetails.activity.recentActivities.map((activity) => {
                          // Extract type from changes object
                          const activityType = activity.changes?.type 
                            ? activity.changes.type 
                            : activity.entity === 'order' 
                              ? (activity.changes?.status || 'Order')
                              : activity.entity;
                          
                          return (
                            <TableRow key={activity.id}>
                              <TableCell>
                                <Badge variant="outline">{activity.action}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="capitalize">
                                  {activityType}
                                </Badge>
                              </TableCell>
                              <TableCell className="capitalize">{activity.entity}</TableCell>
                              <TableCell>
                                {format(new Date(activity.createdAt), 'PPp')}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      {t('admin.users.noRecentActivity') || 'No recent activity'}
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="details" className="space-y-4">
              {/* Additional Details - Two Column Layout */}
              <Card>
                <CardHeader>
                  <CardTitle>{t('admin.users.additionalDetails') || 'Additional Details'}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Team Size */}
                    <div className="flex items-start gap-4 p-4 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200/50 dark:border-blue-800/50 hover:shadow-md transition-all">
                      <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50">
                        <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <label className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide block mb-1">
                          {t('admin.users.teamSizeTotal') || 'Team Size (Total)'}
                        </label>
                        <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mb-1">
                          {userDetails.user.teamSize?.total || memberDetails?.team.totalDownline || 0}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-blue-600 dark:text-blue-400 mt-1">
                          <span className="flex items-center gap-1">
                            <GitBranch className="h-3 w-3" />
                            {t('admin.users.left') || 'Left'}: <span className="font-semibold">{userDetails.user.teamSize?.left || 0}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <GitBranch className="h-3 w-3" />
                            {t('admin.users.right') || 'Right'}: <span className="font-semibold">{userDetails.user.teamSize?.right || 0}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Stockist Level */}
                    {userDetails.user.storeOwnerLevel && (
                      <div className="flex items-start gap-4 p-4 rounded-lg bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border border-purple-200/50 dark:border-purple-800/50 hover:shadow-md transition-all">
                        <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/50">
                          <Store className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <label className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wide block mb-1">
                            {t('profile.stockistLevel') || 'Stockist Level'}
                          </label>
                          <p className="text-xl font-bold text-purple-900 dark:text-purple-100">
                            {userDetails.user.storeOwnerLevel}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Account Created */}
                    <div className="flex items-start gap-4 p-4 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-200/50 dark:border-green-800/50 hover:shadow-md transition-all">
                      <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/50">
                        <Calendar className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <label className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide block mb-1">
                          {t('admin.users.accountCreated') || 'Account Created'}
                        </label>
                        <p className="text-base font-semibold text-green-900 dark:text-green-100">
                          {format(new Date(userDetails.user.createdAt), 'PPp')}
                        </p>
                      </div>
                    </div>

                    {/* Last Updated */}
                    <div className="flex items-start gap-4 p-4 rounded-lg bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 border border-orange-200/50 dark:border-orange-800/50 hover:shadow-md transition-all">
                      <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/50">
                        <RefreshCw className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <label className="text-xs font-semibold text-orange-700 dark:text-orange-300 uppercase tracking-wide block mb-1">
                          {t('admin.users.lastUpdated') || 'Last Updated'}
                        </label>
                        <p className="text-base font-semibold text-orange-900 dark:text-orange-100">
                          {format(new Date(userDetails.user.updatedAt), 'PPp')}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* PV Data - Two Column Layout */}
              {memberDetails && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-primary" />
                      {t('genealogy.pvInformation') || 'PV Information'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Total PV */}
                      <div className="flex items-start gap-4 p-4 rounded-lg bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border border-blue-200/50 dark:border-blue-800/50 hover:shadow-md transition-all">
                        <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50">
                          <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <label className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide block mb-1">
                            {t('genealogy.totalPV') || 'Total PV'}
                          </label>
                          <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                            {Number(memberDetails.pvData.totalPV || 0).toFixed(2)}
                          </p>
                        </div>
                      </div>

                      {/* Monthly PV */}
                      <div className="flex items-start gap-4 p-4 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-200/50 dark:border-green-800/50 hover:shadow-md transition-all">
                        <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/50">
                          <Calendar className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <label className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide block mb-1">
                            {t('genealogy.monthlyPV') || 'Monthly PV'}
                          </label>
                          <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                            {Number(memberDetails.pvData.newPV || 0).toFixed(2)}
                          </p>
                        </div>
                      </div>

                      {/* Weak PV */}
                      <div className="flex items-start gap-4 p-4 rounded-lg bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 border border-red-200/50 dark:border-red-800/50 hover:shadow-md transition-all">
                        <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/50">
                          <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <label className="text-xs font-semibold text-red-700 dark:text-red-300 uppercase tracking-wide block mb-1">
                            {t('genealogy.weakPV') || 'Weak PV'}
                          </label>
                          <p className="text-xl font-bold text-red-900 dark:text-red-100">
                            {Number(memberDetails.pvData.weakPV || 0).toFixed(2)}
                          </p>
                        </div>
                      </div>

                      {/* Strong PV */}
                      <div className="flex items-start gap-4 p-4 rounded-lg bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200/50 dark:border-emerald-800/50 hover:shadow-md transition-all">
                        <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
                          <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <label className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide block mb-1">
                            {t('genealogy.strongPV') || 'Strong PV'}
                          </label>
                          <p className="text-xl font-bold text-emerald-900 dark:text-emerald-100">
                            {Number(memberDetails.pvData.strongPV || 0).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Team Information - Two Column Layout */}
              {memberDetails && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      {t('genealogy.teamInformation') || 'Team Information'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Direct Recruits */}
                      <div className="flex items-start gap-4 p-4 rounded-lg bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30 border border-indigo-200/50 dark:border-indigo-800/50 hover:shadow-md transition-all">
                        <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/50">
                          <User className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <label className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide block mb-1">
                            {t('genealogy.directRecruits') || 'Direct Recruits'}
                          </label>
                          <p className="text-2xl font-bold text-indigo-900 dark:text-indigo-100">
                            {memberDetails.team.directRecruits || 0}
                          </p>
                        </div>
                      </div>

                      {/* Total Downline */}
                      <div className="flex items-start gap-4 p-4 rounded-lg bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border border-purple-200/50 dark:border-purple-800/50 hover:shadow-md transition-all">
                        <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/50">
                          <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <label className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wide block mb-1">
                            {t('genealogy.totalDownline') || 'Total Downline'}
                          </label>
                          <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                            {memberDetails.team.totalDownline || 0}
                          </p>
                        </div>
                      </div>

                      {/* Monthly Team */}
                      <div className="flex items-start gap-4 p-4 rounded-lg bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/30 dark:to-cyan-950/30 border border-teal-200/50 dark:border-teal-800/50 hover:shadow-md transition-all md:col-span-2">
                        <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/50">
                          <Calendar className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <label className="text-xs font-semibold text-teal-700 dark:text-teal-300 uppercase tracking-wide block mb-1">
                            {t('genealogy.monthlyTeam') || 'Monthly Team'}
                          </label>
                          <p className="text-2xl font-bold text-teal-900 dark:text-teal-100">
                            {memberDetails.team.monthlyTeam || 0}
                          </p>
                          <p className="text-xs text-teal-600 dark:text-teal-400 mt-1">
                            {t('genealogy.monthlyTeamDescription') || 'New members this month'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            {t('admin.users.noUserData') || 'No user data available'}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('admin.users.close') || 'Close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
