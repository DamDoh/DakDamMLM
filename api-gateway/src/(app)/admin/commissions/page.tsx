
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { runCommissionCycle } from '@/services/server-actions';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlayCircle, Settings } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle } from 'lucide-react';
import { useI18n } from '@/lib/internationalization';

export default function CommissionAdminPage() {
    const { t } = useI18n();
    const [isLoading, setIsLoading] = useState(false);
    const [lastResult, setLastResult] = useState<{count: number, total: number} | null>(null);
    const { toast } = useToast();

    const handleRunCommissions = async () => {
        setIsLoading(true);
        setLastResult(null);
        try {
            const result = await runCommissionCycle();
            setLastResult(result);
            toast({
                title: t('admin.commission.success'),
                description: t('admin.commission.successDesc', { count: String(result.count), total: result.total.toFixed(2) }),
            });
        } catch (error) {
            console.error('Failed to run commission cycle:', error);
            toast({
                variant: 'destructive',
                title: t('admin.commission.error'),
                description: t('admin.commission.errorDesc'),
            });
        } finally {
            setIsLoading(false);
        }
    };
    
    const getResultDescription = () => {
        if (!lastResult) return '';
        const text = t('admin.commission.cycleCompleteDesc', { count: String(lastResult.count), total: lastResult.total.toFixed(2) });
        const parts = text.split(/(<span.*<\/span>)/);
        return parts.map((part, index) => {
            if (part.startsWith('<span')) {
                const value = part.replace(/<\/?span[^>]*>/g, '');
                return <span key={index} className="font-bold">{value}</span>
            }
            return part;
        });
    }

    return (
        <div className="flex-1 p-4 pt-6 md:p-8 flex justify-center items-start">
            <Card className="w-full max-w-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Settings />
                        {t('admin.commission.title')}
                    </CardTitle>
                    <CardDescription>
                        {t('admin.commission.description')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        {t('admin.commission.warning')}
                    </p>
                    <Button 
                        onClick={handleRunCommissions} 
                        disabled={isLoading}
                        className="w-full"
                        icon={isLoading ? Loader2 : PlayCircle}
                    >
                        {isLoading ? (
                            t('admin.commission.calculating')
                        ) : (
                            t('admin.commission.runButton')
                        )}
                    </Button>
                    {lastResult && (
                        <Alert variant="default" className="bg-green-50 border-green-200">
                            <CheckCircle className="h-4 w-4" />
                            <AlertTitle className="text-green-800">{t('admin.commission.cycleComplete')}</AlertTitle>
                            <AlertDescription className="text-green-700">
                                {getResultDescription()}
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
