import { prisma } from '@/lib/database';
import { hashPassword } from '@/lib/auth';

interface SeedMember {
  id: string;
  email: string;
  phoneNumber: string;
  firstName: string;
  surname: string;
  fullName: string;
  memberId: string;
  rank: string;
  pv: number;
  teamSize: { left: number; right: number; total: number };
  children: { left: string | null; right: string | null };
  active: boolean;
  isAdmin: boolean;
  sponsorId?: string;
  placementParentId?: string;
  position?: string;
  avatarUrl: string;
  addresses: any[];
  joinDate: string;
}

export class MemberSeeder {
  private readonly sampleMembers: SeedMember[] = [
    {
      id: 'user-1',
      email: 'admin@dakdam.com',
      phoneNumber: '+1234567890',
      firstName: 'Admin',
      surname: 'User',
      fullName: 'Admin User',
      memberId: 'ADM001',
      rank: 'Diamond',
      pv: 10000,
      teamSize: { left: 150, right: 145, total: 295 },
      children: { left: 'user-2', right: 'user-3' },
      active: true,
      isAdmin: true,
      avatarUrl: '/images/default-avatar.png',
      addresses: [],
      joinDate: '2024-01-15T00:00:00Z'
    },
    {
      id: 'user-2',
      email: 'john.doe@dakdam.com',
      phoneNumber: '+1234567891',
      firstName: 'John',
      surname: 'Doe',
      fullName: 'John Doe',
      memberId: 'MEM001',
      rank: 'Gold',
      pv: 2500,
      teamSize: { left: 25, right: 30, total: 55 },
      children: { left: 'user-4', right: null },
      active: true,
      isAdmin: false,
      sponsorId: 'user-1',
      placementParentId: 'user-1',
      position: 'left',
      avatarUrl: '/images/default-avatar.png',
      addresses: [],
      joinDate: '2024-02-01T00:00:00Z'
    },
    {
      id: 'user-3',
      email: 'jane.smith@dakdam.com',
      phoneNumber: '+1234567892',
      firstName: 'Jane',
      surname: 'Smith',
      fullName: 'Jane Smith',
      memberId: 'MEM002',
      rank: 'Silver',
      pv: 1200,
      teamSize: { left: 15, right: 20, total: 35 },
      children: { left: null, right: 'user-5' },
      active: true,
      isAdmin: false,
      sponsorId: 'user-1',
      placementParentId: 'user-1',
      position: 'right',
      avatarUrl: '/images/default-avatar.png',
      addresses: [],
      joinDate: '2024-02-15T00:00:00Z'
    },
    {
      id: 'user-4',
      email: 'mike.johnson@dakdam.com',
      phoneNumber: '+1234567893',
      firstName: 'Mike',
      surname: 'Johnson',
      fullName: 'Mike Johnson',
      memberId: 'MEM003',
      rank: 'Member',
      pv: 450,
      teamSize: { left: 0, right: 0, total: 0 },
      children: { left: null, right: null },
      active: true,
      isAdmin: false,
      sponsorId: 'user-2',
      placementParentId: 'user-2',
      position: 'left',
      avatarUrl: '/images/default-avatar.png',
      addresses: [],
      joinDate: '2024-03-01T00:00:00Z'
    },
    {
      id: 'user-5',
      email: 'sarah.williams@dakdam.com',
      phoneNumber: '+1234567894',
      firstName: 'Sarah',
      surname: 'Williams',
      fullName: 'Sarah Williams',
      memberId: 'MEM004',
      rank: 'Member',
      pv: 380,
      teamSize: { left: 0, right: 0, total: 0 },
      children: { left: null, right: null },
      active: true,
      isAdmin: false,
      sponsorId: 'user-3',
      placementParentId: 'user-3',
      position: 'right',
      avatarUrl: '/images/default-avatar.png',
      addresses: [],
      joinDate: '2024-03-10T00:00:00Z'
    }
  ];

  async seed(): Promise<number> {
    let count = 0;
    for (const member of this.sampleMembers) {
      try {
        const defaultPassword = await hashPassword('password123');

        await prisma.user.upsert({
          where: { id: member.id },
          update: {
            email: member.email,
            phoneNumber: member.phoneNumber,
            firstName: member.firstName,
            surname: member.surname,
            fullName: member.fullName,
            memberId: member.memberId,
            rank: member.rank,
            pv: member.pv,
            teamSize: member.teamSize,
            children: member.children,
            active: member.active,
            isAdmin: member.isAdmin,
            sponsorId: member.sponsorId,
            placementParentId: member.placementParentId,
            position: member.position,
            avatarUrl: member.avatarUrl,
            addresses: member.addresses,
            updatedAt: new Date(),
          },
          create: {
            id: member.id,
            email: member.email,
            password: defaultPassword,
            phoneNumber: member.phoneNumber,
            firstName: member.firstName,
            surname: member.surname,
            fullName: member.fullName,
            memberId: member.memberId,
            rank: member.rank,
            pv: member.pv,
            teamSize: member.teamSize,
            children: member.children,
            active: member.active,
            isAdmin: member.isAdmin,
            sponsorId: member.sponsorId,
            placementParentId: member.placementParentId,
            position: member.position,
            avatarUrl: member.avatarUrl,
            addresses: member.addresses,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
        });
        count++;
      } catch (error) {
        console.error(`Failed to seed member ${member.id}:`, error);
      }
    }

    return count;
  }
}