
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { businessRules } from '@/lib/business-rules';
import { ranks, type Rank } from '@/lib/types';
import { CheckCircle, Trophy, Users, Star, Target, ArrowUpCircle } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/internationalization';

interface NextRankRequirementsProps {
  currentRank: Rank;
  personalPV: number;
  groupPV: number;
  directRecruits: number;
}

const RequirementItem = ({ icon: Icon, label, current, required }: { icon: React.ElementType, label: string; current: number; required: number }) => {
  const isComplete = current >= required;
  const progress = required > 0 ? Math.min((current / required) * 100, 100) : 100;

  return (
    <div className="space-y-2 p-4 rounded-lg bg-muted/50 border">
      <div className="flex justify-between items-center text-sm">
        <div className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${isComplete ? 'text-green-500' : 'text-muted-foreground'}`} />
            <span className="font-medium">{label}</span>
        </div>
        <span className={`font-semibold ${isComplete ? 'text-green-600' : 'text-foreground'}`}>{current.toLocaleString()} / {required.toLocaleString()}</span>
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  );
};


export default function NextRankRequirements({ currentRank, personalPV, groupPV, directRecruits }: NextRankRequirementsProps) {
  const { t } = useI18n();
  const nextRank = useMemo(() => {
    const currentRankIndex = ranks.indexOf(currentRank);
    if (currentRankIndex === -1 || currentRankIndex === ranks.length - 1) return null; // Already at highest rank or rank not found
    
    // Find the next rank in the business rules that is higher than the current one
    return businessRules.rankRequirements.find(req => {
      const reqRankIndex = ranks.indexOf(req.rank as Rank);
      return reqRankIndex > currentRankIndex;
    }) || null;
  }, [currentRank]);

  const areRequirementsMet = useMemo(() => {
    if (!nextRank) return false;
    return personalPV >= nextRank.personalPV &&
           groupPV >= nextRank.groupPV &&
           directRecruits >= nextRank.directRecruits;
  }, [nextRank, personalPV, groupPV, directRecruits]);


  if (!nextRank) {
    return (
      <Card className="max-w-2xl mx-auto bg-green-50 border-green-200">
        <CardHeader className="text-center">
            <Trophy className="h-10 w-10 mx-auto text-yellow-500" />
            <CardTitle>{t('rank.congratulations')}</CardTitle>
            <CardDescription>{t('rank.highestRank')}</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  
  return (
    <Card className="max-w-2xl mx-auto" id="next-rank-card">
      <CardHeader>
        <div className="flex items-center justify-between">
            <div>
                 <CardTitle className="flex items-center gap-2">
                    <Trophy className="text-yellow-500"/>
                    {t('rank.path_to', { rank: nextRank.rank })}
                </CardTitle>
                <CardDescription className="mt-1">
                    {t('rank.description')}
                </CardDescription>
            </div>
             {areRequirementsMet ? (
                <Button variant="outline" disabled>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    {t('rank.promotionPending')}
                </Button>
                ) : (
                <Button variant="default" onClick={() => document.getElementById('next-rank-card')?.scrollIntoView({ behavior: 'smooth' })}>
                    <ArrowUpCircle className="mr-2 h-4 w-4" />
                    {t('rank.viewRequirements')}
                </Button>
            )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <RequirementItem 
            icon={Star}
            label={t('rank.personalPV')}
            current={personalPV}
            required={nextRank.personalPV}
        />
        <RequirementItem 
            icon={Users}
            label={t('rank.groupPV')}
            current={groupPV}
            required={nextRank.groupPV}
        />
        <RequirementItem 
            icon={Target}
            label={t('rank.directRecruits')}
            current={directRecruits}
            required={nextRank.directRecruits}
        />
      </CardContent>
    </Card>
  );
}
