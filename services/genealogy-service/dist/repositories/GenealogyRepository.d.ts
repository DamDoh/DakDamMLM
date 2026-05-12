export declare class GenealogyRepository {
    findUserById(id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        memberId: string | null;
        fullName: string;
        email: string | null;
        rank: string;
        sponsorId: string | null;
        active: boolean;
    } | null>;
    findUserWithChildren(id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        memberId: string | null;
        fullName: string;
        email: string | null;
        rank: string;
        sponsorId: string | null;
        active: boolean;
    } | null>;
    findDownlineBySponsor(sponsorId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        memberId: string | null;
        fullName: string;
        email: string | null;
        rank: string;
        sponsorId: string | null;
        active: boolean;
    }[]>;
    findUplineById(id: string): Promise<any[]>;
    updateUserChildren(userId: string, children: {
        left?: string | null;
        right?: string | null;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        memberId: string | null;
        fullName: string;
        email: string | null;
        rank: string;
        sponsorId: string | null;
        active: boolean;
    }>;
    updateUserSponsor(userId: string, sponsorId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        memberId: string | null;
        fullName: string;
        email: string | null;
        rank: string;
        sponsorId: string | null;
        active: boolean;
    }>;
    getUserCountBySponsor(sponsorId: string): Promise<number>;
    getActiveUserCountBySponsor(sponsorId: string): Promise<number>;
    getTotalPVBySponsor(sponsorId: string): Promise<number>;
    getActivePVBySponsor(sponsorId: string): Promise<number>;
    getMaxLevelBySponsor(sponsorId: string): Promise<number>;
    private getAllDownlineLevels;
    getUserWithSponsor(id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        memberId: string | null;
        fullName: string;
        email: string | null;
        rank: string;
        sponsorId: string | null;
        active: boolean;
    } | null>;
    getUserPlacementInfo(id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        memberId: string | null;
        fullName: string;
        email: string | null;
        rank: string;
        sponsorId: string | null;
        active: boolean;
    } | null>;
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