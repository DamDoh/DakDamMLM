
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Wallet, Coins, ArrowDown, ArrowUp, Loader2, RefreshCw, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import RankTopUpDialog from '@/components/ecash/rank-topup-dialog';
import MaintenanceTopUpDialog from '@/components/ecash/maintenance-topup-dialog';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/internationalization';
import { formatCurrency, formatPV } from '@/lib/utils';
import { useAuthContext } from '@/context/auth-context';
import { useGenealogyContext } from '@/context/genealogy-context';
import { getPVForRank, type Rank } from '@/lib/rank';
import { getMaintenanceTopupAmount } from '@/lib/maintenance';
import { useToast } from '@/hooks/use-toast';

type WalletTransaction = {
  id: string;
  type: string;
  amount: number;
  balanceBefore?: number;
  balanceAfter?: number;
  description?: string;
  referenceId?: string;
  referenceType?: string;
  status?: string;
  createdAt: string;
};

type UnifiedEntry = {
  id: string;
  date: string;
  type: string;
  amount: number;
  description?: string;
  status?: string;
  source: 'wallet';
  referenceType?: string;
};

const getTransactionIcon = (amount: number, type: string) => {
  if (amount < 0) {
    return <ArrowUp className="h-4 w-4 text-red-500" />;
  }
  return <ArrowDown className="h-4 w-4 text-green-500" />;
}

const getTransactionAmountClass = (amount: number, type: string) => {
  if (amount < 0) {
    return 'text-red-600';
  }
  return 'text-green-600';
}


export default function EcashPage() {
  const { t } = useI18n();
  const { user: authUser } = useAuthContext();
  const genealogyContext = useGenealogyContext();
  const { allMembersMap, loading: genealogyLoading, rootMember: user, refreshMembers } = genealogyContext || { allMembersMap: new Map(), loading: true, rootMember: null, refreshMembers: async () => { } };

  // Check if user is AdminStock (has storeOwnerLevel S, M, C, or D)
  const isAdminStock = React.useMemo(() => {
    return user?.storeOwnerLevel && ['S', 'M', 'C', 'D'].includes(user.storeOwnerLevel);
  }, [user?.storeOwnerLevel]);


  const [transactions, setTransactions] = React.useState<WalletTransaction[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isRankTopUpDialogOpen, setIsRankTopUpDialogOpen] = React.useState(false);
  const [isMaintenanceTopUpDialogOpen, setIsMaintenanceTopUpDialogOpen] = React.useState(false);
  const [isProcessingMaintenance, setIsProcessingMaintenance] = React.useState(false);
  const [isProcessingRankTopUp, setIsProcessingRankTopUp] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(0);
  const pageSize = 15; // Show 15 transactions per page
  const { toast } = useToast();


  // Get the minimum PV required for the user's current rank
  const rankPV = React.useMemo(() => {
    if (!user?.rank) return 0;
    return getPVForRank(user.rank as any) || 0;
  }, [user?.rank]);

  // When rankOnlyNoPv is true (admin set rank only, no Top-Up), show 0 for PV on E-comm; after Top-Up both PV and rank show
  const currentPVForRank = React.useMemo(() => {
    if (user?.rankOnlyNoPv) return 0;
    return typeof user?.pv === 'number' ? user.pv : rankPV;
  }, [user?.pv, user?.rankOnlyNoPv, rankPV]);

  const currentRank = (user?.rank || 'Member') as Rank;

  // Calculate Stock balance from stock-related transactions (both credits and debits)
  const stockBalance = React.useMemo(() => {
    const stockTransactions = transactions.filter(tx => {
      // Check if transaction has referenceType 'stock_transfer' (exact match)
      const refType = tx.referenceType ? tx.referenceType.toLowerCase().trim() : '';
      const desc = (tx.description || '').toLowerCase();
      const type = (tx.type || '').toLowerCase();

      // Primary check: exact match for 'stock_transfer' (include both positive and negative amounts)
      if (refType === 'stock_transfer') {
        return true;
      }

      // Secondary checks: fallback to description/type matching (include both positive and negative)
      if (
        refType.includes('stock') ||
        type.includes('stock') ||
        desc.includes('stock transfer') ||
        desc.includes('stock purchase')
      ) {
        return true;
      }

      return false;
    });

    // Sum all amounts (positive for credits, negative for debits)
    const balance = stockTransactions.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    // Debug logging (remove in production if needed)
    if (process.env.NODE_ENV === 'development' && stockTransactions.length > 0) {
      console.log('Stock transactions found:', {
        count: stockTransactions.length,
        balance,
        transactions: stockTransactions.map(tx => ({
          id: tx.id,
          refType: tx.referenceType,
          desc: tx.description,
          amount: tx.amount
        }))
      });
    }

    return balance;
  }, [transactions]);

  // Calculate total PV received from product purchases (after deducting maintenance payments and rank top-ups)
  const productPurchasePV = React.useMemo(() => {
    const ref = (t: { referenceType?: string }) => (t.referenceType || '').toLowerCase().trim();
    // Exclude stock_transfer from PV/Product calculation
    // rank_topup credits should be excluded, but rank_topup debits (deductions) should be included
    const shouldExcludeFromCredits = (tx: { referenceType?: string }) => {
      const r = ref(tx);
      return r === 'maintenance_payment' || r === 'rank_topup' || r === 'stock_transfer';
    };

    // Credits: product_purchase only (exclude maintenance, rank_topup credits, and stock_transfer)
    const productPurchaseTransactions = transactions.filter(tx => {
      if (shouldExcludeFromCredits(tx)) return false;
      const r = ref(tx);
      const desc = (tx.description || '').toLowerCase();
      if (r === 'product_purchase') return true;
      if (desc.includes('product purchase') || desc.includes('order')) return true;
      return false;
    });

    // Include maintenance_payment and rank_topup as deductions (negative amounts)
    // These reduce the available PV/Product balance
    const deductionTransactions = transactions.filter(tx => {
      const r = ref(tx);
      const amount = Number(tx.amount) || 0;
      // Include maintenance_payment and rank_topup deductions (negative amounts)
      return (r === 'maintenance_payment' || r === 'rank_topup') && amount < 0;
    });

    const totalCredits = productPurchaseTransactions.reduce((sum, tx) => {
      const amount = Number(tx.amount) || 0;
      return amount > 0 ? sum + amount : sum;
    }, 0);

    const totalDeductions = deductionTransactions.reduce((sum, tx) => {
      const amount = Number(tx.amount) || 0;
      // amount is already negative, so we add it (which subtracts)
      return sum + amount;
    }, 0);

    return totalCredits + totalDeductions;
  }, [transactions]);

  // Calculate total PV (PV/Rank + Stock + Product Purchases)
  const totalPV = React.useMemo(() => {
    return currentPVForRank + stockBalance + productPurchasePV;
  }, [currentPVForRank, stockBalance, productPurchasePV]);

  // Get required maintenance amount based on user's rank
  const requiredMaintenancePV = React.useMemo(() => {
    if (!user?.rank) return 20; // Default to 20 PV
    return getMaintenanceTopupAmount(user.rank);
  }, [user?.rank]);

  // For AdminStock: use stockBalance, for regular members: use productPurchasePV
  const availablePVForMaintenance = React.useMemo(() => {
    return isAdminStock ? stockBalance : productPurchasePV;
  }, [isAdminStock, stockBalance, productPurchasePV]);

  // Check if user has enough PV for maintenance
  // Button should be green if availablePVForMaintenance >= requiredMaintenancePV
  const hasEnoughPVForMaintenance = React.useMemo(() => {
    return availablePVForMaintenance >= requiredMaintenancePV;
  }, [availablePVForMaintenance, requiredMaintenancePV]);

  // Calculate wallet balance from PV-related transactions ONLY (exclude commissions)
  const walletBalance = React.useMemo(() => {
    const pvOnlyTransactions = transactions.filter((tx) => {
      // Filter out commission-related transactions (same logic as unifiedHistory)
      const refType = (tx.referenceType || '').toLowerCase();
      const desc = (tx.description || '').toLowerCase();
      const type = (tx.type || '').toLowerCase();

      // Exclude transactions with referenceType 'commission'
      if (refType === 'commission') {
        return false;
      }

      // Exclude transactions with commission-related descriptions
      if (desc.includes('stockist commission') ||
        desc.includes('stockist bonus') ||
        desc.includes('binary bonus') ||
        desc.includes('rank bonus') ||
        desc.includes('matching bonus') ||
        desc.includes('daily match')) {
        return false;
      }

      return true;
    });

    return pvOnlyTransactions.reduce((sum, tx) => {
      const amount = Number(tx.amount) || 0;
      return sum + amount; // Positive amounts add, negative amounts subtract
    }, 0);
  }, [transactions]);

  // E-Comm (PV Points Wallet) should ONLY show PV-related transactions
  // Commissions ($) are separate and shown only in E-Cash wallet
  // Use walletBalance directly (which is calculated from PV transactions only)
  // Include product_purchase transactions in the display

  const fetchWalletData = React.useCallback(async () => {
    if (!authUser) return;
    setLoading(true);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

      if (!token) {
        console.warn('E-Cash: No auth token found, using empty transactions');
        setTransactions([]);
        setLoading(false);
        return;
      }

      // REMOVED: Auto-trigger daily match on wallet load
      // This was causing repeated matching on every page refresh
      // Daily match should only be triggered manually by user or when new PV is added

      // E-Comm (PV Points Wallet) should ONLY fetch PV-related transactions
      // Commissions ($) are fetched separately in E-Cash wallet, not here
      const txRes = await fetch('/api/wallet/transactions?limit=100&offset=0', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (txRes.ok) {
        const rawTx = await txRes.json();
        const data = rawTx?.data?.transactions ?? rawTx?.data ?? rawTx ?? [];
        const mapped: WalletTransaction[] = Array.isArray(data)
          ? data.map((tx: any) => ({
            id: tx.id,
            type: tx.type,
            amount: tx.amount,
            balanceBefore: tx.balanceBefore,
            balanceAfter: tx.balanceAfter,
            description: tx.description,
            referenceId: tx.referenceId,
            referenceType: tx.referenceType,
            status: tx.status,
            createdAt: tx.createdAt || tx.date || tx.timestamp || new Date().toISOString(),
          }))
          : [];

        // Debug: Log ALL transactions and specifically stock transfer transactions
        console.log('📊 E-Cash: All transactions loaded', {
          total: mapped.length,
          transactions: mapped.map(tx => ({
            id: tx.id,
            type: tx.type,
            refType: tx.referenceType,
            desc: tx.description,
            amount: tx.amount,
            date: tx.createdAt
          }))
        });

        const stockTxs = mapped.filter(tx => {
          const refType = tx.referenceType?.toLowerCase().trim() || '';
          const desc = tx.description?.toLowerCase() || '';
          return refType === 'stock_transfer' || refType === 'maintenance_topup' || desc.includes('stock transfer') || desc.includes('maintenance');
        });

        if (stockTxs.length > 0) {
          console.log('✅ E-Cash: Found stock transfer transactions', {
            count: stockTxs.length,
            totalStockPV: stockTxs.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0),
            transactions: stockTxs.map(tx => ({
              id: tx.id,
              refType: tx.referenceType,
              desc: tx.description,
              amount: tx.amount,
              date: tx.createdAt
            }))
          });
        } else {
          console.warn('⚠️ E-Cash: No stock transfer transactions found', {
            totalTransactions: mapped.length,
            allRefTypes: [...new Set(mapped.map(tx => tx.referenceType).filter(Boolean))],
            allDescriptions: mapped.map(tx => ({
              desc: tx.description,
              refType: tx.referenceType,
              type: tx.type
            }))
          });
        }

        setTransactions(mapped);
        setCurrentPage(0); // Reset to first page when transactions are refreshed
      } else if (txRes.status === 401) {
        // Token expired or invalid - silently handle, auth guard will redirect
        setTransactions([]);
        setCurrentPage(0);
      } else {
        // Only log non-auth errors
        const errorText = await txRes.text().catch(() => '');
        console.warn('E-Cash: Failed to fetch wallet transactions:', errorText);
        setTransactions([]);
        setCurrentPage(0);
      }
    } catch (error) {
      // Only log non-auth errors
      if (!(error instanceof Error && error.message.includes('Unauthorized'))) {
        console.error('E-Comm: Failed to fetch wallet data:', error);
      }
      setTransactions([]);
      setCurrentPage(0);
    } finally {
      setLoading(false);
    }
  }, [authUser]);

  React.useEffect(() => {
    fetchWalletData();
  }, [fetchWalletData]);

  const router = useRouter();

  // Handler for automatic maintenance processing
  const handleAutomaticMaintenance = React.useCallback(async () => {
    if (!hasEnoughPVForMaintenance) {
      toast({
        variant: 'destructive',
        title: t('ecash.maintenanceTopup.insufficientPV'),
        description: t('ecash.maintenanceTopup.insufficientPVDesc', {
          required: String(requiredMaintenancePV),
          current: String(productPurchasePV)
        }),
      });
      // Redirect to Products page after a short delay
      setTimeout(() => {
        router.push('/product');
      }, 1500);
      return;
    }

    setIsProcessingMaintenance(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        toast({
          variant: 'destructive',
          title: t('ecash.maintenanceTopup.authError'),
          description: t('ecash.maintenanceTopup.authErrorDesc'),
        });
        setIsProcessingMaintenance(false);
        return;
      }

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch('/api/maintenance-topup-requests', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to process maintenance');
      }

      toast({
        title: t('ecash.maintenanceTopup.paidSuccessfully'),
        description: data.message || t('ecash.maintenanceTopup.paidSuccessfullyDesc', {
          amount: String(requiredMaintenancePV)
        }),
      });

      // Refresh wallet data to update PV balances (don't wait for it to complete)
      fetchWalletData().catch((err) => {
        console.error('Failed to refresh wallet data:', err);
        // Don't show error to user - just log it
      });
    } catch (error: any) {
      if (error.name === 'AbortError') {
        toast({
          variant: 'destructive',
          title: t('ecash.maintenanceTopup.requestTimeout'),
          description: t('ecash.maintenanceTopup.requestTimeoutDesc'),
        });
      } else {
        toast({
          variant: 'destructive',
          title: t('ecash.maintenanceTopup.paymentFailed'),
          description: t('ecash.maintenanceTopup.paymentFailedDesc'),
        });
      }
    } finally {
      setIsProcessingMaintenance(false);
    }
  }, [hasEnoughPVForMaintenance, requiredMaintenancePV, productPurchasePV, toast, fetchWalletData]);

  // Admin Stock pays maintenance for another member (same flow as rank top-up: PUT with amount)
  const handleMaintenanceForOther = React.useCallback(async (targetMemberId: string, amount: number) => {
    if (amount <= 0 || amount > availablePVForMaintenance) {
      toast({
        variant: 'destructive',
        title: t('ecash.maintenanceTopup.insufficientPV'),
        description: t('ecash.maintenanceTopup.insufficientPVDesc', {
          required: String(amount),
          current: String(availablePVForMaintenance),
        }),
      });
      throw new Error('Invalid amount');
    }
    setIsProcessingMaintenance(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        toast({
          variant: 'destructive',
          title: t('ecash.maintenanceTopup.authError'),
          description: t('ecash.maintenanceTopup.authErrorDesc'),
        });
        throw new Error('Unauthorized');
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      const response = await fetch('/api/maintenance-topup-requests', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetMemberId, amount }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to pay maintenance');
      }
      toast({
        title: t('ecash.maintenanceTopup.paidSuccessfully'),
        description: data.message || `Maintenance paid using ${amount} PV from your Product Purchases.`,
      });
      fetchWalletData().catch(() => { });
      refreshMembers().catch(() => { });
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        toast({
          variant: 'destructive',
          title: t('ecash.maintenanceTopup.paymentFailed'),
          description: e?.message || t('ecash.maintenanceTopup.paymentFailedDesc'),
        });
      } else {
        toast({
          variant: 'destructive',
          title: t('ecash.maintenanceTopup.requestTimeout'),
          description: t('ecash.maintenanceTopup.requestTimeoutDesc'),
        });
      }
      throw e;
    } finally {
      setIsProcessingMaintenance(false);
    }
  }, [availablePVForMaintenance, toast, fetchWalletData, refreshMembers, t]);

  // For AdminStock: use stockBalance, for regular members: use productPurchasePV
  const availablePVForRankTopUp = React.useMemo(() => {
    return isAdminStock ? stockBalance : productPurchasePV;
  }, [isAdminStock, stockBalance, productPurchasePV]);

  const handleRankTopUpClick = React.useCallback(() => {
    if (availablePVForRankTopUp <= 0) {
      toast({
        variant: 'destructive',
        title: t('ecash.rankTopup.insufficientPV'),
        description: t('ecash.rankTopup.insufficientPVDesc'),
      });
      // Redirect to Products page after a short delay
      setTimeout(() => {
        router.push('/product');
      }, 1500);
      return;
    }
    setIsRankTopUpDialogOpen(true);
  }, [availablePVForRankTopUp, router, toast, t]);

  const handleRankTopUpSubmit = React.useCallback(async (amount: number, targetMemberId?: string) => {
    if (amount <= 0 || amount > availablePVForRankTopUp) {
      toast({
        variant: 'destructive',
        title: t('ecash.rankTopup.insufficientPV'),
        description: t('ecash.rankTopup.insufficientPVDesc'),
      });
      return;
    }

    setIsProcessingRankTopUp(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        toast({
          variant: 'destructive',
          title: t('common.error'),
          description: t('ecash.rankTopup.failedDesc'),
        });
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch('/api/rank-topup', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount, targetMemberId }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to top up rank');
      }

      toast({
        title: t('ecash.rankTopup.success'),
        description: data.message || t('ecash.rankTopup.successDesc', { amount: formatPV(amount) }),
      });

      fetchWalletData().catch((err) => {
        console.error('Failed to refresh wallet data:', err);
      });

      refreshMembers().catch((err) => {
        console.error('Failed to refresh genealogy data:', err);
      });

      setIsRankTopUpDialogOpen(false);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        toast({
          variant: 'destructive',
          title: t('ecash.maintenanceTopup.requestTimeout'),
          description: t('ecash.maintenanceTopup.requestTimeoutDesc'),
        });
      } else {
        toast({
          variant: 'destructive',
          title: t('ecash.rankTopup.failed'),
          description: error.message || t('ecash.rankTopup.failedDesc'),
        });
      }
    } finally {
      setIsProcessingRankTopUp(false);
    }
  }, [availablePVForRankTopUp, refreshMembers, fetchWalletData, toast, t]);

  if (genealogyLoading || loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-12 w-12 animate-spin" />
      </div>
    )
  }

  // Show only wallet transactions in e-cash wallet page
  // E-Comm (PV Points Wallet) shows ONLY PV-related transactions (stock transfers, PV topups, etc.)
  // Commissions ($) are shown separately in E-Cash wallet
  const unifiedHistory: UnifiedEntry[] = [
    ...transactions
      .filter((t) => {
        // Filter out commission-related transactions
        const refType = (t.referenceType || '').toLowerCase();
        const desc = (t.description || '').toLowerCase();
        const type = (t.type || '').toLowerCase();

        // Exclude transactions with referenceType 'commission'
        if (refType === 'commission') {
          return false;
        }

        // Exclude transactions with commission-related descriptions
        if (desc.includes('stockist commission') ||
          desc.includes('stockist bonus') ||
          desc.includes('binary bonus') ||
          desc.includes('rank bonus') ||
          desc.includes('matching bonus') ||
          desc.includes('daily match')) {
          return false;
        }

        // Include product purchase transactions (these add PV to wallet)
        if (refType === 'product_purchase') {
          return true;
        }

        return true;
      })
      .map((t) => ({
        id: t.id,
        date: t.createdAt,
        type: t.type || '',
        amount: t.amount,
        description: t.description || t.referenceType || t.referenceId || '',
        status: t.status || '',
        source: 'wallet' as const,
        referenceType: t.referenceType,
      })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 sm:p-6 md:p-8">
      <Card>
        <CardContent className="space-y-6 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ">
            <div className="space-y-2">
              <div className='flex flex-col gap-2'>
                <CardTitle className="flex items-center gap-2">
                  <Wallet /> {t('ecash.title')}
                </CardTitle>
                <CardDescription>
                  {t('ecash.description')}
                </CardDescription>
              </div>
              <Card className="w-full border-2">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl">
                        <Coins className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">{t('ecash.balance')}</p>
                        <p className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
                          {formatPV(totalPV)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => fetchWalletData()}
                      title="Refresh balance"
                    >
                      <RefreshCw className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    {t('ecash.availablePoints')}
                  </p>
                  <div className={cn("grid gap-3 pt-4 border-t", isAdminStock ? "grid-cols-2" : "grid-cols-2")}>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">{t('ecash.pvRank')}</p>
                      <p className="text-lg font-semibold">{formatPV(currentPVForRank)}</p>
                    </div>
                    {isAdminStock ? (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">{t('ecash.stock')}</p>
                        <p className="text-lg font-semibold">{formatPV(stockBalance)}</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">{t('ecash.productPurchasePV')}</p>
                        <p className="text-lg font-semibold">{formatPV(productPurchasePV)}</p>
                      </div>
                    )}
                  </div>
                  <div className="pt-4 border-t mt-4 space-y-2">
                    {/* Top-Up button: hidden for AdminStock (D, C, M, S); shown for regular members only on E-comm page */}
                    {!isAdminStock && (
                      <>
                        <Button
                          onClick={handleRankTopUpClick}
                          className={cn(
                            "w-full",
                            availablePVForRankTopUp > 0
                              ? "bg-blue-500 hover:bg-blue-600 text-white"
                              : "bg-blue-100 text-blue-600 border border-blue-200"
                          )}
                          variant="default"
                        >
                          {isProcessingRankTopUp ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              {t('ecash.rankTopup.processing')}
                            </>
                          ) : (
                            t('ecash.rankTopup.title')
                          )}
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          {t('ecash.rankTopup.description')}
                        </p>
                      </>
                    )}
                    <Button
                      onClick={() => setIsMaintenanceTopUpDialogOpen(true)}
                      disabled={isProcessingMaintenance}
                      className={cn(
                        "w-full",
                        hasEnoughPVForMaintenance
                          ? "bg-green-500 hover:bg-green-600 text-white"
                          : "bg-green-100 text-green-600 border border-green-200"
                      )}
                      variant="default"
                    >
                      {t('ecash.maintenanceTopup.title')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

          </div>

          <RankTopUpDialog
            isOpen={isRankTopUpDialogOpen}
            onOpenChange={setIsRankTopUpDialogOpen}
            availablePV={availablePVForRankTopUp}
            isLoading={isProcessingRankTopUp}
            onSubmit={handleRankTopUpSubmit}
            currentRank={currentRank}
            currentPVForRank={currentPVForRank}
          />
          <MaintenanceTopUpDialog
            isOpen={isMaintenanceTopUpDialogOpen}
            onOpenChange={setIsMaintenanceTopUpDialogOpen}
            balance={availablePVForMaintenance}
            onSelfSubmit={handleAutomaticMaintenance}
            onPayForOther={handleMaintenanceForOther}
            isProcessing={isProcessingMaintenance}
          />

        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">{t('ecash.transactionHistory')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-muted/80 to-muted/60 border-b border-border/50">
                  <TableHead className="hidden sm:table-cell font-semibold text-foreground py-4 px-6">{t('ecash.date')}</TableHead>
                  <TableHead className="font-semibold text-foreground py-4 px-6">{t('ecash.transactionDetail')}</TableHead>
                  <TableHead className="text-right font-semibold text-foreground py-4 px-6">{t('ecash.amount')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TooltipProvider>
                  {unifiedHistory.length > 0 ? (
                    unifiedHistory
                      .slice(currentPage * pageSize, (currentPage + 1) * pageSize)
                      .map((entry, index) => {
                        const { id, date: rawDate, amount, type, status, description, source } = entry;
                        const safeType = type || '';
                        const safeStatus = status || '';
                        const dateObj = new Date(rawDate);
                        const date = dateObj.toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        });
                        const time = dateObj.toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                        });
                        const formattedDate = `${date}, ${time}`;

                        let desc = description || safeType;
                        if (source === 'wallet') {
                          // Check for E-Cash transfer by referenceType or description
                          if (entry.referenceType === 'ecash_transfer' || desc.toLowerCase().includes('transfer to e-cash')) {
                            desc = t('ecash.transferToECashDesc');
                          } else if (safeType === 'E-Cash Purchase' || safeType === 'Purchase from Stockist') {
                            desc = t('ecash.productPurchase');
                          } else if (safeType === 'Binary Bonus' || safeType.includes('Stockist Bonus') || safeType.includes('Rank Achievement')) {
                            // keep description, no badge
                          } else if (safeType.startsWith('Transfer to') || safeType.startsWith('Sale to Downline')) {
                            const otherPartyName = safeType.split(' ').slice(2).join(' ');
                            desc = t('ecash.transferTo', { username: otherPartyName });
                          } else if (safeType.startsWith('Transfer from')) {
                            const otherPartyName = safeType.split(' ').slice(2).join(' ');
                            desc = t('ecash.transferFrom', { username: otherPartyName });
                          }
                        } else {
                          // commission
                          desc = desc || 'Commission';
                        }

                        const displayDesc = String(desc || safeType || '');
                        const isLongDesc = displayDesc.length > 80;
                        const truncatedDesc = isLongDesc ? displayDesc.substring(0, 80) + '...' : displayDesc;

                        return (
                          <TableRow
                            key={id}
                            className={cn(
                              'transition-colors hover:bg-muted/40 border-b border-border/30',
                              index % 2 === 0 ? 'bg-background' : 'bg-muted/10'
                            )}
                          >
                            <TableCell className="hidden sm:table-cell font-medium py-4 px-6 text-sm text-foreground">
                              {formattedDate}
                            </TableCell>
                            <TableCell className="py-4 px-6">
                              <div className="flex items-center gap-2.5">
                                {getTransactionIcon(amount, safeType)}
                                <div className="flex-1 min-w-0">
                                  {isLongDesc ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="flex items-center gap-1 cursor-help">
                                          <p className="font-medium text-sm truncate">{truncatedDesc}</p>
                                          <Info className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0" />
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-md">
                                        <p className="text-sm whitespace-normal">{displayDesc}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <p className="font-medium text-sm">{displayDesc}</p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className={cn(
                              "text-right font-semibold py-4 px-6",
                              getTransactionAmountClass(amount, safeType)
                            )}>
                              <div className="flex items-center justify-end">
                                <span className={cn(
                                  "text-lg font-bold",
                                  amount > 0
                                    ? "text-green-600 dark:text-green-500"
                                    : "text-red-600 dark:text-red-500"
                                )}>
                                  {amount > 0 ? '+' : ''}
                                  {formatPV(amount)}
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center">
                        {t('ecash.noTransactions')}
                      </TableCell>
                    </TableRow>
                  )}
                </TooltipProvider>
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls - Show when there are 15+ transactions */}
          {unifiedHistory.length >= pageSize && (
            <div className="flex items-center justify-between pt-4 mt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {Math.min(currentPage * pageSize + 1, unifiedHistory.length)} to {Math.min((currentPage + 1) * pageSize, unifiedHistory.length)} of {unifiedHistory.length} transactions
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                  disabled={currentPage === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <div className="text-sm text-muted-foreground px-3 min-w-[100px] text-center">
                  Page {currentPage + 1} of {Math.max(1, Math.ceil(unifiedHistory.length / pageSize))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(Math.ceil(unifiedHistory.length / pageSize) - 1, prev + 1))}
                  disabled={currentPage >= Math.ceil(unifiedHistory.length / pageSize) - 1}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}



