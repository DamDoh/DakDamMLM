// Rank type definition
export type Rank =
  | 'Member' | 'Bronze' | 'Silver' | 'Gold' | 'Diamond' | 'Manager' | 'Director' | 'President'
  | 'Double President';

export const rankRules = [
  { rank: "Member", min: 0 },
  // Updated thresholds per requirements:
  // Member: 0–<60, Bronze: 60–<100, Silver: 100–<500, Gold: 500–<1000, Diamond: 1000+
  // Diamond, Manager, Director, President, Double President all have same PV requirement (1000)
  // Higher ranks require 3-month commission earnings instead of higher PV
  { rank: "Bronze", min: 60 },
  { rank: "Silver", min: 100 },
  { rank: "Gold", min: 500 },
  { rank: "Diamond", min: 1000 },
  { rank: "Manager", min: 1000 },  // Same PV as Diamond, requires $3000 commission in 3 months
  { rank: "Director", min: 1000 },  // Same PV as Manager, requires $15000 commission in 3 months
  { rank: "President", min: 1000 },  // Same PV as Director, requires $30000 commission in 3 months
  { rank: "Double President", min: 1000 },  // Same PV as President, requires $150000 commission in 3 months
] as const;

export function calculateRank(amount: number): Rank {
  let currentRank: Rank = "Member";
  // Only calculate up to Diamond based on PV
  // Higher ranks (Manager, Director, President, Double President) require 3-month commission earnings
  // and should only be assigned through RankMaintenanceService
  const pvBasedRanks = rankRules.filter(r => 
    r.rank === "Member" || 
    r.rank === "Bronze" || 
    r.rank === "Silver" || 
    r.rank === "Gold" || 
    r.rank === "Diamond"
  );
  
  for (const rule of pvBasedRanks) {
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
  const currentRankIndex = rankRules.findIndex(r => r.rank === currentRank);
  const pvBasedRankIndex = rankRules.findIndex(r => r.rank === pvBasedRank);

  // If PV is 0, always set rank to Member
  if (newPV === 0 || newPV < 0) {
    return {
      shouldUpdate: true,
      currentRank,
      pvBasedRank: 'Member',
      newRank: 'Member',
      reason: `Rank set to Member because PV is ${newPV}.`
    };
  }

  if (pvBasedRankIndex > currentRankIndex) {
    return {
      shouldUpdate: true,
      currentRank,
      pvBasedRank,
      newRank: pvBasedRank,
      reason: `Promoted from ${currentRank} to ${pvBasedRank} based on PV: ${newPV}`
    };
  } else if (pvBasedRankIndex < currentRankIndex) {
    // If PV-based rank is lower than current, update to PV-based rank (auto-demote)
    return {
      shouldUpdate: true,
      currentRank,
      pvBasedRank,
      newRank: pvBasedRank,
      reason: `Rank updated from ${currentRank} to ${pvBasedRank} based on PV: ${newPV}.`
    };
  } else {
    return {
      shouldUpdate: false,
      currentRank,
      pvBasedRank,
      newRank: currentRank,
      reason: `PV (${newPV}) maintains current rank ${currentRank}.`
    };
  }
}

/**
 * Get the minimum PV required for a given rank
 * This is the reverse of calculateRank - given a rank, return the minimum PV needed
 */
export function getPVForRank(rank: Rank): number {
  const rule = rankRules.find(r => r.rank === rank);
  return rule ? rule.min : 0;
}

const pvBasedRanks = [
  { rank: 'Member' as Rank, min: 0 },
  { rank: 'Bronze' as Rank, min: 60 },
  { rank: 'Silver' as Rank, min: 100 },
  { rank: 'Gold' as Rank, min: 500 },
  { rank: 'Diamond' as Rank, min: 1000 },
];

export interface NextRankInfo {
  nextRank: Rank;
  pvNeeded: number;
  minPVForNext: number;
}

/**
 * Get PV needed to reach the next PV-based rank (Member → Bronze → Silver → Gold → Diamond).
 * Returns null if already at Diamond or higher (no further PV-based upgrade).
 */
export function getPVNeededForNextRank(
  currentRank: Rank,
  currentPV: number
): NextRankInfo | null {
  const idx = pvBasedRanks.findIndex((r) => r.rank === currentRank);
  if (idx < 0) {
    // Rank not in PV-based list (e.g. Manager); treat as Diamond for "next" purposes
    if (currentPV >= 1000) return null;
    const pvNeeded = Math.max(0, 1000 - currentPV);
    return { nextRank: 'Diamond', pvNeeded, minPVForNext: 1000 };
  }
  if (idx >= pvBasedRanks.length - 1) return null; // Already Diamond
  const next = pvBasedRanks[idx + 1]!;
  const pvNeeded = Math.max(0, next.min - currentPV);
  return { nextRank: next.rank, pvNeeded, minPVForNext: next.min };
}