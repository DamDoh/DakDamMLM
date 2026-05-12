'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, Package, RefreshCw, BarChart3, ArrowRight, Send, GitBranch, AlertCircle, X, ChevronDown, Building2, UserPlus, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/internationalization';
import { cn } from '@/lib/utils';
import RankBadge from '@/components/genealogy/rank-badge';
import { useAuthContext } from '@/context/auth-context';
import TransferToDownlineDialog from '@/components/stockist/transfer-to-downline-dialog';
import { requestStockTransfer } from '@/services/server-actions';
import type { Member, Product, StockItem } from '@/lib/types';

interface BinaryNode {
  id: string;
  fullName: string;
  memberId: string;
  storeOwnerLevel: string | null;
  stockLevel: number;
  productCount: number;
  rank?: string;
  left: BinaryNode | null;
  right: BinaryNode | null;
}

interface StockInventory {
  items: any[];
  totalStock: number;
  productCount: number;
}

interface BinaryStockData {
  user: {
    id: string;
    fullName: string;
    memberId: string;
    storeOwnerLevel: string | null;
    stockInventory: StockInventory;
  };
  binaryTree: BinaryNode;
  stockDistribution: {
    left: number;
    right: number;
    total: number;
    balance: number;
  };
}

interface StockistByLevel {
  id: string;
  fullName: string;
  memberId: string;
  storeOwnerLevel: string;
  stockLevel: number;
  productCount: number;
  rank?: string;
}

// Type for pending stock request from session storage
interface PendingStockRequest {
  requests: Array<{
    productId: string;
    productName: string;
    requestedQuantity: number;
    unitPrice?: number;
  }>;
  shippingMethod: 'ship_to_address' | 'pickup_from_stockist';
  requesterId: string;
  requesterName: string;
  requesterLevel: string;
}

export default function AdminStockBinaryStockPage() {
  const { toast } = useToast();
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: authUser } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [binaryStockData, setBinaryStockData] = useState<BinaryStockData | null>(null);
  const [isTransferDialogOpen, setTransferDialogOpen] = useState(false);
  const [isBinaryTreeViewDialogOpen, setIsBinaryTreeViewDialogOpen] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<BinaryNode | null>(null);
  const [products, setProducts] = useState<(Product & { stock: StockItem })[]>([]);
  const [downlineMembers, setDownlineMembers] = useState<Member[]>([]);

  // Navigation state - track current root and breadcrumb path
  const [currentRootUserId, setCurrentRootUserId] = useState<string | undefined>(undefined);
  const [breadcrumbPath, setBreadcrumbPath] = useState<Array<{ id: string; name: string; memberId: string }>>([]);

  // Selection mode state - for selecting target AdminStock for stock request
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<PendingStockRequest | null>(null);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  // Stockists by level for tree view dialog
  const [loadingStockists, setLoadingStockists] = useState(false);
  const [stockistsByLevel, setStockistsByLevel] = useState<{
    D: Array<{ id: string; fullName: string; memberId: string; storeOwnerLevel: string; stockLevel: number; productCount: number; rank?: string }>;
    C: Array<{ id: string; fullName: string; memberId: string; storeOwnerLevel: string; stockLevel: number; productCount: number; rank?: string }>;
    M: Array<{ id: string; fullName: string; memberId: string; storeOwnerLevel: string; stockLevel: number; productCount: number; rank?: string }>;
    S: Array<{ id: string; fullName: string; memberId: string; storeOwnerLevel: string; stockLevel: number; productCount: number; rank?: string }>;
  }>({ D: [], C: [], M: [], S: [] });

  // State for expanded downlines in Binary Tree Stock View
  const [selectedStockistForView, setSelectedStockistForView] = useState<string | null>(null);
  const [expandedDownlines, setExpandedDownlines] = useState<Map<string, StockistByLevel[]>>(new Map());

  // Assign Stock Level Dialog state (for AdminStock users)
  const [isAssignLevelDialogOpen, setIsAssignLevelDialogOpen] = useState(false);
  const [assigningToNode, setAssigningToNode] = useState<BinaryNode | null>(null);
  const [selectedStockLevel, setSelectedStockLevel] = useState<string>('');
  const [autoAssignSponsor, setAutoAssignSponsor] = useState(false);
  const [assigningLevel, setAssigningLevel] = useState(false);
  const [availableStockLevels, setAvailableStockLevels] = useState<string[]>([]);
  const [allBinaryMembers, setAllBinaryMembers] = useState<BinaryNode[]>([]);
  const [selectedMemberForAssign, setSelectedMemberForAssign] = useState<string>('');
  const [memberSearchQuery, setMemberSearchQuery] = useState<string>('');

  // All users without stock level (from entire system, not just binary downline)
  const [allUsersWithoutLevel, setAllUsersWithoutLevel] = useState<BinaryNode[]>([]);


  // Calculate max width needed for horizontal scrolling
  const { minWidth, maxWidthForLines } = useMemo(() => {
    const maxStockists = Math.max(
      stockistsByLevel.D.length,
      stockistsByLevel.C.length,
      stockistsByLevel.M.length,
      stockistsByLevel.S.length
    );
    return {
      minWidth: Math.max(maxStockists * 200, 800),
      maxWidthForLines: Math.max(maxStockists * 200, 400)
    };
  }, [stockistsByLevel]);

  // Check for selection mode on mount
  useEffect(() => {
    const selectTarget = searchParams.get('selectTarget');
    if (selectTarget === 'true') {
      // Get pending request from session storage
      const storedRequest = sessionStorage.getItem('pendingStockRequest');
      if (storedRequest) {
        try {
          const requestData = JSON.parse(storedRequest) as PendingStockRequest;
          setPendingRequest(requestData);
          setIsSelectionMode(true);
        } catch (e) {
          console.error('Failed to parse pending stock request:', e);
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Failed to load pending stock request. Please try again.',
          });
          router.replace('/binary-stock');
        }
      } else {
        // No pending request, redirect back
        router.replace('/binary-stock');
      }
    }
  }, [searchParams, toast, router]);

  // Cancel selection mode
  const cancelSelectionMode = () => {
    setIsSelectionMode(false);
    setPendingRequest(null);
    sessionStorage.removeItem('pendingStockRequest');
    router.replace('/binary-stock');
  };

  // Submit stock request to selected target
  const submitRequestToTarget = async (targetNode: BinaryNode | StockistByLevel) => {
    if (!pendingRequest || !authUser) return;

    setIsSubmittingRequest(true);
    try {
      const result = await requestStockTransfer({
        stockistId: targetNode.id, // Target AdminStock
        stockistName: `ADMIN_TRANSFER:${pendingRequest.requesterName}`, // Mark as admin transfer
        stockistLevel: pendingRequest.requesterLevel,
        requestedById: pendingRequest.requesterId,
        requestedByName: pendingRequest.requesterName,
        requests: pendingRequest.requests,
        shippingMethod: pendingRequest.shippingMethod,
      });

      if (result.success) {
        toast({
          title: t('stockist.request.successTitle') || 'Request Submitted',
          description: `Stock request sent to ${targetNode.fullName} (${targetNode.memberId})`,
        });

        // Clear pending request and exit selection mode
        sessionStorage.removeItem('pendingStockRequest');
        setIsSelectionMode(false);
        setPendingRequest(null);
        router.replace('/binary-stock');
      } else {
        toast({
          variant: 'destructive',
          title: t('stockist.request.failedTitle') || 'Request Failed',
          description: result.message,
        });
      }
    } catch (error: any) {
      console.error('Failed to submit stock request:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to submit stock request',
      });
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  // Check if user has access to Binary Stock (only D, C, M levels)
  useEffect(() => {
    if (authUser?.storeOwnerLevel === 'S') {
      // Stock Level S users cannot access Binary Stock features
      toast({
        variant: 'destructive',
        title: t('adminBinaryStock.accessDeniedLevelS'),
        description: t('adminBinaryStock.accessDeniedLevelSDesc'),
      });
      router.push('/my-stock');
      return;
    }
  }, [authUser, router, toast, t]);

  useEffect(() => {
    // Don't load if user is level S
    if (authUser?.storeOwnerLevel === 'S') return;

    // Load data when component mounts or when authUser changes
    if (authUser) {
      loadBinaryStock();
      loadProductsAndDownline();
      // Fetch available levels for current user
      const fetchAvailableLevels = async () => {
        try {
          const token = localStorage.getItem('auth_token');
          if (!token) return;
          const response = await fetch('/api/binary-stock/assign-level', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data?.availableLevels) {
              setAvailableStockLevels(result.data.availableLevels);
            }
          }
        } catch (error) {
          console.error('Failed to fetch available levels:', error);
        }
      };
      fetchAvailableLevels();
    }
  }, [authUser]);

  // Load stockists by level after binaryStockData is loaded
  useEffect(() => {
    if (binaryStockData?.user?.id && authUser && authUser.storeOwnerLevel !== 'S') {
      loadStockistsByLevel(binaryStockData.user.id);
    }
  }, [binaryStockData?.user?.id, authUser]);

  // Helper function to extract all stockists from binary tree
  const extractStockistsFromTree = (node: BinaryNode | null, stockists: StockistByLevel[]) => {
    if (!node) return;

    if (node.storeOwnerLevel && ['D', 'C', 'M', 'S'].includes(node.storeOwnerLevel)) {
      stockists.push({
        id: node.id,
        fullName: node.fullName,
        memberId: node.memberId,
        storeOwnerLevel: node.storeOwnerLevel,
        stockLevel: node.stockLevel,
        productCount: node.productCount || 0,
        rank: node.rank
      });
    }

    if (node.left) extractStockistsFromTree(node.left, stockists);
    if (node.right) extractStockistsFromTree(node.right, stockists);
  };

  // Helper function to extract ALL members from binary tree
  const extractAllMembersFromTree = (node: BinaryNode | null, members: BinaryNode[]) => {
    if (!node) return;
    members.push(node);
    if (node.left) extractAllMembersFromTree(node.left, members);
    if (node.right) extractAllMembersFromTree(node.right, members);
  };

  // Sort members by stock level hierarchy (D > C > M > S > no level)
  const sortMembersByStockLevel = (members: BinaryNode[]): BinaryNode[] => {
    const levelOrder: Record<string, number> = { 'D': 1, 'C': 2, 'M': 3, 'S': 4 };
    return [...members].sort((a, b) => {
      const aOrder = a.storeOwnerLevel ? levelOrder[a.storeOwnerLevel] || 99 : 99;
      const bOrder = b.storeOwnerLevel ? levelOrder[b.storeOwnerLevel] || 99 : 99;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.fullName.localeCompare(b.fullName);
    });
  };

  // Check if current user is AdminStock (has stockist level)
  const isAdminStock = binaryStockData?.user?.storeOwnerLevel &&
    ['S', 'M', 'C', 'D'].includes(binaryStockData.user.storeOwnerLevel);
  
  // Check if current user is an admin
  const isAdmin = authUser?.isAdmin || false;

  // Fetch all users without stock level (from entire system)
  const fetchAllUsersWithoutLevel = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch('/api/members?withoutStockLevel=true', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        // The members API returns array directly or {success, data} format
        const usersArray = Array.isArray(result) ? result : (result.data || []);

        // Map users to BinaryNode format
        const users = usersArray.map((user: any) => ({
          id: user.id,
          fullName: user.fullName || `${user.firstName || ''} ${user.surname || ''}`.trim() || 'Unknown',
          memberId: user.memberId,
          storeOwnerLevel: user.storeOwnerLevel,
          rank: user.rank,
          stockLevel: 0,
          productCount: 0,
        }));
        setAllUsersWithoutLevel(users);
      }
    } catch (error) {
      console.error('Failed to fetch users without stock level:', error);
    }
  };

  // Handle opening Assign Stock Level dialog
  const handleOpenAssignLevelDialog = async (node?: BinaryNode, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }

    // Fetch all users without stock level (entire system)
    await fetchAllUsersWithoutLevel();

    // Fetch available stock levels for current user
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/binary-stock/assign-level', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data?.availableLevels) {
          setAvailableStockLevels(result.data.availableLevels);
        }
      }
    } catch (error) {
      console.error('Failed to fetch available levels:', error);
    }

    // Extract all members from tree for selection
    if (binaryStockData?.binaryTree) {
      const allMembers: BinaryNode[] = [];
      if (binaryStockData.binaryTree.left) {
        extractAllMembersFromTree(binaryStockData.binaryTree.left, allMembers);
      }
      if (binaryStockData.binaryTree.right) {
        extractAllMembersFromTree(binaryStockData.binaryTree.right, allMembers);
      }
      const sortedMembers = sortMembersByStockLevel(allMembers);
      setAllBinaryMembers(sortedMembers);
    }

    if (node) {
      setAssigningToNode(node);
      setSelectedMemberForAssign(node.id);
    } else {
      setAssigningToNode(null);
      setSelectedMemberForAssign('');
    }
    setSelectedStockLevel('');
    setAutoAssignSponsor(false);
    setMemberSearchQuery(''); // Reset search query
    setIsAssignLevelDialogOpen(true);
  };

  // Handle assigning stock level
  const handleAssignStockLevel = async () => {
    const targetId = selectedMemberForAssign || assigningToNode?.id;
    if (!targetId || !selectedStockLevel) {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: t('adminBinaryStock.selectMemberAndLevel') || 'Please select a member and stock level',
      });
      return;
    }

    try {
      setAssigningLevel(true);
      const token = localStorage.getItem('auth_token');

      // Get the current user's ID to place the new stockist under them in the binary tree
      const currentUserId = binaryStockData?.user?.id;

      const response = await fetch('/api/binary-stock/assign-level', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetUserId: targetId,
          stockLevel: selectedStockLevel,
          parentStockId: currentUserId, // Place the new stockist under the current user
          autoAssignSponsorLevel: autoAssignSponsor
        })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: t('common.success'),
          description: result.message || t('adminBinaryStock.levelAssignedSuccess'),
        });

        if (result.data?.sponsorLevelAssigned) {
          toast({
            title: t('adminBinaryStock.sponsorLevelAssigned') || 'Sponsor Level Assigned',
            description: `${result.data.sponsorLevelAssigned.sponsorName} was assigned level ${result.data.sponsorLevelAssigned.assignedLevel}`,
          });
        }

        setIsAssignLevelDialogOpen(false);
        loadBinaryStock(currentRootUserId);
        loadStockistsByLevel(currentRootUserId);
      } else {
        throw new Error(result.message || 'Assignment failed');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error.message || t('adminBinaryStock.levelAssignFailed'),
      });
    } finally {
      setAssigningLevel(false);
    }
  };

  // Load all stockists grouped by level
  // For adminstock users: Fetch stockists based on binary stock relationships (placementParentId)
  // For admins: Use the binary tree structure
  const loadStockistsByLevel = async (userId?: string) => {
    try {
      setLoadingStockists(true);
      const token = localStorage.getItem('auth_token');

      if (!token) return;

      // Determine the target user ID (current user or specified userId)
      const targetUserId = userId || binaryStockData?.user?.id;
      if (!targetUserId) {
        console.error('No target user ID available');
        setLoadingStockists(false);
        return;
      }

      // For adminstock users (non-admin), fetch stockists based on binary stock relationships
      // For admins, use the binary tree API
      if (authUser?.isAdmin) {
        // Admin: Use binary tree API
        const url = userId
          ? `/api/binary-stock?userId=${userId}&depth=3`
          : '/api/binary-stock?depth=3';

        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data?.binaryTree) {
            const allStockistsMap = new Map<string, StockistByLevel>();

            // Helper to add a stockist to the map (deduplicated by id)
            const addStockist = (s: any) => {
              if (!s || !s.id) return;
              if (!s.storeOwnerLevel || !['D', 'C', 'M', 'S'].includes(s.storeOwnerLevel)) return;
              // Skip if this is the root user (we'll add them separately)
              if (s.id === result.data.user.id) return;
              // Include the root user - they should see themselves in the Binary Tree Stock View

              if (!allStockistsMap.has(s.id)) {
                allStockistsMap.set(s.id, {
                  id: s.id,
                  fullName: s.fullName,
                  memberId: s.memberId,
                  storeOwnerLevel: s.storeOwnerLevel,
                  stockLevel: s.stockLevel || 0,
                  productCount: s.productCount || 0,
                  rank: s.rank
                });
              }
            };

            // Re-extract stockists into the map so we can also merge upline stockists
            const collectedFromTree: StockistByLevel[] = [];
            if (result.data.binaryTree.left) {
              extractStockistsFromTree(result.data.binaryTree.left, collectedFromTree);
            }
            if (result.data.binaryTree.right) {
              extractStockistsFromTree(result.data.binaryTree.right, collectedFromTree);
            }
            collectedFromTree.forEach(addStockist);

            // Add the root user to the list so they can see themselves (after extracting from tree to avoid duplicates)
            // Works the same way as AdminStock users - always show the root user if they have a stock level
            // This allows both admins and AdminStock users to see themselves in the Binary Tree Stock View
            if (result.data.user.storeOwnerLevel && ['D', 'C', 'M', 'S'].includes(result.data.user.storeOwnerLevel)) {
              // Only add if not already in the map (shouldn't happen, but just in case)
              if (!allStockistsMap.has(result.data.user.id)) {
                // Fetch the user's rank from the binary tree data if available
                const rootUserRank = result.data.binaryTree?.rank || undefined;

                allStockistsMap.set(result.data.user.id, {
                  id: result.data.user.id,
                  fullName: result.data.user.fullName,
                  memberId: result.data.user.memberId,
                  storeOwnerLevel: result.data.user.storeOwnerLevel,
                  stockLevel: result.data.user.stockInventory?.totalStock || 0,
                  productCount: result.data.user.stockInventory?.productCount || 0,
                  rank: rootUserRank
                });
              }
            }

            // Merge upline stockists (ancestors with stock levels) if provided by API
            const uplineStockists = result.data.uplineStockists || [];
            uplineStockists.forEach(addStockist);

            // Group by level (deduplicated by id)
            const grouped: { D: StockistByLevel[]; C: StockistByLevel[]; M: StockistByLevel[]; S: StockistByLevel[] } = {
              D: [],
              C: [],
              M: [],
              S: []
            };

            // Use a Set to track which stockists we've already added to prevent duplicates
            const addedStockistIds = new Set<string>();

            Array.from(allStockistsMap.values()).forEach((stockist) => {
              if (stockist.storeOwnerLevel && ['D', 'C', 'M', 'S'].includes(stockist.storeOwnerLevel)) {
                // Only add if not already added (shouldn't happen with Map, but extra safety)
                if (!addedStockistIds.has(stockist.id)) {
                  grouped[stockist.storeOwnerLevel as keyof typeof grouped].push(stockist);
                  addedStockistIds.add(stockist.id);
                }
              }
            });

            // Final deduplication pass: remove any duplicates that might have slipped through
            const finalGrouped: { D: StockistByLevel[]; C: StockistByLevel[]; M: StockistByLevel[]; S: StockistByLevel[] } = {
              D: [],
              C: [],
              M: [],
              S: []
            };

            (['D', 'C', 'M', 'S'] as const).forEach((level) => {
              const seen = new Set<string>();
              grouped[level].forEach((stockist) => {
                if (!seen.has(stockist.id)) {
                  finalGrouped[level].push(stockist);
                  seen.add(stockist.id);
                }
              });
            });

            setStockistsByLevel(finalGrouped);
          }
        }
      } else {
        // Adminstock user: Fetch stockists based on binary stock relationships (placementParentId)
        // Fetch all stockists who have this user as their placementParentId
        const response = await fetch(`/api/members?placementParentId=${targetUserId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const result = await response.json();
          const usersArray = Array.isArray(result) ? result : (result.data || []);

          // Filter to only include stockists (users with stock levels D, C, M, S)
          const stockists = usersArray
            .filter((user: any) =>
              user.storeOwnerLevel &&
              ['D', 'C', 'M', 'S'].includes(user.storeOwnerLevel) &&
              user.memberId !== 'ADMIN001' &&
              !user.isAdmin
            );

          // Add the current user (AdminStock) to the list so they can see themselves
          // First, fetch the current user's data
          let currentUserStockist: StockistByLevel | null = null;
          if (binaryStockData?.user?.storeOwnerLevel && ['D', 'C', 'M', 'S'].includes(binaryStockData.user.storeOwnerLevel)) {
            try {
              const currentUserStockResponse = await fetch(`/api/binary-stock?userId=${targetUserId}&depth=1&_t=${Date.now()}`, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                  'Cache-Control': 'no-cache',
                },
              });

              if (currentUserStockResponse.ok) {
                const currentUserStockResult = await currentUserStockResponse.json();
                if (currentUserStockResult.success && currentUserStockResult.data?.user?.stockInventory) {
                  // Get rank from binaryStockData.binaryTree or from the API response binary tree
                  // The binaryTree node should have the rank property
                  const userRank = binaryStockData?.binaryTree?.rank ||
                    (currentUserStockResult.data?.binaryTree as any)?.rank ||
                    undefined;

                  currentUserStockist = {
                    id: binaryStockData.user.id,
                    fullName: binaryStockData.user.fullName,
                    memberId: binaryStockData.user.memberId,
                    storeOwnerLevel: binaryStockData.user.storeOwnerLevel,
                    rank: userRank,
                    stockLevel: currentUserStockResult.data.user.stockInventory.totalStock || 0,
                    productCount: currentUserStockResult.data.user.stockInventory.productCount || 0
                  };
                }
              }
            } catch (error) {
              console.error(`Failed to fetch stock for current user ${binaryStockData.user.memberId}:`, error);
            }
          }

          // Fetch stock inventory for each stockist
          const stockistsWithInventory = await Promise.all(
            stockists.map(async (stockist: any) => {
              try {
                // Add cache-busting parameter to ensure fresh data
                const stockResponse = await fetch(`/api/binary-stock?userId=${stockist.id}&depth=1&_t=${Date.now()}`, {
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache',
                  },
                });

                if (stockResponse.ok) {
                  const stockResult = await stockResponse.json();
                  if (stockResult.success && stockResult.data?.user?.stockInventory) {
                    const totalStock = stockResult.data.user.stockInventory.totalStock || 0;
                    const productCount = stockResult.data.user.stockInventory.productCount || 0;

                    console.log(`Stock data for ${stockist.memberId}:`, {
                      totalStock,
                      productCount,
                      inventory: stockResult.data.user.stockInventory
                    });

                    return {
                      id: stockist.id,
                      fullName: stockist.fullName || `${stockist.firstName || ''} ${stockist.surname || ''}`.trim() || 'Unknown',
                      memberId: stockist.memberId,
                      storeOwnerLevel: stockist.storeOwnerLevel,
                      rank: stockist.rank,
                      stockLevel: totalStock,
                      productCount: productCount
                    };
                  }
                } else {
                  console.error(`Failed to fetch stock for ${stockist.memberId}:`, stockResponse.status, stockResponse.statusText);
                }
              } catch (error) {
                console.error(`Failed to fetch stock for ${stockist.memberId}:`, error);
              }
              return {
                id: stockist.id,
                fullName: stockist.fullName || `${stockist.firstName || ''} ${stockist.surname || ''}`.trim() || 'Unknown',
                memberId: stockist.memberId,
                storeOwnerLevel: stockist.storeOwnerLevel,
                rank: stockist.rank,
                stockLevel: 0,
                productCount: 0
              };
            })
          );

          // Group by level
          const grouped: { D: StockistByLevel[]; C: StockistByLevel[]; M: StockistByLevel[]; S: StockistByLevel[] } = {
            D: [],
            C: [],
            M: [],
            S: []
          };

          // Use a Set to track which stockists we've already added to prevent duplicates
          const addedStockistIds = new Set<string>();

          stockistsWithInventory.forEach((stockist) => {
            if (stockist.storeOwnerLevel && ['D', 'C', 'M', 'S'].includes(stockist.storeOwnerLevel)) {
              // Only add if not already added
              if (!addedStockistIds.has(stockist.id)) {
                grouped[stockist.storeOwnerLevel as keyof typeof grouped].push(stockist);
                addedStockistIds.add(stockist.id);
              }
            }
          });

          // Add the current user to the appropriate level group (only if not already added)
          if (currentUserStockist && !addedStockistIds.has(currentUserStockist.id)) {
            grouped[currentUserStockist.storeOwnerLevel as keyof typeof grouped].push(currentUserStockist);
            addedStockistIds.add(currentUserStockist.id);
          }

          setStockistsByLevel(grouped);
        }
      }
    } catch (error) {
      console.error('Failed to load stockists by level:', error);
    } finally {
      setLoadingStockists(false);
    }
  };

  const loadProductsAndDownline = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      // Fetch products with inventory
      const [productsResponse, inventoryResponse, downlineResponse] = await Promise.all([
        fetch('/api/products', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/inventory', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/members/downline', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (productsResponse.ok && inventoryResponse.ok) {
        const productsData = await productsResponse.json();
        const inventoryData = await inventoryResponse.json();
        const inventoryMap = new Map<string, { quantity?: number; lastUpdated?: string;[key: string]: any }>(
          (inventoryData.data || inventoryData || []).map((item: any) => [item.productId, item])
        );

        const productsWithStock = (productsData.data || productsData || []).map((product: Product) => {
          const inventoryItem = inventoryMap.get(product.id);
          return {
            ...product,
            stock: {
              productId: product.id,
              productName: product.name,
              quantity: inventoryItem?.quantity ?? 0,
              lastUpdated: inventoryItem?.lastUpdated ?? new Date().toISOString()
            } as StockItem
          };
        });

        setProducts(productsWithStock);
      }

      if (downlineResponse.ok) {
        const downlineData = await downlineResponse.json();
        setDownlineMembers(downlineData.data || downlineData || []);
      }
    } catch (error) {
      console.error('Failed to load products/downline:', error);
    }
  };

  // Handle node click - navigate to that user's tree OR select target for stock request
  const handleNodeClick = (node: BinaryNode | StockistByLevel, isRoot: boolean) => {
    // In selection mode, clicking any AdminStock node (except self) selects it as target
    if (isSelectionMode && pendingRequest) {
      // Don't allow selecting yourself as target
      if (node.id === pendingRequest.requesterId) {
        toast({
          variant: 'destructive',
          title: 'Invalid Selection',
          description: 'You cannot send a stock request to yourself.',
        });
        return;
      }

      // Must have stockist level to be a target
      if (!node.storeOwnerLevel) {
        toast({
          variant: 'destructive',
          title: 'Invalid Selection',
          description: 'Please select an AdminStock member.',
        });
        return;
      }

      // Submit request to this target
      submitRequestToTarget(node);
      return;
    }

    // Normal mode: Don't navigate if clicking on the current root
    if (isRoot) {
      return;
    }

    // Add current root to breadcrumb if not already there
    if (binaryStockData && !breadcrumbPath.some(b => b.id === binaryStockData.user.id)) {
      setBreadcrumbPath(prev => [...prev, {
        id: binaryStockData.user.id,
        name: binaryStockData.user.fullName,
        memberId: binaryStockData.user.memberId
      }]);
    }

    // Navigate to clicked user's tree
    setCurrentRootUserId(node.id);
    loadBinaryStock(node.id);
    loadStockistsByLevel(node.id);
  };

  // Handle transfer stock
  const handleTransferStock = (node: BinaryNode | StockistByLevel, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }

    const binaryNode: BinaryNode = {
      ...node,
      left: null,
      right: null
    } as BinaryNode;

    setSelectedRecipient(binaryNode);
    setTransferDialogOpen(true);
  };

  // Handle breadcrumb navigation
  const handleBreadcrumbClick = (userId: string, index: number) => {
    setBreadcrumbPath(prev => prev.slice(0, index));

    if (userId) {
      setCurrentRootUserId(userId);
      loadBinaryStock(userId);
      loadStockistsByLevel(userId);
    } else {
      setCurrentRootUserId(undefined);
      setBreadcrumbPath([]);
      loadBinaryStock();
      loadStockistsByLevel();
    }
  };

  // Handle going back to root
  const handleGoToRoot = () => {
    setCurrentRootUserId(undefined);
    setBreadcrumbPath([]);
    loadBinaryStock();
    loadStockistsByLevel();
  };

  const loadBinaryStock = async (userId?: string) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');

      if (!token) {
        toast({
          variant: 'destructive',
          title: 'Authentication Required',
          description: 'Please log in to access this page',
        });
        setLoading(false);
        return;
      }

      const url = userId
        ? `/api/binary-stock?userId=${userId}&depth=3`
        : '/api/binary-stock?depth=3';

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));

        if (response.status === 401) {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('refresh_token');
          toast({
            variant: 'destructive',
            title: 'Session Expired',
            description: 'Your session has expired. Please log in again.',
          });
          window.location.href = '/login';
          return;
        }

        throw new Error(errorData.message || `Failed to load binary stock: ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        setBinaryStockData(result.data);
        // Load stockists by level after binary stock data is loaded
        if (result.data?.user?.id) {
          loadStockistsByLevel(result.data.user.id);
        }
      } else {
        throw new Error(result.message || 'Failed to load data');
      }
    } catch (error: any) {
      console.error('Failed to load binary stock:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to load binary stock data',
      });
    } finally {
      setLoading(false);
    }
  };


  // Function to fetch downlines for a stockist
  // This fetches stockists who have this stockist as their placementParentId (binary stock relationship)
  // NOT from genealogy tree - binary stock and genealogy are separate
  const fetchDownlines = async (stockistId: string) => {
    try {
      const token = localStorage.getItem('auth_token');

      // Fetch all stockists who have this stockist as their placementParentId
      // This represents the binary stock parent-child relationship from "Add Stockist to Network"
      const response = await fetch(`/api/members?placementParentId=${stockistId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        const usersArray = Array.isArray(result) ? result : (result.data || []);

        // Filter to only include stockists (users with stock levels D, C, M, S)
        const stockistDownlines = usersArray
          .filter((user: any) =>
            user.storeOwnerLevel &&
            ['D', 'C', 'M', 'S'].includes(user.storeOwnerLevel) &&
            user.memberId !== 'ADMIN001' &&
            !user.isAdmin
          )
          .map((user: any) => ({
            id: user.id,
            fullName: user.fullName || `${user.firstName || ''} ${user.surname || ''}`.trim() || 'Unknown',
            memberId: user.memberId,
            storeOwnerLevel: user.storeOwnerLevel,
            rank: user.rank,
            stockLevel: 0, // Will be fetched if needed
            productCount: 0,
          }));

        // Fetch stock inventory for each downline
        const downlinesWithStock = await Promise.all(
          stockistDownlines.map(async (downline: StockistByLevel) => {
            try {
              const stockResponse = await fetch(`/api/binary-stock?userId=${downline.id}&depth=1`, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
              });

              if (stockResponse.ok) {
                const stockResult = await stockResponse.json();
                if (stockResult.success && stockResult.data?.user?.stockInventory) {
                  return {
                    ...downline,
                    stockLevel: stockResult.data.user.stockInventory.totalStock || 0,
                    productCount: stockResult.data.user.stockInventory.productCount || 0
                  };
                }
              }
            } catch (error) {
              console.error(`Failed to fetch stock for ${downline.memberId}:`, error);
            }
            return downline;
          })
        );

        setExpandedDownlines(prev => new Map(prev).set(stockistId, downlinesWithStock));
      }
    } catch (error) {
      console.error('Failed to fetch downlines:', error);
    }
  };

  // Handle stockist card click in Binary Tree Stock View
  // Navigate to that stockist's tree (they become the new root)
  const handleStockistCardClick = (stockist: StockistByLevel) => {
    // Add current root to breadcrumb if not already there
    if (binaryStockData && !breadcrumbPath.some(b => b.id === binaryStockData.user.id)) {
      setBreadcrumbPath(prev => [...prev, {
        id: binaryStockData.user.id,
        name: binaryStockData.user.fullName,
        memberId: binaryStockData.user.memberId
      }]);
    }

    // Navigate to clicked stockist's tree (they become the new root)
    setCurrentRootUserId(stockist.id);
    loadBinaryStock(stockist.id);
    loadStockistsByLevel(stockist.id);

    // Clear expanded downlines since we're navigating to a new view
    setSelectedStockistForView(null);
    setExpandedDownlines(new Map());
  };

  // Render stockist card - clicking navigates to that stockist's tree
  const renderStockistCard = (stockist: StockistByLevel) => {
    const stockColor = stockist.stockLevel > 100 ? 'bg-green-50 border-green-200 text-green-700' : stockist.stockLevel > 50 ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-red-50 border-red-200 text-red-700';
    const stockIconColor = stockist.stockLevel > 100 ? 'text-green-600' : stockist.stockLevel > 50 ? 'text-yellow-600' : 'text-red-600';

    return (
      <div key={stockist.id} className="flex flex-col items-center">
        <div className="w-0.5 h-3 bg-cyan-400 -mt-4 mb-1"></div>
        <Card
          className={cn(
            "w-40 transition-all duration-300 border-2 cursor-pointer hover:shadow-xl hover:scale-105 group"
          )}
          onClick={() => handleStockistCardClick(stockist)}
        >
          <CardContent className="p-3">
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center">
                {stockist.rank && stockist.rank !== 'Member' ? (
                  <div className="h-10 w-10 rounded-full overflow-hidden flex items-center justify-center">
                    <RankBadge rank={stockist.rank as any} className="h-10 w-10 rounded-full" />
                  </div>
                ) : (
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                    {stockist.fullName.split(' ').map(n => n[0]).join('').substring(0, 2)}
                  </div>
                )}
              </div>
              <div>
                <p className="font-semibold text-xs truncate">{stockist.fullName}</p>
                <p className="text-[10px] text-muted-foreground">{stockist.memberId}</p>
              </div>
              <Badge variant="secondary" className="text-[10px] font-semibold py-0 px-2">
                {t('adminBinaryStock.level')} {stockist.storeOwnerLevel}
              </Badge>
              <div className="space-y-1">
                <div className={cn("p-2 rounded-lg border-2", stockColor)}>
                  <div className="flex items-center justify-center gap-1">
                    <Package className={cn("h-4 w-4", stockIconColor)} />
                    <span className="font-bold text-base">{stockist.productCount}</span>
                  </div>
                  <p className="text-[10px] mt-0.5">{t('adminBinaryStock.stockLevel')}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <BarChart3 className={cn("h-3 w-3", stockIconColor)} />
                    <p className="text-[10px] text-muted-foreground font-medium">
                      {stockist.stockLevel} {t('binaryStock.totalQty')}
                    </p>
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full mt-2 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                onClick={(e) => handleTransferStock(stockist, e)}
              >
                <Send className="h-3 w-3 mr-1" />
                {t('binaryStock.transferStock')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!binaryStockData) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">No data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Selection Mode Banner */}
      {isSelectionMode && pendingRequest && (
        <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800 dark:text-blue-200">
            {t('stockist.request.selectTargetTitle') || 'Select Target AdminStock'}
          </AlertTitle>
          <AlertDescription className="text-blue-700 dark:text-blue-300">
            <div className="flex items-center justify-between">
              <div>
                <p>{t('stockist.request.selectTargetInstruction') || 'Click on an AdminStock member in the tree below to send your stock request to them.'}</p>
                <p className="text-sm mt-1">
                  <strong>{pendingRequest.requests.length}</strong> item(s) |
                  Shipping: <strong>{pendingRequest.shippingMethod === 'ship_to_address' ? 'Ship to Address' : 'Pick up from Stockist'}</strong>
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={cancelSelectionMode}
                className="border-blue-500 text-blue-700 hover:bg-blue-100"
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Loading overlay for request submission */}
      {isSubmittingRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Submitting stock request...</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {isSelectionMode ? (t('stockist.request.selectTargetTitle') || 'Select Target AdminStock') : t('binaryStock.title')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isSelectionMode
              ? (t('stockist.request.selectTargetDesc') || 'Select an AdminStock from the tree to send your stock request')
              : t('binaryStock.description')}
          </p>
        </div>
        <div className="flex gap-2">
          {!isSelectionMode && (currentRootUserId || breadcrumbPath.length > 0) && (
            <Button onClick={handleGoToRoot} variant="outline" size="lg" className="gap-2">
              <ArrowRight className="h-4 w-4 rotate-180" />
              {t('binaryStock.backToRoot')}
            </Button>
          )}
          {/* Add Stockist to Network button - only show for Admin users */}
          {!isSelectionMode && isAdmin && availableStockLevels.length > 0 && (
            <Button onClick={() => handleOpenAssignLevelDialog()} size="lg" className="gap-2 bg-purple-600 hover:bg-purple-700">
              <UserPlus className="h-4 w-4" />
              {t('adminBinaryStock.addStockistToNetwork') || 'Add Stockist to Network'}
            </Button>
          )}
          {!isSelectionMode && (
            <Button onClick={() => loadBinaryStock(currentRootUserId)} size="lg" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              {t('binaryStock.refresh')}
            </Button>
          )}
        </div>
      </div>

      {/* Binary Tree Content */}
      <div className="space-y-6 mt-6">
        {/* Current User Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('binaryStock.yourAdminStockLevel')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold">{binaryStockData.user.fullName}</p>
              <p className="text-sm text-muted-foreground">{binaryStockData.user.memberId}</p>
              {binaryStockData.user.storeOwnerLevel && (
                <Badge variant="outline" className="mt-2">
                  {t('adminBinaryStock.level')} {binaryStockData.user.storeOwnerLevel}
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('binaryStock.yourTotalStock')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-600" />
                <span className="text-2xl font-bold">
                  {binaryStockData.user.stockInventory.totalStock}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('binaryStock.totalQuantity')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('binaryStock.productsItems')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-purple-600" />
                <span className="text-2xl font-bold">
                  {binaryStockData.user.stockInventory.productCount}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('binaryStock.totalProducts')}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Network Stock Summary by Level */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t('binaryStock.stockLevelSummary')}
            </CardTitle>
            <CardDescription>
              {t('binaryStock.stockLevelSummaryDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* D Level */}
              <div className="border rounded-lg p-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950">
                <div className="flex items-center justify-between mb-2">
                  <Badge className="bg-amber-600 hover:bg-amber-700">{t('adminBinaryStock.levelD')}</Badge>
                  <span className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                    {stockistsByLevel.D.length}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  <Package className="h-4 w-4 inline mr-1" />
                  {stockistsByLevel.D.reduce((sum, s) => sum + s.stockLevel, 0)} {t('binaryStock.units')}
                </div>
              </div>

              {/* C Level */}
              <div className="border rounded-lg p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950">
                <div className="flex items-center justify-between mb-2">
                  <Badge className="bg-purple-600 hover:bg-purple-700">{t('adminBinaryStock.levelC')}</Badge>
                  <span className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                    {stockistsByLevel.C.length}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  <Package className="h-4 w-4 inline mr-1" />
                  {stockistsByLevel.C.reduce((sum, s) => sum + s.stockLevel, 0)} {t('binaryStock.units')}
                </div>
              </div>

              {/* M Level */}
              <div className="border rounded-lg p-4 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950">
                <div className="flex items-center justify-between mb-2">
                  <Badge className="bg-blue-600 hover:bg-blue-700">{t('adminBinaryStock.levelM')}</Badge>
                  <span className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                    {stockistsByLevel.M.length}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  <Package className="h-4 w-4 inline mr-1" />
                  {stockistsByLevel.M.reduce((sum, s) => sum + s.stockLevel, 0)} {t('binaryStock.units')}
                </div>
              </div>

              {/* S Level */}
              <div className="border rounded-lg p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950">
                <div className="flex items-center justify-between mb-2">
                  <Badge className="bg-green-600 hover:bg-green-700">{t('adminBinaryStock.levelS')}</Badge>
                  <span className="text-2xl font-bold text-green-700 dark:text-green-300">
                    {stockistsByLevel.S.length}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  <Package className="h-4 w-4 inline mr-1" />
                  {stockistsByLevel.S.reduce((sum, s) => sum + s.stockLevel, 0)} {t('binaryStock.units')}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Binary Tree Stock View - Button to Open Dialog */}
        <Card>
          <CardHeader>
            <CardTitle>{t('adminBinaryStock.binaryTreeStockView')}</CardTitle>
            <CardDescription>
              {t('adminBinaryStock.binaryTreeDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => setIsBinaryTreeViewDialogOpen(true)}
              size="lg"
              className="w-full gap-2"
            >
              <GitBranch className="h-5 w-5" />
              {t('adminBinaryStock.openBinaryTreeView') || 'Open Binary Tree Stock View'}
            </Button>
          </CardContent>
        </Card>

        {/* Binary Tree Stock View Dialog */}
        <Dialog open={isBinaryTreeViewDialogOpen} onOpenChange={(open) => {
          setIsBinaryTreeViewDialogOpen(open);
          // Refresh stock data when dialog opens
          if (open && binaryStockData?.user?.id) {
            loadStockistsByLevel(binaryStockData.user.id);
          }
        }}>
          <DialogContent className="max-w-[95vw] max-h-[90vh] h-[90vh] w-full p-0 overflow-hidden flex flex-col">
            <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-2xl">{t('adminBinaryStock.binaryTreeStockView')}</DialogTitle>
                  <DialogDescription>
                    {t('adminBinaryStock.binaryTreeDescription')}
                  </DialogDescription>
                </div>
                {(currentRootUserId || breadcrumbPath.length > 0) && (
                  <Button onClick={handleGoToRoot} variant="outline" size="sm" className="gap-2">
                    <ArrowRight className="h-4 w-4 rotate-180" />
                    {t('binaryStock.backToRoot')}
                  </Button>
                )}
              </div>
            </DialogHeader>
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              {/* Breadcrumb Navigation */}
              {breadcrumbPath.length > 0 && (
                <div className="px-6 pt-4 pb-4 border-b flex-shrink-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleGoToRoot}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {t('binaryStock.root')}
                    </Button>
                    {breadcrumbPath.map((crumb, index) => (
                      <div key={crumb.id} className="flex items-center gap-2">
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleBreadcrumbClick(crumb.id, index)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {crumb.name} ({crumb.memberId})
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Scrollable Tree Content - Scrolls both horizontally and vertically */}
              <div className="flex-1 overflow-auto min-h-0">
                {loadingStockists ? (
                  <div className="flex items-center justify-center py-12 h-full">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (() => {
                  // Function to fetch downlines for a stockist
                  // This fetches stockists who have this stockist as their placementParentId (binary stock relationship)
                  const fetchDownlines = async (stockistId: string) => {
                    try {
                      const token = localStorage.getItem('auth_token');

                      // Fetch all stockists who have this stockist as their placementParentId
                      const response = await fetch(`/api/members?placementParentId=${stockistId}`, {
                        headers: {
                          'Authorization': `Bearer ${token}`,
                          'Content-Type': 'application/json',
                        },
                      });

                      if (response.ok) {
                        const result = await response.json();
                        const usersArray = Array.isArray(result) ? result : (result.data || []);

                        // Filter to only include stockists (users with stock levels D, C, M, S)
                        const stockistDownlines = usersArray
                          .filter((user: any) =>
                            user.storeOwnerLevel &&
                            ['D', 'C', 'M', 'S'].includes(user.storeOwnerLevel) &&
                            user.memberId !== 'ADMIN001' &&
                            !user.isAdmin
                          )
                          .map((user: any) => ({
                            id: user.id,
                            fullName: user.fullName || `${user.firstName || ''} ${user.surname || ''}`.trim() || 'Unknown',
                            memberId: user.memberId,
                            storeOwnerLevel: user.storeOwnerLevel,
                            rank: user.rank,
                            stockLevel: 0, // Will be fetched if needed
                            productCount: 0,
                          }));

                        // Fetch stock inventory for each downline
                        const downlinesWithStock = await Promise.all(
                          stockistDownlines.map(async (downline: StockistByLevel) => {
                            try {
                              const stockResponse = await fetch(`/api/binary-stock?userId=${downline.id}&depth=1`, {
                                headers: {
                                  'Authorization': `Bearer ${token}`,
                                  'Content-Type': 'application/json',
                                },
                              });

                              if (stockResponse.ok) {
                                const stockResult = await stockResponse.json();
                                if (stockResult.success && stockResult.data?.user?.stockInventory) {
                                  return {
                                    ...downline,
                                    stockLevel: stockResult.data.user.stockInventory.totalStock || 0,
                                    productCount: stockResult.data.user.stockInventory.productCount || 0
                                  };
                                }
                              }
                            } catch (error) {
                              console.error(`Failed to fetch stock for ${downline.memberId}:`, error);
                            }
                            return downline;
                          })
                        );

                        setExpandedDownlines(prev => new Map(prev).set(stockistId, downlinesWithStock));
                      }
                    } catch (error) {
                      console.error('Failed to fetch downlines:', error);
                    }
                  };

                  // Render a stockist card - clicking navigates to that stockist's tree
                  const renderStockistCard = (stockist: StockistByLevel, level: 'D' | 'C' | 'M' | 'S', index: number) => {
                    const levelColors = {
                      D: 'bg-purple-50 border-purple-300 hover:bg-purple-100',
                      C: 'bg-blue-50 border-blue-300 hover:bg-blue-100',
                      M: 'bg-green-50 border-green-300 hover:bg-green-100',
                      S: 'bg-yellow-50 border-yellow-300 hover:bg-yellow-100'
                    };

                    const levelBadgeColors = {
                      D: 'bg-purple-600 text-white',
                      C: 'bg-blue-600 text-white',
                      M: 'bg-green-600 text-white',
                      S: 'bg-yellow-600 text-white'
                    };

                    // Check if this stockist is the current user (root) - don't show transfer button for self
                    // Works for both admin and AdminStock users - compares with the root user of the current view
                    const isCurrentUser = binaryStockData?.user?.id === stockist.id;

                    return (
                      <div key={`${level}-${stockist.id}-${index}`} className="flex flex-col items-center">
                        {/* Top connector line - connects from parent level */}
                        {level !== 'D' && (
                          <div className="w-0.5 h-6 bg-gradient-to-b from-cyan-400 to-cyan-300 mb-2"></div>
                        )}
                        <Card
                          className={cn(
                            "w-40 transition-all duration-300 border-2 cursor-pointer hover:shadow-lg",
                            levelColors[level],
                            isCurrentUser && "ring-2 ring-purple-400"
                          )}
                          onClick={() => {
                            // Don't navigate if clicking on current user
                            if (isCurrentUser) return;

                            // Navigate to this stockist's tree (they become the new root)
                            // Add current root to breadcrumb if not already there
                            if (binaryStockData && !breadcrumbPath.some(b => b.id === binaryStockData.user.id)) {
                              setBreadcrumbPath(prev => [...prev, {
                                id: binaryStockData.user.id,
                                name: binaryStockData.user.fullName,
                                memberId: binaryStockData.user.memberId
                              }]);
                            }

                            // Navigate to clicked stockist's tree
                            setCurrentRootUserId(stockist.id);
                            loadBinaryStock(stockist.id);
                            loadStockistsByLevel(stockist.id);

                            // Clear expanded downlines since we're navigating to a new view
                            setSelectedStockistForView(null);
                            setExpandedDownlines(new Map());
                          }}
                        >
                          <CardContent className="p-3">
                            <div className="text-center space-y-2">
                              <div className="flex items-center justify-center">
                                {stockist.rank && stockist.rank !== 'Member' ? (
                                  <div className="h-10 w-10 rounded-full overflow-hidden flex items-center justify-center">
                                    <RankBadge rank={stockist.rank as any} className="h-10 w-10 rounded-full" />
                                  </div>
                                ) : (
                                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                                    {stockist.fullName.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="font-semibold text-xs truncate">{stockist.fullName}</p>
                                <p className="text-[10px] text-muted-foreground">{stockist.memberId}</p>
                                {isCurrentUser && (
                                  <Badge variant="outline" className="text-[9px] mt-1 bg-purple-100 border-purple-300 text-purple-700">
                                    {t('binaryStock.currentUser') || 'You'}
                                  </Badge>
                                )}
                              </div>
                              <Badge className={cn("text-[10px] font-semibold py-0 px-2", levelBadgeColors[level])}>
                                {t('adminBinaryStock.level')} {level}
                              </Badge>
                              <div className="space-y-1">
                                <div className={cn("p-2 rounded-lg border-2",
                                  stockist.stockLevel > 100 ? 'bg-green-50 border-green-200 text-green-700' :
                                    stockist.stockLevel > 50 ? 'bg-yellow-50 border-yellow-200 text-yellow-700' :
                                      'bg-red-50 border-red-200 text-red-700'
                                )}>
                                  <div className="flex items-center justify-center gap-1">
                                    <Package className="h-4 w-4" />
                                    <span className="font-bold text-base">{stockist.productCount || 0}</span>
                                  </div>
                                  <p className="text-[10px] mt-0.5">{t('adminBinaryStock.stockLevel')}</p>
                                </div>
                                <div className="text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <BarChart3 className="h-3 w-3" />
                                    <p className="text-[10px] text-muted-foreground font-medium">
                                      {stockist.stockLevel} {t('binaryStock.totalQty')}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              {/* Only show Transfer Stock button if this is NOT the current user */}
                              {!isCurrentUser && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="w-full mt-2 text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleTransferStock(stockist, e);
                                  }}
                                >
                                  <Send className="h-3 w-3 mr-1" />
                                  {t('binaryStock.transferStock')}
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    );
                  };

                  return (
                    <div
                      className="w-full min-h-full pb-12 pt-4 px-6"
                      style={{
                        scrollBehavior: 'smooth',
                        WebkitOverflowScrolling: 'touch',
                        minWidth: `${minWidth}px`
                      }}
                    >
                      <div className="space-y-8 mt-6 flex flex-col items-center" style={{ minWidth: `${minWidth}px` }}>
                        {/* Row 1: Stock Level D */}
                        {stockistsByLevel.D.length > 0 && (
                          <div className="space-y-4 w-full flex flex-col items-center">
                            <div className="flex items-center justify-center gap-2 mb-2">
                              <Badge className="bg-purple-600 text-white text-sm px-3 py-1">
                                {t('adminBinaryStock.levelD')} ({stockistsByLevel.D.length})
                              </Badge>
                            </div>
                            <div className="flex items-start justify-center gap-4 flex-nowrap relative" style={{ minWidth: `${Math.max(stockistsByLevel.D.length * 200, 800)}px` }}>
                              {/* Horizontal connector line for multiple D level stockists */}
                              {stockistsByLevel.D.length > 1 && (
                                <div className="absolute top-0 left-0 right-0 h-0.5 bg-purple-300 -mt-4"></div>
                              )}
                              {stockistsByLevel.D.map((stockist, index) => renderStockistCard(stockist, 'D', index))}
                            </div>
                            {/* Connector line from D to C */}
                            {stockistsByLevel.C.length > 0 && (
                              <div className="w-0.5 h-8 bg-gradient-to-b from-purple-400 to-blue-400 my-2"></div>
                            )}
                          </div>
                        )}

                        {/* Row 2: Stock Level C */}
                        {stockistsByLevel.C.length > 0 && (
                          <div className="space-y-4 w-full flex flex-col items-center">
                            <div className="flex items-center justify-center gap-2 mb-2">
                              <Badge className="bg-blue-600 text-white text-sm px-3 py-1">
                                {t('adminBinaryStock.levelC')} ({stockistsByLevel.C.length})
                              </Badge>
                            </div>
                            <div className="flex items-start justify-center gap-4 flex-nowrap relative" style={{ minWidth: `${Math.max(stockistsByLevel.C.length * 200, 800)}px` }}>
                              {/* Horizontal connector line for multiple C level stockists */}
                              {stockistsByLevel.C.length > 1 && (
                                <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-300 -mt-4"></div>
                              )}
                              {stockistsByLevel.C.map((stockist, index) => renderStockistCard(stockist, 'C', index))}
                            </div>
                            {/* Connector line from C to M */}
                            {stockistsByLevel.M.length > 0 && (
                              <div className="w-0.5 h-8 bg-gradient-to-b from-blue-400 to-green-400 my-2"></div>
                            )}
                          </div>
                        )}

                        {/* Row 3: Stock Level M */}
                        {stockistsByLevel.M.length > 0 && (
                          <div className="space-y-4 w-full flex flex-col items-center">
                            <div className="flex items-center justify-center gap-2 mb-2">
                              <Badge className="bg-green-600 text-white text-sm px-3 py-1">
                                {t('adminBinaryStock.levelM')} ({stockistsByLevel.M.length})
                              </Badge>
                            </div>
                            <div className="flex items-start justify-center gap-4 flex-nowrap relative" style={{ minWidth: `${Math.max(stockistsByLevel.M.length * 200, 800)}px` }}>
                              {/* Horizontal connector line for multiple M level stockists */}
                              {stockistsByLevel.M.length > 1 && (
                                <div className="absolute top-0 left-0 right-0 h-0.5 bg-green-300 -mt-4"></div>
                              )}
                              {stockistsByLevel.M.map((stockist, index) => renderStockistCard(stockist, 'M', index))}
                            </div>
                            {/* Connector line from M to S */}
                            {stockistsByLevel.S.length > 0 && (
                              <div className="w-0.5 h-8 bg-gradient-to-b from-green-400 to-yellow-400 my-2"></div>
                            )}
                          </div>
                        )}

                        {/* Row 4: Stock Level S */}
                        {stockistsByLevel.S.length > 0 && (
                          <div className="space-y-4 w-full flex flex-col items-center">
                            <div className="flex items-center justify-center gap-2 mb-2">
                              <Badge className="bg-yellow-600 text-white text-sm px-3 py-1">
                                {t('adminBinaryStock.levelS')} ({stockistsByLevel.S.length})
                              </Badge>
                            </div>
                            <div className="flex items-start justify-center gap-4 flex-nowrap relative" style={{ minWidth: `${Math.max(stockistsByLevel.S.length * 200, 800)}px` }}>
                              {/* Horizontal connector line for multiple S level stockists */}
                              {stockistsByLevel.S.length > 1 && (
                                <div className="absolute top-0 left-0 right-0 h-0.5 bg-yellow-300 -mt-4"></div>
                              )}
                              {stockistsByLevel.S.map((stockist, index) => renderStockistCard(stockist, 'S', index))}
                            </div>
                          </div>
                        )}

                        {/* No stockists message */}
                        {stockistsByLevel.D.length === 0 && stockistsByLevel.C.length === 0 && stockistsByLevel.M.length === 0 && stockistsByLevel.S.length === 0 && (
                          <div className="text-center py-8 text-muted-foreground">
                            <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>{t('adminBinaryStock.noStockistsAtLevel') || 'No stockists assigned yet'}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </div>

      {/* Transfer Dialog */}
      {binaryStockData && selectedRecipient && (
        <TransferToDownlineDialog
          isOpen={isTransferDialogOpen}
          onOpenChange={(open) => {
            setTransferDialogOpen(open);
            if (!open) {
              setSelectedRecipient(null);
            }
          }}
          products={products.filter(p => p.stock.quantity > 0)}
          stockist={{
            id: binaryStockData.user.id,
            fullName: binaryStockData.user.fullName,
            memberId: binaryStockData.user.memberId,
            storeOwnerLevel: binaryStockData.user.storeOwnerLevel,
            firstName: binaryStockData.user.fullName.split(' ')[0] || '',
            surname: binaryStockData.user.fullName.split(' ').slice(1).join(' ') || '',
          } as Member}
          downline={downlineMembers.some(m => m.id === selectedRecipient.id)
            ? downlineMembers
            : [
              ...downlineMembers,
              {
                id: selectedRecipient.id,
                fullName: selectedRecipient.fullName,
                memberId: selectedRecipient.memberId,
                storeOwnerLevel: selectedRecipient.storeOwnerLevel,
                firstName: selectedRecipient.fullName.split(' ')[0] || '',
                surname: selectedRecipient.fullName.split(' ').slice(1).join(' ') || '',
              } as Member
            ]}
          preSelectedRecipientId={selectedRecipient.id}
          commissionMode="differential"
          onSuccess={() => {
            // Clear expanded downlines to force refresh
            setExpandedDownlines(new Map());
            setSelectedStockistForView(null);
            // Reload all data after transfer
            setTimeout(() => {
              loadBinaryStock(currentRootUserId);
              loadStockistsByLevel(currentRootUserId);
              loadProductsAndDownline();
            }, 500); // Small delay to ensure database is updated
            setSelectedRecipient(null);
          }}
        />
      )}

      {/* Add Stockist to Network Dialog - for Admin users only */}
      <Dialog open={isAssignLevelDialogOpen} onOpenChange={setIsAssignLevelDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <Users className="h-6 w-6 text-purple-600" />
              {t('adminBinaryStock.addStockistToNetwork') || 'Add Stockist to Network'}
            </DialogTitle>
            <DialogDescription>
              {t('adminBinaryStock.addStockistToNetworkDesc') || 'Add a new stockist to your binary stock network. Select a parent stockist and assign an appropriate level.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Member Selection - Show ALL users WITHOUT stock level from entire system */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">
                {t('adminBinaryStock.selectMemberNoLevel') || 'Select Member (No Stock Level Yet)'}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('adminBinaryStock.chooseDownlineStockAllUsersDesc') || 'Search and select any member in the system who does not have a stock level yet'}
              </p>

              <Select
                value={selectedMemberForAssign}
                onValueChange={(value) => {
                  setSelectedMemberForAssign(value);
                  const member = allUsersWithoutLevel.find(m => m.id === value);
                  if (member) {
                    setAssigningToNode(member);
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('adminBinaryStock.chooseMemberNoLevel') || 'Choose a member without stock level...'} />
                </SelectTrigger>
                <SelectContent className="max-h-96">
                  {/* Search input inside dropdown */}
                  <div className="px-2 py-2 sticky top-0 bg-white border-b z-10">
                    <Input
                      placeholder={t('adminBinaryStock.searchUserByIdOrName') || 'Search user by ID or name...'}
                      value={memberSearchQuery}
                      onChange={(e) => setMemberSearchQuery(e.target.value)}
                      className="w-full h-9"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                  {/* Show ALL users in the system WITHOUT stock level, filtered by search */}
                  {allUsersWithoutLevel
                    .filter(m => {
                      if (!memberSearchQuery) return true;
                      const query = memberSearchQuery.toLowerCase();
                      return m.fullName.toLowerCase().includes(query) ||
                        m.memberId.toLowerCase().includes(query);
                    })
                    .length > 0 ? (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-orange-700 bg-orange-50 sticky top-10">
                        👤 {t('adminBinaryStock.allUsersWithoutLevel') || 'All Users Without Stock Level'} ({allUsersWithoutLevel.filter(m => {
                          if (!memberSearchQuery) return true;
                          const query = memberSearchQuery.toLowerCase();
                          return m.fullName.toLowerCase().includes(query) ||
                            m.memberId.toLowerCase().includes(query);
                        }).length})
                      </div>
                      {allUsersWithoutLevel
                        .filter(m => {
                          if (!memberSearchQuery) return true;
                          const query = memberSearchQuery.toLowerCase();
                          return m.fullName.toLowerCase().includes(query) ||
                            m.memberId.toLowerCase().includes(query);
                        })
                        .map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs bg-orange-100 border-orange-300 text-orange-700">NEW</Badge>
                              <span className="font-medium">{member.fullName}</span>
                              <span className="text-muted-foreground text-xs">({member.memberId})</span>
                            </div>
                          </SelectItem>
                        ))}
                    </>
                  ) : (
                    <div className="px-2 py-4 text-center text-muted-foreground text-sm">
                      {memberSearchQuery
                        ? (t('adminBinaryStock.noUsersFoundSearch') || 'No users found matching your search')
                        : (t('adminBinaryStock.noUsersWithoutLevel') || 'No users without stock level found in the system')}
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Selected Member Info */}
            {assigningToNode && (
              <div className="p-4 bg-purple-50 border-2 border-purple-200 rounded-lg">
                <div className="flex items-center gap-3">
                  {assigningToNode.rank && assigningToNode.rank !== 'Member' ? (
                    <div className="h-12 w-12 rounded-full overflow-hidden flex items-center justify-center">
                      <RankBadge rank={assigningToNode.rank as any} className="h-12 w-12 rounded-full" />
                    </div>
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                      {assigningToNode.fullName.split(' ').map(n => n[0]).join('').substring(0, 2)}
                    </div>
                  )}
                  <div>
                    <p className="font-semibold">{assigningToNode.fullName}</p>
                    <p className="text-sm text-muted-foreground">{assigningToNode.memberId}</p>
                    {assigningToNode.storeOwnerLevel ? (
                      <Badge variant="secondary" className="mt-1">
                        {t('adminBinaryStock.currentLevel')}: {assigningToNode.storeOwnerLevel}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="mt-1 text-orange-600 border-orange-300">
                        {t('adminBinaryStock.noLevelYet') || 'No stock level yet'}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Stock Level Selection */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">
                {t('adminBinaryStock.selectLevel') || 'Select Stock Level'}
              </Label>
              <Select
                value={selectedStockLevel}
                onValueChange={setSelectedStockLevel}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('adminBinaryStock.chooseLevel') || 'Choose a level...'} />
                </SelectTrigger>
                <SelectContent>
                  {availableStockLevels.map((level) => (
                    <SelectItem key={level} value={level}>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn(
                          "text-sm",
                          level === 'D' && 'bg-purple-100 border-purple-300 text-purple-700',
                          level === 'C' && 'bg-blue-100 border-blue-300 text-blue-700',
                          level === 'M' && 'bg-green-100 border-green-300 text-green-700',
                          level === 'S' && 'bg-yellow-100 border-yellow-300 text-yellow-700'
                        )}>
                          {level}
                        </Badge>
                        <span>
                          {level === 'D' && (t('adminBinaryStock.dealer') || 'Dealer')}
                          {level === 'C' && (t('adminBinaryStock.center') || 'Center')}
                          {level === 'M' && (t('adminBinaryStock.mobile') || 'Mobile')}
                          {level === 'S' && (t('adminBinaryStock.smallMobile') || 'Small Mobile')}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableStockLevels.length === 0 && (
                <p className="text-sm text-orange-600">
                  {t('adminBinaryStock.noLevelsAvailable') || 'No levels available to assign'}
                </p>
              )}
            </div>

          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAssignLevelDialogOpen(false)}
              disabled={assigningLevel}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleAssignStockLevel}
              disabled={!selectedMemberForAssign || !selectedStockLevel || assigningLevel}
              className="gap-2 bg-purple-600 hover:bg-purple-700"
            >
              {assigningLevel ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('adminBinaryStock.assigning') || 'Assigning...'}
                </>
              ) : (
                <>
                  <Users className="h-4 w-4" />
                  {t('adminBinaryStock.assignLevel') || 'Assign Level'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
