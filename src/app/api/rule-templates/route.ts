import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireAdmin } from '@/lib/auth-middleware';
import { rateLimit } from '@/lib/rate-limiter';

/**
 * GET /api/rule-templates
 * Get all rule templates
 */
export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting - optimized for 100M+ users
    const rateLimitResult = await rateLimit(request, { windowMs: 60 * 1000, maxRequests: 100000 });
    if (!rateLimitResult.success) {
      return rateLimitResult.response!;
    }

    // Authenticate and authorize admin access
    return requireAdmin(async (req) => {
      const { searchParams } = new URL(request.url);
      const category = searchParams.get('category');
      const isSystemTemplate = searchParams.get('isSystemTemplate');

      const where: any = {};
      if (category) {
        where.category = category;
      }
      if (isSystemTemplate !== null) {
        where.isSystemTemplate = isSystemTemplate === 'true';
      }

      const templates = await prisma.ruleTemplate.findMany({
        where,
        orderBy: {
          createdAt: 'desc'
        }
      });

      // Transform the data to match the RuleTemplate interface
      const transformedTemplates = templates.map(template => ({
        id: template.id,
        name: template.name,
        description: template.description || '',
        category: template.category,
        isDefault: template.isDefault,
        applicableMarkets: (template.applicableMarkets as any) || [],
        companyId: template.companyId || undefined,
        isSystemTemplate: template.isSystemTemplate || false,
        createdAt: template.createdAt.toISOString(),
        updatedAt: template.updatedAt.toISOString(),
        rules: (template.rules as any) || []
      }));

      return NextResponse.json({
        success: true,
        data: transformedTemplates
      });
    })(request);
  } catch (error) {
    console.error('Error fetching rule templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rule templates' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/rule-templates
 * Create a new rule template
 */
export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, { windowMs: 15 * 60 * 1000, maxRequests: 100000 }); // Optimized for 100M+ users
    if (!rateLimitResult.success) {
      return rateLimitResult.response!;
    }

    // Authenticate and authorize admin access
    return requireAdmin(async (req) => {
      const body = await request.json();
      const { name, description, category, isDefault, applicableMarkets, isSystemTemplate, rules } = body;

      // Validate required fields
      if (!name || !category) {
        return NextResponse.json(
          { error: 'Name and category are required' },
          { status: 400 }
        );
      }

      if (!rules || !Array.isArray(rules) || rules.length === 0) {
        return NextResponse.json(
          { error: 'At least one rule must be included in the template' },
          { status: 400 }
        );
      }

      // If setting as default, unset other defaults in the same category
      if (isDefault) {
        await prisma.ruleTemplate.updateMany({
          where: {
            category,
            isDefault: true
          },
          data: {
            isDefault: false
          }
        });
      }

      // Create the template
      const template = await prisma.ruleTemplate.create({
        data: {
          name,
          description: description || null,
          category,
          isDefault: isDefault || false,
          applicableMarkets: applicableMarkets || [],
          isSystemTemplate: isSystemTemplate || false,
          companyId: null, // Can be set later for company-specific templates
          rules: rules
        }
      });

      // Transform the response
      const transformedTemplate = {
        id: template.id,
        name: template.name,
        description: template.description || '',
        category: template.category,
        isDefault: template.isDefault,
        applicableMarkets: (template.applicableMarkets as any) || [],
        companyId: template.companyId || undefined,
        isSystemTemplate: template.isSystemTemplate || false,
        createdAt: template.createdAt.toISOString(),
        updatedAt: template.updatedAt.toISOString(),
        rules: (template.rules as any) || []
      };

      return NextResponse.json({
        success: true,
        data: transformedTemplate
      }, { status: 201 });
    })(request);
  } catch (error) {
    console.error('Error creating rule template:', error);
    return NextResponse.json(
      { error: 'Failed to create rule template' },
      { status: 500 }
    );
  }
}

