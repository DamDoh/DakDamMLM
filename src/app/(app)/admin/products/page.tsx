
'use client';

import * as React from 'react';
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Loader2, PlusCircle, Package, ArrowUpDown, MoreHorizontal } from 'lucide-react';
import type { Product } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import Image from 'next/image';
import { deleteProduct } from '@/services/product-service';
import ProductDialog from '@/components/admin/product-dialog';
import { useToast } from '@/hooks/use-toast';
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
import { useI18n } from '@/lib/internationalization';
import { useIsMobile } from '@/hooks/use-mobile';
import { Badge } from '@/components/ui/badge';


export default function AdminProductsPage() {
  const { t } = useI18n();
  const [data, setData] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});

  const [isProductDialogOpen, setProductDialogOpen] = React.useState(false);
  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null);

  const [isDeleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [deletingProductId, setDeletingProductId] = React.useState<string | null>(null);
  const [isCreatingStockistProducts, setIsCreatingStockistProducts] = React.useState(false);

  const { toast } = useToast();
  const isMobile = useIsMobile();

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/products');
      
      if (!response.ok) {
        // Try to get error message from response
        let errorMessage = `Failed to fetch products (${response.status})`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
      
      const raw = await response.json();
      
      // Handle different response formats
      let products = [];
      if (raw?.data) {
        // ApiResponseUtil format: { success: true, data: [...], pagination: {...} }
        products = Array.isArray(raw.data) ? raw.data : [];
      } else if (Array.isArray(raw)) {
        // Direct array format
        products = raw;
      } else {
        console.warn('Unexpected response format:', raw);
        products = [];
      }
      
      setData(products);
    } catch (error) {
      console.error("Failed to fetch products:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({ 
        variant: 'destructive', 
        title: t('admin.product.operationFailed'), 
        description: errorMessage || t('admin.product.operationFailedDesc', { operation: 'load' })
      });
      // Set empty array on error to prevent UI issues
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  
  React.useEffect(() => {
    if (isMobile) {
      setColumnVisibility({ description: false, price: false, qty: false, type: false });
    } else {
      setColumnVisibility({});
    }
  }, [isMobile]);

  const handleOpenEditDialog = (product: Product) => {
    setEditingProduct(product);
    setProductDialogOpen(true);
  };

  const handleOpenAddDialog = () => {
    setEditingProduct(null);
    setProductDialogOpen(true);
  };
  
  const handleOpenDeleteDialog = (productId: string) => {
    setDeletingProductId(productId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingProductId) return;

    try {
      await deleteProduct(deletingProductId);
      toast({ title: t('admin.product.deleteSuccess') });
      // Refresh the product list after successful deletion
      await fetchData();
    } catch (error: any) {
      console.error('Failed to delete product:', error);
      toast({ 
        variant: 'destructive', 
        title: t('admin.product.deleteFailed'),
        description: error.message || 'Failed to delete product. Please try again.'
      });
    } finally {
      setDeleteDialogOpen(false);
      setDeletingProductId(null);
    }
  };




  // Helper function to validate image URL
  const isValidImageUrl = (url: string | null | undefined): boolean => {
    if (!url) return false;
    // Check if it's a data URL
    if (url.startsWith('data:image/')) return true;
    // Check if it's an absolute URL
    if (url.startsWith('http://') || url.startsWith('https://')) return true;
    // Check if it's a relative path starting with /
    if (url.startsWith('/')) return true;
    return false;
  };

  const columns: ColumnDef<Product>[] = [
    {
      accessorKey: 'imageUrl',
      header: t('admin.product.image'),
      cell: ({ row }) => {
        const imageUrl = row.original.imageUrl;
        if (!imageUrl || !isValidImageUrl(imageUrl)) {
          return (
            <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center text-xs text-muted-foreground">
              N/A
            </div>
          );
        }
        
        // For data URLs, use regular img tag instead of Next.js Image
        if (imageUrl.startsWith('data:image/')) {
          return (
            <img
              src={imageUrl}
              alt={row.original.name}
              width={40}
              height={40}
              className="rounded-md object-cover"
              style={{ width: 40, height: 40 }}
            />
          );
        }
        
        return (
          <Image
            src={imageUrl}
            alt={row.original.name}
            width={40}
            height={40}
            className="rounded-md object-cover"
            unoptimized={imageUrl.startsWith('http://') || imageUrl.startsWith('https://')}
          />
        );
      },
      enableSorting: false,
    },
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          {t('admin.product.name')} <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <div className="pl-4 font-medium">{row.getValue('name')}</div>,
    },
    {
      accessorKey: 'description',
      header: t('admin.product.description'),
      cell: ({ row }) => <div className="line-clamp-2 text-sm text-muted-foreground">{row.getValue('description')}</div>,
    },
    {
      accessorKey: 'type',
      header: t('admin.product.type'),
      cell: ({ row }) => {
        const typeKey = row.original.type === 'package' ? 'admin.product.type.package' : 'admin.product.type.single';
        return (
          <Badge variant={row.original.type === 'package' ? 'default' : 'secondary'}>
            {t(typeKey)}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'price',
      header: () => <div className="text-right">{t('admin.product.price')}</div>,
      cell: ({ row }) => <div className="text-right">{formatCurrency(row.getValue('price'))}</div>,
    },
    {
      accessorKey: 'qty',
      header: () => <div className="text-right">{t('admin.product.qty')}</div>,
      cell: ({ row }) => <div className="text-right">{row.getValue('qty')}</div>,
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">{t('admin.openMenu')}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t('common.actions')}</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => handleOpenEditDialog(row.original)}>
              {t('admin.product.editTitle')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleOpenDeleteDialog(row.original.id)} className="text-destructive">
              {t('common.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
  });

  return (
    <>
      <ProductDialog
        isOpen={isProductDialogOpen}
        onOpenChange={setProductDialogOpen}
        onSuccess={fetchData}
        product={editingProduct}
      />
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.areYouSure')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.product.deleteConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <div className="flex-1 p-4 md:p-8 pt-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package /> {t('admin.product.title')}
                </CardTitle>
                <CardDescription>
                  {t('admin.product.description')}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleOpenAddDialog} icon={PlusCircle}>
                  {t('admin.product.addNew')}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center h-48">
                <Loader2 className="animate-spin" />
              </div>
            ) : (
              <div className="w-full">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                          {headerGroup.headers.map((header) => (
                            <TableHead key={header.id}>
                              {header.isPlaceholder
                                ? null
                                : flexRender(
                                    header.column.columnDef.header,
                                    header.getContext()
                                  )}
                            </TableHead>
                          ))}
                        </TableRow>
                      ))}
                    </TableHeader>
                    <TableBody>
                      {table.getRowModel().rows?.length ? (
                        table.getRowModel().rows.map((row) => (
                          <React.Fragment key={row.id}>
                            <TableRow data-state={row.getIsSelected() && 'selected'}>
                              {row.getVisibleCells().map((cell) => (
                                <TableCell key={cell.id}>
                                  {flexRender(
                                    cell.column.columnDef.cell,
                                    cell.getContext()
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                            {isMobile && (
                                <TableRow>
                                <TableCell colSpan={columns.length} className="p-0">
                                    <div className="p-2 bg-muted/50 text-xs space-y-1">
                                        <div className="flex justify-between">
                                            <span className="font-bold">{t('admin.product.price')}:</span>
                                            <span>{formatCurrency(row.original.price)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="font-bold">{t('admin.product.qty')}:</span>
                                            <span>{row.original.qty}</span>
                                        </div>
                                         <div className="flex justify-between">
                                            <span className="font-bold">{t('admin.product.type')}:</span>
                                            <span className="capitalize">{row.original.type}</span>
                                        </div>
                                        <p className="line-clamp-2"><span className="font-bold">{t('admin.product.description')}:</span> {row.original.description}</p>
                                    </div>
                                </TableCell>
                                </TableRow>
                            )}
                          </React.Fragment>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={columns.length}
                            className="h-24 text-center"
                          >
                            {t('admin.product.noProducts')}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-center justify-end space-x-2 py-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    {t('common.previous')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    {t('common.next')}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
