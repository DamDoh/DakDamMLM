import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireAdmin } from '@/lib/auth-middleware';
import { rateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { ApiResponseUtil, API_MESSAGES } from '@/lib/api-response';
import { z } from 'zod';

const productSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  price: z.number().positive(),
  pv: z.number().min(0).default(0),
  qty: z.number().int().min(0).default(0),
  category: z.string().min(1),
  imageUrl: z.string().url().optional(),
  isActive: z.boolean().default(true),
  unitType: z.string().default('piece'),
  type: z.string().default('single'),
  originalPrice: z.number().positive().optional(),
  packageItems: z.array(z.any()).optional(),
  rating: z.number().min(0).max(5).optional(),
  companyId: z.string().optional(),
  isGlobalProduct: z.boolean().default(false)
});

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Apply rate limiting - optimized for 100M+ users
    const rateLimitResult = await rateLimit(request, { windowMs: 60 * 1000, maxRequests: 100000 });
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for products API', {
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent')
      }, request);
      return rateLimitResult.response!;
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const companyId = searchParams.get('companyId');
    const isActive = searchParams.get('isActive');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 1000);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Filter by isActive: if explicitly provided, use it; otherwise default to active only
    const activeFilter = isActive !== null ? isActive === 'true' : true;
    
    // Build where clause
    const where: any = {
      isActive: activeFilter
    };
    
    if (category) {
      where.category = category;
    }
    
    if (companyId) {
      where.companyId = companyId;
    }
    // If no companyId, show all products (both global and company-specific)
    
    const products = await prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });

    const total = await prisma.product.count({ where });

    const duration = Date.now() - startTime;
    logger.info('Products fetched', {
      count: products.length,
      category,
      companyId,
      duration
    }, request);

    return ApiResponseUtil.paginated(
      products,
      total,
      limit,
      offset,
      API_MESSAGES.FETCHED
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error('Products fetch error', {
      error: errorMessage,
      stack: errorStack,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      ip: request.headers.get('x-forwarded-for')
    }, request);

    // In development, return more details
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json({
        success: false,
        error: errorMessage,
        stack: errorStack,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0'
        }
      }, { status: 500 });
    }

    return ApiResponseUtil.error(API_MESSAGES.SERVER_ERROR);
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, { windowMs: 15 * 60 * 1000, maxRequests: 100000 }); // Optimized for 100M+ users
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for product creation', {
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent')
      }, request);
      return rateLimitResult.response!;
    }

    // Authenticate and authorize admin access
    const authenticatedRequest = await requireAdmin(async (req) => {
      return NextResponse.json({ user: req.user });
    })(request);

    if (authenticatedRequest.status === 401 || authenticatedRequest.status === 403) {
      return authenticatedRequest;
    }

    const user = (authenticatedRequest as any).user;
    const body = await request.json();

    // Validate product data
    const validatedData = productSchema.parse(body);

    // Check for duplicate product name
    const existingProduct = await prisma.product.findFirst({
      where: {
        name: validatedData.name,
        companyId: validatedData.companyId || null
      }
    });

    if (existingProduct) {
      return NextResponse.json(
        { error: 'Product with this name already exists' },
        { status: 400 }
      );
    }

    // Create product
    const product = await prisma.product.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        price: validatedData.price,
        pv: validatedData.pv,
        qty: validatedData.qty,
        category: validatedData.category,
        imageUrl: validatedData.imageUrl,
        isActive: validatedData.isActive,
        unitType: validatedData.unitType,
        type: validatedData.type,
        originalPrice: validatedData.originalPrice,
        packageItems: validatedData.packageItems || [],
        rating: validatedData.rating,
        companyId: validatedData.companyId,
        isGlobalProduct: validatedData.isGlobalProduct
      }
    });

    logger.info('Product created', {
      userId: user.id,
      productId: product.id,
      productName: product.name,
      duration: Date.now() - startTime
    }, request);

    return ApiResponseUtil.success(product, 'Product created successfully');

  } catch (error) {
    logger.error('Product creation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: request.headers.get('x-forwarded-for')
    }, request);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    return ApiResponseUtil.error(API_MESSAGES.SERVER_ERROR);
  }
}

export async function PUT(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, { windowMs: 15 * 60 * 1000, maxRequests: 100000 }); // Optimized for 100M+ users
    if (!rateLimitResult.success) {
      return rateLimitResult.response!;
    }

    // Authenticate and authorize admin access
    const authenticatedRequest = await requireAdmin(async (req) => {
      return NextResponse.json({ user: req.user });
    })(request);

    if (authenticatedRequest.status === 401 || authenticatedRequest.status === 403) {
      return authenticatedRequest;
    }

    const user = (authenticatedRequest as any).user;
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    // Validate update data
    const validatedData = productSchema.partial().parse(updateData);

    // Check product exists
    const existingProduct = await prisma.product.findUnique({
      where: { id }
    });

    if (!existingProduct) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Update product
    const product = await prisma.product.update({
      where: { id },
      data: validatedData
    });

    logger.info('Product updated', {
      userId: user.id,
      productId: product.id,
      productName: product.name,
      duration: Date.now() - startTime
    }, request);

    return ApiResponseUtil.success(product, 'Product updated successfully');

  } catch (error) {
    logger.error('Product update error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: request.headers.get('x-forwarded-for')
    }, request);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    return ApiResponseUtil.error(API_MESSAGES.SERVER_ERROR);
  }
}

export async function DELETE(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, { windowMs: 15 * 60 * 1000, maxRequests: 100000 }); // Optimized for 100M+ users
    if (!rateLimitResult.success) {
      return rateLimitResult.response!;
    }

    // Authenticate and authorize admin access
    const authenticatedRequest = await requireAdmin(async (req) => {
      return NextResponse.json({ user: req.user });
    })(request);

    if (authenticatedRequest.status === 401 || authenticatedRequest.status === 403) {
      return authenticatedRequest;
    }

    const user = (authenticatedRequest as any).user;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    // Check product exists
    const existingProduct = await prisma.product.findUnique({
      where: { id }
    });

    if (!existingProduct) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Soft delete: mark as inactive instead of hard delete
    const product = await prisma.product.update({
      where: { id },
      data: { isActive: false }
    });

    logger.info('Product deleted (soft)', {
      userId: user.id,
      productId: product.id,
      productName: product.name,
      duration: Date.now() - startTime
    }, request);

    return ApiResponseUtil.success(
      { id: product.id },
      'Product deleted successfully'
    );

  } catch (error) {
    logger.error('Product deletion error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: request.headers.get('x-forwarded-for')
    }, request);

    return ApiResponseUtil.error(API_MESSAGES.SERVER_ERROR);
  }
}