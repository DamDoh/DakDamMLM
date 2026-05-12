
'use client';

import * as React from 'react';
import { ArrowUpDown, MoreHorizontal } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Loader2, Users, UserX, Trash2, AlertTriangle, X, Lock, Search, Download } from 'lucide-react';
import type { Member } from '@/lib/types';
import { useGenealogyContext } from '@/context/genealogy-context';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useI18n } from '@/lib/internationalization';
import { useIsMobile } from '@/hooks/use-mobile';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import RankBadge from '@/components/genealogy/rank-badge';
import EditMemberDialog from '@/components/genealogy/edit-member-dialog';
import ChangePasswordDialog from '@/components/admin/change-password-dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { deleteMember, changeUserPassword } from '@/services/server-actions';

export default function UserManagementPage() {
  const { t } = useI18n();
  const context = useGenealogyContext();
  const { members, loading, handleUpdateMember } = context || { members: [], loading: true, handleUpdateMember: async () => false };
  
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = React.useState('');

  const handleExportData = () => {
    try {
      // Prepare CSV headers
      const headers = [
        'Member ID',
        'Full Name',
        'Email',
        'Phone Number',
        'Account Type',
        'Rank',
        'PV',
        'Team Size',
        'Join Date',
        'Status',
        'Stockist Level'
      ];

      // Prepare CSV data
      const csvData = members.map(member => [
        member.memberId,
        member.fullName,
        member.email || '',
        member.phoneNumber,
        member.accountType,
        member.rank,
        member.pv.toString(),
        member.teamSize.total.toString(),
        new Date(member.joinDate).toLocaleDateString(),
        member.active ? 'Active' : 'Inactive',
        member.storeOwnerLevel || ''
      ]);

      // Combine headers and data
      const csvContent = [headers, ...csvData]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `user-data-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: 'Export Successful',
        description: `Exported ${members.length} user records to CSV file.`,
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        variant: 'destructive',
        title: 'Export Failed',
        description: 'Failed to export user data. Please try again.',
      });
    }
  };
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  
  const [isEditDialogOpen, setEditDialogOpen] = React.useState(false);
  const [editingMember, setEditingMember] = React.useState<Member | null>(null);
  
  const [isSuspendDialogOpen, setSuspendDialogOpen] = React.useState(false);
  const [suspendingMember, setSuspendingMember] = React.useState<Member | null>(null);

  const [isDeleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [deletingMember, setDeletingMember] = React.useState<Member | null>(null);

  const [isChangePasswordDialogOpen, setChangePasswordDialogOpen] = React.useState(false);
  const [changingPasswordMember, setChangingPasswordMember] = React.useState<Member | null>(null);

  const { toast } = useToast();
  const isMobile = useIsMobile();

  React.useEffect(() => {
    if (isMobile) {
      setColumnVisibility({ memberId: false, rank: false, joinDate: false, status: false });
    } else {
      setColumnVisibility({});
    }
  }, [isMobile]);

  const handleOpenEditDialog = (member: Member) => {
    setEditingMember(member);
    setEditDialogOpen(true);
  };
  
  const handleOpenSuspendDialog = (member: Member) => {
    setSuspendingMember(member);
    setSuspendDialogOpen(true);
  };

  const handleOpenDeleteDialog = (member: Member) => {
    setDeletingMember(member);
    setDeleteDialogOpen(true);
  };

  const handleOpenChangePasswordDialog = (member: Member) => {
    setChangingPasswordMember(member);
    setChangePasswordDialogOpen(true);
  };

  const handleSuspendConfirm = async () => {
    if (!suspendingMember || !handleUpdateMember) return;
    if (suspendingMember.isAdmin) {
      toast({ variant: 'destructive', title: 'Cannot suspend admin users' });
      setSuspendDialogOpen(false);
      setSuspendingMember(null);
      return;
    }
    const success = await handleUpdateMember(suspendingMember.id, { active: false });
    if (success) {
      toast({ title: t('admin.users.suspendSuccess') });
    } else {
      toast({ variant: 'destructive', title: t('admin.users.suspendFailed') });
    }
    setSuspendDialogOpen(false);
    setSuspendingMember(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingMember) return;
    if (deletingMember.isAdmin) {
      toast({ variant: 'destructive', title: 'Cannot delete admin users' });
      setDeleteDialogOpen(false);
      setDeletingMember(null);
      return;
    }
    try {
      await deleteMember(deletingMember.id);
      toast({ title: t('admin.users.deleteSuccess') });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Delete Failed', description: error.message || 'Failed to delete user' });
    }
    setDeleteDialogOpen(false);
    setDeletingMember(null);
  };

  const handleChangePassword = async (memberId: string, newPassword: string) => {
    try {
      await changeUserPassword(memberId, newPassword);
      toast({ title: 'Password Changed Successfully', description: 'The user password has been updated.' });
      setChangePasswordDialogOpen(false);
      setChangingPasswordMember(null);
      return true;
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Password Change Failed', description: error.message || 'Failed to change password' });
      return false;
    }
  };


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
              <Button
                variant="ghost"
                className="h-8 w-8 p-0"
                icon={MoreHorizontal}
                aria-label={`Actions for ${row.original.fullName}`}
              >
                <span className="sr-only">{t('admin.openMenu')}</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t('common.actions')}</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleOpenEditDialog(row.original)}>
                {t('admin.users.editUser')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleOpenChangePasswordDialog(row.original)}>
                <Lock className="mr-2 h-4 w-4" />
                Change Password
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleOpenSuspendDialog(row.original)}
                className="text-destructive"
                disabled={isAdmin}
              >
                <UserX className="mr-2 h-4 w-4" />
                {t('admin.users.suspendUser')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleOpenDeleteDialog(row.original)}
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
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      columnVisibility,
    },
  });

  return (
    <>
      {editingMember && handleUpdateMember && (
         <EditMemberDialog
            isOpen={isEditDialogOpen}
            onOpenChange={setEditDialogOpen}
            member={editingMember}
            onUpdateMember={handleUpdateMember}
        />
      )}
      {changingPasswordMember && (
        <ChangePasswordDialog
          isOpen={isChangePasswordDialogOpen}
          onOpenChange={setChangePasswordDialogOpen}
          member={changingPasswordMember}
          onChangePassword={handleChangePassword}
        />
      )}
      <AlertDialog open={isSuspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.areYouSure')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.users.suspendConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleSuspendConfirm} className="bg-destructive hover:bg-destructive/90">
              {t('common.suspend')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <button
            onClick={() => setDeleteDialogOpen(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete account</AlertDialogTitle>
            <div className="border border-red-200 bg-red-50 p-4 rounded-md">
              <AlertDialogDescription className="text-red-700 flex items-start gap-3">
                <AlertTriangle className="h-6 w-6 mt-0.5 flex-shrink-0" />
                <span className="text-sm leading-relaxed">
                  After you delete an account, it&apos;s permanently deleted. Accounts can&apos;t be undeleted.
                </span>
              </AlertDialogDescription>
            </div>
            {deletingMember && (
              <div className="mt-4 p-3 bg-gray-50 rounded-md">
                <div className="text-sm">
                  <div className="text-gray-600">User account:</div>
                  <div className="font-bold text-base mt-1">{deletingMember.email || deletingMember.phoneNumber}</div>
                </div>
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-200 hover:bg-gray-300 text-gray-800">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700 text-white">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex-1 p-2 sm:p-4 md:p-6 lg:p-8 pt-4 sm:pt-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Users className="h-5 w-5 sm:h-6 sm:w-6" /> {t('admin.users.title')}
                </CardTitle>
                <CardDescription className="text-sm">
                  {t('admin.users.description')}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 w-full lg:w-auto">
                <div className="relative flex-1 lg:flex-initial">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t('admin.users.filterPlaceholder')}
                    value={globalFilter}
                    onChange={(e) => setGlobalFilter(e.target.value)}
                    className="w-full lg:max-w-sm pl-9 text-sm"
                    aria-label="Search users by name, email, or member ID"
                  />
                </div>
                {globalFilter && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setGlobalFilter('')}
                    className="h-8 px-2 shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportData}
                  className="shrink-0"
                  aria-label="Export user data to CSV"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
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
                                    <div className="p-3 bg-muted/30 text-xs space-y-2 border-t">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <span className="font-semibold text-muted-foreground">{t('admin.users.memberId')}:</span>
                                                <div className="font-medium">{row.original.memberId}</div>
                                            </div>
                                            <div>
                                                <span className="font-semibold text-muted-foreground">{t('admin.users.rank')}:</span>
                                                <div className="mt-1"><RankBadge rank={row.original.rank} /></div>
                                            </div>
                                            <div>
                                                <span className="font-semibold text-muted-foreground">{t('admin.users.joinDate')}:</span>
                                                <div className="font-medium">{new Date(row.original.joinDate).toLocaleDateString()}</div>
                                            </div>
                                            <div>
                                                <span className="font-semibold text-muted-foreground">{t('admin.users.status')}:</span>
                                                <div className="mt-1">
                                                    <Badge variant={row.original.active ? 'default' : 'destructive'} className={cn(row.original.active ? 'bg-green-500' : 'bg-red-500', 'text-white', 'text-xs')}>
                                                        {row.original.active ? t('admin.bi.active') : t('admin.bi.inactive')}
                                                    </Badge>
                                                </div>
                                            </div>
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
                            role="status"
                            aria-live="polite"
                          >
                            {t('admin.users.noUsers')}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4">
                  <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left" role="status" aria-live="polite">
                    Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
                    {Math.min(
                      (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                      table.getFilteredRowModel().rows.length
                    )} of {table.getFilteredRowModel().rows.length} users
                    {globalFilter && (
                      <span className="ml-2 text-primary">
                        (filtered from {members.length} total)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-1 sm:space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => table.previousPage()}
                      disabled={!table.getCanPreviousPage()}
                      className="text-xs sm:text-sm px-2 sm:px-3"
                      aria-label="Go to previous page"
                    >
                      {t('common.previous')}
                    </Button>
                    <span
                      className="text-xs sm:text-sm text-muted-foreground px-2"
                      aria-live="polite"
                      aria-label={`Page ${table.getState().pagination.pageIndex + 1} of ${table.getPageCount()}`}
                    >
                      {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => table.nextPage()}
                      disabled={!table.getCanNextPage()}
                      className="text-xs sm:text-sm px-2 sm:px-3"
                      aria-label="Go to next page"
                    >
                      {t('common.next')}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
