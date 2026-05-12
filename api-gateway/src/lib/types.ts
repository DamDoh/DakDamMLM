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

export type StockistLevel = 'District' | 'Provincial' | 'Regional' | 'Commune';

export const stockistLevels: StockistLevel[] = ['District', 'Provincial', 'Regional', 'Commune'];

export type AccountType = 'Customer' | 'Distributor';

export const accountTypes = ['Customer', 'Distributor'] as const;

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

// Alias for backward compatibility
export type EcashTopUpRequest = EcommTopUpRequest;

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
