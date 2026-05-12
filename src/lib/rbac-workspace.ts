import { prisma } from '@/lib/database';
import { rbacService } from './rbac-service';

/**
 * RBAC Workspace Delegation System
 * Implements least privilege through workspace-based access control
 */

export interface WorkspaceDelegation {
  workspaceId: string;
  userId: string;
  roleId: string;
  scopeLimitations?: ScopeLimitation[];
  validityPeriod?: {
    start: Date;
    end?: Date;
  };
  justification: string;
  delegatedBy: string;
}

export interface ScopeLimitation {
  type: 'resource_filter' | 'time_restriction' | 'geographic_limit' | 'amount_threshold' | 'department_limit';
  parameter: string;
  value: any;
  description: string;
}

export interface WorkspaceDefinition {
  id: string;
  name: string;
  displayName: string;
  description: string;
  module: string; // user_management, financial, customer_support, etc.
  resources: string[]; // Specific resources accessible in this workspace
  defaultRole?: string; // Default role for workspace users
  securityLevel: 'low' | 'medium' | 'high' | 'critical';
  auditRequired: boolean;
}

export class RBACWorkspaceManager {
  // Predefined workspace templates
  private static readonly WORKSPACE_TEMPLATES: Record<string, WorkspaceDefinition> = {
    user_management: {
      id: 'user_mgmt',
      name: 'user_management',
      displayName: 'User Management',
      description: 'Manage user accounts, authentication, and profiles',
      module: 'user_management',
      resources: ['user_data', 'authentication'],
      defaultRole: 'user_admin',
      securityLevel: 'medium',
      auditRequired: true
    },
    financial_operations: {
      id: 'financial_ops',
      name: 'financial_operations',
      displayName: 'Financial Operations',
      description: 'Handle financial transactions and reporting',
      module: 'financial',
      resources: ['financial_records', 'transactions'],
      defaultRole: 'financial_officer',
      securityLevel: 'high',
      auditRequired: true
    },
    customer_service: {
      id: 'customer_svc',
      name: 'customer_service',
      displayName: 'Customer Service',
      description: 'Manage customer support and communications',
      module: 'customer_support',
      resources: ['customer_support', 'user_communications'],
      defaultRole: 'support_lead',
      securityLevel: 'medium',
      auditRequired: false
    },
    content_moderation: {
      id: 'content_mod',
      name: 'content_moderation',
      displayName: 'Content Moderation',
      description: 'Moderate user-generated content and media',
      module: 'content',
      resources: ['content', 'media'],
      defaultRole: 'content_moderator',
      securityLevel: 'medium',
      auditRequired: true
    },
    security_operations: {
      id: 'security_ops',
      name: 'security_operations',
      displayName: 'Security Operations',
      description: 'Monitor security events and manage policies',
      module: 'security',
      resources: ['security_logs', 'security_policies'],
      defaultRole: 'security_analyst',
      securityLevel: 'high',
      auditRequired: true
    },
    system_administration: {
      id: 'sys_admin',
      name: 'system_administration',
      displayName: 'System Administration',
      description: 'Full system administration and configuration',
      module: 'system',
      resources: ['*'], // All resources
      defaultRole: 'system_admin',
      securityLevel: 'critical',
      auditRequired: true
    }
  };

  /**
   * Create a new workspace
   */
  async createWorkspace(
    creatorId: string,
    workspace: {
      name: string;
      displayName: string;
      description: string;
      module: string;
      resources: string[];
      securityLevel?: 'low' | 'medium' | 'high' | 'critical';
      auditRequired?: boolean;
    }
  ): Promise<WorkspaceDefinition> {
    // Check permission to create workspaces
    const permissionCheck = await rbacService.checkPermission({
      userId: creatorId,
      action: 'C',
      resource: 'system_settings'
    });

    if (!permissionCheck.allowed) {
      throw new Error('Insufficient permissions to create workspaces');
    }

    const newWorkspace = await prisma.rBACWorkspace.create({
      data: {
        name: workspace.name,
        displayName: workspace.displayName,
        description: workspace.description,
        module: workspace.module,
        resources: workspace.resources,
        createdBy: creatorId
      }
    });

    return {
      id: newWorkspace.id,
      name: newWorkspace.name,
      displayName: newWorkspace.displayName,
      description: newWorkspace.description,
      module: newWorkspace.module,
      resources: newWorkspace.resources as string[],
      securityLevel: workspace.securityLevel || 'medium',
      auditRequired: workspace.auditRequired || false
    };
  }

  /**
   * Delegate user to workspace with specific role
   */
  async delegateToWorkspace(
    delegation: WorkspaceDelegation
  ): Promise<{ delegationId: string; effectivePermissions: any }> {
    // Check permission to delegate
    const permissionCheck = await rbacService.checkPermission({
      userId: delegation.delegatedBy,
      action: 'U',
      resource: 'user_data',
      resourceId: delegation.userId
    });

    if (!permissionCheck.allowed) {
      throw new Error('Insufficient permissions to delegate workspace access');
    }

    // Validate workspace exists
    const workspace = await prisma.rBACWorkspace.findUnique({
      where: { id: delegation.workspaceId }
    });

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Validate role exists and is appropriate for workspace
    const role = await prisma.rBACRole.findUnique({
      where: { id: delegation.roleId },
      include: { permissions: { include: { permission: true } } }
    });

    if (!role) {
      throw new Error('Role not found');
    }

    // Validate scope limitations
    if (delegation.scopeLimitations) {
      this.validateScopeLimitations(delegation.scopeLimitations);
    }

    // Create delegation
    const userRole = await prisma.rBACUserRole.create({
      data: {
        userId: delegation.userId,
        roleId: delegation.roleId,
        workspaceId: delegation.workspaceId,
        scopeLimitations: delegation.scopeLimitations,
        expiresAt: delegation.validityPeriod?.end,
        assignedBy: delegation.delegatedBy,
        metadata: {
          justification: delegation.justification,
          validityStart: delegation.validityPeriod?.start || new Date()
        }
      },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true }
            }
          }
        },
        workspace: true
      }
    });

    // Calculate effective permissions with scope limitations
    const effectivePermissions = await this.calculateEffectivePermissions(userRole);

    // Log delegation
    await this.logDelegation(delegation, userRole.id);

    return {
      delegationId: userRole.id,
      effectivePermissions
    };
  }

  /**
   * Revoke workspace delegation
   */
  async revokeDelegation(
    delegationId: string,
    revokedBy: string,
    reason: string
  ): Promise<void> {
    const delegation = await prisma.rBACUserRole.findUnique({
      where: { id: delegationId },
      include: { workspace: true }
    });

    if (!delegation) {
      throw new Error('Delegation not found');
    }

    // Check permission to revoke
    const permissionCheck = await rbacService.checkPermission({
      userId: revokedBy,
      action: 'D',
      resource: 'user_data',
      resourceId: delegation.userId
    });

    if (!permissionCheck.allowed) {
      throw new Error('Insufficient permissions to revoke delegation');
    }

    // Mark as inactive
    await prisma.rBACUserRole.update({
      where: { id: delegationId },
      data: {
        isActive: false,
        metadata: {
          ...delegation.metadata,
          revokedBy,
          revokedAt: new Date(),
          revocationReason: reason
        }
      }
    });

    // Log revocation
    await this.logRevocation(delegation, revokedBy, reason);
  }

  /**
   * Get user's workspace delegations
   */
  async getUserDelegations(userId: string): Promise<any[]> {
    const delegations = await prisma.rBACUserRole.findMany({
      where: {
        userId,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true }
            }
          }
        },
        workspace: true
      },
      orderBy: { assignedAt: 'desc' }
    });

    return delegations.map(delegation => ({
      id: delegation.id,
      workspace: {
        id: delegation.workspace?.id,
        name: delegation.workspace?.name,
        displayName: delegation.workspace?.displayName,
        module: delegation.workspace?.module
      },
      role: {
        id: delegation.role.id,
        name: delegation.role.name,
        displayName: delegation.role.displayName
      },
      permissions: delegation.role.permissions.map(rp => rp.permission),
      scopeLimitations: delegation.scopeLimitations,
      assignedAt: delegation.assignedAt,
      expiresAt: delegation.expiresAt,
      assignedBy: delegation.assignedBy
    }));
  }

  /**
   * Get workspace members and their roles
   */
  async getWorkspaceMembers(workspaceId: string): Promise<any[]> {
    const members = await prisma.rBACUserRole.findMany({
      where: {
        workspaceId,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            isActive: true
          }
        },
        role: {
          select: {
            id: true,
            name: true,
            displayName: true,
            level: true
          }
        }
      },
      orderBy: { assignedAt: 'desc' }
    });

    return members.map(member => ({
      user: member.user,
      role: member.role,
      assignedAt: member.assignedAt,
      expiresAt: member.expiresAt,
      assignedBy: member.assignedBy,
      scopeLimitations: member.scopeLimitations
    }));
  }

  /**
   * Check if user has access to workspace
   */
  async checkWorkspaceAccess(
    userId: string,
    workspaceId: string,
    requiredAction?: string,
    requiredResource?: string
  ): Promise<{
    hasAccess: boolean;
    role?: string;
    permissions?: any[];
    scopeLimitations?: any[];
  }> {
    const delegation = await prisma.rBACUserRole.findFirst({
      where: {
        userId,
        workspaceId,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true }
            }
          }
        },
        workspace: true
      }
    });

    if (!delegation) {
      return { hasAccess: false };
    }

    // Check if action/resource is permitted
    let actionPermitted = true;
    if (requiredAction && requiredResource) {
      actionPermitted = delegation.role.permissions.some(rp => {
        const perm = rp.permission;
        return perm.resource === requiredResource &&
               (perm.actions as string[]).includes(requiredAction);
      });
    }

    // Apply scope limitations
    const effectivePermissions = await this.calculateEffectivePermissions(delegation);

    return {
      hasAccess: actionPermitted,
      role: delegation.role.name,
      permissions: effectivePermissions,
      scopeLimitations: delegation.scopeLimitations as any[]
    };
  }

  /**
   * Create workspace from template
   */
  async createWorkspaceFromTemplate(
    creatorId: string,
    templateName: string,
    customizations?: Partial<WorkspaceDefinition>
  ): Promise<WorkspaceDefinition> {
    const template = RBACWorkspaceManager.WORKSPACE_TEMPLATES[templateName];

    if (!template) {
      throw new Error(`Workspace template '${templateName}' not found`);
    }

    const workspaceData = {
      ...template,
      ...customizations,
      name: customizations?.name || `${template.name}_${Date.now()}`,
      displayName: customizations?.displayName || template.displayName
    };

    return await this.createWorkspace(creatorId, workspaceData);
  }

  /**
   * Get workspace templates
   */
  getWorkspaceTemplates(): Record<string, WorkspaceDefinition> {
    return RBACWorkspaceManager.WORKSPACE_TEMPLATES;
  }

  // Private helper methods

  private validateScopeLimitations(limitations: ScopeLimitation[]): void {
    const validTypes = [
      'resource_filter',
      'time_restriction',
      'geographic_limit',
      'amount_threshold',
      'department_limit'
    ];

    for (const limitation of limitations) {
      if (!validTypes.includes(limitation.type)) {
        throw new Error(`Invalid scope limitation type: ${limitation.type}`);
      }

      // Type-specific validation
      switch (limitation.type) {
        case 'time_restriction':
          if (!limitation.value.allowedHours || !Array.isArray(limitation.value.allowedHours)) {
            throw new Error('time_restriction must include allowedHours array');
          }
          break;
        case 'geographic_limit':
          if (!limitation.value.allowedRegions || !Array.isArray(limitation.value.allowedRegions)) {
            throw new Error('geographic_limit must include allowedRegions array');
          }
          break;
        case 'amount_threshold':
          if (typeof limitation.value.maxAmount !== 'number') {
            throw new Error('amount_threshold must include maxAmount number');
          }
          break;
      }
    }
  }

  private async calculateEffectivePermissions(userRole: any): Promise<any[]> {
    const permissions = [];

    for (const rolePermission of userRole.role.permissions) {
      const permission = rolePermission.permission;
      let effectiveActions = permission.actions as string[];

      // Apply scope limitations
      if (userRole.scopeLimitations) {
        effectiveActions = this.applyScopeLimitationsToActions(
          effectiveActions,
          permission.resource,
          userRole.scopeLimitations
        );
      }

      permissions.push({
        resource: permission.resource,
        actions: effectiveActions,
        scope: permission.scope,
        conditions: permission.conditions,
        limitations: userRole.scopeLimitations
      });
    }

    return permissions;
  }

  private applyScopeLimitationsToActions(
    actions: string[],
    resource: string,
    limitations: ScopeLimitation[]
  ): string[] {
    // Apply limitations that affect available actions
    let effectiveActions = [...actions];

    for (const limitation of limitations) {
      switch (limitation.type) {
        case 'resource_filter':
          // May restrict read actions
          if (resource === 'user_data' && limitation.value.excludeFields) {
            // Read actions may be limited
            effectiveActions = effectiveActions.filter(action =>
              !limitation.value.excludeFields.includes('read') || action !== 'R'
            );
          }
          break;
        case 'amount_threshold':
          // May restrict financial actions
          if (resource.includes('financial') && limitation.value.maxAmount) {
            // Could add conditions instead of removing actions
          }
          break;
      }
    }

    return effectiveActions;
  }

  private async logDelegation(delegation: WorkspaceDelegation, delegationId: string): Promise<void> {
    // This would integrate with the audit system
    console.log('Workspace delegation logged:', {
      delegationId,
      userId: delegation.userId,
      workspaceId: delegation.workspaceId,
      roleId: delegation.roleId,
      delegatedBy: delegation.delegatedBy,
      justification: delegation.justification
    });
  }

  private async logRevocation(delegation: any, revokedBy: string, reason: string): Promise<void> {
    // This would integrate with the audit system
    console.log('Workspace delegation revoked:', {
      delegationId: delegation.id,
      userId: delegation.userId,
      workspaceId: delegation.workspaceId,
      revokedBy,
      reason
    });
  }
}

// Export singleton instance
export const rbacWorkspaceManager = new RBACWorkspaceManager();