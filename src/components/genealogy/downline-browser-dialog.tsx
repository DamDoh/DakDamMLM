'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2, User, ChevronRight, ChevronDown, Info, UserPlus } from 'lucide-react';
import { useI18n } from '@/lib/internationalization';
import { useGenealogyContext } from '@/context/genealogy-context';
import { useAuthContext } from '@/context/auth-context';
import type { Member } from '@/lib/types';
import { stockistLevelNames } from '@/lib/types';
import { cn } from '@/lib/utils';

interface DownlineBrowserDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSelect: (parentId: string, position: 'left' | 'right', parentName: string) => void;
  rootUserId: string; // The user who owns this downline
}

interface TreeNode {
  member: Member;
  children: {
    left: TreeNode | null;
    right: TreeNode | null;
  };
  level: number;
}

export default function DownlineBrowserDialog({ 
  isOpen, 
  onOpenChange, 
  onSelect,
  rootUserId 
}: DownlineBrowserDialogProps) {
  const { t } = useI18n();
  const context = useGenealogyContext();
  const { user: authUser } = useAuthContext();
  const allMembersMap = context?.allMembersMap || new Map();
  
  // Get the authenticated user's member data (not the currently viewed root)
  const authenticatedUserMember = useMemo(() => {
    if (!authUser?.id) return null;
    return allMembersMap.get(authUser.id) || null;
  }, [authUser?.id, allMembersMap]);
  
  // Use authenticated user as root for downline browsing
  const rootMember = authenticatedUserMember;

  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<'left' | 'right'>('left');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set([rootUserId]));
  const [selectedMemberForInfo, setSelectedMemberForInfo] = useState<Member | null>(null);

  // Build tree structure from authenticated user's downline
  const tree = useMemo(() => {
    if (!rootMember || !allMembersMap) return null;

    const buildTree = (memberId: string, level: number = 0): TreeNode | null => {
      const member = allMembersMap.get(memberId);
      if (!member) return null;

      return {
        member,
        children: {
          left: member.children?.left ? buildTree(member.children.left, level + 1) : null,
          right: member.children?.right ? buildTree(member.children.right, level + 1) : null,
        },
        level,
      };
    };

    return buildTree(rootMember.id);
  }, [rootMember, allMembersMap]);

  // Get all downline members for validation (only authenticated user's downline)
  const allDownlineIds = useMemo(() => {
    const ids = new Set<string>();
    if (!rootMember) return ids;

    const collectIds = (memberId: string) => {
      const member = allMembersMap.get(memberId);
      if (!member) return;
      
      // Don't add the root member itself, only their downline
      if (memberId !== rootMember.id) {
        ids.add(memberId);
      }
      
      if (member.children?.left) collectIds(member.children.left);
      if (member.children?.right) collectIds(member.children.right);
    };

    // Start collecting from root's children
    if (rootMember.children?.left) collectIds(rootMember.children.left);
    if (rootMember.children?.right) collectIds(rootMember.children.right);
    
    return ids;
  }, [rootMember, allMembersMap]);

  const toggleExpand = (memberId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(memberId)) {
      newExpanded.delete(memberId);
    } else {
      newExpanded.add(memberId);
    }
    setExpandedNodes(newExpanded);
  };

  const handleSelectParent = (memberId: string) => {
    // Verify member is in downline
    if (!allDownlineIds.has(memberId)) {
      return;
    }
    setSelectedParentId(memberId);
    const member = allMembersMap.get(memberId);
    if (member) {
      setSelectedMemberForInfo(member);
    }
  };

  const handleConfirm = () => {
    if (!selectedParentId) return;
    
    const parent = allMembersMap.get(selectedParentId);
    if (!parent) return;

    const parentName = `${parent.firstName} ${parent.surname}`;
    onSelect(selectedParentId, selectedPosition, parentName);
    onOpenChange(false);
    
    // Reset state
    setSelectedParentId(null);
    setSelectedPosition('left');
    setSelectedMemberForInfo(null);
  };

  const renderTreeNode = (node: TreeNode | null, depth: number = 0): React.ReactNode => {
    if (!node) return null;

    const { member, children } = node;
    const isExpanded = expandedNodes.has(member.id);
    const hasChildren = !!(children.left || children.right);
    const isSelected = selectedParentId === member.id;

    return (
      <div key={member.id} className="select-none">
        <div
          className={cn(
            "flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-muted transition-colors",
            isSelected && "bg-primary/10 border border-primary"
          )}
          style={{ paddingLeft: `${depth * 1.5 + 0.5}rem` }}
        >
          {hasChildren ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(member.id);
              }}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          ) : (
            <div className="w-6" />
          )}
          
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "flex-1 justify-start h-auto p-2",
              isSelected && "bg-primary/20"
            )}
            onClick={() => handleSelectParent(member.id)}
          >
            <div className="flex items-center gap-2 flex-1">
              <User className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 text-left">
                <div className="font-medium text-sm">
                  {member.firstName} {member.surname}
                </div>
                <div className="text-xs text-muted-foreground">
                  {member.memberId}
                </div>
              </div>
              {member.storeOwnerLevel && stockistLevelNames[member.storeOwnerLevel as keyof typeof stockistLevelNames] && (
                <Badge variant="secondary" className="text-xs">
                  {member.storeOwnerLevel}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedMemberForInfo(member);
                }}
              >
                <Info className="h-4 w-4" />
              </Button>
            </div>
          </Button>
        </div>
        
        {isExpanded && hasChildren && (
          <div>
            {renderTreeNode(children.left, depth + 1)}
            {renderTreeNode(children.right, depth + 1)}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus /> Select Parent Member
            </DialogTitle>
            <DialogDescription>
              Browse your downline and select where to add the new member. You can add members under any member in your downline.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 flex gap-4 min-h-0">
            {/* Tree Browser */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="text-sm font-medium mb-2">Your Downline Tree</div>
              <ScrollArea className="flex-1 border rounded-md p-2">
                {tree ? (
                  <div className="space-y-1">
                    {renderTreeNode(tree)}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-32 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    Loading downline...
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Selection Panel */}
            <div className="w-80 flex flex-col gap-4 border-l pl-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Selected Parent</Label>
                {selectedParentId ? (
                  <div className="p-3 bg-muted rounded-md">
                    <div className="font-medium">
                      {selectedMemberForInfo?.firstName} {selectedMemberForInfo?.surname}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {selectedMemberForInfo?.memberId}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground text-center">
                    No parent selected
                  </div>
                )}
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">Select Position</Label>
                <RadioGroup
                  value={selectedPosition}
                  onValueChange={(value) => setSelectedPosition(value as 'left' | 'right')}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="left" id="left" />
                    <Label htmlFor="left" className="cursor-pointer">Left Leg</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="right" id="right" />
                    <Label htmlFor="right" className="cursor-pointer">Right Leg</Label>
                  </div>
                </RadioGroup>
              </div>

              {selectedMemberForInfo && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Member Info</Label>
                  <div className="p-3 bg-muted rounded-md space-y-1 text-sm">
                    <div>
                      <span className="text-muted-foreground">Name:</span>{' '}
                      <span className="font-medium">
                        {selectedMemberForInfo.firstName} {selectedMemberForInfo.surname}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Member ID:</span>{' '}
                      <span className="font-medium">{selectedMemberForInfo.memberId}</span>
                    </div>
                    {selectedMemberForInfo.rank && (
                      <div>
                        <span className="text-muted-foreground">Rank:</span>{' '}
                        <span className="font-medium">{selectedMemberForInfo.rank}</span>
                      </div>
                    )}
                    {selectedMemberForInfo.storeOwnerLevel && (
                      <div>
                        <span className="text-muted-foreground">Stockist Level:</span>{' '}
                        <span className="font-medium">
                          {selectedMemberForInfo.storeOwnerLevel} - {stockistLevelNames[selectedMemberForInfo.storeOwnerLevel as keyof typeof stockistLevelNames]}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirm} 
              disabled={!selectedParentId}
            >
              Continue to Add Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Member Info Modal */}
      {selectedMemberForInfo && (
        <Dialog open={!!selectedMemberForInfo} onOpenChange={() => setSelectedMemberForInfo(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Member Information</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground">Full Name</Label>
                <div className="font-medium">
                  {selectedMemberForInfo.firstName} {selectedMemberForInfo.surname}
                </div>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Member ID</Label>
                <div className="font-medium">{selectedMemberForInfo.memberId}</div>
              </div>
              {selectedMemberForInfo.rank && (
                <div>
                  <Label className="text-sm text-muted-foreground">Rank</Label>
                  <div className="font-medium">{selectedMemberForInfo.rank}</div>
                </div>
              )}
              {selectedMemberForInfo.storeOwnerLevel && (
                <div>
                  <Label className="text-sm text-muted-foreground">Stockist Level</Label>
                  <div className="font-medium">
                    {selectedMemberForInfo.storeOwnerLevel} - {stockistLevelNames[selectedMemberForInfo.storeOwnerLevel as keyof typeof stockistLevelNames]}
                  </div>
                </div>
              )}
              {selectedMemberForInfo.email && (
                <div>
                  <Label className="text-sm text-muted-foreground">Email</Label>
                  <div className="font-medium">{selectedMemberForInfo.email}</div>
                </div>
              )}
              {selectedMemberForInfo.phoneNumber && (
                <div>
                  <Label className="text-sm text-muted-foreground">Phone</Label>
                  <div className="font-medium">{selectedMemberForInfo.phoneNumber}</div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setSelectedMemberForInfo(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

