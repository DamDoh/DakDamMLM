'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/internationalization';
import { ArrowUpDown, Check, Trash2, UserPlus, Users as UsersIcon } from 'lucide-react';
import { CheckCircle, XCircle } from 'lucide-react';
import UserCreateModal from '@/components/super-admin/users/user-create-modal';
import UserDetailsModal from '@/components/super-admin/users/user-details-modal';

export default function SuperAdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const { toast } = useToast();
  const { t } = useI18n();

  const getAuthHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders();
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search: searchTerm
      });

      const response = await fetch(`/api/super-admin/iam/users?${params}`, {
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
        setTotal(data.total || 0);
      } else if (response.status === 401) {
        toast({
          variant: 'destructive',
          title: 'Authentication Required',
          description: 'Please log in to access user management.',
        });
      } else {
        console.error('Failed to load users:', response.status);
        setUsers([]);
        setTotal(0);
      }
    } catch (error) {
      console.error('Error loading users:', error);
      setUsers([]);
      setTotal(0);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load users.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setPage(1); // Reset to first page when searching
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleCreateUser = () => {
    setIsCreateModalOpen(true);
  };

  const handleViewUser = (userId: string) => {
    setSelectedUser(userId);
    setIsDetailsModalOpen(true);
  };

  const handleUserActionSuccess = () => {
    loadUsers();
  };

  useEffect(() => {
    loadUsers();
  }, [page, searchTerm, limit]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <UsersIcon className="h-8 w-8 text-blue-600" />
            {t('superAdmin.userManagement')}
          </h1>
          <p className="text-muted-foreground">
            {t('superAdmin.manageAllUsers')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleCreateUser}
            className="flex items-center gap-2"
          >
            <UserPlus className="h-4 w-4" />
            {t('superAdmin.createUser')}
          </Button>
          <Button 
            variant="outline" 
            onClick={loadUsers}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            {t('superAdmin.refresh')}
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex w-full md:w-auto items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('superAdmin.searchUsers')}
            value={searchTerm}
            onChange={handleSearchChange}
            className="flex-1 min-w-[200px] px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('superAdmin.userList')}</CardTitle>
          <CardDescription>
            {t('superAdmin.totalUsers', { count: total })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('superAdmin.fullName')}</TableHead>
                  <TableHead>{t('superAdmin.email')}</TableHead>
                  <TableHead>{t('superAdmin.role')}</TableHead>
                  <TableHead>{t('superAdmin.status')}</TableHead>
                  <TableHead>{t('superAdmin.lastActivity')}</TableHead>
                  <TableHead>{t('superAdmin.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} className="hover:bg-muted">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {user.avatarUrl ? (
                          <img 
                            src={user.avatarUrl} 
                            alt={user.fullName} 
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white">
                            {user.fullName?.charAt(0) ?? 'U'}
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{user.fullName}</p>
                          <p className="text-sm text-muted-foreground">
                            {user.memberId || 'No Member ID'}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{user.accountType || 'User'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        className={user.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                      >
                        {user.active ? t('common.active') : t('common.inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.lastActivityDate ? (
                        <span className="text-sm">
                          {new Date(user.lastActivityDate).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {t('superAdmin.never')}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewUser(user.id)}
                          title={t('superAdmin.viewDetails')}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="p-1 rounded-md hover:bg-muted"
                              aria-label={t('common.actions')}
                            >
                              <DotsVertical className="h-3 w-3 text-muted-foreground" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {!user.active && (
                              <DropdownMenuItem onClick={() => {
                                // In a real app, we'd call an API to activate the user
                                toast({
                                  title: 'Success',
                                  description: `${user.fullName} activated successfully.`
                                });
                              }}>
                                {t('superAdmin.activate')}
                              </DropdownMenuItem>
                            )}
                            {user.active && (
                              <DropdownMenuItem onClick={() => {
                                // In a real app, we'd call an API to deactivate the user
                                toast({
                                  title: 'Success',
                                  description: `${user.fullName} deactivated successfully.`
                                });
                              }}>
                                {t('superAdmin.deactivate')}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => {
                              // In a real app, we'd call an API to reset password
                              toast({
                                title: 'Success',
                                description: `Password reset email sent to ${user.email}.`
                              });
                            }}>
                              {t('superAdmin.resetPassword')}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => {
                              // In a real app, we'd show a confirmation dialog
                              toast({
                                title: 'Success',
                                description: `${user.fullName} deleted successfully.`
                              });
                            }}>
                              {t('superAdmin.delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {total === 0 
                  ? t('superAdmin.noUsers') 
                  : t('superAdmin.noUsersFound')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > limit && (
        <div className="flex justify-center items-center gap-4">
          <Button 
            variant="outline"
            disabled={page <= 1}
            onClick={() => handlePageChange(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {t('common.page', { current: page, total: Math.ceil(total / limit) })}
          </span>
          <Button 
            variant="outline"
            disabled={page >= Math.ceil(total / limit)}
            onClick={() => handlePageChange(page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      {/* User Create Modal */}
      <UserCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onActionSuccess={handleUserActionSuccess}
      />
      
      {/* User Details Modal */}
      <UserDetailsModal
        userId={selectedUser}
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedUser(null);
        }}
        onActionSuccess={handleUserActionSuccess}
      />
    </div>
  );
}