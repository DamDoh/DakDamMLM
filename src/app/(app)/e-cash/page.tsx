'use client';

import * as React from 'react';
import { Coins, ArrowUp, ArrowRightLeft, Loader2, RefreshCw, ChevronLeft, ChevronRight, Info, Filter, X, ChevronDown, ChevronUp, Calendar as CalendarIcon } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/internationalization';
import { formatCurrency } from '@/lib/utils';
import { useAuthContext } from '@/context/auth-context';
import { useGenealogyContext } from '@/context/genealogy-context';
import WithdrawDialog from '@/components/ecash/withdraw-dialog';
import TransferECashDialog from '@/components/ecash/transfer-ecash-dialog';

type ECashTransaction = {
  id: string;
  type: string;
  source: string | null;
  amountUsd: number;
  createdAt: string;
  commissionType?: string;
  description?: string | null;
  isCommission?: boolean;
};

export default function ECashPage() {
  const { t } = useI18n();
  const { user: authUser } = useAuthContext();
  const genealogyContext = useGenealogyContext();
  const { rootMember: user } = genealogyContext || { rootMember: null };

  const [balance, setBalance] = React.useState<number>(0);
  const [transactions, setTransactions] = React.useState<ECashTransaction[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [transactionLoading, setTransactionLoading] = React.useState(false);
  const [isWithdrawDialogOpen, setWithdrawDialogOpen] = React.useState(false);
  const [isTransferDialogOpen, setTransferDialogOpen] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(0);
  const pageSize = 15; // Show 15 transactions per page

  // Filter states
  const [showFilters, setShowFilters] = React.useState<boolean>(false);
  const [filterType, setFilterType] = React.useState<string>('all');
  const [startDate, setStartDate] = React.useState<string>('');
  const [endDate, setEndDate] = React.useState<string>('');
  const [dateRange, setDateRange] = React.useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });

  // Helper function to format date range display
  const formatDateRange = React.useCallback((from: Date | undefined, to: Date | undefined): string => {
    if (!from && !to) return '';
    if (from && !to) return format(from, 'MMM dd, yyyy');
    if (!from && to) return format(to, 'MMM dd, yyyy');
    if (from && to) {
      if (from.getTime() === to.getTime()) {
        return format(from, 'MMM dd, yyyy');
      }
      return `${format(from, 'MMM dd, yyyy')} - ${format(to, 'MMM dd, yyyy')}`;
    }
    return '';
  }, []);

  // Sync dateRange with startDate and endDate strings
  React.useEffect(() => {
    if (dateRange.from || dateRange.to) {
      setStartDate(dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : '');
      setEndDate(dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : '');
    } else {
      setStartDate('');
      setEndDate('');
    }
  }, [dateRange]);

  // Check if user is admin
  const isAdmin = React.useMemo(() => {
    return (authUser as any)?.isAdmin || false;
  }, [authUser]);

  // Check if user is AdminStock (has storeOwnerLevel)
  const isAdminStock = React.useMemo(() => {
    return user?.storeOwnerLevel && ['S', 'M', 'C', 'D'].includes(user.storeOwnerLevel);
  }, [user?.storeOwnerLevel]);

  // For Admin users, hide specific commission bonus types from the E-Cash view
  const hiddenCommissionKeywords = React.useMemo(
    () => ['binary bonus', 'matching bonus', 'daily match', 'stockist bonus'],
    []
  );

  // Transactions actually displayed in the admin E-Cash table
  const displayedTransactions = React.useMemo(() => {
    if (!isAdmin) return transactions;

    return transactions.filter((tx) => {
      if (tx.type !== 'commission') return true;
      const ct = (tx.commissionType || '').toLowerCase();
      // Hide Binary Bonus, Matching Bonus, Daily Match, Stockist Bonus
      return !hiddenCommissionKeywords.some((k) => ct.includes(k));
    });
  }, [transactions, isAdmin, hiddenCommissionKeywords]);

  // For the main header card: base Total Commissions Earned on the
  // full (unfiltered) data from the initial load.
  // For admins, we will later adjust this to exclude specific bonus types.
  // For non-admin users (members, AdminStock), store the initial balance so it stays fixed.
  const [adminAdjustedBalance, setAdminAdjustedBalance] = React.useState<number | null>(null);
  const [initialBalance, setInitialBalance] = React.useState<number | null>(null);

  const displayedBalance = React.useMemo(() => {
    if (isAdmin) {
      // For admin: if we have an adjusted total, use it; otherwise fall back to raw balance.
      return adminAdjustedBalance !== null ? adminAdjustedBalance : balance;
    }
    // For non-admin users: use the initial balance (stays fixed) if available, otherwise use current balance
    return initialBalance !== null ? initialBalance : balance;
  }, [isAdmin, balance, adminAdjustedBalance, initialBalance]);

  const fetchECashData = React.useCallback(async (isInitialLoad = false) => {
    if (!authUser) return;

    // Use different loading states for initial load vs filter changes
    if (isInitialLoad) {
      setLoading(true);
    } else {
      setTransactionLoading(true);
    }

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        setBalance(0);
        setTransactions([]);
        if (isInitialLoad) {
          setLoading(false);
        } else {
          setTransactionLoading(false);
        }
        return;
      }

      // Build query parameters for filters
      // For Admin and AdminStock: use client-side filtering (don't send filterType to backend)
      // For regular members: only apply filters on subsequent loads (not initial load)
      // This ensures we get the full balance on initial load
      const params = new URLSearchParams();
      if (!isInitialLoad && !isAdmin && !isAdminStock) {
        // Apply filters for regular members after initial load (backend filtering)
        if (filterType && filterType !== 'all') {
          params.append('type', filterType);
        }
        if (startDate) {
          params.append('startDate', startDate);
        }
        if (endDate) {
          params.append('endDate', endDate);
        }
      } else if (!isAdmin && !isAdminStock) {
        // For regular members on initial load, only apply date filters if provided
        if (startDate) {
          params.append('startDate', startDate);
        }
        if (endDate) {
          params.append('endDate', endDate);
        }
      }

      const queryString = params.toString();
      const url = `/api/e-cash${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const eCashData = data.data || {};

        const newBalance = eCashData.balance || 0;
        const newTransactions: ECashTransaction[] = eCashData.transactions || [];

        // Only update balance on initial load or if no initial balance is stored
        // This ensures the displayed balance stays fixed when filters change
        if (isInitialLoad || initialBalance === null) {
          setBalance(newBalance);
          if (isInitialLoad && !isAdmin) {
            // Store initial balance for non-admin users so it stays fixed
            setInitialBalance(newBalance);
          }
        }

        setTransactions(newTransactions);
        setCurrentPage(0); // Reset to first page when transactions are refreshed

        // On initial load for admin, capture an adjusted balance that
        // excludes Binary Bonus / Matching Bonus / Daily Match / Stockist Bonus.
        if (isInitialLoad && isAdmin) {
          const hiddenTotal = newTransactions.reduce((sum, tx) => {
            if (tx.type !== 'commission') return sum;
            const ct = (tx.commissionType || '').toLowerCase();
            return hiddenCommissionKeywords.some((k) => ct.includes(k))
              ? sum + tx.amountUsd
              : sum;
          }, 0);

          setAdminAdjustedBalance(newBalance - hiddenTotal);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to fetch E-Cash data:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData.error || errorData.message || 'Unknown error',
          data: errorData
        });
        setBalance(0);
        setTransactions([]);
      }
    } catch (error) {
      console.error('Error fetching E-Cash data:', error);
      setBalance(0);
      setTransactions([]);
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      } else {
        setTransactionLoading(false);
      }
    }
  }, [authUser, filterType, startDate, endDate, isAdmin, isAdminStock, hiddenCommissionKeywords]);

  // Initial load - fetch balance and transactions
  React.useEffect(() => {
    if (authUser) {
      fetchECashData(true);
      // Auto-backfill on mount to sync existing commissions
      backfillCommissions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  // Filter changes - only reload transactions for regular members.
  // Admin and AdminStock use client-side filtering only, so we don't refetch or
  // re-load the Total Commissions Earned when changing filter type.
  React.useEffect(() => {
    if (authUser && !loading && !isAdmin && !isAdminStock) {
      // Only fetch if initial load is complete and user is not Admin/AdminStock
      fetchECashData(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, startDate, endDate, isAdmin, isAdminStock]);

  const backfillCommissions = React.useCallback(async () => {
    if (!authUser) return;

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) return;

      const response = await fetch('/api/e-cash/backfill', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        // If transactions were created, refresh the balance
        if (result.data?.transactionsCreated > 0) {
          await fetchECashData(false);
        }
      }
    } catch (error) {
      console.error('Error backfilling commissions:', error);
      // Silent fail - backfill is best effort
    }
  }, [authUser, fetchECashData]);

  // Use filtered list for admin, full list for other users, and apply UI filterType
  const visibleTransactions = React.useMemo(() => {
    const base = isAdmin ? displayedTransactions : transactions;

    // For non-admins (members), rely on backend filterType; just show base.
    if (!isAdmin && !isAdminStock) return base;

    // For admins: apply client-side filter for Transfer / Withdrawal / E-Cash Order
    if (isAdmin) {
      if (filterType === 'transfer') {
        return base.filter((tx) => tx.type === 'transfer');
      }
      if (filterType === 'withdrawal') {
        return base.filter((tx) => tx.type === 'withdrawal');
      }
      if (filterType === 'ecash_order') {
        return base.filter((tx) => {
          if (tx.type !== 'commission') return false;
          const ct = (tx.commissionType || '').toLowerCase();
          return ct.includes('e-cash from order');
        });
      }
      // 'all' or unknown: show all base transactions (already stripped of bonuses for admin)
      return base;
    }

    // For AdminStock: apply client-side filter for all commission types and transaction types
    if (isAdminStock) {
      if (filterType === 'transfer') {
        return base.filter((tx) => tx.type === 'transfer');
      }
      if (filterType === 'withdrawal') {
        return base.filter((tx) => tx.type === 'withdrawal');
      }
      if (filterType === 'ecash_order') {
        return base.filter((tx) => {
          if (tx.type !== 'commission') return false;
          const ct = (tx.commissionType || '').toLowerCase();
          return ct.includes('e-cash from order');
        });
      }
      if (filterType === 'Binary Bonus') {
        return base.filter((tx) => {
          if (tx.type !== 'commission') return false;
          const ct = (tx.commissionType || '').toLowerCase();
          return ct.includes('binary bonus');
        });
      }
      if (filterType === 'Matching Bonus') {
        return base.filter((tx) => {
          if (tx.type !== 'commission') return false;
          const ct = (tx.commissionType || '').toLowerCase();
          return ct.includes('matching bonus');
        });
      }
      if (filterType === 'Daily Match') {
        return base.filter((tx) => {
          if (tx.type !== 'commission') return false;
          const ct = (tx.commissionType || '').toLowerCase();
          return ct.includes('daily match');
        });
      }
      if (filterType === 'Stockist Bonus') {
        return base.filter((tx) => {
          if (tx.type !== 'commission') return false;
          const ct = (tx.commissionType || '').toLowerCase();
          return ct.includes('stockist bonus');
        });
      }
      // 'all' or unknown: show all transactions
      return base;
    }

    return base;
  }, [isAdmin, isAdminStock, displayedTransactions, transactions, filterType]);

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 sm:p-6 md:p-8">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Combined Header and Balance Card */}
          <Card className="border-2">
            <CardContent className="pt-6 space-y-6">
              {/* Header Section */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">{t('eCash.title')}</h1>
                  <p className="text-muted-foreground mt-1">{t('eCash.description')}</p>
                </div>
                <Button
                  onClick={() => {
                    fetchECashData(false);
                  }}
                  variant="outline"
                  size="sm"
                  disabled={transactionLoading}
                >
                  <RefreshCw className={cn('h-4 w-4 mr-2', transactionLoading && 'animate-spin')} />
                  {t('ecash.refresh')}
                </Button>
              </div>

              {/* Balance Section */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-center gap-4 flex-1">
                  <div className="p-4 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl">
                    <Coins className="h-10 w-10 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-muted-foreground mb-1">{t('ecash.totalCommissionsEarned')}</p>
                    <p className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
                      {formatCurrency(displayedBalance)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">{t('ecash.totalCommissionsEarnedDescription')}</p>
                  </div>
                </div>
                {isAdmin ? (
                  <Button
                    onClick={() => setTransferDialogOpen(true)}
                    disabled={!balance || balance <= 0}
                    size="lg"
                    className="w-full md:w-auto"
                  >
                    <ArrowRightLeft className="h-4 w-4 mr-2" />
                    {t('ecash.transferToMember.button')}
                  </Button>
                ) : (
                  <Button
                    onClick={() => setWithdrawDialogOpen(true)}
                    disabled={!balance || balance <= 0}
                    size="lg"
                    className="w-full md:w-auto"
                  >
                    <ArrowUp className="h-4 w-4 mr-2" />
                    {t('eCash.withdraw')}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Transaction History */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-xl">{t('eCash.transactionHistory')}</CardTitle>
                  <CardDescription>{t('eCash.transactionHistoryDescription')}</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="whitespace-nowrap"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  {t('eCash.filters')}
                  {showFilters ? (
                    <ChevronUp className="h-4 w-4 ml-2" />
                  ) : (
                    <ChevronDown className="h-4 w-4 ml-2" />
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              {showFilters && (
                <div className="mb-6 flex flex-col sm:flex-row gap-4 p-4 bg-muted/50 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{t('eCash.filters')}</span>
                  </div>

                  {/* Type Filter */}
                  <div className="flex-1 min-w-[200px]">
                    <Select value={filterType} onValueChange={setFilterType} disabled={transactionLoading}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('eCash.filterAllTypes')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('eCash.filterAllTypes')}</SelectItem>
                        {isAdmin ? (
                          <>
                            <SelectItem value="transfer">{t('eCash.filterTransfer')}</SelectItem>
                            <SelectItem value="withdrawal">{t('eCash.filterWithdrawal')}</SelectItem>
                            {/* E-Cash Order (E-Cash from Order commissions) */}
                            <SelectItem value="ecash_order">{t('eCash.filterECashOrder')}</SelectItem>
                          </>
                        ) : isAdminStock ? (
                          <>
                            <SelectItem value="Binary Bonus">{t('eCash.filterBinaryBonus')}</SelectItem>
                            <SelectItem value="Matching Bonus">{t('eCash.filterMatchingBonus')}</SelectItem>
                            <SelectItem value="Daily Match">{t('eCash.filterDailyMatch')}</SelectItem>
                            <SelectItem value="Stockist Bonus">{t('eCash.filterStockistBonus')}</SelectItem>
                            <SelectItem value="transfer">{t('eCash.filterTransfer')}</SelectItem>
                            <SelectItem value="withdrawal">{t('eCash.filterWithdrawal')}</SelectItem>
                            {/* E-Cash Order (E-Cash from Order commissions) */}
                            <SelectItem value="ecash_order">{t('eCash.filterECashOrder')}</SelectItem>
                          </>
                        ) : (
                          <>
                            <SelectItem value="Binary Bonus">{t('eCash.filterBinaryBonus')}</SelectItem>
                            <SelectItem value="Matching Bonus">{t('eCash.filterMatchingBonus')}</SelectItem>
                            <SelectItem value="Daily Match">{t('eCash.filterDailyMatch')}</SelectItem>
                            <SelectItem value="Stockist Bonus">{t('eCash.filterStockistBonus')}</SelectItem>
                            <SelectItem value="withdrawal">{t('eCash.filterWithdrawal')}</SelectItem>
                            <SelectItem value="transfer">{t('eCash.filterTransfer')}</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Date Range Filter */}
                  <div className="flex-1 min-w-[250px]">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !dateRange.from && !dateRange.to && "text-muted-foreground"
                          )}
                          disabled={transactionLoading}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateRange.from || dateRange.to ? (
                            formatDateRange(dateRange.from, dateRange.to)
                          ) : (
                            <span>{t('eCash.filterDateRange')}</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          initialFocus
                          mode="range"
                          defaultMonth={dateRange.from}
                          selected={dateRange}
                          onSelect={(range) => {
                            if (range) {
                              setDateRange({
                                from: range.from,
                                to: range.to,
                              });
                            } else {
                              setDateRange({ from: undefined, to: undefined });
                            }
                          }}
                          numberOfMonths={2}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Clear Filters Button */}
                  {(filterType !== 'all' || dateRange.from || dateRange.to) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFilterType('all');
                        setDateRange({ from: undefined, to: undefined });
                      }}
                      className="whitespace-nowrap bg-red-500 text-white border-red-500 hover:bg-red-600 hover:text-white dark:bg-red-600 dark:text-white dark:border-red-600 dark:hover:bg-red-700 dark:hover:text-white"
                      disabled={transactionLoading}
                    >
                      <X className="h-4 w-4 mr-2" />
                      {t('eCash.filterClear')}
                    </Button>
                  )}
                </div>
              )}

              {/* Filtered Total Display */}
              {(filterType !== 'all' || dateRange.from || dateRange.to) && (
                <div className="mb-4 p-4 bg-gradient-to-r from-green-50 via-green-50/80 to-green-50 dark:from-green-950/30 dark:via-green-950/20 dark:to-green-950/30 border-2 border-green-200 dark:border-green-800 rounded-lg shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">
                      {t('eCash.filteredCommissionTotal')}
                    </span>
                    <span className="text-xl font-bold text-green-600 dark:text-green-500">
                      {formatCurrency(
                        visibleTransactions
                          .filter((tx) => tx.amountUsd > 0)
                          .reduce((sum, tx) => sum + tx.amountUsd, 0)
                      )}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/80 mt-2 font-medium">
                    {t('eCash.filteredTransactionsCount', {
                      count: String(visibleTransactions.length),
                      plural: visibleTransactions.length !== 1 ? '' : ''
                    })}
                  </p>
                </div>
              )}

              {transactionLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : visibleTransactions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <div className="inline-flex p-4 bg-muted rounded-full mb-4">
                    <Coins className="h-8 w-8 opacity-50" />
                  </div>
                  <p className="text-base font-medium">{t('eCash.noTransactions')}</p>
                </div>
              ) : (
                <>
                  <div className="rounded-lg border overflow-hidden shadow-sm">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gradient-to-r from-muted/80 to-muted/60 border-b border-border/50">
                          <TableHead className="font-semibold text-foreground py-4 px-6">{t('eCash.date')}</TableHead>
                          <TableHead className="font-semibold text-foreground py-4 px-6">{t('eCash.type')}</TableHead>
                          <TableHead className="font-semibold text-foreground py-4 px-6">{t('eCash.source')}</TableHead>
                          <TableHead className="text-right font-semibold text-foreground py-4 px-6">{t('eCash.amount')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TooltipProvider>
                          {visibleTransactions
                            .slice(currentPage * pageSize, (currentPage + 1) * pageSize)
                            .map((transaction, index) => {
                              const dateObj = new Date(transaction.createdAt);
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
                              const isCredit = transaction.amountUsd > 0;
                              const displayAmount = Math.abs(transaction.amountUsd);

                              // Determine badge variant based on transaction type
                              const getBadgeVariant = () => {
                                if (transaction.commissionType) {
                                  if (transaction.commissionType.includes('Stockist')) return 'default';
                                  if (transaction.commissionType.includes('Binary')) return 'default';
                                  if (transaction.commissionType.includes('Matching')) return 'default';
                                  return 'secondary';
                                }
                                if (transaction.type === 'withdrawal') return 'destructive';
                                return 'secondary';
                              };

                              const transactionType = transaction.type === 'commission'
                                ? (transaction.commissionType || t('eCash.typeCommission'))
                                : transaction.type === 'withdrawal'
                                  ? t('eCash.typeWithdrawal')
                                  : t('eCash.typeTransfer');

                              const sourceText = transaction.commissionType && transaction.commissionType !== 'Commission'
                                ? (transaction.description || '-')
                                : transaction.source || '-';

                              const isLongSource = sourceText.length > 60;
                              const truncatedSource = isLongSource ? sourceText.substring(0, 60) + '...' : sourceText;

                              return (
                                <TableRow
                                  key={transaction.id}
                                  className={cn(
                                    'transition-colors hover:bg-muted/40 border-b border-border/30',
                                    index % 2 === 0 ? 'bg-background' : 'bg-muted/10'
                                  )}
                                >
                                  <TableCell className="font-medium py-4 px-6 text-sm text-foreground">
                                    {formattedDate}
                                  </TableCell>
                                  <TableCell className="py-4 px-6">
                                    <Badge
                                      variant={getBadgeVariant()}
                                      className={cn(
                                        "font-medium text-xs px-2.5 py-1",
                                        transaction.commissionType?.includes('Stockist') && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800",
                                        transaction.commissionType?.includes('Binary') && "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800",
                                        transaction.commissionType?.includes('Matching') && "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800"
                                      )}
                                    >
                                      {transactionType}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-muted-foreground py-4 px-6 max-w-md">
                                    {isLongSource ? (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className="flex items-center gap-1 cursor-help">
                                            <span className="truncate text-sm">{truncatedSource}</span>
                                            <Info className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0" />
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-md">
                                          <p className="text-sm whitespace-normal">{sourceText}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    ) : (
                                      <span className="text-sm">{sourceText}</span>
                                    )}
                                  </TableCell>
                                  <TableCell className={cn(
                                    'text-right font-semibold py-4 px-6',
                                    isCredit
                                      ? 'text-green-600 dark:text-green-500'
                                      : 'text-red-600 dark:text-red-500'
                                  )}>
                                    <div className="flex items-center justify-end gap-1">
                                      <span className={cn(
                                        "text-lg font-bold",
                                        isCredit ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500"
                                      )}>
                                        {isCredit ? '+' : '-'}{formatCurrency(displayAmount)}
                                      </span>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                        </TooltipProvider>
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination Controls - Show when there are 15+ transactions */}
                  {visibleTransactions.length >= pageSize && (
                    <div className="flex items-center justify-between pt-6 mt-6 border-t border-border/50">
                      <div className="text-sm text-muted-foreground font-medium">
                        Showing <span className="text-foreground font-semibold">{Math.min(currentPage * pageSize + 1, visibleTransactions.length)}</span> to <span className="text-foreground font-semibold">{Math.min((currentPage + 1) * pageSize, visibleTransactions.length)}</span> of <span className="text-foreground font-semibold">{visibleTransactions.length}</span> transactions
                      </div>
                      <div className="flex items-center gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                          disabled={currentPage === 0}
                          className="shadow-sm hover:shadow transition-shadow"
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>
                        <div className="text-sm font-medium text-foreground px-4 py-1.5 bg-muted/50 rounded-md min-w-[120px] text-center border border-border/30">
                          Page <span className="font-semibold">{currentPage + 1}</span> of <span className="font-semibold">{Math.max(1, Math.ceil(visibleTransactions.length / pageSize))}</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.min(Math.ceil(visibleTransactions.length / pageSize) - 1, prev + 1))}
                          disabled={currentPage >= Math.ceil(visibleTransactions.length / pageSize) - 1}
                          className="shadow-sm hover:shadow transition-shadow"
                        >
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Withdrawal Dialog - Only for non-admins */}
      {!isAdmin && (
        <WithdrawDialog
          isOpen={isWithdrawDialogOpen}
          onOpenChange={setWithdrawDialogOpen}
          balance={balance}
          onSuccess={fetchECashData}
        />
      )}

      {/* Transfer Dialog - Only for admins */}
      {isAdmin && (
        <TransferECashDialog
          isOpen={isTransferDialogOpen}
          onOpenChange={setTransferDialogOpen}
          balance={balance}
          onTransferSuccess={fetchECashData}
        />
      )}
    </div>
  );
}

