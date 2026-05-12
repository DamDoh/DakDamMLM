import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Activity, BarChart3, Award, TrendingUp, Calendar, Target, TrendingDown, Minus } from 'lucide-react';
import type { Member } from '@/lib/types';
import { useI18n } from '@/lib/internationalization';
import { formatCurrency } from '@/lib/utils';

interface AdvancedAnalyticsTabProps {
  loadingAnalytics: boolean;
  analyticsData: any;
  commissionAnalytics: any;
  members: Member[];
  onLoadAnalytics: () => void;
}

export function AdvancedAnalyticsTab({
  loadingAnalytics,
  analyticsData,
  commissionAnalytics,
  onLoadAnalytics
}: AdvancedAnalyticsTabProps) {
  const { t } = useI18n();
  const t2 = t; // Alias for consistency

  if (loadingAnalytics) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">{t2('analytics.loadingAdvancedAnalytics')}</span>
      </div>
    );
  }

  const businessHealth = analyticsData?.businessHealth;
  const hasGrowthAnalytics = analyticsData?.growthAnalytics;
  const hasKeyMetrics = Array.isArray(analyticsData?.keyMetrics);

  if (
    !analyticsData ||
    !commissionAnalytics ||
    !businessHealth ||
    !hasGrowthAnalytics ||
    !hasKeyMetrics
  ) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">{t2('analytics.advancedAnalytics')}</h3>
            <p className="text-muted-foreground mb-4">
              {t2('analytics.advancedAnalyticsDesc')}
            </p>
            <Button onClick={onLoadAnalytics} disabled={loadingAnalytics} icon={loadingAnalytics ? 'loading' : undefined}>
              {loadingAnalytics ? t2('analytics.loading') : t2('analytics.loadAnalytics')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Business Health Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            {t2('analytics.businessHealthScore')}
          </CardTitle>
          <CardDescription>{t2('analytics.businessHealthScoreDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{businessHealth.overall}%</span>
              <Badge variant={businessHealth.overall >= 80 ? 'default' : businessHealth.overall >= 60 ? 'secondary' : 'destructive'}>
                {businessHealth.overall >= 80 ? t2('analytics.excellent') : businessHealth.overall >= 60 ? t2('analytics.good') : t2('analytics.needsAttention')}
              </Badge>
            </div>
            <Progress value={businessHealth.overall} className="h-3" />

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
              {Object.entries(businessHealth.components).map(([key, value]: [string, any]) => (
                <div key={key} className="text-center">
                  <div className="text-lg font-semibold capitalize">{key}</div>
                  <div className="text-2xl font-bold text-primary">{value}%</div>
                </div>
              ))}
            </div>

            {businessHealth.recommendations.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">{t2('analytics.recommendations')}</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {businessHealth.recommendations.map((rec: string, index: number) => (
                    <li key={index}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Commission Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {t2('analytics.commissionBreakdown')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(commissionAnalytics.commissionByType).map(([type, data]: [string, any]) => (
                <div key={type} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-primary"></div>
                    <span className="capitalize">{type}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{formatCurrency(data.total)}</div>
                    <div className="text-sm text-muted-foreground">{data.count} {t2('analytics.payments')}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              {t2('analytics.topEarners')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {commissionAnalytics.topEarners.slice(0, 5).map((earner: any, index: number) => (
                <div key={earner.userId} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium">{earner.name}</div>
                      <div className="text-sm text-muted-foreground">{earner.rank}</div>
                    </div>
                  </div>
                  <div className="font-bold">{formatCurrency(earner.amount)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Growth Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t2('analytics.growthAnalytics')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">+{analyticsData.growthAnalytics.newMembers}</div>
              <div className="text-sm text-muted-foreground">{t2('analytics.newMembers')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{analyticsData.growthAnalytics.activeMembers}</div>
              <div className="text-sm text-muted-foreground">{t2('analytics.activeMembers')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{formatCurrency(analyticsData.growthAnalytics.averageOrderValue)}</div>
              <div className="text-sm text-muted-foreground">{t2('analytics.avgOrderValue')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{analyticsData.growthAnalytics.retentionRate}%</div>
              <div className="text-sm text-muted-foreground">{t2('analytics.retentionRate')}</div>
            </div>
          </div>

          <div className="mt-6">
            <h4 className="font-medium mb-3">{t2('analytics.topPerformers')}</h4>
            <div className="space-y-2">
              {analyticsData.growthAnalytics.topPerformers.slice(0, 3).map((performer: any) => (
                <div key={performer.memberId} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Target className="h-4 w-4 text-primary" />
                    <div>
                      <div className="font-medium">{performer.name}</div>
                      <div className="text-sm text-muted-foreground">ID: {performer.memberId}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{performer.volume} PV</div>
                    <div className="text-sm text-muted-foreground">+{performer.growth} {t2('analytics.growth')}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t2('analytics.keyMetricsTrends')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {analyticsData.keyMetrics.map((metric: any) => (
              <div key={metric.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{metric.name}</span>
                  {metric.trend === 'up' ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : metric.trend === 'down' ? (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  ) : (
                    <Minus className="h-4 w-4 text-gray-500" />
                  )}
                </div>
                <div className="text-2xl font-bold">{metric.value.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground capitalize">
                  {metric.trend === 'up' ? t2('analytics.upTrend') :
                   metric.trend === 'down' ? t2('analytics.downTrend') :
                   t2('analytics.stableTrend')}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}