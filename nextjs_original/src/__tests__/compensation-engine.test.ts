
import { calculateBinaryBonus, calculateStockistBonus, updateRank, getLegVolume, calculateGroupPV, calculateMatchingBonus } from '../services/server-actions';
import { businessRules } from '../lib/business-rules';
import type { Member } from '../lib/types';

// Mock data for testing
const createMockMember = (overrides: Partial<Member> = {}): Member => ({
  id: 'test-member-1',
  memberId: 'M000001',
  firstName: 'John',
  surname: 'Doe',
  fullName: 'John Doe',
  email: 'john@example.com',
  avatarUrl: '/images/default-avatar.png',
  rank: 'Bronze',
  storeOwnerLevel: null,
  accountType: 'Distributor',
  pv: 1000,
  teamSize: { left: 5, right: 3, total: 8 },
  joinDate: '2024-01-01',
  sponsorId: null,
  placementParentId: null,
  position: null,
  children: { left: 'child-1', right: 'child-2' },
  active: true,
  phoneNumber: '+1234567890',
  addresses: [],
  ...overrides
});

const createMockMembersMap = (members: Member[]): Map<string, Member> => {
  return new Map(members.map(member => [member.id, member]));
};

describe('Compensation Engine Tests', () => {
  describe('Binary Commission Calculations', () => {
    test('calculates correct binary commission for balanced legs', async () => {
      const member = createMockMember({ pv: 1000 });
      const members = [
        member,
        createMockMember({ id: 'child-1', pv: 500, children: { left: null, right: null } }),
        createMockMember({ id: 'child-2', pv: 500, children: { left: null, right: null } }),
      ];
      const membersMap = createMockMembersMap(members);

      const result = await calculateBinaryBonus(member, membersMap, 'test-cycle');

      expect(result).toBeTruthy();
      expect(result!.amount).toBe(50); // 500 * 0.10 = 50
      expect(result!.type).toBe('Binary Bonus');
    });

    test('calculates commission for unbalanced legs (weaker leg)', async () => {
      const member = createMockMember({ pv: 1000 });
      const members = [
        member,
        createMockMember({ id: 'child-1', pv: 800, children: { left: null, right: null } }), // Stronger leg
        createMockMember({ id: 'child-2', pv: 400, children: { left: null, right: null } }), // Weaker leg
      ];
      const membersMap = createMockMembersMap(members);

      const result = await calculateBinaryBonus(member, membersMap, 'test-cycle');

      expect(result!.amount).toBe(40); // 400 * 0.10 = 40 (weaker leg)
    });

    test('applies rank-based commission caps', async () => {
      const member = createMockMember({
        pv: 10000,
        rank: 'Bronze' // Cap: 1000
      });
      const members = [
        member,
        createMockMember({ id: 'child-1', pv: 60000, children: { left: null, right: null } }),
        createMockMember({ id: 'child-2', pv: 60000, children: { left: null, right: null } }),
      ];
      const membersMap = createMockMembersMap(members);

      const result = await calculateBinaryBonus(member, membersMap, 'test-cycle');

      expect(result!.amount).toBe(1000); // Capped at Bronze limit
    });

    test('returns null for inactive members', async () => {
      const member = createMockMember({ active: false });
      const membersMap = createMockMembersMap([member]);

      const result = await calculateBinaryBonus(member, membersMap, 'test-cycle');

      expect(result).toBeNull();
    });

    test('returns null for non-distributors', async () => {
      const member = createMockMember({ accountType: 'Customer' });
      const membersMap = createMockMembersMap([member]);

      const result = await calculateBinaryBonus(member, membersMap, 'test-cycle');

      expect(result).toBeNull();
    });

    test('returns correct amount for zero-pv leg', async () => {
      const member = createMockMember({ pv: 50 });
      const members = [
          member,
          createMockMember({ id: 'child-1', pv: 100, children: { left: null, right: null } }),
      ];
      const membersMap = createMockMembersMap(members);
      member.children.right = null;
      
      const result = await calculateBinaryBonus(member, membersMap, 'test-cycle');

      expect(result).toBeTruthy();
      expect(result!.amount).toBe(0);
    });
  });
  
  describe('Matching Bonus Calculations', () => {
    const level1Sponsor = createMockMember({ id: 'sponsor-1', pv: 100 });
    const level2Sponsor = createMockMember({ id: 'sponsor-2', pv: 100, sponsorId: 'sponsor-1' });
    const level3Sponsor = createMockMember({ id: 'sponsor-3', pv: 100, sponsorId: 'sponsor-2' });
    const earningMember = createMockMember({ id: 'earner', pv: 100, sponsorId: 'sponsor-3' });

    test('calculates correct matching bonus for multiple levels', async () => {
      const membersMap = createMockMembersMap([level1Sponsor, level2Sponsor, level3Sponsor, earningMember]);
      const binaryCommissionAmount = 1000;

      const bonuses = await calculateMatchingBonus(earningMember, binaryCommissionAmount, membersMap, 'test-cycle');

      expect(bonuses.length).toBe(3);
      
      const bonusForLevel3 = bonuses.find(b => b.userId === 'sponsor-3');
      expect(bonusForLevel3).toBeTruthy();
      expect(bonusForLevel3!.amount).toBe(50); // Level 1: 1000 * 0.05
      
      const bonusForLevel2 = bonuses.find(b => b.userId === 'sponsor-2');
      expect(bonusForLevel2).toBeTruthy();
      expect(bonusForLevel2!.amount).toBe(25); // Level 2: 1000 * (0.05 / 2)
      
      const bonusForLevel1 = bonuses.find(b => b.userId === 'sponsor-1');
      expect(bonusForLevel1).toBeTruthy();
      expect(bonusForLevel1!.amount).toBeCloseTo(16.67); // Level 3: 1000 * (0.05 / 3)
    });

    test('does not award matching bonus to unqualified sponsor', async () => {
      const inactiveSponsor = createMockMember({ id: 'sponsor-inactive', pv: 10, active: false, sponsorId: 'sponsor-1' });
      const memberWithInactiveSponsor = createMockMember({ id: 'earner-2', pv: 100, sponsorId: 'sponsor-inactive' });
      
      const membersMap = createMockMembersMap([level1Sponsor, inactiveSponsor, memberWithInactiveSponsor]);
      const binaryCommissionAmount = 1000;
      
      const bonuses = await calculateMatchingBonus(memberWithInactiveSponsor, binaryCommissionAmount, membersMap, 'test-cycle');
      
      // Bonus should skip the inactive sponsor and go to the next qualified one (level1Sponsor)
      expect(bonuses.length).toBe(1);
      const bonusForLevel1 = bonuses.find(b => b.userId === 'sponsor-1');
      expect(bonusForLevel1).toBeTruthy();
      expect(bonusForLevel1!.amount).toBe(50); // Still counts as Level 1 for bonus calculation
    });
    
     test('stops bonus calculation after max levels', async () => {
      const level4Sponsor = createMockMember({ id: 'sponsor-4', pv: 100, sponsorId: 'sponsor-3' });
      const level5Sponsor = createMockMember({ id: 'sponsor-5', pv: 100, sponsorId: 'sponsor-4' });
      const level6Sponsor = createMockMember({ id: 'sponsor-6', pv: 100, sponsorId: 'sponsor-5' });
      const earningMemberL6 = createMockMember({ id: 'earner-l6', pv: 100, sponsorId: 'sponsor-6' });

      const membersMap = createMockMembersMap([
        level1Sponsor, level2Sponsor, level3Sponsor, level4Sponsor, level5Sponsor, level6Sponsor, earningMemberL6
      ]);

      const bonuses = await calculateMatchingBonus(earningMemberL6, 1000, membersMap, 'test-cycle');
      
      // Should only go up to level 5
      expect(bonuses.length).toBe(businessRules.matchingBonusLevels);
      expect(bonuses.find(b => b.userId === 'sponsor-1')).toBeUndefined();
    });
  });

  describe('Stockist Bonus Calculations', () => {
    test('calculates correct stockist bonus for District level', async () => {
      const member = createMockMember({
        pv: 1000,
        storeOwnerLevel: 'District'
      });

      const result = await calculateStockistBonus(member, 'test-cycle');

      expect(result).toBeTruthy();
      expect(result!.amount).toBe(20); // 1000 * 0.02 = 20
      expect(result!.type).toBe('District Stockist Bonus');
    });

    test('calculates correct stockist bonus for Provincial level', async () => {
      const member = createMockMember({
        pv: 1000,
        storeOwnerLevel: 'Provincial'
      });

      const result = await calculateStockistBonus(member, 'test-cycle');
      expect(result).toBeTruthy();
      expect(result!.amount).toBe(40); // 1000 * 0.04 = 40
    });

    test('returns null for members without stockist level', async () => {
      const member = createMockMember({ pv: 1000, storeOwnerLevel: null });

      const result = await calculateStockistBonus(member, 'test-cycle');

      expect(result).toBeNull();
    });

    test('returns null for zero PV', async () => {
      const member = createMockMember({
        pv: 0,
        storeOwnerLevel: 'District'
      });

      const result = await calculateStockistBonus(member, 'test-cycle');

      expect(result).toBeNull();
    });
  });

  describe('Rank Advancement Logic', () => {
    test('advances member to next rank when requirements met', async () => {
      const member = createMockMember({
        pv: 2500,
        rank: 'Bronze'
      });
      const members = [
        member,
        createMockMember({ id: 'child-1', pv: 5000, children: {left: null, right: null} }),
        createMockMember({ id: 'child-2', pv: 2500, children: {left: null, right: null} })
      ];
      const membersMap = createMockMembersMap(members);

      const result = await updateRank(member, 5, membersMap);

      expect(result).toBeTruthy();
      expect(result!.type).toBe('Rank Achievement: Silver');
      expect(result!.amount).toBe(250); // Silver bonus
    });

    test('returns null when requirements not met', async () => {
      const member = createMockMember({
        pv: 500,
        rank: 'Bronze'
      });
      const members = [member];
      const membersMap = createMockMembersMap(members);

      const result = await updateRank(member, 2, membersMap);

      expect(result).toBeNull();
    });

    test('advances to highest eligible rank', async () => {
      const member = createMockMember({
        pv: 10000,
        rank: 'Member'
      });
      const members = [
        member,
        createMockMember({ id: 'child-1', pv: 10000, children: { left: null, right: null } }),
        createMockMember({ id: 'child-2', pv: 5000, children: { left: null, right: null } })
      ];
      const membersMap = createMockMembersMap(members);

      const result = await updateRank(member, 15, membersMap);

      expect(result!.type).toBe('Rank Achievement: Gold');
      expect(result!.amount).toBe(500); // Gold bonus
    });
  });

  describe('Volume Calculations', () => {
    test('calculates leg volume correctly', async () => {
      const members = [
        createMockMember({ id: 'root', children: { left: 'left-child', right: null } }),
        createMockMember({ id: 'left-child', pv: 300, children: { left: 'grandchild', right: null } }),
        createMockMember({ id: 'grandchild', pv: 200, children: { left: null, right: null } }),
      ];
      const membersMap = createMockMembersMap(members);

      const volume = await getLegVolume('left-child', membersMap);

      expect(volume).toBe(500); // 300 + 200
    });

    test('returns 0 for null member ID', async () => {
      const membersMap = new Map<string, Member>();

      const volume = await getLegVolume(null, membersMap);

      expect(volume).toBe(0);
    });

    test('calculates group PV for downline', async () => {
      const members = [
        createMockMember({ id: 'root', children: { left: 'child1', right: 'child2' } }),
        createMockMember({ id: 'child1', pv: 300, children: { left: null, right: null } }),
        createMockMember({ id: 'child2', pv: 400, children: { left: null, right: null } }),
      ];
      const membersMap = createMockMembersMap(members);

      const groupPV = await calculateGroupPV('root', membersMap);

      expect(groupPV).toBe(700); // 300 + 400
    });
  });

  describe('Decimal Precision', () => {
    test('rounds commission amounts to 2 decimal places', async () => {
      // Mock a scenario that would result in fractional cents
      const member = createMockMember({ pv: 1000 });
      const members = [
        member,
        createMockMember({ id: 'child-1', pv: 333.33, children: { left: null, right: null } }),
        createMockMember({ id: 'child-2', pv: 334.44, children: { left: null, right: null } }),
      ];
      const membersMap = createMockMembersMap(members);

      const result = await calculateBinaryBonus(member, membersMap, 'test-cycle');

      expect(result!.amount).toBe(33.33); // 333.33 * 0.10 = 33.33
      expect(result!.amount.toString().split('.')[1]?.length || 0).toBe(2);
    });
  });

  describe('Business Rules Validation', () => {
    test('uses correct binary commission rate', () => {
      expect(businessRules.binaryCommissionRate).toBe(0.10);
    });

    test('uses correct minimum PV for commission', () => {
      expect(businessRules.minPVForCommission).toBe(50);
    });

    test('has valid rank requirements structure', () => {
      expect(businessRules.rankRequirements).toBeInstanceOf(Array);
      expect(businessRules.rankRequirements.length).toBeGreaterThan(0);

      const firstRequirement = businessRules.rankRequirements[0];
      expect(firstRequirement).toHaveProperty('rank');
      expect(firstRequirement).toHaveProperty('personalPV');
      expect(firstRequirement).toHaveProperty('groupPV');
      expect(firstRequirement).toHaveProperty('directRecruits');
      expect(firstRequirement).toHaveProperty('bonus');
    });

    test('has valid commission caps', () => {
      expect(businessRules.commissionCaps).toHaveProperty('Bronze');
      expect(businessRules.commissionCaps.Bronze).toBe(1000);
    });
  });

  describe('Edge Cases', () => {
    test('handles members with no children', async () => {
      const member = createMockMember({
        children: { left: null, right: null }
      });
      const membersMap = createMockMembersMap([member]);

      const result = await calculateBinaryBonus(member, membersMap, 'test-cycle');

      expect(result).toBeNull(); // No legs = no commission
    });

    test('handles members with only one leg', async () => {
      const member = createMockMember({
        children: { left: 'child-1', right: null }
      });
      const members = [
        member,
        createMockMember({ id: 'child-1', pv: 500, children: { left: null, right: null } }),
      ];
      const membersMap = createMockMembersMap(members);

      const result = await calculateBinaryBonus(member, membersMap, 'test-cycle');
      
      // Weaker leg is the one with 0 volume
      expect(result!.amount).toBe(0);
    });

    test('handles very large volume calculations', async () => {
      const member = createMockMember({ pv: 1000000, rank: 'Chairman' });
      const members = [
        member,
        createMockMember({ id: 'child-1', pv: 5000000, children: { left: null, right: null } }),
        createMockMember({ id: 'child-2', pv: 6000000, children: { left: null, right: null } }),
      ];
      const membersMap = createMockMembersMap(members);

      const result = await calculateBinaryBonus(member, membersMap, 'test-cycle');

      expect(result!.amount).toBe(50000); // Chairman cap
    });
  });
});
