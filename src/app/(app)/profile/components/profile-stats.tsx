'use client';

import { Hash, Star, Calendar, Users, Store, UserCheck, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/lib/internationalization';
import RankBadge from '@/components/genealogy/rank-badge';
import type { Member } from '@/lib/types';

interface ProfileStatsProps {
  user: Member;
  isAdmin: boolean;
}

export default function ProfileStats({ user, isAdmin }: ProfileStatsProps) {
  const { t } = useI18n();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
      {!isAdmin && (
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
          <Hash className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-muted-foreground">{t('profile.memberId')}</p>
            <p className="font-semibold">{user.memberId}</p>
          </div>
        </div>
      )}
      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
        <UserCheck className="h-5 w-5 text-muted-foreground" />
        <div>
          <p className="text-muted-foreground">{t('profile.accountType')}</p>
          {isAdmin ? (
            <Badge variant='destructive' className="font-semibold flex items-center gap-1">
              <ShieldCheck className="h-4 w-4"/>{t('profile.administrator')}
            </Badge>
          ) : (
            <Badge variant={user.accountType === 'Distributor' ? 'default' : 'secondary'} className="font-semibold">
              {user.accountType}
            </Badge>
          )}
        </div>
      </div>
      {!isAdmin && (
        <>
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Star className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground">{t('profile.rank')}</p>
              <RankBadge rank={user.rank} />
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground">{t('profile.joinDate')}</p>
              <p className="font-semibold">{new Date(user.joinDate).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground">{t('profile.totalTeamSize')}</p>
              <p className="font-semibold">{user.teamSize.total} {t('profile.members')}</p>
            </div>
          </div>
          {user.storeOwnerLevel && (
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Store className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">{t('profile.stockistLevel')}</p>
                <Badge variant="default" className="font-semibold">{`${user.storeOwnerLevel} ${t('profile.stockist')}`}</Badge>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

