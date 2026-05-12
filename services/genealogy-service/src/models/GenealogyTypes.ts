export interface GenealogyNode {
  id: string;
  memberId: string;
  fullName: string;
  rank: string;
  pv: number;
  joinDate: string;
  position: 'left' | 'right' | null;
  children: GenealogyNode[];
  level: number;
  active: boolean;
}

export interface GenealogyStats {
  totalDownline: number;
  activeDownline: number;
  levels: number;
  leftLeg: number;
  rightLeg: number;
  totalPV: number;
  activePV: number;
  averagePV: number;
  growthRate: number;
}

export interface PlacementInfo {
  userId: string;
  sponsor: {
    id: string;
    fullName: string;
    memberId: string;
  } | null;
  placementParent: {
    id: string;
    fullName: string;
    memberId: string;
  } | null;
  position: 'left' | 'right' | null;
  children: {
    left: string | null;
    right: string | null;
  };
}

export interface MoveDownlineRequest {
  userId: string;
  newParentId: string;
  position: 'left' | 'right';
}

export interface MoveDownlineResponse {
  success: boolean;
  message: string;
  oldParent?: string;
  newParent: string;
  position: 'left' | 'right';
}

export interface GenealogyTreeRequest {
  userId: string;
  depth?: number;
  includeInactive?: boolean;
}

export interface DownlineRequest {
  userId: string;
  maxLevel?: number;
  includeStats?: boolean;
  includeInactive?: boolean;
}

export interface GenealogyValidationError {
  field: string;
  message: string;
  code: string;
}

export interface GenealogyServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  validationErrors?: GenealogyValidationError[];
  timestamp: string;
  requestId: string;
}