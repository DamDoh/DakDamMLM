"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenealogyController = void 0;
const GenealogyService_1 = require("../services/GenealogyService");
const utils_1 = require("../../../../shared/utils");
class GenealogyController {
    constructor() {
        this.getGenealogyTree = async (req, res) => {
            try {
                const { userId } = req.params;
                const { depth = 3 } = req.query;
                // Users can only view their own tree or admin can view any
                if (!req.user?.isAdmin && req.user?.id !== userId) {
                    return res.status(403).json(this.createResponse(null, false, 'Access denied'));
                }
                const tree = await this.genealogyService.getGenealogyTree(userId, parseInt(depth));
                res.json(this.createResponse(tree));
            }
            catch (error) {
                console.error('Controller error:', error);
                const statusCode = error.code === 'NOT_FOUND' ? 404 : 500;
                res.status(statusCode).json(this.createResponse(null, false, error.message));
            }
        };
        this.getDownline = async (req, res) => {
            try {
                const { userId } = req.params;
                const { maxLevel, includeStats = false, includeInactive = false } = req.query;
                // Users can only view their own downline or admin can view any
                if (!req.user?.isAdmin && req.user?.id !== userId) {
                    return res.status(403).json(this.createResponse(null, false, 'Access denied'));
                }
                const downline = await this.genealogyService.getDownline(userId, maxLevel ? parseInt(maxLevel) : undefined, includeStats === 'true', includeInactive === 'true');
                res.json(this.createResponse(downline));
            }
            catch (error) {
                console.error('Controller error:', error);
                const statusCode = error.code === 'NOT_FOUND' ? 404 : 500;
                res.status(statusCode).json(this.createResponse(null, false, error.message));
            }
        };
        this.getUpline = async (req, res) => {
            try {
                const { userId } = req.params;
                // Users can only view their own upline or admin can view any
                if (!req.user?.isAdmin && req.user?.id !== userId) {
                    return res.status(403).json(this.createResponse(null, false, 'Access denied'));
                }
                const upline = await this.genealogyService.getUpline(userId);
                res.json(this.createResponse(upline));
            }
            catch (error) {
                console.error('Controller error:', error);
                const statusCode = error.code === 'NOT_FOUND' ? 404 : 500;
                res.status(statusCode).json(this.createResponse(null, false, error.message));
            }
        };
        this.moveDownline = async (req, res) => {
            try {
                const { userId, newParentId, position } = req.body;
                const result = await this.genealogyService.moveDownline(userId, newParentId, position);
                res.json(result);
            }
            catch (error) {
                res.status(400).json({ error: error.message });
            }
        };
        this.getGenealogyStats = async (req, res) => {
            try {
                const { userId } = req.params;
                const stats = await this.genealogyService.getGenealogyStats(userId);
                res.json(stats);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        };
        this.getPlacementInfo = async (req, res) => {
            try {
                const { userId } = req.params;
                // Users can only view their own placement or admin can view any
                if (!req.user?.isAdmin && req.user?.id !== userId) {
                    return res.status(403).json(this.createResponse(null, false, 'Access denied'));
                }
                const placement = await this.genealogyService.getPlacementInfo(userId);
                res.json(this.createResponse(placement));
            }
            catch (error) {
                console.error('Controller error:', error);
                const statusCode = error.code === 'NOT_FOUND' ? 404 : 500;
                res.status(statusCode).json(this.createResponse(null, false, error.message));
            }
        };
        this.getBinaryTree = async (req, res) => {
            try {
                const { userId } = req.params;
                const { depth = 3 } = req.query;
                // Users can only view their own tree or admin can view any
                if (!req.user?.isAdmin && req.user?.id !== userId) {
                    return res.status(403).json(this.createResponse(null, false, 'Access denied'));
                }
                const tree = await this.genealogyService.getBinaryTree(userId, parseInt(depth));
                res.json(this.createResponse(tree));
            }
            catch (error) {
                console.error('Controller error:', error);
                const statusCode = error.code === 'NOT_FOUND' ? 404 : 500;
                res.status(statusCode).json(this.createResponse(null, false, error.message));
            }
        };
        this.getDownlinePaginated = async (req, res) => {
            try {
                const { userId } = req.params;
                const { page = 1, limit = 50, includeInactive = false, sortBy = 'joinDate', sortOrder = 'desc' } = req.query;
                // Users can only view their own downline or admin can view any
                if (!req.user?.isAdmin && req.user?.id !== userId) {
                    return res.status(403).json(this.createResponse(null, false, 'Access denied'));
                }
                const result = await this.genealogyService.getDownlineWithPagination(userId, parseInt(page), parseInt(limit), includeInactive === 'true', sortBy, sortOrder);
                res.json(this.createResponse(result));
            }
            catch (error) {
                console.error('Controller error:', error);
                const statusCode = error.code === 'NOT_FOUND' ? 404 : 500;
                res.status(statusCode).json(this.createResponse(null, false, error.message));
            }
        };
        this.validatePlacement = async (req, res) => {
            try {
                const { userId, newParentId, position } = req.body;
                // Only admins can validate placements
                if (!req.user?.isAdmin) {
                    return res.status(403).json(this.createResponse(null, false, 'Admin access required'));
                }
                const validation = await this.genealogyService.validatePlacementMove(userId, newParentId, position);
                res.json(this.createResponse(validation));
            }
            catch (error) {
                console.error('Controller error:', error);
                res.status(500).json(this.createResponse(null, false, error.message));
            }
        };
        this.getGenealogyMetrics = async (req, res) => {
            try {
                const { userId } = req.params;
                // Users can only view their own metrics or admin can view any
                if (!req.user?.isAdmin && req.user?.id !== userId) {
                    return res.status(403).json(this.createResponse(null, false, 'Access denied'));
                }
                const metrics = await this.genealogyService.getGenealogyMetrics(userId);
                res.json(this.createResponse(metrics));
            }
            catch (error) {
                console.error('Controller error:', error);
                const statusCode = error.code === 'NOT_FOUND' ? 404 : 500;
                res.status(statusCode).json(this.createResponse(null, false, error.message));
            }
        };
        this.bulkUpdateGenealogy = async (req, res) => {
            try {
                const operations = req.body.operations;
                // Only admins can perform bulk operations
                if (!req.user?.isAdmin) {
                    return res.status(403).json(this.createResponse(null, false, 'Admin access required'));
                }
                const result = await this.genealogyService.bulkUpdateGenealogy(operations);
                res.json(this.createResponse(result));
            }
            catch (error) {
                console.error('Controller error:', error);
                res.status(500).json(this.createResponse(null, false, error.message));
            }
        };
        this.genealogyService = new GenealogyService_1.GenealogyService();
    }
    createResponse(data, success = true, error) {
        return {
            success,
            data: success ? data : undefined,
            error: !success ? error : undefined,
            timestamp: new Date().toISOString(),
            requestId: utils_1.ServiceErrorHandler.generateRequestId(),
        };
    }
}
exports.GenealogyController = GenealogyController;
//# sourceMappingURL=GenealogyController.js.map