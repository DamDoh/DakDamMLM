import type { Member } from '@/lib/types';
import { prisma } from '@/lib/database';

// IMPORTANT: This module is imported by client components.
// Do NOT import Prisma here. Use API routes for data access from the browser.

export async function getAllMembers(): Promise<Member[]> {
  try {
    const res = await fetch('/api/members', { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch members');
    const members: Member[] = await res.json();
    return members;
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

export async function setUserAsAdmin(userId: string): Promise<{ success: boolean; message: string }> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { isAdmin: true }
    });

    return { success: true, message: 'User has been set as admin successfully.' };
  } catch (error: any) {
    console.error('Failed to set user as admin:', error);
    return { success: false, message: error.message || 'Failed to set user as admin.' };
  }
}
