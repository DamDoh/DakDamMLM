
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import MemberInfoPanel from '@/components/genealogy/member-info-panel';
import BinaryPageClient from '@/app/(app)/binary/binary-page-client';
import AddMemberDialog from '@/components/genealogy/add-member-dialog';
import EditMemberDialog from '@/components/genealogy/edit-member-dialog';
import MemberDetailModal from '@/components/genealogy/member-detail-modal';
import { useGenealogyContext } from '@/context/genealogy-context';
import type { Member } from '@/lib/types';
import { useI18n } from '@/lib/internationalization';
import { Loader2 } from 'lucide-react';

export default function GenealogyView() {
  const { t } = useI18n();
  const context = useGenealogyContext();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [addMemberProps, setAddMemberProps] = useState<{ parentId: string; position: 'left' | 'right' } | null>(null);

  const [editMemberDialogOpen, setEditMemberDialogOpen] = useState(false);
  const [editMember, setEditMember] = useState<Member | null>(null);

  const [memberDetailModalOpen, setMemberDetailModalOpen] = useState(false);
  const [selectedMemberForDetail, setSelectedMemberForDetail] = useState<Member | null>(null);

  const { rootMember, allMembersMap, handleUpdateMember, loading, handleSetRoot: contextHandleSetRoot } = context || { rootMember: null, allMembersMap: new Map(), handleUpdateMember: async () => false, loading: true, handleSetRoot: () => {} };

  // Wrapper for handleSetRoot that updates the context directly
  const handleSetRoot = useCallback((id: string) => {
    if (contextHandleSetRoot && id) {
      contextHandleSetRoot(id);
    }
  }, [contextHandleSetRoot]);

  // Track if we're updating from URL to prevent loops
  const isUpdatingFromUrlRef = useRef(false);
  const isUpdatingUrlRef = useRef(false);
  const prevRootMemberIdRef = useRef<string | null>(null);
  
  // Initialize from URL parameter when component mounts or URL changes (one-way: URL -> State)
  useEffect(() => {
    if (loading || !contextHandleSetRoot || allMembersMap.size === 0) {
      return;
    }
    
    const idFromUrl = searchParams.get('id');
    const currentRootId = rootMember?.id;
    
    // Only update from URL if:
    // 1. URL has an ID
    // 2. It's different from current root
    // 3. We're not currently updating the URL ourselves
    if (idFromUrl && idFromUrl !== currentRootId && !isUpdatingUrlRef.current) {
      // Check if the member exists in the map
      if (allMembersMap.has(idFromUrl)) {
        isUpdatingFromUrlRef.current = true;
        contextHandleSetRoot(idFromUrl);
        // Reset flag after a short delay
        setTimeout(() => {
          isUpdatingFromUrlRef.current = false;
        }, 100);
      }
    }
  }, [searchParams.get('id'), loading, contextHandleSetRoot, allMembersMap.size]);

  // Only sync URL when root member changes (one-way: State -> URL)
  useEffect(() => {
    if (!rootMember || loading) {
      return;
    }
    
    const currentRootId = rootMember.id;
    const currentIdInUrl = searchParams.get('id');
    
    // Only update URL if:
    // 1. Root member changed
    // 2. URL doesn't match
    // 3. We're not updating from URL
    if (currentRootId !== prevRootMemberIdRef.current && 
        currentRootId !== currentIdInUrl && 
        !isUpdatingFromUrlRef.current) {
      isUpdatingUrlRef.current = true;
      const params = new URLSearchParams(searchParams.toString());
      params.set('id', currentRootId);
      router.replace(`/binary?${params.toString()}`, { scroll: false });
      prevRootMemberIdRef.current = currentRootId;
      
      // Reset flag after navigation
      setTimeout(() => {
        isUpdatingUrlRef.current = false;
      }, 100);
    } else if (currentRootId !== prevRootMemberIdRef.current) {
      prevRootMemberIdRef.current = currentRootId;
    }
  }, [rootMember?.id, router]);

  const handleOpenAddMemberDialog = useCallback((parentId: string, position: 'left' | 'right') => {
    setAddMemberProps({ parentId, position });
    setAddMemberDialogOpen(true);
  }, []);

  const handleOpenEditMemberDialog = useCallback((member: Member) => {
    setEditMember(member);
    setEditMemberDialogOpen(true);
  }, []);

  const handleOpenMemberDetail = useCallback((member: Member) => {
    setSelectedMemberForDetail(member);
    setMemberDetailModalOpen(true);
  }, []);

  if (loading || !context || !rootMember) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">{t('genealogy.loading')}</p>
        </div>
      </div>
    );
  }
  
  const parentForDialog = addMemberProps ? allMembersMap?.get(addMemberProps.parentId) : null;
  const parentFullNameForDialog = parentForDialog ? `${parentForDialog.firstName} ${parentForDialog.surname}`: '';

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <header className="bg-accent">
        <MemberInfoPanel />
        <div className="bg-primary/50 h-1.5" />
      </header>
      <main className="flex-1 flex flex-col min-h-0 relative">
        <BinaryPageClient
          onAddMember={handleOpenAddMemberDialog}
          onEditMember={handleOpenEditMemberDialog}
          onMemberDetail={handleOpenMemberDetail}
          onSetRoot={handleSetRoot}
        />
      </main>

      {addMemberProps && allMembersMap && (
        <AddMemberDialog
          isOpen={addMemberDialogOpen}
          onOpenChange={setAddMemberDialogOpen}
          parentId={addMemberProps.parentId}
          position={addMemberProps.position}
          parentFullName={parentFullNameForDialog}
        />
      )}

      {editMember && handleUpdateMember && (
        <EditMemberDialog
          isOpen={editMemberDialogOpen}
          onOpenChange={setEditMemberDialogOpen}
          member={editMember}
          onUpdateMember={handleUpdateMember}
        />
      )}

      <MemberDetailModal
        member={selectedMemberForDetail}
        isOpen={memberDetailModalOpen}
        onClose={() => setMemberDetailModalOpen(false)}
      />
    </div>
  );
}
