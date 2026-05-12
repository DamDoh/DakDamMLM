'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  BarChart3,
  PieChart,
  TrendingUp,
  Download,
  Plus,
  Trash2,
  Edit,
  Filter,
  Calendar,
  Users,
  DollarSign,
  ShoppingCart,
  Target,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/internationalization';
import { formatCurrency } from '@/lib/utils';

interface ReportMetric {
  id: string;
  name: string;
  value: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  category: string;
}

interface DrillDownData {
  dimension: string;
  value: any;
  metrics: ReportMetric[];
  children?: DrillDownData[];
  level: number;
}

interface CustomReport {
  id: string;
  name: string;
  description: string;
  metrics: string[];
  dimensions: string[];
  filters: Record<string, any>;
  chartType: 'bar' | 'line' | 'pie' | 'table';
  dateRange: string;
  createdAt: string;
}

export function EnhancedReportingDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [drillDownData, setDrillDownData] = useState<DrillDownData | null>(null);
  const [drillDownPath, setDrillDownPath] = useState<string[]>([]);
  const [customReports, setCustomReports] = useState<CustomReport[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [selectedDimensions, setSelectedDimensions] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState('30d');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useI18n();

  // Available metrics and dimensions
  const availableMetrics = [
    { id: 'totalRevenue', name: 'Total Revenue', category: 'Financial' },
    { id: 'totalOrders', name: 'Total Orders', category: 'Sales' },
    { id: 'activeUsers', name: 'Active Users', category: 'Users' },
    { id: 'conversionRate', name: 'Conversion Rate', category: 'Performance' },
    { id: 'avgOrderValue', name: 'Average Order Value', category: 'Sales' },
    { id: 'customerRetention', name: 'Customer Retention', category: 'Users' },
    { id: 'commissionPaid', name: 'Commission Paid', category: 'Financial' },
    { id: 'productViews', name: 'Product Views', category: 'Engagement' }
  ];

  const availableDimensions = [
    { id: 'date', name: 'Date', category: 'Time' },
    { id: 'product', name: 'Product', category: 'Product' },
    { id: 'category', name: 'Category', category: 'Product' },
    { id: 'userType', name: 'User Type', category: 'Users' },
    { id: 'region', name: 'Region', category: 'Geography' },
    { id: 'company', name: 'Company', category: 'Business' },
    { id: 'rank', name: 'Rank', category: 'Users' },
    { id: 'paymentMethod', name: 'Payment Method', category: 'Sales' }
  ];

  // Load drill-down data
  const loadDrillDownData = useCallback(async (dimension: string, value?: any, path: string[] = []) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const params = new URLSearchParams({
        dimension,
        dateRange,
        level: path.length.toString()
      });

      if (value) params.set('value', String(value));

      const response = await fetch(`/api/reports/drill-down?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load drill-down data');
      }

      const result = await response.json();
      setDrillDownData(result.data);
      setDrillDownPath(path);
    } catch (error) {
      console.error('Failed to load drill-down data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load detailed report data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [dateRange, toast]);

  // Handle drill-down navigation
  const handleDrillDown = useCallback((dimension: string, value: any, currentPath: string[]) => {
    const newPath = [...currentPath, `${dimension}:${value}`];
    loadDrillDownData(dimension, value, newPath);
  }, [loadDrillDownData]);

  const handleDrillUp = useCallback((level: number) => {
    const newPath = drillDownPath.slice(0, level);
    if (newPath.length === 0) {
      setDrillDownData(null);
      setDrillDownPath([]);
    } else {
      const lastSegment = newPath[newPath.length - 1];
      const [dimension, value] = lastSegment.split(':');
      loadDrillDownData(dimension, value, newPath);
    }
  }, [drillDownPath, loadDrillDownData]);

  // Create custom report
  const createCustomReport = useCallback(async () => {
    if (selectedMetrics.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please select at least one metric',
        variant: 'destructive',
      });
      return;
    }

    const report: CustomReport = {
      id: `report_${Date.now()}`,
      name: `Custom Report ${new Date().toLocaleDateString()}`,
      description: `Report with ${selectedMetrics.length} metrics`,
      metrics: selectedMetrics,
      dimensions: selectedDimensions,
      filters: {},
      chartType: 'bar',
      dateRange,
      createdAt: new Date().toISOString()
    };

    setCustomReports(prev => [...prev, report]);

    toast({
      title: 'Report Created',
      description: 'Custom report has been saved successfully',
    });
  }, [selectedMetrics, selectedDimensions, dateRange, toast]);

  // Export report
  const exportReport = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const params = new URLSearchParams({
        metrics: selectedMetrics.join(','),
        dimensions: selectedDimensions.join(','),
        dateRange,
        format: 'csv'
      });

      const response = await fetch(`/api/reports/export?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to export report');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `custom-report-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Export Complete',
        description: 'Report has been downloaded successfully',
      });
    } catch (error) {
      console.error('Failed to export report:', error);
      toast({
        title: 'Export Failed',
        description: 'Failed to export report data',
        variant: 'destructive',
      });
    }
  }, [selectedMetrics, selectedDimensions, dateRange, toast]);

  // Load initial data
  useEffect(() => {
    if (activeTab === 'overview') {
      loadDrillDownData('overview');
    }
  }, [activeTab, loadDrillDownData]);

  const renderMetricCard = (metric: ReportMetric) => (
    <Card key={metric.id} className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => handleDrillDown('metric', metric.id, drillDownPath)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{metric.name}</p>
            <p className="text-2xl font-bold">
              {metric.category === 'Financial' ? formatCurrency(metric.value) : metric.value}
            </p>
          </div>
          <div className={`flex items-center gap-1 ${
            metric.trend === 'up' ? 'text-green-600' :
            metric.trend === 'down' ? 'text-red-600' : 'text-gray-600'
          }`}>
            <TrendingUp className={`h-4 w-4 ${
              metric.trend === 'down' ? 'rotate-180' : ''
            }`} />
            <span className="text-sm">{Math.abs(metric.change)}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderDrillDownTable = (data: DrillDownData) => (
    <div className="space-y-4">
      {/* Breadcrumb navigation */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleDrillUp(0)}
          className="h-6 px-2"
        >
          Overview
        </Button>
        {drillDownPath.map((segment, index) => (
          <div key={index} className="flex items-center gap-2">
            <ChevronRight className="h-3 w-3" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDrillUp(index + 1)}
              className="h-6 px-2"
            >
              {segment}
            </Button>
          </div>
        ))}
      </div>

      {/* Current level metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {data.metrics.map(renderMetricCard)}
      </div>

      {/* Drill-down table */}
      {data.children && data.children.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Breakdown by {data.dimension}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{data.dimension}</TableHead>
                  {data.children[0]?.metrics.map(metric => (
                    <TableHead key={metric.id}>{metric.name}</TableHead>
                  ))}
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.children.map((child, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{child.value}</TableCell>
                    {child.metrics.map(metric => (
                      <TableCell key={metric.id}>
                        {metric.category === 'Financial' ? formatCurrency(metric.value) : metric.value}
                      </TableCell>
                    ))}
                    <TableCell>
                      {child.children && child.children.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDrillDown(data.dimension, child.value, drillDownPath)}
                        >
                          <ChevronRight className="h-4 w-4 mr-1" />
                          Drill Down
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Advanced Business Intelligence
          </div>
          <div className="flex items-center gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="1y">Last year</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportReport}>
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          </div>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Interactive drill-down reporting with custom report builder
        </p>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Executive Overview</TabsTrigger>
            <TabsTrigger value="drilldown">Interactive Drill-Down</TabsTrigger>
            <TabsTrigger value="builder">Report Builder</TabsTrigger>
            <TabsTrigger value="saved">Saved Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <div className="text-center">
                  <BarChart3 className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p>Loading executive metrics...</p>
                </div>
              </div>
            ) : drillDownData && drillDownPath.length === 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {drillDownData.metrics.map(renderMetricCard)}
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="drilldown" className="space-y-6">
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <div className="text-center">
                  <BarChart3 className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p>Loading drill-down data...</p>
                </div>
              </div>
            ) : drillDownData ? (
              renderDrillDownTable(drillDownData)
            ) : (
              <div className="text-center p-8 text-muted-foreground">
                Select a metric from the overview to start drilling down
              </div>
            )}
          </TabsContent>

          <TabsContent value="builder" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Metrics Selection */}
              <Card>
                <CardHeader>
                  <CardTitle>Select Metrics</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Choose the KPIs you want to analyze
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {availableMetrics.map(metric => (
                    <div key={metric.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={metric.id}
                        checked={selectedMetrics.includes(metric.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedMetrics(prev => [...prev, metric.id]);
                          } else {
                            setSelectedMetrics(prev => prev.filter(m => m !== metric.id));
                          }
                        }}
                      />
                      <Label htmlFor={metric.id} className="text-sm">
                        {metric.name}
                        <Badge variant="outline" className="ml-2 text-xs">
                          {metric.category}
                        </Badge>
                      </Label>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Dimensions Selection */}
              <Card>
                <CardHeader>
                  <CardTitle>Select Dimensions</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Choose how you want to break down the data
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {availableDimensions.map(dimension => (
                    <div key={dimension.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={dimension.id}
                        checked={selectedDimensions.includes(dimension.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedDimensions(prev => [...prev, dimension.id]);
                          } else {
                            setSelectedDimensions(prev => prev.filter(d => d !== dimension.id));
                          }
                        }}
                      />
                      <Label htmlFor={dimension.id} className="text-sm">
                        {dimension.name}
                        <Badge variant="outline" className="ml-2 text-xs">
                          {dimension.category}
                        </Badge>
                      </Label>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      Selected: {selectedMetrics.length} metrics, {selectedDimensions.length} dimensions
                    </p>
                  </div>
                  <Button onClick={createCustomReport} disabled={selectedMetrics.length === 0}>
                    <Plus className="h-4 w-4 mr-1" />
                    Create Report
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="saved" className="space-y-6">
            <div className="grid gap-4">
              {customReports.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4" />
                  <p>No saved reports yet</p>
                  <p className="text-sm">Create custom reports using the Report Builder tab</p>
                </div>
              ) : (
                customReports.map(report => (
                  <Card key={report.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">{report.name}</h3>
                          <p className="text-sm text-muted-foreground">{report.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline">{report.dateRange}</Badge>
                            <Badge variant="secondary">{report.metrics.length} metrics</Badge>
                            <Badge variant="secondary">{report.dimensions.length} dimensions</Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm">
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button variant="outline" size="sm">
                            <Download className="h-4 w-4 mr-1" />
                            Run
                          </Button>
                          <Button variant="outline" size="sm" className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}</content>
<parameter name="filePath">C:\Users\V COMPUTER\Documents\dakdampostgre-devcg\dakdampostgre-devcg\src\components\admin\dashboard\enhanced-reporting-dashboard.tsx