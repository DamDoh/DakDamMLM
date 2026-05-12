import type { Member } from '@/lib/types';

// IMPORTANT: This module is imported by client components.
// Do NOT import Prisma here. Use API routes for data access from the browser.

export async function getAllMembers(): Promise<Member[]> {
  try {
    // Fetch all members with pagination (fetch in batches)
    const allMembers: Member[] = [];
    let offset = 0;
    const limit = 500;
    let hasMore = true;

    while (hasMore) {
      // Add timestamp and random number to prevent caching (more aggressive cache-busting)
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      const res = await fetch(`/api/members?limit=${limit}&offset=${offset}&_t=${timestamp}&_r=${random}`, { 
        cache: 'no-store',
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });
      if (!res.ok) throw new Error('Failed to fetch members');
      const data = await res.json();
      
      if (data.data && Array.isArray(data.data)) {
        allMembers.push(...data.data);
        hasMore = data.pagination?.hasNext || false;
        offset += limit;
      } else {
        // Fallback for old API format
        if (Array.isArray(data)) {
          allMembers.push(...data);
          hasMore = false;
        } else {
          hasMore = false;
        }
      }
    }
    
    return allMembers;
  } catch (error) {
    console.error('Failed to get all members:', error);
    throw error;
  }
}

export async function addMemberToDb(memberData: any): Promise<string> {
  // This operation writes to the database and must not run in the browser.
  // Implement this via a server action or API route before using on the client.
  throw new Error('addMemberToDb is server-only. Use a server action or API route.');
}

export async function findFirstAvailablePosition(
  rootId: string,
  allMembers: Map<string, Member>
): Promise<{ parentId: string; position: 'left' | 'right' } | null> {
  const queue: string[] = [rootId];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const member = allMembers.get(currentId);
    if (!member) continue;

    // Check if left position is available
    if (!member.children.left) {
      return { parentId: currentId, position: 'left' };
    }

    // Check if right position is available
    if (!member.children.right) {
      return { parentId: currentId, position: 'right' };
    }

    // Add children to queue for BFS
    if (member.children.left && !visited.has(member.children.left)) {
      queue.push(member.children.left);
    }
    if (member.children.right && !visited.has(member.children.right)) {
      queue.push(member.children.right);
    }
  }

  return null;
}

