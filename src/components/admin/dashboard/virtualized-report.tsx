'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  FileText,
  Download,
  Filter,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';

interface ReportData {
  id: string;
  memberId: string;
  fullName: string;
  rank: string;
  totalEarnings: number;
  totalPV: number;
  joinDate: string;
  lastActivity: string;
  status: string;
}

interface VirtualizedReportProps {
  reportType: 'commission' | 'member-activity' | 'financial-summary';
  title: string;
}

export function VirtualizedReport({ reportType, title }: VirtualizedReportProps) {
  const [data, setData] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(50); // Items per page
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<string>('totalEarnings');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filters, setFilters] = useState<Record<string, any>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Load report data
  const loadReportData = useCallback(async (resetData = false) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const params = new URLSearchParams({
        type: reportType,
        page: resetData ? '0' : page.toString(),
        pageSize: pageSize.toString(),
        sortField,
        sortDirection,
        search: searchTerm,
        ...filters
      });

      const response = await fetch(`/api/reports/virtualized?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load report data');
      }

      const result = await response.json();

      if (resetData) {
        setData(result.data);
      } else {
        setData(prev => [...prev, ...result.data]);
      }

      setHasMore(result.hasMore);
      setTotalCount(result.totalCount);
    } catch (error) {
      console.error('Failed to load report:', error);
      toast({
        title: 'Error',
        description: 'Failed to load report data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [reportType, page, pageSize, sortField, sortDirection, searchTerm, filters, toast]);

  // Load next page
  const loadNextPage = useCallback(() => {
    if (!loading && hasMore) {
      setPage(prev => prev + 1);
    }
  }, [loading, hasMore]);

  // Handle sorting
  const handleSort = useCallback((field: string) => {
    const newDirection = sortField === field && sortDirection === 'desc' ? 'asc' : 'desc';
    setSortField(field);
    setSortDirection(newDirection);
    setPage(0);
    setData([]);
  }, [sortField, sortDirection]);

  // Handle search
  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
    setPage(0);
    setData([]);
  }, []);

  // Export report
  const exportReport = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const params = new URLSearchParams({
        type: reportType,
        format: 'csv',
        sortField,
        sortDirection,
        search: searchTerm,
        ...filters
      });

      const response = await fetch(`/api/reports/export?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to export report');
      }

      // Create download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportType}-report-${new Date().toISOString().split('T')[0]}.csv`;
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
  }, [reportType, sortField, sortDirection, searchTerm, filters, toast]);

  // Infinite scroll handler
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollTop + clientHeight >= scrollHeight - 100) { // 100px threshold
        loadNextPage();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [loadNextPage]);

  // Load data when dependencies change
  useEffect(() => {
    loadReportData(page === 0);
  }, [loadReportData, page]);

  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'default';
      case 'inactive':
        return 'secondary';
      case 'suspended':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const SortableHeader = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer hover:bg-muted/50 select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field && (
          <span className="text-xs">
            {sortDirection === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </div>
    </TableHead>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {title}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9 w-48"
              />
            </div>
            <Button variant="outline" size="sm" onClick={exportReport}>
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          </div>
        </CardTitle>
        <div className="text-sm text-muted-foreground">
          Showing {data.length} of {totalCount} records
        </div>
      </CardHeader>
      <CardContent>
        <div
          ref={containerRef}
          className="max-h-96 overflow-auto border rounded-md"
          style={{ height: '400px' }}
        >
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <SortableHeader field="memberId">Member ID</SortableHeader>
                <SortableHeader field="fullName">Name</SortableHeader>
                <SortableHeader field="rank">Rank</SortableHeader>
                <SortableHeader field="totalEarnings">Earnings</SortableHeader>
                <SortableHeader field="totalPV">PV</SortableHeader>
                <SortableHeader field="joinDate">Join Date</SortableHeader>
                <SortableHeader field="lastActivity">Last Activity</SortableHeader>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-sm">{row.memberId}</TableCell>
                  <TableCell className="font-medium">{row.fullName}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.rank}</Badge>
                  </TableCell>
                  <TableCell className="font-mono">
                    {formatCurrency(row.totalEarnings)}
                  </TableCell>
                  <TableCell className="font-mono">{row.totalPV}</TableCell>
                  <TableCell className="text-sm">
                    {new Date(row.joinDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(row.lastActivity).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(row.status)}>
                      {row.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {loading && (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading more data...</span>
            </div>
          )}

          {!hasMore && data.length > 0 && (
            <div className="text-center p-4 text-muted-foreground">
              End of results
            </div>
          )}

          {data.length === 0 && !loading && (
            <div className="text-center p-8 text-muted-foreground">
              No data available
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}</content>
<parameter name="filePath">C:\Users\V COMPUTER\Documents\dakdampostgre-devcg\dakdampostgre-devcg\src\components\admin\dashboard\virtualized-report.tsx