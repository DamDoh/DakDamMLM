
'use client';

import * as React from 'react';
import { Wallet, DollarSign, ArrowDown, ArrowUp, Loader2, PlusCircle } from 'lucide-react';

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
import { cn } from '@/lib/utils';
import type { Commission } from '@/lib/types';
import { useI18n } from '@/lib/internationalization';
import TransferDialog from '@/components/ecash/transfer-dialog';
import TopUpDialog from '@/components/ecash/topup-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatCurrency } from '@/lib/utils';
import { useAuthContext } from '@/context/auth-context';
import { useGenealogyContext } from '@/context/genealogy-context';

const getTransactionIcon = (amount: number, type: string) => {
    if (type.toLowerCase().includes('purchase') || type.toLowerCase().includes('transfer to')) {
        return <ArrowUp className="h-4 w-4 text-red-500" />;
    }
    return <ArrowDown className="h-4 w-4 text-green-500" />;
}

const getTransactionAmountClass = (amount: number, type: string) => {
    if (type.toLowerCase().includes('purchase') || type.toLowerCase().includes('transfer to')) {
        return 'text-red-600';
    }
    return 'text-green-600';
}

export default function EcashPage() {
  const { t } = useI18n();
  const { user } = useAuthContext();
  const { allMembersMap, loading: genealogyLoading } = useGenealogyContext() || { allMembersMap: new Map(), loading: true };

  const [isTransferDialogOpen, setTransferDialogOpen] = React.useState(false);
  const [isTopUpDialogOpen, setTopUpDialogOpen] = React.useState(false);
  const [isWithdrawDialogOpen, setWithdrawDialogOpen] = React.useState(false);

  const [commissions, setCommissions] = React.useState<Commission[]>([]);
  const [loading, setLoading] = React.useState(true);

  const ecashBalance = React.useMemo(() => {
    return commissions.reduce((acc, curr) => acc + curr.amount, 0);
  }, [commissions]);

  React.useEffect(() => {
    if (!user) return;
    setLoading(true);

    const fetchCommissions = async () => {
      try {
        const response = await fetch('/api/commissions');
        if (!response.ok) {
          throw new Error('Failed to fetch commissions');
        }
        const data = await response.json();
        setCommissions(data.data || []);
      } catch (error) {
        console.error('Failed to fetch commissions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCommissions();
  }, [user]);


  if (genealogyLoading || loading) {
    return (
       <div className="flex items-center justify-center h-full">
        <Loader2 className="h-12 w-12 animate-spin" />
      </div>
    )
  }

  const allTransactions = commissions;

  return (
    <>
      <TransferDialog
        isOpen={isTransferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        balance={ecashBalance}
        onTransferSuccess={() => {}}
      />
      <TopUpDialog 
        isOpen={isTopUpDialogOpen}
        onOpenChange={setTopUpDialogOpen}
        balance={ecashBalance}
      />
       <AlertDialog open={isWithdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('ecash.featureComingSoon')}</AlertDialogTitle>
            <AlertDialogDescription>
                {t('ecash.withdrawUnavailable')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setWithdrawDialogOpen(false)}>{t('common.ok')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex-1 space-y-6 p-4 pt-6 sm:p-6 md:p-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet /> {t('ecash.title')}
            </CardTitle>
            <CardDescription>
              {t('ecash.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
              <Card className="w-full max-w-sm">
                   <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                      {t('ecash.balance')}
                      </CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                      <div className="text-3xl font-bold">{formatCurrency(ecashBalance)}</div>
                      <p className="text-xs text-muted-foreground">
                          {t('ecash.availableFunds')}
                      </p>
                  </CardContent>
              </Card>

              <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setWithdrawDialogOpen(true)} icon="withdraw">
                      {t('ecash.withdraw')}
                  </Button>
                   <Button variant="outline" onClick={() => setTransferDialogOpen(true)} icon="transfer">
                      {t('ecash.transfer')}
                  </Button>
                  <Button onClick={() => setTopUpDialogOpen(true)} icon={PlusCircle}>
                      Add Funds
                  </Button>
              </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('ecash.transactionHistory')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden sm:table-cell">{t('ecash.date')}</TableHead>
                  <TableHead>{t('ecash.transactionDetail')}</TableHead>
                  <TableHead className="text-right">{t('ecash.amount')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allTransactions.length > 0 ? (
                  allTransactions.map((transaction) => {
                    const { id, date: dateStr, amount, type, status } = transaction;
                    const date = new Date(dateStr).toLocaleDateString();

                    let description = type;
                    let details;

                    if (type === 'E-Cash Purchase' || type === 'Purchase from Stockist') {
                        description = t('ecash.productPurchase');
                    } else if (type === 'Binary Bonus' || type.includes('Stockist Bonus') || type.includes('Rank Achievement')) {
                        details = t('ecash.statusLabel', { status });
                    } else if (type.startsWith('Transfer to') || type.startsWith('Sale to Downline')) {
                        const otherPartyName = type.split(' ').slice(2).join(' ');
                        description = t('ecash.transferTo', { username: otherPartyName});
                    } else if (type.startsWith('Transfer from')) {
                        const otherPartyName = type.split(' ').slice(2).join(' ');
                        description = t('ecash.transferFrom', { username: otherPartyName});
                    }


                    return (
                      <TableRow key={id}>
                        <TableCell className="hidden sm:table-cell">{date}</TableCell>
                        <TableCell>
                            <div className="flex items-center gap-2">
                                {getTransactionIcon(amount, type)}
                                <div>
                                    <p className="font-medium">{description}</p>
                                    {details && <Badge variant="outline" className="font-normal">{details}</Badge>}
                                </div>
                            </div>
                        </TableCell>
                        <TableCell className={cn("text-right font-medium", getTransactionAmountClass(amount, type))}>
                          {amount > 0 ? '+' : ''}
                          {formatCurrency(amount)}
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
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
