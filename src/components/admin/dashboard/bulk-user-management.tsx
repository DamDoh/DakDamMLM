'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Upload,
  Download,
  Users,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Trash2,
  RefreshCw,
  UserPlus,
  Settings
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/internationalization';

interface BulkImportResult {
  total: number;
  successful: number;
  failed: number;
  errors: Array<{
    row: number;
    email: string;
    error: string;
  }>;
  preview: Array<{
    email: string;
    firstName: string;
    surname: string;
    phoneNumber: string;
    status: 'valid' | 'invalid' | 'duplicate';
    errors?: string[];
  }>;
}

interface BulkOperation {
  id: string;
  type: 'import' | 'export' | 'update';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  total: number;
  completed: number;
  startedAt: string;
  completedAt?: string;
  result?: BulkImportResult;
}

export function BulkUserManagement() {
  const [activeTab, setActiveTab] = useState('import');
  const [file, setFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [operations, setOperations] = useState<BulkOperation[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [exportFormat, setExportFormat] = useState('csv');
  const [exportFilters, setExportFilters] = useState({
    userType: '',
    status: '',
    dateRange: 'all'
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { t } = useI18n();

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast({
        title: 'Invalid File Type',
        description: 'Please select a CSV file',
        variant: 'destructive',
      });
      return;
    }

    setFile(selectedFile);
    await validateFile(selectedFile);
  };

  // Validate uploaded file
  const validateFile = async (file: File) => {
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/bulk-users/validate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to validate file');
      }

      const result = await response.json();
      setImportResult(result);
    } catch (error) {
      console.error('File validation failed:', error);
      toast({
        title: 'Validation Failed',
        description: 'Failed to validate the uploaded file',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Process bulk import
  const processImport = async () => {
    if (!file) return;

    setIsProcessing(true);
    const operationId = `import_${Date.now()}`;

    const operation: BulkOperation = {
      id: operationId,
      type: 'import',
      status: 'processing',
      progress: 0,
      total: importResult?.total || 0,
      completed: 0,
      startedAt: new Date().toISOString()
    };

    setOperations(prev => [...prev, operation]);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/bulk-users/import', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to process import');
      }

      const result = await response.json();

      setOperations(prev => prev.map(op =>
        op.id === operationId
          ? {
              ...op,
              status: 'completed',
              progress: 100,
              completed: result.successful,
              completedAt: new Date().toISOString(),
              result
            }
          : op
      ));

      setImportResult(result);

      toast({
        title: 'Import Completed',
        description: `Successfully imported ${result.successful} users`,
      });
    } catch (error) {
      console.error('Import failed:', error);

      setOperations(prev => prev.map(op =>
        op.id === operationId
          ? {
              ...op,
              status: 'failed',
              completedAt: new Date().toISOString()
            }
          : op
      ));

      toast({
        title: 'Import Failed',
        description: 'Failed to process bulk import',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Export users
  const exportUsers = async () => {
    setIsProcessing(true);
    const operationId = `export_${Date.now()}`;

    const operation: BulkOperation = {
      id: operationId,
      type: 'export',
      status: 'processing',
      progress: 0,
      total: 100, // Estimated
      completed: 0,
      startedAt: new Date().toISOString()
    };

    setOperations(prev => [...prev, operation]);

    try {
      const token = localStorage.getItem('accessToken');
      const params = new URLSearchParams({
        format: exportFormat,
        ...exportFilters
      });

      const response = await fetch(`/api/bulk-users/export?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to export users');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users-export-${new Date().toISOString().split('T')[0]}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setOperations(prev => prev.map(op =>
        op.id === operationId
          ? {
              ...op,
              status: 'completed',
              progress: 100,
              completed: 100,
              completedAt: new Date().toISOString()
            }
          : op
      ));

      toast({
        title: 'Export Completed',
        description: 'User data has been downloaded successfully',
      });
    } catch (error) {
      console.error('Export failed:', error);

      setOperations(prev => prev.map(op =>
        op.id === operationId
          ? {
              ...op,
              status: 'failed',
              completedAt: new Date().toISOString()
            }
          : op
      ));

      toast({
        title: 'Export Failed',
        description: 'Failed to export user data',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Download template
  const downloadTemplate = () => {
    const csvContent = [
      'email,firstName,surname,phoneNumber,accountType,sponsorId,referralCode',
      'john.doe@company.com,John,Doe,+1234567890,Customer,,REF123',
      'jane.smith@company.com,Jane,Smith,+1234567891,Stockist,,REF456'
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk-import-template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const getOperationStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'processing':
        return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'valid':
        return <Badge variant="default">Valid</Badge>;
      case 'invalid':
        return <Badge variant="destructive">Invalid</Badge>;
      case 'duplicate':
        return <Badge variant="secondary">Duplicate</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Bulk User Management
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Import, export, and manage large numbers of users efficiently
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4 text-center">
                <UserPlus className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                <div className="text-2xl font-bold">
                  {operations.filter(op => op.type === 'import' && op.status === 'completed').length}
                </div>
                <p className="text-xs text-muted-foreground">Imports Completed</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Download className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <div className="text-2xl font-bold">
                  {operations.filter(op => op.type === 'export' && op.status === 'completed').length}
                </div>
                <p className="text-xs text-muted-foreground">Exports Completed</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Settings className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                <div className="text-2xl font-bold">
                  {operations.filter(op => op.status === 'processing').length}
                </div>
                <p className="text-xs text-muted-foreground">Active Operations</p>
              </CardContent>
            </Card>
          </div>

          {/* Operation History */}
          {operations.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Recent Operations</h3>
              {operations.slice(-5).reverse().map(op => (
                <div key={op.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-3">
                    {getOperationStatusIcon(op.status)}
                    <div>
                      <p className="font-medium capitalize">{op.type} Operation</p>
                      <p className="text-sm text-muted-foreground">
                        {op.completed}/{op.total} completed • Started {new Date(op.startedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={op.progress} className="w-20" />
                    <span className="text-sm">{op.progress}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import/Export Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bulk Import */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Bulk Import
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="file-upload">Select CSV File</Label>
              <Input
                id="file-upload"
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                ref={fileInputRef}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Upload a CSV file with user data.{' '}
                <Button variant="link" className="p-0 h-auto text-xs" onClick={downloadTemplate}>
                  Download template
                </Button>
              </p>
            </div>

            {file && (
              <div className="p-3 bg-muted rounded">
                <p className="text-sm font-medium">Selected file: {file.name}</p>
                <p className="text-xs text-muted-foreground">
                  Size: {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            )}

            {importResult && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p>Validation Results:</p>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>Total: {importResult.total}</div>
                      <div className="text-green-600">Valid: {importResult.successful}</div>
                      <div className="text-red-600">Errors: {importResult.failed}</div>
                    </div>
                    {importResult.errors.length > 0 && (
                      <div>
                        <p className="font-medium mt-2">Errors:</p>
                        <ul className="text-xs space-y-1 mt-1">
                          {importResult.errors.slice(0, 3).map((error, index) => (
                            <li key={index}>Row {error.row}: {error.error}</li>
                          ))}
                          {importResult.errors.length > 3 && (
                            <li>... and {importResult.errors.length - 3} more errors</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <Button
              onClick={processImport}
              disabled={!file || isProcessing || !importResult}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processing Import...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Start Import
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Bulk Export */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Bulk Export
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Format</Label>
                <Select value={exportFormat} onValueChange={setExportFormat}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="xlsx">Excel</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date Range</Label>
                <Select
                  value={exportFilters.dateRange}
                  onValueChange={(value) => setExportFilters(prev => ({ ...prev, dateRange: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="1y">Last Year</SelectItem>
                    <SelectItem value="6m">Last 6 Months</SelectItem>
                    <SelectItem value="1m">Last Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>User Type</Label>
                <Select
                  value={exportFilters.userType}
                  onValueChange={(value) => setExportFilters(prev => ({ ...prev, userType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Types</SelectItem>
                    <SelectItem value="Customer">Customer</SelectItem>
                    <SelectItem value="Stockist">Stockist</SelectItem>
                    <SelectItem value="Admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={exportFilters.status}
                  onValueChange={(value) => setExportFilters(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={exportUsers}
              disabled={isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export Users
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Import Preview */}
      {importResult?.preview && importResult.preview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Import Preview</CardTitle>
            <p className="text-sm text-muted-foreground">
              First 10 rows of your import file
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importResult.preview.slice(0, 10).map((row, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono text-sm">{row.email}</TableCell>
                      <TableCell>{`${row.firstName} ${row.surname}`}</TableCell>
                      <TableCell>{row.phoneNumber}</TableCell>
                      <TableCell>{getStatusBadge(row.status)}</TableCell>
                      <TableCell>
                        {row.errors && row.errors.length > 0 && (
                          <div className="text-xs text-red-600">
                            {row.errors.join(', ')}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}</content>
<parameter name="filePath">C:\Users\V COMPUTER\Documents\dakdampostgre-devcg\dakdampostgre-devcg\src\components\admin\dashboard\bulk-user-management.tsx