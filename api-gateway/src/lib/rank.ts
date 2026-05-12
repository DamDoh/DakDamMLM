// Rank type definition (api-gateway)
export type Rank =
  | 'Member'
  | 'Bronze'
  | 'Silver'
  | 'Gold'
  | 'Diamond'
  | 'Manager'
  | 'Director'
  | 'President'
  | 'Double President';

export const rankRules = [
  { rank: 'Member', min: 0 },
  { rank: 'Bronze', min: 50 },
  { rank: 'Silver', min: 100 },
  { rank: 'Gold', min: 500 },
  { rank: 'Diamond', min: 1000 },
  { rank: 'Manager', min: 1500 },
  { rank: 'Director', min: 2000 },
  { rank: 'President', min: 2500 },
  { rank: 'Double President', min: 3000 },
] as const;

export function calculateRank(amount: number): Rank {
  let currentRank: Rank = 'Member';
  for (const rule of rankRules) {
    if (amount >= rule.min) {
      currentRank = rule.rank as Rank;
    }
  }
  return currentRank;
}

export interface RankUpdateResult {
  shouldUpdate: boolean;
  currentRank: Rank;
  pvBasedRank: Rank;
  newRank: Rank;
  reason: string;
}

export function shouldUpdateRank(currentRank: Rank, newPV: number): RankUpdateResult {
  const pvBasedRank = calculateRank(newPV);
  const currentRankIndex = rankRules.findIndex((r) => r.rank === currentRank);
  const pvBasedRankIndex = rankRules.findIndex((r) => r.rank === pvBasedRank);

  // If PV is 0, always set rank to Member
  if (newPV === 0 || newPV < 0) {
    return {
      shouldUpdate: true,
      currentRank,
      pvBasedRank: 'Member',
      newRank: 'Member',
      reason: `Rank set to Member because PV is ${newPV}.`,
    };
  }

  if (pvBasedRankIndex > currentRankIndex) {
    return {
      shouldUpdate: true,
      currentRank,
      pvBasedRank,
      newRank: pvBasedRank,
      reason: `Promoted from ${currentRank} to ${pvBasedRank} based on PV: ${newPV}`,
    };
  } else if (pvBasedRankIndex < currentRankIndex) {
    // If PV-based rank is lower than current, update to PV-based rank (auto-demote)
    return {
      shouldUpdate: true,
      currentRank,
      pvBasedRank,
      newRank: pvBasedRank,
      reason: `Rank updated from ${currentRank} to ${pvBasedRank} based on PV: ${newPV}.`,
    };
  } else {
    return {
      shouldUpdate: false,
      currentRank,
      pvBasedRank,
      newRank: currentRank,
      reason: `PV (${newPV}) maintains current rank ${currentRank}.`,
    };
  }
}

