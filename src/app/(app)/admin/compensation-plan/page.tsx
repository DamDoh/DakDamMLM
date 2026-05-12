
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Download, FileText, RefreshCw, Loader2, Clipboard } from 'lucide-react';
import { generateCompensationPlanDoc } from '@/services/dashboard-actions';
import { useI18n } from '@/lib/internationalization';
import { useToast } from '@/hooks/use-toast';

export default function CompensationPlanPage() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [document, setDocument] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const generateDocument = async () => {
    setLoading(true);
    try {
      const doc = await generateCompensationPlanDoc('DakDam');
      setDocument(doc);
      toast({
        title: t('compPlan.generatedTitle'),
        description: t('compPlan.generatedDescription'),
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t('compPlan.generateFailedTitle'),
        description: error.message || t('compPlan.generateFailedDescription'),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generateDocument();
  }, []);

  const downloadDocument = () => {
    if (!document) return;

    const blob = new Blob([document], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = `compensation-plan-${new Date().toISOString().split('T')[0]}.md`;
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: t('compPlan.downloadStartedTitle'),
      description: t('compPlan.downloadStartedDescription'),
    });
  };

  const copyToClipboard = async () => {
    if (!document) return;

    try {
      await navigator.clipboard.writeText(document);
      toast({
        title: t('compPlan.copiedTitle'),
        description: t('compPlan.copiedDescription'),
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('compPlan.copyFailedTitle'),
        description: t('compPlan.copyFailedDescription'),
      });
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t('compPlan.title')}</h1>
          <p className="text-muted-foreground">
            {t('compPlan.description')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={generateDocument} disabled={loading} icon={loading ? "loading" : RefreshCw}>
            {loading ? t('compPlan.generating') : t('compPlan.regenerate')}
          </Button>
          {document && (
            <>
              <Button onClick={downloadDocument} variant="outline" icon={Download}>
                {t('compPlan.download')}
              </Button>
              <Button onClick={copyToClipboard} variant="outline" icon={Clipboard}>
                {t('compPlan.copy')}
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('compPlan.generatedTitleSection')}</CardTitle>
          <CardDescription>
            {t('compPlan.generatedDescriptionSection')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
             <div className="flex flex-col items-center justify-center min-h-[600px] text-center">
              <Loader2 className="h-12 w-12 text-muted-foreground mb-4 animate-spin" />
              <h3 className="text-lg font-medium mb-2">{t('compPlan.generatingHeading')}</h3>
              <p className="text-muted-foreground mb-4">
                {t('compPlan.generatingSubtext')}
              </p>
            </div>
          ) : document ? (
            <Textarea
              value={document}
              readOnly
              className="min-h-[600px] font-mono text-sm"
              placeholder={t('compPlan.noDocumentSubtext')}
            />
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[600px] text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">{t('compPlan.noDocumentHeading')}</h3>
              <p className="text-muted-foreground mb-4">
                {t('compPlan.noDocumentSubtext')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('compPlan.featuresTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>• {t('compPlan.feature.stats')}</div>
            <div>• {t('compPlan.feature.rules')}</div>
            <div>• {t('compPlan.feature.ranks')}</div>
            <div>• {t('compPlan.feature.calculations')}</div>
            <div>• {t('compPlan.feature.compliance')}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('compPlan.useCasesTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>• {t('compPlan.useCases.education')}</div>
            <div>• {t('compPlan.useCases.compliance')}</div>
            <div>• {t('compPlan.useCases.legal')}</div>
            <div>• {t('compPlan.useCases.training')}</div>
            <div>• {t('compPlan.useCases.regulatory')}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('compPlan.formatsTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>• {t('compPlan.formats.markdown')}</div>
            <div>• {t('compPlan.formats.clipboard')}</div>
            <div>• {t('compPlan.formats.web')}</div>
            <div>• {t('compPlan.formats.print')}</div>
            <div>• {t('compPlan.formats.autoUpdate')}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

    