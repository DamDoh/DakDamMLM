
'use client';

import { Suspense, useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { CheckCircle2, Package, LayoutDashboard } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useI18n } from '@/lib/internationalization';
import { useAuthContext } from '@/context/auth-context';
import { formatCurrency } from '@/lib/utils';

function ConfirmationContent() {
    const { t } = useI18n();
    const { user, loading } = useAuthContext();
    const searchParams = useSearchParams();
    const orderId = searchParams.get('orderId');
    const [storeOwnerLevel, setStoreOwnerLevel] = useState<string | null>(null);
    const [loadingUserData, setLoadingUserData] = useState(true);
    const [ecashReceived, setEcashReceived] = useState<{
        recipientId: string;
        recipientName: string;
        recipientType: 'adminStock' | 'admin';
        amount: number;
    } | null>(null);

    // Get ecashReceived from URL params if available
    useEffect(() => {
        const recipientName = searchParams.get('recipientName');
        const recipientType = searchParams.get('recipientType') as 'adminStock' | 'admin' | null;
        const amount = searchParams.get('amount');

        if (recipientName && recipientType && amount) {
            setEcashReceived({
                recipientId: '', // Not needed for display
                recipientName: decodeURIComponent(recipientName),
                recipientType: recipientType,
                amount: parseFloat(amount) || 0
            });
        }
    }, [searchParams]);

    // Fetch user's storeOwnerLevel and order details from API
    useEffect(() => {
        const fetchUserData = async () => {
            if (!user || loading) {
                setLoadingUserData(false);
                return;
            }

            try {
                const token = localStorage.getItem('auth_token');
                if (!token) {
                    setLoadingUserData(false);
                    return;
                }

                // Fetch user data
                const dashboardResponse = await fetch('/api/dashboard', {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                });

                if (dashboardResponse.ok) {
                    const result = await dashboardResponse.json();
                    if (result.success && result.data?.user) {
                        setStoreOwnerLevel(result.data.user.storeOwnerLevel || null);
                    }
                }

                // Fetch order details if orderId is available and ecashReceived not already set from URL params
                if (orderId && !ecashReceived) {
                    const orderResponse = await fetch(`/api/orders?status=all&limit=100`, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json',
                        },
                    });

                    if (orderResponse.ok) {
                        const orderResult = await orderResponse.json();
                        if (orderResult.success && Array.isArray(orderResult.data)) {
                            const order = orderResult.data.find((o: any) => o.orderId === orderId);
                            if (order && order.ecashReceived) {
                                setEcashReceived(order.ecashReceived);
                            }
                        }
                    }
                }
            } catch (error) {
                // Silent fail - use default values
            } finally {
                setLoadingUserData(false);
            }
        };

        fetchUserData();
    }, [user, loading, orderId]);

    // Check if user is AdminStock
    // AdminStock = isAdmin === true OR has stockist level (S, M, C, D)
    // For AdminStock: Show only "Return to Dashboard" button
    // For Customer/Member: Show both "View Order History" and "Return to Dashboard" buttons
    const isAdmin = user?.isAdmin === true;
    const hasStockistLevel = storeOwnerLevel && ['S', 'M', 'C', 'D'].includes(storeOwnerLevel);
    const isAdminStock = !loading && !loadingUserData && user !== null && (isAdmin || hasStockistLevel);

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
                    {ecashReceived && (
                        <Card className="bg-muted/50 border-primary/20">
                            <CardContent className="pt-6">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-muted-foreground">
                                            {t('confirmation.ecashTransferredTo')}
                                        </span>
                                        <span className="text-sm font-semibold">
                                            {ecashReceived.recipientName}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-muted-foreground">
                                            {t('confirmation.ecashTypeLabel')}
                                        </span>
                                        <span className="text-sm font-semibold capitalize">
                                            {ecashReceived.recipientType === 'adminStock'
                                                ? t('confirmation.ecashTypeAdminStock')
                                                : t('confirmation.ecashTypeAdmin')}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between pt-2 border-t">
                                        <span className="text-base font-semibold">
                                            {t('confirmation.ecashTotalReceived')}
                                        </span>
                                        <span className="text-lg font-bold text-primary">
                                            {formatCurrency(ecashReceived.amount)}
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                    {/* Show buttons based on user role */}
                    {isAdminStock ? (
                        // AdminStock: Only "Return to Dashboard" button
                        <div className="flex justify-center">
                            <Button asChild variant="outline" icon={LayoutDashboard}>
                                <Link href="/dashboard">
                                    {t('confirmation.returnToDashboardButton')}
                                </Link>
                            </Button>
                        </div>
                    ) : (
                        // Customer/Member or loading: Both "View Order History" and "Return to Dashboard" buttons
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
                    )}
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
