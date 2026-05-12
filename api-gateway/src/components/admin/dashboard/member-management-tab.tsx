import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Member } from '@/lib/types';
import { useI18n } from '@/lib/internationalization';

interface MemberManagementTabProps {
  members: Member[];
}

export function MemberManagementTab({ members }: MemberManagementTabProps) {
  const { t } = useI18n();

  const activeMembers = members.filter((m: Member) => m.active && !m.isAdmin);
  const inactiveMembers = members.filter((m: Member) => !m.active && !m.isAdmin);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.bi.activeMembers')}</CardTitle>
          <CardDescription>{t('admin.bi.activeMembersDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {activeMembers.slice(0, 10).map((member) => (
              <div key={member.id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{`${member.firstName} ${member.surname}`}</p>
                  <p className="text-sm text-muted-foreground">{member.email || member.phoneNumber}</p>
                </div>
                <Badge variant="secondary">{member.rank}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.bi.inactiveMembers')}</CardTitle>
          <CardDescription>{t('admin.bi.inactiveMembersDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {inactiveMembers.slice(0, 10).map((member) => (
              <div key={member.id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{`${member.firstName} ${member.surname}`}</p>
                  <p className="text-sm text-muted-foreground">{member.email || member.phoneNumber}</p>
                </div>
                <Badge variant="outline">{t('admin.bi.inactive')}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}