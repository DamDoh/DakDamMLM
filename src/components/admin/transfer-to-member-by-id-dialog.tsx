'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, ArrowRightLeft, Search, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/internationalization';
import { cn } from '@/lib/utils';
import RankBadge from '@/components/genealogy/rank-badge';

/** Catalog product from Product/item area (same source as admin binary-stock page) */
type CatalogProduct = {
  id: string;
  name: string;
  category: string;
  qty: number;
  price: number;
  pv: number;
  imageUrl?: string | null;
};

type LookedUpMember = {
  id: string;
  fullName: string;
  memberId: string;
  storeOwnerLevel?: string | null;
  rank?: string | null;
};

/** Selected product with transfer quantity */
type SelectedProduct = { productId: string; quantity: number };

interface TransferToMemberByIdDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSuccess: () => void;
  /** Optional: pre-loaded catalog products (avoids GET /api/products when dialog opens) */
  initialCatalogProducts?: CatalogProduct[] | null;
}

export default function TransferToMemberByIdDialog({
  isOpen,
  onOpenChange,
  onSuccess,
  initialCatalogProducts,
}: TransferToMemberByIdDialogProps) {
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const [memberIdInput, setMemberIdInput] = useState('');
  const [lookedUpMember, setLookedUpMember] = useState<LookedUpMember | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedMap, setSelectedMap] = useState<Record<string, number>>({});
  const { toast } = useToast();

  useEffect(() => {
    if (!isOpen) return;
    const useInitial = initialCatalogProducts !== undefined && initialCatalogProducts !== null;
    if (useInitial) {
      setCatalogProducts(Array.isArray(initialCatalogProducts) ? initialCatalogProducts : []);
      setLoadingProducts(false);
    } else {
      fetchCatalogProducts();
    }
    setLookedUpMember(null);
    setMemberIdInput('');
    setLookupError(null);
    setSelectedMap({});
  }, [isOpen]);

  const fetchCatalogProducts = async () => {
    try {
      setLoadingProducts(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        setCatalogProducts([]);
        return;
      }
      const response = await fetch('/api/products?limit=1000&isActive=true', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const rawData = await response.json();
        const list = rawData?.data ?? rawData ?? [];
        const products = Array.isArray(list) ? list : [];
        const withQty = products
          .map((p: any) => ({
            id: p.id,
            name: p.name,
            category: p.category || 'Uncategorized',
            qty: p.qty ?? p.quantity ?? 0,
            price: Number(p.price) || 0,
            pv: Number(p.pv) || 0,
            imageUrl: p.imageUrl,
          }))
          .filter((p: CatalogProduct) => p.qty > 0);
        setCatalogProducts(withQty);
      } else {
        setCatalogProducts([]);
      }
    } catch {
      setCatalogProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleLookupMember = async () => {
    const id = memberIdInput?.trim();
    if (!id) {
      setLookupError(t('adminBinaryStock.enterMemberId') || 'Please enter a Member ID');
      return;
    }
    setLookingUp(true);
    setLookupError(null);
    setLookedUpMember(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        setLookupError(t('common.unauthorized') || 'Not authorized');
        return;
      }
      const response = await fetch(`/api/members?search=${encodeURIComponent(id)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        setLookupError(t('adminBinaryStock.memberLookupFailed') || 'Failed to lookup member');
        return;
      }
      const data = await response.json();
      const list = data?.data ?? data ?? [];
      const members = Array.isArray(list) ? list : [];
      const exact = members.find((m: any) => (m.memberId || '').toUpperCase() === id.toUpperCase());
      const member = exact || members[0];
      if (!member) {
        setLookupError(t('adminBinaryStock.memberNotFound') || 'Member not found');
        return;
      }
      setLookedUpMember({
        id: member.id,
        fullName: member.fullName || `${member.firstName || ''} ${member.surname || ''}`.trim() || '—',
        memberId: member.memberId || id,
        storeOwnerLevel: member.storeOwnerLevel ?? null,
        rank: member.rank ?? null,
      });
    } catch {
      setLookupError(t('adminBinaryStock.memberLookupFailed') || 'Failed to lookup member');
    } finally {
      setLookingUp(false);
    }
  };

  const toggleProduct = (productId: string, available: number) => {
    setSelectedMap((prev) => {
      const next = { ...prev };
      if (next[productId] != null) {
        delete next[productId];
      } else {
        next[productId] = Math.min(1, available);
      }
      return next;
    });
  };

  const setQuantity = (productId: string, value: number, max: number) => {
    const qty = Math.max(0, Math.min(max, Math.floor(Number(value)) || 0));
    setSelectedMap((prev) => (qty > 0 ? { ...prev, [productId]: qty } : (() => { const n = { ...prev }; delete n[productId]; return n; })()));
  };

  const selections: SelectedProduct[] = Object.entries(selectedMap)
    .filter(([, q]) => q > 0)
    .map(([productId, quantity]) => ({ productId, quantity }));

  const totalPrice = selections.reduce((sum, { productId, quantity }) => {
    const p = catalogProducts.find((x) => x.id === productId);
    return sum + (p ? p.price * quantity : 0);
  }, 0);
  const totalPV = selections.reduce((sum, { productId, quantity }) => {
    const p = catalogProducts.find((x) => x.id === productId);
    return sum + (p ? p.pv * quantity : 0);
  }, 0);
  const totalItems = selections.reduce((sum, { quantity }) => sum + quantity, 0);

  const handleConfirm = async () => {
    if (!lookedUpMember) return;
    if (selections.length === 0) {
      toast({
        variant: 'destructive',
        title: t('adminBinaryStock.selectProducts') || 'Select Products',
        description: t('adminBinaryStock.selectAtLeastOneProduct') || 'Select at least one product and quantity.',
      });
      return;
    }
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) {
      toast({ variant: 'destructive', title: t('common.error'), description: 'Not authorized' });
      return;
    }
    for (const { productId, quantity } of selections) {
      const product = catalogProducts.find((p) => p.id === productId);
      if (!product || product.qty < quantity) {
        toast({
          variant: 'destructive',
          title: t('admin.stock.transferFailed'),
          description: `${product?.name || productId}: ${t('adminBinaryStock.notEnoughQuantity') || 'Not enough quantity'}. Available: ${product?.qty ?? 0}`,
        });
        return;
      }
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/inventory/transfer-from-catalog', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toUserId: lookedUpMember.id,
          items: selections.map((s) => ({ productId: s.productId, quantity: s.quantity })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || data?.message || 'Transfer failed');
      }
      const failed = (data?.data?.results ?? []).filter((r: { ok: boolean }) => !r.ok);
      if (failed.length === selections.length) {
        throw new Error(failed[0]?.error || 'Transfer failed');
      }
      toast({
        title: t('admin.stock.transferSuccess'),
        description: `${t('adminBinaryStock.transferredTo') || 'Transferred to'} ${lookedUpMember.fullName} (${lookedUpMember.memberId}): ${totalItems} ${t('adminBinaryStock.items') || 'items'}.`,
      });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t('admin.stock.transferFailed'),
        description: error.message || t('admin.stock.transferError'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-muted/30">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ArrowRightLeft className="h-5 w-5" />
            </span>
            {t('adminBinaryStock.transferToMember') || 'Transfer to Member'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground mt-1">
            {t('adminBinaryStock.transferToMemberByMemberIdDesc') || 'Enter a member ID, then select products from the Product/item catalog to transfer.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Step 1: Member ID */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('adminBinaryStock.memberId') || 'Member ID'}</Label>
            <div className="flex gap-2">
              <Input
                placeholder={t('adminBinaryStock.memberIdPlaceholder') || 'e.g. MBR001'}
                value={memberIdInput}
                onChange={(e) => {
                  setMemberIdInput(e.target.value);
                  setLookupError(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleLookupMember())}
                className="flex-1"
              />
              <Button type="button" variant="secondary" onClick={handleLookupMember} disabled={lookingUp} className="shrink-0">
                {lookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            {lookupError && <p className="text-sm text-destructive">{lookupError}</p>}
            {lookedUpMember && (
              <div className="p-4 rounded-xl border bg-primary/5 border-primary/20">
                <div className="flex items-center gap-3">
                  {lookedUpMember.rank && lookedUpMember.rank !== 'Member' ? (
                    <div className="h-10 w-10 rounded-full overflow-hidden flex items-center justify-center shrink-0">
                      <RankBadge rank={lookedUpMember.rank as any} className="h-10 w-10 rounded-full" />
                    </div>
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold shrink-0">
                      {lookedUpMember.fullName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium">{lookedUpMember.fullName}</p>
                    <p className="text-sm text-muted-foreground">{lookedUpMember.memberId}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {lookedUpMember.rank && (
                        <Badge variant="outline" className="text-xs">{lookedUpMember.rank}</Badge>
                      )}
                      {lookedUpMember.storeOwnerLevel && (
                        <Badge variant="secondary" className="text-xs">{lookedUpMember.storeOwnerLevel}</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Select Products */}
          {lookedUpMember && (
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold">{t('adminBinaryStock.selectProducts') || 'Select Products'}</h4>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {t('adminBinaryStock.selectProductsFromCatalog') || 'Choose products from the Product/item catalog and enter quantity to transfer.'}
                </p>
              </div>
              {loadingProducts ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : catalogProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 rounded-xl border border-dashed bg-muted/30">
                  <Package className="h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">{t('adminBinaryStock.noProductsAvailable') || 'No products available'}</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {catalogProducts.map((product) => {
                    const selectedQty = selectedMap[product.id] ?? 0;
                    const isSelected = selectedQty > 0;
                    return (
                      <div
                        key={product.id}
                        className={cn(
                          'p-4 rounded-xl border transition-all',
                          isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:bg-muted/40'
                        )}
                      >
                        <div className="flex items-start gap-4">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleProduct(product.id, product.qty)}
                            className="mt-0.5 shrink-0"
                          />
                          <div className="h-14 w-14 rounded-lg border bg-muted shrink-0 overflow-hidden flex items-center justify-center">
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="object-cover h-full w-full"
                              />
                            ) : (
                              <Package className="h-6 w-6 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium">{product.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{product.category}</p>
                            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                              <span>{t('adminBinaryStock.yourQuantity') || 'Your Quantity'}: <strong className="text-black">{product.qty}</strong></span>
                              <span>Price: <strong className="text-black">${Number(product.price).toFixed(2)}</strong></span>
                              <span>PV: <strong className="text-black">{product.pv}</strong></span>
                            </div>
                            {isSelected && (
                              <div className="mt-3 flex items-center gap-2">
                                <Label className="text-sm whitespace-nowrap">{t('cart.quantity') || 'Quantity'}:</Label>
                                <Input
                                  type="number"
                                  min={1}
                                  max={product.qty}
                                  value={selectedQty}
                                  onChange={(e) => setQuantity(product.id, e.target.value as unknown as number, product.qty)}
                                  className="w-24 h-9"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {selections.length > 0 && (
                <div className="p-4 rounded-xl border-2 border-primary/20 bg-primary/5 space-y-2">
                  <p className="text-sm font-medium">
                    {t('adminBinaryStock.totalPrice') || 'Total Price'}: <span className="text-black font-semibold">${totalPrice.toFixed(2)}</span>
                  </p>
                  <p className="text-sm font-medium">
                    {t('adminBinaryStock.totalPV') || 'Total PV'}: <span className="text-black font-semibold">{totalPV}</span>
                  </p>
                  <p className="text-sm font-medium">
                    {t('adminBinaryStock.totalItems') || 'Total Items'}: <span className="text-black font-semibold">{totalItems}</span>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {lookedUpMember && (
          <DialogFooter className="px-6 py-4 border-t bg-muted/20">
            <Button
              onClick={handleConfirm}
              disabled={isLoading || selections.length === 0}
              className="gap-2 min-w-[120px]"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t('common.confirm') || 'Confirm'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
