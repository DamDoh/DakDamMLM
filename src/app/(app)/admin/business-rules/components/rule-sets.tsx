'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Edit, Trash2, Copy, CheckCircle, XCircle, Calendar, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/internationalization';
import type { BusinessRule, RuleSet } from '@/lib/types';

interface RuleSetsProps {
  rules: BusinessRule[];
  onRuleSetUpdate?: () => void;
}

/**
 * Rule Sets Component
 * 
 * WHAT IS A RULE SET?
 * A Rule Set is a collection of business rules that work together to form a complete compensation plan.
 * Instead of managing individual rules, you can group related rules into sets and activate/deactivate them together.
 * 
 * EXAMPLE USE CASES:
 * 1. "Q1 2024 Commission Plan" - Contains all commission rules for Q1 2024
 * 2. "Bronze Level Bonus Package" - Contains all bonus rules for Bronze level members
 * 3. "Holiday Promotion Rules" - Temporary rules for a holiday promotion
 * 4. "Regional Plan - North America" - Rules specific to North American market
 * 
 * FLOW:
 * 1. Create a Rule Set with a name and description
 * 2. Select which rules to include in the set
 * 3. Set effective dates (when the set becomes active/expires)
 * 4. Activate the Rule Set (all rules in the set become active)
 * 5. Deactivate the Rule Set (all rules in the set become inactive)
 * 6. Clone/Edit/Delete Rule Sets as needed
 */
export function RuleSets({ rules, onRuleSetUpdate }: RuleSetsProps) {
  const { toast } = useToast();
  const { t } = useI18n();
  const [ruleSets, setRuleSets] = useState<RuleSet[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRuleSet, setSelectedRuleSet] = useState<RuleSet | null>(null);
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [ruleSetToDelete, setRuleSetToDelete] = useState<RuleSet | null>(null);
  const [ruleSetForm, setRuleSetForm] = useState({
    name: '',
    description: '',
    effectiveDate: new Date().toISOString().split('T')[0],
    expiryDate: '',
    isActive: false,
    tags: [] as string[]
  });

  useEffect(() => {
    loadRuleSets();
  }, []);

  const loadRuleSets = async () => {
    setLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch('/api/rule-sets', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch rule sets');
      }

      const result = await response.json();
      if (result.success) {
        setRuleSets(result.data || []);
      } else {
        throw new Error(result.error || 'Failed to load rule sets');
      }
    } catch (error) {
      console.error('Error loading rule sets:', error);
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error instanceof Error ? error.message : t('businessRules.failedToLoad', { item: 'rule sets' }),
      });
      // Set empty array on error
      setRuleSets([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRuleSet = () => {
    setSelectedRuleSet(null);
    setSelectedRuleIds([]);
    setRuleSetForm({
      name: '',
      description: '',
      effectiveDate: new Date().toISOString().split('T')[0],
      expiryDate: '',
      isActive: false,
      tags: []
    });
    setIsDialogOpen(true);
  };

  const handleEditRuleSet = (ruleSet: RuleSet) => {
    setSelectedRuleSet(ruleSet);
    setSelectedRuleIds(ruleSet.rules.map(r => r.id));
    setRuleSetForm({
      name: ruleSet.name,
      description: ruleSet.description,
      effectiveDate: ruleSet.effectiveDate.split('T')[0],
      expiryDate: ruleSet.expiryDate?.split('T')[0] || '',
      isActive: ruleSet.isActive,
      tags: ruleSet.tags || []
    });
    setIsDialogOpen(true);
  };

  const handleSaveRuleSet = async () => {
    if (!ruleSetForm.name.trim()) {
      toast({
        variant: 'destructive',
        title: t('businessRules.validationError'),
        description: t('businessRules.ruleSetNameRequired'),
      });
      return;
    }

    if (selectedRuleIds.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: t('businessRules.selectAtLeastOneRule'),
      });
      return;
    }

    setLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        throw new Error('Authentication required');
      }

      const url = selectedRuleSet 
        ? `/api/rule-sets/${selectedRuleSet.id}`
        : '/api/rule-sets';
      
      const method = selectedRuleSet ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: ruleSetForm.name.trim(),
          description: ruleSetForm.description.trim(),
          effectiveDate: ruleSetForm.effectiveDate,
          expiryDate: ruleSetForm.expiryDate || null,
          isActive: ruleSetForm.isActive,
          ruleIds: selectedRuleIds,
          tags: ruleSetForm.tags
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || 'Failed to save rule set');
      }

      const result = await response.json();
      if (result.success) {
        toast({
          title: selectedRuleSet ? t('businessRules.ruleSetUpdated') : t('businessRules.ruleSetCreated'),
          description: selectedRuleSet 
            ? t('businessRules.ruleSetUpdatedDesc', { name: ruleSetForm.name })
            : t('businessRules.ruleSetCreatedDesc', { name: ruleSetForm.name }),
        });
        setIsDialogOpen(false);
        await loadRuleSets(); // Reload rule sets from API
        onRuleSetUpdate?.();
      } else {
        throw new Error(result.error || 'Failed to save rule set');
      }
    } catch (error) {
      console.error('Error saving rule set:', error);
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error instanceof Error ? error.message : t('businessRules.failedToLoad', { item: 'rule set' }),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (ruleSet: RuleSet) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`/api/rule-sets/${ruleSet.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...ruleSet,
          isActive: !ruleSet.isActive
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update rule set status');
      }

      await loadRuleSets(); // Reload rule sets from API
      
      toast({
        title: !ruleSet.isActive ? t('businessRules.ruleSetActivated') : t('businessRules.ruleSetDeactivated'),
        description: !ruleSet.isActive 
          ? t('businessRules.ruleSetActivatedDesc', { name: ruleSet.name })
          : t('businessRules.ruleSetDeactivatedDesc', { name: ruleSet.name }),
      });
      onRuleSetUpdate?.();
    } catch (error) {
      console.error('Error toggling rule set:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update rule set status.',
      });
    }
  };

  const handleCloneRuleSet = async (ruleSet: RuleSet) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch('/api/rule-sets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: `${ruleSet.name} (Copy)`,
          description: ruleSet.description,
          effectiveDate: ruleSet.effectiveDate.split('T')[0],
          expiryDate: ruleSet.expiryDate?.split('T')[0] || null,
          isActive: false,
          ruleIds: ruleSet.rules.map(r => r.id),
          tags: ruleSet.tags || []
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to clone rule set');
      }

      await loadRuleSets(); // Reload rule sets from API
      
      toast({
        title: t('businessRules.ruleSetCloned'),
        description: t('businessRules.ruleSetClonedDesc', { name: ruleSet.name }),
      });
      onRuleSetUpdate?.();
    } catch (error) {
      console.error('Error cloning rule set:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to clone rule set.',
      });
    }
  };

  const handleDeleteRuleSet = (ruleSet: RuleSet) => {
    setRuleSetToDelete(ruleSet);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteRuleSet = async () => {
    if (!ruleSetToDelete) return;

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`/api/rule-sets/${ruleSetToDelete.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData?.error || errorData?.message || `HTTP ${response.status}: Failed to delete rule set`;
        throw new Error(errorMessage);
      }

      const result = await response.json();
      if (result.success) {
        await loadRuleSets(); // Reload rule sets from API
        
        toast({
          title: t('businessRules.ruleSetDeleted'),
          description: t('businessRules.ruleSetDeletedDesc', { name: ruleSetToDelete.name }),
        });
        setIsDeleteDialogOpen(false);
        setRuleSetToDelete(null);
        onRuleSetUpdate?.();
      } else {
        throw new Error(result.error || 'Failed to delete rule set');
      }
    } catch (error) {
      console.error('Error deleting rule set:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete rule set.',
      });
    }
  };

  const toggleRuleSelection = (ruleId: string) => {
    setSelectedRuleIds(prev => 
      prev.includes(ruleId) 
        ? prev.filter(id => id !== ruleId)
        : [...prev, ruleId]
    );
  };

  return (
    <div className="space-y-6">
      {/* Info Alert */}
      <Alert>
        <Package className="h-4 w-4" />
        <AlertDescription>
          <strong>{t('businessRules.whatAreRuleSets')}</strong> {t('businessRules.ruleSetsInfo')}
        </AlertDescription>
      </Alert>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">{t('businessRules.ruleSets')}</h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            {t('businessRules.ruleSetsDescription')}
          </p>
        </div>
        <Button onClick={handleCreateRuleSet} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          {t('businessRules.createRuleSet')}
        </Button>
      </div>

      {/* Rule Sets Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('businessRules.allRuleSets')}</CardTitle>
          <CardDescription>
            {t('businessRules.ruleSetsManageDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">{t('businessRules.loading')}</div>
          ) : ruleSets.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t('businessRules.noRuleSetsYet')}</h3>
              <p className="text-muted-foreground mb-4">
                {t('businessRules.noRuleSetsDesc')}
              </p>
              <Button onClick={handleCreateRuleSet}>
                <Plus className="h-4 w-4 mr-2" />
                {t('businessRules.createRuleSet')}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle px-4 sm:px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[150px]">{t('businessRules.name')}</TableHead>
                      <TableHead className="hidden md:table-cell min-w-[200px]">{t('businessRules.description')}</TableHead>
                      <TableHead className="min-w-[100px]">{t('businessRules.rules')}</TableHead>
                      <TableHead className="hidden sm:table-cell">{t('businessRules.status')}</TableHead>
                      <TableHead className="hidden lg:table-cell">{t('businessRules.effectiveDate')}</TableHead>
                      <TableHead className="min-w-[200px]">{t('businessRules.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ruleSets.map(ruleSet => (
                      <TableRow key={ruleSet.id}>
                        <TableCell className="font-medium">
                          <div>
                            <p className="text-sm sm:text-base">{ruleSet.name}</p>
                            <p className="text-xs text-muted-foreground mt-1 md:hidden line-clamp-2">
                              {ruleSet.description}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell max-w-xs">
                          <p className="text-sm text-muted-foreground truncate">
                            {ruleSet.description}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{ruleSet.rules.length} {t('businessRules.rules')}</Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={ruleSet.isActive}
                              onCheckedChange={() => handleToggleActive(ruleSet)}
                            />
                            {ruleSet.isActive ? (
                              <Badge variant="default" className="bg-green-600">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                {t('businessRules.active')}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                <XCircle className="h-3 w-3 mr-1" />
                                {t('admin.bi.inactive')}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="text-sm">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>{new Date(ruleSet.effectiveDate).toLocaleDateString()}</span>
                            </div>
                            {ruleSet.expiryDate && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <span>→</span>
                                <span>{new Date(ruleSet.expiryDate).toLocaleDateString()}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                            <div className="flex items-center gap-1 sm:hidden">
                              <Switch
                                checked={ruleSet.isActive}
                                onCheckedChange={() => handleToggleActive(ruleSet)}
                              />
                              {ruleSet.isActive ? (
                                <Badge variant="default" className="bg-green-600">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  {t('businessRules.active')}
                                </Badge>
                              ) : (
                                <Badge variant="secondary">
                                  <XCircle className="h-3 w-3 mr-1" />
                                  {t('admin.bi.inactive')}
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1 sm:gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs sm:text-sm h-8 sm:h-9"
                                onClick={() => handleEditRuleSet(ruleSet)}
                              >
                                <Edit className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                <span className="hidden sm:inline">{t('businessRules.edit')}</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs sm:text-sm h-8 sm:h-9"
                                onClick={() => handleCloneRuleSet(ruleSet)}
                              >
                                <Copy className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                <span className="hidden sm:inline">{t('businessRules.clone')}</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs sm:text-sm h-8 sm:h-9 text-red-600 hover:text-red-700"
                                onClick={() => handleDeleteRuleSet(ruleSet)}
                              >
                                <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                <span className="hidden sm:inline">{t('businessRules.delete')}</span>
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>
              {selectedRuleSet ? t('businessRules.editRuleSet') : t('businessRules.createNewRuleSet')}
            </DialogTitle>
            <DialogDescription>
              {selectedRuleSet 
                ? t('businessRules.editRuleSet')
                : t('businessRules.createNewRuleSet')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Information */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">{t('businessRules.ruleSetName')} *</Label>
                <Input
                  id="name"
                  value={ruleSetForm.name}
                  onChange={(e) => setRuleSetForm({ ...ruleSetForm, name: e.target.value })}
                  placeholder={t('businessRules.ruleSetNamePlaceholder')}
                />
              </div>
              <div>
                <Label htmlFor="description">{t('businessRules.ruleSetDescription')}</Label>
                <Textarea
                  id="description"
                  value={ruleSetForm.description}
                  onChange={(e) => setRuleSetForm({ ...ruleSetForm, description: e.target.value })}
                  placeholder={t('businessRules.ruleSetDescriptionPlaceholder')}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="effectiveDate">{t('businessRules.effectiveDate')} *</Label>
                  <Input
                    id="effectiveDate"
                    type="date"
                    value={ruleSetForm.effectiveDate}
                    onChange={(e) => setRuleSetForm({ ...ruleSetForm, effectiveDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="expiryDate">{t('businessRules.expiryDate')} ({t('common.optional')})</Label>
                  <Input
                    id="expiryDate"
                    type="date"
                    value={ruleSetForm.expiryDate}
                    onChange={(e) => setRuleSetForm({ ...ruleSetForm, expiryDate: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Rule Selection */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>{t('businessRules.selectRules')} ({selectedRuleIds.length} {t('common.selected')})</Label>
                <Badge variant="secondary">
                  {t('businessRules.rulesSelected', { selected: selectedRuleIds.length.toString(), total: rules.length.toString() })}
                </Badge>
              </div>
              <div className="border rounded-lg max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>{t('businessRules.name')}</TableHead>
                      <TableHead>{t('businessRules.categoryCol')}</TableHead>
                      <TableHead>{t('businessRules.type')}</TableHead>
                      <TableHead>{t('businessRules.status')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map(rule => (
                      <TableRow
                        key={rule.id}
                        className={selectedRuleIds.includes(rule.id) ? 'bg-muted/50' : ''}
                        onClick={() => toggleRuleSelection(rule.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedRuleIds.includes(rule.id)}
                            onChange={() => toggleRuleSelection(rule.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{rule.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{rule.category}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {rule.type.replace('_', ' ')}
                        </TableCell>
                        <TableCell>
                          {rule.isActive ? (
                            <Badge variant="default" className="bg-green-600">{t('businessRules.active')}</Badge>
                          ) : (
                            <Badge variant="secondary">{t('admin.bi.inactive')}</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSaveRuleSet}>
                {selectedRuleSet ? t('businessRules.updateRule') : t('businessRules.createRuleSet')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.areYouSure')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('businessRules.deleteConfirm')} {ruleSetToDelete && ` "${ruleSetToDelete.name}"`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsDeleteDialogOpen(false);
              setRuleSetToDelete(null);
            }}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteRuleSet}
              className="bg-red-600 hover:bg-red-700"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

