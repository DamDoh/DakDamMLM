import { prisma } from '@/lib/prisma';

export interface RoleData {
  id: string;
  name: string;
  description?: string;
  companyId?: string;
  isSystem: boolean;
  isActive: boolean;
  permissions: PermissionData[];
}

export interface PermissionData {
  id: string;
  name: string;
  resource: string;
  action: string;
  description?: string;
}

export interface UserWithRoles {
  id: string;
  roles: RoleData[];
  permissions: PermissionData[];
}

export interface AdminScope {
  id: string;
  entityType: 'S' | 'M' | 'C' | 'D';
  entityId: string;
  entityName?: string;
}

export interface UserWithRolesAndScope extends UserWithRoles {
  adminScopes?: AdminScope[];
}

export class RBACService {
  /**
   * System roles that are created by default
   */
  private static readonly SYSTEM_ROLES = [
    {
      name: 'super_admin',
      description: 'Full system access',
      permissions: ['*'] // All permissions
    },
    {
      name: 'admin_d',
      description: 'Dealer-level administration - manages Centers, Mobiles, and Small Mobiles',
      permissions: [
        'user:read', 'user:update', 'user:create',
        'product:read', 'product:update',
        'order:read', 'order:update',
        'commission:read', 'commission:update',
        'stock:read', 'stock:update',
        'report:read', 'report:generate',
        'admin:manage', // Can manage lower-level admins
        'center:read', 'center:create', 'center:update',
        'mobile:read', 'mobile:create', 'mobile:update',
        'small_mobile:read', 'small_mobile:create', 'small_mobile:update'
      ]
    },
    {
      name: 'admin_c',
      description: 'Center-level administration - manages Mobiles and Small Mobiles',
      permissions: [
        'user:read', 'user:update',
        'product:read',
        'order:read', 'order:update',
        'commission:read',
        'stock:read', 'stock:update',
        'report:read',
        'admin:manage', // Can manage lower-level admins
        'mobile:read', 'mobile:create', 'mobile:update',
        'small_mobile:read', 'small_mobile:create', 'small_mobile:update'
      ]
    },
    {
      name: 'admin_m',
      description: 'Mobile-level administration - manages Small Mobiles',
      permissions: [
        'user:read', 'user:update',
        'product:read',
        'order:read', 'order:update',
        'commission:read',
        'stock:read', 'stock:update',
        'report:read',
        'admin:manage', // Can manage lower-level admins
        'small_mobile:read', 'small_mobile:create', 'small_mobile:update'
      ]
    },
    {
      name: 'admin_s',
      description: 'Small Mobile-level administration - manages users within Small Mobile scope',
      permissions: [
        'user:read', 'user:update',
        'product:read',
        'order:read', 'order:update',
        'commission:read',
        'stock:read',
        'report:read'
      ]
    },
    {
      name: 'company_admin',
      description: 'Company-level administration',
      permissions: [
        'user:read', 'user:update',
        'product:create', 'product:read', 'product:update', 'product:delete',
        'order:read', 'order:update',
        'commission:read', 'commission:update',
        'stock:read', 'stock:update',
        'report:read'
      ]
    },
    {
      name: 'stockist',
      description: 'Stock management and sales',
      permissions: [
        'product:read',
        'order:create', 'order:read', 'order:update',
        'stock:read', 'stock:update',
        'user:read'
      ]
    },
    {
      name: 'distributor',
      description: 'Basic member access',
      permissions: [
        'user:read',
        'product:read',
        'order:create', 'order:read',
        'commission:read',
        'profile:update'
      ]
    },
    {
      name: 'member',
      description: 'Basic member access',
      permissions: [
        'user:read',
        'product:read',
        'order:create', 'order:read',
        'commission:read',
        'profile:update'
      ]
    }
  ];

  /**
   * Initialize system roles and permissions
   */
  static async initializeSystemRoles(): Promise<void> {
    for (const roleData of this.SYSTEM_ROLES) {
      // Create or update role
      const role = await prisma.role.upsert({
        where: { name: roleData.name },
        update: {
          description: roleData.description,
          isSystem: true,
          isActive: true
        },
        create: {
          name: roleData.name,
          description: roleData.description,
          isSystem: true,
          isActive: true
        }
      });

      // Create permissions for this role
      for (const permissionName of roleData.permissions) {
        if (permissionName === '*') {
          // Super admin has all permissions - we'll handle this in the check
          continue;
        }

        const [resource, action] = permissionName.split(':');
        const permission = await prisma.permission.upsert({
          where: { name: permissionName },
          update: {
            description: `${action} ${resource}`,
            resource,
            action,
            isSystem: true
          },
          create: {
            name: permissionName,
            description: `${action} ${resource}`,
            resource,
            action,
            isSystem: true
          }
        });

        // Link permission to role
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id
            }
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: permission.id
          }
        });
      }
    }
  }

  /**
   * Get user with roles and permissions
   */
  static async getUserWithRoles(userId: string): Promise<UserWithRoles | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!user) return null;

    const roles: RoleData[] = [];
    const permissions: PermissionData[] = [];
    const permissionSet = new Set<string>();

    for (const userRole of user.roles) {
      const role = userRole.role;
      roles.push({
        id: role.id,
        name: role.name,
        description: role.description || undefined,
        companyId: role.companyId || undefined,
        isSystem: role.isSystem,
        isActive: role.isActive,
        permissions: role.permissions.map(rp => ({
          id: rp.permission.id,
          name: rp.permission.name,
          resource: rp.permission.resource,
          action: rp.permission.action,
          description: rp.permission.description || undefined
        }))
      });

      // Collect unique permissions
      for (const rp of role.permissions) {
        if (!permissionSet.has(rp.permission.name)) {
          permissionSet.add(rp.permission.name);
          permissions.push({
            id: rp.permission.id,
            name: rp.permission.name,
            resource: rp.permission.resource,
            action: rp.permission.action,
            description: rp.permission.description || undefined
          });
        }
      }
    }

    return {
      id: user.id,
      roles,
      permissions
    };
  }

  /**
   * Get user with roles, permissions, and admin scopes
   */
  static async getUserWithRolesAndScope(userId: string): Promise<UserWithRolesAndScope | null> {
    const userWithRoles = await this.getUserWithRoles(userId);
    if (!userWithRoles) return null;

    // Check if user has any admin role
    const hasAdminRole = userWithRoles.roles.some(role => 
      ['super_admin', 'admin_d', 'admin_c', 'admin_m', 'admin_s'].includes(role.name)
    );

    if (!hasAdminRole) {
      return { ...userWithRoles, adminScopes: [] };
    }

    // Fetch admin scopes
    const scopes = await (prisma as any).adminEntityScope.findMany({
      where: {
        adminId: userId,
        isActive: true
      }
    });

    const adminScopes: AdminScope[] = [];
    for (const scope of scopes) {
      let entityName: string | undefined;
      
      // Fetch entity name based on type
      switch (scope.entityType) {
        case 'S':
          const smallMobile = await (prisma as any).smallMobile.findUnique({
            where: { id: scope.entityId },
            select: { name: true }
          });
          entityName = smallMobile?.name;
          break;
        case 'M':
          const mobile = await (prisma as any).mobile.findUnique({
            where: { id: scope.entityId },
            select: { name: true }
          });
          entityName = mobile?.name;
          break;
        case 'C':
          const center = await (prisma as any).center.findUnique({
            where: { id: scope.entityId },
            select: { name: true }
          });
          entityName = center?.name;
          break;
        case 'D':
          const dealer = await (prisma as any).dealer.findUnique({
            where: { id: scope.entityId },
            select: { name: true }
          });
          entityName = dealer?.name;
          break;
      }

      adminScopes.push({
        id: scope.id,
        entityType: scope.entityType as 'S' | 'M' | 'C' | 'D',
        entityId: scope.entityId,
        entityName
      });
    }

    return {
      ...userWithRoles,
      adminScopes
    };
  }

  /**
   * Check if user has permission
   */
  static async hasPermission(
    userId: string,
    resource: string,
    action: string
  ): Promise<boolean> {
    const userWithRoles = await this.getUserWithRoles(userId);

    if (!userWithRoles) return false;

    // Check if user is super admin (has all permissions)
    if (userWithRoles.roles.some(role => role.name === 'super_admin')) {
      return true;
    }

    // Check specific permission
    const permissionName = `${resource}:${action}`;
    return userWithRoles.permissions.some(perm => perm.name === permissionName);
  }

  /**
   * Get admin scopes for a user
   */
  static async getAdminScopes(userId: string): Promise<AdminScope[]> {
    const scopes = await (prisma as any).adminEntityScope.findMany({
      where: {
        adminId: userId,
        isActive: true
      }
    });

    const adminScopes: AdminScope[] = [];
    for (const scope of scopes) {
      let entityName: string | undefined;
      
      switch (scope.entityType) {
        case 'S':
          const smallMobile = await (prisma as any).smallMobile.findUnique({
            where: { id: scope.entityId },
            select: { name: true }
          });
          entityName = smallMobile?.name;
          break;
        case 'M':
          const mobile = await (prisma as any).mobile.findUnique({
            where: { id: scope.entityId },
            select: { name: true }
          });
          entityName = mobile?.name;
          break;
        case 'C':
          const center = await (prisma as any).center.findUnique({
            where: { id: scope.entityId },
            select: { name: true }
          });
          entityName = center?.name;
          break;
        case 'D':
          const dealer = await (prisma as any).dealer.findUnique({
            where: { id: scope.entityId },
            select: { name: true }
          });
          entityName = dealer?.name;
          break;
      }

      adminScopes.push({
        id: scope.id,
        entityType: scope.entityType as 'S' | 'M' | 'C' | 'D',
        entityId: scope.entityId,
        entityName
      });
    }

    return adminScopes;
  }

  /**
   * Check if admin has access to a specific entity
   */
  static async hasEntityAccess(
    userId: string,
    entityType: 'S' | 'M' | 'C' | 'D',
    entityId: string
  ): Promise<boolean> {
    const userWithRoles = await this.getUserWithRoles(userId);
    if (!userWithRoles) return false;

    // Super admin has access to everything
    if (userWithRoles.roles.some(role => role.name === 'super_admin')) {
      return true;
    }

    // Check if user has admin role
    const hasAdminRole = userWithRoles.roles.some(role => 
      ['admin_d', 'admin_c', 'admin_m', 'admin_s'].includes(role.name)
    );

    if (!hasAdminRole) return false;

    // Get admin scopes
    const scopes = await this.getAdminScopes(userId);

    // Check direct access
    const hasDirectAccess = scopes.some(
      scope => scope.entityType === entityType && scope.entityId === entityId
    );

    if (hasDirectAccess) return true;

    // Check hierarchical access (e.g., if admin manages a Dealer, they can access all Centers, Mobiles, SmallMobiles under it)
    const userRole = userWithRoles.roles.find(role => 
      ['admin_d', 'admin_c', 'admin_m', 'admin_s'].includes(role.name)
    );

    if (!userRole) return false;

    // For hierarchical checks, we need to verify if the entity is under the admin's scope
    // This is a simplified check - you may need to implement more complex hierarchy traversal
    if (userRole.name === 'admin_d') {
      // Dealer admin can access all entities under their dealers
      const dealerScopes = scopes.filter(s => s.entityType === 'D');
      for (const dealerScope of dealerScopes) {
        // Check if entity is under this dealer (would need to query hierarchy)
        // For now, return true if entity is a center, mobile, or small mobile
        if (['C', 'M', 'S'].includes(entityType)) {
          // Would need to check hierarchy - simplified for now
          return true;
        }
      }
    }

    // Similar logic for other admin levels
    return false;
  }

  /**
   * Assign entity scope to admin
   */
  static async assignEntityScope(
    adminId: string,
    entityType: 'S' | 'M' | 'C' | 'D',
    entityId: string,
    companyId: string | null,
    assignedBy?: string
  ): Promise<AdminScope> {
    // Verify entity exists
    let entityExists = false;
    switch (entityType) {
      case 'S':
        entityExists = !!(await (prisma as any).smallMobile.findUnique({ where: { id: entityId } }));
        break;
      case 'M':
        entityExists = !!(await (prisma as any).mobile.findUnique({ where: { id: entityId } }));
        break;
      case 'C':
        entityExists = !!(await (prisma as any).center.findUnique({ where: { id: entityId } }));
        break;
      case 'D':
        entityExists = !!(await (prisma as any).dealer.findUnique({ where: { id: entityId } }));
        break;
    }

    if (!entityExists) {
      throw new Error(`Entity ${entityType} with id ${entityId} not found`);
    }

    // Check if scope already exists
    const existingScope = await (prisma as any).adminEntityScope.findFirst({
      where: {
        adminId,
        entityType,
        entityId
      }
    });

    const scope = existingScope
      ? await (prisma as any).adminEntityScope.update({
          where: { id: existingScope.id },
          data: {
            isActive: true,
            assignedBy
          }
        })
      : await (prisma as any).adminEntityScope.create({
          data: {
            adminId,
            entityType,
            entityId,
            companyId,
            isActive: true,
            assignedBy
          }
        });

    // Fetch entity name
    let entityName: string | undefined;
    switch (entityType) {
      case 'S':
        const smallMobile = await (prisma as any).smallMobile.findUnique({
          where: { id: entityId },
          select: { name: true }
        });
        entityName = smallMobile?.name;
        break;
      case 'M':
        const mobile = await (prisma as any).mobile.findUnique({
          where: { id: entityId },
          select: { name: true }
        });
        entityName = mobile?.name;
        break;
      case 'C':
        const center = await (prisma as any).center.findUnique({
          where: { id: entityId },
          select: { name: true }
        });
        entityName = center?.name;
        break;
      case 'D':
        const dealer = await (prisma as any).dealer.findUnique({
          where: { id: entityId },
          select: { name: true }
        });
        entityName = dealer?.name;
        break;
    }

    return {
      id: scope.id,
      entityType: scope.entityType as 'S' | 'M' | 'C' | 'D',
      entityId: scope.entityId,
      entityName
    };
  }

  /**
   * Remove entity scope from admin
   */
  static async removeEntityScope(
    adminId: string,
    entityType: 'S' | 'M' | 'C' | 'D',
    entityId: string
  ): Promise<void> {
    await (prisma as any).adminEntityScope.updateMany({
      where: {
        adminId,
        entityType,
        entityId
      },
      data: {
        isActive: false
      }
    });
  }

  /**
   * Check if user has role
   */
  static async hasRole(userId: string, roleName: string): Promise<boolean> {
    const userWithRoles = await this.getUserWithRoles(userId);
    return userWithRoles?.roles.some(role => role.name === roleName) || false;
  }

  /**
   * Assign role to user
   */
  static async assignRole(
    userId: string,
    roleName: string,
    assignedBy?: string
  ): Promise<void> {
    const role = await prisma.role.findUnique({
      where: { name: roleName }
    });

    if (!role) {
      throw new Error(`Role ${roleName} not found`);
    }

    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId,
          roleId: role.id
        }
      },
      update: {
        assignedBy
      },
      create: {
        userId,
        roleId: role.id,
        assignedBy
      }
    });
  }

  /**
   * Remove role from user
   */
  static async removeRole(userId: string, roleName: string): Promise<void> {
    const role = await prisma.role.findUnique({
      where: { name: roleName }
    });

    if (!role) {
      throw new Error(`Role ${roleName} not found`);
    }

    await prisma.userRole.deleteMany({
      where: {
        userId,
        roleId: role.id
      }
    });
  }

  /**
   * Create custom role for company
   */
  static async createCompanyRole(
    companyId: string,
    name: string,
    description: string,
    permissionNames: string[],
    createdBy: string
  ): Promise<RoleData> {
    // Check if role already exists
    const existingRole = await prisma.role.findUnique({
      where: { name }
    });

    if (existingRole) {
      throw new Error(`Role ${name} already exists`);
    }

    // Create role
    const role = await prisma.role.create({
      data: {
        name,
        description,
        companyId,
        isSystem: false,
        isActive: true
      }
    });

    // Add permissions
    for (const permissionName of permissionNames) {
      const permission = await prisma.permission.findUnique({
        where: { name: permissionName }
      });

      if (permission) {
        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: permission.id
          }
        });
      }
    }

    return {
      id: role.id,
      name: role.name,
      description: role.description || undefined,
      companyId: role.companyId || undefined,
      isSystem: role.isSystem,
      isActive: role.isActive,
      permissions: [] // Would need to fetch permissions separately
    };
  }

  /**
   * Get all roles for company
   */
  static async getCompanyRoles(companyId: string): Promise<RoleData[]> {
    const roles = await prisma.role.findMany({
      where: {
        OR: [
          { companyId },
          { isSystem: true }
        ]
      },
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    });

    return roles.map(role => ({
      id: role.id,
      name: role.name,
      description: role.description || undefined,
      companyId: role.companyId || undefined,
      isSystem: role.isSystem,
      isActive: role.isActive,
      permissions: role.permissions.map(rp => ({
        id: rp.permission.id,
        name: rp.permission.name,
        resource: rp.permission.resource,
        action: rp.permission.action,
        description: rp.permission.description || undefined
      }))
    }));
  }

  /**
   * Middleware function for API routes
   */
  static createPermissionMiddleware(resource: string, action: string) {
    return async (userId: string): Promise<boolean> => {
      return this.hasPermission(userId, resource, action);
    };
  }
}