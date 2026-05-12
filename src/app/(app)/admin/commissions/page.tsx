
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { runCommissionCycle } from '@/services/server-actions';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlayCircle, Settings, DollarSign, Users, TrendingUp, RefreshCw, ChevronLeft, ChevronRight, Filter, ChevronUp, ChevronDown, X, Calendar as CalendarIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle } from 'lucide-react';
import { useI18n } from '@/lib/internationalization';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, cn } from '@/lib/utils';
import type { Commission } from '@/lib/types';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';

export default function CommissionAdminPage() {
    const { t } = useI18n();
    const [isLoading, setIsLoading] = useState(false);
    const [lastResult, setLastResult] = useState<{count: number, total: number} | null>(null);
    const [commissions, setCommissions] = useState<Commission[]>([]);
    const [loadingCommissions, setLoadingCommissions] = useState(true);
    const [stats, setStats] = useState({ total: 0, approved: 0, pending: 0, totalAmount: 0 });
    const [showFilters, setShowFilters] = useState(false);
    const [filterType, setFilterType] = useState('all');
    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
        from: undefined,
        to: undefined,
    });
    const [currentPage, setCurrentPage] = useState(0);
    const pageSize = 15;
    const { toast } = useToast();

    const formatDateRange = (from: Date | undefined, to: Date | undefined): string => {
        if (!from && !to) return '';
        if (from && !to) return format(from, 'MMM dd, yyyy');
        if (!from && to) return format(to, 'MMM dd, yyyy');
        if (from && to) {
            if (from.getTime() === to.getTime()) return format(from, 'MMM dd, yyyy');
            return `${format(from, 'MMM dd, yyyy')} - ${format(to, 'MMM dd, yyyy')}`;
        }
        return '';
    };

    const filteredCommissions = commissions.filter((c) => {
        if (filterType !== 'all') {
            const type = String(c.type || '').toLowerCase();
            const match = filterType.toLowerCase();
            if (!type.includes(match)) return false;
        }
        if (dateRange.from || dateRange.to) {
            const d = new Date(c.date);
            if (dateRange.from && d < dateRange.from) return false;
            if (dateRange.to) {
                const toEnd = new Date(dateRange.to);
                toEnd.setHours(23, 59, 59, 999);
                if (d > toEnd) return false;
            }
        }
        return true;
    });
    const paginatedCommissions = filteredCommissions.slice(
        currentPage * pageSize,
        (currentPage + 1) * pageSize
    );

    const fetchAllCommissions = async () => {
        setLoadingCommissions(true);
        try {
            const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
            if (!token) {
                setCommissions([]);
                setLoadingCommissions(false);
                return;
            }

            // Fetch ALL commissions (no userId filter) for admin to see all members' commissions
            const response = await fetch('/api/commissions?limit=1000', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                const commissionsData = data?.data ?? data ?? [];
                const commissionsArray = Array.isArray(commissionsData) ? commissionsData : [];
                setCommissions(commissionsArray);
                setCurrentPage(0); // Reset pagination on refresh

                // Calculate stats
                const total = commissionsArray.length;
                const approved = commissionsArray.filter((c: Commission) => c.status === 'Paid').length;
                const pending = commissionsArray.filter((c: Commission) => c.status === 'Pending').length;
                const totalAmount = commissionsArray.reduce((sum: number, c: Commission) => sum + c.amount, 0);
                setStats({ total, approved, pending, totalAmount });
            }
        } catch (error) {
            console.error('Failed to fetch commissions:', error);
        } finally {
            setLoadingCommissions(false);
        }
    };

    useEffect(() => {
        fetchAllCommissions();
    }, []);

    const handleRunCommissions = async () => {
        setIsLoading(true);
        setLastResult(null);
        try {
            // Show initial toast
            toast({
                title: 'Starting Commission Cycle',
                description: 'Processing commissions for all active members. This may take a few minutes...',
            });

            const result = await runCommissionCycle();
            const formattedResult = {
                count: result?.count ?? 0,
                total: result?.total ?? 0
            };
            setLastResult(formattedResult);
            
            if (formattedResult.count > 0) {
                toast({
                    title: t('admin.commission.success'),
                    description: t('admin.commission.successDesc', { 
                        count: String(formattedResult.count), 
                        total: formattedResult.total.toFixed(2) 
                    }),
                });
            } else {
                toast({
                    title: 'No Commissions Generated',
                    description: 'No new commissions were calculated. Members may not meet qualification requirements or commissions already exist for this period.',
                    variant: 'default',
                });
            }
            // Refresh commissions after running cycle
            fetchAllCommissions();
        } catch (error) {
            console.error('Failed to run commission cycle:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            toast({
                variant: 'destructive',
                title: t('admin.commission.error'),
                description: `${t('admin.commission.errorDesc')} Error: ${errorMessage}`,
            });
        } finally {
            setIsLoading(false);
        }
    };
    
    const getResultDescription = () => {
        if (!lastResult) return '';
        const text = t('admin.commission.cycleCompleteDesc', { count: String(lastResult.count), total: lastResult.total.toFixed(2) });
        const parts = text.split(/(<span.*<\/span>)/);
        return parts.map((part, index) => {
            if (part.startsWith('<span')) {
                const value = part.replace(/<\/?span[^>]*>/g, '');
                return <span key={index} className="font-bold">{value}</span>
            }
            return part;
        });
    }

    return (
        <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
            {/* Statistics Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Commissions</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total}</div>
                        <p className="text-xs text-muted-foreground">All commission records</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(stats.totalAmount)}</div>
                        <p className="text-xs text-muted-foreground">Sum of all commissions</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Approved</CardTitle>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
                        <p className="text-xs text-muted-foreground">Approved & Paid</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending</CardTitle>
                        <TrendingUp className="h-4 w-4 text-yellow-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
                        <p className="text-xs text-muted-foreground">Awaiting approval</p>
                    </CardContent>
                </Card>
            </div>

            {/* Run Commission Cycle Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Settings />
                        {t('admin.commission.title')}
                    </CardTitle>
                    <CardDescription>
                        {t('admin.commission.description')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        {t('admin.commission.warning')}
                    </p>
                    <div className="flex gap-2">
                        <Button 
                            onClick={handleRunCommissions} 
                            disabled={isLoading}
                            className="flex-1"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {t('admin.commission.calculating')}
                                </>
                            ) : (
                                <>
                                    <PlayCircle className="mr-2 h-4 w-4" />
                                    {t('admin.commission.runButton')}
                                </>
                            )}
                        </Button>
                        <Button 
                            onClick={fetchAllCommissions} 
                            disabled={loadingCommissions}
                            variant="outline"
                        >
                            <RefreshCw className={`h-4 w-4 ${loadingCommissions ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                    {lastResult && (
                        <Alert variant="default" className="bg-green-50 border-green-200">
                            <CheckCircle className="h-4 w-4" />
                            <AlertTitle className="text-green-800">{t('admin.commission.cycleComplete')}</AlertTitle>
                            <AlertDescription className="text-green-700">
                                {getResultDescription()}
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {/* All Commissions Table */}
            <Card>
                <CardHeader className="pb-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="text-xl">All Commissions</CardTitle>
                            <CardDescription>
                                View all commission records from all members and admin stock
                            </CardDescription>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowFilters(!showFilters)}
                            className="whitespace-nowrap"
                        >
                            <Filter className="h-4 w-4 mr-2" />
                            Filters
                            {showFilters ? (
                                <ChevronUp className="h-4 w-4 ml-2" />
                            ) : (
                                <ChevronDown className="h-4 w-4 ml-2" />
                            )}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Filters - collapsible panel (E-cash style) */}
                    {showFilters && (
                        <div className="mb-6 flex flex-col sm:flex-row gap-4 p-4 bg-muted/50 rounded-lg border">
                            <div className="flex items-center gap-2">
                                <Filter className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">Filters</span>
                            </div>

                            <div className="flex-1 min-w-[200px]">
                                <Select
                                    value={filterType}
                                    onValueChange={(v) => {
                                        setFilterType(v);
                                        setCurrentPage(0);
                                    }}
                                    disabled={loadingCommissions}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="All types" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All types</SelectItem>
                                        <SelectItem value="Binary Bonus">Binary Bonus</SelectItem>
                                        <SelectItem value="Matching Bonus">Matching Bonus</SelectItem>
                                        <SelectItem value="Daily Match">Daily Match</SelectItem>
                                        <SelectItem value="Stockist Bonus">Stockist Bonus</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex-1 min-w-[250px]">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={cn(
                                                'w-full justify-start text-left font-normal',
                                                !dateRange.from && !dateRange.to && 'text-muted-foreground'
                                            )}
                                            disabled={loadingCommissions}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {dateRange.from || dateRange.to ? (
                                                formatDateRange(dateRange.from, dateRange.to)
                                            ) : (
                                                <span>Select date range</span>
                                            )}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            initialFocus
                                            mode="range"
                                            defaultMonth={dateRange.from}
                                            selected={dateRange}
                                            onSelect={(range) => {
                                                if (range) {
                                                    setDateRange({ from: range.from, to: range.to });
                                                    setCurrentPage(0);
                                                } else {
                                                    setDateRange({ from: undefined, to: undefined });
                                                }
                                            }}
                                            numberOfMonths={2}
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>

                            {(filterType !== 'all' || dateRange.from || dateRange.to) && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setFilterType('all');
                                        setDateRange({ from: undefined, to: undefined });
                                        setCurrentPage(0);
                                    }}
                                    className="whitespace-nowrap bg-red-500 text-white border-red-500 hover:bg-red-600 hover:text-white dark:bg-red-600 dark:text-white dark:border-red-600 dark:hover:bg-red-700 dark:hover:text-white"
                                    disabled={loadingCommissions}
                                >
                                    <X className="h-4 w-4 mr-2" />
                                    Clear
                                </Button>
                            )}
                        </div>
                    )}

                    {/* Filtered total display (E-cash style) */}
                    {(filterType !== 'all' || dateRange.from || dateRange.to) && (
                        <div className="mb-4 p-4 bg-gradient-to-r from-green-50 via-green-50/80 to-green-50 dark:from-green-950/30 dark:via-green-950/20 dark:to-green-950/30 border-2 border-green-200 dark:border-green-800 rounded-lg shadow-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-foreground">
                                    Filtered commission total:
                                </span>
                                <span className="text-xl font-bold text-green-600 dark:text-green-500">
                                    {formatCurrency(
                                        filteredCommissions.reduce((sum, c) => sum + parseFloat(String(c.amount || 0)), 0)
                                    )}
                                </span>
                            </div>
                            <p className="text-sm text-foreground/80 mt-2 font-medium">
                                Showing {filteredCommissions.length} commission{filteredCommissions.length !== 1 ? 's' : ''} matching your filters
                            </p>
                        </div>
                    )}

                    {loadingCommissions ? (
                        <div className="flex items-center justify-center h-32">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    ) : filteredCommissions.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <p className="text-base font-medium">No commission records found.</p>
                        </div>
                    ) : (
                        <>
                            <div className="rounded-lg border overflow-hidden shadow-sm">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-gradient-to-r from-muted/80 to-muted/60 border-b border-border/50">
                                            <TableHead className="font-semibold text-foreground py-4 px-6">Date</TableHead>
                                            <TableHead className="font-semibold text-foreground py-4 px-6">User ID</TableHead>
                                            <TableHead className="font-semibold text-foreground py-4 px-6">Type</TableHead>
                                            <TableHead className="font-semibold text-foreground py-4 px-6">Status</TableHead>
                                            <TableHead className="text-right font-semibold text-foreground py-4 px-6">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginatedCommissions.map((commission, index) => {
                                            const displayId = commission.memberId || commission.userId || '-';
                                            const type = String(commission.type || '');
                                            const status = String(commission.status || '');
                                            const amount = parseFloat(String(commission.amount || 0));
                                            return (
                                                <TableRow
                                                    key={commission.id}
                                                    className={cn(
                                                        'transition-colors hover:bg-muted/40 border-b border-border/30',
                                                        index % 2 === 0 ? 'bg-background' : 'bg-muted/10'
                                                    )}
                                                >
                                                    <TableCell className="font-medium py-4 px-6 text-sm text-foreground">
                                                        {new Date(commission.date).toLocaleDateString('en-US', {
                                                            year: 'numeric',
                                                            month: 'short',
                                                            day: 'numeric',
                                                        })}
                                                    </TableCell>
                                                    <TableCell className="py-4 px-6">
                                                        <span className="font-mono text-xs">{displayId}</span>
                                                    </TableCell>
                                                    <TableCell className="py-4 px-6">
                                                        <Badge
                                                            variant="secondary"
                                                            className={cn(
                                                                'font-medium text-xs px-2.5 py-1',
                                                                type.toLowerCase().includes('stockist') && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800',
                                                                type.toLowerCase().includes('binary') && 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800',
                                                                type.toLowerCase().includes('matching') && 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                                                            )}
                                                        >
                                                            {type}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="py-4 px-6">
                                                        <Badge variant={status === 'Paid' ? 'default' : 'secondary'}>
                                                            {status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right font-semibold py-4 px-6 text-green-600 dark:text-green-500">
                                                        <span className="text-lg font-bold">
                                                            {formatCurrency(amount)}
                                                        </span>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination - matching E-cash style */}
                            {filteredCommissions.length >= pageSize && (
                                <div className="flex items-center justify-between pt-6 mt-6 border-t border-border/50">
                                    <div className="text-sm text-muted-foreground font-medium">
                                        Showing <span className="text-foreground font-semibold">{Math.min(currentPage * pageSize + 1, filteredCommissions.length)}</span> to <span className="text-foreground font-semibold">{Math.min((currentPage + 1) * pageSize, filteredCommissions.length)}</span> of <span className="text-foreground font-semibold">{filteredCommissions.length}</span> commissions
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage((prev) => Math.max(0, prev - 1))}
                                            disabled={currentPage === 0}
                                            className="shadow-sm hover:shadow transition-shadow"
                                        >
                                            <ChevronLeft className="h-4 w-4 mr-1" />
                                            Previous
                                        </Button>
                                        <div className="text-sm font-medium text-foreground px-4 py-1.5 bg-muted/50 rounded-md min-w-[120px] text-center border border-border/30">
                                            Page <span className="font-semibold">{currentPage + 1}</span> of <span className="font-semibold">{Math.max(1, Math.ceil(filteredCommissions.length / pageSize))}</span>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage((prev) => Math.min(Math.ceil(filteredCommissions.length / pageSize) - 1, prev + 1))}
                                            disabled={currentPage >= Math.ceil(filteredCommissions.length / pageSize) - 1}
                                            className="shadow-sm hover:shadow transition-shadow"
                                        >
                                            Next
                                            <ChevronRight className="h-4 w-4 ml-1" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
