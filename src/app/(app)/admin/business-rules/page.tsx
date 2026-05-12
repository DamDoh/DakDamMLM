'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Copy, Settings, Search, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { BusinessRule, RuleSet, RuleTemplate, RuleType } from '@/lib/types';
import { RuleSimulator } from './components/rule-simulator';
import { RulePerformance } from './components/rule-performance';
import { RuleConflicts } from './components/rule-conflicts';
import { BulkOperations } from './components/bulk-operations';
import { RuleDocumentation } from './components/rule-documentation';
import { RuleVersioning } from './components/rule-versioning';
import { RuleSets } from './components/rule-sets';
import { RuleTemplates } from './components/rule-templates';
import { ConditionsEditor } from './components/conditions-editor';
import { CalculationEditor } from './components/calculation-editor';
import { CompensationPlanWizard } from './components/compensation-plan-wizard';
import { useI18n } from '@/lib/internationalization';

export default function BusinessRulesPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('rules');
  const [rules, setRules] = useState<BusinessRule[]>([]);
  const [ruleSets, setRuleSets] = useState<RuleSet[]>([]);
  const [templates, setTemplates] = useState<RuleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRule, setSelectedRule] = useState<BusinessRule | null>(null);
  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);
  const [deletedRuleIds, setDeletedRuleIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [newlyCreatedRuleNames, setNewlyCreatedRuleNames] = useState<Set<string>>(new Set());
  const { t } = useI18n();
  // Rule form state
  const [ruleForm, setRuleForm] = useState({
    name: '',
    description: '',
    type: 'commission_rate' as RuleType,
    category: 'commission' as 'commission' | 'bonus' | 'qualification' | 'maintenance' | 'incentive' | 'penalty',
    priority: 0,
    isActive: true,
    conditions: [] as any[],
    calculation: null as any,
    applicableTo: ['distributor'] as ('distributor' | 'stockist' | 'customer')[],
    frequency: 'monthly' as 'weekly' | 'monthly' | 'quarterly' | 'annually' | 'one_time' | 'continuous',
    payoutTiming: 'end_of_period' as 'immediate' | 'end_of_period' | 'achievement_date' | 'qualification_date',
    tags: [] as string[]
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch business rules from API
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      
      if (!token) {
        console.warn('No authentication token found');
        setRules([]);
        setLoading(false);
        return;
      }
      
      const res = await fetch('/api/business-rules?limit=200&offset=0', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (res.status === 401) {
          // 401 is expected when user is not authenticated - don't log as error
          // Only show toast if we had a token (meaning session expired)
          if (token) {
          toast({
            variant: 'destructive',
              title: 'Session Expired',
              description: errorData?.message || 'Your session has expired. Please log in again.',
            });
            // Optionally redirect to login after a short delay
            setTimeout(() => {
              if (typeof window !== 'undefined') {
                window.location.href = '/auth/login';
              }
            }, 2000);
          }
          setRules([]);
          setLoading(false);
          return;
        }
        
        if (res.status === 403) {
          toast({
            variant: 'destructive',
            title: 'Access Denied',
            description: errorData?.message || 'You do not have permission to access business rules.',
          });
          setRules([]);
          setLoading(false);
          return;
        }
        
        throw new Error(errorData?.error || errorData?.message || `Failed to fetch business rules (Status: ${res.status})`);
      }
      
      const raw = await res.json();
      const rulesData = raw?.data ?? raw ?? [];
      
      // Fetch rule templates
      try {
        const templatesRes = await fetch('/api/rule-templates', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (templatesRes.ok) {
          const templatesData = await templatesRes.json();
          if (templatesData.success) {
            setTemplates(templatesData.data || []);
          }
        }
      } catch (templateError) {
        console.warn('Failed to load templates:', templateError);
        // Don't fail the whole load if templates fail
      }
      
      // Show all rules (both active and inactive) but filter out deleted ones
      const allRules = Array.isArray(rulesData) ? (rulesData as BusinessRule[]) : [];
      // Filter out rules that were deleted (tracked in deletedRuleIds)
      const filteredRules = allRules.filter(rule => !deletedRuleIds.has(rule.id));
      setRules(filteredRules);
    } catch (error: any) {
      console.error('Error loading business rules:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to load business rules.',
      });
      setRules([]);
      // Rule sets and templates not yet implemented – keep them empty for now
      setRuleSets([]);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRule = () => {
    setSelectedRule(null);
    setRuleForm({
      name: '',
      description: '',
      type: 'commission_rate',
      category: 'commission',
      priority: 0,
      isActive: true,
      conditions: [],
      calculation: null,
      applicableTo: ['distributor'],
      frequency: 'monthly',
      payoutTiming: 'end_of_period',
      tags: []
    });
    setIsRuleDialogOpen(true);
  };

  const handleEditRule = (rule: BusinessRule) => {
    if (!rule || !rule.id) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Invalid rule data. Cannot edit rule.',
      });
      return;
    }
    
    try {
    setSelectedRule(rule);
    setRuleForm({
        name: rule.name || '',
        description: rule.description || '',
      type: rule.type,
        category: rule.category || 'commission',
        priority: rule.priority || 0,
        isActive: rule.isActive ?? true,
        conditions: rule.conditions || [],
        calculation: rule.calculation || null,
        applicableTo: rule.applicableTo && Array.isArray(rule.applicableTo) 
          ? [...rule.applicableTo] 
          : ['distributor'],
        frequency: rule.frequency || 'monthly',
        payoutTiming: rule.payoutTiming || 'end_of_period',
        tags: rule.tags && Array.isArray(rule.tags) ? [...rule.tags] : []
    });
    setIsRuleDialogOpen(true);
    } catch (error) {
      console.error('Error editing rule:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load rule for editing. Please try again.',
      });
    }
  };

  const handleCloneRule = (rule: BusinessRule) => {
    if (!rule || !rule.id) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Invalid rule data. Cannot clone rule.',
      });
      return;
    }
    
    try {
    // Clone the rule by creating a new one with a modified name
    setSelectedRule(null); // No selected rule for clone (it's a new rule)
      
      // Deep copy arrays and objects to avoid reference issues
      const clonedConditions = rule.conditions 
        ? JSON.parse(JSON.stringify(rule.conditions))
        : [];
      
      const clonedCalculation = rule.calculation 
        ? JSON.parse(JSON.stringify(rule.calculation))
        : null;
      
    setRuleForm({
        name: `${rule.name || 'Untitled Rule'} (Copy)`,
        description: rule.description || '',
      type: rule.type,
        category: rule.category || 'commission',
        priority: rule.priority || 0,
      isActive: false, // Cloned rules start as inactive
        conditions: clonedConditions,
        calculation: clonedCalculation,
        applicableTo: rule.applicableTo && Array.isArray(rule.applicableTo) 
          ? [...rule.applicableTo] 
          : ['distributor'],
        frequency: rule.frequency || 'monthly',
        payoutTiming: rule.payoutTiming || 'end_of_period',
        tags: rule.tags && Array.isArray(rule.tags) ? [...rule.tags] : []
    });
      
    setIsRuleDialogOpen(true);
    } catch (error) {
      console.error('Error cloning rule:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to clone rule. Please try again.',
      });
    }
  };

  const handleSaveRule = async () => {
    try {
      // Client-side validation
      if (!ruleForm.name || ruleForm.name.trim().length < 3) {
        toast({
          variant: 'destructive',
          title: t('businessRules.validationError'),
          description: 'Rule name must be at least 3 characters long.',
        });
        return;
      }

      if (!ruleForm.description || ruleForm.description.trim().length < 10) {
        toast({
          variant: 'destructive',
          title: t('businessRules.validationError'),
          description: 'Rule description must be at least 10 characters long.',
        });
        return;
      }

      const payload = {
        name: ruleForm.name.trim(),
        description: ruleForm.description.trim(),
        type: ruleForm.type,
        category: ruleForm.category,
        priority: ruleForm.priority,
        isActive: ruleForm.isActive,
        conditions: ruleForm.conditions || [],
        calculation: ruleForm.calculation && Object.keys(ruleForm.calculation).length > 0 ? ruleForm.calculation : {},
        applicableTo: ruleForm.applicableTo,
        frequency: ruleForm.frequency,
        payoutTiming: ruleForm.payoutTiming,
        tags: ruleForm.tags || [],
      };

      let res: Response;

      if (selectedRule) {
        // Update existing rule
        const updatedRule = {
          ...selectedRule,
          ...payload,
        };
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
        res = await fetch(`/api/business-rules/${selectedRule.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(updatedRule),
        });
      } else {
        // Create new rule
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
        res = await fetch('/api/business-rules', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        // Try to get response text first
        let errorText = '';
        let errBody: any = {};
        
        try {
          const text = await res.text();
          errorText = text;
          if (text) {
            errBody = JSON.parse(text);
          }
        } catch (parseError) {
          // If parsing fails, use the text or a default message
          errorText = errorText || `HTTP ${res.status}: ${res.statusText}`;
        }
        
        console.error('API Error Response:', {
          status: res.status,
          statusText: res.statusText,
          body: errBody,
          text: errorText
        });
        
        // Show detailed validation errors if available
        if (errBody.details && Array.isArray(errBody.details) && errBody.details.length > 0) {
          const errorMessage = errBody.details.join(', ');
          toast({
            variant: 'destructive',
            title: t('businessRules.validationFailed'),
            description: errorMessage,
          });
          throw new Error(`Validation failed: ${errorMessage}`);
        }
        
        // Show error message from server
        const errorMessage = errBody?.error || errBody?.message || errorText || `Failed to save rule (Status: ${res.status})`;
        toast({
          variant: 'destructive',
          title: 'Error',
          description: errorMessage,
        });
        throw new Error(errorMessage);
      }

      toast({
        title: 'Success',
        description: `Rule ${selectedRule ? 'updated' : 'created'} successfully.`,
      });
      
      // Reset form state after successful save
      setSelectedRule(null);
      setRuleForm({
        name: '',
        description: '',
        type: 'commission_rate',
        category: 'commission',
        priority: 0,
        isActive: true,
        conditions: [],
        calculation: null,
        applicableTo: ['distributor'],
        frequency: 'monthly',
        payoutTiming: 'end_of_period',
        tags: []
      });
      
      setIsRuleDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Failed to save rule:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save rule.',
      });
    }
  };

  const handleToggleRule = async (ruleId: string, isActive: boolean) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      
      if (!token) {
        toast({
          variant: 'destructive',
          title: 'Authentication Required',
          description: 'Please log in to update rule status.',
        });
        // Revert the switch
        setRules(prevRules => 
          prevRules.map(rule => 
            rule.id === ruleId ? { ...rule, isActive: !isActive } : rule
          )
        );
        return;
      }

      // Find the rule to get its current data
      const rule = rules.find(r => r.id === ruleId);
      if (!rule) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Rule not found.',
        });
        return;
      }

      // Update only the isActive field
      const updatedRule = {
        ...rule,
        isActive,
      };

      // Optimistically update the UI
      setRules(prevRules => 
        prevRules.map(r => 
          r.id === ruleId ? { ...r, isActive } : r
        )
      );

      const response = await fetch(`/api/business-rules/${ruleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updatedRule),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        const errorMessage = errBody?.error || errBody?.message || `Failed to update rule status (Status: ${response.status})`;
        
        // Revert the switch state on error
        setRules(prevRules => 
          prevRules.map(r => 
            r.id === ruleId ? { ...r, isActive: !isActive } : r
          )
        );
        
        toast({
          variant: 'destructive',
          title: 'Error',
          description: errorMessage,
        });
        return;
      }

      toast({
        title: 'Success',
        description: `Rule ${isActive ? 'activated' : 'deactivated'} successfully.`,
      });
      
      // Don't reload data - keep the optimistic update so the rule stays visible
      // The rule will remain in the list even if inactive, allowing users to toggle it back
    } catch (error: any) {
      // Revert the switch state on error
      setRules(prevRules => 
        prevRules.map(r => 
          r.id === ruleId ? { ...r, isActive: !isActive } : r
        )
      );
      
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update rule status.',
      });
    }
  };

  const handleDeleteRule = (ruleId: string) => {
    if (!ruleId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Invalid rule ID. Cannot delete rule.',
      });
      return;
    }
    setDeletingRuleId(ruleId);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingRuleId) return;

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      
      if (!token) {
        toast({
          variant: 'destructive',
          title: 'Authentication Required',
          description: 'Please log in to delete business rules.',
        });
        setIsDeleteDialogOpen(false);
        setDeletingRuleId(null);
        return;
      }

      const response = await fetch(`/api/business-rules/${deletingRuleId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        
        // Handle specific error cases
        if (response.status === 401) {
          toast({
            variant: 'destructive',
            title: 'Authentication Failed',
            description: errBody?.message || 'Your session has expired. Please log in again.',
          });
          setIsDeleteDialogOpen(false);
          setDeletingRuleId(null);
          return;
        }
        
        if (response.status === 403) {
          toast({
            variant: 'destructive',
            title: 'Access Denied',
            description: 'You do not have permission to delete business rules.',
          });
          setIsDeleteDialogOpen(false);
          setDeletingRuleId(null);
          return;
        }
        
        const errorMessage = errBody?.error || errBody?.message || `Failed to delete rule (Status: ${response.status})`;
        throw new Error(errorMessage);
      }

      toast({
        title: 'Success',
        description: 'Business rule deleted successfully.',
      });
      
      // Close dialog first
      setIsDeleteDialogOpen(false);
      const deletedId = deletingRuleId;
      setDeletingRuleId(null);
      
      // Reload data from server to get the updated list
      await loadData();
    } catch (error: any) {
      console.error('Failed to delete rule:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to delete business rule.',
      });
      // Keep dialog open on error so user can try again or cancel
    }
  };

  const getRuleTypeColor = (type: RuleType) => {
    const colors: Record<string, string> = {
      commission_rate: 'bg-blue-100 text-blue-800',
      commission_cap: 'bg-red-100 text-red-800',
      rank_requirement: 'bg-green-100 text-green-800',
      stockist_bonus: 'bg-purple-100 text-purple-800',
      matching_bonus: 'bg-yellow-100 text-yellow-800',
      referral_bonus: 'bg-indigo-100 text-indigo-800',
      leadership_bonus: 'bg-pink-100 text-pink-800',
      custom_bonus: 'bg-gray-100 text-gray-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      commission: 'bg-blue-100 text-blue-800',
      bonus: 'bg-green-100 text-green-800',
      qualification: 'bg-yellow-100 text-yellow-800',
      maintenance: 'bg-orange-100 text-orange-800',
      incentive: 'bg-purple-100 text-purple-800',
      penalty: 'bg-red-100 text-red-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  // Filter rules based on search query
  const filteredRules = rules.filter((rule) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      rule.name.toLowerCase().includes(query) ||
      rule.description.toLowerCase().includes(query) ||
      rule.type.toLowerCase().includes(query) ||
      rule.category.toLowerCase().includes(query) ||
      (rule.tags && rule.tags.some(tag => tag.toLowerCase().includes(query)))
    );
  });

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t('businessRules.title')}</h1>
          <p className="text-muted-foreground">
            {t('businessRules.description')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button onClick={handleCreateRule} className="flex-1 sm:flex-initial text-sm">
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">{t('businessRules.createRule')}</span>
            <span className="sm:hidden">{t('businessRules.create')}</span>
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setIsWizardOpen(true)}
            className="flex-1 sm:flex-initial text-sm"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">{t('businessRules.planWizard')}</span>
            <span className="sm:hidden">{t('businessRules.wizard')}</span>
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setActiveTab('templates')}
            className="flex-1 sm:flex-initial text-sm"
          >
            <Settings className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">{t('businessRules.ruleTemplates')}</span>
            <span className="sm:hidden">{t('businessRules.templates')}</span>
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
          <TabsList className="inline-flex w-full min-w-max sm:grid sm:grid-cols-9 gap-1 sm:gap-0">
            <TabsTrigger value="rules" className="whitespace-nowrap text-xs sm:text-sm">{t('businessRules.rules')}</TabsTrigger>
            <TabsTrigger value="rule-sets" className="whitespace-nowrap text-xs sm:text-sm">{t('businessRules.ruleSets')}</TabsTrigger>
            <TabsTrigger value="templates" className="whitespace-nowrap text-xs sm:text-sm">{t('businessRules.templates')}</TabsTrigger>
            <TabsTrigger value="simulation" className="whitespace-nowrap text-xs sm:text-sm">{t('businessRules.simulation')}</TabsTrigger>
            <TabsTrigger value="performance" className="whitespace-nowrap text-xs sm:text-sm">{t('businessRules.performance')}</TabsTrigger>
            <TabsTrigger value="bulk-ops" className="whitespace-nowrap text-xs sm:text-sm">{t('businessRules.bulkOperations')}</TabsTrigger>
            <TabsTrigger value="versioning" className="whitespace-nowrap text-xs sm:text-sm">{t('businessRules.versioning')}</TabsTrigger>
            <TabsTrigger value="docs" className="whitespace-nowrap text-xs sm:text-sm">{t('businessRules.documentation')}</TabsTrigger>
            <TabsTrigger value="validation" className="whitespace-nowrap text-xs sm:text-sm">{t('businessRules.validation')}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="rules" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>{t('businessRules.title1')}</CardTitle>
                  <CardDescription>
                    {t('businessRules.description1')}
                  </CardDescription>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder={t('businessRules.searchRules')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center h-48">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="inline-block min-w-full align-middle px-4 sm:px-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[200px]">{t('businessRules.name')}</TableHead>
                          <TableHead className="hidden sm:table-cell">{t('businessRules.type')}</TableHead>
                          <TableHead className="hidden md:table-cell">{t('businessRules.priority')}</TableHead>
                          <TableHead className="hidden sm:table-cell">{t('businessRules.status')}</TableHead>
                          <TableHead className="min-w-[200px]">{t('businessRules.actions')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                    {filteredRules.length > 0 ? (
                      filteredRules.map((rule) => {
                        const isNewlyCreated = newlyCreatedRuleNames.has(rule.name);
                        return (
                        <TableRow 
                          key={rule.id}
                          className={isNewlyCreated ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' : ''}
                        >
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm sm:text-base">{rule.name}</p>
                            <p className="text-xs sm:text-sm text-muted-foreground mt-1">{rule.description}</p>
                            <div className="flex flex-wrap gap-1 mt-2 sm:hidden">
                              <Badge className={getRuleTypeColor(rule.type)} variant="outline">
                                {rule.type.replace('_', ' ')}
                              </Badge>
                              <Badge className={getCategoryColor(rule.category)} variant="outline">
                                {rule.category}
                              </Badge>
                              <span className="text-xs text-muted-foreground">Priority: {rule.priority}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge className={getRuleTypeColor(rule.type)}>
                            {rule.type.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge className={getCategoryColor(rule.category)}>
                            {rule.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{rule.priority}</TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Switch
                            checked={rule.isActive}
                            onCheckedChange={(checked) => handleToggleRule(rule.id, checked)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col sm:flex-row gap-2" onClick={(e) => e.stopPropagation()}>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full sm:w-auto text-xs sm:text-sm"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleEditRule(rule);
                              }}
                            >
                              <Edit className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                              {t('businessRules.edit')}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full sm:w-auto text-xs sm:text-sm"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleCloneRule(rule);
                              }}
                            >
                              <Copy className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                              {t('businessRules.clone')}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full sm:w-auto text-xs sm:text-sm text-red-600 hover:text-red-700"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDeleteRule(rule.id);
                              }}
                            >
                              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                              {t('businessRules.delete')}
                            </Button>
                            <div className="sm:hidden flex items-center gap-2">
                              <Switch
                                checked={rule.isActive}
                                onCheckedChange={(checked) => handleToggleRule(rule.id, checked)}
                              />
                              <span className="text-xs text-muted-foreground">{t('businessRules.active')}</span>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                      );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                          <div className="flex flex-col items-center gap-2">
                            <Search className="h-12 w-12 text-muted-foreground" />
                            <p className="text-muted-foreground">
                              {searchQuery.trim() 
                                ? t('businessRules.noRulesFoundMatching', { query: searchQuery })
                                : t('businessRules.emptyStateDescription')}
                            </p>
                            {!searchQuery.trim() && (
                              <Button onClick={handleCreateRule}>
                                <Plus className="h-4 w-4 mr-2" />
                                {t('businessRules.emptyStateCta')}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rule-sets" className="space-y-6">
          <RuleSets rules={rules} onRuleSetUpdate={loadData} />
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <RuleTemplates rules={rules} onTemplateUpdate={loadData} />
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <RulePerformance />
        </TabsContent>

        <TabsContent value="bulk-ops" className="space-y-6">
          <BulkOperations rules={rules} onRulesUpdate={loadData} />
        </TabsContent>

        <TabsContent value="versioning" className="space-y-6">
          <RuleVersioning onVersionRestore={loadData} />
        </TabsContent>

        <TabsContent value="docs" className="space-y-6">
          <RuleDocumentation rules={rules} templates={templates} />
        </TabsContent>

        <TabsContent value="validation" className="space-y-6">
          <RuleConflicts rules={rules} onRulesUpdate={loadData} />
        </TabsContent>

        <TabsContent value="simulation" className="space-y-6">
          <RuleSimulator rules={rules} />
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog 
        open={isDeleteDialogOpen} 
        onOpenChange={(open) => {
          if (!open) {
            setIsDeleteDialogOpen(false);
            setDeletingRuleId(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.areYouSure')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('businessRules.deleteConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              type="button"
              onClick={() => {
              setIsDeleteDialogOpen(false);
              setDeletingRuleId(null);
              }}
            >
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDeleteConfirm();
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rule Creation/Edit Dialog */}
      <Dialog 
        open={isRuleDialogOpen} 
        onOpenChange={(open) => {
          setIsRuleDialogOpen(open);
          // Reset form when dialog closes
          if (!open) {
            setSelectedRule(null);
            setRuleForm({
              name: '',
              description: '',
              type: 'commission_rate',
              category: 'commission',
              priority: 0,
              isActive: true,
              conditions: [],
              calculation: null,
              applicableTo: ['distributor'],
              frequency: 'monthly',
              payoutTiming: 'end_of_period',
              tags: []
            });
          }
        }}
      >
        <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>
              {selectedRule ? t('businessRules.editRuleTitle') : t('businessRules.createNewRuleTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('businessRules.configureRuleDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="rule-name">{t('businessRules.ruleName')}</Label>
                <Input
                  id="rule-name"
                  value={ruleForm.name}
                  onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                  placeholder={t('businessRules.ruleNamePlaceholder')}
                />
              </div>

              <div>
                <Label htmlFor="rule-description">{t('businessRules.description')}</Label>
                <Textarea
                  id="rule-description"
                  value={ruleForm.description}
                  onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })}
                  placeholder={t('businessRules.descriptionPlaceholder')}
                />
              </div>

              <div>
                <Label htmlFor="rule-type">{t('businessRules.ruleType')}</Label>
                <Select
                  value={ruleForm.type}
                  onValueChange={(value) => setRuleForm({ ...ruleForm, type: value as RuleType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="commission_rate">{t('businessRules.commissionRate')}</SelectItem>
                    <SelectItem value="commission_cap">{t('businessRules.commissionCap')}</SelectItem>
                    <SelectItem value="rank_requirement">{t('businessRules.rankRequirement')}</SelectItem>
                    <SelectItem value="stockist_bonus">{t('businessRules.stockistBonus')}</SelectItem>
                    <SelectItem value="matching_bonus">{t('businessRules.matchingBonus')}</SelectItem>
                    <SelectItem value="referral_bonus">{t('businessRules.referralBonus')}</SelectItem>
                    <SelectItem value="leadership_bonus">{t('businessRules.leadershipBonus')}</SelectItem>
                    <SelectItem value="pool_bonus">{t('businessRules.poolBonus')}</SelectItem>
                    <SelectItem value="fast_start_bonus">{t('businessRules.fastStartBonus')}</SelectItem>
                    <SelectItem value="retail_profit">{t('businessRules.retailProfit')}</SelectItem>
                    <SelectItem value="override_bonus">{t('businessRules.overrideBonus')}</SelectItem>
                    <SelectItem value="generation_bonus">{t('businessRules.generationBonus')}</SelectItem>
                    <SelectItem value="breakaway_bonus">{t('businessRules.breakawayBonus')}</SelectItem>
                    <SelectItem value="infinity_bonus">{t('businessRules.infinityBonus')}</SelectItem>
                    <SelectItem value="unilevel_bonus">{t('businessRules.unilevelBonus')}</SelectItem>
                    <SelectItem value="matrix_bonus">{t('businessRules.matrixBonus')}</SelectItem>
                    <SelectItem value="binary_bonus">{t('businessRules.binaryBonus')}</SelectItem>
                    <SelectItem value="stair_step_bonus">{t('businessRules.stairStepBonus')}</SelectItem>
                    <SelectItem value="rank_achievement_bonus">{t('businessRules.rankAchievementBonus')}</SelectItem>
                    <SelectItem value="loyalty_bonus">{t('businessRules.loyaltyBonus')}</SelectItem>
                    <SelectItem value="performance_bonus">{t('businessRules.performanceBonus')}</SelectItem>
                    <SelectItem value="team_building_bonus">{t('businessRules.teamBuildingBonus')}</SelectItem>
                    <SelectItem value="mentorship_bonus">{t('businessRules.mentorshipBonus')}</SelectItem>
                    <SelectItem value="qualification_bonus">{t('businessRules.qualificationBonus')}</SelectItem>
                    <SelectItem value="maintenance_bonus">{t('businessRules.maintenanceBonus')}</SelectItem>
                    <SelectItem value="activity_bonus">{t('businessRules.activityBonus')}</SelectItem>
                    <SelectItem value="productivity_bonus">{t('businessRules.productivityBonus')}</SelectItem>
                    <SelectItem value="volume_bonus">{t('businessRules.volumeBonus')}</SelectItem>
                    <SelectItem value="growth_bonus">{t('businessRules.growthBonus')}</SelectItem>
                    <SelectItem value="retention_bonus">{t('businessRules.retentionBonus')}</SelectItem>
                    <SelectItem value="recruitment_bonus">{t('businessRules.recruitmentBonus')}</SelectItem>
                    <SelectItem value="placement_bonus">{t('businessRules.placementBonus')}</SelectItem>
                    <SelectItem value="sponsorship_bonus">{t('businessRules.sponsorshipBonus')}</SelectItem>
                    <SelectItem value="upline_bonus">{t('businessRules.uplineBonus')}</SelectItem>
                    <SelectItem value="downline_bonus">{t('businessRules.downlineBonus')}</SelectItem>
                    <SelectItem value="pairing_bonus">{t('businessRules.pairingBonus')}</SelectItem>
                    <SelectItem value="cycling_bonus">{t('businessRules.cyclingBonus')}</SelectItem>
                    <SelectItem value="spillover_bonus">{t('businessRules.spilloverBonus')}</SelectItem>
                    <SelectItem value="compression_bonus">{t('businessRules.compressionBonus')}</SelectItem>
                    <SelectItem value="travel_bonus">{t('businessRules.travelBonus')}</SelectItem>
                    <SelectItem value="car_bonus">{t('businessRules.carBonus')}</SelectItem>
                    <SelectItem value="house_bonus">{t('businessRules.houseBonus')}</SelectItem>
                    <SelectItem value="vacation_bonus">{t('businessRules.vacationBonus')}</SelectItem>
                    <SelectItem value="club_bonus">{t('businessRules.clubBonus')}</SelectItem>
                    <SelectItem value="elite_bonus">{t('businessRules.eliteBonus')}</SelectItem>
                    <SelectItem value="royalty_bonus">{t('businessRules.royaltyBonus')}</SelectItem>
                    <SelectItem value="residual_bonus">{t('businessRules.residualBonus')}</SelectItem>
                    <SelectItem value="passive_bonus">{t('businessRules.passiveBonus')}</SelectItem>
                    <SelectItem value="automated_bonus">{t('businessRules.automatedBonus')}</SelectItem>
                    <SelectItem value="custom_bonus">{t('businessRules.customBonus')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="rule-category">{t('businessRules.ruleCategory')}</Label>
                <Select
                  value={ruleForm.category}
                  onValueChange={(value) => setRuleForm({ ...ruleForm, category: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="commission">{t('businessRules.commission')}</SelectItem>
                    <SelectItem value="bonus">{t('businessRules.bonus')}</SelectItem>
                    <SelectItem value="qualification">{t('businessRules.qualification')}</SelectItem>
                    <SelectItem value="maintenance">{t('businessRules.maintenance')}</SelectItem>
                    <SelectItem value="incentive">{t('businessRules.incentive')}</SelectItem>
                    <SelectItem value="penalty">{t('businessRules.penalty')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="rule-priority">{t('businessRules.priority')}</Label>
                <Input
                  id="rule-priority"
                  type="number"
                  value={ruleForm.priority}
                  onChange={(e) => setRuleForm({ ...ruleForm, priority: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="rule-active"
                  checked={ruleForm.isActive}
                  onCheckedChange={(checked) => setRuleForm({ ...ruleForm, isActive: checked })}
                />
                <Label htmlFor="rule-active">{t('businessRules.active')}</Label>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label>{t('businessRules.applicableTo')}</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(['distributor', 'stockist', 'customer'] as const).map((type) => (
                    <Button
                      key={type}
                      variant={ruleForm.applicableTo.includes(type) ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs sm:text-sm"
                      onClick={() => {
                        const newApplicableTo = ruleForm.applicableTo.includes(type)
                          ? ruleForm.applicableTo.filter(t => t !== type)
                          : [...ruleForm.applicableTo, type];
                        setRuleForm({ ...ruleForm, applicableTo: newApplicableTo });
                      }}
                    >
                      {t(`businessRules.${type}`)}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="rule-frequency">{t('businessRules.frequency')}</Label>
                <Select
                  value={ruleForm.frequency}
                  onValueChange={(value) => setRuleForm({ ...ruleForm, frequency: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">{t('businessRules.weekly')}</SelectItem>
                    <SelectItem value="monthly">{t('businessRules.monthly')}</SelectItem>
                    <SelectItem value="quarterly">{t('businessRules.quarterly')}</SelectItem>
                    <SelectItem value="annually">{t('businessRules.annually')}</SelectItem>
                    <SelectItem value="one_time">{t('businessRules.oneTime')}</SelectItem>
                    <SelectItem value="continuous">{t('businessRules.continuous')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="rule-payout-timing">{t('businessRules.payoutTiming')}</Label>
                <Select
                  value={ruleForm.payoutTiming}
                  onValueChange={(value) => setRuleForm({ ...ruleForm, payoutTiming: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">{t('businessRules.immediate')}</SelectItem>
                    <SelectItem value="end_of_period">{t('businessRules.endOfPeriod')}</SelectItem>
                    <SelectItem value="achievement_date">{t('businessRules.achievementDate')}</SelectItem>
                    <SelectItem value="qualification_date">{t('businessRules.qualificationDate')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="rule-tags">{t('businessRules.tagsCommaSeparated')}</Label>
                <Input
                  id="rule-tags"
                  value={ruleForm.tags.join(', ')}
                  onChange={(e) => setRuleForm({ ...ruleForm, tags: e.target.value.split(',').map(t => t.trim()).filter(t => t) })}
                  placeholder={t('businessRules.tagsPlaceholder')}
                />
              </div>
            </div>
          </div>

          {/* Conditions Editor */}
          <div className="border-t pt-6">
            <ConditionsEditor
              conditions={ruleForm.conditions || []}
              onChange={(conditions) => setRuleForm({ ...ruleForm, conditions })}
            />
          </div>

          {/* Calculation Editor */}
          <div className="border-t pt-6">
            <CalculationEditor
              calculation={ruleForm.calculation}
              onChange={(calculation) => setRuleForm({ ...ruleForm, calculation })}
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsRuleDialogOpen(false)} className="w-full sm:w-auto">
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveRule} className="w-full sm:w-auto">
              {selectedRule ? t('businessRules.updateRule') : t('businessRules.createRule')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Compensation Plan Wizard */}
      {isWizardOpen && (
        <CompensationPlanWizard
          onComplete={async (rules: BusinessRule[]) => {
            setIsWizardOpen(false);
            // Create all rules from wizard
            const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
            if (!token) {
              toast({
                variant: 'destructive',
                title: t('businessRules.authenticationRequired'),
                description: t('businessRules.authenticationRequiredDesc'),
              });
              return;
            }

            setLoading(true);
            let successCount = 0;
            let failCount = 0;
            const errors: string[] = [];
            const successfullyCreatedNames: string[] = [];

            for (const rule of rules) {
              try {
                const { id, createdAt, updatedAt, createdBy, version, ...ruleData } = rule;
                const res = await fetch('/api/business-rules', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify(ruleData),
                });

                if (res.ok) {
                  successCount++;
                  successfullyCreatedNames.push(rule.name);
                } else {
                  failCount++;
                  const errorData = await res.json().catch(() => ({}));
                  errors.push(`${rule.name}: ${errorData?.error || 'Failed'}`);
                }
              } catch (error) {
                failCount++;
                errors.push(`${rule.name}: ${error instanceof Error ? error.message : 'Network error'}`);
              }
            }

            setLoading(false);
            
            if (successCount > 0) {
              // Store names of newly created rules for highlighting
              setNewlyCreatedRuleNames(new Set(successfullyCreatedNames));
              
              // Clear search query to show all rules
              setSearchQuery('');
              
              // Reload data first to get the new rules
              await loadData();
              
              // Switch to Rules tab to show the created rules
              setActiveTab('rules');
              
              // Clear highlight after 5 seconds
              setTimeout(() => {
                setNewlyCreatedRuleNames(new Set());
              }, 5000);
              
              // Scroll to top of rules list after a short delay
              setTimeout(() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }, 300);
              
              toast({
                title: `✅ ${t('businessRules.rulesCreatedSuccessfully')}`,
                description: t('businessRules.rulesCreatedSuccessDesc', { 
                  count: successCount.toString(),
                  failInfo: failCount > 0 ? `${failCount} failed.` : 'They are now visible in the Rules tab. Look for highlighted rules!'
                }),
                duration: 7000,
              });
            } else {
              toast({
                variant: 'destructive',
                title: `❌ ${t('businessRules.failedToCreateRules')}`,
                description: t('businessRules.failedToCreateRulesDesc', {
                  count: rules.length.toString(),
                  errors: errors.length > 0 ? errors.slice(0, 2).join('; ') : 'Please check your configuration and try again.'
                }),
                duration: 7000,
              });
            }
          }}
          onCancel={() => setIsWizardOpen(false)}
        />
      )}
    </div>
  );
}