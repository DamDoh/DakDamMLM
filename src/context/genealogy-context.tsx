'use client';

import { createContext, useContext, ReactNode, useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { useGenealogy } from '@/hooks/use-genealogy';
import { useAuthContext } from './auth-context';
import type { Member } from '@/lib/types';
import { getAllMembers } from '@/services/user-service';
import { useToast } from '@/hooks/use-toast';

type GenealogyContextType = ReturnType<typeof useGenealogy> & {
  handleUpdateMember: (memberId: string, updatedData: Partial<Member>) => Promise<boolean>;
  refreshMembers: () => Promise<void>;
};

const GenealogyContext = createContext<GenealogyContextType | undefined>(undefined);

interface GenealogyProviderProps {
  children: ReactNode;
  initialRootId?: string;
}

export function GenealogyProvider({ children, initialRootId: initialRootIdFromProps }: GenealogyProviderProps) {
   const { user } = useAuthContext();
   const { toast } = useToast();
   const userId = user?.id;

   const [members, setMembers] = useState<Member[]>([]);
   const [loading, setLoading] = useState(true);
   const [dynamicRootId, setDynamicRootId] = useState<string | undefined>(initialRootIdFromProps || userId);

  // Update dynamicRootId when initialRootIdFromProps changes (from URL)
  useEffect(() => {
    if (initialRootIdFromProps && initialRootIdFromProps !== dynamicRootId) {
      setDynamicRootId(initialRootIdFromProps);
    }
  }, [initialRootIdFromProps]);

  useEffect(() => {
    if (!user) {
      setMembers([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Fetch members from Prisma database
    const fetchMembers = async () => {
      try {
        const allMembers = await getAllMembers();
        setMembers(allMembers);

        // Determine root ID only after members are fetched
        const userDoc = allMembers.find(m => m.id === user.id);
        const userIsAdmin = userDoc?.isAdmin === true;

        let topLevelMember;
        if (userIsAdmin && !initialRootIdFromProps) {
          topLevelMember = allMembers.find(m => !m.placementParentId);
          setDynamicRootId(topLevelMember?.id || user.id);
        } else {
          setDynamicRootId(initialRootIdFromProps || user.id);
        }

        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch members:', error);
        setLoading(false);
      }
    };

    fetchMembers();
  }, [user, initialRootIdFromProps]);


  const genealogyData = useGenealogy({
    userId: userId,
    initialRootId: dynamicRootId,
    members,
    loading: loading
  });

  // Override handleSetRoot to update dynamicRootId in context
  // Use ref to prevent unnecessary updates
  const prevDynamicRootIdRef = useRef<string | undefined>(dynamicRootId);
  
  const handleSetRootOverride = useCallback((id: string) => {
    // Prevent unnecessary state updates if ID hasn't changed
    if (id === prevDynamicRootIdRef.current) {
      return;
    }
    prevDynamicRootIdRef.current = id;
    setDynamicRootId(id);
  }, []);

  // Override handleGoUpline to use the context's setDynamicRootId
  const handleGoUplineOverride = useCallback(() => {
    const currentMember = genealogyData.allMembersMap.get(dynamicRootId || '');
    if (currentMember?.placementParentId) {
      console.log('🔵 Going upline to parent:', currentMember.placementParentId);
      setDynamicRootId(currentMember.placementParentId);
    }
  }, [genealogyData.allMembersMap, dynamicRootId]);

  // Override handleGoToTop to use the context's setDynamicRootId
  const handleGoToTopOverride = useCallback(() => {
    if (userId) {
      console.log('🔵 Going to top (user root):', userId);
      setDynamicRootId(userId);
    }
  }, [userId]);
  
  const refreshMembers = useCallback(async () => {
    if (!user) return;
    
    const doRefresh = async (attempt: number): Promise<void> => {
      try {
        if (attempt === 0) {
          setLoading(true);
          // Add a delay to ensure database commit is complete (especially for slower networks)
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Fetch with aggressive cache-busting
        const allMembers = await getAllMembers();
        
        // Force update by creating a completely new array to ensure React detects the change
        setMembers([...allMembers]);
        setLoading(false);
        
        console.log(`Members refreshed: ${allMembers.length} members loaded`);
        // Log member IDs for debugging
        console.log('Member IDs:', allMembers.map(m => ({ id: m.id, memberId: m.memberId, parent: m.placementParentId, position: m.position })));
      } catch (error) {
        console.error('Failed to refresh members:', error);
        
        // Retry once after a delay if first attempt fails (handles network issues)
        if (attempt === 0) {
          console.log('Retrying member refresh...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          return doRefresh(1);
        } else {
          setLoading(false);
          throw error; // Re-throw to allow caller to handle
        }
      }
    };
    
    await doRefresh(0);
  }, [user]);

  const handleUpdateMember = useCallback(async (memberId: string, updatedData: Partial<Member>) => {
    try {
      // Optimistic update: update local state immediately
      setMembers(prevMembers => 
        prevMembers.map(member => 
          member.id === memberId 
            ? { ...member, ...updatedData, fullName: updatedData.firstName && updatedData.surname 
                ? `${updatedData.firstName} ${updatedData.surname}` 
                : member.fullName }
            : member
        )
      );
      
      // Then update on server via API route
      const response = await fetch(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.error || errorData.message || 'Failed to update member';
        throw new Error(message);
      }
      
      // Refresh the members list to ensure consistency with server
      try {
        const allMembers = await getAllMembers();
        setMembers(allMembers);
      } catch (refreshError) {
        console.error('Failed to refresh members list:', refreshError);
        // Still return true since the update was successful
      }
      
      return true;
    } catch (error: any) {
      // Rollback optimistic update on error
      try {
        const allMembers = await getAllMembers();
        setMembers(allMembers);
      } catch (refreshError) {
        console.error('Failed to rollback members list:', refreshError);
      }
      
      // The server action will emit the specific error for the developer overlay.
      // This toast is a user-friendly fallback.
      toast({
        variant: 'destructive',
        title: 'Sync Error',
        description: 'Failed to save changes to the database. Check console for details.',
      });
      return false;
    }
  }, [toast]);

  const value: GenealogyContextType = useMemo(() => ({
    ...genealogyData,
    handleSetRoot: handleSetRootOverride,
    handleGoUpline: handleGoUplineOverride,
    handleGoToTop: handleGoToTopOverride,
    handleUpdateMember,
    refreshMembers
  }), [genealogyData, handleSetRootOverride, handleGoUplineOverride, handleGoToTopOverride, handleUpdateMember, refreshMembers]);
  
  return (
    <GenealogyContext.Provider value={value}>
      {children}
    </GenealogyContext.Provider>
  );
}

export function useGenealogyContext() {
  const context = useContext(GenealogyContext);
  return context;
}
