'use client';

import { useEffect, useCallback, useTransition, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/internationalization';
import { useAuthContext } from '@/context/auth-context';
import type { MemberProgress, OnboardingTemplate, OnboardingStep } from '@/lib/types';
import { Loader2, CheckCircle, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGenealogyContext } from '@/context/genealogy-context';
import { Skeleton } from '@/components/ui/skeleton';

export default function OnboardingProgress() {
   const { t } = useI18n();
   const { user } = useAuthContext();
   const { rootMember } = useGenealogyContext() || {};
   const { toast } = useToast();

  const [onboardingProgress, setOnboardingProgress] = useState<MemberProgress | null>(null);
  const [onboardingTemplate, setOnboardingTemplate] = useState<OnboardingTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const refreshOnboardingProgress = useCallback(async () => {
    if (user) {
      try {
        const token = localStorage.getItem('auth_token') || '';
        const res = await fetch('/api/onboarding', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch onboarding');
        const json = await res.json();
        const progress = (json?.data?.progress || null) as MemberProgress | null;
        setOnboardingProgress(progress);
        return progress;
      } catch (error) {
        toast({ variant: 'destructive', title: t('onboarding.errorTitle'), description: t('onboarding.errorRefreshProgress') });
        return null;
      }
    }
    return null;
  }, [user, toast, t]);

  const handleCompleteStep = useCallback(async (step: OnboardingStep) => {
    if (!user) return;

    startTransition(async () => {
        try {
          const token = localStorage.getItem('auth_token') || '';
          const res = await fetch('/api/onboarding', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ action: 'complete-step', stepId: step.id, timeSpent: step.estimatedMinutes }),
          });
          const json = await res.json();
          const success = !!json?.success;
          if (success) {
              toast({
                  title: t('onboarding.stepCompletedTitle'),
                  description: t('onboarding.stepCompletedDescription', { stepTitle: step.title }),
              });
              await refreshOnboardingProgress();
          } else {
              throw new Error('Server returned false for completeOnboardingStep');
          }
        } catch (error) {
            toast({
                variant: 'destructive',
                title: t('onboarding.errorTitle'),
                description: t('onboarding.errorUpdateProgress'),
            });
        }
    });
  }, [user, toast, refreshOnboardingProgress, t]);

  useEffect(() => {
    if (!user) return;

    const fetchOnboardingData = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('auth_token') || '';
        const res = await fetch('/api/onboarding', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch onboarding');
        const json = await res.json();
        setOnboardingTemplate(json?.data?.template || null);
        await refreshOnboardingProgress();
      } catch (error) {
        toast({ variant: 'destructive', title: t('onboarding.errorTitle'), description: t('onboarding.errorLoadInfo') });
      } finally {
        setLoading(false);
      }
    };

    fetchOnboardingData();
  }, [user, toast, refreshOnboardingProgress, t]);

  useEffect(() => {
    // This effect handles automatic step completion based on user actions.
    const checkAndCompleteSteps = async () => {
        if (!onboardingProgress || !onboardingTemplate || !user) return;

        // Check for Profile Completion
        const profileStepId = 'setup-profile';
        if (!onboardingProgress.completedSteps.includes(profileStepId)) {
            if (rootMember && (rootMember.addresses?.length > 0)) {
                const step = onboardingTemplate.steps.find(s => s.id === profileStepId);
                if (step) handleCompleteStep(step);
            }
        }

        // Check for First Order - simplified since we don't have Firebase
        const firstOrderStepId = 'first-product-order';
        if (!onboardingProgress.completedSteps.includes(firstOrderStepId)) {
            // For now, we'll skip automatic order detection since Firebase is removed
            // This would need to be implemented with database queries instead
        }
    };

    checkAndCompleteSteps();
  }, [onboardingProgress, onboardingTemplate, rootMember, handleCompleteStep, user]);
  
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-full mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!onboardingProgress || onboardingProgress.isCompleted || !onboardingTemplate) {
    return null; // Don't show the component if onboarding is done or not loaded
  }

  const totalSteps = onboardingTemplate.steps.length;
  const completedStepsCount = onboardingProgress.completedSteps.length;
  const percentage = totalSteps > 0 ? (completedStepsCount / totalSteps) * 100 : 0;

  const renderStepAction = (step: OnboardingStep) => {
    switch (step.id) {
        case 'first-product-order':
            return <Button asChild size="sm" variant="outline"><Link href="/product">Place Order</Link></Button>;
        case 'setup-profile':
            return <Button asChild size="sm" variant="outline"><Link href="/profile">Go to Profile</Link></Button>;
        default:
            return <Button size="sm" variant="outline" onClick={() => handleCompleteStep(step)} disabled={isPending}>{t('onboarding.complete')}</Button>;
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('onboarding.welcomeTitle')}</CardTitle>
        <CardDescription>
          {t('onboarding.welcomeDescription', { completed: completedStepsCount.toString(), total: totalSteps.toString() })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={percentage} className="h-2" />
        <div className="space-y-3 pt-2">
          {onboardingTemplate.steps.map((step, index) => {
            const isCompleted = onboardingProgress.completedSteps.includes(step.id);
            const isCurrent = !isCompleted && (index === 0 || onboardingProgress.completedSteps.includes(onboardingTemplate.steps[index - 1].id));
            
            return (
              <div key={step.id} className={cn("flex items-start gap-4 p-3 rounded-lg transition-colors", isCurrent ? 'bg-primary/10' : 'bg-muted/30')}>
                <div className="flex-shrink-0 pt-1">
                  {isCompleted ? <CheckCircle className="h-5 w-5 text-green-500" /> : 
                   isCurrent ? <Loader2 className="h-5 w-5 text-primary animate-spin" /> : 
                   <Circle className="h-5 w-5 text-muted-foreground/50" />
                  }
                </div>
                <div className="flex-1">
                  <p className={cn("font-medium", isCompleted && "line-through text-muted-foreground")}>{step.title}</p>
                  <p className={cn("text-sm text-muted-foreground", isCompleted && "line-through")}>{step.description}</p>
                </div>
                {isCurrent && !isCompleted && (
                  <div className="flex-shrink-0">
                    {renderStepAction(step)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  );
}

    