
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
  const [document, setDocument] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const generateDocument = async () => {
    setLoading(true);
    try {
      const doc = await generateCompensationPlanDoc('DakDam');
      setDocument(doc);
      toast({
        title: 'Document Generated',
        description: 'Compensation plan documentation has been created successfully.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Generation Failed',
        description: error.message || 'Failed to generate compensation plan document.',
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
      title: 'Download Started',
      description: 'Compensation plan document has been downloaded.',
    });
  };

  const copyToClipboard = async () => {
    if (!document) return;

    try {
      await navigator.clipboard.writeText(document);
      toast({
        title: 'Copied to Clipboard',
        description: 'Document content has been copied to clipboard.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Copy Failed',
        description: 'Failed to copy document to clipboard.',
      });
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Compensation Plan Documentation</h1>
          <p className="text-muted-foreground">
            Generate comprehensive compensation plan documentation with current statistics and rules.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={generateDocument} disabled={loading} icon={loading ? "loading" : RefreshCw}>
            {loading ? 'Generating...' : 'Regenerate Document'}
          </Button>
          {document && (
            <>
              <Button onClick={downloadDocument} variant="outline" icon={Download}>
                Download
              </Button>
              <Button onClick={copyToClipboard} variant="outline" icon={Clipboard}>
                Copy
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generated Documentation</CardTitle>
          <CardDescription>
            This document includes current business rules, statistics, and comprehensive compensation plan details.
            It automatically updates with real-time data from your system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
             <div className="flex flex-col items-center justify-center min-h-[600px] text-center">
              <Loader2 className="h-12 w-12 text-muted-foreground mb-4 animate-spin" />
              <h3 className="text-lg font-medium mb-2">Generating Document...</h3>
              <p className="text-muted-foreground mb-4">
                Fetching live statistics and compiling the latest business rules.
              </p>
            </div>
          ) : document ? (
            <Textarea
              value={document}
              readOnly
              className="min-h-[600px] font-mono text-sm"
              placeholder="Click 'Generate Document' to create the compensation plan documentation..."
            />
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[600px] text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Document Generated</h3>
              <p className="text-muted-foreground mb-4">
                Click the button above to generate a comprehensive compensation plan document.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Document Features</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>• Real-time business statistics</div>
            <div>• Complete compensation rules</div>
            <div>• Rank requirements & bonuses</div>
            <div>• Commission calculations</div>
            <div>• Compliance information</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Use Cases</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>• Member education materials</div>
            <div>• Compliance documentation</div>
            <div>• Legal record keeping</div>
            <div>• Training resources</div>
            <div>• Regulatory submissions</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Formats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>• Markdown (.md) download</div>
            <div>• Clipboard copy</div>
            <div>• Web display</div>
            <div>• Print-ready format</div>
            <div>• Auto-updating content</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

    