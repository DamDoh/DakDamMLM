'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import type { Member, TreeNode } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

async function buildTree(
  rootId: string,
  membersMap: Map<string, Member>,
  maxDepth = 3
): Promise<TreeNode | null> {
  const buildNode = (id: string | null, depth: number): TreeNode | null => {
    if (!id || depth > maxDepth) {
      return null;
    }

    const memberData = membersMap.get(id);
    if (!memberData) {
      return null;
    }

    const node: TreeNode = {
      ...memberData,
      left: buildNode(memberData.children.left, depth + 1),
      right: buildNode(memberData.children.right, depth + 1),
    };

    return node;
  };

  return buildNode(rootId, 1);
};


interface UseGenealogyProps {
  userId?: string;
  initialRootId?: string;
  members: Member[];
  loading: boolean;
}

export function useGenealogy({ userId, initialRootId, members, loading }: UseGenealogyProps) {
  const [rootMemberId, setRootMemberId] = useState<string | undefined>(initialRootId);
  const [isSearching, setIsSearching] = useState(false);
  
  const { toast } = useToast();

  const refreshData = useCallback(async () => {
    // This function is now a no-op because data is real-time.
  }, []);

  useEffect(() => {
    if (initialRootId && initialRootId !== rootMemberId) {
      setRootMemberId(initialRootId);
    }
  }, [initialRootId, rootMemberId]);


  const allMembersMap = useMemo(() => {
    const map = new Map<string, Member>();
    members.forEach(member => map.set(member.id, member));
    return map;
  }, [members.length]); // Only depend on length to avoid recreating map on every member object change
  
  const [tree, setTree] = useState<any>(null);
  useEffect(() => {
    const generateTree = async () => {
      if (!rootMemberId || !members.length) {
        setTree(null);
        return;
      };
      const newTree = await buildTree(rootMemberId, allMembersMap);
      setTree(newTree);
    }
    generateTree();
  }, [rootMemberId, allMembersMap]); // Removed members.length since allMembersMap already depends on it
  
  const rootMember = useMemo(() => {
      if(!rootMemberId) return undefined;
      return allMembersMap.get(rootMemberId)
    }, [rootMemberId, allMembersMap]);

  const leftTeamPV = 0; // Simplified for this refactor
  const rightTeamPV = 0; // Simplified for this refactor

  const handleSetRoot = useCallback((id: string) => {
    if (id && allMembersMap.has(id)) {
      setRootMemberId(id);
    } else {
        toast({
            variant: 'destructive',
            title: 'Member Not Found',
            description: `Could not find a member with ID "${id}".`,
        });
    }
  }, [allMembersMap, toast]); // Removed rootMemberId from dependencies to avoid unnecessary re-renders

  const handleGoUpline = useCallback(() => {
    if(!rootMemberId) {
      return;
    }
    const currentMember = allMembersMap.get(rootMemberId);
    if (currentMember?.placementParentId) {
      handleSetRoot(currentMember.placementParentId);
    }
  }, [rootMemberId, allMembersMap, handleSetRoot]);
  
  const handleGoToTop = useCallback(() => {
    if (userId) {
        handleSetRoot(userId);
    }
  }, [userId, handleSetRoot]);

  const getDescendants = useCallback((rootId: string): string[] => {
    const descendants: string[] = [];
    const traverse = (id: string | null) => {
      if (!id) return;
      descendants.push(id);
      const member = allMembersMap.get(id);
      if (member) {
        traverse(member.children.left);
        traverse(member.children.right);
      }
    };
    traverse(rootId);
    return descendants;
  }, [allMembersMap]);

  const handleSearch = useCallback((query: string) => {
    if (!query || !userId) return;

    setIsSearching(true);
    const normalizedQuery = query.toLowerCase().trim();

    const descendants = getDescendants(userId);

    const foundMember = members.find(
      (m) => descendants.includes(m.id) && (
        m.memberId.toLowerCase() === normalizedQuery ||
        (m.email && m.email.toLowerCase() === normalizedQuery) ||
        (m.phoneNumber && m.phoneNumber === normalizedQuery)
      )
    );

    if (foundMember) {
      handleSetRoot(foundMember.id);
    } else {
      toast({
        variant: 'destructive',
        title: 'Member Not Found',
        description: `No member found with ID, email, or phone "${query}" in your branches.`,
      });
    }

    setIsSearching(false);

  }, [members, handleSetRoot, toast, userId, getDescendants]);
  

  const handleNavigateLeft = useCallback(() => {
    if(!rootMemberId) return;
    const currentMember = allMembersMap.get(rootMemberId);
    if (currentMember?.children.left) {
      handleSetRoot(currentMember.children.left);
    }
  }, [rootMemberId, allMembersMap, handleSetRoot]);

  const handleNavigateRight = useCallback(() => {
      if(!rootMemberId) return;
    const currentMember = allMembersMap.get(rootMemberId);
    if (currentMember?.children.right) {
      handleSetRoot(currentMember.children.right);
    }
  }, [rootMemberId, allMembersMap, handleSetRoot]);

  return useMemo(() => ({
    members,
    loading,
    allMembersMap,
    tree,
    rootMember,
    leftTeamPV,
    rightTeamPV,
    isSearching,
    userId, // pass userId through
    handleSetRoot,
    handleGoUpline,
    handleGoToTop,
    handleSearch,
    handleNavigateLeft,
    handleNavigateRight,
    refreshData,
  }), [members, loading, allMembersMap, tree, rootMember, leftTeamPV, rightTeamPV, isSearching, userId, handleSetRoot, handleGoUpline, handleGoToTop, handleSearch, handleNavigateLeft, handleNavigateRight, refreshData]);
}
