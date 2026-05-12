export const businessRules = {
    /**
     * The percentage of the weaker leg's volume to be paid as commission.
     * Sustainable default: 8% (lower than typical 10-15% to ensure long-term viability)
     */
    binaryCommissionRate: 0.08,

    /**
     * The minimum Personal Volume (PV) a member must have to be eligible for any commission.
     * Sustainable default: 100 PV (higher threshold to ensure active participation)
     */
    minPVForCommission: 100,

    /**
     * The bonus rates for stockists based on their level.
     * Sustainable defaults: Lower rates to prevent over-concentration of earnings
     */
    stockistBonusRates: {
        'District': 0.015,   // 1.5% (reduced from 2%)
        'Provincial': 0.025, // 2.5% (reduced from 4%)
        'Regional': 0.035,   // 3.5% (reduced from 6%)
        'Commune': 0.008,    // 0.8% (reduced from 1%)
    },

    /**
     * The requirements for a member to advance to the next rank.
     * Sustainable defaults: Higher requirements to ensure quality over quantity
     */
    rankRequirements: [
        { rank: 'Bronze', personalPV: 60, groupPV: 4500, directRecruits: 3, bonus: 150 },
        { rank: 'Silver', personalPV: 100, groupPV: 10500, directRecruits: 6, bonus: 300 },
        { rank: 'Gold', personalPV: 500, groupPV: 21000, directRecruits: 12, bonus: 600 },
        { rank: 'Diamond', personalPV: 1000, groupPV: 15000, directRecruits: 8, bonus: 1200 },
        // Note: Manager, Director, President, Double President all have same PV (1000)
        // Higher ranks require 3-month commission earnings instead of higher PV
        { rank: 'Manager', personalPV: 1000, groupPV: 30000, directRecruits: 10, bonus: 1500 },
        { rank: 'Director', personalPV: 1000, groupPV: 50000, directRecruits: 12, bonus: 1800 },
        { rank: 'President', personalPV: 1000, groupPV: 60000, directRecruits: 15, bonus: 2100 },
        { rank: 'Double President', personalPV: 1000, groupPV: 100000, directRecruits: 25, bonus: 3000 },
    ],

    /**
     * The maximum binary commission a member can earn per cycle, based on their rank.
     * Sustainable defaults: Lower caps to prevent unsustainable payouts
     */
    commissionCaps: {
        Member: 300,
        Bronze: 600,
        Silver: 1500,
        Gold: 3000,
        Diamond: 6000,
        'Super Diamond': 8000,
        'Half STAR': 10000,
        STAR: 12000,
        Supervisor: 12000,
        Manager: 15000,
        Director: 18000,
        President: 21000,
        Chairman: 25000,
        'Blue Diamond': 8000,
        'Black Diamond': 10000,
        Emerald: 9000,
        'Blue Emerald': 11000,
        Elite: 12500,
        Crown: 20000,
        'Double Diamond': 8000,
        Expired: 0,
    },

    /**
     * The number of days a member can be inactive before tree compression.
     * Sustainable default: 120 days (longer period to allow recovery)
     */
    inactivityPeriodForCompression: 120,

    /**
     * The number of levels deep the matching bonus is paid.
     * Sustainable default: 3 levels (reduced from 5 to prevent excessive payouts)
     */
    matchingBonusLevels: 3,

    /**
     * The base rate for the matching bonus, which is then divided by the level.
     * Sustainable default: 3% (reduced from 5% for better sustainability)
     */
    matchingBonusBaseRate: 0.03,

    /**
     * Additional sustainable defaults for long-term business viability
     */

    /**
     * Maximum payout percentage of total company revenue per month.
     * Sustainable default: 35% (industry standard for healthy MLM companies)
     */
    maxPayoutPercentage: 0.35,

    /**
     * Minimum retention rate required for commission eligibility.
     * Sustainable default: 70% (ensures team stability)
     */
    minRetentionRate: 0.70,

    /**
     * Maximum depth for generation bonuses to prevent infinite payouts.
     * Sustainable default: 8 levels (balanced depth for growth without over-leveraging)
     */
    maxGenerationDepth: 8,

    /**
     * Required qualification period before earning commissions.
     * Sustainable default: 30 days (allows proper training and setup)
     */
    qualificationPeriodDays: 30,

    /**
     * Maximum commission frequency to prevent over-payment.
     * Sustainable default: weekly (balances timely payments with business stability)
     */
    maxCommissionFrequency: 'weekly',

    /**
     * Minimum team size required for leadership bonuses.
     * Sustainable default: 50 active members (ensures substantial contribution)
     */
    minTeamSizeForLeadership: 50,

    /**
     * Bonus pool distribution percentage for top performers.
     * Sustainable default: 5% of total commissions (rewards excellence without over-concentration)
     */
    leadershipPoolPercentage: 0.05,
};
