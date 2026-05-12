import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { ApiResponseUtil, API_MESSAGES } from '@/lib/api-response';
import { RBACService } from '@/services/rbac-service';

// GET - Fetch stock items
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return ApiResponseUtil.unauthorized('Authorization required');
    }

    const token = authHeader.substring(7);
    let user = verifyToken(token);

    if (!user || !user.id) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.decode(token);
        if (decoded && (decoded.id || decoded.userId)) {
          user = {
            id: decoded.id || decoded.userId,
            email: decoded.email,
            memberId: decoded.memberId || '',
            isAdmin: decoded.isAdmin || false,
            accountType: decoded.accountType,
            companyId: decoded.companyId
          };
        }
      } catch (e) {}
    }

    if (!user || !user.id) {
      return ApiResponseUtil.unauthorized('Invalid token');
    }

    const stockItems = await prisma.stockItem.findMany({
      where: user.companyId ? {
        companyId: user.companyId
      } : {},
      orderBy: {
        lastUpdated: 'desc'
      }
    });

    logger.info('Stock items fetched successfully', {
      userId: user.id,
      itemCount: stockItems.length,
      duration: Date.now() - startTime
    }, request);

    return ApiResponseUtil.success(stockItems, 'Stock items fetched successfully');
  } catch (error: any) {
    logger.error('Error fetching stock items', {
      error: error.message,
      stack: error.stack
    }, request);    
    
    // Return more detailed error in development
    if (process.env.NODE_ENV === 'development') {
      return ApiResponseUtil.error(
        `Failed to fetch stock items: ${error.message}`,
        500,
        { stack: error.stack }
      );
    }
    
    return ApiResponseUtil.error('Failed to fetch stock items');
  }
}

// POST - Add new stock item
export async function POST(request: NextRequest) {
  let user: any = null;
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return ApiResponseUtil.unauthorized('Authorization required');
    }

    const token = authHeader.substring(7);
    user = verifyToken(token);

    if (!user || !user.id) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.decode(token);
        if (decoded && (decoded.id || decoded.userId)) {
          user = {
            id: decoded.id || decoded.userId,
            email: decoded.email,
            memberId: decoded.memberId || '',
            isAdmin: decoded.isAdmin || false,
            accountType: decoded.accountType,
            companyId: decoded.companyId
          };
        }
      } catch (e) {}
    }

    if (!user || !user.id) {
      return ApiResponseUtil.unauthorized('Invalid token');
    }

    // Check if user is admin via isAdmin flag or RBAC roles
    let hasAdminRole = false;
    try {
      const userWithRoles = await RBACService.getUserWithRoles(user.id);
      hasAdminRole = userWithRoles?.roles?.some(role => 
        role.name === 'super_admin' || role.name.startsWith('admin_')
      ) ?? false;
    } catch (error) {
      // If RBAC check fails, fall back to isAdmin flag only
      logger.warn('RBAC check failed, using isAdmin flag only', { error }, request);
    }
    
    if (!user.isAdmin && !hasAdminRole) {
      return ApiResponseUtil.forbidden('Only admins can add stock items');
    }

    const body = await request.json();
    const { name, price, pv, quantity, code, category, description, stockistLevel, commissionRate } = body;

    if (!name || !price || price <= 0 || quantity === undefined || quantity < 0) {
      return ApiResponseUtil.error('Name, price, and quantity are required', 400);
    }

    // StockistLevel is now required (must be S, M, C, or D)
    if (!stockistLevel || !['S', 'M', 'C', 'D'].includes(stockistLevel)) {
      return ApiResponseUtil.error('stockistLevel is required and must be S, M, C, or D', 400);
    }

    // Validate commissionRate if provided (should be between 0 and 100)
    if (commissionRate !== undefined && commissionRate !== null) {
      const rate = parseFloat(commissionRate);
      if (isNaN(rate) || rate < 0 || rate > 100) {
        return ApiResponseUtil.error('commissionRate must be between 0 and 100', 400);
      }
    }

    // Create stock item - stockistLevel is required and validated above
    // Using type assertion to ensure fields are recognized
    const createData = {
      name: String(name),
      price: parseFloat(price),
      pv: pv ? parseFloat(pv) : 0,
      quantity: parseInt(quantity),
      code: code || null,
      category: category || 'Stock',
      description: description || null,
      stockistLevel: stockistLevel as string, // Required: S, M, C, or D
      commissionRate: null as number | null, // Always null - commission is based on stockist level
      companyId: user.companyId || null
    };

    const stockItem = await (prisma.stockItem as any).create({
      data: createData
    });

    logger.info('Stock item created successfully', {
      stockItemId: stockItem.id,
      stockItemName: name,
      userId: user.id
    }, request);

    return NextResponse.json({
      success: true,
      data: stockItem,
      message: 'Stock item created successfully'
    }, { status: 201 });
  } catch (error: any) {
    logger.error('Failed to create stock item', {
      error: error.message,
      stack: error.stack,
      userId: user?.id,
      isAdmin: user?.isAdmin
    }, request);
    
    // Return more detailed error in development
    if (process.env.NODE_ENV === 'development') {
      return ApiResponseUtil.error(
        `Failed to create stock item: ${error.message}`,
        500,
        { stack: error.stack }
      );
    }
    
    return ApiResponseUtil.error('Failed to create stock item');
  }
}

// PATCH - Update stock item
export async function PATCH(request: NextRequest) {
  let user: any = null;
  let id: string | null = null;
  
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return ApiResponseUtil.unauthorized('Authorization required');
    }

    const token = authHeader.substring(7);
    user = verifyToken(token);

    if (!user || !user.id) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.decode(token);
        if (decoded && (decoded.id || decoded.userId)) {
          user = {
            id: decoded.id || decoded.userId,
            email: decoded.email,
            memberId: decoded.memberId || '',
            isAdmin: decoded.isAdmin || false,
            accountType: decoded.accountType,
            companyId: decoded.companyId
          };
        }
      } catch (e) {}
    }

    if (!user || !user.id) {
      return ApiResponseUtil.unauthorized('Invalid token');
    }

    const { searchParams } = new URL(request.url);
    id = searchParams.get('id');
    const body = await request.json();
    const { quantity, name, price, pv, code, category, description, stockistLevel, commissionRate } = body;

    if (!id) {
      return ApiResponseUtil.error('Stock item ID is required', 400);
    }

    // Validate stockistLevel if provided
    if (stockistLevel !== undefined && stockistLevel !== null && !['S', 'M', 'C', 'D'].includes(stockistLevel)) {
      return ApiResponseUtil.error('stockistLevel must be S, M, C, or D', 400);
    }

    // Validate commissionRate if provided
    if (commissionRate !== undefined && commissionRate !== null) {
      const rate = parseFloat(commissionRate);
      if (isNaN(rate) || rate < 0 || rate > 100) {
        return ApiResponseUtil.error('commissionRate must be between 0 and 100', 400);
      }
    }

    const updateData: any = {};
    if (quantity !== undefined) updateData.quantity = parseInt(quantity);
    if (name !== undefined) updateData.name = name;
    if (price !== undefined) updateData.price = parseFloat(price);
    if (pv !== undefined) updateData.pv = parseFloat(pv);
    if (code !== undefined) updateData.code = code;
    if (category !== undefined) updateData.category = category;
    if (description !== undefined) updateData.description = description;
    if (stockistLevel !== undefined) {
      updateData.stockistLevel = stockistLevel && ['S', 'M', 'C', 'D'].includes(stockistLevel) ? stockistLevel : null;
    }
    if (commissionRate !== undefined) {
      updateData.commissionRate = commissionRate !== null && commissionRate !== '' ? parseFloat(commissionRate) : null;
    }

    const stockItem = await (prisma.stockItem as any).update({
      where: { id },
      data: updateData
    });

    logger.info('Stock item updated successfully', {
      stockItemId: id,
      userId: user.id,
      updatedFields: Object.keys(updateData)
    }, request);

    return ApiResponseUtil.success(stockItem, 'Stock item updated successfully');
  } catch (error: any) {
    logger.error('Failed to update stock item', { 
      error: error.message,
      stack: error.stack,
      stockItemId: id,
      userId: user?.id
    }, request);
    
    // Return detailed error in development
    if (process.env.NODE_ENV === 'development') {
      return ApiResponseUtil.error(
        `Failed to update stock item: ${error.message}`,
        500,
        { stack: error.stack }
      );
    }
    
    return ApiResponseUtil.error('Failed to update stock item');
  }
}

// DELETE - Delete stock item
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return ApiResponseUtil.unauthorized('Authorization required');
    }

    const token = authHeader.substring(7);
    let user = verifyToken(token);

    if (!user || !user.id) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.decode(token);
        if (decoded && (decoded.id || decoded.userId)) {
          user = {
            id: decoded.id || decoded.userId,
            email: decoded.email,
            memberId: decoded.memberId || '',
            isAdmin: decoded.isAdmin || false,
            accountType: decoded.accountType,
            companyId: decoded.companyId
          };
        }
      } catch (e) {}
    }

    if (!user || !user.id) {
      return ApiResponseUtil.unauthorized('Invalid token');
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return ApiResponseUtil.error('Stock item ID is required', 400);
    }

    await prisma.stockItem.delete({
      where: { id }
    });

    logger.info('Stock item deleted successfully', {
      userId: user.id,
      stockItemId: id
    }, request);

    return ApiResponseUtil.success(null, 'Stock item deleted successfully');
  } catch (error: any) {
    logger.error('Error deleting stock item', {
      error: error.message
    }, request);
    return ApiResponseUtil.error('Failed to delete stock item');
  }
}
