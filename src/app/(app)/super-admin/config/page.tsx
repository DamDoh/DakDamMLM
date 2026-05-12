'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/internationalization';
import ConfigCreateModal from '@/components/super-admin/config/config-create-modal';
import ConfigEditModal from '@/components/super-admin/config/config-edit-modal';

export default function SuperAdminConfig() {
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<any>(null);
  const { toast } = useToast();
  const { t } = useI18n();

  const getAuthHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };
  };

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders();
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search: searchTerm,
        category: selectedCategory
      });

      const response = await fetch(`/api/super-admin/config/global?${params}`, {
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        setConfigs(data.configs || []);
        setTotal(data.total || 0);
      } else if (response.status === 401) {
        toast({
          variant: 'destructive',
          title: 'Authentication Required',
          description: 'Please log in to access configuration management.',
        });
      } else {
        console.error('Failed to load configs:', response.status);
        setConfigs([]);
        setTotal(0);
      }
    } catch (error) {
      console.error('Error loading configs:', error);
      setConfigs([]);
      setTotal(0);
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: t('superAdmin.configLoadError')
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const headers = getAuthHeaders();
      const response = await fetch(`/api/super-admin/config/categories`, {
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setPage(1); // Reset to first page when searching
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCategory(e.target.value);
    setPage(1); // Reset to first page when changing category
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleCreateConfig = () => {
    setIsCreateModalOpen(true);
  };

  const handleEditConfig = (config: any) => {
    setEditingConfig(config);
    setIsEditModalOpen(true);
  };

  const handleConfigActionSuccess = () => {
    loadConfigs();
  };

  useEffect(() => {
    loadConfigs();
    loadCategories();
  }, [page, searchTerm, selectedCategory, limit]);

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
            <Settings className="h-8 w-8 text-gray-600" />
            {t('superAdmin.configManagement')}
          </h1>
          <p className="text-muted-foreground">
            {t('superAdmin.manageSystemConfig')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleCreateConfig}
            className="flex items-center gap-2"
          >
            <Search className="h-4 w-4" />
            {t('superAdmin.addConfig')}
          </Button>
          <Button 
            variant="outline" 
            onClick={() => {
              loadConfigs();
              loadCategories();
            }}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            {t('superAdmin.refresh')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="config-search" className="mb-2 block text-sm font-medium">
            {t('superAdmin.searchConfigs')}
          </Label>
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              id="config-search"
              type="text"
              placeholder={t('superAdmin.searchByKeyValue')}
              value={searchTerm}
              onChange={handleSearchChange}
              className="flex-1 min-w-[200px]"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="config-category" className="mb-2 block text-sm font-medium">
            {t('superAdmin.filterByCategory')}
          </Label>
          <Select
            id="config-category"
            value={selectedCategory}
            onValueChange={handleCategoryChange}
            className="w-full"
          >
            <SelectTrigger>
              <SelectValue placeholder={t('superAdmin.allCategories')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value=""> {t('superAdmin.allCategories')} </SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Configs Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('superAdmin.configList')}</CardTitle>
          <CardDescription>
            {t('superAdmin.totalConfigs', { count: total })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {configs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('superAdmin.key')}</TableHead>
                  <TableHead>{t('superAdmin.value')}</TableHead>
                  <TableHead>{t('superAdmin.type')}</TableHead>
                  <TableHead>{t('superAdmin.category')}</TableHead>
                  <TableHead>{t('superAdmin.active')}</TableHead>
                  <TableHead>{t('superAdmin.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map((config) => (
                  <TableRow key={config.id} className="hover:bg-muted">
                    <TableCell className="font-mono">{config.key}</TableCell>
                    <TableCell>
                      <div className="max-w-xs overflow-hidden text-ellipsis" title={JSON.stringify(config.value)}>
                        {typeof config.value === 'object' 
                          ? JSON.stringify(config.value).substring(0, 50) + '...'
                          : String(config.value).substring(0, 50) + '...'}
                      </div>
                    </TableCell>
                    <TableCell>{config.type}</TableCell>
                    <TableCell>{config.category}</TableCell>
                    <TableCell>
                      <Checkbox 
                        checked={config.isActive} 
                        onChange={() => {}} 
                        disabled
                        className="h-4 w-4"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditConfig(config)}
                          title={t('common.edit')}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="destructive"
                          ghost
                          size="sm"
                          onClick={() => {
                            // In a real app, we'd show a confirmation dialog
                            toast({
                              title: t('superAdmin.configDeleted'),
                              description: t('superAdmin.configDeletedDescription', { key: config.key })
                            });
                          }}
                          title={t('common.delete')}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {total === 0 
                  ? t('superAdmin.noConfigs') 
                  : t('superAdmin.noConfigsFound')}
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
      
      {/* Config Create Modal */}
      <ConfigCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onActionSuccess={handleConfigActionSuccess}
      />
      
      {/* Config Edit Modal */}
      <ConfigEditModal
        config={editingConfig}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingConfig(null);
        }}
        onActionSuccess={handleConfigActionSuccess}
      />
    </div>
  );
}