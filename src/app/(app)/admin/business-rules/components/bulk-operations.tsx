'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, Upload, Copy, Trash2, Play, Pause, AlertTriangle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/internationalization';
import type { BusinessRule } from '@/lib/types';

interface BulkOperationsProps {
  rules: BusinessRule[];
  onRulesUpdate?: () => void;
}

export function BulkOperations({ rules, onRulesUpdate }: BulkOperationsProps) {
  const { toast } = useToast();
  const { t } = useI18n();
  const safeT: (key: string, vars?: Record<string, string>) => string = (key: string, vars?: Record<string, string>) => {
    try {
      const result = t(key, vars);
      return (result ?? '') as string;
    } catch {
      return '';
    }
  };
  const [selectedRules, setSelectedRules] = useState<string[]>([]);
  const [operation, setOperation] = useState<'activate' | 'deactivate' | 'delete' | 'export' | 'duplicate' | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [importData, setImportData] = useState('');

  const handleSelectAll = (checked: boolean) => {
    setSelectedRules(checked ? rules.map(r => r.id) : []);
  };

  const handleSelectRule = (ruleId: string, checked: boolean) => {
    setSelectedRules(prev =>
      checked
        ? [...prev, ruleId]
        : prev.filter(id => id !== ruleId)
    );
  };

  const executeBulkOperation = async () => {
    if (!operation || selectedRules.length === 0) return;

    setLoading(true);
    try {
      switch (operation) {
        case 'activate':
          await bulkActivateRules(selectedRules);
          break;
        case 'deactivate':
          await bulkDeactivateRules(selectedRules);
          break;
        case 'delete':
          await bulkDeleteRules(selectedRules);
          break;
        case 'export':
          await exportRules(selectedRules);
          break;
        case 'duplicate':
          await bulkDuplicateRules(selectedRules);
          break;
      }

      toast({
        title: t('businessRules.operationCompleted'),
        description: t('businessRules.operationCompletedDesc', { operation, count: selectedRules.length.toString() }),
      });

      setSelectedRules([]);
      setShowConfirmDialog(false);
      onRulesUpdate?.();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('businessRules.operationFailed'),
        description: t('businessRules.operationFailedDesc', { operation }),
      });
    } finally {
      setLoading(false);
    }
  };

  const bulkActivateRules = async (ruleIds: string[]) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) {
      throw new Error('Authentication required');
    }

    // Update each rule to set isActive to true
    const updatePromises = ruleIds.map(async (ruleId) => {
      const rule = rules.find(r => r.id === ruleId);
      if (!rule) return;

      const response = await fetch(`/api/business-rules/${ruleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...rule,
          isActive: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to activate rule ${ruleId}`);
      }
    });

    await Promise.all(updatePromises);
  };

  const bulkDeactivateRules = async (ruleIds: string[]) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) {
      throw new Error('Authentication required');
    }

    // Update each rule to set isActive to false
    const updatePromises = ruleIds.map(async (ruleId) => {
      const rule = rules.find(r => r.id === ruleId);
      if (!rule) return;

      const response = await fetch(`/api/business-rules/${ruleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...rule,
          isActive: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to deactivate rule ${ruleId}`);
      }
    });

    await Promise.all(updatePromises);
  };

  const bulkDeleteRules = async (ruleIds: string[]) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) {
      throw new Error('Authentication required');
    }

    // Delete each rule
    const deletePromises = ruleIds.map(async (ruleId) => {
      const response = await fetch(`/api/business-rules/${ruleId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete rule ${ruleId}`);
      }
    });

    await Promise.all(deletePromises);
  };

  const exportRules = async (ruleIds: string[]) => {
    const rulesToExport = rules.filter(r => ruleIds.includes(r.id));

    if (exportFormat === 'json') {
      const dataStr = JSON.stringify(rulesToExport, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      downloadBlob(dataBlob, 'business-rules-export.json');
    } else {
      // CSV export
      const csvContent = convertToCSV(rulesToExport);
      const dataBlob = new Blob([csvContent], { type: 'text/csv' });
      downloadBlob(dataBlob, 'business-rules-export.csv');
    }
  };

  const bulkDuplicateRules = async (ruleIds: string[]) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) {
      throw new Error('Authentication required');
    }

    // Duplicate each rule by creating a new one with a modified name
    const duplicatePromises = ruleIds.map(async (ruleId) => {
      const rule = rules.find(r => r.id === ruleId);
      if (!rule) return;

      // Create a new rule with "(Copy)" suffix
      const newRule = {
        name: `${rule.name} (Copy)`,
        description: rule.description || '',
        type: rule.type,
        category: rule.category || 'commission',
        priority: rule.priority || 0,
        isActive: false, // Cloned rules start as inactive
        conditions: rule.conditions || [],
        calculation: rule.calculation || null,
        applicableTo: rule.applicableTo && Array.isArray(rule.applicableTo) 
          ? [...rule.applicableTo] 
          : ['distributor'],
        frequency: rule.frequency || 'monthly',
        payoutTiming: rule.payoutTiming || 'end_of_period',
        tags: rule.tags && Array.isArray(rule.tags) ? [...rule.tags] : []
      };

      const response = await fetch('/api/business-rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newRule),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || errorData?.message || `Failed to duplicate rule ${ruleId}`);
      }
    });

    await Promise.all(duplicatePromises);
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const convertToCSV = (rules: BusinessRule[]): string => {
    const headers = ['ID', 'Name', 'Type', 'Category', 'Priority', 'Active', 'Frequency', 'Applicable To'];
    const rows = rules.map(rule => [
      rule.id,
      rule.name,
      rule.type,
      rule.category,
      rule.priority.toString(),
      rule.isActive.toString(),
      rule.frequency,
      rule.applicableTo.join('; ')
    ]);

    return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  };

  const handleImport = async () => {
      if (!importData.trim()) {
        toast({
          variant: 'destructive',
          title: 'Import Failed',
          description: 'Please provide data to import.',
        });
        return;
      }

    setImporting(true);
    try {
      let importedRules: BusinessRule[];

      try {
        importedRules = JSON.parse(importData);
      } catch (parseError) {
        toast({
          variant: 'destructive',
          title: 'Import Failed',
          description: 'Invalid JSON format. Please check your JSON syntax.',
        });
        setImporting(false);
        return;
      }

      // Ensure importedRules is an array
      if (!Array.isArray(importedRules)) {
        toast({
          variant: 'destructive',
          title: 'Import Failed',
          description: 'Import data must be an array of rules. Example: [{"name": "Rule 1", "type": "commission_rate", ...}]',
        });
        setImporting(false);
        return;
      }

      // Validate imported rules - ensure required fields are present
      const validRules = importedRules.filter(rule => {
        return rule.name && rule.type && rule.category;
      });

      if (validRules.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Import Failed',
          description: 'No valid rules found in import data. Rules must have name, type, and category.',
        });
        setImporting(false);
        return;
      }

      // Import rules via API
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        toast({
          variant: 'destructive',
          title: 'Authentication Required',
          description: 'Please log in to import rules.',
        });
        setImporting(false);
        return;
      }

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      // Import each rule
      for (const rule of validRules) {
        try {
          // Remove id, createdAt, updatedAt, version if present (will be generated by server)
          const { id, createdAt, updatedAt, version, ...ruleData } = rule;
          
          // Ensure description is provided and at least 10 characters (required by API validation)
          let description = rule.description && rule.description.trim() 
            ? rule.description.trim() 
            : `Imported rule: ${rule.name}`;
          
          // Ensure description meets minimum length requirement (10 characters)
          if (description.length < 10) {
            description = description.padEnd(10, '.') || `Rule description for ${rule.name}`;
          }
          
          const ruleToImport = {
            name: rule.name.trim(),
            description: description,
            type: rule.type,
            category: rule.category || 'commission',
            priority: rule.priority || 0,
            isActive: rule.isActive ?? false,
            conditions: rule.conditions || [],
            calculation: rule.calculation || null,
            applicableTo: rule.applicableTo && Array.isArray(rule.applicableTo) 
              ? [...rule.applicableTo] 
              : ['distributor'],
            frequency: rule.frequency || 'monthly',
            payoutTiming: rule.payoutTiming || 'end_of_period',
            tags: rule.tags && Array.isArray(rule.tags) ? [...rule.tags] : []
          };

          const response = await fetch('/api/business-rules', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(ruleToImport),
          });

          if (response.ok) {
            const result = await response.json();
            if (result.success !== false) {
              successCount++;
            } else {
              const errorMsg = result.error || result.message || 'Unknown error';
              errors.push(`${rule.name}: ${errorMsg}`);
              errorCount++;
            }
          } else {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = errorData?.error || errorData?.message || errorData?.details?.join(', ') || `HTTP ${response.status}`;
            errors.push(`${rule.name}: ${errorMsg}`);
            console.error(`Failed to import rule "${rule.name}":`, errorData);
            errorCount++;
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`${rule.name}: ${errorMsg}`);
          console.error(`Error importing rule "${rule.name}":`, error);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast({
          title: 'Import Completed',
          description: `Successfully imported ${successCount} rule(s).${errorCount > 0 ? ` ${errorCount} rule(s) failed.` : ''}`,
      });
      setImportData('');
      onRulesUpdate?.();
        
        // Show detailed errors if any
        if (errorCount > 0 && errors.length > 0) {
          console.warn('Import errors:', errors);
          // Optionally show a detailed error toast
          setTimeout(() => {
            toast({
              variant: 'destructive',
              title: 'Some Rules Failed to Import',
              description: errors.slice(0, 3).join('; ') + (errors.length > 3 ? ` and ${errors.length - 3} more...` : ''),
            });
          }, 1000);
        }
      } else {
        toast({
          variant: 'destructive',
          title: 'Import Failed',
          description: `Failed to import all ${errorCount} rule(s). ${errors.length > 0 ? errors[0] : 'Please check the console for details.'}`,
        });
      }
    } catch (error) {
      console.error('Import error:', error);
      toast({
        variant: 'destructive',
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'An error occurred during import.',
      });
    } finally {
      setImporting(false);
    }
  };

  const getOperationLabel = (op: string) => {
    const labels = {
      activate: 'Activate',
      deactivate: 'Deactivate',
      delete: 'Delete',
      export: 'Export',
      duplicate: 'Duplicate'
    };
    return labels[op as keyof typeof labels] || op;
  };

  return (
    <div className="space-y-6">
      {/* Bulk Actions */}
      <Card>
        <CardHeader>
          <CardTitle>{t('businessRules.bulkOperations')}</CardTitle>
          <CardDescription>
            {t('businessRules.performOperationsMultiple')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedRules.length > 0 && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                {selectedRules.length} rule(s) selected. Choose an operation below.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setOperation('activate'); setShowConfirmDialog(true); }}
              disabled={selectedRules.length === 0}
              icon={Play}
            >
              {t('businessRules.activateSelected')}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => { setOperation('deactivate'); setShowConfirmDialog(true); }}
              disabled={selectedRules.length === 0}
              icon={Pause}
            >
              {t('businessRules.deactivateSelected')}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => { setOperation('duplicate'); setShowConfirmDialog(true); }}
              disabled={selectedRules.length === 0}
              icon={Copy}
            >
              {t('businessRules.duplicateSelected')}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => { setOperation('export'); executeBulkOperation(); }}
              disabled={selectedRules.length === 0}
              icon={Download}
            >
              {t('businessRules.exportSelected')}
            </Button>

            <Button
              variant="destructive"
              size="sm"
              onClick={() => { setOperation('delete'); setShowConfirmDialog(true); }}
              disabled={selectedRules.length === 0}
              icon={Trash2}
            >
              {t('businessRules.deleteSelected')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Import/Export */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              {t('businessRules.importRules')}
            </CardTitle>
            <CardDescription>
              {t('businessRules.importRulesFromJson')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="import-data">JSON Data</Label>
              <Textarea
                id="import-data"
                placeholder={`Example format:\n[\n  {\n    "name": "Rule Name",\n    "description": "Rule description (min 10 chars)",\n    "type": "commission_rate",\n    "category": "commission",\n    "priority": 0,\n    "isActive": true\n  }\n]`}
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-2">
                {t('businessRules.requiredFields')}
              </p>
            </div>
            <Button 
              onClick={handleImport} 
              disabled={!importData.trim() || importing}
              icon={Upload}
            >
              {importing ? t('common.loading') : t('businessRules.importRules')}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              {t('businessRules.exportAllRules')}
            </CardTitle>
            <CardDescription>
              {t('businessRules.exportAllRulesDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Export Format</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  variant={exportFormat === 'json' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setExportFormat('json')}
                >
                  {t('businessRules.json')}
                </Button>
                <Button
                  variant={exportFormat === 'csv' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setExportFormat('csv')}
                >
                  {t('businessRules.csv')}
                </Button>
              </div>
            </div>
            <Button
              onClick={() => exportRules(rules.map(r => r.id))}
              icon={Download}
            >
              {t('businessRules.exportAllRules')}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Rule Selection Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('businessRules.ruleSelection')}</CardTitle>
              <CardDescription>
                {t('businessRules.selectRulesForBulkOps')}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="select-all"
                checked={selectedRules.length === rules.length && rules.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <Label htmlFor="select-all" className="text-sm">
                {t('businessRules.selectAllRules', { count: rules.length.toString() })}
              </Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">{t('businessRules.select')}</TableHead>
                <TableHead>{t('businessRules.name')}</TableHead>
                <TableHead>{t('businessRules.type')}</TableHead>
                <TableHead>{t('businessRules.category')}</TableHead>
                <TableHead>{t('businessRules.status')}</TableHead>
                <TableHead>{t('businessRules.priority')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedRules.includes(rule.id)}
                      onCheckedChange={(checked) => handleSelectRule(rule.id, checked as boolean)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{rule.type.replace('_', ' ')}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{rule.category}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                      {rule.isActive ? t('businessRules.active') : t('businessRules.inactive')}
                    </Badge>
                  </TableCell>
                  <TableCell>{rule.priority}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('businessRules.confirmBulkOperation')}</DialogTitle>
            <DialogDescription>
              {(() => {
                const mainText = safeT('businessRules.confirmBulkOperationDesc', { operation: operation || '', count: selectedRules.length.toString() });
                const deleteText = operation === 'delete' ? safeT('common.deleteConfirmation') : '' as string;
                return String(mainText) + (deleteText ? ` ${String(deleteText)}` : '');
              })()}
            </DialogDescription>
          </DialogHeader>

          {operation === 'delete' && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {t('businessRules.deletingRulesWarning')}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={executeBulkOperation}
              disabled={loading}
              variant={operation === 'delete' ? 'destructive' : 'default'}
            >
              {loading ? t('businessRules.processing') : t('businessRules.confirmOperation', { operation: getOperationLabel(operation || '') })}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}