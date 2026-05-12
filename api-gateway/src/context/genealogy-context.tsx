'use client';

import { createContext, useContext, ReactNode, useMemo, useEffect, useState, useCallback } from 'react';
import { useGenealogy } from '@/hooks/use-genealogy';
import { useAuthContext } from './auth-context';
import type { Member } from '@/lib/types';
import { getAllMembers } from '@/services/user-service';
import { updateMemberOnServer } from '@/services/server-actions';
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
  
  const refreshMembers = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const allMembers = await getAllMembers();
      setMembers(allMembers);
      setLoading(false);
    } catch (error) {
      console.error('Failed to refresh members:', error);
      setLoading(false);
    }
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
      
      // Then update on server
      await updateMemberOnServer(memberId, updatedData);
      
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
    handleUpdateMember,
    refreshMembers
  }), [genealogyData, handleUpdateMember, refreshMembers]);
  
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
