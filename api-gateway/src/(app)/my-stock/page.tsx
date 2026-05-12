
'use client';

import * as React from 'react';
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';

import { Button } from '@/components/ui/button';
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
import { Loader2, Package, ShoppingCart, ArrowRightLeft, ArrowUpDown } from 'lucide-react';
import type { Product, StockItem, Member } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/internationalization';
import { useGenealogyContext } from '@/context/genealogy-context';
import SellStockDialog from '@/components/stockist/sell-stock-dialog';
import RequestStockDialog from '@/components/stockist/request-stock-dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import placeholderData from '@/lib/placeholder-images.json';

type ProductWithStock = Product & {
    stock: StockItem;
};

const imageMap = new Map(placeholderData.images.map(img => [img.id, img]));


export default function MyStockPage() {
  const { t } = useI18n();
  const context = useGenealogyContext();
  const { rootMember, loading: contextLoading, allMembersMap, refreshData } = context || { rootMember: null, loading: true, allMembersMap: new Map(), refreshData: async () => {} };

  const [products, setProducts] = React.useState<Product[]>([]);
  const [inventory, setInventory] = React.useState<Map<string, StockItem>>(new Map());
  const [data, setData] = React.useState<ProductWithStock[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const [isSellDialogOpen, setSellDialogOpen] = React.useState(false);
  const [isRequestDialogOpen, setRequestDialogOpen] = React.useState(false);
  const [selectedProduct, setSelectedProduct] = React.useState<ProductWithStock | null>(null);
  const [columnVisibility, setColumnVisibility] = React.useState({});

  const isMobile = useIsMobile();
  const { toast } = useToast();

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/products');
      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }
      const fetchedProducts = await response.json();
      setProducts(fetchedProducts);
    } catch (error) {
      console.error("Failed to fetch products:", error);
      toast({ variant: 'destructive', title: 'Failed to load stock', description: 'Could not load your inventory data.' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    if (!contextLoading) {
        fetchData();
    }
  }, [fetchData, contextLoading]);
  
  React.useEffect(() => {
      if (!rootMember) return;

      const fetchInventory = async () => {
        try {
          const response = await fetch(`/api/inventory?userId=${rootMember.id}`);
          if (!response.ok) {
            throw new Error('Failed to fetch inventory');
          }

          const inventoryItems = await response.json();

          const newInventory = new Map<string, StockItem>();
          inventoryItems.forEach((item: any) => {
            newInventory.set(item.productId, item);
          });
          setInventory(newInventory);
        } catch (error) {
          console.error('Failed to fetch inventory:', error);
        }
      };

      fetchInventory();
  }, [rootMember]);

  React.useEffect(() => {
      const stockData: ProductWithStock[] = products.map(p => ({
        ...p,
        stock: inventory.get(p.id) || {
            productId: p.id,
            productName: p.name,
            quantity: 0,
            lastUpdated: new Date().toISOString()
        }
      }));
      setData(stockData);
  }, [products, inventory]);

  React.useEffect(() => {
    if (isMobile) {
      setColumnVisibility({ price: false });
    } else {
      setColumnVisibility({});
    }
  }, [isMobile]);

  const handleOpenSellDialog = (product: ProductWithStock) => {
    setSelectedProduct(product);
    setSellDialogOpen(true);
  };
  
  const downlineMembers = React.useMemo(() => {
    if (!rootMember) return [];
    // A simple way to get direct downline for now.
    // In a real app, this might be a recursive function or a flattened list.
    const downline: Member[] = [];
    const queue = [rootMember.id];
    const visited = new Set([rootMember.id]);

    while (queue.length > 0) {
        const currentId = queue.shift()!;
        const member = allMembersMap.get(currentId);
        if (member) {
            if (member.children.left && !visited.has(member.children.left)) {
                const child = allMembersMap.get(member.children.left);
                if(child) {
                  downline.push(child);
                  queue.push(child.id);
                  visited.add(child.id);
                }
            }
            if (member.children.right && !visited.has(member.children.right)) {
                 const child = allMembersMap.get(member.children.right);
                 if(child) {
                  downline.push(child);
                  queue.push(child.id);
                  visited.add(child.id);
                }
            }
        }
    }
    return downline;
  }, [rootMember, allMembersMap]);

  const columns: ColumnDef<ProductWithStock>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          {t('product.addProduct')}
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
             <Image 
                src={imageMap.get(row.original.imageUrl)?.imageUrl || row.original.imageUrl} 
                alt={row.original.name} 
                width={40} 
                height={40} 
                className="rounded-md object-cover"
            />
            <div className="pl-4 font-medium">{row.getValue('name')}</div>
        </div>
      ),
    },
    {
      accessorKey: 'stock.quantity',
      header: () => <div className="text-right">{t('stockist.myStock.quantity')}</div>,
      cell: ({ row }) => <div className="text-right font-bold text-lg">{row.original.stock.quantity}</div>,
    },
    {
      accessorKey: 'price',
      header: () => <div className="text-right">{t('admin.product.price')}</div>,
      cell: ({ row }) => <div className="text-right">{formatCurrency(row.getValue('price'))}</div>,
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="text-right">
          <Button variant="ghost" size="sm" onClick={() => handleOpenSellDialog(row.original)} icon={ShoppingCart}>
            {t('stockist.myStock.sell')}
          </Button>
        </div>
      ),
    },
  ];

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnVisibility,
    },
  });

  return (
    <>
      {selectedProduct && rootMember && (
        <SellStockDialog
          isOpen={isSellDialogOpen}
          onOpenChange={setSellDialogOpen}
          product={selectedProduct}
          stockist={rootMember}
          downline={downlineMembers}
          onSuccess={() => { if(refreshData) refreshData(); }}
        />
      )}
       {rootMember && (
          <RequestStockDialog
            isOpen={isRequestDialogOpen}
            onOpenChange={setRequestDialogOpen}
            stockist={rootMember}
            availableProducts={products}
          />
       )}
      <div className="flex-1 p-4 md:p-8 pt-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package /> {t('stockist.myStock.title')}
                </CardTitle>
                <CardDescription>
                  {t('stockist.myStock.description')}
                </CardDescription>
              </div>
              <Button icon={ArrowRightLeft} onClick={() => setRequestDialogOpen(true)}>
                {t('stockist.myStock.requestButton')}
              </Button>
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
                          <TableRow key={row.id}>
                            {row.getVisibleCells().map((cell) => (
                              <TableCell key={cell.id}>
                                {flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext()
                                )}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={columns.length}
                            className="h-24 text-center"
                          >
                            {t('stockist.myStock.noProducts')}
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
