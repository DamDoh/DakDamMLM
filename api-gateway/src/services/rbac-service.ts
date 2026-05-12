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