'use server';

import { prisma } from '@/lib/database';

export async function checkUserExists(email: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { email }
    });

    return { exists: !!user };
  } catch (error) {
    console.error('Error checking user existence:', error);
    return { exists: false };
  }
}