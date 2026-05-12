'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { History, RotateCcw, Eye, Download, AlertTriangle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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
  ruleId?: string;
  onVersionRestore?: (version: RuleVersion) => void;
}

export function RuleVersioning({ ruleId, onVersionRestore }: RuleVersioningProps) {
  const { toast } = useToast();
  const [versions, setVersions] = useState<RuleVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<RuleVersion | null>(null);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);

  useEffect(() => {
    if (ruleId) {
      loadVersions();
    }
  }, [ruleId]);

  const loadVersions = async () => {
    setLoading(true);
    try {
      // In a real implementation, this would fetch from API
      const mockVersions: RuleVersion[] = [
        {
          id: 'v1',
          ruleId: ruleId || 'rule1',
          version: 3,
          changes: ['Updated priority from 5 to 10', 'Modified calculation percentage'],
          createdAt: new Date().toISOString(),
          createdBy: 'admin@example.com',
          isActive: true,
          ruleData: {} as BusinessRule
        },
        {
          id: 'v2',
          ruleId: ruleId || 'rule1',
          version: 2,
          changes: ['Added new condition for rank requirement'],
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          createdBy: 'admin@example.com',
          isActive: false,
          ruleData: {} as BusinessRule
        },
        {
          id: 'v3',
          ruleId: ruleId || 'rule1',
          version: 1,
          changes: ['Initial rule creation'],
          createdAt: new Date(Date.now() - 172800000).toISOString(),
          createdBy: 'admin@example.com',
          isActive: false,
          ruleData: {} as BusinessRule
        }
      ];

      setVersions(mockVersions);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load rule versions.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreVersion = async (version: RuleVersion) => {
    try {
      // Implementation for restoring version
      toast({
        title: 'Version Restored',
        description: `Successfully restored to version ${version.version}.`,
      });
      setShowRestoreDialog(false);
      onVersionRestore?.(version);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Restore Failed',
        description: 'Failed to restore rule version.',
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

  if (!ruleId) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Rule Versioning</h3>
          <p className="text-muted-foreground">
            Select a rule to view its version history and rollback options.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Rule Version History
              </CardTitle>
              <CardDescription>
                Track changes and restore previous versions of this rule.
              </CardDescription>
            </div>
            <Button onClick={loadVersions} disabled={loading} variant="outline" icon={History}>
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Versions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Version History</CardTitle>
          <CardDescription>
            {versions.length} version(s) found for this rule.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                          icon={Eye}
                        >
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadVersion(version)}
                          icon={Download}
                        >
                          Download
                        </Button>
                        {!version.isActive && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedVersion(version);
                              setShowRestoreDialog(true);
                            }}
                            icon={RotateCcw}
                          >
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
        </CardContent>
      </Card>

      {/* Version Details Dialog */}
      <Dialog open={!!selectedVersion && !showRestoreDialog} onOpenChange={() => setSelectedVersion(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
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
      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore Rule Version</DialogTitle>
            <DialogDescription>
              Are you sure you want to restore this rule to version {selectedVersion?.version}?
              This will overwrite the current active version.
            </DialogDescription>
          </DialogHeader>

          {selectedVersion && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Warning:</strong> This action will replace the current rule configuration
                with version {selectedVersion.version}. This cannot be undone.
                <br /><br />
                <strong>Changes in this version:</strong>
                <ul className="mt-2 space-y-1">
                  {selectedVersion.changes.map((change, index) => (
                    <li key={index}>• {change}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowRestoreDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedVersion && handleRestoreVersion(selectedVersion)}
              variant="destructive"
              icon={RotateCcw}
            >
              Restore Version {selectedVersion?.version}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}