# DakDam MLM Business Rules & Logic Documentation

This document provides comprehensive documentation of the business rules, commission structures, genealogy logic, and operational workflows that govern the DakDam MLM platform.

## Table of Contents

1. [MLM Compensation Plan Overview](#mlm-compensation-plan-overview)
2. [Commission Calculation Engine](#commission-calculation-engine)
3. [Genealogy & Tree Management](#genealogy--tree-management)
4. [Rank Advancement System](#rank-advancement-system)
5. [Bonus Structures](#bonus-structures)
6. [Business Rules Engine](#business-rules-engine)
7. [Financial Controls & Compliance](#financial-controls--compliance)
8. [Operational Workflows](#operational-workflows)

---

## MLM Compensation Plan Overview

### Binary Tree Structure
DakDam implements a **Binary MLM Compensation Plan** where each distributor can sponsor two legs (left and right) in their genealogy tree.

#### Key Characteristics
- **Tree Depth**: Unlimited depth with compression for inactive members
- **Placement**: Forced matrix placement (left/right positioning)
- **Commission Basis**: Personal Volume (PV) and Group Volume (GV)
- **Payout Frequency**: Weekly or monthly cycles
- **Currency**: Dual currency system (Cash + E-cash)

#### Tree Visualization
```
                    John Doe (Diamond)
                   /          \
          Jane Smith (Gold)    Bob Johnson (Silver)
             /     \               /     \
    Alice (Bronze)  Charlie       David   Eve
       / \         (Member)     (Member) (Member)
     ...   ...       ...           ...     ...
```

### Compensation Components

1. **Binary Commissions**: 10% of weaker leg volume
2. **Matching Bonuses**: Up to 10 levels deep
3. **Leadership Bonuses**: Team performance rewards
4. **Rank Advancement Bonuses**: Achievement rewards
5. **Retail Profit**: Product markup commissions

---

## Commission Calculation Engine

### Binary Commission Calculation

#### Basic Formula
```
Binary Commission = MIN(Left Leg GV, Right Leg GV) × Commission Rate
```

#### Example Calculation
```
Distributor: John Doe
Left Leg GV: $5,000
Right Leg GV: $3,200
Commission Rate: 10%

Binary Commission = MIN(5,000, 3,200) × 0.10 = $320
```

#### Calculation Rules
1. **Weaker Leg Principle**: Commission based on smaller leg volume
2. **Carry Forward**: Excess volume carries to next period
3. **Flush System**: No volume accumulation between periods
4. **Active Legs Only**: Only active distributors count toward GV

### Commission Processing Workflow

#### 1. Order Processing
```typescript
// When order is placed
const commissionData = {
  orderId: "ORD-2024-001",
  memberId: "M001",
  productPv: 100,
  productPrice: 150.00
};

// Calculate and create commissions
await commissionService.calculateCommissions(orderData);
```

#### 2. Genealogy Traversal
```typescript
// Traverse up the genealogy tree
async function calculateBinaryCommission(memberId: string, pv: number) {
  const member = await getMember(memberId);
  if (!member.placementParentId) return; // Top of tree

  const parent = await getMember(member.placementParentId);
  const leg = member.position; // 'left' or 'right'

  // Update parent's leg volume
  await updateLegVolume(parent.id, leg, pv);

  // Check if commission is due
  await checkBinaryCommission(parent.id);

  // Continue up the tree
  await calculateBinaryCommission(parent.id, pv);
}
```

#### 3. Commission Payout
```typescript
// Process commission payouts
async function processCommissionPayout(commissionId: string) {
  const commission = await getCommission(commissionId);

  // Check payout limits and compliance
  const canPayout = await checkPayoutEligibility(commission);

  if (canPayout) {
    // Create wallet transaction
    await walletService.credit(commission.userId, commission.amount, {
      type: 'commission',
      referenceId: commission.id,
      description: `Commission payout - ${commission.type}`
    });

    // Update commission status
    await updateCommissionStatus(commission.id, 'PAID');
  }
}
```

### Commission Types & Rates

#### 1. Binary Commission
- **Rate**: 10% of weaker leg
- **Frequency**: Monthly
- **Qualification**: Active distributor status
- **Maximum**: No maximum (volume-based)

#### 2. Matching Bonus
- **Rate**: 5-10% based on rank and level
- **Levels**: Up to 10 levels deep
- **Qualification**: Higher rank than downline member
- **Maximum**: Capped at certain levels

#### 3. Leadership Bonus
- **Rate**: 1-5% of team volume
- **Qualification**: Rank-based thresholds
- **Frequency**: Monthly
- **Maximum**: Based on team size and rank

---

## Genealogy & Tree Management

### Tree Structure Rules

#### 1. Placement Rules
- **Forced Matrix**: New members placed in available positions
- **Spillover**: Members placed under next available sponsor
- **Position Assignment**: Alternating left/right placement
- **Depth Limits**: No limits, but compression for inactive members

#### 2. Member Status
```typescript
enum MemberStatus {
  ACTIVE = 'active',      // Active with recent purchase
  INACTIVE = 'inactive',  // No recent activity
  COMPRESSED = 'compressed' // Removed from active tree
}
```

#### 3. Tree Compression Logic
```typescript
async function compressInactiveMembers() {
  const inactiveMembers = await findInactiveMembers(90); // 90 days

  for (const member of inactiveMembers) {
    // Move children to grandparent
    await moveChildrenUp(member.id);

    // Mark as compressed
    await updateMemberStatus(member.id, 'compressed');

    // Log compression
    await logGenealogyMovement({
      memberId: member.id,
      action: 'compressed',
      reason: 'inactivity'
    });
  }
}
```

### Genealogy Operations

#### Member Placement Algorithm
```typescript
async function placeNewMember(sponsorId: string, newMemberData: any) {
  // Find next available position
  const placement = await findNextPlacementPosition(sponsorId);

  if (!placement) {
    // Spillover to next sponsor
    const nextSponsor = await findSpilloverSponsor(sponsorId);
    return placeNewMember(nextSponsor, newMemberData);
  }

  // Create member with placement
  const member = await createMember({
    ...newMemberData,
    sponsorId,
    placementParentId: placement.parentId,
    position: placement.position
  });

  // Update tree statistics
  await updateTreeStatistics(placement.parentId);

  return member;
}
```

#### Genealogy Movement (Authorized Changes)
```typescript
async function moveMember(memberId: string, newParentId: string, newPosition: string) {
  // Validate movement
  const validation = await validateMovement(memberId, newParentId, newPosition);

  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  // Check approval requirements
  if (validation.requiresApproval) {
    await createMovementRequest({
      memberId,
      newParentId,
      newPosition,
      status: 'pending_approval'
    });
    return;
  }

  // Execute movement
  await executeMovement(memberId, newParentId, newPosition);

  // Update affected trees
  await updateTreeStatistics(oldParentId);
  await updateTreeStatistics(newParentId);
}
```

### Tree Analytics

#### Volume Calculations
```typescript
async function calculateGroupVolume(memberId: string): Promise<VolumeStats> {
  const tree = await getGenealogyTree(memberId);
  let leftVolume = 0;
  let rightVolume = 0;
  let totalVolume = 0;

  function traverse(node: GenealogyNode, leg: 'left' | 'right') {
    if (node.status !== 'active') return;

    const volume = node.personalVolume + node.groupVolume;
    if (leg === 'left') leftVolume += volume;
    else rightVolume += volume;
    totalVolume += volume;

    // Traverse children
    if (node.children.left) traverse(node.children.left, 'left');
    if (node.children.right) traverse(node.children.right, 'right');
  }

  traverse(tree, 'left'); // Start with root as left for calculation

  return {
    left: leftVolume,
    right: rightVolume,
    total: totalVolume,
    weaker: Math.min(leftVolume, rightVolume)
  };
}
```

---

## Rank Advancement System

### Rank Structure

#### Rank Hierarchy
```typescript
enum Rank {
  MEMBER = 'Member',      // Entry level
  BRONZE = 'Bronze',      // 500 PV + 2 active legs
  SILVER = 'Silver',      // 1000 PV + 4 active legs
  GOLD = 'Gold',         // 2500 PV + 8 active legs
  PLATINUM = 'Platinum', // 5000 PV + 16 active legs
  DIAMOND = 'Diamond'    // 10000 PV + 32 active legs
}
```

#### Rank Requirements
```typescript
const RANK_REQUIREMENTS = {
  [Rank.BRONZE]: {
    personalVolume: 500,
    activeLegs: 2,
    groupVolume: 1000
  },
  [Rank.SILVER]: {
    personalVolume: 1000,
    activeLegs: 4,
    groupVolume: 3000
  },
  [Rank.GOLD]: {
    personalVolume: 2500,
    activeLegs: 8,
    groupVolume: 7500
  },
  [Rank.PLATINUM]: {
    personalVolume: 5000,
    activeLegs: 16,
    groupVolume: 20000
  },
  [Rank.DIAMOND]: {
    personalVolume: 10000,
    activeLegs: 32,
    groupVolume: 50000
  }
};
```

### Rank Advancement Logic

#### Automatic Rank Check
```typescript
async function checkRankAdvancement(memberId: string) {
  const member = await getMember(memberId);
  const currentRank = member.rank;

  // Get current statistics
  const stats = await calculateMemberStats(memberId);
  const requirements = RANK_REQUIREMENTS[currentRank];

  // Check if qualifies for next rank
  if (meetsRequirements(stats, requirements)) {
    const nextRank = getNextRank(currentRank);

    // Update member rank
    await updateMemberRank(memberId, nextRank);

    // Award rank advancement bonus
    await awardRankBonus(memberId, nextRank);

    // Log advancement
    await logRankAdvancement(memberId, currentRank, nextRank);

    // Notify member
    await sendRankAdvancementNotification(memberId, nextRank);
  }
}

function meetsRequirements(stats: MemberStats, requirements: RankRequirements): boolean {
  return stats.personalVolume >= requirements.personalVolume &&
         stats.activeLegs >= requirements.activeLegs &&
         stats.groupVolume >= requirements.groupVolume;
}
```

#### Rank Maintenance
```typescript
async function checkRankMaintenance() {
  const members = await getAllRankedMembers();

  for (const member of members) {
    const stats = await calculateMemberStats(member.id);

    // Check if still meets current rank requirements
    if (!meetsRequirements(stats, RANK_REQUIREMENTS[member.rank])) {
      // Demote to lower rank
      const newRank = findAppropriateRank(stats);
      await updateMemberRank(member.id, newRank);

      // Log demotion
      await logRankChange(member.id, member.rank, newRank, 'demotion');
    }
  }
}
```

---

## Bonus Structures

### 1. Matching Bonus System

#### Structure
- **Levels**: Up to 10 levels deep
- **Rate**: 5-10% based on rank difference
- **Qualification**: Sponsor must be higher rank than downline
- **Frequency**: Paid when downline earns commission

#### Calculation Example
```
Level 1 (Direct Sponsor): Diamond rank sponsors Gold rank = 10% matching
Level 2: Diamond sponsors Silver rank = 8% matching
Level 3: Diamond sponsors Bronze rank = 6% matching
...
Level 10: Diamond sponsors Member rank = 1% matching
```

```typescript
async function calculateMatchingBonus(downlineMemberId: string, commissionAmount: number) {
  const sponsors = await getSponsorsUpToLevel(downlineMemberId, 10);

  for (let level = 1; level <= sponsors.length; level++) {
    const sponsor = sponsors[level - 1];
    const downlineRank = await getMemberRank(downlineMemberId);
    const sponsorRank = await getMemberRank(sponsor.id);

    if (sponsorRank > downlineRank) {
      const matchingRate = calculateMatchingRate(sponsorRank, downlineRank, level);
      const bonusAmount = commissionAmount * matchingRate;

      await createBonus({
        userId: sponsor.id,
        type: 'matching_bonus',
        amount: bonusAmount,
        level: level,
        sourceMemberId: downlineMemberId,
        description: `Matching bonus from level ${level}`
      });
    }
  }
}
```

### 2. Leadership Bonus

#### Qualification Criteria
- **Rank**: Platinum or higher
- **Team Size**: Minimum 100 active members
- **Team Volume**: Minimum $50,000 monthly GV
- **Personal Volume**: Minimum 200 PV monthly

#### Bonus Calculation
```typescript
async function calculateLeadershipBonus(memberId: string) {
  const qualifies = await checkLeadershipQualification(memberId);

  if (!qualifies) return;

  const teamStats = await calculateTeamStatistics(memberId);
  const bonusAmount = calculateLeadershipBonusAmount(teamStats);

  await createBonus({
    userId: memberId,
    type: 'leadership_bonus',
    amount: bonusAmount,
    period: 'monthly',
    description: 'Leadership bonus for team performance'
  });
}
```

### 3. Rank Advancement Bonus

#### One-time Bonuses
```typescript
const RANK_ADVANCEMENT_BONUSES = {
  [Rank.BRONZE]: 100,
  [Rank.SILVER]: 250,
  [Rank.GOLD]: 500,
  [Rank.PLATINUM]: 1000,
  [Rank.DIAMOND]: 2500
};

async function awardRankBonus(memberId: string, newRank: Rank) {
  const bonusAmount = RANK_ADVANCEMENT_BONUSES[newRank];

  if (bonusAmount) {
    await createBonus({
      userId: memberId,
      type: 'rank_advancement_bonus',
      amount: bonusAmount,
      description: `Rank advancement bonus for reaching ${newRank}`
    });
  }
}
```

---

## Business Rules Engine

### Rule Structure

#### Rule Components
```typescript
interface BusinessRule {
  id: string;
  name: string;
  type: RuleType;
  category: RuleCategory;
  priority: number;
  isActive: boolean;
  conditions: RuleCondition[];
  calculation: RuleCalculation;
  applicableTo: MemberType[];
  frequency: Frequency;
  payoutTiming: PayoutTiming;
  companyId?: string;
}
```

#### Condition Types
```typescript
type RuleCondition = {
  type: 'rank' | 'pv' | 'gv' | 'direct_recruits' | 'total_recruits' | 'active_members' | 'qualified_legs';
  operator: 'equals' | 'greater_than' | 'less_than' | 'greater_equal' | 'less_equal' | 'between';
  value: any;
  field?: string;
};
```

#### Calculation Types
```typescript
type RuleCalculation = {
  type: 'percentage' | 'fixed_amount' | 'per_unit' | 'tiered_percentage' | 'tiered_fixed' | 'formula';
  percentage?: number;
  amount?: number;
  perUnit?: number;
  tiers?: Tier[];
  formula?: string;
};
```

### Rule Execution Engine

#### Priority-Based Execution
```typescript
async function executeBusinessRules(memberId: string, context: RuleContext): Promise<RuleResult[]> {
  // Get applicable rules
  const rules = await getApplicableRules(memberId, context);

  // Sort by priority (highest first)
  rules.sort((a, b) => b.priority - a.priority);

  const results: RuleResult[] = [];

  for (const rule of rules) {
    try {
      // Check conditions
      const conditionsMet = await evaluateConditions(rule.conditions, context);

      if (conditionsMet) {
        // Calculate result
        const result = await executeCalculation(rule.calculation, context);

        results.push({
          ruleId: rule.id,
          amount: result.amount,
          description: result.description,
          metadata: result.metadata
        });

        // Log execution
        await logRuleExecution(rule.id, memberId, result);
      }
    } catch (error) {
      await logRuleError(rule.id, memberId, error);
    }
  }

  return results;
}
```

#### Rule Conflict Resolution
```typescript
async function resolveRuleConflicts(results: RuleResult[]): Promise<RuleResult[]> {
  // Group by type
  const grouped = groupBy(results, 'type');

  // Apply conflict resolution rules
  for (const [type, typeResults] of Object.entries(grouped)) {
    const resolutionStrategy = getConflictResolutionStrategy(type);

    switch (resolutionStrategy) {
      case 'highest_priority':
        // Keep only highest priority result
        const highest = typeResults.reduce((max, curr) =>
          curr.priority > max.priority ? curr : max
        );
        filtered.push(highest);
        break;

      case 'sum':
        // Sum all results
        const total = typeResults.reduce((sum, curr) => sum + curr.amount, 0);
        filtered.push({
          ...typeResults[0],
          amount: total,
          description: `Combined ${type} results`
        });
        break;

      case 'average':
        // Average all results
        const avg = typeResults.reduce((sum, curr) => sum + curr.amount, 0) / typeResults.length;
        filtered.push({
          ...typeResults[0],
          amount: avg,
          description: `Average ${type} results`
        });
        break;
    }
  }

  return filtered;
}
```

### Dynamic Rule Management

#### Rule Creation & Validation
```typescript
async function createBusinessRule(ruleData: BusinessRuleInput): Promise<BusinessRule> {
  // Validate rule structure
  const validation = await validateRuleStructure(ruleData);
  if (!validation.valid) {
    throw new Error(`Invalid rule: ${validation.errors.join(', ')}`);
  }

  // Check for conflicts
  const conflicts = await detectRuleConflicts(ruleData);
  if (conflicts.length > 0) {
    // Log warnings but allow creation
    await logRuleConflicts(ruleData, conflicts);
  }

  // Create rule
  const rule = await prisma.businessRule.create({
    data: {
      ...ruleData,
      version: 1,
      createdBy: context.userId
    }
  });

  // Create version history
  await createRuleVersion(rule.id, ruleData, 'created');

  return rule;
}
```

#### Rule Simulation
```typescript
async function simulateRuleExecution(rule: BusinessRule, testData: SimulationData): Promise<SimulationResult> {
  try {
    // Create isolated execution context
    const context = createSimulationContext(testData);

    // Execute rule
    const result = await executeRule(rule, context);

    // Calculate impact
    const impact = await calculateRuleImpact(rule, result, testData);

    return {
      success: true,
      result: result,
      impact: impact,
      warnings: [],
      executionTime: Date.now() - startTime
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      warnings: [],
      executionTime: Date.now() - startTime
    };
  }
}
```

---

## Financial Controls & Compliance

### Transaction Limits

#### Daily/Monthly Limits
```typescript
const TRANSACTION_LIMITS = {
  [MemberRank.MEMBER]: {
    daily: 1000,
    monthly: 5000
  },
  [MemberRank.BRONZE]: {
    daily: 2500,
    monthly: 15000
  },
  [MemberRank.SILVER]: {
    daily: 5000,
    monthly: 30000
  },
  [MemberRank.GOLD]: {
    daily: 10000,
    monthly: 50000
  },
  [MemberRank.PLATINUM]: {
    daily: 25000,
    monthly: 100000
  },
  [MemberRank.DIAMOND]: {
    daily: 50000,
    monthly: 250000
  }
};
```

#### Large Transaction Approval
```typescript
async function checkLargeTransactionApproval(amount: number, memberId: string): Promise<boolean> {
  const member = await getMember(memberId);
  const limits = TRANSACTION_LIMITS[member.rank];

  // Check if requires approval
  if (amount > limits.daily * 0.8) { // 80% of daily limit
    // Create approval request
    await createApprovalRequest({
      type: 'large_transaction',
      memberId,
      amount,
      status: 'pending'
    });

    return false; // Requires approval
  }

  return true; // Approved
}
```

### Escrow System

#### Large Transfer Processing
```typescript
async function processLargeTransfer(transferData: TransferData) {
  const THRESHOLD = 1000; // Amount requiring escrow

  if (transferData.amount >= THRESHOLD) {
    // Create escrow transaction
    const escrow = await createEscrowTransaction({
      ...transferData,
      status: 'escrow',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    });

    // Notify administrators
    await notifyLargeTransfer(escrow);

    // Wait for approval
    return { status: 'pending_approval', escrowId: escrow.id };
  }

  // Process immediately
  return await processImmediateTransfer(transferData);
}
```

### Compliance Reporting

#### Regulatory Reporting
```typescript
async function generateComplianceReport(period: string, companyId: string) {
  const transactions = await getTransactionsForPeriod(period, companyId);

  const report = {
    period,
    companyId,
    summary: {
      totalTransactions: transactions.length,
      totalVolume: transactions.reduce((sum, t) => sum + t.amount, 0),
      suspiciousTransactions: transactions.filter(t => t.riskScore > 70).length
    },
    transactions: transactions.map(t => ({
      id: t.id,
      memberId: t.memberId,
      amount: t.amount,
      type: t.type,
      riskScore: t.riskScore,
      timestamp: t.createdAt
    })),
    alerts: await getComplianceAlerts(period, companyId)
  };

  // Store report
  await storeComplianceReport(report);

  // Send to regulatory body if required
  if (requiresRegulatoryFiling(companyId)) {
    await fileRegulatoryReport(report);
  }

  return report;
}
```

---

## Operational Workflows

### Commission Cycle Processing

#### Monthly Commission Run
```typescript
async function runMonthlyCommissionCycle(companyId: string, period: string) {
  console.log(`Starting commission cycle for ${companyId} - ${period}`);

  try {
    // 1. Calculate all commissions
    await calculateAllCommissions(companyId, period);

    // 2. Process bonuses
    await calculateAllBonuses(companyId, period);

    // 3. Apply business rules
    await executeBusinessRules(companyId, period);

    // 4. Generate payout reports
    await generatePayoutReports(companyId, period);

    // 5. Send notifications
    await sendCommissionNotifications(companyId, period);

    // 6. Update member ranks
    await processRankAdvancements(companyId, period);

    console.log(`Commission cycle completed for ${companyId} - ${period}`);

  } catch (error) {
    console.error(`Commission cycle failed for ${companyId} - ${period}`, error);
    await handleCommissionCycleError(companyId, period, error);
  }
}
```

### Member Onboarding Workflow

#### Complete Registration Process
```typescript
async function completeMemberOnboarding(memberData: MemberData) {
  // 1. Validate sponsor
  const sponsor = await validateSponsor(memberData.sponsorId);
  if (!sponsor) {
    throw new Error('Invalid sponsor ID');
  }

  // 2. Place in genealogy tree
  const placement = await placeNewMember(memberData.sponsorId, memberData);

  // 3. Create member account
  const member = await createMember({
    ...memberData,
    placementParentId: placement.parentId,
    position: placement.position
  });

  // 4. Send welcome package
  await sendWelcomePackage(member.id);

  // 5. Set up initial rank
  await initializeMemberRank(member.id);

  // 6. Create wallet
  await createMemberWallet(member.id);

  // 7. Send onboarding notifications
  await sendOnboardingNotifications(member.id);

  return member;
}
```

### Quality Assurance Workflows

#### Commission Audit Process
```typescript
async function auditCommissionCalculations(companyId: string, period: string) {
  const commissions = await getCommissionsForPeriod(companyId, period);

  for (const commission of commissions) {
    // Recalculate commission
    const recalculated = await recalculateCommission(commission.id);

    // Compare with stored amount
    if (Math.abs(commission.amount - recalculated.amount) > 0.01) {
      // Discrepancy found
      await logCommissionDiscrepancy({
        commissionId: commission.id,
        storedAmount: commission.amount,
        calculatedAmount: recalculated.amount,
        difference: commission.amount - recalculated.amount
      });

      // Create dispute if significant
      if (Math.abs(commission.amount - recalculated.amount) > 1.00) {
        await createCommissionDispute(commission.id, 'calculation_error');
      }
    }
  }
}
```

### System Maintenance Workflows

#### Tree Compression Maintenance
```typescript
async function performMonthlyMaintenance() {
  console.log('Starting monthly maintenance');

  // 1. Compress inactive members
  await compressInactiveMembers();

  // 2. Update tree statistics
  await recalculateAllTreeStatistics();

  // 3. Process rank maintenance
  await checkRankMaintenance();

  // 4. Clean up old data
  await cleanupOldData();

  // 5. Update search indexes
  await rebuildSearchIndexes();

  // 6. Generate reports
  await generateSystemReports();

  console.log('Monthly maintenance completed');
}
```

This comprehensive business rules and logic documentation provides the foundation for understanding how the DakDam MLM platform operates. The system is designed to be flexible, compliant, and scalable while maintaining the integrity of MLM compensation structures.