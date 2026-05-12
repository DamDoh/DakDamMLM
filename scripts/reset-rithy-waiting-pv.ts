/**
 * Reset waiting PV for RiThy VoNg since downlines were removed
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetRithyVongWaitingPV() {
  try {
    // Find RiThy VoNg
    const user = await prisma.user.findFirst({
      where: { 
        OR: [
          { fullName: { contains: 'RiThy VoNg' } },
          { memberId: 'ADMIN002' }
        ]
      },
      select: { id: true, fullName: true, memberId: true, leftWaitingPV: true, rightWaitingPV: true }
    });
    
    if (!user) {
      console.log('User not found');
      return;
    }
    
    console.log('Found user:', user);
    
    // Check if they have any active downlines
    const downlines = await prisma.user.count({
      where: {
        placementParentId: user.id,
        deleted: false,
        active: true
      }
    });
    
    console.log('Active downlines:', downlines);
    
    if (downlines === 0) {
      // Reset waiting PV since no downlines
      await prisma.user.update({
        where: { id: user.id },
        data: {
          leftWaitingPV: 0,
          rightWaitingPV: 0,
          teamSize: { left: 0, right: 0, total: 0 }
        }
      });
      console.log('✅ Reset waiting PV and teamSize to 0');
    } else {
      console.log('⚠️ User has downlines, not resetting');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetRithyVongWaitingPV();


