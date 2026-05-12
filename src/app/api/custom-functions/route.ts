import { NextRequest, NextResponse } from 'next/server';
import { customFunctionEngine, type CustomFunction, type CustomFunctionParameter } from '@/lib/custom-functions';
import { prisma } from '@/lib/database';

// Helper function to transform Prisma result to CustomFunction
function transformToCustomFunction(func: any): CustomFunction {
  return {
    ...func,
    parameters: (func.parameters as any) || [],
    tags: (Array.isArray(func.tags) ? func.tags : []) as string[]
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    // Get functions from database
    const functions = await prisma.customFunction.findMany({
      where: companyId ? {
        OR: [
          { companyId },
          { companyId: null } // System-wide functions
        ]
      } : undefined,
      orderBy: { createdAt: 'desc' }
    });

    // Load functions into engine
    functions.forEach(func => {
      customFunctionEngine.registerFunction(transformToCustomFunction(func));
    });

    return NextResponse.json({
      success: true,
      data: functions
    });
  } catch (error) {
    console.error('Error fetching custom functions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch custom functions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, ...functionData } = body;

    // Validate function
    const validation = customFunctionEngine.validateFunction(functionData as CustomFunction);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.errors
        },
        { status: 400 }
      );
    }

    // Create function in database
    const customFunction = await prisma.customFunction.create({
      data: {
        ...functionData,
        companyId: companyId || null
      }
    });

    // Register with engine
    customFunctionEngine.registerFunction(transformToCustomFunction(customFunction));

    return NextResponse.json({
      success: true,
      data: customFunction
    });
  } catch (error) {
    console.error('Error creating custom function:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create custom function' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Function ID is required' },
        { status: 400 }
      );
    }

    // Get existing function
    const existing = await prisma.customFunction.findUnique({
      where: { id }
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Function not found' },
        { status: 404 }
      );
    }

    // Validate updated function
    const updatedFunction = { ...existing, ...updates };
    const validation = customFunctionEngine.validateFunction(updatedFunction);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.errors
        },
        { status: 400 }
      );
    }

    // Update in database
    const customFunction = await prisma.customFunction.update({
      where: { id },
      data: updates
    });

    // Re-register with engine
    customFunctionEngine.unregisterFunction(id);
    customFunctionEngine.registerFunction(transformToCustomFunction(customFunction));

    return NextResponse.json({
      success: true,
      data: customFunction
    });
  } catch (error) {
    console.error('Error updating custom function:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update custom function' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Function ID is required' },
        { status: 400 }
      );
    }

    // Delete from database
    await prisma.customFunction.delete({
      where: { id }
    });

    // Unregister from engine
    customFunctionEngine.unregisterFunction(id);

    return NextResponse.json({
      success: true,
      message: 'Custom function deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting custom function:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete custom function' },
      { status: 500 }
    );
  }
}