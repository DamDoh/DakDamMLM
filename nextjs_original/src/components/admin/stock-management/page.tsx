
'use client';

import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Boxes, Search, ArrowRightLeft } from 'lucide-react';
import { useGenealogyContext } from '@/context/genealogy-context';
import type { Member, StockistLevel } from '@/lib/types';
import { useI18n } from '@/lib/internationalization';
import StockTransferDialog from '@/components/admin/stock-transfer-dialog';
import { useToast } from '@/hooks/use-toast';
import StockRequests from '@/components/admin/stock-requests';

type StockistMember = Member & {
  inventoryCount: number;
};

export default function StockManagementPage() {
  const { t } = useI18n();
  const context = useGenealogyContext();
  const { members = [], loading, refreshData } = context || { members: [], loading: true, refreshData: async () => {} };
  const [filter, setFilter] = React.useState('');
  const [isTransferDialogOpen, setTransferDialogOpen] = React.useState(false);
  const [selectedStockist, setSelectedStockist] = React.useState<StockistMember | null>(null);
  const { toast } = useToast();


  const stockists = React.useMemo<StockistMember[]>(() => {
    return members
      .filter((m): m is Member & { storeOwnerLevel: StockistLevel } => m.storeOwnerLevel !== null && m.storeOwnerLevel !== undefined)
      .map(m => ({
        ...m,
        // This is a placeholder. We will fetch real inventory later.
        inventoryCount: Math.floor(Math.random() * 50), 
      }));
  }, [members]);
  
  const handleOpenTransferDialog = (stockist: StockistMember) => {
    setSelectedStockist(stockist);
    setTransferDialogOpen(true);
  };

  const handleTransferSuccess = async () => {
    toast({
      title: t('admin.stock.transferSuccess'),
      description: t('admin.stock.transferSuccessDesc'),
    });
    if (refreshData) {
      await refreshData();
    }
  };

  const columns: ColumnDef<StockistMember>[] = [
    {
      accessorKey: 'fullName',
      header: t('admin.stock.stockist'),
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={row.original.avatarUrl} alt={row.original.fullName} />
            <AvatarFallback>{row.original.firstName?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{row.original.fullName}</p>
            <p className="text-xs text-muted-foreground">{row.original.memberId}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'storeOwnerLevel',
      header: t('admin.stock.level'),
      cell: ({ row }) => <Badge variant="secondary">{row.original.storeOwnerLevel} {t('profile.stockist')}</Badge>,
    },
    {
      accessorKey: 'rank',
      header: t('profile.rank'),
      cell: ({ row }) => <Badge variant="outline">{row.original.rank}</Badge>,
    },
    {
      accessorKey: 'location',
      header: t('admin.stock.location'),
      cell: ({ row }) => row.original.location || <span className="text-muted-foreground">{t('admin.stock.notSet')}</span>,
    },
    {
      accessorKey: 'inventoryCount',
      header: () => <div className="text-right">{t('admin.stock.itemsInStock')}</div>,
      cell: ({ row }) => <div className="text-right font-medium">{row.original.inventoryCount}</div>,
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="text-right">
          <Button variant="outline" size="sm" icon={ArrowRightLeft} onClick={() => handleOpenTransferDialog(row.original)}>
            {t('admin.stock.transferStock')}
          </Button>
        </div>
      ),
    },
  ];

  const table = useReactTable({
    data: stockists,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      globalFilter: filter,
    },
    onGlobalFilterChange: setFilter,
  });

  return (
    <>
      {selectedStockist && (
         <StockTransferDialog
            isOpen={isTransferDialogOpen}
            onOpenChange={setTransferDialogOpen}
            stockist={selectedStockist}
            onSuccess={handleTransferSuccess}
        />
      )}
      <div className="flex-1 p-4 md:p-8 pt-6 space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
            <div className="lg:col-span-2">
                <StockRequests onUpdate={refreshData} />
            </div>
            
            <Card className="lg:col-span-2">
            <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <CardTitle className="flex items-center gap-2">
                    <Boxes /> {t('admin.stock.networkTitle')}
                    </CardTitle>
                    <CardDescription>
                    {t('admin.stock.networkDescription')}
                    </CardDescription>
                </div>
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                    placeholder={t('admin.stock.filterPlaceholder')}
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="pl-8 sm:w-[300px]"
                    />
                </div>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? (
                <div className="flex justify-center items-center h-48">
                    <Loader2 className="animate-spin" />
                </div>
                ) : (
                <div className="w-full">
                    <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                                <TableHead key={header.id}>
                                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                </TableHead>
                            ))}
                            </TableRow>
                        ))}
                        </TableHeader>
                        <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                            <TableRow key={row.id}>
                                {row.getVisibleCells().map((cell) => (
                                <TableCell key={cell.id}>
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </TableCell>
                                ))}
                            </TableRow>
                            ))
                        ) : (
                            <TableRow>
                            <TableCell colSpan={columns.length} className="h-24 text-center">
                                {t('admin.stock.noStockists')}
                            </TableCell>
                            </TableRow>
                        )}
                        </TableBody>
                    </Table>
                    </div>
                    <div className="flex items-center justify-end space-x-2 py-4">
                    <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                        {t('common.previous')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                        {t('common.next')}
                    </Button>
                    </div>
                </div>
                )}
            </CardContent>
            </Card>
        </div>
      </div>
    </>
  );
}
