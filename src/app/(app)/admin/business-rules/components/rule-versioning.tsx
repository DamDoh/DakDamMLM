'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { History, RotateCcw, Eye, Download, AlertTriangle, CheckCircle, GitBranch, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/internationalization';
import type { BusinessRule } from '@/lib/types';

interface RuleVersion {
  id: string;
  ruleId: string;
  version: number;
  changes: string[];
  createdAt: string;
  createdBy: string;
  isActive: boolean;
  ruleData: BusinessRule;
}

interface RuleVersioningProps {
  onVersionRestore?: () => void;
}

/**
 * Rule Versioning Component
 * 
 * WHAT IS RULE VERSIONING?
 * Rule Versioning tracks all changes made to business rules over time. Every time a rule is updated,
 * a new version is automatically created, preserving the previous state. This allows you to:
 * - View the complete history of changes
 * - See what changed between versions
 * - Restore (rollback) to any previous version
 * - Download version snapshots
 * - Compare different versions
 * 
 * EXAMPLE USE CASES:
 * 1. "Accidental Change Recovery" - Restore to a previous version if a change breaks something
 * 2. "Audit Trail" - Track who changed what and when for compliance
 * 3. "A/B Testing" - Try different rule configurations and rollback if needed
 * 4. "Change Review" - Review changes before they go live
 * 5. "Historical Analysis" - See how rules evolved over time
 * 
 * FLOW:
 * 1. Select a rule from the dropdown to view its version history
 * 2. View all versions with their changes and timestamps
 * 3. Click "View" to see detailed version information
 * 4. Click "Download" to export a version as JSON
 * 5. Click "Restore" to rollback the rule to that version
 * 6. Confirm restoration - this creates a new version with the restored data
 */
export function RuleVersioning({ onVersionRestore }: RuleVersioningProps) {
  const { toast } = useToast();
  const { t } = useI18n();
  const [rules, setRules] = useState<BusinessRule[]>([]);
  const [selectedRuleId, setSelectedRuleId] = useState<string>('');
  const [versions, setVersions] = useState<RuleVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<RuleVersion | null>(null);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [versionToRestore, setVersionToRestore] = useState<RuleVersion | null>(null);

  useEffect(() => {
    loadRules();
  }, []);

  useEffect(() => {
    if (selectedRuleId) {
      loadVersions();
    } else {
      setVersions([]);
    }
  }, [selectedRuleId]);

  const loadRules = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch('/api/business-rules?limit=200&offset=0', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch rules');
      }

      const result = await response.json();
      if (result.success && result.data) {
        setRules(Array.isArray(result.data) ? result.data : result.data.items || []);
      }
    } catch (error) {
      console.error('Error loading rules:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load rules.',
      });
    }
  };

  const loadVersions = async () => {
    if (!selectedRuleId) return;

    setLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`/api/rule-versions?ruleId=${selectedRuleId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch versions');
      }

      const result = await response.json();
      if (result.success) {
        const versionsData = result.data || [];
        // Get current rule to determine which version is active
        const currentRule = rules.find(r => r.id === selectedRuleId);
        const currentVersion = currentRule?.version || 1;

        const transformedVersions = versionsData.map((v: any) => {
          const versionData = v.data as BusinessRule;
          const changes = v.changes as Partial<BusinessRule>;
          
          // Generate change descriptions
          const changeDescriptions: string[] = [];
          if (changes.name) changeDescriptions.push(`Name changed to "${changes.name}"`);
          if (changes.description) changeDescriptions.push('Description updated');
          if (changes.priority !== undefined) changeDescriptions.push(`Priority changed to ${changes.priority}`);
          if (changes.isActive !== undefined) changeDescriptions.push(`Status changed to ${changes.isActive ? 'Active' : 'Inactive'}`);
          if (changes.calculation) changeDescriptions.push('Calculation updated');
          if (changes.conditions) changeDescriptions.push('Conditions modified');
          if (changeDescriptions.length === 0) changeDescriptions.push('Rule configuration updated');

          return {
            id: v.id,
            ruleId: v.ruleId,
            version: v.version,
            changes: changeDescriptions,
            createdAt: v.createdAt,
            createdBy: v.createdBy,
            isActive: v.version === currentVersion,
            ruleData: versionData
          };
        });

        // Sort by version descending (newest first)
        transformedVersions.sort((a: RuleVersion, b: RuleVersion) => b.version - a.version);
        setVersions(transformedVersions);
      } else {
        throw new Error(result.error || 'Failed to load versions');
      }
    } catch (error) {
      console.error('Error loading versions:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load rule versions.',
      });
      setVersions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreVersion = async () => {
    if (!versionToRestore) return;

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`/api/rule-versions/${versionToRestore.ruleId}/restore`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetVersion: versionToRestore.version
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || 'Failed to restore version');
      }

      const result = await response.json();
      if (result.success) {
      toast({
        title: 'Version Restored',
          description: `Successfully restored rule to version ${versionToRestore.version}.`,
      });
      setShowRestoreDialog(false);
        setVersionToRestore(null);
        await loadVersions(); // Reload versions
        await loadRules(); // Reload rules to get updated version
        onVersionRestore?.();
      } else {
        throw new Error(result.error || 'Failed to restore version');
      }
    } catch (error) {
      console.error('Error restoring version:', error);
      toast({
        variant: 'destructive',
        title: 'Restore Failed',
        description: error instanceof Error ? error.message : 'Failed to restore rule version.',
      });
    }
  };

  const handleViewVersion = (version: RuleVersion) => {
    setSelectedVersion(version);
  };

  const handleDownloadVersion = (version: RuleVersion) => {
    const dataStr = JSON.stringify(version.ruleData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rule-${version.ruleId}-v${version.version}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: 'Download Started',
      description: `Version ${version.version} downloaded.`,
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getVersionStatus = (version: RuleVersion) => {
    if (version.isActive) {
      return { label: 'Active', color: 'bg-green-100 text-green-800' };
    }
    return { label: 'Historical', color: 'bg-gray-100 text-gray-800' };
  };

  return (
    <div className="space-y-6">
      {/* Info Alert */}
      <Alert>
        <GitBranch className="h-4 w-4" />
        <AlertDescription>
          <strong>{t('businessRules.whatIsRuleVersioning')}</strong> {t('businessRules.ruleVersioningDesc')}
        </AlertDescription>
      </Alert>

      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                {t('businessRules.ruleVersionHistory')}
              </CardTitle>
              <CardDescription>
                {t('businessRules.trackChangesRestore')}
              </CardDescription>
            </div>
            <Button onClick={loadVersions} disabled={loading || !selectedRuleId} variant="outline">
              {loading ? (
                <>
                  <History className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <History className="h-4 w-4 mr-2" />
                  {t('businessRules.refresh')}
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="rule-select">{t('businessRules.selectRuleToViewVersions')}</Label>
            <Select value={selectedRuleId} onValueChange={setSelectedRuleId}>
              <SelectTrigger id="rule-select">
                <SelectValue placeholder={t('businessRules.chooseRule')} />
              </SelectTrigger>
              <SelectContent>
                {rules.map(rule => (
                  <SelectItem key={rule.id} value={rule.id}>
                    {rule.name} (v{rule.version})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedRuleId && (
              <p className="text-sm text-muted-foreground">
                Showing version history for: <strong>{rules.find(r => r.id === selectedRuleId)?.name}</strong>
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Versions Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('businessRules.versionHistory')}</CardTitle>
          <CardDescription>
            {selectedRuleId 
              ? `${versions.length} ${t('common.version')}(s) found for this rule.`
              : t('businessRules.selectRuleToViewHistory')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!selectedRuleId ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t('businessRules.noRuleSelected')}</h3>
              <p className="text-muted-foreground">
                {t('businessRules.selectRuleFromDropdown')}
              </p>
            </div>
          ) : loading ? (
            <div className="text-center py-8">Loading versions...</div>
          ) : versions.length === 0 ? (
            <div className="text-center py-8">
              <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Versions Found</h3>
              <p className="text-muted-foreground">
                This rule has no version history yet. Versions are created automatically when you update the rule.
              </p>
            </div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Changes</TableHead>
                <TableHead>Modified By</TableHead>
                <TableHead>Modified At</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {versions.map((version) => {
                const status = getVersionStatus(version);
                return (
                  <TableRow key={version.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">v{version.version}</Badge>
                        {version.isActive && <CheckCircle className="h-4 w-4 text-green-600" />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={status.color}>
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs">
                        <ul className="text-sm space-y-1">
                          {version.changes.slice(0, 2).map((change, index) => (
                            <li key={index} className="truncate">• {change}</li>
                          ))}
                          {version.changes.length > 2 && (
                            <li className="text-muted-foreground">
                              +{version.changes.length - 2} more changes
                            </li>
                          )}
                        </ul>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{version.createdBy}</TableCell>
                    <TableCell className="text-sm">{formatDate(version.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewVersion(version)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadVersion(version)}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                        {!version.isActive && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setVersionToRestore(version);
                              setShowRestoreDialog(true);
                            }}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Restore
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>

      {/* Version Details Dialog */}
      <Dialog open={!!selectedVersion && !showRestoreDialog} onOpenChange={() => setSelectedVersion(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[80vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>
              Rule Version {selectedVersion?.version} Details
            </DialogTitle>
            <DialogDescription>
              Detailed information about this rule version.
            </DialogDescription>
          </DialogHeader>

          {selectedVersion && (
            <div className="space-y-6">
              {/* Version Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Version</Label>
                  <p className="text-sm">v{selectedVersion.version}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <Badge className={getVersionStatus(selectedVersion).color}>
                    {getVersionStatus(selectedVersion).label}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium">Modified By</Label>
                  <p className="text-sm">{selectedVersion.createdBy}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Modified At</Label>
                  <p className="text-sm">{formatDate(selectedVersion.createdAt)}</p>
                </div>
              </div>

              {/* Changes */}
              <div>
                <Label className="text-sm font-medium">Changes Made</Label>
                <ul className="mt-2 space-y-1">
                  {selectedVersion.changes.map((change, index) => (
                    <li key={index} className="text-sm flex items-start gap-2">
                      <span className="text-muted-foreground mt-1">•</span>
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Rule Data Preview */}
              <div>
                <Label className="text-sm font-medium">Rule Configuration</Label>
                <pre className="mt-2 p-4 bg-muted rounded-md text-xs overflow-x-auto">
                  {JSON.stringify(selectedVersion.ruleData, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Rule Version</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to restore this rule to version {versionToRestore?.version}?
              This will create a new version with the restored configuration, overwriting the current active version.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {versionToRestore && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Warning:</strong> This action will replace the current rule configuration
                with version {versionToRestore.version}. A new version will be created with the restored data.
                <br /><br />
                <strong>Changes in version {versionToRestore.version}:</strong>
                <ul className="mt-2 space-y-1 text-sm">
                  {versionToRestore.changes.map((change, index) => (
                    <li key={index}>• {change}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowRestoreDialog(false);
              setVersionToRestore(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestoreVersion}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Restore Version {versionToRestore?.version}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}