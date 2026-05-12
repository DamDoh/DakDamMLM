import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireAdmin } from '@/lib/auth-middleware';
import { rateLimit } from '@/lib/rate-limiter';

/**
 * GET /api/rule-templates/[id]
 * Get a specific rule template
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Apply rate limiting - optimized for 100M+ users
    const rateLimitResult = await rateLimit(request, { windowMs: 60 * 1000, maxRequests: 100000 });
    if (!rateLimitResult.success) {
      return rateLimitResult.response!;
    }

    // Authenticate and authorize admin access
    return requireAdmin(async (req) => {
      const template = await prisma.ruleTemplate.findUnique({
        where: { id }
      });

      if (!template) {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 404 }
        );
      }

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
      });
    })(request);
  } catch (error) {
    console.error('Error fetching rule template:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rule template' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/rule-templates/[id]
 * Update a rule template
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, { windowMs: 15 * 60 * 1000, maxRequests: 100000 }); // Optimized for 100M+ users
    if (!rateLimitResult.success) {
      return rateLimitResult.response!;
    }

    // Authenticate and authorize admin access
    return requireAdmin(async (req) => {
      try {
        const body = await request.json();
        const { name, description, category, isDefault, applicableMarkets, isSystemTemplate, rules } = body;

        // Check if template exists
        const existingTemplate = await prisma.ruleTemplate.findUnique({
          where: { id }
        });

        if (!existingTemplate) {
          return NextResponse.json(
            { error: 'Template not found' },
            { status: 404 }
          );
        }

        // If setting as default, unset other defaults in the same category
        if (isDefault && category === existingTemplate.category) {
          await prisma.ruleTemplate.updateMany({
            where: {
              category,
              isDefault: true,
              id: { not: id }
            },
            data: {
              isDefault: false
            }
          });
        }

        // Update the template
        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description || null;
        if (category !== undefined) updateData.category = category;
        if (isDefault !== undefined) updateData.isDefault = isDefault;
        if (applicableMarkets !== undefined) updateData.applicableMarkets = applicableMarkets;
        if (isSystemTemplate !== undefined) updateData.isSystemTemplate = isSystemTemplate;
        if (rules !== undefined) updateData.rules = rules;

        const template = await prisma.ruleTemplate.update({
          where: { id },
          data: updateData
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
        });
      } catch (error) {
        console.error('Error updating template:', error);
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Failed to update template' },
          { status: 500 }
        );
      }
    })(request);
  } catch (error) {
    console.error('Error in PUT handler:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/rule-templates/[id]
 * Delete a rule template
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, { windowMs: 15 * 60 * 1000, maxRequests: 100000 }); // Optimized for 100M+ users
    if (!rateLimitResult.success) {
      return rateLimitResult.response!;
    }

    // Authenticate and authorize admin access
    return requireAdmin(async (req) => {
      try {
        // Check if template exists
        const existingTemplate = await prisma.ruleTemplate.findUnique({
          where: { id }
        });

        if (!existingTemplate) {
          return NextResponse.json(
            { error: 'Template not found' },
            { status: 404 }
          );
        }

        // Delete the template
        await prisma.ruleTemplate.delete({
          where: { id }
        });

        return NextResponse.json({
          success: true,
          message: 'Template deleted successfully'
        });
      } catch (error) {
        console.error('Error deleting template:', error);
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Failed to delete template' },
          { status: 500 }
        );
      }
    })(request);
  } catch (error) {
    console.error('Error in DELETE handler:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

