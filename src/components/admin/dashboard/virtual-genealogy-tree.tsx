'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChevronRight,
  ChevronDown,
  Users,
  Search,
  Expand,
  Collapse,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface GenealogyNode {
  id: string;
  memberId: string;
  fullName: string;
  rank: string;
  pv: number;
  children: GenealogyNode[];
  isExpanded?: boolean;
  hasChildren: boolean;
  level: number;
  totalDescendants?: number;
}

interface VirtualGenealogyTreeProps {
  rootMemberId?: string;
  onNodeClick?: (node: GenealogyNode) => void;
}

export function VirtualGenealogyTree({ rootMemberId, onNodeClick }: VirtualGenealogyTreeProps) {
  const [treeData, setTreeData] = useState<GenealogyNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [visibleNodes, setVisibleNodes] = useState<GenealogyNode[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingChildren, setLoadingChildren] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Load initial tree data
  const loadTreeData = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const memberId = rootMemberId || 'current'; // Use current user if no root specified
      const response = await fetch(`/api/genealogy/tree?memberId=${memberId}&depth=2`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load genealogy tree');
      }

      const result = await response.json();
      setTreeData(result.tree);
      updateVisibleNodes(result.tree, expandedNodes);
    } catch (error) {
      console.error('Failed to load tree:', error);
      toast({
        title: 'Error',
        description: 'Failed to load genealogy tree',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [rootMemberId, toast]);

  // Load children for a specific node
  const loadNodeChildren = useCallback(async (nodeId: string) => {
    if (loadingChildren.has(nodeId)) return;

    setLoadingChildren(prev => new Set(prev).add(nodeId));

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch(`/api/genealogy/children?memberId=${nodeId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load children');
      }

      const result = await response.json();

      // Update the tree data with loaded children
      setTreeData(prevTree => {
        if (!prevTree) return prevTree;
        const updatedTree = updateNodeChildren(prevTree, nodeId, result.children);
        updateVisibleNodes(updatedTree, expandedNodes);
        return updatedTree;
      });
    } catch (error) {
      console.error('Failed to load children:', error);
      toast({
        title: 'Error',
        description: 'Failed to load node children',
        variant: 'destructive',
      });
    } finally {
      setLoadingChildren(prev => {
        const newSet = new Set(prev);
        newSet.delete(nodeId);
        return newSet;
      });
    }
  }, [loadingChildren, toast]);

  // Helper to update node children in tree
  const updateNodeChildren = (node: GenealogyNode, targetId: string, children: GenealogyNode[]): GenealogyNode => {
    if (node.id === targetId) {
      return { ...node, children, hasChildren: children.length > 0 };
    }

    return {
      ...node,
      children: node.children.map(child => updateNodeChildren(child, targetId, children))
    };
  };

  // Update visible nodes based on expanded state
  const updateVisibleNodes = useCallback((tree: GenealogyNode, expanded: Set<string>) => {
    const nodes: GenealogyNode[] = [];

    const traverseTree = (node: GenealogyNode, level = 0) => {
      nodes.push({ ...node, level });

      if (expanded.has(node.id) && node.children.length > 0) {
        node.children.forEach(child => traverseTree(child, level + 1));
      }
    };

    if (tree) {
      traverseTree(tree);
    }

    setVisibleNodes(nodes);
  }, []);

  // Toggle node expansion
  const toggleNodeExpansion = useCallback(async (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);

    if (expandedNodes.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
      // Load children if not already loaded
      const node = findNodeById(treeData, nodeId);
      if (node && node.children.length === 0 && node.hasChildren) {
        await loadNodeChildren(nodeId);
      }
    }

    setExpandedNodes(newExpanded);
    if (treeData) {
      updateVisibleNodes(treeData, newExpanded);
    }
  }, [expandedNodes, treeData, updateVisibleNodes, loadNodeChildren]);

  // Find node by ID in tree
  const findNodeById = (tree: GenealogyNode | null, id: string): GenealogyNode | null => {
    if (!tree) return null;
    if (tree.id === id) return tree;

    for (const child of tree.children) {
      const found = findNodeById(child, id);
      if (found) return found;
    }

    return null;
  };

  // Expand all nodes at a specific level
  const expandAllAtLevel = useCallback((level: number) => {
    if (!treeData) return;

    const newExpanded = new Set(expandedNodes);
    const nodesToExpand: string[] = [];

    const collectNodes = (node: GenealogyNode, currentLevel = 0) => {
      if (currentLevel <= level && node.hasChildren) {
        nodesToExpand.push(node.id);
      }
      node.children.forEach(child => collectNodes(child, currentLevel + 1));
    };

    collectNodes(treeData);

    nodesToExpand.forEach(id => newExpanded.add(id));
    setExpandedNodes(newExpanded);
    updateVisibleNodes(treeData, newExpanded);
  }, [treeData, expandedNodes, updateVisibleNodes]);

  // Collapse all nodes
  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set());
    if (treeData) {
      updateVisibleNodes(treeData, new Set());
    }
  }, [treeData, updateVisibleNodes]);

  // Filter nodes based on search term
  const filteredNodes = visibleNodes.filter(node =>
    searchTerm === '' ||
    node.memberId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    node.fullName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    loadTreeData();
  }, [loadTreeData]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Loading genealogy tree...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Virtual Genealogy Tree
        </CardTitle>
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => expandAllAtLevel(1)}>
            <Expand className="h-4 w-4 mr-1" />
            Expand Level 1
          </Button>
          <Button variant="outline" size="sm" onClick={() => expandAllAtLevel(2)}>
            <Expand className="h-4 w-4 mr-1" />
            Expand Level 2
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            <Collapse className="h-4 w-4 mr-1" />
            Collapse All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div
          ref={containerRef}
          className="max-h-96 overflow-auto border rounded-md"
          style={{ height: '400px' }}
        >
          {filteredNodes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'No members found matching search criteria' : 'No tree data available'}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredNodes.map((node) => (
                <div
                  key={node.id}
                  className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded cursor-pointer"
                  style={{ paddingLeft: `${node.level * 20 + 8}px` }}
                  onClick={() => onNodeClick?.(node)}
                >
                  {node.hasChildren ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleNodeExpansion(node.id);
                      }}
                      disabled={loadingChildren.has(node.id)}
                    >
                      {loadingChildren.has(node.id) ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : expandedNodes.has(node.id) ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                    </Button>
                  ) : (
                    <div className="w-6" />
                  )}

                  <div className="flex items-center gap-2 flex-1">
                    <div>
                      <div className="font-medium text-sm">{node.fullName}</div>
                      <div className="text-xs text-muted-foreground">
                        {node.memberId} • {node.rank}
                      </div>
                    </div>

                    <div className="ml-auto flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        PV: {node.pv}
                      </Badge>
                      {node.totalDescendants && node.totalDescendants > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {node.totalDescendants} descendants
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 text-xs text-muted-foreground">
          Showing {filteredNodes.length} of {visibleNodes.length} visible nodes
          {treeData?.totalDescendants && (
            <> • Total network size: {treeData.totalDescendants} members</>
          )}
        </div>
      </CardContent>
    </Card>
  );
}</content>
<parameter name="filePath">C:\Users\V COMPUTER\Documents\dakdampostgre-devcg\dakdampostgre-devcg\src\components\admin\dashboard\virtual-genealogy-tree.tsx