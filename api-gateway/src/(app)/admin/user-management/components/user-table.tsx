'use client';

import * as React from 'react';
import { ArrowUpDown, MoreHorizontal, Lock, UserX, Trash2 } from 'lucide-react';
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
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Member } from '@/lib/types';
import { useI18n } from '@/lib/internationalization';
import { useIsMobile } from '@/hooks/use-mobile';
import RankBadge from '@/components/genealogy/rank-badge';

interface UserTableProps {
  members: Member[];
  globalFilter: string;
  onGlobalFilterChange: (value: string) => void;
  onEditUser: (member: Member) => void;
  onChangePassword: (member: Member) => void;
  onSuspendUser: (member: Member) => void;
  onDeleteUser: (member: Member) => void;
}

export default function UserTable({
  members,
  globalFilter,
  onGlobalFilterChange,
  onEditUser,
  onChangePassword,
  onSuspendUser,
  onDeleteUser
}: UserTableProps) {
  const { t } = useI18n();
  const isMobile = useIsMobile();

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});

  React.useEffect(() => {
    if (isMobile) {
      setColumnVisibility({ memberId: false, rank: false, joinDate: false, status: false });
    } else {
      setColumnVisibility({});
    }
  }, [isMobile]);

  const columns: ColumnDef<Member>[] = [
    {
      accessorKey: 'fullName',
      header: t('admin.users.name'),
      cell: ({ row }) => (
         <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={row.original.avatarUrl} alt={row.original.fullName} />
            <AvatarFallback>{row.original.firstName?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{row.original.fullName}</p>
            <p className="text-xs text-muted-foreground">{row.original.email || row.original.phoneNumber}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'memberId',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          {t('admin.users.memberId')} <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <div className="pl-4">{row.getValue('memberId')}</div>,
    },
    {
      accessorKey: 'rank',
      header: t('admin.users.rank'),
      cell: ({ row }) => <RankBadge rank={row.original.rank} />,
    },
    {
      accessorKey: 'active',
      header: t('admin.users.status'),
      cell: ({ row }) => (
        <Badge variant={row.original.active ? 'default' : 'destructive'} className={cn(row.original.active ? 'bg-green-500' : 'bg-red-500', 'text-white')}>
          {row.original.active ? t('admin.bi.active') : t('admin.bi.inactive')}
        </Badge>
      ),
    },
    {
      accessorKey: 'joinDate',
      header: () => <div className="text-right">{t('admin.users.joinDate')}</div>,
      cell: ({ row }) => <div className="text-right">{new Date(row.getValue('joinDate')).toLocaleDateString()}</div>,
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const isAdmin = row.original.isAdmin === true;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0" icon={MoreHorizontal}>
                <span className="sr-only">{t('admin.openMenu')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t('common.actions')}</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onEditUser(row.original)}>
                {t('admin.users.editUser')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onChangePassword(row.original)}>
                <Lock className="mr-2 h-4 w-4" />
                Change Password
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onSuspendUser(row.original)}
                className="text-destructive"
                disabled={isAdmin}
              >
                <UserX className="mr-2 h-4 w-4" />
                {t('admin.users.suspendUser')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDeleteUser(row.original)}
                className="text-destructive"
                disabled={isAdmin}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete User
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const table = useReactTable({
    data: members,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onGlobalFilterChange: onGlobalFilterChange,
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      columnVisibility,
    },
  });

  return (
    <div className="w-full">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <React.Fragment key={row.id}>
                  <TableRow data-state={row.getIsSelected() && 'selected'}>
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
                                  <span className="font-bold">{t('admin.users.memberId')}:</span>
                                  <span>{row.original.memberId}</span>
                              </div>
                              <div className="flex justify-between">
                                  <span className="font-bold">{t('admin.users.rank')}:</span>
                                  <RankBadge rank={row.original.rank} />
                              </div>
                              <div className="flex justify-between">
                                  <span className="font-bold">{t('admin.users.joinDate')}:</span>
                                  <span>{new Date(row.original.joinDate).toLocaleDateString()}</span>
                              </div>
                               <div className="flex justify-between">
                                  <span className="font-bold">{t('admin.users.status')}:</span>
                                  <Badge variant={row.original.active ? 'default' : 'destructive'} className={cn(row.original.active ? 'bg-green-500' : 'bg-red-500', 'text-white')}>
                                      {row.original.active ? t('admin.bi.active') : t('admin.bi.inactive')}
                                  </Badge>
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
                  {t('admin.users.noUsers')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          {t('common.previous')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          {t('common.next')}
        </Button>
      </div>
    </div>
  );
}