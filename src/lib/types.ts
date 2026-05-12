// ... existing code ...

export type Rank =
  | 'Member' | 'Bronze' | 'Silver' | 'Gold' | 'Diamond' | 'Blue Diamond'
  | 'STAR' | 'Elite' | 'Supervisor' | 'Manager' | 'Director' | 'President'
  | 'Chairman' | 'Black Diamond' | 'Emerald' | 'Blue Emerald' | 'Super Diamond'
  | 'Half STAR' | 'Crown' | 'Double Diamond' | 'Expired';

export const ranks: Rank[] = [
  'Member', 'Bronze', 'Silver', 'Gold', 'Diamond', 'Super Diamond', 'Half STAR',
  'STAR', 'Supervisor', 'Manager', 'Director', 'President', 'Chairman', 'Blue Diamond',
  'Black Diamond', 'Emerald', 'Blue Emerald', 'Elite', 'Crown', 'Double Diamond', 'Expired'
];

export type StockistLevel = 'S' | 'M' | 'C' | 'D';

export const stockistLevels: StockistLevel[] = ['S', 'M', 'C', 'D'];

// Mapping for display names
export const stockistLevelNames: Record<StockistLevel, string> = {
  'S': 'Small Mobile',
  'M': 'Mobile',
  'C': 'Center',
  'D': 'Dealer'
};

// Stockist level monetary thresholds
export const stockistLevelAmounts: Record<StockistLevel, number> = {
  'S': 3045,
  'M': 14910,
  'C': 29820,
  'D': 149835
};

// Stockist level commission percentages (base rate when selling to regular users)
export const stockistLevelCommissions: Record<StockistLevel, number> = {
  'S': 0.8,
  'M': 1.7,
  'C': 2.6,
  'D': 3.0
};

/**
 * Differential commission rates when selling to specific stockist levels
 * Format: [sellerLevel][recipientLevel] = commission rate for seller
 * 
 * Rules: When a stockist transfers stock TO a lower-level stockist, they earn a differential rate:
 * - M transferring TO S: 0.9% (not 1.7%)
 * - C transferring TO M: 0.9% (not 2.6%)
 * - C transferring TO S: 1.8% (not 2.6%)
 * - D transferring TO C: 0.4% (not 3.0%)
 * - D transferring TO M: 1.3% (not 3.0%)
 * - D transferring TO S: 2.2% (not 3.0%)
 */
export const stockistDifferentialCommissions: Record<StockistLevel, Partial<Record<StockistLevel, number>>> = {
  'S': {}, // S can only sell to regular users (0.8%), not to other stockists
  'M': {
    'S': 0.9  // M transferring TO S gets 0.9% instead of 1.7%
  },
  'C': {
    'M': 0.9,  // C transferring TO M gets 0.9% instead of 2.6%
    'S': 1.8   // C transferring TO S gets 1.8% instead of 2.6%
  },
  'D': {
    'C': 0.4,  // D transferring TO C gets 0.4% instead of 3.0%
    'M': 1.3,  // D transferring TO M gets 1.3% instead of 3.0%
    'S': 2.2   // D transferring TO S gets 2.2% instead of 3.0%
  }
};

/**
 * Get the commission rate for a stockist based on seller and recipient levels
 * Follows Photo 2 rules: No commission when selling to same or higher levels
 * @param sellerLevel - The stockist level of the seller
 * @param recipientLevel - The stockist level of the recipient (null/undefined for regular users)
 * @returns The commission percentage to use (0 if no commission should be earned)
 */
export function getStockistCommissionRate(
  sellerLevel: StockistLevel,
  recipientLevel: StockistLevel | null | undefined
): number {
  // If recipient has no stockist level (regular user), use base commission
  if (!recipientLevel) {
    return stockistLevelCommissions[sellerLevel];
  }

  // Check hierarchy: if recipient is same or higher level, NO COMMISSION (Photo 2 rules)
  const sellerHierarchy = stockistLevelHierarchy[sellerLevel];
  const recipientHierarchy = stockistLevelHierarchy[recipientLevel];
  
  if (recipientHierarchy >= sellerHierarchy) {
    // Same or higher level = NO COMMISSION (Photo 2: "can't get any commission")
    return 0;
  }

  // Check if there's a differential rate for this seller-recipient combination
  const differentialRates = stockistDifferentialCommissions[sellerLevel];
  if (differentialRates && recipientLevel in differentialRates) {
    return differentialRates[recipientLevel]!;
  }

  // If no differential rate exists and recipient is lower level, use base commission
  // This handles cases where differential rate isn't defined but transfer is allowed
  return stockistLevelCommissions[sellerLevel];
}

// Stockist level PV thresholds
export const stockistLevelPV: Record<StockistLevel, number> = {
  'S': 2900,
  'M': 14300,
  'C': 28400,
  'D': 142700
};

// Stockist level hierarchy (for transfer restrictions)
// Higher number = higher level (can transfer to lower levels)
export const stockistLevelHierarchy: Record<StockistLevel, number> = {
  'S': 1,  // Lowest level
  'M': 2,
  'C': 3,
  'D': 4   // Highest level
};

/**
 * Check if a stockist can transfer to another stockist based on their levels
 * Higher level stockists can transfer to lower level stockists
 * Same level stockists cannot transfer to each other
 * Lower level stockists cannot transfer to higher level stockists
 * 
 * @param senderLevel - The stockist level of the sender (S, M, C, D, or null/undefined)
 * @param recipientLevel - The stockist level of the recipient (S, M, C, D, or null/undefined)
 * @returns true if transfer is allowed, false otherwise
 */
export function canTransferStock(senderLevel: StockistLevel | null | undefined, recipientLevel: StockistLevel | null | undefined): boolean {
  // If sender has no stockist level, they can transfer (regular user or admin)
  if (!senderLevel) {
    return true;
  }

  // If recipient has no stockist level, allow transfer (to regular user)
  if (!recipientLevel) {
    return true;
  }

  // Both have levels - check hierarchy
  // Higher level can transfer to lower level
  const senderHierarchy = stockistLevelHierarchy[senderLevel];
  const recipientHierarchy = stockistLevelHierarchy[recipientLevel];

  // Sender must have higher level than recipient
  return senderHierarchy > recipientHierarchy;
}

export type AccountType = 'Customer' | 'Distributor' | 'Stockist';

export const accountTypes = ['Customer', 'Distributor', 'Stockist'] as const;

// New type for user addresses
export interface Address {
    id: string;
    label: string;
    address: string;
    city: string;
    postalCode: string;
    isDefault: boolean;
}

export interface Company {
  id: string;
  name: string;
  domain?: string; // For custom domains
  description?: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  website?: string;
  email?: string;
  phone?: string;
  address?: Address;
  taxId?: string;
  licenseNumber?: string;
  industry?: string;
  country?: string;
  currency: string;
  timezone: string;
  isActive: boolean;
  isVerified: boolean;

  // Authentication preferences
  allowEmailLogin: boolean;
  allowPhoneLogin: boolean;
  requireEmailVerification: boolean;
  requirePhoneVerification: boolean;

  // Branding
  customCss?: string;
  loginPageConfig?: {
    title?: string;
    subtitle?: string;
    backgroundImageUrl?: string;
    showLanguageSelector: boolean;
  };

  createdAt: string;
  updatedAt: string;
}

export interface Member {
  id: string; // Firebase Auth UID
  memberId: string; // User-facing sequential ID, e.g., M000001
  firstName: string;
  surname: string;
  fullName: string;
  email: string | null;
  avatarUrl: string;
  rank: Rank;
  storeOwnerLevel: StockistLevel | null;
  accountType: AccountType;
  pv: number;
  pvDate?: string; // Date of the last PV update
  /** When true, rank was set by admin only; E-comm shows rank but not PV until Top-Up */
  rankOnlyNoPv?: boolean;
  teamSize: {
    left: number;
    right: number;
    total: number;
  };
  joinDate: string;
  sponsorId: string | null;
  placementParentId: string | null;
  position: 'left' | 'right' | null;
  children: {
    left: string | null;
    right: string | null;
  };
  active: boolean;
  phoneNumber: string;
  idCardUrl?: string;
  compressed?: boolean;
  compressedDate?: string;
  lastActivityDate?: string;
  totalEarnings?: number;
  qualificationDate?: string;
  isAdmin?: boolean;
  location?: string; // For stockist management
  addresses: Address[];

  // Multi-tenancy
  companyId?: string;
  company?: Company;

  deleted?: boolean; // Soft delete flag
  deletedDate?: string; // When member was soft deleted
  deletedBy?: string; // Admin who performed the deletion
}

export interface TreeNode extends Member {
  left: TreeNode | null;
  right: TreeNode | null;
}

export interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
  pv?: number;
}

export type Order = {
  orderId: string;
  userId: string;
  date: string;
  status: 'Fulfilled' | 'Pending' | 'Declined';
  itemCount: number;
  amount: number;
  items?: OrderItem[];
};

export type Commission = {
  id: string;
  userId: string;
  memberId?: string | null;
  date: string;
  type: string; // More generic to support transfers like 'Transfer to M002'
  status: 'Paid' | 'Pending' | 'Failed';
  amount: number;
};

export interface PackageItem {
  productId: string;
  productName: string;
  quantity: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  pv: number;
  qty: number;
  category: string;
  imageUrl: string;
  isActive: boolean;
  unitType: string;
  type: 'single' | 'package';
  originalPrice?: number;
  packageItems?: PackageItem[];
  rating?: number; // Added for sorting

  // Multi-tenancy
  companyId?: string;
  company?: Company;
  isGlobalProduct?: boolean; // System-wide products available to all companies
}

export interface StockItem {
  productId: string;
  productName: string;
  quantity: number;
  lastUpdated: string;
}

export interface FinancialControl {
  id: string;
  type: 'escrow' | 'reserve' | 'commission_hold' | 'topup_request';
  amount: number;
  memberId: string;
  reason: string;
  status: 'pending' | 'released' | 'cancelled' | 'approved' | 'rejected';
  createdDate: string;
  releaseDate?: string;
  releasedBy?: string;
}

export interface MaintenanceTopupRequest {
  id: string;
  memberId: string;
  memberName: string;
  amount: number;
  remark: string;
  status: string;
  month: string; // YYYY-MM format
  createdDate: string;
  processedDate?: string;
  processedBy?: string;
  proofUrl: string;
  member?: {
    id: string;
    firstName?: string;
    surname?: string;
    memberId?: string;
    email?: string;
  };
}

export interface EcommTopUpRequest {
  id: string;
  memberId: string;
  memberName: string;
  amount: number;
  remark: string;
  status: 'pending' | 'approved' | 'rejected';
  createdDate: string;
  proofUrl: string;
  processedDate?: string;
  processedBy?: string; // Admin User ID
}

export interface StockRequest {
    id: string;
    stockistId: string;
    stockistName: string;
    stockistLevel: StockistLevel;
    requests: StockRequestItem[];
    status: 'pending' | 'approved' | 'rejected';
    createdDate: string;
    processedDate?: string;
    processedBy?: string;
}

export interface StockRequestItem {
  productId: string;
  productName: string;
  requestedQuantity: number;
}

export interface ComplianceDocument {
  id: string;
  type: 'terms' | 'policy' | 'disclaimer' | 'procedure';
  title: string;
  content: string;
  version: string;
  effectiveDate: string;
  isActive: boolean;
  requiresAcceptance: boolean;
}

export interface MemberAgreement {
  id: string;
  memberId: string;
  documentId: string;
  documentVersion: string;
  acceptedDate: string;
  ipAddress: string;
  userAgent: string;
}

export interface OnboardingStep {
    id: string;
    title: string;
    description: string;
    type: 'video' | 'document' | 'quiz' | 'action';
    isRequired: boolean;
    estimatedMinutes: number;
    order: number;
};
export interface OnboardingTemplate {
    id: string;
    name: string;
    description: string;
    targetAudience: 'new_member' | 'new_distributor';
    version: string;
    isActive: boolean;
    steps: OnboardingStep[];
};

export interface MemberProgress {
    memberId: string;
    currentStep: number;
    completedSteps: string[];
    startedDate: string;
    lastActivity: string;
    isCompleted: boolean;
    totalTimeSpent: number; // in minutes
    quizScores: Record<string, number>;
    notes: string[];
};

// --- Configurable Business Rules Types ---

export type RuleType =
  | 'commission_rate'
  | 'commission_cap'
  | 'rank_requirement'
  | 'stockist_bonus'
  | 'matching_bonus'
  | 'referral_bonus'
  | 'leadership_bonus'
  | 'pool_bonus'
  | 'fast_start_bonus'
  | 'retail_profit'
  | 'override_bonus'
  | 'generation_bonus'
  | 'breakaway_bonus'
  | 'infinity_bonus'
  | 'unilevel_bonus'
  | 'matrix_bonus'
  | 'binary_bonus'
  | 'stair_step_bonus'
  | 'rank_achievement_bonus'
  | 'loyalty_bonus'
  | 'performance_bonus'
  | 'team_building_bonus'
  | 'mentorship_bonus'
  | 'qualification_bonus'
  | 'maintenance_bonus'
  | 'activity_bonus'
  | 'productivity_bonus'
  | 'volume_bonus'
  | 'growth_bonus'
  | 'retention_bonus'
  | 'recruitment_bonus'
  | 'placement_bonus'
  | 'sponsorship_bonus'
  | 'upline_bonus'
  | 'downline_bonus'
  | 'pairing_bonus'
  | 'cycling_bonus'
  | 'spillover_bonus'
  | 'compression_bonus'
  | 'travel_bonus'
  | 'car_bonus'
  | 'house_bonus'
  | 'vacation_bonus'
  | 'club_bonus'
  | 'elite_bonus'
  | 'royalty_bonus'
  | 'residual_bonus'
  | 'passive_bonus'
  | 'automated_bonus'
  | 'custom_bonus';

export type RuleConditionType =
  | 'rank'
  | 'pv'
  | 'gv'
  | 'personal_volume'
  | 'group_volume'
  | 'direct_recruits'
  | 'total_recruits'
  | 'active_members'
  | 'qualified_legs'
  | 'paid_as_rank'
  | 'time_in_rank'
  | 'consecutive_months'
  | 'product_purchases'
  | 'training_completion'
  | 'compliance_status'
  | 'geographic_location'
  | 'account_type'
  | 'stockist_level'
  | 'tenure'
  | 'performance_level'
  | 'team_size'
  | 'generation_depth'
  | 'upline_rank'
  | 'downline_rank'
  | 'sponsor_rank'
  | 'placement_rank'
  | 'binary_balance'
  | 'matrix_position'
  | 'unilevel_level'
  | 'custom_condition';

export type RuleCalculationType =
  | 'percentage'
  | 'fixed_amount'
  | 'per_unit'
  | 'tiered_percentage'
  | 'tiered_fixed'
  | 'formula'
  | 'lookup_table'
  | 'conditional'
  | 'capped_percentage'
  | 'minimum_guarantee'
  | 'maximum_cap'
  | 'progressive'
  | 'regressive'
  | 'custom_calculation';

export interface RuleCondition {
  type: RuleConditionType;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'greater_equal' | 'less_equal' | 'in' | 'not_in' | 'between' | 'contains' | 'starts_with' | 'ends_with';
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

export interface RuleCalculation {
  type: RuleCalculationType;
  baseValue?: number;
  percentage?: number;
  tiers?: Array<{
    min: number;
    max?: number;
    value: number;
    type: 'percentage' | 'fixed';
  }>;
  formula?: string;
  lookupTable?: Record<string, number>;
  conditions?: RuleCondition[];
  cap?: number;
  minimum?: number;
  maximum?: number;
  customFunction?: string; // For custom calculation functions
}

export interface BusinessRule {
  id: string;
  name: string;
  description: string;
  type: RuleType;
  category: 'commission' | 'bonus' | 'qualification' | 'maintenance' | 'incentive' | 'penalty';
  priority: number;
  isActive: boolean;
  conditions: RuleCondition[];
  calculation: RuleCalculation;
  applicableTo: ('distributor' | 'stockist' | 'customer')[];
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'annually' | 'one_time' | 'continuous';
  payoutTiming: 'immediate' | 'end_of_period' | 'achievement_date' | 'qualification_date';
  companyId?: string;
  company?: Company;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  version: number;
  tags: string[];
  metadata?: Record<string, any>;
}

export interface RuleTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  rules: Omit<BusinessRule, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'version'>[];
  isDefault: boolean;
  applicableMarkets: string[];
  companyId?: string;
  company?: Company;
  isSystemTemplate?: boolean; // System-wide templates vs company-specific
  createdAt: string;
  updatedAt: string;
}

export interface RuleSet {
  id: string;
  name: string;
  description: string;
  rules: BusinessRule[];
  isActive: boolean;
  effectiveDate: string;
  expiryDate?: string;
  companyId?: string;
  company?: Company;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  version: number;
  tags: string[];
}

export interface RuleValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface RuleConflict {
  type: 'calculation_conflict' | 'condition_conflict' | 'frequency_mismatch' | 'mutually_exclusive_conditions' | 'redundant_conditions' | 'duplicate_priorities' | 'priority_gap' | 'overlapping_conditions';
  severity: 'high' | 'medium' | 'low';
  rules: string[];
  description: string;
  suggestion: string;
}

export interface ConflictSummary {
  total: number;
  bySeverity: {
    high: number;
    medium: number;
    low: number;
  };
  byType: Record<string, number>;
}

export interface RuleExecutionContext {
  memberId: string;
  period: {
    start: string;
    end: string;
  };
  volumes: {
    personal: number;
    group: number;
    left: number;
    right: number;
  };
  ranks: {
    current: Rank;
    paidAs: Rank;
    qualifiedFor: Rank[];
  };
  team: {
    directRecruits: number;
    totalDownline: number;
    activeMembers: number;
    qualifiedLegs: number;
  };
  genealogy: {
    generation: number;
    upline: string[];
    downline: string[];
    sponsor: string;
    placement: string;
  };
  products: {
    purchased: Array<{
      productId: string;
      quantity: number;
      amount: number;
      pv: number;
    }>;
  };
  previousPeriods: Array<{
    period: string;
    commissions: number;
    volumes: {
      personal: number;
      group: number;
    };
  }>;
  customData?: Record<string, any>;
}

export interface RuleExecutionResult {
  ruleId: string;
  amount: number;
  breakdown: Array<{
    component: string;
    amount: number;
    description: string;
  }>;
  metadata: Record<string, any>;
}

// ... existing code ...
