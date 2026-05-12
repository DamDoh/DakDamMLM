import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { ruleConflictDetector } from '@/lib/rule-conflict-detector';
import { requireAdmin } from '@/lib/auth-middleware';
import { rateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { ApiResponseUtil, VALIDATION_PATTERNS, API_MESSAGES } from '@/lib/api-response';
import { validateBusinessRuleEnhanced } from '@/lib/business-rule-validator';
import type { BusinessRule } from '@/lib/types';

/**
 * GET /api/business-rules
 * Get all business rules with optional filtering (Admin only)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Apply rate limiting for business rules access
    const rateLimitResult = await rateLimit(request, { windowMs: 15 * 60 * 1000, maxRequests: 100000 }); // Optimized for 100M+ users
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for business rules API', {
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent')
      }, request);
      return rateLimitResult.response!;
    }

    // Authenticate and authorize admin access - wrap the handler
    return requireAdmin(async (req) => {
      const { searchParams } = new URL(request.url);
      const category = searchParams.get('category');
      const type = searchParams.get('type');
      const isActive = searchParams.get('isActive');
      const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200); // Max 200 records
      const offset = parseInt(searchParams.get('offset') || '0');

      // Validate query parameters using standardized patterns
      const validationErrors = ApiResponseUtil.validateQueryParams(
        {
          category: category || undefined,
          type: type || undefined
        },
        {
          category: VALIDATION_PATTERNS.ruleCategories,
          type: VALIDATION_PATTERNS.ruleTypes
        }
      );

      if (validationErrors.length > 0) {
        return ApiResponseUtil.validationError(validationErrors);
      }

      const where: any = {};

      if (category) where.category = category;
      if (type) where.type = type;
      if (isActive !== null) where.isActive = isActive === 'true';

      const rules = await prisma.businessRule.findMany({
        where,
        orderBy: { priority: 'asc' },
        take: limit,
        skip: offset,
      });

      const total = await prisma.businessRule.count({ where });

      const duration = Date.now() - startTime;
      logger.info('Business rules fetched successfully', {
        userId: req.user?.id,
        count: rules.length,
        category,
        type,
        isActive,
        duration
      }, request);

      return ApiResponseUtil.paginated(
        rules,
        total,
        limit,
        offset,
        API_MESSAGES.FETCHED
      );
    })(request);
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error fetching business rules', {
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
      ip: request.headers.get('x-forwarded-for')
    }, request);

    if (error instanceof Error && error.message.includes('Authentication')) {
      return ApiResponseUtil.unauthorized();
    }

    return ApiResponseUtil.error(API_MESSAGES.SERVER_ERROR);
  }
}

/**
 * POST /api/business-rules
 * Create a new business rule (Admin only)
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Apply rate limiting for business rule creation
    const rateLimitResult = await rateLimit(request, { windowMs: 15 * 60 * 1000, maxRequests: 100000 }); // Optimized for 100M+ users
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for business rule creation', {
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent')
      }, request);
      return rateLimitResult.response!;
    }

    // Authenticate and authorize admin access - wrap the handler
    return requireAdmin(async (req) => {
      const body: Omit<BusinessRule, 'id' | 'createdAt' | 'updatedAt' | 'version'> = await request.json();

      // Validate required fields
      if (!body.name || !body.description || !body.type || !body.category) {
        return NextResponse.json(
          { error: 'Missing required fields: name, description, type, category' },
          { status: 400 }
        );
      }

      // Enhanced validation
      const enhancedValidation = validateBusinessRuleEnhanced(body);
      if (!enhancedValidation.isValid) {
        logger.warn('Business rule validation failed', {
          userId: req.user?.id,
          ruleName: body.name,
          errors: enhancedValidation.errors
        }, request);

        return NextResponse.json(
          {
            success: false,
            error: 'Validation failed',
            details: enhancedValidation.errors,
            warnings: enhancedValidation.warnings
          },
          { status: 400 }
        );
      }

      // Validate with conflict detector
      const validation = ruleConflictDetector.validateRule(body as BusinessRule);
      if (!validation.isValid) {
        logger.warn('Business rule conflict validation failed', {
          userId: req.user?.id,
          ruleName: body.name,
          errors: validation.errors
        }, request);

        return NextResponse.json(
          {
            success: false,
            error: 'Validation failed',
            details: validation.errors
          },
          { status: 400 }
        );
      }

      // Check for conflicts with new rule
      const conflicts = ruleConflictDetector.analyzeConflicts();

      if (conflicts.some(c => c.severity === 'high')) {
        logger.warn('High severity conflicts detected for new business rule', {
          userId: req.user?.id,
          ruleName: body.name,
          conflicts: conflicts.filter(c => c.severity === 'high')
        }, request);

        return NextResponse.json(
          {
            success: false,
            error: 'High severity conflicts detected',
            conflicts: conflicts.filter(c => c.severity === 'high')
          },
          { status: 409 }
        );
      }

      // Create the rule with proper data handling
      const ruleData: any = {
        name: body.name,
        description: body.description,
        type: body.type,
        category: body.category,
        priority: body.priority || 0,
        isActive: body.isActive !== false, // Default to true
        conditions: body.conditions || [],
        calculation: body.calculation && Object.keys(body.calculation).length > 0 ? body.calculation : {},
        applicableTo: body.applicableTo || ['distributor'],
        frequency: body.frequency || 'monthly',
        payoutTiming: body.payoutTiming || 'end_of_period',
        version: 1,
        createdBy: req.user?.id || 'system', // Required field
        tags: body.tags || [],
        metadata: body.metadata || {}
      };

      // Only add companyId if it exists and is not null/undefined
      if (body.companyId) {
        ruleData.companyId = body.companyId;
      }

      const rule = await prisma.businessRule.create({
        data: ruleData
      });

      // Log the creation with actual user info
      await prisma.ruleValidationLog.create({
        data: {
          ruleId: rule.id,
          action: 'create',
          isValid: true,
          errors: [],
          warnings: validation.warnings,
          suggestions: validation.suggestions,
          validatedAt: new Date(),
          validatedBy: req.user?.id || 'system'
        }
      });

      const duration = Date.now() - startTime;
      logger.info('Business rule created successfully', {
        userId: req.user?.id,
        ruleId: rule.id,
        ruleName: rule.name,
        duration
      }, request);

      return ApiResponseUtil.success(
        rule,
        API_MESSAGES.BUSINESS_RULE_CREATED
      );
    })(request);
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error('Error creating business rule', {
      error: errorMessage,
      duration,
      ip: request.headers.get('x-forwarded-for'),
      stack: error instanceof Error ? error.stack : undefined
    }, request);

    if (error instanceof Error && error.message.includes('Authentication')) {
      return ApiResponseUtil.unauthorized();
    }

    // Return more detailed error information
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create business rule',
        message: errorMessage,
        details: error instanceof Error ? [errorMessage] : ['Unknown error occurred']
      },
      { status: 500 }
    );
  }
}