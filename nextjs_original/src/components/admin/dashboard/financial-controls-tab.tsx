import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye } from 'lucide-react';
import type { FinancialControl } from '@/lib/types';
import { useI18n } from '@/lib/internationalization';
import { formatCurrency } from '@/lib/utils';

interface FinancialControlsTabProps {
  financialControls: FinancialControl[];
}

export function FinancialControlsTab({ financialControls }: FinancialControlsTabProps) {
  const { t } = useI18n();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.bi.pendingControls')}</CardTitle>
        <CardDescription>{t('admin.bi.pendingControlsDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        {financialControls.length === 0 ? (
          <p className="text-muted-foreground">{t('admin.bi.noPendingControls')}</p>
        ) : (
          <div className="space-y-4">
            {financialControls.map((control) => (
              <div key={control.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">{formatCurrency(control.amount)}</p>
                  <p className="text-sm text-muted-foreground">{control.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('admin.bi.created')}: {new Date(control.createdDate).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={control.status === 'pending' ? 'secondary' : 'default'}>
                    {control.status}
                  </Badge>
                  {control.status === 'pending' && (
                    <Button size="sm" variant="outline" icon={Eye}>
                      {t('admin.bi.review')}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}