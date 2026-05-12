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
import { Plus, Edit, Trash2, Copy, CheckCircle, XCircle, Package, Globe, Building2, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/internationalization';
import type { BusinessRule, RuleTemplate } from '@/lib/types';

interface RuleTemplatesProps {
  rules: BusinessRule[];
  onTemplateUpdate?: () => void;
}

/**
 * Rule Templates Component
 * 
 * WHAT IS A RULE TEMPLATE?
 * A Rule Template is a pre-configured set of business rules that can be reused to quickly set up
 * compensation plans for different markets, regions, or business scenarios. Templates are like blueprints
 * that you can apply to create actual rules or rule sets.
 * 
 * KEY DIFFERENCES FROM RULE SETS:
 * - Templates are reusable blueprints (not active rules themselves)
 * - Templates can be applied to create new rules or rule sets
 * - Templates can be system-wide (available to all companies) or company-specific
 * - Templates define the structure, not the execution
 * 
 * EXAMPLE USE CASES:
 * 1. "Binary Plan Template" - Pre-configured rules for binary compensation structure
 * 2. "Unilevel Plan Template" - Template for unilevel compensation plans
 * 3. "Matrix Plan Template" - Template for matrix-based compensation
 * 4. "North America Market Template" - Region-specific compensation rules
 * 5. "Fast Start Bonus Template" - Template for fast start bonus programs
 * 
 * FLOW:
 * 1. Create a Template by selecting existing rules or defining new rule structures
 * 2. Set the template category and applicable markets
 * 3. Mark as default template for a category (optional)
 * 4. Apply the template to create actual rules or rule sets
 * 5. Templates can be cloned, edited, or deleted
 */
export function RuleTemplates({ rules, onTemplateUpdate }: RuleTemplatesProps) {
  const { toast } = useToast();
  const { t } = useI18n();
  const [templates, setTemplates] = useState<RuleTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isApplyDialogOpen, setIsApplyDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<RuleTemplate | null>(null);
  const [templateToApply, setTemplateToApply] = useState<RuleTemplate | null>(null);
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([]);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    category: 'commission',
    isDefault: false,
    applicableMarkets: [] as string[],
    isSystemTemplate: false
  });
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<RuleTemplate | null>(null);

  const availableMarkets = ['North America', 'South America', 'Europe', 'Asia', 'Africa', 'Oceania', 'Global'];
  const categories = ['commission', 'bonus', 'qualification', 'maintenance', 'incentive', 'penalty'];

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch('/api/rule-templates', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }

      const result = await response.json();
      if (result.success) {
        setTemplates(result.data || []);
      } else {
        throw new Error(result.error || 'Failed to load templates');
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load templates.',
      });
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = () => {
    setSelectedTemplate(null);
    setSelectedRuleIds([]);
    setTemplateForm({
      name: '',
      description: '',
      category: 'commission',
      isDefault: false,
      applicableMarkets: [],
      isSystemTemplate: false
    });
    setIsDialogOpen(true);
  };

  const handleEditTemplate = (template: RuleTemplate) => {
    setSelectedTemplate(template);
    // Templates store rules as rule data (not IDs), so we need to match them
    const templateRuleIds = template.rules.map((r: any) => {
      const matched = rules.find(rule => 
        rule.name === r.name && rule.type === r.type && rule.category === r.category
      );
      return matched?.id;
    }).filter(Boolean) as string[];
    
    setSelectedRuleIds(templateRuleIds);
    setTemplateForm({
      name: template.name,
      description: template.description || '',
      category: template.category,
      isDefault: template.isDefault,
      applicableMarkets: Array.isArray(template.applicableMarkets) ? template.applicableMarkets : [],
      isSystemTemplate: template.isSystemTemplate || false
    });
    setIsDialogOpen(true);
  };

  const handleSaveTemplate = async () => {
    if (!templateForm.name.trim()) {
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
        title: t('businessRules.validationError'),
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

      // Get the selected rules and convert them to template format (without IDs)
      const selectedRules = rules.filter(r => selectedRuleIds.includes(r.id));
      const templateRules = selectedRules.map(rule => {
        const { id, createdAt, updatedAt, createdBy, version, ...ruleData } = rule;
        return ruleData;
      });

      const url = selectedTemplate 
        ? `/api/rule-templates/${selectedTemplate.id}`
        : '/api/rule-templates';
      
      const method = selectedTemplate ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: templateForm.name.trim(),
          description: templateForm.description.trim(),
          category: templateForm.category,
          isDefault: templateForm.isDefault,
          applicableMarkets: templateForm.applicableMarkets,
          isSystemTemplate: templateForm.isSystemTemplate,
          rules: templateRules
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || 'Failed to save template');
      }

      const result = await response.json();
      if (result.success) {
        toast({
          title: selectedTemplate ? t('businessRules.templateUpdated') : t('businessRules.templateCreated'),
          description: selectedTemplate 
            ? t('businessRules.templateUpdatedDesc', { name: templateForm.name })
            : t('businessRules.templateCreatedDesc', { name: templateForm.name }),
        });
        setIsDialogOpen(false);
        await loadTemplates();
        onTemplateUpdate?.();
      } else {
        throw new Error(result.error || 'Failed to save template');
      }
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save template.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApplyTemplate = (template: RuleTemplate) => {
    setTemplateToApply(template);
    setIsApplyDialogOpen(true);
  };

  const confirmApplyTemplate = async () => {
    if (!templateToApply) return;

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        throw new Error('Authentication required');
      }

      // Apply template - create actual rules from template
      const response = await fetch(`/api/rule-templates/${templateToApply.id}/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          createAsActive: true
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || 'Failed to apply template');
      }

      const result = await response.json();
      if (result.success) {
        toast({
          title: t('businessRules.templateApplied'),
          description: t('businessRules.templateAppliedDesc', { name: templateToApply.name, count: (result.data?.rulesCreated || 0).toString() }),
        });
        setIsApplyDialogOpen(false);
        setTemplateToApply(null);
        onTemplateUpdate?.();
      } else {
        throw new Error(result.error || 'Failed to apply template');
      }
    } catch (error) {
      console.error('Error applying template:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to apply template.',
      });
    }
  };

  const handleCloneTemplate = async (template: RuleTemplate) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch('/api/rule-templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: `${template.name} (Copy)`,
          description: template.description,
          category: template.category,
          isDefault: false,
          applicableMarkets: Array.isArray(template.applicableMarkets) ? template.applicableMarkets : [],
          isSystemTemplate: false,
          rules: template.rules
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to clone template');
      }

      await loadTemplates();
      
      toast({
        title: t('businessRules.templateCloned'),
        description: t('businessRules.templateClonedDesc', { name: template.name }),
      });
      onTemplateUpdate?.();
    } catch (error) {
      console.error('Error cloning template:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to clone template.',
      });
    }
  };

  const handleDeleteTemplate = (template: RuleTemplate) => {
    setTemplateToDelete(template);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteTemplate = async () => {
    if (!templateToDelete) return;

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`/api/rule-templates/${templateToDelete.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || 'Failed to delete template');
      }

      await loadTemplates();
      
      toast({
        title: t('businessRules.templateDeleted'),
        description: t('businessRules.templateDeletedDesc', { name: templateToDelete.name }),
      });
      setIsDeleteDialogOpen(false);
      setTemplateToDelete(null);
      onTemplateUpdate?.();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete template.',
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

  const toggleMarket = (market: string) => {
    setTemplateForm(prev => ({
      ...prev,
      applicableMarkets: prev.applicableMarkets.includes(market)
        ? prev.applicableMarkets.filter(m => m !== market)
        : [...prev.applicableMarkets, market]
    }));
  };

  return (
    <div className="space-y-6">
      {/* Info Alert */}
      <Alert>
        <Sparkles className="h-4 w-4" />
        <AlertDescription>
          <strong>{t('businessRules.whatAreRuleTemplates')}</strong> {t('businessRules.ruleTemplatesDesc')}
        </AlertDescription>
      </Alert>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">{t('businessRules.ruleTemplatesTitle')}</h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            {t('businessRules.createReusableBlueprints')}
          </p>
        </div>
        <Button onClick={handleCreateTemplate} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          {t('businessRules.createTemplate')}
        </Button>
      </div>

      {/* Templates Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('businessRules.allTemplates')}</CardTitle>
          <CardDescription>
            {t('businessRules.manageRuleTemplates')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">{t('businessRules.loading')}</div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t('businessRules.noTemplatesYet')}</h3>
              <p className="text-muted-foreground mb-4">
                {t('businessRules.createFirstTemplate')}
              </p>
              <Button onClick={handleCreateTemplate}>
                <Plus className="h-4 w-4 mr-2" />
                {t('businessRules.createTemplateButton')}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle px-4 sm:px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[150px]">{t('businessRules.nameCol')}</TableHead>
                      <TableHead className="hidden md:table-cell">{t('businessRules.categoryCol')}</TableHead>
                      <TableHead className="min-w-[80px]">{t('businessRules.rulesCol')}</TableHead>
                      <TableHead className="hidden lg:table-cell">{t('businessRules.markets')}</TableHead>
                      <TableHead className="hidden sm:table-cell">{t('businessRules.typeCol')}</TableHead>
                      <TableHead className="hidden lg:table-cell">{t('businessRules.default')}</TableHead>
                      <TableHead className="min-w-[200px]">{t('businessRules.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map(template => (
                      <TableRow key={template.id}>
                        <TableCell className="font-medium">
                          <div>
                            <p className="text-sm sm:text-base">{template.name}</p>
                            <div className="flex flex-wrap gap-1 mt-1 md:hidden">
                              <Badge variant="outline" className="text-xs">{template.category}</Badge>
                              {template.isSystemTemplate ? (
                                <Badge variant="default" className="bg-blue-600 text-xs">
                                  {t('businessRules.system')}
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">{t('common.company')}</Badge>
                              )}
                              {template.isDefault && (
                                <Badge variant="default" className="bg-green-600 text-xs">{t('businessRules.defaultValue')}</Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant="outline">{template.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {Array.isArray(template.rules) ? template.rules.length : 0} {t('businessRules.rules')}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {Array.isArray(template.applicableMarkets) && template.applicableMarkets.length > 0 ? (
                              template.applicableMarkets.slice(0, 2).map(market => (
                                <Badge key={market} variant="outline" className="text-xs">
                                  {market}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground text-sm">{t('businessRules.all')}</span>
                            )}
                            {Array.isArray(template.applicableMarkets) && template.applicableMarkets.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{template.applicableMarkets.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {template.isSystemTemplate ? (
                            <Badge variant="default" className="bg-blue-600">
                              <Globe className="h-3 w-3 mr-1" />
                              {t('businessRules.system')}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <Building2 className="h-3 w-3 mr-1" />
                              {t('common.company')}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {template.isDefault ? (
                            <Badge variant="default" className="bg-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              {t('businessRules.defaultValue')}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <XCircle className="h-3 w-3 mr-1" />
                              {t('businessRules.no')}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 sm:gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleApplyTemplate(template)}
                              className="text-xs sm:text-sm text-blue-600 hover:text-blue-700 h-8 sm:h-9"
                            >
                              {t('businessRules.apply')}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditTemplate(template)}
                              className="text-xs sm:text-sm h-8 sm:h-9"
                            >
                              <Edit className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                              <span className="hidden sm:inline">{t('businessRules.edit')}</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCloneTemplate(template)}
                              className="text-xs sm:text-sm h-8 sm:h-9"
                            >
                              <Copy className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                              <span className="hidden sm:inline">{t('businessRules.clone')}</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteTemplate(template)}
                              className="text-xs sm:text-sm text-red-600 hover:text-red-700 h-8 sm:h-9"
                            >
                              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                              <span className="hidden sm:inline">{t('businessRules.delete')}</span>
                            </Button>
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
              {selectedTemplate ? t('businessRules.editTemplate') : t('businessRules.createNewTemplate')}
            </DialogTitle>
            <DialogDescription>
              {selectedTemplate 
                ? t('businessRules.editTemplateDesc')
                : t('businessRules.createNewTemplateDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Information */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="template-name">{t('businessRules.templateName')} *</Label>
                <Input
                  id="template-name"
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                  placeholder={t('businessRules.templateNamePlaceholder')}
                />
              </div>
              <div>
                <Label htmlFor="template-description">{t('businessRules.description')}</Label>
                <Textarea
                  id="template-description"
                  value={templateForm.description}
                  onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                  placeholder={t('businessRules.templateDescriptionPlaceholder')}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="template-category">{t('businessRules.categoryCol')} *</Label>
                  <select
                    id="template-category"
                    value={templateForm.category}
                    onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-4 pt-8">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="is-default"
                      checked={templateForm.isDefault}
                      onCheckedChange={(checked) => setTemplateForm({ ...templateForm, isDefault: checked })}
                    />
                    <Label htmlFor="is-default">{t('businessRules.setAsDefault')}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="is-system"
                      checked={templateForm.isSystemTemplate}
                      onCheckedChange={(checked) => setTemplateForm({ ...templateForm, isSystemTemplate: checked })}
                    />
                    <Label htmlFor="is-system">{t('businessRules.systemTemplate')}</Label>
                  </div>
                </div>
              </div>
            </div>

            {/* Applicable Markets */}
            <div className="space-y-4">
              <Label>{t('businessRules.applicableMarkets')}</Label>
              <div className="flex flex-wrap gap-2">
                {availableMarkets.map(market => {
                  const marketKeyMap: Record<string, string> = {
                    'North America': 'businessRules.marketNorthAmerica',
                    'South America': 'businessRules.marketSouthAmerica',
                    'Europe': 'businessRules.marketEurope',
                    'Asia': 'businessRules.marketAsia',
                    'Africa': 'businessRules.marketAfrica',
                    'Oceania': 'businessRules.marketOceania',
                    'Global': 'businessRules.marketGlobal'
                  };
                  const marketKey = marketKeyMap[market] || market;
                  return (
                    <Badge
                      key={market}
                      variant={templateForm.applicableMarkets.includes(market) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleMarket(market)}
                    >
                      {t(marketKey) || market}
                    </Badge>
                  );
                })}
              </div>
            </div>

            {/* Rule Selection */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>{t('businessRules.selectRulesCount', { count: selectedRuleIds.length.toString() })}</Label>
                <Badge variant="secondary">
                  {t('businessRules.rulesSelectedShort', { selected: selectedRuleIds.length.toString(), total: rules.length.toString() })}
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
              <Button onClick={handleSaveTemplate} disabled={loading}>
                {loading ? t('businessRules.saving') : selectedTemplate ? t('businessRules.updateTemplate') : t('businessRules.createTemplateButton')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Apply Template Dialog */}
      <AlertDialog open={isApplyDialogOpen} onOpenChange={setIsApplyDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('businessRules.applyTemplate')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('businessRules.applyTemplateDesc', { name: templateToApply?.name || '', count: (templateToApply?.rules.length || 0).toString() })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsApplyDialogOpen(false);
              setTemplateToApply(null);
            }}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmApplyTemplate}>
              {t('businessRules.applyTemplate')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.areYouSure')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('businessRules.deleteTemplateConfirm', { name: templateToDelete?.name || '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsDeleteDialogOpen(false);
              setTemplateToDelete(null);
            }}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteTemplate}
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

