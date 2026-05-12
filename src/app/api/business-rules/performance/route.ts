import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireAdmin } from '@/lib/auth-middleware';
import { rateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

/**
 * GET /api/business-rules/performance
 * Get performance metrics for business rules
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, { windowMs: 15 * 60 * 1000, maxRequests: 100000 }); // Optimized for 100M+ users
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for business rules performance API', {
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent')
      }, request);
      return rateLimitResult.response!;
    }

    // Authenticate and authorize admin access
    return requireAdmin(async (req) => {
      const { searchParams } = new URL(request.url);
      const timeRange = searchParams.get('timeRange') || '7d';
      
      // Calculate date range
      const now = new Date();
      const daysAgo = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 7;
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - daysAgo);

      try {
        // Get all active rules
        const rules = await prisma.businessRule.findMany({
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            type: true,
            category: true
          }
        });

        // Get execution logs for the time range
        const executionLogs = await prisma.ruleExecutionLog.findMany({
          where: {
            executedAt: {
              gte: startDate
            }
          },
          select: {
            id: true,
            ruleId: true,
            amount: true,
            status: true,
            executedAt: true,
            metadata: true
          }
        });

        // Get execution summaries for the time range
        const executionSummaries = await prisma.ruleExecutionSummary.findMany({
          where: {
            periodStart: {
              gte: startDate
            }
          },
          select: {
            ruleId: true,
            totalExecutions: true,
            successfulExecutions: true,
            failedExecutions: true,
            totalAmount: true,
            averageAmount: true,
            executionTime: true,
            errors: true
          }
        });

        // Calculate overall metrics
        const totalExecutions = executionLogs.length;
        const successfulExecutions = executionLogs.filter(log => log.status === 'success').length;
        const failedExecutions = executionLogs.filter(log => log.status === 'failed').length;
        const totalAmountPaid = executionLogs
          .filter(log => log.status === 'success')
          .reduce((sum, log) => sum + (log.amount || 0), 0);
        
        // Calculate average execution time from summaries
        const summariesWithTime = executionSummaries.filter(s => s.executionTime > 0);
        const averageExecutionTime = summariesWithTime.length > 0
          ? summariesWithTime.reduce((sum, s) => sum + s.executionTime, 0) / summariesWithTime.length
          : 0;

        const successRate = totalExecutions > 0
          ? (successfulExecutions / totalExecutions) * 100
          : 0;

        // Group by rule ID for individual rule metrics
        const ruleMetricsMap = new Map<string, {
          ruleId: string;
          ruleName: string;
          executionCount: number;
          successfulCount: number;
          failedCount: number;
          totalAmount: number;
          totalExecutionTime: number;
          executionTimes: number[];
          errorCount: number;
          lastExecuted: Date | null;
        }>();

        // Initialize map with all rules
        rules.forEach(rule => {
          ruleMetricsMap.set(rule.id, {
            ruleId: rule.id,
            ruleName: rule.name,
            executionCount: 0,
            successfulCount: 0,
            failedCount: 0,
            totalAmount: 0,
            totalExecutionTime: 0,
            executionTimes: [],
            errorCount: 0,
            lastExecuted: null
          });
        });

        // Process execution logs
        executionLogs.forEach(log => {
          const metrics = ruleMetricsMap.get(log.ruleId);
          if (metrics) {
            metrics.executionCount++;
            if (log.status === 'success') {
              metrics.successfulCount++;
              metrics.totalAmount += log.amount || 0;
            } else {
              metrics.failedCount++;
              metrics.errorCount++;
            }
            
            // Extract execution time from metadata if available
            if (log.metadata && typeof log.metadata === 'object' && 'executionTime' in log.metadata) {
              const execTime = Number(log.metadata.executionTime);
              if (!isNaN(execTime) && execTime > 0) {
                metrics.executionTimes.push(execTime);
                metrics.totalExecutionTime += execTime;
              }
            }

            if (!metrics.lastExecuted || log.executedAt > metrics.lastExecuted) {
              metrics.lastExecuted = log.executedAt;
            }
          }
        });

        // Process execution summaries
        executionSummaries.forEach(summary => {
          if (summary.ruleId) {
            const metrics = ruleMetricsMap.get(summary.ruleId);
            if (metrics) {
              metrics.executionCount += summary.totalExecutions;
              metrics.successfulCount += summary.successfulExecutions;
              metrics.failedCount += summary.failedExecutions;
              metrics.totalAmount += summary.totalAmount || 0;
              metrics.errorCount += summary.failedExecutions;
              
              if (summary.executionTime > 0) {
                metrics.executionTimes.push(summary.executionTime);
                metrics.totalExecutionTime += summary.executionTime;
              }
            }
          }
        });

        // Convert to performance metrics format
        const rulePerformanceMetrics = Array.from(ruleMetricsMap.values())
          .filter(m => m.executionCount > 0)
          .map(metrics => {
            const avgExecutionTime = metrics.executionTimes.length > 0
              ? metrics.executionTimes.reduce((sum, t) => sum + t, 0) / metrics.executionTimes.length
              : metrics.totalExecutionTime / metrics.executionCount;

            const successRate = metrics.executionCount > 0
              ? (metrics.successfulCount / metrics.executionCount) * 100
              : 0;

            // Calculate performance score (0-100)
            // Based on: success rate (50%), execution time (30%), execution count (20%)
            const timeScore = avgExecutionTime < 50 ? 100 : avgExecutionTime < 100 ? 80 : avgExecutionTime < 200 ? 60 : 40;
            const successScore = successRate;
            const volumeScore = Math.min(100, (metrics.executionCount / 1000) * 100);
            
            const performanceScore = Math.round(
              (successScore * 0.5) + (timeScore * 0.3) + (volumeScore * 0.2)
            );

            return {
              ruleId: metrics.ruleId,
              ruleName: metrics.ruleName,
              executionCount: metrics.executionCount,
              averageExecutionTime: Math.round(avgExecutionTime * 10) / 10,
              totalAmountPaid: Math.round(metrics.totalAmount * 100) / 100,
              successRate: Math.round(successRate * 10) / 10,
              lastExecuted: metrics.lastExecuted?.toISOString() || new Date().toISOString(),
              errorCount: metrics.errorCount,
              performanceScore: Math.min(100, Math.max(0, performanceScore))
            };
          });

        // Sort and categorize rules
        const topPerformingRules = [...rulePerformanceMetrics]
          .sort((a, b) => b.performanceScore - a.performanceScore)
          .slice(0, 10);

        const slowRules = [...rulePerformanceMetrics]
          .filter(r => r.averageExecutionTime > 100)
          .sort((a, b) => b.averageExecutionTime - a.averageExecutionTime)
          .slice(0, 10);

        const errorRules = [...rulePerformanceMetrics]
          .filter(r => r.errorCount > 0 && r.successRate < 95)
          .sort((a, b) => b.errorCount - a.errorCount)
          .slice(0, 10);

        // Calculate execution trends (daily)
        const trendsMap = new Map<string, { executions: number; errors: number; totalTime: number; count: number }>();
        
        executionLogs.forEach(log => {
          const date = log.executedAt.toISOString().split('T')[0];
          const trend = trendsMap.get(date) || { executions: 0, errors: 0, totalTime: 0, count: 0 };
          trend.executions++;
          if (log.status === 'failed') {
            trend.errors++;
          }
          
          if (log.metadata && typeof log.metadata === 'object' && 'executionTime' in log.metadata) {
            const execTime = Number(log.metadata.executionTime);
            if (!isNaN(execTime) && execTime > 0) {
              trend.totalTime += execTime;
              trend.count++;
            }
          }
          
          trendsMap.set(date, trend);
        });

        const executionTrends = Array.from(trendsMap.entries())
          .map(([date, trend]) => ({
            date,
            executions: trend.executions,
            errors: trend.errors,
            averageTime: trend.count > 0 ? Math.round((trend.totalTime / trend.count) * 10) / 10 : 0
          }))
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(-30); // Last 30 days

        const performanceData = {
          totalExecutions,
          averageExecutionTime: Math.round(averageExecutionTime * 10) / 10,
          totalAmountPaid: Math.round(totalAmountPaid * 100) / 100,
          successRate: Math.round(successRate * 10) / 10,
          topPerformingRules,
          slowRules,
          errorRules,
          executionTrends
        };

        const duration = Date.now() - startTime;
        logger.info('Business rules performance data fetched', {
          userId: req.user?.id,
          timeRange,
          totalExecutions,
          duration
        }, request);

        return NextResponse.json({
          success: true,
          data: performanceData
        });
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error('Error fetching business rules performance data', {
          error: error instanceof Error ? error.message : 'Unknown error',
          duration
        }, request);

        return NextResponse.json(
          { success: false, error: 'Failed to fetch performance data' },
          { status: 500 }
        );
      }
    })(request);
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error('Error in business rules performance API', {
      error: errorMessage,
      duration,
      ip: request.headers.get('x-forwarded-for')
    }, request);

    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', message: errorMessage },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch performance data', message: errorMessage },
      { status: 500 }
    );
  }
}

