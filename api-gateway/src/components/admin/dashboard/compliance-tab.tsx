import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText } from 'lucide-react';
import type { ComplianceDocument } from '@/lib/types';
import { useI18n } from '@/lib/internationalization';

interface ComplianceTabProps {
  complianceDocs: ComplianceDocument[];
}

export function ComplianceTab({ complianceDocs }: ComplianceTabProps) {
  const { t } = useI18n();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.bi.complianceDocs')}</CardTitle>
        <CardDescription>{t('admin.bi.complianceDocsDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {complianceDocs.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{doc.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('admin.bi.version')} {doc.version}
                  </p>
                </div>
              </div>
              <Badge variant={doc.isActive ? 'default' : 'secondary'}>
                {doc.isActive ? t('admin.bi.active') : t('admin.bi.inactive')}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}