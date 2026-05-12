import { GenealogyNode, GenealogyStats, PlacementInfo, MoveDownlineResponse } from '../models/GenealogyTypes';
export declare class GenealogyService {
    private repository;
    constructor();
    getGenealogyTree(userId: string, maxDepth?: number): Promise<GenealogyNode | null>;
    private buildTree;
    getDownline(userId: string, maxLevel?: number, includeStats?: boolean, includeInactive?: boolean): Promise<any>;
    private getAllDownline;
    private determinePosition;
    getUpline(userId: string): Promise<any[]>;
    moveDownline(userId: string, newParentId: string, position: 'left' | 'right'): Promise<MoveDownlineResponse>;
    getGenealogyStats(userId: string): Promise<GenealogyStats>;
    getPlacementInfo(userId: string): Promise<PlacementInfo>;
    private calculateDownlineStats;
    getDownlineWithPagination(userId: string, page?: number, limit?: number, includeInactive?: boolean, sortBy?: 'joinDate' | 'pv' | 'rank', sortOrder?: 'asc' | 'desc'): Promise<any>;
    private sortDownline;
    getBinaryTree(userId: string, maxDepth?: number): Promise<GenealogyNode | null>;
    private buildBinaryTree;
    validatePlacementMove(userId: string, newParentId: string, position: 'left' | 'right'): Promise<{
        valid: boolean;
        reason?: string;
    }>;
    getGenealogyMetrics(userId: string): Promise<any>;
    private calculateGrowthVelocity;
    private calculateRetentionRate;
    bulkUpdateGenealogy(operations: Array<{
        type: 'move' | 'activate' | 'deactivate';
        userId: string;
        data?: any;
    }>): Promise<{
        success: number;
        failed: number;
        errors: string[];
    }>;
    healthCheck(): Promise<{
        status: string;
        timestamp: string;
    }>;
}
//# sourceMappingURL=GenealogyService.d.ts.map