// Feature Flag API Routes
// REST API endpoints for feature flag management

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { featureFlagService, FeatureFlag } from '@/services/feature-flag-service';
import { z } from 'zod';
import {
  withErrorHandler,
  withRateLimit,
  AuthenticationError,
  AuthorizationError,
  ValidationError
} from '@/lib/api-error-handler';

// Validation schemas
const createFlagSchema = z.object({
  name: z.string().min(1).max(100),
  key: z.string().regex(/^[a-zA-Z0-9_-]+$/).min(1).max(50),
  description: z.string().optional(),
  enabled: z.boolean().default(false),
  rolloutPercentage: z.number().min(0).max(100).default(0),
  rules: z.array(z.object({
    type: z.enum(['user', 'company', 'percentage', 'environment', 'custom']),
    condition: z.any(),
    value: z.boolean().default(true),
  })).default([]),
  variants: z.array(z.object({
    name: z.string().min(1),
    percentage: z.number().min(0).max(100),
    config: z.record(z.any()).optional(),
  })).optional(),
});

const updateFlagSchema = createFlagSchema.partial().omit({ key: true });

// GET /api/feature-flags - Get all feature flags
const getAllFlagsHandler = async (request: NextRequest) => {
  const session = await getServerSession();
  if (!session?.user?.id) {
    throw new AuthenticationError();
  }

  // TODO: Check if user is admin
  // if (!await isAdmin(session.user.id)) {
  //   throw new AuthorizationError();
  // }

  const flags = await featureFlagService.getAllFlags();
  return Response.json({ flags });
};

// GET /api/feature-flags/[key] - Get specific feature flag
const getFlagHandler = async (
  request: NextRequest,
  { params }: { params: { key: string } }
) => {
  const session = await getServerSession();
  if (!session?.user?.id) {
    throw new AuthenticationError();
  }

  // TODO: Check permissions

  const flags = await featureFlagService.getAllFlags();
  const flag = flags.find(f => f.key === params.key);

  if (!flag) {
    throw new ValidationError('Feature flag not found');
  }

  return Response.json({ flag });
};

// POST /api/feature-flags - Create new feature flag
const createFlagHandler = async (request: NextRequest) => {
  const session = await getServerSession();
  if (!session?.user?.id) {
    throw new AuthenticationError();
  }

  // TODO: Check if user is admin
  // if (!await isAdmin(session.user.id)) {
  //   throw new AuthorizationError();
  // }

  const validatedData = (request as any).validatedData;

  const flag = await featureFlagService.upsertFlag(validatedData, session.user.id);

  return Response.json({ flag }, { status: 201 });
};

// PUT /api/feature-flags/[key] - Update feature flag
const updateFlagHandler = async (
  request: NextRequest,
  { params }: { params: { key: string } }
) => {
  const session = await getServerSession();
  if (!session?.user?.id) {
    throw new AuthenticationError();
  }

  // TODO: Check if user is admin

  const validatedData = (request as any).validatedData;

  const flag = await featureFlagService.upsertFlag({
    ...validatedData,
    key: params.key,
  }, session.user.id);

  return Response.json({ flag });
};

// DELETE /api/feature-flags/[key] - Delete feature flag
const deleteFlagHandler = async (
  request: NextRequest,
  { params }: { params: { key: string } }
) => {
  const session = await getServerSession();
  if (!session?.user?.id) {
    throw new AuthenticationError();
  }

  // TODO: Check if user is admin

  await featureFlagService.deleteFlag(params.key, session.user.id);

  return Response.json({ success: true });
};

// GET /api/feature-flags/[key]/stats - Get flag statistics
const getFlagStatsHandler = async (
  request: NextRequest,
  { params }: { params: { key: string } }
) => {
  const session = await getServerSession();
  if (!session?.user?.id) {
    throw new AuthenticationError();
  }

  // TODO: Check permissions

  const stats = await featureFlagService.getFlagStats(params.key);

  return Response.json({ stats });
};

// POST /api/feature-flags/evaluate - Evaluate feature flags for context
const evaluateFlagsHandler = async (request: NextRequest) => {
  const session = await getServerSession();
  if (!session?.user?.id) {
    throw new AuthenticationError();
  }

  const body = await request.json();
  const { flags, context } = body;

  if (!Array.isArray(flags)) {
    throw new ValidationError('Flags must be an array');
  }

  const results: Record<string, any> = {};

  for (const flagKey of flags) {
    const isEnabled = await featureFlagService.isEnabled(flagKey, context);
    const variant = await featureFlagService.getVariant(flagKey, context);
    const config = await featureFlagService.getFeatureConfig(flagKey, context);

    results[flagKey] = {
      enabled: isEnabled,
      variant,
      config,
    };
  }

  return Response.json({ results });
};

// Apply middleware
export const GET = withErrorHandler(
  withRateLimit({ windowMs: 60000, maxRequests: 100 })(
    async (request: NextRequest) => {
      const url = new URL(request.url);

      if (url.pathname.includes('/stats/')) {
        const key = url.pathname.split('/stats/')[1];
        return getFlagStatsHandler(request, { params: { key } });
      } else if (url.pathname.match(/\/feature-flags\/[^\/]+$/)) {
        const key = url.pathname.split('/feature-flags/')[1];
        return getFlagHandler(request, { params: { key } });
      } else {
        return getAllFlagsHandler(request);
      }
    }
  )
);

export const POST = withErrorHandler(
  withRateLimit({ windowMs: 60000, maxRequests: 30 })(
    async (request: NextRequest) => {
      const url = new URL(request.url);

      if (url.pathname.includes('/evaluate')) {
        return evaluateFlagsHandler(request);
      } else {
        return withRateLimit({ windowMs: 60000, maxRequests: 20 })(
          validateRequest(createFlagSchema)(
            createFlagHandler
          )
        )(request);
      }
    }
  )
);

export const PUT = withErrorHandler(
  withRateLimit({ windowMs: 60000, maxRequests: 30 })(
    async (request: NextRequest) => {
      const url = new URL(request.url);
      const key = url.pathname.split('/feature-flags/')[1];

      return validateRequest(updateFlagSchema)(
        async (req) => updateFlagHandler(req, { params: { key } })
      )(request);
    }
  )
);

export const DELETE = withErrorHandler(
  withRateLimit({ windowMs: 60000, maxRequests: 20 })(
    async (request: NextRequest) => {
      const url = new URL(request.url);
      const key = url.pathname.split('/feature-flags/')[1];

      return deleteFlagHandler(request, { params: { key } });
    }
  )
);