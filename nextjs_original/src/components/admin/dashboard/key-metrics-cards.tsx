import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, TrendingUp, Shield } from 'lucide-react';
import type { Member, MemberAgreement } from '@/lib/types';
import { useI18n } from '@/lib/internationalization';

interface KeyMetricsCardsProps {
  members: Member[];
  agreements: MemberAgreement[];
}

export function KeyMetricsCards({ members, agreements }: KeyMetricsCardsProps) {
  const { t } = useI18n();

  const activeMembers = members.filter((m: Member) => m.active && !m.isAdmin);
  const inactiveMembers = members.filter((m: Member) => !m.active && !m.isAdmin);

  const getTotalPV = () => {
    return members.filter((m: Member) => !m.isAdmin).reduce((total: number, member: Member) => total + member.pv, 0);
  };

  const getComplianceRate = () => {
    if (activeMembers.length === 0) return 0;
    const compliantMemberIds = new Set(agreements.map((a) => a.memberId));
    const compliantActiveMembersCount = activeMembers.filter((m) => compliantMemberIds.has(m.id)).length;
    return Math.round((compliantActiveMembersCount / activeMembers.length) * 100);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('admin.totalMembers')}</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{members.filter((m: Member) => !m.isAdmin).length}</div>
          <p className="text-xs text-muted-foreground">
            {activeMembers.length} {t('admin.bi.active')}, {inactiveMembers.length} {t('admin.bi.inactive')}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('admin.bi.networkPv')}</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{getTotalPV().toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">{t('admin.bi.totalPv')}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('admin.bi.teamSize')}</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {members.filter((m: Member) => !m.isAdmin).length > 0 ? (members.filter((m: Member) => !m.isAdmin).reduce((acc, m) => acc + m.teamSize.total, 0) / members.filter((m: Member) => !m.isAdmin).length).toFixed(1) : 0}
          </div>
          <p className="text-xs text-muted-foreground">{t('admin.bi.totalDownline')}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('admin.bi.complianceRate')}</CardTitle>
          <Shield className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{getComplianceRate()}%</div>
          <p className="text-xs text-muted-foreground">{t('admin.bi.complianceDesc')}</p>
        </CardContent>
      </Card>
    </div>
  );
}