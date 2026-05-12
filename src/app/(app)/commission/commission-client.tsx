
'use client';

import * as React from 'react';
import {
  ChevronDownIcon,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Commission } from '@/lib/types';
import { useI18n } from '@/lib/internationalization';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';


interface CommissionClientProps {
    initialData: Commission[];
    columns: ColumnDef<Commission>[];
}

export default function CommissionClient({ initialData, columns }: CommissionClientProps) {
  const { t } = useI18n();
  const [data] = React.useState(() => [...initialData]);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] =
    React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});

  const isMobile = useIsMobile();

  React.useEffect(() => {
    if (isMobile) {
      setColumnVisibility({ date: false, status: false });
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
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
  });

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row items-center py-4 gap-4">
        <Input
          placeholder={t('commission.filterByType')}
          value={
            (table.getColumn('type')?.getFilterValue() as string) ?? ''
          }
          onChange={(event) => {
            const value = event.target.value;
            const column = table.getColumn('type');
            if (column) {
              column.setFilterValue(value || undefined);
            }
          }}
          className="w-full sm:max-w-sm shadow-sm"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full sm:w-auto sm:ml-auto" icon={ChevronDownIcon}>
              {t('commission.columns')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                const getColumnLabel = (columnId: string) => {
                  const translationKey = `commission.column.${columnId}`;
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
      <div className="rounded-lg border overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-gradient-to-r from-muted/80 to-muted/60 border-b border-border/50">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className="font-semibold text-foreground py-4 px-6">
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
              table.getRowModel().rows.map((row, index) => (
                <React.Fragment key={row.id}>
                  <TableRow
                    data-state={row.getIsSelected() && 'selected'}
                    className={cn(
                      'transition-colors hover:bg-muted/40 border-b border-border/30',
                      index % 2 === 0 ? 'bg-background' : 'bg-muted/10'
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-4 px-6">
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
                               <span className="font-bold">{t('commission.date')}:</span>
                               <span>{(() => {
                                 const dateObj = new Date(row.original.date);
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
                                 return `${date}, ${time}`;
                               })()}</span>
                             </div>
                             <div className="flex justify-between">
                               <span className="font-bold">{t('commission.status')}:</span>
                               <span>{t(`commission.${(row.original.status as string).toLowerCase()}`)}</span>
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
                  {t('commission.noCommissions')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4 mt-4 border-t border-border/50">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="shadow-sm hover:shadow transition-shadow"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            {t('common.previous')}
          </Button>
          <div className="text-sm font-medium text-foreground px-4 py-1.5 bg-muted/50 rounded-md border border-border/30">
            Page <span className="font-semibold">{table.getState().pagination.pageIndex + 1}</span> of <span className="font-semibold">{table.getPageCount() || 1}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="shadow-sm hover:shadow transition-shadow"
          >
            {t('common.next')}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  )
}
