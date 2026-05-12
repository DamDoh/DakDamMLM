'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Sample binary tree data
const sampleTree = {
  id: '1',
  name: 'John Doe',
  position: 'root',
  left: {
    id: '2',
    name: 'Jane Smith',
    position: 'left',
    left: {
      id: '4',
      name: 'Bob Johnson',
      position: 'left',
    },
    right: {
      id: '5',
      name: 'Alice Brown',
      position: 'right',
    },
  },
  right: {
    id: '3',
    name: 'Mike Wilson',
    position: 'right',
    left: {
      id: '6',
      name: 'Sarah Davis',
      position: 'left',
    },
    right: {
      id: '7',
      name: 'Tom Garcia',
      position: 'right',
    },
  },
};

interface TreeNodeProps {
  node: any;
  level: number;
}

function TreeNode({ node, level }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="flex flex-col items-center">
      <Card className="mb-4 min-w-[120px]">
        <CardContent className="p-3 text-center">
          <div className="font-medium text-sm">{node.name}</div>
          <div className="text-xs text-muted-foreground capitalize">{node.position}</div>
        </CardContent>
      </Card>

      {expanded && (node.left || node.right) && (
        <div className="flex gap-8">
          {node.left && (
            <div className="flex flex-col items-center">
              <div className="w-px h-4 bg-border"></div>
              <TreeNode node={node.left} level={level + 1} />
            </div>
          )}
          {node.right && (
            <div className="flex flex-col items-center">
              <div className="w-px h-4 bg-border"></div>
              <TreeNode node={node.right} level={level + 1} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function GenealogyPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Genealogy Tree</h1>
      <Card>
        <CardHeader>
          <CardTitle>Binary Network Structure</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="min-w-max">
              <TreeNode node={sampleTree} level={0} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}