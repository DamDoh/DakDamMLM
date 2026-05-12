'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/internationalization';
import { GitBranch, Package, Users, ArrowRight, Loader2, Search, Send, RefreshCw, BarChart3, AlertCircle, Building2, ChevronDown, UserPlus, UserCog, ArrowRightLeft } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import RankBadge from '@/components/genealogy/rank-badge';
import StockRequests from '@/components/admin/stock-requests';
import TransferToMemberByIdDialog from '@/components/admin/transfer-to-member-by-id-dialog';
import { useAuthContext } from '@/context/auth-context';

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

interface StockItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
}

interface StockInventory {
  items: StockItem[];
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

// Stockist by level for hierarchical view
interface StockistByLevel {
  id: string;
  fullName: string;
  memberId: string;
  storeOwnerLevel: string;
  stockLevel: number;
  productCount: number;
  rank?: string;
}

export default function BinaryStockPage() {
  const { toast } = useToast();
  const { t } = useI18n();
  const { user: authUser } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [binaryStockData, setBinaryStockData] = useState<BinaryStockData | null>(null);
  const [searchMemberId, setSearchMemberId] = useState('');
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [isTransferToMemberDialogOpen, setIsTransferToMemberDialogOpen] = useState(false);
  const [isBinaryTreeViewDialogOpen, setIsBinaryTreeViewDialogOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<BinaryNode | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Array<{productId: string; quantity: number}>>([]);
  const [availableProducts, setAvailableProducts] = useState<StockItem[]>([]);

  // Navigation state - track current root and breadcrumb path
  const [currentRootUserId, setCurrentRootUserId] = useState<string | undefined>(undefined);
  const [breadcrumbPath, setBreadcrumbPath] = useState<Array<{id: string; name: string; memberId: string}>>([]);
  
  // State for row-based view: track selected stockist to show their downlines
  const [selectedStockistForView, setSelectedStockistForView] = useState<string | null>(null);
  const [expandedDownlines, setExpandedDownlines] = useState<Map<string, BinaryNode[]>>(new Map());

  // New state for stock levels and products
  const [stockLevels, setStockLevels] = useState<Array<{level: string; name: string; productCount: number}>>([]);
  const [productsFromCatalog, setProductsFromCatalog] = useState<Array<{id: string; name: string; quantity: number; category: string}>>([]);
  const [catalogProductsForTransfer, setCatalogProductsForTransfer] = useState<Array<{id: string; name: string; category: string; qty: number; price: number; pv: number; imageUrl?: string | null}>>([]);
  const [loadingStockData, setLoadingStockData] = useState(false);

  // Stockists grouped by level for hierarchical view
  const [stockistsByLevel, setStockistsByLevel] = useState<{
    D: StockistByLevel[];
    C: StockistByLevel[];
    M: StockistByLevel[];
    S: StockistByLevel[];
  }>({ D: [], C: [], M: [], S: [] });
  const [loadingStockists, setLoadingStockists] = useState(false);

  // Assign Stock Level Dialog state
  const [isAssignLevelDialogOpen, setIsAssignLevelDialogOpen] = useState(false);
  const [isChangeLevelDialogOpen, setIsChangeLevelDialogOpen] = useState(false);
  const [assigningToNode, setAssigningToNode] = useState<BinaryNode | null>(null);
  const [selectedStockLevel, setSelectedStockLevel] = useState<string>('');
  const [autoAssignSponsor, setAutoAssignSponsor] = useState(false);
  const [assigningLevel, setAssigningLevel] = useState(false);
  const [availableStockLevels, setAvailableStockLevels] = useState<string[]>(['S', 'M', 'C', 'D']);
  
  // Change Stock Level Dialog state
  const [selectedStockistToChange, setSelectedStockistToChange] = useState<string>('');
  const [newStockLevel, setNewStockLevel] = useState<string>('');
  const [changingLevel, setChangingLevel] = useState(false);
  const [stockistSearchQuery, setStockistSearchQuery] = useState<string>('');

  // All members for selection (including those without stock level)
  const [allBinaryMembers, setAllBinaryMembers] = useState<BinaryNode[]>([]);
  const [selectedMemberForAssign, setSelectedMemberForAssign] = useState<string>('');
  const [memberSearchQuery, setMemberSearchQuery] = useState<string>('');
  
  // Downline stock selection - which AdminStock to place under
  const [selectedDownlineStock, setSelectedDownlineStock] = useState<string>('');
  const [allAdminStocks, setAllAdminStocks] = useState<BinaryNode[]>([]); // AdminStocks with level D, C, M, S
  
  // All users without stock level (from entire system, not just binary downline)
  const [allUsersWithoutLevel, setAllUsersWithoutLevel] = useState<BinaryNode[]>([]);
  const [downlineSearchQuery, setDownlineSearchQuery] = useState<string>('');
  
  // All users (with and without stock levels) for upgrade functionality
  const [allUsers, setAllUsers] = useState<BinaryNode[]>([]);


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

  useEffect(() => {
    loadBinaryStock();
    loadStockAndProducts();
    loadStockistsByLevel();
  }, []);

  // Helper function to extract all stockists from binary tree (excluding ADMIN001)
  const extractStockistsFromTree = (node: BinaryNode | null, stockists: StockistByLevel[]) => {
    if (!node) return;
    
    // Skip ADMIN001 (company/admin)
    if (node.memberId === 'ADMIN001') {
      // Still traverse children but skip this node
      if (node.left) extractStockistsFromTree(node.left, stockists);
      if (node.right) extractStockistsFromTree(node.right, stockists);
      return;
    }
    
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

  // Helper function to extract ALL members from binary tree (including those without stock level)
  const extractAllMembersFromTree = (node: BinaryNode | null, members: BinaryNode[]) => {
    if (!node) return;
    members.push(node);
    if (node.left) extractAllMembersFromTree(node.left, members);
    if (node.right) extractAllMembersFromTree(node.right, members);
  };

  // Helper function to get stock level priority (higher number = higher priority)
  const getStockLevelPriority = (level: string | null): number => {
    if (!level) return 0;
    const priorities: Record<string, number> = { 'D': 4, 'C': 3, 'M': 2, 'S': 1 };
    return priorities[level] || 0;
  };

  // Reorganize tree to show stock levels in hierarchical order (D > C > M > S)
  // Flow: D at top, C below D, M below C, S below M
  // Shows ALL stockists at each level, not just one
  const reorganizeTreeByStockLevel = (node: BinaryNode | null): BinaryNode | null => {
    if (!node) return null;

    // Collect all nodes from the tree, excluding ADMIN001 (company/admin)
    const collectAllNodes = (n: BinaryNode | null, nodes: BinaryNode[] = []): void => {
      if (!n) return;
      // Skip ADMIN001
      if (n.memberId !== 'ADMIN001') {
        nodes.push(n);
      }
      if (n.left) collectAllNodes(n.left, nodes);
      if (n.right) collectAllNodes(n.right, nodes);
    };

    const allNodes: BinaryNode[] = [];
    collectAllNodes(node, allNodes);

    // Filter to only include stockists (users with stock levels)
    const stockists = allNodes.filter(n => n.storeOwnerLevel && ['D', 'C', 'M', 'S'].includes(n.storeOwnerLevel));

    if (stockists.length === 0) return null;

    // Group stockists by level
    const byLevel = {
      D: stockists.filter(s => s.storeOwnerLevel === 'D'),
      C: stockists.filter(s => s.storeOwnerLevel === 'C'),
      M: stockists.filter(s => s.storeOwnerLevel === 'M'),
      S: stockists.filter(s => s.storeOwnerLevel === 'S')
    };

    // Sort each level by stock quantity (higher first)
    byLevel.D.sort((a, b) => b.stockLevel - a.stockLevel);
    byLevel.C.sort((a, b) => b.stockLevel - a.stockLevel);
    byLevel.M.sort((a, b) => b.stockLevel - a.stockLevel);
    byLevel.S.sort((a, b) => b.stockLevel - a.stockLevel);

    // Build hierarchical tree: D -> C -> M -> S
    // This function builds a node and assigns children from the next lower level
    const buildNodeWithChildren = (stockist: BinaryNode, childLevel: 'C' | 'M' | 'S' | null, usedIndices: Map<string, Set<number>>): BinaryNode => {
      const parent: BinaryNode = {
        ...stockist,
        left: null,
        right: null
      };

      if (!childLevel) return parent;

      const childNodes = byLevel[childLevel];
      const usedSet = usedIndices.get(childLevel) || new Set<number>();
      
      // Find first unused child for left
      for (let i = 0; i < childNodes.length; i++) {
        if (!usedSet.has(i)) {
          usedSet.add(i);
          usedIndices.set(childLevel, usedSet);
          
          // Determine next child level
          let nextChildLevel: 'M' | 'S' | null = null;
          if (childLevel === 'C') nextChildLevel = 'M';
          else if (childLevel === 'M') nextChildLevel = 'S';
          
          parent.left = buildNodeWithChildren(childNodes[i], nextChildLevel, usedIndices);
          break;
        }
      }

      // Find second unused child for right
      for (let i = 0; i < childNodes.length; i++) {
        if (!usedSet.has(i)) {
          usedSet.add(i);
          usedIndices.set(childLevel, usedSet);
          
          // Determine next child level
          let nextChildLevel: 'M' | 'S' | null = null;
          if (childLevel === 'C') nextChildLevel = 'M';
          else if (childLevel === 'M') nextChildLevel = 'S';
          
          parent.right = buildNodeWithChildren(childNodes[i], nextChildLevel, usedIndices);
          break;
        }
      }

      return parent;
    };

    // Build tree starting from D level
    // Create a structure that shows ALL stockists at each level
    const usedIndices = new Map<string, Set<number>>();
    usedIndices.set('D', new Set<number>());
    usedIndices.set('C', new Set<number>());
    usedIndices.set('M', new Set<number>());
    usedIndices.set('S', new Set<number>());

    // Helper to recursively find a node at the same level that can accept a sibling
    const findSiblingSlot = (node: BinaryNode, targetLevel: string): BinaryNode | null => {
      // If this node is at the target level and doesn't have a right sibling, return it
      if (node.storeOwnerLevel === targetLevel && !node.right) {
        return node;
      }
      
      // Check left branch
      if (node.left) {
        const leftResult = findSiblingSlot(node.left, targetLevel);
        if (leftResult) return leftResult;
      }
      
      // Check right branch
      if (node.right) {
        const rightResult = findSiblingSlot(node.right, targetLevel);
        if (rightResult) return rightResult;
      }
      
      return null;
    };

    // Build tree with all nodes at each level
    if (byLevel.D.length > 0) {
      // Build all D nodes with their C children
      const builtDNodes = byLevel.D.map(dNode => buildNodeWithChildren(dNode, 'C', usedIndices));
      
      // Connect all D nodes as siblings (using right branches)
      let root = builtDNodes[0];
      for (let i = 1; i < builtDNodes.length; i++) {
        // Find a D node that doesn't have a right sibling yet
        const slot = findSiblingSlot(root, 'D');
        if (slot) {
          slot.right = builtDNodes[i];
        } else {
          // If we can't find a slot, create a chain by attaching to the rightmost D
          // This is a fallback - should rarely happen
          const attachToRightmost = (n: BinaryNode): BinaryNode => {
            if (!n.right || (n.right.storeOwnerLevel !== 'D' && !n.right.right)) {
              return n;
            }
            return attachToRightmost(n.right);
          };
          const rightmost = attachToRightmost(root);
          rightmost.right = builtDNodes[i];
        }
      }
      
      return root;
    } else if (byLevel.C.length > 0) {
      // Build all C nodes with their M children
      const builtCNodes = byLevel.C.map(cNode => buildNodeWithChildren(cNode, 'M', usedIndices));
      
      let root = builtCNodes[0];
      for (let i = 1; i < builtCNodes.length; i++) {
        const slot = findSiblingSlot(root, 'C');
        if (slot) {
          slot.right = builtCNodes[i];
        } else {
          const attachToRightmost = (n: BinaryNode): BinaryNode => {
            if (!n.right || (n.right.storeOwnerLevel !== 'C' && !n.right.right)) {
              return n;
            }
            return attachToRightmost(n.right);
          };
          const rightmost = attachToRightmost(root);
          rightmost.right = builtCNodes[i];
        }
      }
      
      return root;
    } else if (byLevel.M.length > 0) {
      // Build all M nodes with their S children
      const builtMNodes = byLevel.M.map(mNode => buildNodeWithChildren(mNode, 'S', usedIndices));
      
      let root = builtMNodes[0];
      for (let i = 1; i < builtMNodes.length; i++) {
        const slot = findSiblingSlot(root, 'M');
        if (slot) {
          slot.right = builtMNodes[i];
        } else {
          const attachToRightmost = (n: BinaryNode): BinaryNode => {
            if (!n.right || (n.right.storeOwnerLevel !== 'M' && !n.right.right)) {
              return n;
            }
            return attachToRightmost(n.right);
          };
          const rightmost = attachToRightmost(root);
          rightmost.right = builtMNodes[i];
        }
      }
      
      return root;
    } else if (byLevel.S.length > 0) {
      // For S level, connect all S nodes as siblings
      const builtSNodes: BinaryNode[] = byLevel.S.map(sNode => ({
        ...sNode,
        left: null as BinaryNode | null,
        right: null as BinaryNode | null
      }));
      
      // Connect all S nodes as siblings
      for (let i = 0; i < builtSNodes.length - 1; i++) {
        builtSNodes[i].right = builtSNodes[i + 1];
      }
      
      return builtSNodes[0]; // Return first S node as root
    }

    return null;
  };

  // Recursive function to render binary tree node with children
  const renderTreeNode = (node: BinaryNode | null, depth: number = 0): JSX.Element | null => {
    if (!node) return null;
    
    // Filter out ADMIN001 (company/admin) from the tree display
    if (node.memberId === 'ADMIN001') {
      // Still render children if they exist, but skip this node
      const children: Array<{ node: BinaryNode; priority: number; side: 'left' | 'right' }> = [];
      if (node.left && node.left.memberId !== 'ADMIN001') {
        children.push({ node: node.left, priority: getStockLevelPriority(node.left.storeOwnerLevel), side: 'left' });
      }
      if (node.right && node.right.memberId !== 'ADMIN001') {
        children.push({ node: node.right, priority: getStockLevelPriority(node.right.storeOwnerLevel), side: 'right' });
      }
      children.sort((a, b) => b.priority - a.priority);
      
      if (children.length === 0) return null;
      
      // Render children directly without showing this node
      return (
        <div className="flex items-start justify-center mt-2 relative">
          {children.map((child, index) => (
            <div 
              key={child.node.id} 
              className="flex flex-col items-center" 
              style={{ 
                marginLeft: index > 0 ? '4rem' : '0',
                marginRight: index < children.length - 1 ? '4rem' : '0'
              }}
            >
              {renderTreeNode(child.node, depth)}
            </div>
          ))}
        </div>
      );
    }

    const stockColor = node.stockLevel > 100 ? 'bg-green-50 border-green-200 text-green-700' : node.stockLevel > 50 ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-red-50 border-red-200 text-red-700';
    const stockIconColor = node.stockLevel > 100 ? 'text-green-600' : node.stockLevel > 50 ? 'text-yellow-600' : 'text-red-600';
    
    // Sort children by stock level priority (D > C > M > S) so higher levels appear above
    // Also filter out ADMIN001 (company/admin)
    const children: Array<{ node: BinaryNode; priority: number; side: 'left' | 'right' }> = [];
    if (node.left && node.left.memberId !== 'ADMIN001') {
      children.push({ node: node.left, priority: getStockLevelPriority(node.left.storeOwnerLevel), side: 'left' });
    }
    if (node.right && node.right.memberId !== 'ADMIN001') {
      children.push({ node: node.right, priority: getStockLevelPriority(node.right.storeOwnerLevel), side: 'right' });
    }
    // Sort by priority (descending) so higher stock levels appear first/above
    // If priorities are equal, maintain original order
    children.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority; // Higher priority first
      }
      // If same priority, sort by stock level (higher stock first)
      return b.node.stockLevel - a.node.stockLevel;
    });
    
    const hasChildren = children.length > 0;
    const levelBadge = node.storeOwnerLevel ? (
      <Badge variant="secondary" className="text-[10px] font-semibold py-0 px-2">
        {t('adminBinaryStock.level')} {node.storeOwnerLevel}
      </Badge>
    ) : null;

    return (
      <div key={node.id} className="flex flex-col items-center">
        {/* Vertical connector line from parent */}
        {depth > 0 && (
          <div className="w-0.5 h-6 bg-cyan-400 mb-2"></div>
        )}
        
        {/* Node Card */}
        <Card 
          className="w-40 transition-all duration-300 border-2 cursor-pointer hover:shadow-xl hover:scale-105 group"
          onClick={() => handleNodeClick(node, false)}
        >
          <CardContent className="p-3">
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center">
                {node.rank && node.rank !== 'Member' ? (
                  <div className="h-10 w-10 rounded-full overflow-hidden flex items-center justify-center">
                    <RankBadge rank={node.rank as any} className="h-10 w-10 rounded-full" />
                  </div>
                ) : (
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                    {node.fullName.split(' ').map(n => n[0]).join('').substring(0, 2)}
                  </div>
                )}
              </div>
              <div>
                <p className="font-semibold text-xs truncate">{node.fullName}</p>
                <p className="text-[10px] text-muted-foreground">{node.memberId}</p>
              </div>
              {levelBadge}
              <div className="space-y-1">
                <div className={cn("p-2 rounded-lg border-2", stockColor)}>
                  <div className="flex items-center justify-center gap-1">
                    <Package className={cn("h-4 w-4", stockIconColor)} />
                    <span className="font-bold text-base">{node.productCount || 0}</span>
                  </div>
                  <p className="text-[10px] mt-0.5">{t('adminBinaryStock.stockLevel')}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <BarChart3 className={cn("h-3 w-3", stockIconColor)} />
                    <p className="text-[10px] text-muted-foreground font-medium">
                      {node.stockLevel} {t('binaryStock.totalQty')}
                    </p>
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full mt-2 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                onClick={(e) => handleTransferStock(node, e)}
              >
                <Send className="h-3 w-3 mr-1" />
                {t('binaryStock.transferStock')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Children Container - sorted by stock level priority */}
        {hasChildren && (
          <>
            {/* Vertical connector line to children */}
            <div className="w-0.5 h-6 bg-cyan-400 mt-2"></div>
            
            {/* Horizontal container for children - sorted by stock level (D > C > M > S) */}
            <div className="flex items-start justify-center mt-2 relative">
              {children.map((child, index) => (
                <div 
                  key={child.node.id} 
                  className="flex flex-col items-center" 
                  style={{ 
                    marginLeft: index > 0 ? '4rem' : '0',
                    marginRight: index < children.length - 1 ? '4rem' : '0'
                  }}
                >
                  {renderTreeNode(child.node, depth + 1)}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  // Sort members by stock level hierarchy (D > C > M > S > no level)
  const sortMembersByStockLevel = (members: BinaryNode[]): BinaryNode[] => {
    const levelOrder: Record<string, number> = { 'D': 1, 'C': 2, 'M': 3, 'S': 4 };
    return [...members].sort((a, b) => {
      const aOrder = a.storeOwnerLevel ? levelOrder[a.storeOwnerLevel] || 99 : 99;
      const bOrder = b.storeOwnerLevel ? levelOrder[b.storeOwnerLevel] || 99 : 99;
      if (aOrder !== bOrder) return aOrder - bOrder;
      // If same level, sort by name
      return a.fullName.localeCompare(b.fullName);
    });
  };

  // Handle opening Assign Stock Level dialog
  const handleOpenAssignLevelDialog = async (node?: BinaryNode, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }

    // Fetch all users without stock level (entire system)
    await fetchAllUsersWithoutLevel();

    // Fetch available stock levels
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

    // Fetch ALL stockists from database (not just from tree structure)
    // This ensures all stockists appear in the dropdown, even if they're not in the genealogy tree
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/members', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const result = await response.json();
        const usersArray = Array.isArray(result) ? result : (result.data || []);
        
        // Filter to only include users with stock levels (D, C, M, S) and exclude ADMIN001
        const stockists = usersArray
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
            stockLevel: 0, // Will be calculated if needed
            productCount: 0
          }));
        
        setAllBinaryMembers(sortMembersByStockLevel(stockists));
        setAllAdminStocks(sortMembersByStockLevel(stockists));
      } else {
        // Fallback: Extract from tree if API fails
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
          const adminStocks = allMembers.filter(m => m.storeOwnerLevel && ['D', 'C', 'M', 'S'].includes(m.storeOwnerLevel));
          setAllAdminStocks(sortMembersByStockLevel(adminStocks));
        } else {
          setAllBinaryMembers([]);
          setAllAdminStocks([]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch all stockists:', error);
      // Fallback: Extract from tree if API fails
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
        const adminStocks = allMembers.filter(m => m.storeOwnerLevel && ['D', 'C', 'M', 'S'].includes(m.storeOwnerLevel));
        setAllAdminStocks(sortMembersByStockLevel(adminStocks));
      } else {
        setAllBinaryMembers([]);
        setAllAdminStocks([]);
      }
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
    setSelectedDownlineStock(''); // Reset downline stock selection
    setDownlineSearchQuery(''); // Reset downline search query
    setIsAssignLevelDialogOpen(true);
  };

  // Handle assigning stock level
  const handleAssignStockLevel = async () => {
    // selectedMemberForAssign = Parent stock (member WITH stock level)
    // selectedDownlineStock = Member WITHOUT stock level who will receive the new level
    if (!selectedMemberForAssign || !selectedDownlineStock || !selectedStockLevel) {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: t('adminBinaryStock.selectAllFields') || 'Please select parent stock, downline member, and stock level',
      });
      return;
    }

    try {
      setAssigningLevel(true);
      const token = localStorage.getItem('auth_token');

      const response = await fetch('/api/binary-stock/assign-level', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetUserId: selectedDownlineStock, // The member who will receive the stock level
          stockLevel: selectedStockLevel,
          parentStockId: selectedMemberForAssign // The parent stock (member with stock level)
        })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: t('common.success'),
          description: result.message || t('adminBinaryStock.levelAssignedSuccess'),
        });
        
        // Show additional info if sponsor was assigned
        if (result.data?.sponsorLevelAssigned) {
          toast({
            title: t('adminBinaryStock.sponsorLevelAssigned') || 'Sponsor Level Assigned',
            description: `${result.data.sponsorLevelAssigned.sponsorName} was assigned level ${result.data.sponsorLevelAssigned.assignedLevel}`,
          });
        }

        setIsAssignLevelDialogOpen(false);
        // Reload data
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

  // Handle assigning stock level to member (Add/Upgrade Stock Level - no parent relationship)
  // This function only assigns the stock level, it does NOT create a parent-child relationship
  // For parent-child relationships, use "Add Stockist to Network" instead
  const handleChangeStockLevel = async () => {
    if (!selectedStockistToChange || !newStockLevel) {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: t('adminBinaryStock.selectMemberAndLevel') || 'Please select a member and stock level',
      });
      return;
    }

    try {
      setChangingLevel(true);
      const token = localStorage.getItem('auth_token');

      // For "Add/Upgrade Stock Level", do NOT set parentStockId
      // This only assigns the stock level without creating a parent-child relationship
      // The user will appear in Binary Tree Stock View but won't be linked to any parent
      const response = await fetch('/api/binary-stock/assign-level', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetUserId: selectedStockistToChange, // The member who will receive the stock level
          stockLevel: newStockLevel,
          // Do NOT send parentStockId - this function only assigns level, no parent relationship
        })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: t('common.success'),
          description: result.message || t('adminBinaryStock.levelAssignedSuccess') || 'Stock level assigned successfully',
        });
        
        setIsChangeLevelDialogOpen(false);
        setSelectedStockistToChange('');
        setNewStockLevel('');
        setStockistSearchQuery('');
        // Reload data with a small delay to ensure database is updated
        setTimeout(() => {
          loadBinaryStock(currentRootUserId);
          loadStockistsByLevel(currentRootUserId);
        }, 500);
      } else {
        throw new Error(result.message || 'Failed to assign stock level');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error.message || t('adminBinaryStock.levelAssignFailed') || 'Failed to assign stock level',
      });
    } finally {
      setChangingLevel(false);
    }
  };

  // Load all stockists grouped by level
  // For admin: use dedicated API endpoint to get ALL stockists in the network
  // For specific user view: use binary-stock API to get stockists from that user's tree
  const loadStockistsByLevel = async (userId?: string) => {
    try {
      setLoadingStockists(true);
      const token = localStorage.getItem('auth_token');
      
      if (!token) return;

      // For admin without specific userId, use dedicated endpoint to get ALL stockists
      // For specific user view, use binary-stock API
      if (!userId) {
        // Admin view: Get all stockists in the network
        const response = await fetch('/api/binary-stock/stockists-by-level', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const result = await response.json();
          console.log('Stockists by level API response:', result);
          if (result.success && result.data) {
            // Ensure the data structure is correct
            const grouped = {
              D: Array.isArray(result.data.D) ? result.data.D : [],
              C: Array.isArray(result.data.C) ? result.data.C : [],
              M: Array.isArray(result.data.M) ? result.data.M : [],
              S: Array.isArray(result.data.S) ? result.data.S : []
            };
            
            // Log detailed counts and stock levels for debugging
            console.log('Grouped stockists:', {
              D: { count: grouped.D.length, stockists: grouped.D.map((s: StockistByLevel) => ({ memberId: s.memberId, stockLevel: s.stockLevel, productCount: s.productCount })) },
              C: { count: grouped.C.length, stockists: grouped.C.map((s: StockistByLevel) => ({ memberId: s.memberId, stockLevel: s.stockLevel, productCount: s.productCount })) },
              M: { count: grouped.M.length, stockists: grouped.M.map((s: StockistByLevel) => ({ memberId: s.memberId, stockLevel: s.stockLevel, productCount: s.productCount })) },
              S: { count: grouped.S.length, stockists: grouped.S.map((s: StockistByLevel) => ({ memberId: s.memberId, stockLevel: s.stockLevel, productCount: s.productCount })) }
            });
            
            setStockistsByLevel(grouped);
            return;
          } else {
            console.error('API response format error:', result);
          }
        } else {
          const errorText = await response.text();
          console.error('Failed to fetch stockists by level:', response.status, errorText);
        }
      }

      // For specific user view: Fetch downline based on placementParentId (AdminStock relationship)
      // This is the correct way to get downline for AdminStock users
      if (userId) {
        // Fetch all stockists who have this user as their placementParentId
        const response = await fetch(`/api/members?placementParentId=${userId}`, {
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

          // Add the current user (the one being viewed) to the list so they can see themselves
          let currentUserStockist: StockistByLevel | null = null;
          try {
            const currentUserStockResponse = await fetch(`/api/binary-stock?userId=${userId}&depth=1&_t=${Date.now()}`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
              },
            });
            
            if (currentUserStockResponse.ok) {
              const currentUserStockResult = await currentUserStockResponse.json();
              if (currentUserStockResult.success && currentUserStockResult.data?.user?.stockInventory) {
                const userRank = (currentUserStockResult.data?.binaryTree as any)?.rank || undefined;
                
                currentUserStockist = {
                  id: currentUserStockResult.data.user.id,
                  fullName: currentUserStockResult.data.user.fullName,
                  memberId: currentUserStockResult.data.user.memberId,
                  storeOwnerLevel: currentUserStockResult.data.user.storeOwnerLevel,
                  rank: userRank,
                  stockLevel: currentUserStockResult.data.user.stockInventory.totalStock || 0,
                  productCount: currentUserStockResult.data.user.stockInventory.productCount || 0
                };
              }
            }
          } catch (error) {
            console.error(`Failed to fetch stock for current user ${userId}:`, error);
          }

          // Fetch stock inventory for each stockist
          const stockistsWithInventory = await Promise.all(
            stockists.map(async (stockist: any) => {
              try {
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
                    return {
                      id: stockist.id,
                      fullName: stockist.fullName || `${stockist.firstName || ''} ${stockist.surname || ''}`.trim() || 'Unknown',
                      memberId: stockist.memberId,
                      storeOwnerLevel: stockist.storeOwnerLevel,
                      rank: stockist.rank,
                      stockLevel: stockResult.data.user.stockInventory.totalStock || 0,
                      productCount: stockResult.data.user.stockInventory.productCount || 0
                    };
                  }
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

          // Add current user to the list if they have a stock level
          const allStockists: StockistByLevel[] = [...stockistsWithInventory];
          if (currentUserStockist && currentUserStockist.storeOwnerLevel && ['D', 'C', 'M', 'S'].includes(currentUserStockist.storeOwnerLevel)) {
            // Use Set to ensure no duplicates
            const addedStockistIds = new Set<string>(allStockists.map(s => s.id));
            if (!addedStockistIds.has(currentUserStockist.id)) {
              allStockists.push(currentUserStockist);
            }
          }

          // Group by level
          const grouped: { D: StockistByLevel[]; C: StockistByLevel[]; M: StockistByLevel[]; S: StockistByLevel[] } = {
            D: [],
            C: [],
            M: [],
            S: []
          };

          allStockists.forEach((stockist) => {
            if (stockist.storeOwnerLevel && ['D', 'C', 'M', 'S'].includes(stockist.storeOwnerLevel)) {
              grouped[stockist.storeOwnerLevel as keyof typeof grouped].push(stockist);
            }
          });

          setStockistsByLevel(grouped);
          return;
        }
      }

      // Fallback: Use binary-stock API for admin root view (no specific userId)
      const depth = 10;
      const url = `/api/binary-stock?depth=${depth}`;
        
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data?.binaryTree) {
          const allStockists: StockistByLevel[] = [];
          
          // Extract stockists from the entire tree (including root if it's a stockist and not ADMIN001)
          const rootNode = result.data.binaryTree;
          
          // Always exclude ADMIN001 from the root
          if (rootNode && rootNode.memberId !== 'ADMIN001' && rootNode.storeOwnerLevel && ['D', 'C', 'M', 'S'].includes(rootNode.storeOwnerLevel)) {
            allStockists.push({
              id: rootNode.id,
              fullName: rootNode.fullName,
              memberId: rootNode.memberId,
              storeOwnerLevel: rootNode.storeOwnerLevel,
              stockLevel: rootNode.stockLevel || 0,
              productCount: rootNode.productCount || 0,
              rank: rootNode.rank
            });
          }
          
          // Extract stockists from left and right subtrees (this will exclude ADMIN001 automatically)
          if (rootNode.left) {
            extractStockistsFromTree(rootNode.left, allStockists);
          }
          if (rootNode.right) {
            extractStockistsFromTree(rootNode.right, allStockists);
          }
          
          // Remove duplicates (in case a stockist appears multiple times)
          const uniqueStockists = new Map<string, StockistByLevel>();
          allStockists.forEach((stockist) => {
            if (stockist.memberId !== 'ADMIN001' && stockist.storeOwnerLevel && ['D', 'C', 'M', 'S'].includes(stockist.storeOwnerLevel)) {
              // Use id as unique key (more reliable than memberId)
              if (!uniqueStockists.has(stockist.id)) {
                uniqueStockists.set(stockist.id, stockist);
              }
            }
          });
          
          // Group by level
          const grouped: { D: StockistByLevel[]; C: StockistByLevel[]; M: StockistByLevel[]; S: StockistByLevel[] } = {
            D: [],
            C: [],
            M: [],
            S: []
          };

          uniqueStockists.forEach((stockist) => {
            if (stockist.storeOwnerLevel && ['D', 'C', 'M', 'S'].includes(stockist.storeOwnerLevel)) {
              grouped[stockist.storeOwnerLevel as keyof typeof grouped].push(stockist);
            }
          });

          setStockistsByLevel(grouped);
        }
      }
    } catch (error) {
      console.error('Failed to load stockists by level:', error);
    } finally {
      setLoadingStockists(false);
    }
  };

  const loadStockAndProducts = async () => {
    try {
      setLoadingStockData(true);
      const token = localStorage.getItem('auth_token');
      
      if (!token) return;

      // Fetch stock items (these represent stock levels like S, M, C, D)
      const stockItemsResponse = await fetch('/api/stock-items', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      // Fetch products from catalog
      const productsResponse = await fetch('/api/products?limit=1000&isActive=true', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      // Fetch inventory to get product quantities
      const inventoryResponse = await fetch('/api/inventory?limit=1000', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (stockItemsResponse.ok && productsResponse.ok && inventoryResponse.ok) {
        const stockItemsData = await stockItemsResponse.json();
        const productsData = await productsResponse.json();
        const inventoryData = await inventoryResponse.json();

        const stockItems = stockItemsData.data || [];
        const products = productsData.data || [];
        const inventoryItems = inventoryData.data || [];

        // Group inventory items by product to get quantities
        const inventoryMap = new Map<string, number>();
        inventoryItems.forEach((item: any) => {
          const key = item.productId || item.id;
          const currentQty = inventoryMap.get(key) || 0;
          inventoryMap.set(key, currentQty + (item.quantity || 0));
        });

        // Build stock levels dynamically from StockItems (only show what exists)
        const stockLevelMap = new Map<string, {level: string; name: string; productCount: number}>();

        stockItems.forEach((stockItem: any) => {
          const code = stockItem.code || stockItem.name || '';
          const name = stockItem.name || '';
          
          // Try to match stock level from code or name
          let matchedLevel: string | null = null;
          let displayName = name;
          
          // Check if code or name contains S, M, C, or D pattern
          const levelMatch = (code + ' ' + name).match(/\b([SMDC])\b/i);
          if (levelMatch) {
            matchedLevel = levelMatch[1].toUpperCase();
          } else if (name.includes('Small Mobile') || name.includes('(S)') || name.includes(' S')) {
            matchedLevel = 'S';
          } else if ((name.includes('Mobile') || name.includes('(M)') || name.includes(' M')) && !name.includes('Small')) {
            matchedLevel = 'M';
          } else if (name.includes('Center') || name.includes('(C)') || name.includes(' C')) {
            matchedLevel = 'C';
          } else if (name.includes('Dealer') || name.includes('(D)') || name.includes(' D')) {
            matchedLevel = 'D';
          }
          
          if (matchedLevel) {
            // Use the stock item's quantity as the product count for this stock level
            const existing = stockLevelMap.get(matchedLevel);
            if (existing) {
              // If level already exists, add to product count
              existing.productCount += stockItem.quantity || 0;
            } else {
              // Create new entry
              stockLevelMap.set(matchedLevel, {
                level: matchedLevel,
                name: displayName || `${matchedLevel} (${matchedLevel === 'S' ? 'Small Mobile' : matchedLevel === 'M' ? 'Mobile' : matchedLevel === 'C' ? 'Center' : 'Dealer'})`,
                productCount: stockItem.quantity || 0
              });
            }
          }
        });

        // Convert to array (only stock levels that exist in StockItems)
        const stockLevelsArray = Array.from(stockLevelMap.values()).sort((a, b) => {
          const order = ['S', 'M', 'C', 'D'];
          return order.indexOf(a.level) - order.indexOf(b.level);
        });

        setStockLevels(stockLevelsArray);

        // Map products from catalog with quantities from Product Catalog Management (product.qty)
        const productsWithQty = products.map((product: any) => {
          const productQty = product.qty || product.quantity || 0;
          return {
            id: product.id,
            name: product.name,
            quantity: productQty,
            category: product.category || 'Uncategorized'
          };
        });
        setProductsFromCatalog(productsWithQty);

        // Full catalog list for Transfer to Member dialog (with price, pv; only qty > 0)
        const forTransfer = products
          .filter((p: any) => (p.qty ?? p.quantity ?? 0) > 0)
          .map((p: any) => ({
            id: p.id,
            name: p.name,
            category: p.category || 'Uncategorized',
            qty: p.qty ?? p.quantity ?? 0,
            price: Number(p.price) || 0,
            pv: Number(p.pv) || 0,
            imageUrl: p.imageUrl ?? null,
          }));
        setCatalogProductsForTransfer(forTransfer);
      }
    } catch (error) {
      console.error('Failed to load stock and products:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load stock and products data',
      });
    } finally {
      setLoadingStockData(false);
    }
  };

  const loadBinaryStock = async (userId?: string) => {
    try {
      // Only set main loading state if not in dialog (when userId is undefined, it's initial load)
      if (!userId) {
        setLoading(true);
      } else {
        // When navigating in dialog, use loadingStockists state instead
        setLoadingStockists(true);
      }
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        toast({
          variant: 'destructive',
          title: 'Authentication Required',
          description: 'Please log in to access this page',
        });
        if (!userId) setLoading(false);
        else setLoadingStockists(false);
        return;
      }

      const url = userId 
        ? `/api/binary-stock?userId=${userId}&depth=5`
        : '/api/binary-stock?depth=5';
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        
        // If unauthorized, redirect to login
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
        await loadStockistsByLevel(userId);
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
      if (!userId) {
        setLoading(false);
      } else {
        setLoadingStockists(false);
      }
    }
  };

  const handleSearch = () => {
    if (searchMemberId.trim()) {
      loadBinaryStock(searchMemberId.trim());
    } else {
      loadBinaryStock();
    }
  };

  // Fetch all users without stock level (from entire system)
  const fetchAllUsersWithoutLevel = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.error('No auth token found');
        return;
      }

      console.log('Fetching users without stock level...');
      const response = await fetch('/api/members?withoutStockLevel=true', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log('API response:', result);
        // The members API returns {success: true, data: [...]} format
        const usersArray = Array.isArray(result) ? result : (result.data || []);
        
        console.log('Users without stock level found:', usersArray.length);
        
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
        
        console.log('Mapped users:', users.length, users);
        setAllUsersWithoutLevel(users);
      } else {
        console.error('Failed to fetch users without stock level:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error response:', errorText);
      }
    } catch (error) {
      console.error('Failed to fetch users without stock level:', error);
    }
  };

  // Fetch all users (with and without stock levels) for upgrade functionality
  const fetchAllUsers = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.error('No auth token found');
        return;
      }

      console.log('Fetching all users...');
      const response = await fetch('/api/members', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        // The members API returns {success: true, data: [...]} format
        const usersArray = Array.isArray(result) ? result : (result.data || []);
        
        // Filter out admin users
        const nonAdminUsers = usersArray.filter((user: any) => !user.isAdmin);
        
        // Map users to BinaryNode format
        const users = nonAdminUsers.map((user: any) => ({
          id: user.id,
          fullName: user.fullName || `${user.firstName || ''} ${user.surname || ''}`.trim() || 'Unknown',
          memberId: user.memberId,
          storeOwnerLevel: user.storeOwnerLevel,
          rank: user.rank,
          stockLevel: 0,
          productCount: 0,
        }));
        
        console.log('All users fetched:', users.length);
        setAllUsers(users);
      } else {
        console.error('Failed to fetch all users:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Failed to fetch all users:', error);
    }
  };

  // Handle node click - navigate to that user's tree
  const handleNodeClick = (node: BinaryNode, isRoot: boolean) => {
    // Don't navigate if clicking on the current root
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

  // Handle transfer stock - separate function for opening transfer dialog
  const handleTransferStock = async (node: BinaryNode, event?: React.MouseEvent) => {
    // Prevent event bubbling if called from button
    if (event) {
      event.stopPropagation();
    }

    setSelectedNode(node);
    
    // Fetch available stock items from admin's stock
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/stock-items', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const result = await response.json();
        const stockItems = result.data || [];
        
        // Convert StockItems to the format expected by the transfer dialog
        const availableItems = stockItems
          .filter((item: any) => item.quantity > 0)
          .map((item: any) => ({
            productId: item.id,
            productName: item.name,
            sku: item.code || item.id.substring(0, 8),
            quantity: item.quantity
          }));
        
        setAvailableProducts(availableItems);
      } else {
        setAvailableProducts([]);
      }
    } catch (error) {
      console.error('Failed to fetch stock items:', error);
      setAvailableProducts([]);
    }
    
    setSelectedProducts([]);
    setIsTransferDialogOpen(true);
  };

  // Handle breadcrumb navigation - go back to a previous level
  const handleBreadcrumbClick = (userId: string, index: number) => {
    // Remove all breadcrumbs after this index
    setBreadcrumbPath(prev => prev.slice(0, index));
    
    // Navigate to that user
    if (userId) {
      setCurrentRootUserId(userId);
      loadBinaryStock(userId);
      loadStockistsByLevel(userId);
    } else {
      // Go back to root (admin)
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

  const handleAddProduct = (productId: string) => {
    const product = availableProducts.find(p => p.productId === productId);
    if (!product) return;

    setSelectedProducts(prev => {
      const existing = prev.find(p => p.productId === productId);
      if (existing) {
        return prev.map(p => 
          p.productId === productId 
            ? { ...p, quantity: Math.min(p.quantity + 1, product.quantity) }
            : p
        );
      }
      return [...prev, { productId, quantity: 1 }];
    });
  };

  const handleRemoveProduct = (productId: string) => {
    setSelectedProducts(prev => prev.filter(p => p.productId !== productId));
  };

  const handleQuantityChange = (productId: string, quantity: number) => {
    const product = availableProducts.find(p => p.productId === productId);
    if (!product) return;

    const validQuantity = Math.max(1, Math.min(quantity, product.quantity));
    setSelectedProducts(prev => 
      prev.map(p => p.productId === productId ? { ...p, quantity: validQuantity } : p)
    );
  };

  const handleConfirmTransfer = async () => {
    if (!selectedNode || selectedProducts.length === 0) return;

    try {
      setTransferring(true);
      const token = localStorage.getItem('auth_token');

      const items = selectedProducts.map(sp => {
        const product = availableProducts.find(p => p.productId === sp.productId);
        return {
          productId: sp.productId,
          productName: product?.productName || '',
          quantity: sp.quantity,
          unitPrice: 0
        };
      });

      const response = await fetch('/api/binary-stock/transfer', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toUserId: selectedNode.id,
          items
        })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: result.message || 'Stock transferred successfully',
        });
        setIsTransferDialogOpen(false);
        setSelectedProducts([]);
        // Reload with current root user - refresh both binary stock and stockists
        loadBinaryStock(currentRootUserId);
        loadStockistsByLevel(currentRootUserId);
      } else {
        throw new Error(result.message || 'Transfer failed');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Transfer Failed',
        description: error.message || 'Failed to transfer stock',
      });
    } finally {
      setTransferring(false);
    }
  };

  const renderBinaryNode = (node: BinaryNode | null, position: 'root' | 'left' | 'right' = 'root', depth: number = 0, isRoot: boolean = false) => {
    if (!node) {
      return null;
    }

    // Show only members who have been given a Stockist Level by admin
    // Root node (admin) always shows, for others check if they have storeOwnerLevel
    if (!isRoot && (!node.storeOwnerLevel || node.storeOwnerLevel === null)) {
      return null;
    }

    const stockColor = node.stockLevel > 100 ? 'bg-green-50 border-green-200 text-green-700' : node.stockLevel > 50 ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-red-50 border-red-200 text-red-700';
    const stockIconColor = node.stockLevel > 100 ? 'text-green-600' : node.stockLevel > 50 ? 'text-yellow-600' : 'text-red-600';

    // Check if there are any stockist children to show
    const hasValidChildren = (node.left && node.left.storeOwnerLevel !== null) || (node.right && node.right.storeOwnerLevel !== null);

    return (
      <div className="flex flex-col items-center">
        <Card 
          className={cn(
            "w-40 transition-all duration-300 border-2 relative z-10 group",
            position === 'root' ? 'ring-2 ring-blue-500 ring-offset-2' : '',
            !isRoot ? 'cursor-pointer hover:shadow-xl hover:scale-105' : ''
          )}
          onClick={() => !isRoot && handleNodeClick(node, isRoot)}
        >
          <CardContent className="p-3">
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center">
                {node.rank && node.rank !== 'Member' ? (
                  <div className="h-10 w-10 rounded-full overflow-hidden flex items-center justify-center">
                    <RankBadge rank={node.rank as any} className="h-10 w-10 rounded-full" />
                  </div>
                ) : (
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                    {node.fullName.split(' ').map(n => n[0]).join('').substring(0, 2)}
                  </div>
                )}
              </div>
              <div>
                <p className="font-semibold text-xs truncate">{node.fullName}</p>
                <p className="text-[10px] text-muted-foreground">{node.memberId}</p>
              </div>
              {node.storeOwnerLevel && (
                <Badge variant="secondary" className="text-[10px] font-semibold py-0 px-2">
                  {t('adminBinaryStock.level')} {node.storeOwnerLevel}
                </Badge>
              )}
              <div className="space-y-1">
              <div className={cn("p-2 rounded-lg border-2", stockColor)}>
                <div className="flex items-center justify-center gap-1">
                  <Package className={cn("h-4 w-4", stockIconColor)} />
                    <span className="font-bold text-base">
                      {node.storeOwnerLevel ? 1 : node.productCount}
                    </span>
                  </div>
                  <p className="text-[10px] mt-0.5">{t('adminBinaryStock.stockLevel')}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <BarChart3 className={cn("h-3 w-3", stockIconColor)} />
                    <p className="text-[10px] text-muted-foreground font-medium">
                      {node.stockLevel} {t('binaryStock.totalQty')}
                    </p>
                  </div>
                </div>
              </div>
              {/* Transfer Stock Button - only show on hover for non-root nodes */}
              {!isRoot && node.storeOwnerLevel && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-2 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                  onClick={(e) => handleTransferStock(node, e)}
                >
                  <Send className="h-3 w-3 mr-1" />
                  {t('binaryStock.transferStock')}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
        
        {hasValidChildren && (
          <div className="flex gap-8 mt-12 relative">
            {/* Horizontal line */}
            <div className="absolute -top-6 left-0 right-0 h-0.5 bg-cyan-400" style={{ top: '-24px' }} />
            
            <div className="flex-1 flex flex-col items-center relative">
              {/* Vertical line for left child */}
              {node.left && node.left.storeOwnerLevel !== null && <div className="absolute w-0.5 h-6 bg-cyan-400" style={{ top: '-24px' }} />}
              {renderBinaryNode(node.left, 'left', depth + 1, false)}
            </div>
            
            <div className="flex-1 flex flex-col items-center relative">
              {/* Vertical line for right child */}
              {node.right && node.right.storeOwnerLevel !== null && <div className="absolute w-0.5 h-6 bg-cyan-400" style={{ top: '-24px' }} />}
              {renderBinaryNode(node.right, 'right', depth + 1, false)}
            </div>
          </div>
        )}
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {t('adminBinaryStock.title')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('adminBinaryStock.description')}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-2">
            <Button onClick={() => handleOpenAssignLevelDialog()} size="lg" className="gap-2 bg-purple-600 hover:bg-purple-700">
              <UserPlus className="h-4 w-4" />
              {t('adminBinaryStock.addStockistToNetwork') || 'Add Stockist to Network'}
            </Button>
            <Button onClick={async () => {
              await fetchAllUsersWithoutLevel();
              // Simplified: Just set all levels as available (admin can assign any level)
              setAvailableStockLevels(['D', 'C', 'M', 'S']);
              setSelectedStockistToChange('');
              setNewStockLevel('');
              setStockistSearchQuery('');
              await fetchAllUsers(); // Fetch all users (with and without stock levels) for upgrade functionality
              setIsChangeLevelDialogOpen(true);
            }} size="lg" className="gap-2 bg-blue-600 hover:bg-blue-700">
              <UserCog className="h-4 w-4" />
              {t('adminBinaryStock.changeStockLevel') || 'Change Stock Level'}
            </Button>
          </div>
          <Button onClick={() => { loadBinaryStock(currentRootUserId); loadStockistsByLevel(currentRootUserId); }} size="lg" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            {t('common.refresh')}
          </Button>
        </div>
      </div>

      {/* Tabs for Binary Tree and Stock Requests */}
      <Tabs defaultValue="tree" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="tree" className="gap-2">
            <GitBranch className="h-4 w-4" />
            {t('adminBinaryStock.binaryTree')}
          </TabsTrigger>
          <TabsTrigger value="requests" className="gap-2">
            <Package className="h-4 w-4" />
            {t('adminBinaryStock.stockRequests')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tree" className="space-y-6 mt-6">
      {/* Current User Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('adminBinaryStock.currentUser')}</CardTitle>
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
            <CardTitle className="text-sm font-medium">{t('adminBinaryStock.totalStock')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              <span className="text-2xl font-bold">
                {stockLevels.length > 0 
                  ? stockLevels.reduce((sum, level) => sum + level.productCount, 0)
                  : binaryStockData.user.stockInventory.totalStock}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('adminBinaryStock.totalQuantityFromStockLevels')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('adminBinaryStock.productsItemsUnits')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-600" />
              <span className="text-2xl font-bold">
                {productsFromCatalog.length > 0
                  ? productsFromCatalog.reduce((sum, product) => sum + product.quantity, 0)
                  : binaryStockData.user.stockInventory.productCount}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('adminBinaryStock.totalQuantityFromCatalog')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Network Stock Summary by Level */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('adminBinaryStock.stockLevelSummary')}
          </CardTitle>
          <CardDescription>
            {t('adminBinaryStock.stockLevelSummaryDesc')}
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
      <Dialog open={isBinaryTreeViewDialogOpen} onOpenChange={setIsBinaryTreeViewDialogOpen}>
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
            {/* Breadcrumb Navigation - Fixed, not scrollable */}
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
              ) : (
                <div 
                  className="w-full min-h-full pb-12 pt-4 px-6" 
                  style={{ 
                    scrollBehavior: 'smooth',
                    WebkitOverflowScrolling: 'touch'
                  }}
                >
              <div className="flex flex-col items-center space-y-0" style={{ minWidth: `${minWidth}px` }}>
                {/* Root User (Company/Admin) at the top */}
                {binaryStockData?.binaryTree && (
                  <div className="flex flex-col items-center">
                    <Card className="w-40 transition-all duration-300 border-2 ring-2 ring-blue-500 ring-offset-2">
                      <CardContent className="p-3">
                        <div className="text-center space-y-2">
                          <div className="flex items-center justify-center">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                              <Building2 className="h-5 w-5" />
                            </div>
                          </div>
                          <div>
                            <p className="font-semibold text-xs">{binaryStockData.user.fullName}</p>
                            <p className="text-[10px] text-muted-foreground">{binaryStockData.user.memberId}</p>
                          </div>
                          {binaryStockData.user.storeOwnerLevel && (
                            <Badge variant="secondary" className="text-[10px] font-semibold py-0 px-2">
                              {t('adminBinaryStock.level')} {binaryStockData.user.storeOwnerLevel}
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    {/* Connector line down */}
                    {(binaryStockData.binaryTree.left || binaryStockData.binaryTree.right) && (
                      <div className="w-0.5 h-12 bg-cyan-400"></div>
                    )}
                  </div>
                )}

                {/* Row-based view: Show stockists organized by level in rows (D, C, M, S) */}
                {(() => {
                  // Collect all stockists from stockistsByLevel
                  const allStockists = [
                    ...stockistsByLevel.D,
                    ...stockistsByLevel.C,
                    ...stockistsByLevel.M,
                    ...stockistsByLevel.S
                  ];

                  if (allStockists.length === 0) {
                    return (
                      <div className="text-center py-8 text-muted-foreground">
                        <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>{t('adminBinaryStock.noStockistsAtLevel') || 'No stockists assigned yet'}</p>
                      </div>
                    );
                  }

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
                            left: null,
                            right: null
                          }));
                        
                        // Fetch stock inventory for each downline
                        const downlinesWithStock = await Promise.all(
                          stockistDownlines.map(async (downline: BinaryNode) => {
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

                    // Check if this stockist is the current root being viewed (for visual indicator only)
                    // Admin can always navigate and transfer to any AdminStock user
                    const isCurrentRoot = binaryStockData?.user?.id === stockist.id;

                    return (
                      <div key={`${level}-${stockist.id}-${index}`} className="flex flex-col items-center">
                        {/* Top connector line - connects from parent level */}
                        {level !== 'D' && (
                          <div className="w-0.5 h-6 bg-gradient-to-b from-cyan-400 to-cyan-300 mb-2"></div>
                        )}
                        <Card
                          className={cn(
                            "w-40 transition-all duration-300 border-2 cursor-pointer hover:shadow-lg group",
                            levelColors[level],
                            isCurrentRoot && "ring-2 ring-purple-400"
                          )}
                          onClick={() => {
                            // Always navigate when clicking any AdminStock user
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
                            // Clear expanded downlines since we're navigating to a new view
                            setSelectedStockistForView(null);
                            setExpandedDownlines(new Map());
                            // Load binary stock data - this will also trigger loadStockistsByLevel
                            loadBinaryStock(stockist.id);
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
                                {isCurrentRoot && (
                                  <Badge variant="outline" className="text-[9px] mt-1 bg-purple-100 border-purple-300 text-purple-700">
                                    {t('binaryStock.currentRoot') || 'Current Root'}
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
                              {/* Show Transfer Stock button on hover for ALL AdminStock users */}
                              {/* Admin can transfer to any AdminStock user, including the current root */}
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full mt-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTransferStock({
                                    id: stockist.id,
                                    fullName: stockist.fullName,
                                    memberId: stockist.memberId,
                                    storeOwnerLevel: stockist.storeOwnerLevel,
                                    stockLevel: stockist.stockLevel,
                                    productCount: stockist.productCount,
                                    rank: stockist.rank,
                                    left: null,
                                    right: null
                                  }, e);
                                }}
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

                  return (
                    <div className="w-full space-y-8 mt-6 flex flex-col items-center">
                      {/* Row 1: Stock Level D */}
                      {stockistsByLevel.D.length > 0 && (
                        <div className="space-y-4 w-full flex flex-col items-center">
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <Badge className="bg-purple-600 text-white text-sm px-3 py-1">
                              {t('adminBinaryStock.levelD')} ({stockistsByLevel.D.length})
                            </Badge>
                          </div>
                          <div className="flex items-start justify-center gap-4 flex-wrap relative">
                            {/* Horizontal connector line for multiple D level stockists */}
                            {stockistsByLevel.D.length > 1 && (
                              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-full max-w-[calc(100%-2rem)] h-0.5 bg-purple-300 -mt-4"></div>
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
                          <div className="flex items-start justify-center gap-4 flex-wrap relative">
                            {/* Horizontal connector line for multiple C level stockists */}
                            {stockistsByLevel.C.length > 1 && (
                              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-full max-w-[calc(100%-2rem)] h-0.5 bg-blue-300 -mt-4"></div>
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
                          <div className="flex items-start justify-center gap-4 flex-wrap relative">
                            {/* Horizontal connector line for multiple M level stockists */}
                            {stockistsByLevel.M.length > 1 && (
                              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-full max-w-[calc(100%-2rem)] h-0.5 bg-green-300 -mt-4"></div>
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
                          <div className="flex items-start justify-center gap-4 flex-wrap relative">
                            {/* Horizontal connector line for multiple S level stockists */}
                            {stockistsByLevel.S.length > 1 && (
                              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-full max-w-[calc(100%-2rem)] h-0.5 bg-yellow-300 -mt-4"></div>
                            )}
                            {stockistsByLevel.S.map((stockist, index) => renderStockistCard(stockist, 'S', index))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* No tree data message */}
                {!binaryStockData?.binaryTree && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>{t('adminBinaryStock.noStockistsAtLevel') || 'No stockists assigned yet'}</p>
                  </div>
                )}
                
                {/* Scroll indicator - shows when there's more content below */}
                <div className="flex justify-center mt-8 mb-4">
                  <div className="flex flex-col items-center text-muted-foreground animate-bounce">
                    <ChevronDown className="h-6 w-6" />
                    <span className="text-xs">{t('common.scrollToSeeMore') || 'Scroll to see more'}</span>
                  </div>
                </div>
                </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Stock Level Dialog */}
      <Dialog open={isChangeLevelDialogOpen} onOpenChange={setIsChangeLevelDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <UserCog className="h-6 w-6 text-blue-600" />
              {t('adminBinaryStock.changeStockLevel') || 'Change Stock Level'}
            </DialogTitle>
            <DialogDescription>
              {t('adminBinaryStock.changeStockLevelDesc') || 'Select a member to assign or upgrade their stock level. Users with existing levels can only be upgraded to higher levels.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Select Member (without stock level) */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">
                {t('adminBinaryStock.selectMember') || 'Select Member'}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('adminBinaryStock.changeStockLevelMemberDesc') || 'Choose a member to assign or upgrade their stock level. Users with existing levels can only be upgraded to higher levels (S → M → C → D).'}
              </p>
              
              {/* Search input */}
              <Input
                placeholder={t('adminBinaryStock.searchByIdOrName') || 'Search by ID or name...'}
                value={stockistSearchQuery}
                onChange={(e) => setStockistSearchQuery(e.target.value)}
                className="w-full"
              />
              
              <Select
                value={selectedStockistToChange}
                onValueChange={(value) => {
                  setSelectedStockistToChange(value);
                  // Find the selected user to check their current stock level
                  const selectedUser = allUsers.find(u => u.id === value);
                  
                  if (selectedUser && selectedUser.storeOwnerLevel && ['D', 'C', 'M', 'S'].includes(selectedUser.storeOwnerLevel)) {
                    // User has a stock level - only show HIGHER levels for upgrade
                    const currentLevel = selectedUser.storeOwnerLevel;
                    const levelHierarchy: { [key: string]: number } = { 'S': 1, 'M': 2, 'C': 3, 'D': 4 };
                    const currentHierarchy = levelHierarchy[currentLevel];
                    
                    // Filter to only show higher levels
                    const higherLevels = ['S', 'M', 'C', 'D'].filter(level => {
                      return levelHierarchy[level] > currentHierarchy;
                    });
                    
                    setAvailableStockLevels(higherLevels);
                  } else {
                    // User has no stock level - show all levels
                    setAvailableStockLevels(['D', 'C', 'M', 'S']);
                  }
                  setNewStockLevel('');
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('adminBinaryStock.selectMemberNoLevel') || 'Select member without stock level...'} />
                </SelectTrigger>
                <SelectContent className="max-h-96">
                  {/* Search input inside dropdown */}
                  <div className="px-2 py-2 sticky top-0 bg-white border-b z-10">
                    <Input
                      placeholder={t('adminBinaryStock.searchUserByIdOrName') || 'Search user by ID or name...'}
                      value={stockistSearchQuery}
                      onChange={(e) => setStockistSearchQuery(e.target.value)}
                      className="w-full h-9"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                  {/* Show ALL users in the system (with and without stock levels), filtered by search */}
                  {allUsers
                    .filter(m => {
                      if (!stockistSearchQuery) return true;
                      const query = stockistSearchQuery.toLowerCase();
                      return m.fullName.toLowerCase().includes(query) || 
                             m.memberId.toLowerCase().includes(query);
                    })
                    .length > 0 ? (
                    <>
                      {/* Group by stock level status */}
                      {(() => {
                        const usersWithoutLevel = allUsers.filter(m => {
                          const matches = !stockistSearchQuery || 
                            m.fullName.toLowerCase().includes(stockistSearchQuery.toLowerCase()) || 
                            m.memberId.toLowerCase().includes(stockistSearchQuery.toLowerCase());
                          return matches && (!m.storeOwnerLevel || !['D', 'C', 'M', 'S'].includes(m.storeOwnerLevel));
                        });
                        
                        const usersWithLevel = allUsers.filter(m => {
                          const matches = !stockistSearchQuery || 
                            m.fullName.toLowerCase().includes(stockistSearchQuery.toLowerCase()) || 
                            m.memberId.toLowerCase().includes(stockistSearchQuery.toLowerCase());
                          return matches && m.storeOwnerLevel && ['D', 'C', 'M', 'S'].includes(m.storeOwnerLevel);
                        });
                        
                        return (
                          <>
                            {/* Users with stock levels (for upgrade) */}
                            {usersWithLevel.length > 0 && (
                              <>
                                <div className="px-2 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 sticky top-12">
                                  ⬆️ {t('adminBinaryStock.usersWithStockLevel') || 'Users with Stock Level (Upgrade)'} ({usersWithLevel.length})
                                </div>
                                {usersWithLevel.map((member) => (
                                  <SelectItem key={member.id} value={member.id}>
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className={cn(
                                        "text-xs",
                                        member.storeOwnerLevel === 'D' && 'bg-purple-100 border-purple-300 text-purple-700',
                                        member.storeOwnerLevel === 'C' && 'bg-blue-100 border-blue-300 text-blue-700',
                                        member.storeOwnerLevel === 'M' && 'bg-green-100 border-green-300 text-green-700',
                                        member.storeOwnerLevel === 'S' && 'bg-yellow-100 border-yellow-300 text-yellow-700'
                                      )}>
                                        {member.storeOwnerLevel}
                                      </Badge>
                                      <span className="font-medium">{member.fullName}</span>
                                      <span className="text-muted-foreground text-xs">({member.memberId})</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </>
                            )}
                            
                            {/* Users without stock levels (for new assignment) */}
                            {usersWithoutLevel.length > 0 && (
                              <>
                                <div className="px-2 py-1.5 text-xs font-semibold text-orange-700 bg-orange-50 sticky top-12">
                                  👤 {t('adminBinaryStock.allUsersWithoutLevel') || 'Users Without Stock Level'} ({usersWithoutLevel.length})
                                </div>
                                {usersWithoutLevel.map((member) => (
                                  <SelectItem key={member.id} value={member.id}>
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-xs bg-orange-100 border-orange-300 text-orange-700">NEW</Badge>
                                      <span className="font-medium">{member.fullName}</span>
                                      <span className="text-muted-foreground text-xs">({member.memberId})</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </>
                            )}
                          </>
                        );
                      })()}
                    </>
                  ) : (
                    <div className="px-2 py-4 text-center text-muted-foreground text-sm">
                      {stockistSearchQuery 
                        ? (t('adminBinaryStock.noUsersFoundSearch') || 'No users found matching your search')
                        : (t('adminBinaryStock.noUsersFound') || 'No users found in the system')}
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Selected Member Info */}
            {selectedStockistToChange && (() => {
              const member = allUsers.find(m => m.id === selectedStockistToChange);
              if (!member) return null;
              
              const hasLevel = member.storeOwnerLevel && ['D', 'C', 'M', 'S'].includes(member.storeOwnerLevel);
              
              return (
                <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                      {member.fullName.split(' ').map(n => n[0]).join('').substring(0, 2)}
                    </div>
                    <div>
                      <p className="font-semibold">{member.fullName}</p>
                      <p className="text-sm text-muted-foreground">{member.memberId}</p>
                      {hasLevel ? (
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className={cn(
                            member.storeOwnerLevel === 'D' && 'bg-purple-100 border-purple-300 text-purple-700',
                            member.storeOwnerLevel === 'C' && 'bg-blue-100 border-blue-300 text-blue-700',
                            member.storeOwnerLevel === 'M' && 'bg-green-100 border-green-300 text-green-700',
                            member.storeOwnerLevel === 'S' && 'bg-yellow-100 border-yellow-300 text-yellow-700'
                          )}>
                            Current: {member.storeOwnerLevel}
                          </Badge>
                          <span className="text-xs text-muted-foreground">→ Can upgrade to higher level</span>
                        </div>
                      ) : (
                        <Badge variant="outline" className="mt-1 text-orange-600 border-orange-300">
                          {t('adminBinaryStock.noLevelYet') || 'No stock level yet'}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Select Stock Level */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">
                {t('adminBinaryStock.selectStock') || 'Select Stock'}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('adminBinaryStock.selectStockDesc') || 'Select the stock level to assign to this member'}
              </p>
              <Select
                value={newStockLevel}
                onValueChange={setNewStockLevel}
                disabled={availableStockLevels.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={
                    availableStockLevels.length === 0 
                      ? (t('adminBinaryStock.noLevelsAvailable') || 'No higher levels available')
                      : (t('adminBinaryStock.chooseLevel') || 'Choose a level...')
                  } />
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
                        {selectedStockistToChange && (() => {
                          const selectedUser = allUsers.find(u => u.id === selectedStockistToChange);
                          if (selectedUser && selectedUser.storeOwnerLevel && ['D', 'C', 'M', 'S'].includes(selectedUser.storeOwnerLevel)) {
                            return <span className="text-xs text-green-600 ml-2">⬆️ Upgrade</span>;
                          }
                          return null;
                        })()}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableStockLevels.length === 0 && selectedStockistToChange && (() => {
                const selectedUser = allUsers.find(u => u.id === selectedStockistToChange);
                if (selectedUser && selectedUser.storeOwnerLevel === 'D') {
                  return (
                    <p className="text-sm text-muted-foreground">
                      {t('adminBinaryStock.alreadyHighestLevel') || 'This user already has the highest stock level (D).'}
                    </p>
                  );
                }
                return (
                  <p className="text-sm text-orange-600">
                    {t('adminBinaryStock.noLevelsAvailable') || 'No levels available'}
                  </p>
                );
              })()}
            </div>

          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsChangeLevelDialogOpen(false);
                setSelectedStockistToChange('');
                setNewStockLevel('');
                setStockistSearchQuery('');
              }}
              disabled={changingLevel}
            >
              {t('common.cancel')}
            </Button>
            <Button 
              onClick={handleChangeStockLevel}
              disabled={!selectedStockistToChange || !newStockLevel || changingLevel}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              {changingLevel ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('adminBinaryStock.assigning') || 'Assigning...'}
                </>
              ) : (
                <>
                  <UserCog className="h-4 w-4" />
                  {(() => {
                    const selectedUser = allUsers.find(u => u.id === selectedStockistToChange);
                    if (selectedUser && selectedUser.storeOwnerLevel && ['D', 'C', 'M', 'S'].includes(selectedUser.storeOwnerLevel)) {
                      return t('adminBinaryStock.upgradeStockLevel') || 'Upgrade Stock Level';
                    }
                    return t('adminBinaryStock.addStockLevel') || 'Add Stock Level';
                  })()}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Current Stock Inventory - Split View */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Side - Stock Levels */}
      <Card>
        <CardHeader>
            <CardTitle>{t('adminBinaryStock.stockLevel')}</CardTitle>
          <CardDescription>
              {t('adminBinaryStock.stockLevelsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
            {loadingStockData ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : stockLevels.length > 0 ? (
              <div className="space-y-4">
                <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div>
                    <p className="text-sm font-medium text-blue-900">{t('adminBinaryStock.totalStockLevels')}:</p>
                    <p className="text-2xl font-bold text-blue-600">{stockLevels.length} {t('adminBinaryStock.levels')}</p>
                  </div>
                </div>
                
                {/* Stock Header */}
                <div className="border-b-2 border-muted pb-2">
                  <div className="text-left">
                    <p className="font-semibold text-sm uppercase text-muted-foreground">{t('adminBinaryStock.stockLevel')}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('adminBinaryStock.stockLevelProductsCount')}</p>
                  </div>
                </div>

                {/* Stock Levels List */}
                <div className="space-y-2">
                  {stockLevels.map((stockLevel) => (
                    <div key={stockLevel.level} className="p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="text-left">
                          <p className="font-medium">{stockLevel.name}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="text-base">
                            {stockLevel.productCount} {t('adminBinaryStock.qty')}
                  </Badge>
                        </div>
                      </div>
                </div>
              ))}
                </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>{t('adminBinaryStock.noStockLevelsAvailable')}</p>
            </div>
          )}
        </CardContent>
      </Card>

        {/* Right Side - Products from Catalog */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-green-600">{t('adminBinaryStock.productItem')}</CardTitle>
                <CardDescription>
                  {t('adminBinaryStock.productsFromCatalog')}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 shrink-0"
                onClick={() => setIsTransferToMemberDialogOpen(true)}
              >
                <ArrowRightLeft className="h-4 w-4" />
                {t('adminBinaryStock.transferToMember') || 'Transfer to Member'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingStockData ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : productsFromCatalog.length > 0 ? (
              <div className="space-y-4">
                <div className="mb-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div>
                    <p className="text-sm font-medium text-purple-900">{t('adminBinaryStock.totalProducts')}:</p>
                    <p className="text-2xl font-bold text-purple-600">{productsFromCatalog.length} {t('adminBinaryStock.products')}</p>
                    <p className="text-xs text-purple-700 mt-1">
                      {t('common.total')}: {productsFromCatalog.reduce((sum, p) => sum + p.quantity, 0)} {t('binaryStock.units')}
                    </p>
                  </div>
                </div>
                
                {/* Product Header */}
                <div className="border-b-2 border-muted pb-2">
                  <div className="text-right">
                    <p className="font-semibold text-sm uppercase text-muted-foreground">{t('adminBinaryStock.product')}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('adminBinaryStock.productNameQuantity')}</p>
                  </div>
                </div>

                {/* Products List */}
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {productsFromCatalog.map((product) => (
                    <div key={product.id} className="p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="text-left flex-1">
                          <p className="font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.category}</p>
                        </div>
                        <div className="text-right ml-4">
                          <Badge variant="outline" className="text-base">
                            {product.quantity} {t('adminBinaryStock.qty')}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>{t('adminBinaryStock.noProductsAvailable')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transfer to Member by ID Dialog (from Product/item section) */}
      <TransferToMemberByIdDialog
        isOpen={isTransferToMemberDialogOpen}
        onOpenChange={setIsTransferToMemberDialogOpen}
        onSuccess={() => {
          loadStockAndProducts();
          loadStockistsByLevel(currentRootUserId);
        }}
        initialCatalogProducts={catalogProductsForTransfer}
      />

      {/* Transfer Stock Dialog */}
      <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <Send className="h-6 w-6 text-blue-600" />
              {t('adminBinaryStock.transferStockDialogTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('adminBinaryStock.transferStockTo')} <span className="font-semibold text-foreground">{selectedNode?.fullName}</span> ({selectedNode?.memberId})
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Recipient Info */}
            <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
              <div className="flex items-center gap-3">
                {selectedNode?.rank && selectedNode.rank !== 'Member' ? (
                  <div className="h-12 w-12 rounded-full overflow-hidden flex items-center justify-center">
                    <RankBadge rank={selectedNode.rank as any} className="h-12 w-12 rounded-full" />
                  </div>
                ) : (
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                    {selectedNode?.fullName.split(' ').map(n => n[0]).join('').substring(0, 2)}
                  </div>
                )}
                <div>
                  <p className="font-semibold">{selectedNode?.fullName}</p>
                  <p className="text-sm text-muted-foreground">{selectedNode?.memberId}</p>
                  {selectedNode?.storeOwnerLevel && (
                    <Badge variant="secondary" className="mt-1">{t('adminBinaryStock.levelLabel')} {selectedNode?.storeOwnerLevel}</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Available Products */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">{t('adminBinaryStock.selectProductsToTransfer')}</Label>
              {availableProducts.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {availableProducts.map((product) => {
                    const selected = selectedProducts.find(p => p.productId === product.productId);
                    return (
                      <div key={product.productId} className={cn(
                        "p-3 border-2 rounded-lg transition-all",
                        selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                      )}>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium">{product.productName}</p>
                            <p className="text-sm text-muted-foreground">{t('adminBinaryStock.available')}: {product.quantity} {t('binaryStock.units')}</p>
                          </div>
                          {selected ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min="1"
                                max={product.quantity}
                                value={selected.quantity}
                                onChange={(e) => handleQuantityChange(product.productId, parseInt(e.target.value) || 1)}
                                className="w-20 h-9"
                              />
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleRemoveProduct(product.productId)}
                              >
                                Remove
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAddProduct(product.productId)}
                            >
                              Add
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center p-8 bg-muted rounded-lg">
                  <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-muted-foreground">{t('adminBinaryStock.noStockAvailable')}</p>
                </div>
              )}
            </div>

            {/* Transfer Summary */}
            {selectedProducts.length > 0 && (
              <div className="p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                <p className="font-semibold mb-2">{t('adminBinaryStock.transferSummary')}</p>
                <div className="space-y-1">
                  {selectedProducts.map(sp => {
                    const product = availableProducts.find(p => p.productId === sp.productId);
                    return (
                      <div key={sp.productId} className="flex justify-between text-sm">
                        <span>{product?.productName}</span>
                        <span className="font-semibold">{sp.quantity} {t('binaryStock.units')}</span>
                      </div>
                    );
                  })}
                  <div className="pt-2 border-t border-green-300 flex justify-between font-semibold">
                    <span>{t('adminBinaryStock.totalItems')}:</span>
                    <span>{selectedProducts.reduce((sum, p) => sum + p.quantity, 0)} {t('binaryStock.units')}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsTransferDialogOpen(false)}
              disabled={transferring}
            >
              {t('common.cancel')}
            </Button>
            <Button 
              onClick={handleConfirmTransfer}
              disabled={selectedProducts.length === 0 || transferring}
              className="gap-2"
            >
              {transferring ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('adminBinaryStock.transferring')}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  {t('adminBinaryStock.confirmTransfer')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Stockist to Network Dialog */}
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
            {/* Member Selection - Show members WITH stock level (D, C, M, S) */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">
                {t('adminBinaryStock.selectParentStock') || 'Select Parent Stock'}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('adminBinaryStock.selectParentStockDesc') || 'Choose a member with stock level who will be the parent. Available assign levels depend on this selection.'}
              </p>
              
              {/* Search input */}
              <Input
                placeholder={t('adminBinaryStock.searchByIdOrName') || 'Search by ID or name...'}
                value={memberSearchQuery}
                onChange={(e) => setMemberSearchQuery(e.target.value)}
                className="w-full"
              />
              
              <Select
                value={selectedMemberForAssign}
                onValueChange={(value) => {
                  setSelectedMemberForAssign(value);
                  const member = allBinaryMembers.find(m => m.id === value);
                  if (member) {
                    setAssigningToNode(member);
                    // Update available stock levels based on selected member's level (only lower levels)
                    const levelHierarchy = ['D', 'C', 'M', 'S'];
                    const memberLevel = member.storeOwnerLevel;
                    if (memberLevel) {
                      const memberLevelIndex = levelHierarchy.indexOf(memberLevel);
                      // Get all levels BELOW the selected member's level
                      const lowerLevels = levelHierarchy.slice(memberLevelIndex + 1);
                      setAvailableStockLevels(lowerLevels);
                    } else {
                      // If member has no level, admin can assign any level
                      setAvailableStockLevels(['D', 'C', 'M', 'S']);
                    }
                    // Reset selected stock level when member changes
                    setSelectedStockLevel('');
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('adminBinaryStock.chooseMember') || 'Choose a member...'} />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {/* Group D - Dealer */}
                  {allBinaryMembers.filter(m => m.storeOwnerLevel === 'D').filter(m => {
                    if (!memberSearchQuery) return true;
                    const query = memberSearchQuery.toLowerCase();
                    return m.fullName.toLowerCase().includes(query) || m.memberId.toLowerCase().includes(query);
                  }).length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 sticky top-0">
                        📦 Stock D (Dealer)
                      </div>
                      {allBinaryMembers.filter(m => m.storeOwnerLevel === 'D').filter(m => {
                        if (!memberSearchQuery) return true;
                        const query = memberSearchQuery.toLowerCase();
                        return m.fullName.toLowerCase().includes(query) || m.memberId.toLowerCase().includes(query);
                      }).map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs bg-purple-100 border-purple-300 text-purple-700">D</Badge>
                            <span className="font-medium">{member.fullName}</span>
                            <span className="text-muted-foreground text-xs">({member.memberId})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </>
                  )}
                  
                  {/* Group C - Center */}
                  {allBinaryMembers.filter(m => m.storeOwnerLevel === 'C').filter(m => {
                    if (!memberSearchQuery) return true;
                    const query = memberSearchQuery.toLowerCase();
                    return m.fullName.toLowerCase().includes(query) || m.memberId.toLowerCase().includes(query);
                  }).length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 sticky top-0 mt-1">
                        📦 Stock C (Center)
                      </div>
                      {allBinaryMembers.filter(m => m.storeOwnerLevel === 'C').filter(m => {
                        if (!memberSearchQuery) return true;
                        const query = memberSearchQuery.toLowerCase();
                        return m.fullName.toLowerCase().includes(query) || m.memberId.toLowerCase().includes(query);
                      }).map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs bg-blue-100 border-blue-300 text-blue-700">C</Badge>
                            <span className="font-medium">{member.fullName}</span>
                            <span className="text-muted-foreground text-xs">({member.memberId})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </>
                  )}
                  
                  {/* Group M - Mobile */}
                  {allBinaryMembers.filter(m => m.storeOwnerLevel === 'M').filter(m => {
                    if (!memberSearchQuery) return true;
                    const query = memberSearchQuery.toLowerCase();
                    return m.fullName.toLowerCase().includes(query) || m.memberId.toLowerCase().includes(query);
                  }).length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-green-700 bg-green-50 sticky top-0 mt-1">
                        📦 Stock M (Mobile)
                      </div>
                      {allBinaryMembers.filter(m => m.storeOwnerLevel === 'M').filter(m => {
                        if (!memberSearchQuery) return true;
                        const query = memberSearchQuery.toLowerCase();
                        return m.fullName.toLowerCase().includes(query) || m.memberId.toLowerCase().includes(query);
                      }).map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs bg-green-100 border-green-300 text-green-700">M</Badge>
                            <span className="font-medium">{member.fullName}</span>
                            <span className="text-muted-foreground text-xs">({member.memberId})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </>
                  )}
                  
                  {/* Group S - Small Mobile */}
                  {allBinaryMembers.filter(m => m.storeOwnerLevel === 'S').filter(m => {
                    if (!memberSearchQuery) return true;
                    const query = memberSearchQuery.toLowerCase();
                    return m.fullName.toLowerCase().includes(query) || m.memberId.toLowerCase().includes(query);
                  }).length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-yellow-700 bg-yellow-50 sticky top-0 mt-1">
                        📦 Stock S (Small Mobile)
                      </div>
                      {allBinaryMembers.filter(m => m.storeOwnerLevel === 'S').filter(m => {
                        if (!memberSearchQuery) return true;
                        const query = memberSearchQuery.toLowerCase();
                        return m.fullName.toLowerCase().includes(query) || m.memberId.toLowerCase().includes(query);
                      }).map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs bg-yellow-100 border-yellow-300 text-yellow-700">S</Badge>
                            <span className="font-medium">{member.fullName}</span>
                            <span className="text-muted-foreground text-xs">({member.memberId})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </>
                  )}
                  
                  {/* Note: Only showing members WITH stock level (D, C, M, S) for Select Member */}
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

            {/* Choose Downline Stock - Select ANY user WITHOUT stock level (entire system) */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">
                {t('adminBinaryStock.chooseDownlineStock') || 'Choose Downline Stock'}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('adminBinaryStock.chooseDownlineStockAllUsersDesc') || 'Search and select any member in the system who does not have a stock level yet'}
              </p>
              
              <Select
                value={selectedDownlineStock}
                onValueChange={setSelectedDownlineStock}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('adminBinaryStock.selectMemberNoLevel') || 'Select member without stock level...'} />
                </SelectTrigger>
                <SelectContent className="max-h-96">
                  {/* Search input inside dropdown */}
                  <div className="px-2 py-2 sticky top-0 bg-white border-b z-10">
                    <Input
                      placeholder={t('adminBinaryStock.searchUserByIdOrName') || 'Search user by ID or name...'}
                      value={downlineSearchQuery}
                      onChange={(e) => setDownlineSearchQuery(e.target.value)}
                      className="w-full h-9"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                  {/* Show ALL users in the system WITHOUT stock level, filtered by search */}
                  {allUsersWithoutLevel
                    .filter(m => m.id !== selectedMemberForAssign)
                    .filter(m => {
                      if (!downlineSearchQuery) return true;
                      const query = downlineSearchQuery.toLowerCase();
                      return m.fullName.toLowerCase().includes(query) || 
                             m.memberId.toLowerCase().includes(query);
                    })
                    .length > 0 ? (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-orange-700 bg-orange-50 sticky top-12">
                        👤 {t('adminBinaryStock.allUsersWithoutLevel') || 'All Users Without Stock Level'} ({allUsersWithoutLevel
                          .filter(m => m.id !== selectedMemberForAssign)
                          .filter(m => {
                            if (!downlineSearchQuery) return true;
                            const query = downlineSearchQuery.toLowerCase();
                            return m.fullName.toLowerCase().includes(query) || 
                                   m.memberId.toLowerCase().includes(query);
                          }).length})
                      </div>
                      {allUsersWithoutLevel
                        .filter(m => m.id !== selectedMemberForAssign)
                        .filter(m => {
                          if (!downlineSearchQuery) return true;
                          const query = downlineSearchQuery.toLowerCase();
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
                      {downlineSearchQuery 
                        ? (t('adminBinaryStock.noUsersFoundSearch') || 'No users found matching your search')
                        : (t('adminBinaryStock.noUsersWithoutLevel') || 'No users without stock level found in the system')}
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Stock Level Selection */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">
                {t('adminBinaryStock.selectLevel') || 'Select Stock Level'}
              </Label>
              <p className="text-sm text-muted-foreground">
                {assigningToNode?.storeOwnerLevel 
                  ? (t('adminBinaryStock.levelBasedOnParent') || `Available levels below ${assigningToNode.storeOwnerLevel}: ${availableStockLevels.join(', ') || 'None'}`)
                  : (t('adminBinaryStock.selectParentFirst') || 'Select a parent stock first to see available levels')}
              </p>
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
              disabled={!selectedMemberForAssign || !selectedDownlineStock || !selectedStockLevel || assigningLevel}
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
        </TabsContent>

        <TabsContent value="requests" className="mt-6">
          <StockRequests onUpdate={() => loadBinaryStock()} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
