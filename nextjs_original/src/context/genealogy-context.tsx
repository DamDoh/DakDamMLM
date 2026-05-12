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
  
  const handleUpdateMember = useCallback(async (memberId: string, updatedData: Partial<Member>) => {
    try {
      await updateMemberOnServer(memberId, updatedData);
      return true;
    } catch (error: any) {
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
    handleUpdateMember
  }), [genealogyData, handleUpdateMember]);
  
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
