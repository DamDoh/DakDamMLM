
'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { Member, TreeNode } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

async function buildTree(
  rootId: string,
  membersMap: Map<string, Member>,
  maxDepth = 3
): Promise<TreeNode | null> {
  const visited = new Set<string>(); // Prevent circular references
  
  const buildNode = (id: string | null, depth: number): TreeNode | null => {
    if (!id || depth > maxDepth || visited.has(id)) {
      return null;
    }
    
    visited.add(id);

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

  // Use ref to track if we're updating from external source to prevent loops
  const isExternalUpdateRef = useRef(false);
  
  useEffect(() => {
    if (initialRootId && initialRootId !== rootMemberId) {
      isExternalUpdateRef.current = true;
      setRootMemberId(initialRootId);
    }
  }, [initialRootId]); // Remove rootMemberId from dependencies to prevent loop


  const allMembersMap = useMemo(() => {
    const map = new Map<string, Member>();
    members.forEach(member => map.set(member.id, member));
    return map;
  }, [members]); // Depend on members array to rebuild map when members change
  
  const [tree, setTree] = useState<any>(null);
  const prevRootMemberIdRef = useRef<string | undefined>(rootMemberId);
  const prevMembersLengthRef = useRef<number>(members.length);
  
  useEffect(() => {
    // Only rebuild tree if rootMemberId actually changed or members count changed
    const rootChanged = prevRootMemberIdRef.current !== rootMemberId;
    const membersChanged = prevMembersLengthRef.current !== members.length;
    
    if (!rootChanged && !membersChanged) {
      return; // No need to rebuild
    }
    
    const generateTree = async () => {
      if (!rootMemberId || !members.length) {
        setTree(null);
        prevRootMemberIdRef.current = rootMemberId;
        prevMembersLengthRef.current = members.length;
        return;
      }
      
      const member = allMembersMap.get(rootMemberId);
      const newTree = await buildTree(rootMemberId, allMembersMap);
      setTree(newTree);
      
      // Update refs after successful build
      prevRootMemberIdRef.current = rootMemberId;
      prevMembersLengthRef.current = members.length;
    };
    
    generateTree();
  }, [rootMemberId, allMembersMap]); // Remove members from dependencies, use ref to track changes
  
  const rootMember = useMemo(() => {
      if(!rootMemberId) return undefined;
      return allMembersMap.get(rootMemberId)
    }, [rootMemberId, allMembersMap]);

  // Calculate PV for left/right legs by traversing placement tree
  const computeBranchPV = useCallback((branchRootId?: string | null) => {
    if (!branchRootId) return 0;
    let total = 0;
    const visited = new Set<string>(); // Prevent circular references
    const stack = [branchRootId];
    while (stack.length) {
      const id = stack.pop();
      if (!id || visited.has(id)) continue; // Skip if already visited
      visited.add(id);
      const member = allMembersMap.get(id);
      if (!member) continue;
      total += member.pv || 0;
      if (member.children?.left && !visited.has(member.children.left)) {
        stack.push(member.children.left);
      }
      if (member.children?.right && !visited.has(member.children.right)) {
        stack.push(member.children.right);
      }
    }
    return total;
  }, [allMembersMap]);

  const computeBranchMembers = useCallback((branchRootId?: string | null): Member[] => {
    if (!branchRootId) return [];
    const membersList: Member[] = [];
    const visited = new Set<string>(); // Prevent circular references
    const stack = [branchRootId];
    while (stack.length) {
      const id = stack.pop();
      if (!id || visited.has(id)) continue; // Skip if already visited
      visited.add(id);
      const member = allMembersMap.get(id);
      if (!member) continue;
      membersList.push(member);
      if (member.children?.left && !visited.has(member.children.left)) {
        stack.push(member.children.left);
      }
      if (member.children?.right && !visited.has(member.children.right)) {
        stack.push(member.children.right);
      }
    }
    return membersList;
  }, [allMembersMap]);


  const leftTeamMembers = useMemo(
    () => computeBranchMembers(rootMember?.children.left),
    [computeBranchMembers, rootMember]
  );

  const rightTeamMembers = useMemo(
    () => computeBranchMembers(rootMember?.children.right),
    [computeBranchMembers, rootMember]
  );

  const leftTeamPV = useMemo(
    () => computeBranchPV(rootMember?.children.left),
    [computeBranchPV, rootMember]
  );

  const rightTeamPV = useMemo(
    () => computeBranchPV(rootMember?.children.right),
    [computeBranchPV, rootMember]
  );

  const handleSetRoot = useCallback((id: string) => {
    if (!id || id === rootMemberId) {
      return; // Prevent unnecessary updates
    }
    
    // Try to find by database ID first
    if (allMembersMap.has(id)) {
      isExternalUpdateRef.current = false; // This is an internal update
      setRootMemberId(id);
    } else {
      // If not found, try to find by memberId (for backward compatibility with URLs)
      const memberByMemberId = Array.from(allMembersMap.values()).find(m => m.memberId === id);
      if (memberByMemberId) {
        isExternalUpdateRef.current = false;
        setRootMemberId(memberByMemberId.id);
      } else {
        toast({
            variant: 'destructive',
            title: 'Member Not Found',
            description: `Could not find a member with ID "${id}".`,
        });
      }
    }
  }, [allMembersMap, toast]); // Remove rootMemberId from dependencies to prevent circular updates

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
    leftTeamMembers,
    rightTeamMembers,
    isSearching,
    userId, // pass userId through
    handleSetRoot,
    handleGoUpline,
    handleGoToTop,
    handleSearch,
    handleNavigateLeft,
    handleNavigateRight,
    refreshData,
  }), [members, loading, allMembersMap, tree, rootMember, leftTeamPV, rightTeamPV, leftTeamMembers, rightTeamMembers, isSearching, userId, handleSetRoot, handleGoUpline, handleGoToTop, handleSearch, handleNavigateLeft, handleNavigateRight, refreshData]);
}
