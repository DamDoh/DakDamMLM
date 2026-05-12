"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthController = void 0;
const cache_1 = require("../utils/cache");
const metrics_1 = require("../utils/metrics");
const database_1 = require("../config/database");
class HealthController {
    constructor() {
        this.healthCheck = async (req, res) => {
            try {
                const checks = await this.performHealthChecks();
                const overallStatus = checks.every(check => check.status === 'healthy') ? 'healthy' : 'degraded';
                const unhealthyChecks = checks.filter(check => check.status !== 'healthy');
                const response = res;
                if (overallStatus === 'degraded') {
                    response.status(503).json({
                        success: false,
                        status: overallStatus,
                        timestamp: new Date().toISOString(),
                        checks,
                        issues: unhealthyChecks.map(check => ({
                            service: check.service,
                            error: check.error || 'Service unavailable'
                        }))
                    });
                }
                else {
                    response.json({
                        success: true,
                        status: overallStatus,
                        timestamp: new Date().toISOString(),
                        checks,
                        version: process.env.npm_package_version || '1.0.0',
                        uptime: process.uptime()
                    });
                }
            }
            catch (error) {
                const response = res;
                response.status(503).json({
                    success: false,
                    status: 'unhealthy',
                    timestamp: new Date().toISOString(),
                    error: 'Health check failed',
                    details: process.env.NODE_ENV === 'development' ? error.message : undefined
                });
            }
        };
    }
    async performHealthChecks() {
        const checks = await Promise.allSettled([
            this.checkDatabase(),
            this.checkCache(),
            this.checkMetrics(),
        ]);
        return checks.map((check, index) => {
            const serviceNames = ['database', 'cache', 'metrics'];
            const serviceName = serviceNames[index];
            if (check.status === 'fulfilled') {
                return {
                    service: serviceName,
                    status: check.value.status,
                    latency: check.value.latency,
                };
            }
            else {
                return {
                    service: serviceName,
                    status: 'unhealthy',
                    error: check.reason?.message || 'Check failed',
                };
            }
        });
    }
    async checkDatabase() {
        try {
            const start = Date.now();
            await database_1.paymentDb.$queryRaw `SELECT 1`;
            const latency = Date.now() - start;
            return { status: 'healthy', latency };
        }
        catch (error) {
            return { status: 'unhealthy' };
        }
    }
    async checkCache() {
        try {
            const result = await cache_1.cacheService.healthCheck();
            return {
                status: (result.status === 'healthy' ? 'healthy' : 'unhealthy'),
                latency: result.latency
            };
        }
        catch (error) {
            return { status: 'unhealthy' };
        }
    }
    async checkMetrics() {
        try {
            const result = await metrics_1.metricsService.healthCheck();
            return {
                status: (result.status === 'healthy' ? 'healthy' : 'unhealthy')
            };
        }
        catch (error) {
            return { status: 'unhealthy' };
        }
    }
}
exports.HealthController = HealthController;
//# sourceMappingURL=HealthController.js.map