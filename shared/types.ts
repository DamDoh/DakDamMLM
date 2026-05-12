// Shared types for all microservices
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

// Core user/member types
export interface Address {
  id: string;
  label: string;
  address: string;
  city: string;
  postalCode: string;
  isDefault: boolean;
}

export interface Member {
  id: string;
  memberId: string;
  firstName: string;
  surname: string;
  fullName: string;
  email: string | null;
  avatarUrl: string;
  rank: Rank;
  storeOwnerLevel: StockistLevel | null;
  accountType: AccountType;
  pv: number;
  pvDate?: string;
  teamSize: {
    left: number;
    right: number;
    total: number;
  } | null;
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
  location?: string;
  addresses: Address[];
  deleted?: boolean;
  deletedDate?: string;
  deletedBy?: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
  requestId: string;
  processingTime: number;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Error types
export interface ServiceError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
  service: string;
  requestId: string;
}

// Event types for event-driven architecture
export interface DomainEvent {
  id: string;
  type: string;
  aggregateId: string;
  aggregateType: string;
  eventData: Record<string, any>;
  metadata: {
    timestamp: string;
    userId?: string;
    correlationId: string;
    causationId?: string;
    version: number;
  };
}

// Commission types
export interface Commission {
  id: string;
  userId: string;
  orderId: string;
  type: 'DIRECT' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4' | 'LEVEL_5' | 'UNILEVEL' | 'BINARY' | 'MATRIX' | 'GENERATIONAL' | 'PERFORMANCE' | 'LOYALTY' | 'LEADERSHIP' | 'TRAVEL' | 'CAR' | 'HOUSE';
  level: number;
  amount: number;
  percentage: number;
  status: 'PENDING' | 'APPROVED' | 'PAID' | 'CANCELLED' | 'HELD' | 'LOCKED';
  paidAt?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CommissionPayout {
  id: string;
  userId: string;
  amount: number;
  method: 'BANK_TRANSFER' | 'PAYPAL' | 'CHECK' | 'WIRE_TRANSFER' | 'CRYPTO' | 'GIFT_CARD';
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
  reference?: string;
  fees: number;
  netAmount: number;
  processedAt?: string;
  paidAt?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CommissionBonus {
  id: string;
  userId: string;
  type: 'FAST_START' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'RANK_ADVANCEMENT' | 'RECRUITMENT' | 'TEAM_BUILDING' | 'BREAKAWAY';
  amount: number;
  description?: string;
  period: string;
  achievedAt?: string;
  paidAt?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CommissionRule {
  id: string;
  name: string;
  type: 'DIRECT' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4' | 'LEVEL_5' | 'UNILEVEL' | 'BINARY' | 'MATRIX' | 'GENERATIONAL' | 'PERFORMANCE' | 'LOYALTY' | 'LEADERSHIP' | 'TRAVEL' | 'CAR' | 'HOUSE';
  level: number;
  percentage: number;
  minAmount: number;
  maxAmount: number;
  isActive: boolean;
  conditions?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

// Order types
export interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
  pv?: number;
}

export interface Order {
  orderId: string;
  userId: string;
  date: string;
  status: 'Fulfilled' | 'Pending' | 'Declined';
  itemCount: number;
  amount: number;
  items?: OrderItem[];
}

// Product types
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
  rating?: number;
}

export interface PackageItem {
  productId: string;
  productName: string;
  quantity: number;
}

// Notification types
export interface Notification {
  id: string;
  memberId: string;
  type: 'email' | 'push' | 'sms' | 'in_app';
  category: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  isRead: boolean;
  isSent: boolean;
  sentDate?: string;
  readDate?: string;
  createdDate: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

// Analytics types
export interface AnalyticsMetric {
  id: string;
  name: string;
  value: number;
  previousValue?: number;
  change?: number;
  changePercent?: number;
  trend: 'up' | 'down' | 'stable';
  period: string;
  category: 'members' | 'commissions' | 'orders' | 'retention' | 'productivity';
}

export interface GrowthAnalytics {
  period: string;
  newMembers: number;
  activeMembers: number;
  totalMembers: number;
  retentionRate: number;
  churnRate: number;
  averageOrderValue: number;
  totalVolume: number;
  topPerformers: {
    memberId: string;
    name: string;
    volume: number;
    growth: number;
  }[];
}

export interface PredictiveAnalytics {
  memberId: string;
  riskScore: number;
  predictedVolume: number;
  confidence: number;
  recommendations: string[];
  nextBestActions: {
    action: string;
    expectedImpact: string;
    priority: 'high' | 'medium' | 'low';
  }[];
}

export interface BusinessHealthScore {
  overall: number;
  components: {
    growth: number;
    retention: number;
    productivity: number;
    compliance: number;
    financial: number;
  };
  trends: {
    growth: 'improving' | 'declining' | 'stable';
    retention: 'improving' | 'declining' | 'stable';
    productivity: 'improving' | 'declining' | 'stable';
  };
  recommendations: string[];
}

// Configuration types
export interface ServiceConfig {
  name: string;
  version: string;
  port: number;
  database: {
    url: string;
  };
  redis?: {
    url: string;
  };
  rabbitmq?: {
    url: string;
  };
  logging: {
    level: string;
    format: 'json' | 'text';
  };
  metrics: {
    enabled: boolean;
    port: number;
  };
}

// Health check types
export interface HealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: 'up' | 'down';
    redis?: 'up' | 'down';
    rabbitmq?: 'up' | 'down';
  };
}