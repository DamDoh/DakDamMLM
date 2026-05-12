"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateTreeDepth = exports.validateMoveDownline = exports.validateUserId = void 0;
const utils_1 = require("../../../../shared/utils");
const validateUserId = (req, res, next) => {
    const { userId } = req.params;
    if (!userId || !utils_1.ValidationUtils.isValidUUID(userId)) {
        return res.status(400).json({ error: 'Valid userId parameter required' });
    }
    next();
};
exports.validateUserId = validateUserId;
const validateMoveDownline = (req, res, next) => {
    const { userId, newParentId, position } = req.body;
    if (!userId || !utils_1.ValidationUtils.isValidUUID(userId)) {
        return res.status(400).json({ error: 'Valid userId required' });
    }
    if (!newParentId || !utils_1.ValidationUtils.isValidUUID(newParentId)) {
        return res.status(400).json({ error: 'Valid newParentId required' });
    }
    if (!position || !['left', 'right'].includes(position)) {
        return res.status(400).json({ error: 'Position must be either "left" or "right"' });
    }
    next();
};
exports.validateMoveDownline = validateMoveDownline;
const validateTreeDepth = (req, res, next) => {
    const { depth } = req.query;
    if (depth) {
        const depthNum = parseInt(depth);
        if (isNaN(depthNum) || depthNum < 1 || depthNum > 10) {
            return res.status(400).json({ error: 'Depth must be a number between 1 and 10' });
        }
    }
    next();
};
exports.validateTreeDepth = validateTreeDepth;
//# sourceMappingURL=validationMiddleware.js.map