import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';

export interface PermissionCheck {
  userId: string;
  companyId?: string;
  action: 'build_network' | 'view_financials' | 'vote_board' | 'manage_company';
  resource?: string;
}

export interface PermissionResult {
  allowed: boolean;
  reason?: string;
  membershipType?: string;
  shareholderStatus?: string;
}

export class CorporatePermissionService {
  /**
   * Main permission validation method
   */
  static async checkPermission(check: PermissionCheck): Promise<PermissionResult> {
    try {
      // Get shareholder information
      const shareholder = await prisma.shareholder.findFirst({
        where: {
          userId: check.userId,
          companyId: check.companyId,
          status: 'active'
        },
        select: {
          id: true,
          membershipType: true,
          canBuildNetwork: true,
          status: true,
          votingRights: true,
          boardMemberships: {
            where: { status: 'active' },
            select: {
              position: true,
              executivePowers: true,
              votingPower: true
            }
          }
        }
      });

      if (!shareholder) {
        return {
          allowed: false,
          reason: 'User is not a shareholder in this company'
        };
      }

      // Check specific permissions based on action
      switch (check.action) {
        case 'build_network':
          return this.checkNetworkBuildingPermission(shareholder);

        case 'view_financials':
          return this.checkFinancialViewingPermission(shareholder);

        case 'vote_board':
          return this.checkBoardVotingPermission(shareholder);

        case 'manage_company':
          return this.checkCompanyManagementPermission(shareholder);

        default:
          return {
            allowed: false,
            reason: 'Unknown permission action'
          };
      }

    } catch (error) {
      logger.error('Permission check failed', {
        check,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        allowed: false,
        reason: 'Permission check failed due to system error'
      };
    }
  }

  /**
   * Check if user can build networks (Network-Enabled membership)
   */
  private static checkNetworkBuildingPermission(shareholder: any): PermissionResult {
    if (shareholder.membershipType !== 'network_enabled') {
      return {
        allowed: false,
        reason: 'Standard membership does not allow network building',
        membershipType: shareholder.membershipType,
        shareholderStatus: shareholder.status
      };
    }

    if (!shareholder.canBuildNetwork) {
      return {
        allowed: false,
        reason: 'Network building permission has been revoked',
        membershipType: shareholder.membershipType,
        shareholderStatus: shareholder.status
      };
    }

    if (shareholder.status !== 'active') {
      return {
        allowed: false,
        reason: `Shareholder status is ${shareholder.status}`,
        membershipType: shareholder.membershipType,
        shareholderStatus: shareholder.status
      };
    }

    return {
      allowed: true,
      membershipType: shareholder.membershipType,
      shareholderStatus: shareholder.status
    };
  }

  /**
   * Check if user can view financial dashboard
   */
  private static checkFinancialViewingPermission(shareholder: any): PermissionResult {
    if (shareholder.status !== 'active') {
      return {
        allowed: false,
        reason: `Shareholder status is ${shareholder.status}`,
        membershipType: shareholder.membershipType,
        shareholderStatus: shareholder.status
      };
    }

    // All active shareholders can view financials, but board members get more detailed access
    const isBoardMember = shareholder.boardMemberships.length > 0;

    return {
      allowed: true,
      membershipType: shareholder.membershipType,
      shareholderStatus: shareholder.status,
      reason: isBoardMember ? 'Board member - full financial access' : 'Shareholder - standard financial access'
    };
  }

  /**
   * Check if user can vote in board decisions
   */
  private static checkBoardVotingPermission(shareholder: any): PermissionResult {
    if (!shareholder.votingRights) {
      return {
        allowed: false,
        reason: 'Shareholder does not have voting rights',
        membershipType: shareholder.membershipType,
        shareholderStatus: shareholder.status
      };
    }

    const boardMembership = shareholder.boardMemberships[0];
    if (!boardMembership) {
      return {
        allowed: false,
        reason: 'Shareholder is not a board member',
        membershipType: shareholder.membershipType,
        shareholderStatus: shareholder.status
      };
    }

    return {
      allowed: true,
      membershipType: shareholder.membershipType,
      shareholderStatus: shareholder.status,
      reason: `Board member with ${boardMembership.votingPower}x voting power`
    };
  }

  /**
   * Check if user can manage company operations
   */
  private static checkCompanyManagementPermission(shareholder: any): PermissionResult {
    const boardMembership = shareholder.boardMemberships[0];

    if (!boardMembership) {
      return {
        allowed: false,
        reason: 'Only board members can manage company operations',
        membershipType: shareholder.membershipType,
        shareholderStatus: shareholder.status
      };
    }

    if (!boardMembership.executivePowers) {
      return {
        allowed: false,
        reason: 'Board member does not have executive powers',
        membershipType: shareholder.membershipType,
        shareholderStatus: shareholder.status
      };
    }

    return {
      allowed: true,
      membershipType: shareholder.membershipType,
      shareholderStatus: shareholder.status,
      reason: `Executive board member (${boardMembership.position})`
    };
  }

  /**
   * Get user's corporate role and permissions summary
   */
  static async getUserCorporateProfile(userId: string, companyId?: string) {
    try {
      const shareholder = await prisma.shareholder.findFirst({
        where: {
          userId,
          companyId,
          status: 'active'
        },
        include: {
          boardMemberships: {
            where: { status: 'active' },
            select: {
              position: true,
              votingPower: true,
              executivePowers: true,
              committeeRoles: true
            }
          },
          _count: {
            select: {
              networkReferrals: true
            }
          }
        }
      });

      if (!shareholder) {
        return {
          isShareholder: false,
          membershipType: null,
          canBuildNetwork: false,
          networkSize: 0,
          boardRoles: [],
          permissions: {
            buildNetwork: false,
            viewFinancials: false,
            voteBoard: false,
            manageCompany: false
          }
        };
      }

      const permissions = {
        buildNetwork: shareholder.membershipType === 'network_enabled' && shareholder.canBuildNetwork,
        viewFinancials: shareholder.status === 'active',
        voteBoard: shareholder.votingRights && shareholder.boardMemberships.length > 0,
        manageCompany: shareholder.boardMemberships.some(bm => bm.executivePowers)
      };

      return {
        isShareholder: true,
        shareholderId: shareholder.id,
        membershipType: shareholder.membershipType,
        canBuildNetwork: shareholder.canBuildNetwork,
        sharePercentage: shareholder.sharePercentage,
        networkSize: shareholder._count.networkReferrals,
        boardRoles: shareholder.boardMemberships,
        permissions
      };

    } catch (error) {
      logger.error('Failed to get user corporate profile', {
        userId,
        companyId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Validate network building action before execution
   */
  static async validateNetworkAction(userId: string, companyId: string, action: string): Promise<void> {
    const permission = await this.checkPermission({
      userId,
      companyId,
      action: 'build_network'
    });

    if (!permission.allowed) {
      throw new Error(`Network action not allowed: ${permission.reason}`);
    }

    logger.info('Network action validated', {
      userId,
      companyId,
      action,
      membershipType: permission.membershipType
    });
  }

  /**
   * Get company governance structure
   */
  static async getCompanyGovernance(companyId: string) {
    try {
      const boardMembers = await prisma.boardMember.findMany({
        where: {
          companyId,
          status: 'active'
        },
        include: {
          shareholder: {
            select: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true
                }
              },
              membershipType: true,
              sharePercentage: true
            }
          }
        },
        orderBy: { appointmentDate: 'asc' }
      });

      const shareholders = await prisma.shareholder.findMany({
        where: {
          companyId,
          status: 'active'
        },
        select: {
          id: true,
          membershipType: true,
          sharePercentage: true,
          canBuildNetwork: true,
          votingRights: true,
          _count: {
            select: { networkReferrals: true }
          }
        }
      });

      const totalShares = shareholders.reduce((sum, sh) => sum + sh.sharePercentage, 0);
      const networkEnabledCount = shareholders.filter(sh => sh.membershipType === 'network_enabled').length;
      const standardCount = shareholders.filter(sh => sh.membershipType === 'standard').length;

      return {
        boardMembers,
        shareholderStats: {
          totalShareholders: shareholders.length,
          totalSharePercentage: totalShares,
          networkEnabledCount,
          standardCount,
          averageNetworkSize: shareholders.reduce((sum, sh) => sum + sh._count.networkReferrals, 0) / shareholders.length
        }
      };

    } catch (error) {
      logger.error('Failed to get company governance', {
        companyId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
}