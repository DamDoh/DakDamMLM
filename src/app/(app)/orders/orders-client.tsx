
'use client';

import * as React from 'react';
import {
  ChevronDownIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/lib/internationalization';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Order } from '@/lib/types';
import { useIsMobile } from '@/hooks/use-mobile';


interface OrdersClientProps {
    initialData: Order[];
    columns: ColumnDef<Order>[];
}

export default function OrdersClient({ initialData, columns }: OrdersClientProps) {
  const { t } = useI18n();
  const [data] = React.useState(() => [...initialData]);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  
  const isMobile = useIsMobile();
  
  React.useEffect(() => {
    if (isMobile) {
      // Hide less important columns on mobile
      setColumnVisibility({
          select: false,
          date: false,
          itemCount: false,
      });
    } else {
      setColumnVisibility({});
    }
  }, [isMobile]);

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row items-center py-4 gap-4">
        <Input
          placeholder={t('orders.filterByOrderId')}
          value={
            (table.getColumn('orderId')?.getFilterValue() as string) ?? ''
          }
          onChange={(event) =>
            table.getColumn('orderId')?.setFilterValue(event.target.value)
          }
          className="w-full sm:max-w-sm"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full sm:w-auto sm:ml-auto" icon={ChevronDownIcon}>
              {t('orders.columns')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                const getColumnLabel = (columnId: string) => {
                  // Map column IDs to translation keys
                  const columnMap: Record<string, string> = {
                    'orderId': 'orders.column.orderId',
                    'date': 'orders.date',
                    'status': 'orders.status',
                    'itemCount': 'orders.column.itemCount',
                    'amount': 'orders.amount',
                  };
                  const translationKey = columnMap[columnId] || `orders.${columnId}`;
                  const translated = t(translationKey);
                  // If translation exists (not the same as key), use it, otherwise use column.id
                  return translated !== translationKey ? translated : columnId;
                };
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {getColumnLabel(column.id)}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <React.Fragment key={row.id}>
                  <TableRow
                    data-state={row.getIsSelected() && 'selected'}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                  {isMobile && (
                    <TableRow>
                       <TableCell colSpan={columns.length} className="p-0">
                          <div className="p-2 bg-muted/50 text-xs space-y-1">
                             <div className="flex justify-between">
                               <span className="font-bold">{t('orders.date')}:</span>
                               <span>{new Date(row.original.date).toLocaleDateString()}</span>
                             </div>
                             <div className="flex justify-between">
                                <span className="font-bold">{t('orders.items')}:</span>
                                <span>{row.original.itemCount}</span>
                             </div>
                          </div>
                       </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  {t('orders.noResults')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} {t('orders.pageOf')}{' '}
          {table.getFilteredRowModel().rows.length} {t('orders.rowsSelectedText')}
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            icon={ChevronLeft}
          >
            {t('common.previous')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            icon={ChevronRight}
            iconPosition='right'
          >
            {t('common.next')}
          </Button>
        </div>
      </div>
    </div>
  )
}
