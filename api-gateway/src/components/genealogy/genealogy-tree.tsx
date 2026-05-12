
'use client';

import type { TreeNode, Member } from '@/lib/types';
import MemberNode from './member-node';
import { Loader2 } from 'lucide-react';

interface GenealogyTreeProps {
  node: TreeNode | null;
  onNodeClick: (id: string) => void;
  allMembers: Map<string, Member>;
  onAddMember: (parentId: string, position: 'left' | 'right') => void;
  onEditMember?: (member: Member) => void;
  onMemberDetail?: (member: Member) => void;
  isLoading: boolean;
}

export default function GenealogyTree({ node, onNodeClick, allMembers, onAddMember, onEditMember, onMemberDetail, isLoading }: GenealogyTreeProps) {

  if (isLoading || !node) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    )
  }
  
  const renderChild = (childId: string | null, position: 'left' | 'right') => {
    const childNode = position === 'left' ? node.left : node.right;
    
    // If the tree was built deep enough to include this node, recurse
    if (childNode) {
      return <GenealogyTree node={childNode} onNodeClick={onNodeClick} allMembers={allMembers} onAddMember={onAddMember} onEditMember={onEditMember} onMemberDetail={onMemberDetail} isLoading={false} />;
    }
    
    // If the child exists in the data but wasn't included in the shallow tree, render a single node for it
    if (childId) {
      const member = allMembers.get(childId);
      if (!member) return null; // Should not happen if data is consistent
      return <MemberNode member={member} onNodeClick={onNodeClick} onEditClick={onEditMember} onDetailClick={onMemberDetail}/>;
    }
    
    // Otherwise, render the placeholder to add a new member
    return <MemberNode onNodeClick={() => {}} onAddClick={() => onAddMember(node.id, position)} />;
  };

  return (
    <div className="tree-container">
      <div className="tree">
        <ul>
          <li>
            <MemberNode member={node} onNodeClick={onNodeClick} onEditClick={onEditMember} onDetailClick={onMemberDetail}/>
            <ul>
              <li>
                {renderChild(node.children.left, 'left')}
              </li>
              <li>
                {renderChild(node.children.right, 'right')}
              </li>
            </ul>
          </li>
        </ul>
      </div>
    </div>
  );
}
