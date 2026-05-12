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
import type { BusinessRule } from '@/lib/types';

interface BulkOperationsProps {
  rules: BusinessRule[];
  onRulesUpdate?: () => void;
}

export function BulkOperations({ rules, onRulesUpdate }: BulkOperationsProps) {
  const { toast } = useToast();
  const [selectedRules, setSelectedRules] = useState<string[]>([]);
  const [operation, setOperation] = useState<'activate' | 'deactivate' | 'delete' | 'export' | 'duplicate' | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [loading, setLoading] = useState(false);
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
        title: 'Operation Completed',
        description: `Successfully ${operation}d ${selectedRules.length} rule(s).`,
      });

      setSelectedRules([]);
      setShowConfirmDialog(false);
      onRulesUpdate?.();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Operation Failed',
        description: `Failed to ${operation} selected rules.`,
      });
    } finally {
      setLoading(false);
    }
  };

  const bulkActivateRules = async (ruleIds: string[]) => {
    // Implementation for activating rules
    console.log('Activating rules:', ruleIds);
  };

  const bulkDeactivateRules = async (ruleIds: string[]) => {
    // Implementation for deactivating rules
    console.log('Deactivating rules:', ruleIds);
  };

  const bulkDeleteRules = async (ruleIds: string[]) => {
    // Implementation for deleting rules
    console.log('Deleting rules:', ruleIds);
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
    // Implementation for duplicating rules
    console.log('Duplicating rules:', ruleIds);
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
    try {
      if (!importData.trim()) {
        toast({
          variant: 'destructive',
          title: 'Import Failed',
          description: 'Please provide data to import.',
        });
        return;
      }

      let importedRules: BusinessRule[];

      try {
        importedRules = JSON.parse(importData);
      } catch {
        toast({
          variant: 'destructive',
          title: 'Import Failed',
          description: 'Invalid JSON format.',
        });
        return;
      }

      // Validate imported rules
      const validRules = importedRules.filter(rule => {
        return rule.id && rule.name && rule.type && rule.category;
      });

      if (validRules.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Import Failed',
          description: 'No valid rules found in import data.',
        });
        return;
      }

      // Implementation for importing rules
      console.log('Importing rules:', validRules);

      toast({
        title: 'Import Successful',
        description: `Successfully imported ${validRules.length} rule(s).`,
      });

      setImportData('');
      onRulesUpdate?.();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Import Failed',
        description: 'An error occurred during import.',
      });
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
          <CardTitle>Bulk Operations</CardTitle>
          <CardDescription>
            Perform operations on multiple rules simultaneously.
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
              Activate Selected
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => { setOperation('deactivate'); setShowConfirmDialog(true); }}
              disabled={selectedRules.length === 0}
              icon={Pause}
            >
              Deactivate Selected
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => { setOperation('duplicate'); setShowConfirmDialog(true); }}
              disabled={selectedRules.length === 0}
              icon={Copy}
            >
              Duplicate Selected
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => { setOperation('export'); executeBulkOperation(); }}
              disabled={selectedRules.length === 0}
              icon={Download}
            >
              Export Selected
            </Button>

            <Button
              variant="destructive"
              size="sm"
              onClick={() => { setOperation('delete'); setShowConfirmDialog(true); }}
              disabled={selectedRules.length === 0}
              icon={Trash2}
            >
              Delete Selected
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
              Import Rules
            </CardTitle>
            <CardDescription>
              Import rules from JSON format.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="import-data">JSON Data</Label>
              <Textarea
                id="import-data"
                placeholder="Paste JSON data here..."
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
              />
            </div>
            <Button onClick={handleImport} disabled={!importData.trim()}>
              Import Rules
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Export All Rules
            </CardTitle>
            <CardDescription>
              Export all rules in your preferred format.
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
                  JSON
                </Button>
                <Button
                  variant={exportFormat === 'csv' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setExportFormat('csv')}
                >
                  CSV
                </Button>
              </div>
            </div>
            <Button
              onClick={() => exportRules(rules.map(r => r.id))}
              icon={Download}
            >
              Export All Rules
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Rule Selection Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Rule Selection</CardTitle>
              <CardDescription>
                Select rules to perform bulk operations on.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="select-all"
                checked={selectedRules.length === rules.length && rules.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <Label htmlFor="select-all" className="text-sm">
                Select All ({rules.length})
              </Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Select</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
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
                      {rule.isActive ? 'Active' : 'Inactive'}
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
            <DialogTitle>Confirm Bulk Operation</DialogTitle>
            <DialogDescription>
              Are you sure you want to {operation} {selectedRules.length} selected rule(s)?
              {operation === 'delete' && ' This action cannot be undone.'}
            </DialogDescription>
          </DialogHeader>

          {operation === 'delete' && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Deleting rules will permanently remove them from the system.
                Make sure you have exported any important rules before proceeding.
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
              {loading ? 'Processing...' : `Confirm ${getOperationLabel(operation || '')}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}