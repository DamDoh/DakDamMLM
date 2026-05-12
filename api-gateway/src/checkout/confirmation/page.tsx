
'use client';

import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { CheckCircle2, Package, LayoutDashboard } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useI18n } from '@/lib/internationalization';

function ConfirmationContent() {
    const { t } = useI18n();
    const searchParams = useSearchParams();
    const orderId = searchParams.get('orderId');

    return (
        <div className="flex-1 p-4 pt-6 sm:p-6 md:p-8 flex justify-center items-start">
            <Card className="w-full max-w-lg text-center">
                <CardHeader className="items-center">
                    <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
                    <CardTitle className="text-3xl">{t('confirmation.title')}</CardTitle>
                    <CardDescription className="pt-2">
                        {t('confirmation.description')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {orderId && (
                        <div className="text-lg">
                            <span className="font-medium text-muted-foreground">{t('confirmation.orderIdLabel')}</span>
                            <span className="font-bold">{orderId}</span>
                        </div>
                    )}
                    <p className="text-muted-foreground">
                        {t('confirmation.details')}
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                         <Button asChild icon={Package}>
                            <Link href="/orders">
                                {t('confirmation.viewOrdersButton')}
                            </Link>
                        </Button>
                        <Button asChild variant="outline" icon={LayoutDashboard}>
                            <Link href="/dashboard">
                                {t('confirmation.returnToDashboardButton')}
                            </Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default function ConfirmationPage() {
    const { t } = useI18n();
    return (
        <Suspense fallback={
            <div className="flex-1 p-4 sm:p-6 md:p-8 pt-6 flex justify-center items-start">
                <Card className="w-full max-w-lg text-center">
                    <CardHeader className="items-center">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mb-4"></div>
                        <CardTitle className="text-3xl">{t('common.loading')}</CardTitle>
                    </CardHeader>
                </Card>
            </div>
        }>
            <ConfirmationContent />
        </Suspense>
    );
}
