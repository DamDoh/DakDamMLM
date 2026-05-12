"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenealogyService = void 0;
const GenealogyRepository_1 = require("../repositories/GenealogyRepository");
const utils_1 = require("../../../../shared/utils");
const client_1 = require("@prisma/client");
const db = new client_1.PrismaClient();
class GenealogyService {
    constructor() {
        this.repository = new GenealogyRepository_1.GenealogyRepository();
    }
    async getGenealogyTree(userId, maxDepth = 3) {
        try {
            const rootUser = await this.repository.findUserWithChildren(userId);
            if (!rootUser) {
                throw utils_1.ServiceErrorHandler.createError('NOT_FOUND', `User with ID ${userId} not found`);
            }
            const tree = await this.buildTree(rootUser, 0, maxDepth);
            return tree;
        }
        catch (error) {
            console.error('Error getting genealogy tree:', error);
            throw error;
        }
    }
    async buildTree(user, currentLevel, maxDepth) {
        const node = {
            id: user.id,
            memberId: user.memberId || '',
            fullName: user.fullName,
            rank: user.rank,
            pv: user.pv || 0,
            joinDate: user.createdAt ? new Date(user.createdAt).toISOString() : '',
            position: null, // Root has no position
            children: [],
            level: currentLevel,
            active: user.active,
        };
        if (currentLevel < maxDepth) {
            // Get left child - children.left is now a full user object from repository
            if (user.children?.left) {
                const leftChild = await this.buildTree(user.children.left, currentLevel + 1, maxDepth);
                leftChild.position = 'left';
                node.children.push(leftChild);
            }
            // Get right child - children.right is now a full user object from repository
            if (user.children?.right) {
                const rightChild = await this.buildTree(user.children.right, currentLevel + 1, maxDepth);
                rightChild.position = 'right';
                node.children.push(rightChild);
            }
        }
        return node;
    }
    async getDownline(userId, maxLevel, includeStats = false, includeInactive = false) {
        try {
            // Validate user exists
            const user = await this.repository.findUserById(userId);
            if (!user) {
                throw utils_1.ServiceErrorHandler.createError('NOT_FOUND', `User with ID ${userId} not found`);
            }
            const downline = await this.getAllDownline(userId, maxLevel, includeInactive);
            if (includeStats) {
                const stats = await this.calculateDownlineStats(userId, downline);
                return { downline, stats };
            }
            return { downline };
        }
        catch (error) {
            console.error('Error getting downline:', error);
            throw error;
        }
    }
    async getAllDownline(userId, maxLevel, includeInactive = false) {
        const downline = [];
        const queue = [
            { id: userId, level: 0, position: null }
        ];
        while (queue.length > 0) {
            const current = queue.shift();
            if (maxLevel && current.level >= maxLevel)
                continue;
            const children = await this.repository.findDownlineBySponsor(current.id);
            // Filter inactive users if not including them
            const filteredChildren = includeInactive ? children : children.filter((child) => child.active);
            for (const child of filteredChildren) {
                const childWithLevel = {
                    ...child,
                    level: current.level + 1,
                    position: await this.determinePosition(current.id, child.id),
                };
                downline.push(childWithLevel);
                if (!maxLevel || current.level + 1 < maxLevel) {
                    queue.push({
                        id: child.id,
                        level: current.level + 1,
                        position: childWithLevel.position,
                    });
                }
            }
        }
        return downline;
    }
    async determinePosition(parentId, childId) {
        const parent = await this.repository.findUserById(parentId);
        if (!parent?.children)
            return null;
        const children = parent.children;
        if (children.left === childId)
            return 'left';
        if (children.right === childId)
            return 'right';
        return null;
    }
    async getUpline(userId) {
        try {
            // Validate user exists
            const user = await this.repository.findUserById(userId);
            if (!user) {
                throw utils_1.ServiceErrorHandler.createError('NOT_FOUND', `User with ID ${userId} not found`);
            }
            return await this.repository.findUplineById(userId);
        }
        catch (error) {
            console.error('Error getting upline:', error);
            throw error;
        }
    }
    async moveDownline(userId, newParentId, position) {
        try {
            // Validate that the user exists
            const user = await this.repository.findUserById(userId);
            if (!user) {
                throw utils_1.ServiceErrorHandler.createError('NOT_FOUND', `User with ID ${userId} not found`);
            }
            // Validate the move using repository method
            const isValidMove = await this.repository.validatePlacementMove(userId, newParentId);
            if (!isValidMove) {
                throw utils_1.ServiceErrorHandler.createError('VALIDATION_ERROR', 'Invalid placement move');
            }
            // Validate that the new parent exists
            const newParent = await this.repository.findUserById(newParentId);
            if (!newParent) {
                throw utils_1.ServiceErrorHandler.createError('NOT_FOUND', `New parent with ID ${newParentId} not found`);
            }
            // Check if position is available
            const newParentChildren = newParent.children;
            if ((position === 'left' && newParentChildren?.left) ||
                (position === 'right' && newParentChildren?.right)) {
                throw utils_1.ServiceErrorHandler.createError('VALIDATION_ERROR', `Position ${position} is already occupied`);
            }
            const oldParentId = user.sponsorId;
            // Remove from current parent's children
            if (oldParentId) {
                const currentParent = await this.repository.findUserById(oldParentId);
                if (currentParent && currentParent.children) {
                    const currentChildren = currentParent.children;
                    const updatedChildren = { ...currentChildren };
                    if (updatedChildren.left === userId)
                        updatedChildren.left = null;
                    if (updatedChildren.right === userId)
                        updatedChildren.right = null;
                    await this.repository.updateUserChildren(oldParentId, updatedChildren);
                }
            }
            // Update user's sponsor
            await this.repository.updateUserSponsor(userId, newParentId);
            // Update new parent's children
            const updatedChildren = { ...(newParentChildren || {}) };
            updatedChildren[position] = userId;
            await this.repository.updateUserChildren(newParentId, updatedChildren);
            return {
                success: true,
                message: 'Downline moved successfully',
                oldParent: oldParentId || undefined,
                newParent: newParentId,
                position
            };
        }
        catch (error) {
            console.error('Error moving downline:', error);
            throw error;
        }
    }
    async getGenealogyStats(userId) {
        try {
            // Validate user exists
            const user = await this.repository.findUserById(userId);
            if (!user) {
                throw utils_1.ServiceErrorHandler.createError('NOT_FOUND', `User with ID ${userId} not found`);
            }
            const downline = await this.getAllDownline(userId);
            const totalDownline = downline.length;
            const activeDownline = downline.filter(member => member.active).length;
            const levels = downline.length > 0 ? Math.max(...downline.map(d => d.level)) : 0;
            const leftLeg = downline.filter(d => d.position === 'left').length;
            const rightLeg = downline.filter(d => d.position === 'right').length;
            const totalPV = downline.reduce((sum, member) => sum + (member.pv || 0), 0);
            const activePV = downline.filter(member => member.active)
                .reduce((sum, member) => sum + (member.pv || 0), 0);
            const averagePV = totalDownline > 0 ? totalPV / totalDownline : 0;
            // Calculate growth rate (simplified - could be based on time periods)
            const growthRate = totalDownline > 0 ? (activeDownline / totalDownline) * 100 : 0;
            return {
                totalDownline,
                activeDownline,
                levels,
                leftLeg,
                rightLeg,
                totalPV,
                activePV,
                averagePV,
                growthRate,
            };
        }
        catch (error) {
            console.error('Error getting genealogy stats:', error);
            throw error;
        }
    }
    async getPlacementInfo(userId) {
        try {
            const user = await this.repository.getUserPlacementInfo(userId);
            if (!user) {
                throw utils_1.ServiceErrorHandler.createError('NOT_FOUND', `User with ID ${userId} not found`);
            }
            return {
                userId: user.id,
                sponsor: user.sponsor ? {
                    id: user.sponsor.id,
                    fullName: user.sponsor.fullName,
                    memberId: user.sponsor.memberId,
                } : null,
                placementParent: user.placementParent ? {
                    id: user.placementParent.id,
                    fullName: user.placementParent.fullName,
                    memberId: user.placementParent.memberId,
                } : null,
                position: user.position,
                children: user.children,
            };
        }
        catch (error) {
            console.error('Error getting placement info:', error);
            throw error;
        }
    }
    async calculateDownlineStats(userId, downline) {
        const totalMembers = downline.length;
        const activeMembers = downline.filter(d => d.active).length;
        const totalPV = downline.reduce((sum, d) => sum + (d.pv || 0), 0);
        const activePV = downline.filter(d => d.active).reduce((sum, d) => sum + (d.pv || 0), 0);
        const averagePV = totalMembers > 0 ? totalPV / totalMembers : 0;
        // Calculate levels distribution
        const levels = [...new Set(downline.map(d => d.level))].sort((a, b) => a - b);
        const levelDistribution = levels.map(level => ({
            level,
            count: downline.filter(d => d.level === level).length,
            activeCount: downline.filter(d => d.level === level && d.active).length,
        }));
        // Calculate leg balance
        const leftLeg = downline.filter(d => d.position === 'left').length;
        const rightLeg = downline.filter(d => d.position === 'right').length;
        const legBalance = leftLeg > 0 && rightLeg > 0 ? Math.min(leftLeg, rightLeg) / Math.max(leftLeg, rightLeg) : 0;
        return {
            totalMembers,
            activeMembers,
            totalPV,
            activePV,
            averagePV,
            levels: levelDistribution,
            leftLeg,
            rightLeg,
            legBalance,
            inactiveMembers: totalMembers - activeMembers,
        };
    }
    async getDownlineWithPagination(userId, page = 1, limit = 50, includeInactive = false, sortBy = 'createdAt', sortOrder = 'desc') {
        try {
            const user = await this.repository.findUserById(userId);
            if (!user) {
                throw utils_1.ServiceErrorHandler.createError('NOT_FOUND', `User with ID ${userId} not found`);
            }
            const offset = (page - 1) * limit;
            const downline = await this.getAllDownline(userId, undefined, includeInactive);
            // Apply sorting
            const sortedDownline = this.sortDownline(downline, sortBy, sortOrder);
            // Apply pagination
            const paginatedDownline = sortedDownline.slice(offset, offset + limit);
            const totalCount = sortedDownline.length;
            return {
                downline: paginatedDownline,
                pagination: {
                    page,
                    limit,
                    total: totalCount,
                    totalPages: Math.ceil(totalCount / limit),
                    hasNext: page * limit < totalCount,
                    hasPrev: page > 1,
                },
                summary: {
                    totalMembers: totalCount,
                    activeMembers: sortedDownline.filter(d => d.active).length,
                    totalPV: sortedDownline.reduce((sum, d) => sum + (d.pv || 0), 0),
                }
            };
        }
        catch (error) {
            console.error('Error getting paginated downline:', error);
            throw error;
        }
    }
    sortDownline(downline, sortBy, sortOrder) {
        return [...downline].sort((a, b) => {
            let aValue, bValue;
            switch (sortBy) {
                case 'createdAt':
                    aValue = new Date(a.createdAt || a.joinDate).getTime();
                    bValue = new Date(b.createdAt || b.joinDate).getTime();
                    break;
                case 'pv':
                    aValue = a.pv || 0;
                    bValue = b.pv || 0;
                    break;
                case 'rank':
                    // Simple rank ordering - could be enhanced with rank hierarchy
                    aValue = a.rank;
                    bValue = b.rank;
                    break;
                default:
                    aValue = a.createdAt || a.joinDate;
                    bValue = b.createdAt || b.joinDate;
            }
            if (sortOrder === 'asc') {
                return aValue > bValue ? 1 : -1;
            }
            else {
                return aValue < bValue ? 1 : -1;
            }
        });
    }
    async getBinaryTree(userId, maxDepth = 3) {
        try {
            const rootUser = await this.repository.findUserWithChildren(userId);
            if (!rootUser) {
                throw utils_1.ServiceErrorHandler.createError('NOT_FOUND', `User with ID ${userId} not found`);
            }
            const tree = await this.buildBinaryTree(rootUser, 0, maxDepth);
            return tree;
        }
        catch (error) {
            console.error('Error getting binary tree:', error);
            throw error;
        }
    }
    async buildBinaryTree(user, currentLevel, maxDepth) {
        const node = {
            id: user.id,
            memberId: user.memberId || '',
            fullName: user.fullName,
            rank: user.rank,
            pv: user.pv || 0,
            joinDate: user.createdAt ? new Date(user.createdAt).toISOString() : '',
            position: null,
            children: [],
            level: currentLevel,
            active: user.active,
        };
        if (currentLevel < maxDepth && user.children) {
            // Only include direct children (left and right) - children.left/right are now user objects
            if (user.children.left) {
                const leftChild = user.children.left;
                const leftNode = await this.buildBinaryTree(leftChild, currentLevel + 1, maxDepth);
                leftNode.position = 'left';
                node.children.push(leftNode);
            }
            if (user.children.right) {
                const rightChild = user.children.right;
                const rightNode = await this.buildBinaryTree(rightChild, currentLevel + 1, maxDepth);
                rightNode.position = 'right';
                node.children.push(rightNode);
            }
        }
        return node;
    }
    async validatePlacementMove(userId, newParentId, position) {
        try {
            // Check if users exist
            const [user, newParent] = await Promise.all([
                this.repository.findUserById(userId),
                this.repository.findUserById(newParentId)
            ]);
            if (!user) {
                return { valid: false, reason: 'User not found' };
            }
            if (!newParent) {
                return { valid: false, reason: 'New parent not found' };
            }
            // Check if position is available
            const newParentChildren = newParent.children;
            if ((position === 'left' && newParentChildren?.left) ||
                (position === 'right' && newParentChildren?.right)) {
                return { valid: false, reason: `Position ${position} is already occupied` };
            }
            // Check for circular reference
            if (await this.repository.validatePlacementMove(userId, newParentId)) {
                return { valid: false, reason: 'Cannot move user to their own descendant' };
            }
            // Check business rules (e.g., user cannot be moved if they have active downline)
            const userDownline = await this.getAllDownline(userId, 1, false);
            if (userDownline.length > 0) {
                // Additional business rule: warn about moving users with downline
                console.warn(`Moving user ${userId} who has ${userDownline.length} downline members`);
            }
            return { valid: true };
        }
        catch (error) {
            console.error('Error validating placement move:', error);
            return { valid: false, reason: 'Validation failed due to system error' };
        }
    }
    async getGenealogyMetrics(userId) {
        try {
            const user = await this.repository.findUserById(userId);
            if (!user) {
                throw utils_1.ServiceErrorHandler.createError('NOT_FOUND', `User with ID ${userId} not found`);
            }
            const downline = await this.getAllDownline(userId);
            const stats = await this.calculateDownlineStats(userId, downline);
            // Additional metrics
            const recentJoins = downline.filter(member => {
                const joinDate = new Date(member.createdAt || member.joinDate);
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                return joinDate > thirtyDaysAgo;
            });
            const topPerformers = downline
                .sort((a, b) => (b.pv || 0) - (a.pv || 0))
                .slice(0, 5);
            return {
                ...stats,
                recentJoins: recentJoins.length,
                topPerformers,
                growthVelocity: this.calculateGrowthVelocity(downline),
                retentionRate: this.calculateRetentionRate(downline),
            };
        }
        catch (error) {
            console.error('Error getting genealogy metrics:', error);
            throw error;
        }
    }
    calculateGrowthVelocity(downline) {
        if (downline.length === 0)
            return 0;
        const now = new Date();
        const monthlyGrowth = {};
        downline.forEach(member => {
            const joinDate = new Date(member.createdAt || member.joinDate);
            const monthKey = `${joinDate.getFullYear()}-${joinDate.getMonth() + 1}`;
            monthlyGrowth[monthKey] = (monthlyGrowth[monthKey] || 0) + 1;
        });
        const months = Object.keys(monthlyGrowth).sort();
        if (months.length < 2)
            return 0;
        const recentMonths = months.slice(-3); // Last 3 months
        const avgGrowth = recentMonths.reduce((sum, month) => sum + monthlyGrowth[month], 0) / recentMonths.length;
        return Math.round(avgGrowth * 100) / 100;
    }
    calculateRetentionRate(downline) {
        if (downline.length === 0)
            return 0;
        const activeMembers = downline.filter(member => member.active).length;
        return Math.round((activeMembers / downline.length) * 100);
    }
    async bulkUpdateGenealogy(operations) {
        const results = { success: 0, failed: 0, errors: [] };
        for (const operation of operations) {
            try {
                switch (operation.type) {
                    case 'move':
                        if (operation.data?.newParentId && operation.data?.position) {
                            await this.moveDownline(operation.userId, operation.data.newParentId, operation.data.position);
                        }
                        else {
                            throw new Error('Missing move data');
                        }
                        break;
                    case 'activate':
                        await this.repository.updateUserStatus(operation.userId, true);
                        break;
                    case 'deactivate':
                        await this.repository.updateUserStatus(operation.userId, false);
                        break;
                    default:
                        throw new Error(`Unknown operation type: ${operation.type}`);
                }
                results.success++;
            }
            catch (error) {
                results.failed++;
                results.errors.push(`Operation ${operation.type} for user ${operation.userId}: ${error.message}`);
            }
        }
        return results;
    }
    async healthCheck() {
        try {
            await db.$queryRaw `SELECT 1`;
            return { status: 'healthy', timestamp: new Date().toISOString() };
        }
        catch (error) {
            return { status: 'unhealthy', timestamp: new Date().toISOString() };
        }
    }
}
exports.GenealogyService = GenealogyService;
//# sourceMappingURL=GenealogyService.js.map