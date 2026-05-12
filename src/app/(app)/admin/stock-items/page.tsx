'use client';

import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { stockistLevelNames, stockistLevelCommissions } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Package, Search, Plus, Trash2, AlertTriangle, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { useI18n } from '@/lib/internationalization';

interface StockItem {
  id: string;
  productId?: string;
  name?: string;
  price?: number;
  pv?: number;
  category?: string;
  description?: string;
  quantity: number;
  lastUpdated: string;
  company?: {
    id: string;
    name: string;
  };
  product?: {
    id: string;
    name: string;
    price: number;
    category: string;
  };
}

export default function StockItemsPage() {
  const { toast } = useToast();
  const { t } = useI18n();

  const [stockItems, setStockItems] = React.useState<StockItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [selectedStockItem, setSelectedStockItem] = React.useState<StockItem | null>(null);
  const [products, setProducts] = React.useState<any[]>([]);

  // Form states
  const [productName, setProductName] = React.useState('');
  const [productPrice, setProductPrice] = React.useState('');
  const [productPV, setProductPV] = React.useState('');
  const [productCategory, setProductCategory] = React.useState('Stock');
  const [selectedProductId, setSelectedProductId] = React.useState('');
  const [quantity, setQuantity] = React.useState('');
  const [stockistLevel, setStockistLevel] = React.useState<string>('');
  const [commissionRate, setCommissionRate] = React.useState<string>('');

  // Line items for multi-product stock entry
  const [lineItems, setLineItems] = React.useState<Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    pv: number;
    totalPV: number;
  }>>([]);

  // Quantity multiplier
  const [quantityMultiplier, setQuantityMultiplier] = React.useState('1');

  // Fetch stock items
  const fetchStockItems = React.useCallback(async () => {
    console.log('🔍 Starting fetchStockItems...');
    setLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      console.log('🔑 Token found:', !!token);

      if (!token) {
        console.log('❌ No token found, setting empty stock items');
        setStockItems([]);
        return;
      }

      console.log('📡 Fetching stock items from API...');
      const stockResponse = await fetch('/api/stock-items', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('📊 Stock response status:', stockResponse.status);

      if (!stockResponse.ok) {
        console.error('❌ Stock response not OK:', stockResponse.status, stockResponse.statusText);
        throw new Error(`Failed to fetch stock items: ${stockResponse.statusText}`);
      }

      const stockData = await stockResponse.json();
      console.log('📦 Stock data received:', stockData);

      const stockItemsArray = stockData.data || stockData || [];
      console.log('📋 Stock items array:', stockItemsArray.length, 'items');

      // Stock items now have their own name, price, and category fields
      // No need to fetch products separately
      // IMPORTANT: Preserve all fields including stockistLevel
      const itemsWithProducts = stockItemsArray.map((item: any) => ({
        ...item,
        // Explicitly preserve stockistLevel field
        stockistLevel: item.stockistLevel || item.stockist_level || null,
        product: {
          name: item.name,
          price: item.price,
          category: item.category || 'Stock'
        }
      }));

      console.log('✅ Final items:', itemsWithProducts.length);
      setStockItems(itemsWithProducts);
    } catch (error) {
      console.error('❌ fetchStockItems error:', error);
      setStockItems([]);
    } finally {
      setLoading(false);
      console.log('🏁 fetchStockItems completed');
    }
  }, []);

  // Fetch products from catalog
  const fetchProducts = React.useCallback(async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) return;

      const response = await fetch('/api/products', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProducts(data.data || data || []);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  }, []);

  React.useEffect(() => {
    fetchStockItems();
    fetchProducts();
  }, [fetchStockItems, fetchProducts]);

  // Handle product selection
  // Note: Stock name is ALWAYS generated from Stockist Level, NOT from selected product
  const handleProductSelect = (productId: string) => {
    setSelectedProductId(productId);
    const product = products.find(p => p.id === productId);
    if (product) {
      // DO NOT set productName here - it should always come from Stockist Level
      // Only set price, PV, and category for calculations
      setProductPrice(product.price.toString());
      setProductPV(product.pv.toString());
      setProductCategory(product.category);
    }
  };

  // Add product to line items
  const handleAddLineItem = () => {
    if (!selectedProductId || !quantity || parseInt(quantity) <= 0) {
      toast({
        title: 'Validation Error',
        description: 'Please select a product and enter a valid quantity',
        variant: 'destructive',
      });
      return;
    }

    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;

    const qty = parseInt(quantity);
    const totalPV = product.pv * qty;

    const newLineItem = {
      productId: product.id,
      productName: product.name,
      quantity: qty,
      unitPrice: product.price,
      pv: product.pv,
      totalPV: totalPV
    };

    setLineItems([...lineItems, newLineItem]);

    // Reset selection (but keep stock name - it comes from stockist level)
    setSelectedProductId('');
    setQuantity('');
    // DO NOT reset productName - it should always come from Stockist Level
    setProductPrice('');
    setProductPV('');
  };

  // Remove line item
  const handleRemoveLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  // Calculate total PV
  const calculateTotalPV = () => {
    return lineItems.reduce((sum, item) => sum + item.totalPV, 0);
  };

  // Calculate total price
  const calculateTotalPrice = () => {
    return lineItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  };

  // Auto-update Price and PV fields when line items change
  React.useEffect(() => {
    const totalPrice = calculateTotalPrice();
    const totalPV = calculateTotalPV();
    setProductPrice(totalPrice.toFixed(2));
    setProductPV(totalPV.toFixed(2));
  }, [lineItems]);

  // Update line item quantity
  const handleUpdateLineItemQty = (index: number, newQty: number) => {
    if (newQty <= 0) return;
    const updatedItems = [...lineItems];
    updatedItems[index].quantity = newQty;
    updatedItems[index].totalPV = updatedItems[index].pv * newQty;
    setLineItems(updatedItems);
  };

  // Apply stock quantity multiplier - this represents how many sets of stock to create
  const handleApplyMultiplier = () => {
    const stockQty = parseInt(quantityMultiplier);
    if (isNaN(stockQty) || stockQty <= 0) {
      toast({
        title: 'Invalid Stock Quantity',
        description: 'Please enter a valid number greater than 0',
        variant: 'destructive',
      });
      return;
    }

    // The multiplier represents the number of stock sets
    // Each product quantity stays the same, but we'll use this for the total stock quantity
    // The line items quantities represent the base quantities per stock set

    toast({
      title: 'Stock Quantity Set',
      description: `Creating ${stockQty} sets of this stock`,
    });
  };

  const handleCreateStock = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate that we have line items
    if (lineItems.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please add at least one product to create stock',
        variant: 'destructive',
      });
      return;
    }

    if (!stockistLevel || stockistLevel === 'none') {
      toast({
        title: 'Validation Error',
        description: 'Please select a stockist level',
        variant: 'destructive',
      });
      return;
    }

    // Ensure stockist level is selected
    if (!stockistLevel || stockistLevel === 'none' || !['S', 'M', 'C', 'D'].includes(stockistLevel)) {
      toast({
        title: 'Validation Error',
        description: 'Please select a stockist level (S, M, C, or D)',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    // Auto-generate stock name if not set
    if (!productName || productName.trim() === '') {
      const levelName = stockistLevelNames[stockistLevel as keyof typeof stockistLevelNames];
      setProductName(`${stockistLevel} (${levelName})`);
    }

    // Ensure products are added
    if (lineItems.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please add at least one product to create stock',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Create ONE stock item with combined totals
      const stockQty = parseInt(quantityMultiplier) || 1;
      const totalPrice = calculateTotalPrice();
      const totalPV = calculateTotalPV();

      // Create a summary of all products
      const productSummary = lineItems.map(item =>
        `${item.productName} (${item.quantity})`
      ).join(', ');

      // Final validation before sending
      if (!stockistLevel || !['S', 'M', 'C', 'D'].includes(stockistLevel)) {
        throw new Error('Stockist level is required and must be S, M, C, or D');
      }

      let finalProductName = productName;
      if (!finalProductName || finalProductName.trim() === '') {
        const levelName = stockistLevelNames[stockistLevel as keyof typeof stockistLevelNames];
        finalProductName = `${stockistLevel} (${levelName})`;
      }

      if (totalPrice <= 0) {
        throw new Error('Total price must be greater than 0. Please add products.');
      }

      const stockPayload = {
        name: finalProductName.trim(),
        price: totalPrice,
        pv: totalPV,
        quantity: stockQty, // This is the stock quantity (how many sets)
        category: productCategory || 'Stock',
        code: finalProductName.trim(),
        description: `Contains: ${productSummary}`,
        stockistLevel: stockistLevel, // Required: S, M, C, or D
        commissionRate: null // Always null - commission is based on stockist level, not custom rate
      };

      const stockResponse = await fetch('/api/stock-items', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(stockPayload),
      });

      if (!stockResponse.ok) {
        const errorData = await stockResponse.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.error || `Failed to create stock item (${stockResponse.status})`;
        throw new Error(errorMessage);
      }

      toast({
        title: 'Stock Item Created',
        description: `Created "${finalProductName}" with ${lineItems.length} products, Total PV: ${totalPV.toFixed(2)}`,
      });

      // Reset form
      setProductName('');
      setProductPrice('');
      setProductPV('');
      setProductCategory('Stock');
      setQuantity('');
      setLineItems([]);
      setSelectedProductId('');
      setStockistLevel('');
      setCommissionRate('');

      // Close dialog
      setIsCreateDialogOpen(false);

      // Refresh data
      fetchStockItems();
    } catch (error: any) {
      console.error('Failed to create stock items:', error);
      toast({
        title: 'Creation Failed',
        description: error.message || 'Failed to create stock items',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditStock = (stockItem: StockItem) => {
    setSelectedStockItem(stockItem);
    setProductPrice((stockItem as any).price?.toString() || stockItem.product?.price?.toString() || '');
    setProductPV((stockItem as any).pv?.toString() || '0');
    setProductCategory((stockItem as any).category || stockItem.product?.category || 'Stock');
    setQuantity(stockItem.quantity.toString());

    // Extract stockist level - check multiple possible field names
    const level = (stockItem as any).stockistLevel ||
      (stockItem as any).stockist_level ||
      (stockItem as any).storeOwnerLevel ||
      '';

    console.log('🔍 Editing stock item:', {
      stockItemId: stockItem.id,
      stockItemName: (stockItem as any).name,
      extractedLevel: level,
      fullStockItem: stockItem
    });

    // Set stockist level - ensure it's a valid value
    if (level && ['S', 'M', 'C', 'D'].includes(level)) {
      setStockistLevel(level);
      // ALWAYS generate stock name from stockist level, not from product
      const levelName = stockistLevelNames[level as keyof typeof stockistLevelNames];
      setProductName(`${level} (${levelName})`);
    } else {
      // If no valid level found, try to extract from stock name
      const stockName = (stockItem as any).name || '';
      const levelMatch = stockName.match(/^([SMCD])\s*\(/);
      if (levelMatch && levelMatch[1]) {
        const extractedLevel = levelMatch[1];
        setStockistLevel(extractedLevel);
        const levelName = stockistLevelNames[extractedLevel as keyof typeof stockistLevelNames];
        setProductName(`${extractedLevel} (${levelName})`);
      } else {
        setStockistLevel('');
        setProductName('');
      }
    }
    setCommissionRate(''); // Always empty - commission is auto from stockist level

    // Set the current stock quantity in the multiplier field
    setQuantityMultiplier(stockItem.quantity.toString());

    // Parse existing products from description if available
    const description = (stockItem as any).description || '';
    if (description.startsWith('Contains: ')) {
      // Try to reconstruct line items from description
      // Description format: "Contains: Product1 (qty1), Product2 (qty2)"
      const productsText = description.replace('Contains: ', '');
      const productEntries = productsText.split(', ');

      const reconstructedItems: Array<{
        productId: string;
        productName: string;
        quantity: number;
        unitPrice: number;
        pv: number;
        totalPV: number;
      }> = [];

      // For now, we can't perfectly reconstruct without product IDs
      // So we'll just show the current totals and let user add new products
      setLineItems([]);
    } else {
      setLineItems([]);
    }

    setSelectedProductId('');
    setIsEditDialogOpen(true);
  };

  const confirmEditStock = async () => {
    if (!selectedStockItem) return;

    // Validate stockist level is selected
    if (!stockistLevel || stockistLevel === 'none') {
      toast({
        title: 'Validation Error',
        description: 'Please select a stockist level',
        variant: 'destructive',
      });
      return;
    }

    // ALWAYS generate stock name from stockist level (never from product)
    const levelName = stockistLevelNames[stockistLevel as keyof typeof stockistLevelNames];
    const generatedStockName = `${stockistLevel} (${levelName})`;
    setProductName(generatedStockName);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }

      const stockQty = parseInt(quantityMultiplier) || 1;

      // Check if user added new products or just updating quantity
      if (lineItems.length > 0) {
        // User added new products - replace everything
        const totalPrice = calculateTotalPrice();
        const totalPV = calculateTotalPV();

        const productSummary = lineItems.map(item =>
          `${item.productName} (${item.quantity})`
        ).join(', ');

        const response = await fetch(`/api/stock-items?id=${selectedStockItem.id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: generatedStockName, // Always use stock name from stockist level
            price: totalPrice,
            pv: totalPV,
            category: productCategory,
            quantity: stockQty,
            description: `Contains: ${productSummary}`,
            stockistLevel: stockistLevel && stockistLevel !== 'none' ? stockistLevel : null,
            commissionRate: null // Always null - commission is based on stockist level, not custom rate
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update stock item');
        }

        toast({
          title: 'Stock Item Updated',
          description: `${generatedStockName} has been updated with ${lineItems.length} products, Total PV: ${totalPV.toFixed(2)}`,
        });
      } else {
        // User only updated quantity or name - keep existing products
        const updatePayload: any = {
          quantity: stockQty
        };

        // Always include the generated stock name from stockist level
        updatePayload.name = generatedStockName;

        const response = await fetch(`/api/stock-items?id=${selectedStockItem.id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatePayload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update stock quantity');
        }

        toast({
          title: 'Stock Quantity Updated',
          description: `${productName} quantity updated to ${stockQty} sets`,
        });
      }

      setIsEditDialogOpen(false);
      setSelectedStockItem(null);
      setProductName('');
      setProductPrice('');
      setProductPV('');
      setProductCategory('Stock');
      setQuantity('');
      setLineItems([]);
      setSelectedProductId('');
      setQuantityMultiplier('1');
      await fetchStockItems();
    } catch (error: any) {
      toast({
        title: 'Update Failed',
        description: error.message || 'An error occurred while updating the stock item',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteStock = (stockItem: StockItem) => {
    setSelectedStockItem(stockItem);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteStock = async () => {
    if (!selectedStockItem) return;

    console.log('🗑️ Starting delete for stock item:', selectedStockItem.id);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        console.error('❌ No auth token found');
        throw new Error('No authentication token found. Please log in again.');
      }

      console.log('✅ Auth token found, making delete request...');

      const deleteUrl = `/api/stock-items?id=${selectedStockItem.id}`;
      console.log('🔗 Delete URL:', deleteUrl);

      const response = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('📡 Response status:', response.status);
      console.log('📡 Response ok:', response.ok);

      if (!response.ok) {
        // Try to get error details from API response
        let errorMessage = 'Failed to delete stock item';
        let errorDetails = '';

        try {
          const errorData = await response.json();
          console.error('❌ API Error Response:', errorData);
          errorMessage = errorData.error || errorData.message || errorMessage;
          errorDetails = JSON.stringify(errorData, null, 2);
        } catch (e) {
          console.error('❌ Could not parse error response');
          // If JSON parsing fails, use status text
          errorMessage = `Delete failed: ${response.statusText} (${response.status})`;
        }

        console.error('❌ Delete failed with details:', errorDetails);
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('✅ Delete successful:', result);

      toast({
        title: 'Stock Item Deleted',
        description: `${selectedStockItem.product?.name || 'Product'} has been removed from inventory`,
      });

      // Close dialog and clear selection
      setIsDeleteDialogOpen(false);
      setSelectedStockItem(null);

      // Refresh the data
      console.log('🔄 Refreshing stock items...');
      await fetchStockItems();

    } catch (error: any) {
      console.error('❌ Delete error details:', {
        message: error.message,
        stack: error.stack,
        stockItemId: selectedStockItem?.id,
        productName: selectedStockItem?.product?.name
      });

      toast({
        title: 'Delete Failed',
        description: error.message || 'An error occurred while deleting the stock item',
        variant: 'destructive',
      });

      // Don't close dialog on error so user can try again
    }
  };

  const columns: ColumnDef<StockItem>[] = [
    {
      accessorKey: 'product.name',
      header: t('stockItems.table.header.stockName'),
      cell: ({ row }) => {
        const product = row.original.product;
        return (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-muted rounded-md flex items-center justify-center">
              <Package className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">{product?.name || t('stockItems.table.unknownProduct')}</p>
              <p className="text-xs text-muted-foreground">{product?.category}</p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'product.price',
      header: t('stockItems.table.header.unitPrice'),
      cell: ({ row }) => {
        const price = row.original.product?.price;
        return price ? formatCurrency(price) : '-';
      },
    },
    {
      accessorKey: 'product.pv',
      header: 'PV',
      cell: ({ row }) => {
        const pv = (row.original as any).pv || 0;
        return (
          <div className="font-medium text-blue-600">
            {pv.toFixed(2)} PV
          </div>
        );
      },
    },
    {
      accessorKey: 'quantity',
      header: t('stockItems.table.header.quantity'),
      cell: ({ row }) => {
        const quantity = row.original.quantity;
        return (
          <Badge
            variant={quantity > 10 ? "default" : quantity > 0 ? "secondary" : "destructive"}
            className="font-mono"
          >
            {quantity}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'totalValue',
      header: t('stockItems.table.header.totalValue'),
      cell: ({ row }) => {
        const quantity = row.original.quantity;
        const price = row.original.product?.price;
        const totalValue = quantity && price ? quantity * price : 0;
        return (
          <div className="font-medium">
            {formatCurrency(totalValue)}
          </div>
        );
      },
    },
    {
      accessorKey: 'lastUpdated',
      header: t('stockItems.table.header.lastUpdated'),
      cell: ({ row }) => {
        const date = new Date(row.original.lastUpdated);
        return (
          <div className="text-sm text-muted-foreground">
            {date.toLocaleDateString()}
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: t('stockItems.table.header.actions'),
      cell: ({ row }) => {
        const stockItem = row.original;
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleEditStock(stockItem)}
              className="bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200 hover:border-blue-300"
            >
              <Edit className="h-4 w-4 mr-1" />
              {t('stockItems.button.edit')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleDeleteStock(stockItem)}
              className="bg-red-50 hover:bg-red-100 text-red-600 border-red-200 hover:border-red-300"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {t('stockItems.button.delete')}
            </Button>
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: stockItems,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      globalFilter: filter,
    },
    onGlobalFilterChange: setFilter,
  });

  const totalItems = stockItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = stockItems.reduce((sum, item) => {
    return sum + (item.quantity * (item.product?.price || 0));
  }, 0);

  return (
    <>
      {/* Create Stock Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              {t('stockItems.createDialog.title')}
            </DialogTitle>
            <DialogDescription>
              {t('stockItems.createDialog.description')}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateStock} className="space-y-4">
            {/* Stockist Level - Required, auto-generates stock name */}
            <div className="space-y-2">
              <Label htmlFor="stockistLevel">{t('stockItems.form.stockistLevel')} <span className="text-red-500">*</span></Label>
              <Select
                value={stockistLevel || undefined}
                onValueChange={(value) => {
                  setStockistLevel(value === 'none' ? '' : value);
                  // Auto-generate stock name based on selected level
                  if (value && value !== 'none') {
                    const levelName = stockistLevelNames[value as keyof typeof stockistLevelNames];
                    setProductName(`${value} (${levelName})`);
                  } else {
                    setProductName('');
                  }
                }}
                required
              >
                <SelectTrigger id="stockistLevel">
                  <SelectValue placeholder={t('stockItems.form.stockistLevelPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="S">{t('stockItems.form.stockistLevelS')}</SelectItem>
                  <SelectItem value="M">{t('stockItems.form.stockistLevelM')}</SelectItem>
                  <SelectItem value="C">{t('stockItems.form.stockistLevelC')}</SelectItem>
                  <SelectItem value="D">{t('stockItems.form.stockistLevelD')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t('stockItems.form.stockNameAutoGenerated')}
              </p>
            </div>

            {/* Auto-generated Stock Name (Read-only) */}
            {stockistLevel && stockistLevel !== 'none' && (
              <div className="space-y-2">
                <Label htmlFor="productName">{t('stockItems.form.stockNameAutoGeneratedLabel')}</Label>
                <Input
                  id="productName"
                  value={productName}
                  readOnly
                  className="bg-gray-100 font-semibold"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="productPrice">{t('stockItems.form.totalPrice')}</Label>
              <Input
                id="productPrice"
                type="number"
                value={productPrice}
                readOnly
                className="bg-gray-100 font-semibold"
                placeholder={t('stockItems.form.totalPricePlaceholder')}
              />
              <p className="text-xs text-muted-foreground">{t('stockItems.form.totalPriceDesc')}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="productPV">{t('stockItems.form.totalPV')}</Label>
              <Input
                id="productPV"
                type="number"
                value={productPV}
                readOnly
                className="bg-gray-100 font-semibold"
                placeholder={t('stockItems.form.totalPVPlaceholder')}
              />
              <p className="text-xs text-muted-foreground">{t('stockItems.form.totalPVDesc')}</p>
            </div>

            {/* Auto-display Commission Rate based on Stockist Level */}
            {stockistLevel && stockistLevel !== 'none' && (
              <div className="space-y-2">
                <Label htmlFor="commissionRate">{t('stockItems.form.commissionRate')}</Label>
                <Input
                  id="commissionRate"
                  type="text"
                  value={`${stockistLevelCommissions[stockistLevel as keyof typeof stockistLevelCommissions]}%`}
                  readOnly
                  className="bg-blue-50 font-semibold text-blue-700 border-blue-200"
                />
                <p className="text-xs text-muted-foreground">
                  {t('stockItems.form.commissionRateDesc')}
                </p>
              </div>
            )}

            {/* Product Selection Section */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <h3 className="font-semibold mb-3">{t('stockItems.form.addProductsToStock')}</h3>

              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="col-span-2">
                  <Label htmlFor="productSelect">{t('stockItems.form.selectProduct')}</Label>
                  <select
                    id="productSelect"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={selectedProductId}
                    onChange={(e) => handleProductSelect(e.target.value)}
                  >
                    <option value="">{t('stockItems.form.selectProductPlaceholder')}</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} - ${product.price} (PV: {product.pv})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="quantity">{t('stockItems.form.quantityLabel')}</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    placeholder={t('stockItems.form.quantityPlaceholder')}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </div>
              </div>

              <Button
                type="button"
                onClick={handleAddLineItem}
                className="w-full"
                variant="outline"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('stockItems.form.addProduct')}
              </Button>
            </div>

            {/* Line Items Table */}
            {lineItems.length > 0 && (
              <div className="space-y-4">
                {/* Stock Quantity */}
                <div className="border rounded-lg p-4 bg-green-50 border-green-200">
                  <h3 className="font-semibold text-green-900 mb-3">{t('stockItems.form.stockQuantity')}</h3>
                  <div className="flex gap-3 items-end">
                    <div className="flex-1">
                      <Label htmlFor="multiplier">{t('stockItems.form.howManySets')}</Label>
                      <Input
                        id="multiplier"
                        type="number"
                        min="1"
                        step="1"
                        value={quantityMultiplier}
                        onChange={(e) => setQuantityMultiplier(e.target.value)}
                        placeholder={t('stockItems.form.howManySetsPlaceholder')}
                        className="bg-white"
                      />
                      <p className="text-xs text-green-700 mt-1">
                        {t('stockItems.form.howManySetsDesc')}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 p-3 bg-white rounded border border-green-300">
                    <p className="text-sm text-green-900">
                      <strong>{t('stockItems.form.stockQuantityDisplay', { qty: String(quantityMultiplier || 1) })}</strong>
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      {t('stockItems.form.stockQuantityDesc')}
                    </p>
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('stockItems.form.table.product')}</TableHead>
                        <TableHead className="text-center">{t('stockItems.form.table.qty')}</TableHead>
                        <TableHead className="text-right">{t('stockItems.form.table.pricePerUnit')}</TableHead>
                        <TableHead className="text-right">{t('stockItems.form.table.pvPerUnit')}</TableHead>
                        <TableHead className="text-right">{t('stockItems.form.table.totalPV')}</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineItems.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{item.productName}</TableCell>
                          <TableCell className="text-center">
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleUpdateLineItemQty(index, parseInt(e.target.value))}
                              className="w-16 text-center"
                            />
                          </TableCell>
                          <TableCell className="text-right">${item.unitPrice.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{item.pv.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-semibold">{item.totalPV.toFixed(2)}</TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveLineItem(index)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Total PV Display */}
                  <div className="bg-blue-50 p-4 border-t">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-lg">{t('stockItems.form.totalPVDisplay')}</span>
                      <span className="font-bold text-2xl text-blue-600">{calculateTotalPV().toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
                disabled={loading}
              >
                {t('stockItems.button.cancel')}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('stockItems.button.creating')}
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    {t('stockItems.button.createStock')}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Stock Item Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Edit Stock Item
            </DialogTitle>
            <DialogDescription>
              Update all details for this stock item.
            </DialogDescription>
          </DialogHeader>

          {selectedStockItem && (
            <div className="space-y-4">

              {/* Show current stock info */}
              {selectedStockItem && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h3 className="font-semibold text-blue-900 mb-2">Current Stock Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-blue-700">Current Price:</span>
                      <span className="font-semibold ml-2">${selectedStockItem.product?.price?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div>
                      <span className="text-blue-700">Current PV:</span>
                      <span className="font-semibold ml-2">{((selectedStockItem as any).pv || 0).toFixed(2)} PV</span>
                    </div>
                  </div>
                  {(selectedStockItem as any).description && (
                    <div className="mt-2 text-sm">
                      <span className="text-blue-700">Contains:</span>
                      <p className="text-blue-900 mt-1">{(selectedStockItem as any).description.replace('Contains: ', '')}</p>
                    </div>
                  )}
                  <p className="text-xs text-blue-600 mt-2">{t('stockItems.form.addProductsBelow')}</p>
                </div>
              )}

              {/* Stockist Level - Required */}
              <div className="space-y-2">
                <Label htmlFor="edit-stockistLevel">{t('stockItems.form.stockistLevel')} <span className="text-red-500">*</span></Label>
                <Select
                  value={stockistLevel || undefined}
                  onValueChange={(value) => {
                    setStockistLevel(value === 'none' ? '' : value);
                    // Auto-generate stock name based on selected level
                    if (value && value !== 'none') {
                      const levelName = stockistLevelNames[value as keyof typeof stockistLevelNames];
                      setProductName(`${value} (${levelName})`);
                    }
                  }}
                  required
                >
                  <SelectTrigger id="edit-stockistLevel">
                    <SelectValue placeholder={t('stockItems.form.stockistLevelPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="S">{t('stockItems.form.stockistLevelS')}</SelectItem>
                    <SelectItem value="M">{t('stockItems.form.stockistLevelM')}</SelectItem>
                    <SelectItem value="C">{t('stockItems.form.stockistLevelC')}</SelectItem>
                    <SelectItem value="D">{t('stockItems.form.stockistLevelD')}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t('stockItems.form.stockNameAutoGenerated')}
                </p>
              </div>

              {/* Auto-generated Stock Name (Read-only) */}
              {stockistLevel && stockistLevel !== 'none' && (
                <div className="space-y-2">
                  <Label htmlFor="edit-name">{t('stockItems.form.stockNameAutoGeneratedLabel')}</Label>
                  <Input
                    id="edit-name"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder={t('stockItems.form.stockNamePlaceholder')}
                    required
                    className="bg-gray-100 font-semibold"
                    readOnly
                  />
                </div>
              )}

              {/* Auto-display Commission Rate */}
              {stockistLevel && stockistLevel !== 'none' && (
                <div className="space-y-2">
                  <Label htmlFor="edit-commissionRate">{t('stockItems.form.commissionRate')}</Label>
                  <Input
                    id="edit-commissionRate"
                    type="text"
                    value={`${stockistLevelCommissions[stockistLevel as keyof typeof stockistLevelCommissions]}%`}
                    readOnly
                    className="bg-blue-50 font-semibold text-blue-700 border-blue-200"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('stockItems.form.commissionRateDesc')}
                  </p>
                </div>
              )}

              {/* Stock Quantity - Always Visible */}
              <div className="border rounded-lg p-4 bg-green-50 border-green-200">
                <h3 className="font-semibold text-green-900 mb-3">{t('stockItems.form.stockQuantity')}</h3>
                <div className="space-y-2">
                  <Label htmlFor="edit-stock-quantity">{t('stockItems.form.howManySets')}</Label>
                  <Input
                    id="edit-stock-quantity"
                    type="number"
                    min="1"
                    step="1"
                    value={quantityMultiplier}
                    onChange={(e) => setQuantityMultiplier(e.target.value)}
                    placeholder={t('stockItems.form.howManySetsPlaceholder')}
                    className="bg-white text-lg font-semibold"
                  />
                  <p className="text-xs text-green-700">
                    <span dangerouslySetInnerHTML={{ __html: t('stockItems.form.currentStockQuantity', { qty: String(selectedStockItem?.quantity || 0) }) }} />
                  </p>
                </div>
                <div className="mt-3 p-3 bg-white rounded border border-green-300">
                  <p className="text-sm text-green-900">
                    <strong>{t('stockItems.form.newStockQuantity', { qty: String(quantityMultiplier || 1) })}</strong>
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    {t('stockItems.form.stockQuantityDesc')}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-price">{t('stockItems.form.newTotalPrice')}</Label>
                  <Input
                    id="edit-price"
                    type="number"
                    value={productPrice}
                    readOnly
                    className="bg-gray-100 font-semibold"
                    placeholder={t('stockItems.form.totalPricePlaceholder')}
                  />
                  <p className="text-xs text-muted-foreground">{t('stockItems.form.totalPriceDesc')}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-pv">{t('stockItems.form.newTotalPV')}</Label>
                  <Input
                    id="edit-pv"
                    type="number"
                    value={productPV}
                    readOnly
                    className="bg-gray-100 font-semibold"
                    placeholder={t('stockItems.form.totalPVPlaceholder')}
                  />
                  <p className="text-xs text-muted-foreground">{t('stockItems.form.totalPVDesc')}</p>
                </div>
              </div>

              {/* Product Selection Section */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <h3 className="font-semibold mb-3">{t('stockItems.form.addProductsToStock')}</h3>

                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="col-span-2">
                    <Label htmlFor="edit-product-select">{t('stockItems.form.selectProduct')}</Label>
                    <select
                      id="edit-product-select"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={selectedProductId}
                      onChange={(e) => handleProductSelect(e.target.value)}
                    >
                      <option value="">{t('stockItems.form.selectProductPlaceholder')}</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} - ${product.price} (PV: {product.pv})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="edit-quantity-input">{t('stockItems.form.quantityLabel')}</Label>
                    <Input
                      id="edit-quantity-input"
                      type="number"
                      min="1"
                      placeholder={t('stockItems.form.quantityPlaceholder')}
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={handleAddLineItem}
                  className="w-full"
                  variant="outline"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t('stockItems.form.addProduct')}
                </Button>
              </div>

              {/* Line Items Table */}
              {lineItems.length > 0 && (
                <div className="space-y-4">
                  {/* Stock Quantity */}
                  <div className="border rounded-lg p-4 bg-green-50 border-green-200">
                    <h3 className="font-semibold text-green-900 mb-3">{t('stockItems.form.stockQuantity')}</h3>
                    <div className="flex gap-3 items-end">
                      <div className="flex-1">
                        <Label htmlFor="edit-multiplier">{t('stockItems.form.howManySets')}</Label>
                        <Input
                          id="edit-multiplier"
                          type="number"
                          min="1"
                          step="1"
                          value={quantityMultiplier}
                          onChange={(e) => setQuantityMultiplier(e.target.value)}
                          placeholder={t('stockItems.form.howManySetsPlaceholder')}
                          className="bg-white"
                        />
                        <p className="text-xs text-green-700 mt-1">
                          {t('stockItems.form.howManySetsDesc')}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 p-3 bg-white rounded border border-green-300">
                      <p className="text-sm text-green-900">
                        <strong>{t('stockItems.form.stockQuantityDisplay', { qty: String(quantityMultiplier || 1) })}</strong>
                      </p>
                      <p className="text-xs text-green-700 mt-1">
                        {t('stockItems.form.stockQuantityDesc')}
                      </p>
                    </div>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('stockItems.form.table.product')}</TableHead>
                          <TableHead className="text-center">{t('stockItems.form.table.qty')}</TableHead>
                          <TableHead className="text-right">{t('stockItems.form.table.pricePerUnit')}</TableHead>
                          <TableHead className="text-right">{t('stockItems.form.table.pvPerUnit')}</TableHead>
                          <TableHead className="text-right">{t('stockItems.form.table.totalPV')}</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lineItems.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{item.productName}</TableCell>
                            <TableCell className="text-center">
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleUpdateLineItemQty(index, parseInt(e.target.value))}
                                className="w-16 text-center"
                              />
                            </TableCell>
                            <TableCell className="text-right">${item.unitPrice.toFixed(2)}</TableCell>
                            <TableCell className="text-right">{item.pv.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-semibold">{item.totalPV.toFixed(2)}</TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveLineItem(index)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {/* Total PV Display */}
                    <div className="bg-blue-50 p-4 border-t">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-lg">{t('stockItems.form.totalPVDisplay')}</span>
                        <span className="font-bold text-2xl text-blue-600">{calculateTotalPV().toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmEditStock}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Update Stock Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              {t('stockItems.deleteDialog.title')}
            </DialogTitle>
            <DialogDescription>
              {t('stockItems.deleteDialog.description')}
            </DialogDescription>
          </DialogHeader>

          {selectedStockItem && (
            <div className="p-4 bg-muted rounded-md">
              <h4 className="font-medium mb-2">{t('stockItems.deleteDialog.itemToDelete')}</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>{t('stockItems.editDialog.product')}</span>
                  <span className="font-medium">{selectedStockItem.product?.name || t('stockItems.table.unknownProduct')}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('stockItems.form.quantity')}</span>
                  <span className="font-mono">{selectedStockItem.quantity} {t('stockItems.editDialog.units')}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('stockItems.editDialog.unitPrice')}</span>
                  <span>{formatCurrency(selectedStockItem.product?.price || 0)}</span>
                </div>
                <div className="flex justify-between font-bold text-red-600 border-t pt-2">
                  <span>{t('stockItems.deleteDialog.totalValue')}</span>
                  <span>{formatCurrency((selectedStockItem.quantity || 0) * (selectedStockItem.product?.price || 0))}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              {t('stockItems.button.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteStock}
              className="bg-red-600 hover:bg-red-700"
            >
              {t('stockItems.button.deleteItem')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex-1 p-4 md:p-8 pt-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('stockItems.summary.totalStocks')}</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stockItems.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('stockItems.summary.totalItems')}</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalItems.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('stockItems.summary.totalValue')}</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Stock Items Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package /> {t('stockItems.table.title')}
                </CardTitle>
                <CardDescription>
                  {t('stockItems.table.description')}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  size="sm"
                  icon={Plus}
                  onClick={() => setIsCreateDialogOpen(true)}
                >
                  {t('stockItems.button.createStock')}
                </Button>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t('stockItems.table.searchPlaceholder')}
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="pl-8 sm:w-[300px]"
                  />
                </div>
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
                              {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
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
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={columns.length} className="h-24 text-center">
                            {t('stockItems.table.noItems')}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-center justify-end space-x-2 py-4">
                  <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                    {t('stockItems.button.previous')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                    {t('stockItems.button.next')}
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
