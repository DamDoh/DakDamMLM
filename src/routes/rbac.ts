import { Router } from 'express';
import { rbacService } from '@/lib/rbac-service';
import { prisma } from '@/lib/database';
import bcrypt from 'bcrypt';

const rbacRouter = Router();

/**
 * RBAC API Routes - Complete Role-Based Access Control Management
 */

// ========================================
// AUTHENTICATION ROUTES
// ========================================

/**
 * POST /api/rbac/auth/login
 * User authentication with optional MFA
 */
rbacRouter.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const clientInfo = {
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      deviceFingerprint: req.body.deviceFingerprint
    };

    const result = await rbacService.authenticate({
      email,
      password,
      ...clientInfo
    });

    if (!result.success) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (result.requiresMFA) {
      return res.json({
        requiresMFA: true,
        user: result.user,
        methods: ['totp', 'sms'] // Available MFA methods
      });
    }

    res.json({
      success: true,
      session: result.session
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

/**
 * POST /api/rbac/auth/mfa/verify
 * MFA verification to complete authentication
 */
rbacRouter.post('/auth/mfa/verify', async (req, res) => {
  try {
    const { userId, code, method } = req.body;

    const result = await rbacService.verifyMFA({
      userId,
      code,
      method,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    if (!result.success) {
      return res.status(401).json({ error: 'MFA verification failed' });
    }

    res.json({
      success: true,
      session: result.session
    });

  } catch (error) {
    console.error('MFA verification error:', error);
    res.status(500).json({ error: 'MFA verification failed' });
  }
});

/**
 * POST /api/rbac/auth/logout
 * Session termination
 */
rbacRouter.post('/auth/logout', async (req, res) => {
  try {
    const sessionId = req.body.sessionId;
    if (sessionId) {
      await rbacService.invalidateSession(sessionId);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

// ========================================
// USER MANAGEMENT ROUTES
// ========================================

/**
 * GET /api/rbac/users
 * List users with filtering and pagination
 */
rbacRouter.get('/users', async (req, res) => {
  try {
    // Check permission
    const permissionCheck = await rbacService.checkPermission({
      userId: req.user?.id,
      action: 'R',
      resource: 'user_data'
    });

    if (!permissionCheck.allowed) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { page = 1, limit = 20, search, role, status } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (search) {
      where.OR = [
        { email: { contains: search } },
        { firstName: { contains: search } },
        { lastName: { contains: search } }
      ];
    }
    if (status) where.isActive = status === 'active';
    if (role) {
      where.roles = {
        some: {
          role: { name: role },
          isActive: true
        }
      };
    }

    const [users, total] = await Promise.all([
      prisma.rBACUser.findMany({
        where,
        include: {
          roles: {
            where: { isActive: true },
            include: {
              role: { select: { id: true, name: true, displayName: true } },
              workspace: { select: { id: true, name: true } }
            }
          }
        },
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.rBACUser.count({ where })
    ]);

    res.json({
      users: users.map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
        accountLocked: user.accountLocked,
        roles: user.roles,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      })),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to retrieve users' });
  }
});

/**
 * POST /api/rbac/users
 * Create new user
 */
rbacRouter.post('/users', async (req, res) => {
  try {
    // Check permission
    const permissionCheck = await rbacService.checkPermission({
      userId: req.user?.id,
      action: 'C',
      resource: 'user_data'
    });

    if (!permissionCheck.allowed) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { email, password, firstName, lastName, roleIds, workspaceId } = req.body;

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.rBACUser.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName
      }
    });

    // Assign roles if specified
    if (roleIds && roleIds.length > 0) {
      for (const roleId of roleIds) {
        await prisma.rBACUserRole.create({
          data: {
            userId: user.id,
            roleId,
            workspaceId,
            assignedBy: req.user.id
          }
        });
      }
    }

    res.status(201).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

/**
 * PUT /api/rbac/users/:id
 * Update user
 */
rbacRouter.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Check permission
    const permissionCheck = await rbacService.checkPermission({
      userId: req.user?.id,
      action: 'U',
      resource: 'user_data',
      resourceId: id
    });

    if (!permissionCheck.allowed) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Hash password if provided
    if (updates.password) {
      updates.passwordHash = await bcrypt.hash(updates.password, 12);
      delete updates.password;
    }

    const user = await prisma.rBACUser.update({
      where: { id },
      data: updates,
      include: {
        roles: {
          where: { isActive: true },
          include: { role: true, workspace: true }
        }
      }
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
        roles: user.roles
      }
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// ========================================
// ROLE MANAGEMENT ROUTES
// ========================================

/**
 * GET /api/rbac/roles
 * List roles with permissions
 */
rbacRouter.get('/roles', async (req, res) => {
  try {
    const permissionCheck = await rbacService.checkPermission({
      userId: req.user?.id,
      action: 'R',
      resource: 'system_settings'
    });

    if (!permissionCheck.allowed) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const roles = await prisma.rBACRole.findMany({
      include: {
        permissions: {
          include: { permission: true }
        },
        _count: {
          select: { users: true }
        }
      },
      orderBy: { level: 'asc' }
    });

    res.json({
      roles: roles.map(role => ({
        id: role.id,
        name: role.name,
        displayName: role.displayName,
        description: role.description,
        level: role.level,
        isSystemRole: role.isSystemRole,
        permissions: role.permissions.map(rp => rp.permission),
        userCount: role._count.users,
        createdAt: role.createdAt
      }))
    });

  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ error: 'Failed to retrieve roles' });
  }
});

/**
 * POST /api/rbac/roles
 * Create new role
 */
rbacRouter.post('/roles', async (req, res) => {
  try {
    const permissionCheck = await rbacService.checkPermission({
      userId: req.user?.id,
      action: 'C',
      resource: 'system_settings'
    });

    if (!permissionCheck.allowed) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { name, displayName, description, level, permissionIds, parentRoleId } = req.body;

    const role = await prisma.rBACRole.create({
      data: {
        name,
        displayName,
        description,
        level,
        parentRoleId,
        createdBy: req.user.id
      }
    });

    // Assign permissions
    if (permissionIds && permissionIds.length > 0) {
      for (const permissionId of permissionIds) {
        await prisma.rBACRolePermission.create({
          data: {
            roleId: role.id,
            permissionId,
            assignedBy: req.user.id
          }
        });
      }
    }

    res.status(201).json({
      success: true,
      role: {
        id: role.id,
        name: role.name,
        displayName: role.displayName,
        level: role.level
      }
    });

  } catch (error) {
    console.error('Create role error:', error);
    res.status(500).json({ error: 'Failed to create role' });
  }
});

// ========================================
// PERMISSION MANAGEMENT ROUTES
// ========================================

/**
 * GET /api/rbac/permissions
 * List all permissions
 */
rbacRouter.get('/permissions', async (req, res) => {
  try {
    const permissions = await prisma.rBACPermission.findMany({
      orderBy: { resource: 'asc' }
    });

    res.json({ permissions });

  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({ error: 'Failed to retrieve permissions' });
  }
});

/**
 * POST /api/rbac/permissions
 * Create new permission
 */
rbacRouter.post('/permissions', async (req, res) => {
  try {
    const permissionCheck = await rbacService.checkPermission({
      userId: req.user?.id,
      action: 'C',
      resource: 'system_settings'
    });

    if (!permissionCheck.allowed) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { name, displayName, description, resource, actions, scope, conditions } = req.body;

    const permission = await prisma.rBACPermission.create({
      data: {
        name,
        displayName,
        description,
        resource,
        actions,
        scope,
        conditions
      }
    });

    res.status(201).json({
      success: true,
      permission
    });

  } catch (error) {
    console.error('Create permission error:', error);
    res.status(500).json({ error: 'Failed to create permission' });
  }
});

// ========================================
// USER-ROLE ASSIGNMENT ROUTES
// ========================================

/**
 * POST /api/rbac/users/:userId/roles
 * Assign role to user
 */
rbacRouter.post('/users/:userId/roles', async (req, res) => {
  try {
    const { userId } = req.params;
    const { roleId, workspaceId, scopeLimitations, expiresAt } = req.body;

    const permissionCheck = await rbacService.checkPermission({
      userId: req.user?.id,
      action: 'U',
      resource: 'user_data',
      resourceId: userId
    });

    if (!permissionCheck.allowed) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const assignment = await prisma.rBACUserRole.create({
      data: {
        userId,
        roleId,
        workspaceId,
        scopeLimitations,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        assignedBy: req.user.id
      },
      include: {
        role: true,
        workspace: true
      }
    });

    res.status(201).json({
      success: true,
      assignment: {
        id: assignment.id,
        role: assignment.role,
        workspace: assignment.workspace,
        scopeLimitations: assignment.scopeLimitations,
        expiresAt: assignment.expiresAt
      }
    });

  } catch (error) {
    console.error('Assign role error:', error);
    res.status(500).json({ error: 'Failed to assign role' });
  }
});

/**
 * DELETE /api/rbac/users/:userId/roles/:assignmentId
 * Remove role from user
 */
rbacRouter.delete('/users/:userId/roles/:assignmentId', async (req, res) => {
  try {
    const { userId, assignmentId } = req.params;

    const permissionCheck = await rbacService.checkPermission({
      userId: req.user?.id,
      action: 'U',
      resource: 'user_data',
      resourceId: userId
    });

    if (!permissionCheck.allowed) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    await prisma.rBACUserRole.update({
      where: { id: assignmentId },
      data: { isActive: false }
    });

    res.json({ success: true });

  } catch (error) {
    console.error('Remove role error:', error);
    res.status(500).json({ error: 'Failed to remove role' });
  }
});

// ========================================
// WORKSPACE MANAGEMENT ROUTES
// ========================================

/**
 * GET /api/rbac/workspaces
 * List workspaces
 */
rbacRouter.get('/workspaces', async (req, res) => {
  try {
    const workspaces = await prisma.rBACWorkspace.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { userRoles: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.json({
      workspaces: workspaces.map(ws => ({
        id: ws.id,
        name: ws.name,
        displayName: ws.displayName,
        description: ws.description,
        module: ws.module,
        resources: ws.resources,
        userCount: ws._count.userRoles,
        createdAt: ws.createdAt
      }))
    });

  } catch (error) {
    console.error('Get workspaces error:', error);
    res.status(500).json({ error: 'Failed to retrieve workspaces' });
  }
});

/**
 * POST /api/rbac/workspaces
 * Create workspace
 */
rbacRouter.post('/workspaces', async (req, res) => {
  try {
    const permissionCheck = await rbacService.checkPermission({
      userId: req.user?.id,
      action: 'C',
      resource: 'system_settings'
    });

    if (!permissionCheck.allowed) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { name, displayName, description, module, resources } = req.body;

    const workspace = await prisma.rBACWorkspace.create({
      data: {
        name,
        displayName,
        description,
        module,
        resources,
        createdBy: req.user.id
      }
    });

    res.status(201).json({
      success: true,
      workspace
    });

  } catch (error) {
    console.error('Create workspace error:', error);
    res.status(500).json({ error: 'Failed to create workspace' });
  }
});

// ========================================
// AUDIT LOG ROUTES
// ========================================

/**
 * GET /api/rbac/audit
 * Query audit logs with filtering
 */
rbacRouter.get('/audit', async (req, res) => {
  try {
    const permissionCheck = await rbacService.checkPermission({
      userId: req.user?.id,
      action: 'R',
      resource: 'security_logs'
    });

    if (!permissionCheck.allowed) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const {
      page = 1,
      limit = 50,
      userId,
      action,
      resource,
      startDate,
      endDate,
      riskLevel
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const where: any = {};

    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (resource) where.resource = resource;
    if (riskLevel) where.riskLevel = riskLevel;
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      prisma.rBACAuditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: Number(limit)
      }),
      prisma.rBACAuditLog.count({ where })
    ]);

    res.json({
      logs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Failed to retrieve audit logs' });
  }
});

// ========================================
// UTILITY ROUTES
// ========================================

/**
 * GET /api/rbac/permissions/check
 * Check specific permission
 */
rbacRouter.post('/permissions/check', async (req, res) => {
  try {
    const { action, resource, resourceId, context } = req.body;

    const result = await rbacService.checkPermission({
      userId: req.user?.id,
      action,
      resource,
      resourceId,
      context
    });

    res.json(result);

  } catch (error) {
    console.error('Permission check error:', error);
    res.status(500).json({ error: 'Permission check failed' });
  }
});

/**
 * GET /api/rbac/profile
 * Get current user profile and permissions
 */
rbacRouter.get('/profile', async (req, res) => {
  try {
    const permissions = await rbacService.getUserPermissions(req.user.id);

    res.json({
      user: req.user,
      permissions
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to retrieve profile' });
  }
});

export default rbacRouter;