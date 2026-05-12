export declare class GenealogyRepository {
    findUserById(id: string): Promise<any>;
    findUserWithChildren(id: string): Promise<any>;
    findDownlineBySponsor(sponsorId: string): Promise<any>;
    findUplineById(id: string): Promise<any[]>;
    updateUserChildren(userId: string, children: {
        left?: string | null;
        right?: string | null;
    }): Promise<any>;
    updateUserSponsor(userId: string, sponsorId: string): Promise<any>;
    getUserCountBySponsor(sponsorId: string): Promise<number>;
    getActiveUserCountBySponsor(sponsorId: string): Promise<number>;
    getTotalPVBySponsor(sponsorId: string): Promise<number>;
    getActivePVBySponsor(sponsorId: string): Promise<number>;
    getMaxLevelBySponsor(sponsorId: string): Promise<number>;
    private getAllDownlineLevels;
    getUserWithSponsor(id: string): Promise<any>;
    getUserPlacementInfo(id: string): Promise<any>;
    validatePlacementMove(userId: string, newParentId: string): Promise<boolean>;
    private isDescendant;
    getDownlineCount(sponsorId: string, includeInactive?: boolean): Promise<number>;
    getDownlinePV(sponsorId: string, includeInactive?: boolean): Promise<number>;
    getRecentJoins(sponsorId: string, days?: number): Promise<number>;
    getTopPerformers(sponsorId: string, limit?: number): Promise<any[]>;
    getGenealogyDepth(sponsorId: string): Promise<number>;
    updateUserStatus(userId: string, active: boolean): Promise<void>;
    bulkUpdateUsers(updates: Array<{
        id: string;
        data: any;
    }>): Promise<void>;
    getUserActivityStats(userId: string): Promise<any>;
    validateBulkOperation(operations: Array<{
        type: string;
        userId: string;
        data?: any;
    }>): Promise<{
        valid: boolean;
        errors: string[];
    }>;
}
//# sourceMappingURL=GenealogyRepository.d.ts.map