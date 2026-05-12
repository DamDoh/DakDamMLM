
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Minus, Eye, Loader2 } from 'lucide-react';
import { predictMemberCommission } from '@/services/server-actions';
import { formatCurrency } from '@/lib/utils';
import { useAuthContext } from '@/context/auth-context';
import { useI18n } from '@/lib/internationalization';

interface CommissionForecastProps {
  memberId?: string;
}

export default function CommissionForecast({ memberId }: CommissionForecastProps) {
  const { user } = useAuthContext();
  const { t } = useI18n();
  const [forecast, setForecast] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const targetMemberId = memberId ?? user?.id;

  const loadForecast = async () => {
    if (!targetMemberId) {
      setLoading(false);
      setError('User ID not available');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await predictMemberCommission(targetMemberId, 3);
      
      // Transform the server response to match component expectations
      const transformedForecast = {
        confidence: data.monthlyBreakdown.length > 0 ? 0.7 : 0.1, // Calculate confidence based on data availability
        // Monthly predictions are already E-Cash eligible (excludes Binary Bonus & Daily Match)
        predictedMonthly: data.monthlyBreakdown.map((item: { month: string; amount: number }) => item.amount),
        breakdown: {
          binary: [data.breakdown?.binary || 0], // Use actual calculated breakdown
          matching: [data.breakdown?.matching || 0],
          stockist: [data.breakdown?.stockist || 0], // Use actual calculated stockist bonus
          rank: [data.breakdown?.rank || 0],
          dailyMatch: [data.breakdown?.dailyMatch || 0],
        },
        factors: data.monthlyBreakdown.length > 0 
          ? ['Recent commission history', 'Average monthly earnings', 'Growth trend']
          : ['No commission history yet'],
      };
      
      setForecast(transformedForecast);
    } catch (err: any) {
      console.error('CLIENT: Error loading forecast for user', targetMemberId, ':', err);
      setError(err.message || 'Failed to load forecast');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadForecast();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetMemberId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            {t('commission.forecast.title')}
          </CardTitle>
          <CardDescription>{t('commission.forecast.loading')}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t('commission.forecast.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button onClick={loadForecast} variant="outline" size="sm" className="mt-2">
            {t('commission.forecast.retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!forecast) return null;

  // Check if this is a "no data" scenario
  const hasNoData = forecast.confidence < 0.15 && forecast.predictedMonthly.every((amount: number) => amount === 0);

  if (hasNoData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t('commission.forecast.title')}
          </CardTitle>
          <CardDescription>
            {t('commission.forecast.noDataAvailable')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-8">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-lg font-semibold mb-2">{t('commission.forecast.noDataTitle')}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t('commission.forecast.noDataDescription')}
            </p>
            <div className="text-xs text-muted-foreground">
              <p>• {t('commission.forecast.tip1')}</p>
              <p>• {t('commission.forecast.tip2')}</p>
              <p>• {t('commission.forecast.tip3')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getTrendIcon = (current: number, previous: number) => {
    if (current > previous) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (current < previous) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          {t('commission.forecast.title')}
        </CardTitle>
        <CardDescription>
          {t('commission.forecast.prediction', { confidence: Math.round(forecast.confidence * 100).toString() })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Monthly Predictions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {forecast.predictedMonthly.map((amount: number, index: number) => {
            const monthName = new Date(Date.now() + (index + 1) * 30 * 24 * 60 * 60 * 1000)
              .toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

            return (
              <div key={index} className="text-center p-3 border rounded-lg">
                <p className="text-sm font-medium text-muted-foreground">{monthName}</p>
                <p className="text-lg font-bold">{formatCurrency(amount)}</p>
                {index > 0 && getTrendIcon(amount, forecast.predictedMonthly[index - 1])}
              </div>
            );
          })}
        </div>

        {/* Breakdown */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">{t('commission.forecast.breakdown')}</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between">
              <span>{t('commission.forecast.binaryBonus')}</span>
              <span className="font-medium">{formatCurrency(forecast.breakdown.binary[0])}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('commission.forecast.rankBonus')}</span>
              <span className="font-medium text-amber-600">{formatCurrency(forecast.breakdown.dailyMatch[0])}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('commission.forecast.matchingBonus')}</span>
              <span className="font-medium">{formatCurrency(forecast.breakdown.matching[0])}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('commission.forecast.stockistBonus')}</span>
              <span className="font-medium">{formatCurrency(forecast.breakdown.stockist[0])}</span>
            </div>
          </div>
        </div>

        {/* Factors */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">{t('commission.forecast.keyFactors')}</h4>
          <div className="flex flex-wrap gap-1">
            {forecast.factors.map((factor: string, index: number) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {factor}
              </Badge>
            ))}
          </div>
        </div>

        <Button onClick={loadForecast} variant="outline" size="sm" className="w-full">
          <Eye className="h-4 w-4 mr-2" />
          {t('commission.forecast.refresh')}
        </Button>
      </CardContent>
    </Card>
  );
}
