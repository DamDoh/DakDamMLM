'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ShoppingCart,
  UserPlus,
  TrendingUp,
  Gift,
  Star,
  Zap,
  ArrowRight
} from 'lucide-react';
import { useI18n } from '@/lib/internationalization';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { useAuthContext } from '@/context/auth-context';

interface HeroSectionProps {
  totalEarned: number;
  ecashBalance: number;
  totalMembers: number;
  isNewUser?: boolean;
}

export function HeroSection({
  totalEarned,
  ecashBalance,
  totalMembers,
  isNewUser = false
}: HeroSectionProps) {
  const { t } = useI18n();
  const { user } = useAuthContext();

  return (
    <div className="space-y-6">
      {/* Welcome Message & Quick Stats */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
          {t('dashboard.welcomeBack')}, {user?.firstName || 'Member'}!
        </h1>
        <p className="text-muted-foreground">
          {t('dashboard.heroSubtitle') || 'Your network marketing journey starts here'}
        </p>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-green-100 rounded-full -mr-10 -mt-10 opacity-20" />
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t('dashboard.totalCommissionEarned')}
                </p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(totalEarned)}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  <span className="text-xs text-green-600">+12.5% this month</span>
                </div>
              </div>
              <div className="p-2 bg-green-100 rounded-full">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-blue-100 rounded-full -mr-10 -mt-10 opacity-20" />
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t('dashboard.ecashBalance')}
                </p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(ecashBalance)}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <Star className="h-3 w-3 text-blue-500" />
                  <span className="text-xs text-blue-600">Available to spend</span>
                </div>
              </div>
              <div className="p-2 bg-blue-100 rounded-full">
                <Gift className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-purple-100 rounded-full -mr-10 -mt-10 opacity-20" />
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t('dashboard.totalTeamMembers')}
                </p>
                <p className="text-2xl font-bold text-purple-600">
                  {totalMembers}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <UserPlus className="h-3 w-3 text-purple-500" />
                  <span className="text-xs text-purple-600">Growing network</span>
                </div>
              </div>
              <div className="p-2 bg-purple-100 rounded-full">
                <UserPlus className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Primary Action Hero */}
      <Card className="bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border-primary/20">
        <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6">
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-2">
                {isNewUser ? '🚀 Start Your Journey' : '⚡ Ready to Grow?'}
              </h2>
              <p className="text-sm md:text-base text-muted-foreground mb-3 md:mb-4">
                {isNewUser
                  ? 'Complete your first order and invite members to start earning commissions'
                  : 'Place a quick order or invite new members to expand your network'
                }
              </p>
              <div className="flex flex-wrap gap-1.5 md:gap-2 justify-center md:justify-start">
                <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                  Earn Commissions
                </Badge>
                <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
                  Build Network
                </Badge>
                <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-xs">
                  Unlock Rewards
                </Badge>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full md:w-auto">
              <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg h-12 px-6 text-base">
                <Link href="/product" className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  <span className="font-medium">Quick Order</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>

              <Button asChild variant="outline" size="lg" className="border-2 hover:bg-muted h-12 px-6 text-base">
                <Link href="/invite" className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  <span className="font-medium">Invite Members</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Achievement Status */}
      {!isNewUser && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-full">
                  <Zap className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">Next Rank</p>
                  <p className="text-xs text-muted-foreground">2 more recruits needed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-full">
                  <Star className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">Monthly Goal</p>
                  <p className="text-xs text-muted-foreground">75% complete</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-200 bg-purple-50/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-full">
                  <Gift className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">Rewards Available</p>
                  <p className="text-xs text-muted-foreground">3 pending claims</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}</content>
<parameter name="filePath">C:\Users\V COMPUTER\Documents\dakdampostgre-devcg\dakdampostgre-devcg\src\components\b2c\hero-section.tsx