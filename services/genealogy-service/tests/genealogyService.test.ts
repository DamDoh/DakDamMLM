import { GenealogyService } from '../src/services/GenealogyService';
import { GenealogyRepository } from '../src/repositories/GenealogyRepository';

// Mock the repository
jest.mock('../src/repositories/GenealogyRepository');

describe('GenealogyService', () => {
  let service: GenealogyService;
  let mockRepository: jest.Mocked<GenealogyRepository>;

  beforeEach(() => {
    mockRepository = new GenealogyRepository() as jest.Mocked<GenealogyRepository>;
    service = new GenealogyService();
    (service as any).repository = mockRepository;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getGenealogyTree', () => {
    it('should return null when user not found', async () => {
      mockRepository.findUserWithChildren.mockResolvedValue(null);

      const result = await service.getGenealogyTree('nonexistent-id');

      expect(result).toBeNull();
      expect(mockRepository.findUserWithChildren).toHaveBeenCalledWith('nonexistent-id');
    });

    it('should return genealogy tree for valid user', async () => {
      const mockUser = {
        id: 'user-1',
        memberId: 'M001',
        fullName: 'John Doe',
        rank: 'Bronze',
        pv: 100,
        createdAt: new Date('2023-01-01'),
        active: true,
        children: { left: null, right: null }
      };

      mockRepository.findUserWithChildren.mockResolvedValue(mockUser as any);

      const result = await service.getGenealogyTree('user-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('user-1');
      expect(result?.level).toBe(0);
    });
  });

  describe('getGenealogyStats', () => {
    it('should throw error when user not found', async () => {
      mockRepository.findUserById.mockResolvedValue(null);

      await expect(service.getGenealogyStats('nonexistent-id'))
        .rejects
        .toThrow('User with ID nonexistent-id not found');
    });

    it('should return correct stats for user with downline', async () => {
      const mockUser = {
        id: 'user-1',
        memberId: 'M001',
        fullName: 'John Doe',
        rank: 'Bronze',
        pv: 100,
        createdAt: new Date('2023-01-01'),
        sponsorId: null,
        placementParentId: null,
        position: null,
        children: { left: null, right: null },
        active: true
      };

      mockRepository.findUserById.mockResolvedValue(mockUser as any);
      (service as any).getAllDownline = jest.fn().mockResolvedValue([
        { id: 'user-2', level: 1, position: 'left', active: true, pv: 50, createdAt: new Date() },
        { id: 'user-3', level: 1, position: 'right', active: false, pv: 25, createdAt: new Date() }
      ]);

      const result = await service.getGenealogyStats('user-1');

      expect(result.totalDownline).toBe(2);
      expect(result.activeDownline).toBe(1);
      expect(result.leftLeg).toBe(1);
      expect(result.rightLeg).toBe(1);
      expect(result.totalPV).toBe(75);
      expect(result.activePV).toBe(50);
    });
  });

  describe('moveDownline', () => {
    it('should successfully move user to new position', async () => {
      const mockUser = {
        id: 'user-2',
        memberId: 'M002',
        fullName: 'User 2',
        rank: 'Bronze',
        pv: 0,
        createdAt: new Date(),
        sponsorId: 'user-1',
        placementParentId: null,
        position: null,
        children: { left: null, right: null },
        active: true
      };

      const mockNewParent = {
        id: 'user-3',
        memberId: 'M003',
        fullName: 'User 3',
        rank: 'Bronze',
        pv: 0,
        createdAt: new Date(),
        sponsorId: null,
        placementParentId: null,
        position: null,
        children: { left: null, right: null },
        active: true
      };

      mockRepository.findUserById
        .mockResolvedValueOnce(mockUser as any) // user
        .mockResolvedValueOnce(mockNewParent as any); // new parent

      mockRepository.validatePlacementMove.mockResolvedValue(true);
      mockRepository.updateUserChildren.mockResolvedValue({} as any);
      mockRepository.updateUserSponsor.mockResolvedValue({} as any);

      const result = await service.moveDownline('user-2', 'user-3', 'left');

      expect(result.success).toBe(true);
      expect(result.newParent).toBe('user-3');
      expect(result.position).toBe('left');
      expect(mockRepository.updateUserSponsor).toHaveBeenCalledWith('user-2', 'user-3');
      expect(mockRepository.updateUserChildren).toHaveBeenCalledWith('user-3', { left: 'user-2', right: null });
    });

    it('should prevent invalid placement moves', async () => {
      mockRepository.validatePlacementMove.mockResolvedValue(false);

      await expect(service.moveDownline('user-1', 'user-2', 'left'))
        .rejects
        .toThrow('Invalid placement move');
    });

    it('should prevent moving to occupied position', async () => {
      const mockUser = {
        id: 'user-2',
        memberId: 'M002',
        fullName: 'User 2',
        rank: 'Bronze',
        pv: 0,
        createdAt: new Date(),
        sponsorId: 'user-1',
        placementParentId: null,
        position: null,
        children: { left: null, right: null },
        active: true
      };

      const mockNewParent = {
        id: 'user-3',
        memberId: 'M003',
        fullName: 'User 3',
        rank: 'Bronze',
        pv: 0,
        createdAt: new Date(),
        sponsorId: null,
        placementParentId: null,
        position: null,
        children: { left: 'existing-user', right: null },
        active: true
      };

      mockRepository.findUserById
        .mockResolvedValueOnce(mockUser as any)
        .mockResolvedValueOnce(mockNewParent as any);
      mockRepository.validatePlacementMove.mockResolvedValue(true);

      await expect(service.moveDownline('user-2', 'user-3', 'left'))
        .rejects
        .toThrow('Position left is already occupied');
    });
  });

  describe('getUpline', () => {
    it('should return upline for valid user', async () => {
      const mockUser = {
        id: 'user-1',
        memberId: 'M001',
        fullName: 'User 1',
        rank: 'Bronze',
        pv: 0,
        createdAt: new Date(),
        sponsorId: 'user-2',
        placementParentId: null,
        position: null,
        children: { left: null, right: null },
        active: true
      };
      const mockUpline = [
        { id: 'user-2', fullName: 'Sponsor User' },
        { id: 'user-3', fullName: 'Grand Sponsor' }
      ];

      mockRepository.findUserById.mockResolvedValue(mockUser as any);
      mockRepository.findUplineById.mockResolvedValue(mockUpline);

      const result = await service.getUpline('user-1');

      expect(result).toEqual(mockUpline);
      expect(mockRepository.findUplineById).toHaveBeenCalledWith('user-1');
    });

    it('should throw error for non-existent user', async () => {
      mockRepository.findUserById.mockResolvedValue(null);

      await expect(service.getUpline('nonexistent'))
        .rejects
        .toThrow('User with ID nonexistent not found');
    });
  });

  describe('getPlacementInfo', () => {
    it('should return placement information', async () => {
      const mockUser = {
        id: 'user-1',
        memberId: 'M001',
        fullName: 'Test User',
        sponsorId: 'user-2',
        placementParentId: 'user-3',
        position: 'left',
        children: { left: null, right: null },
        sponsor: { id: 'user-2', fullName: 'Sponsor', memberId: 'M002' },
        placementParent: { id: 'user-3', fullName: 'Parent', memberId: 'M003' }
      };

      mockRepository.getUserPlacementInfo.mockResolvedValue(mockUser);

      const result = await service.getPlacementInfo('user-1');

      expect(result.userId).toBe('user-1');
      expect(result.sponsor?.fullName).toBe('Sponsor');
      expect(result.placementParent?.fullName).toBe('Parent');
      expect(result.position).toBe('left');
    });
  });

  describe('getGenealogyStats', () => {
    it('should calculate comprehensive statistics', async () => {
      const mockUser = {
        id: 'user-1',
        memberId: 'M001',
        fullName: 'User 1',
        rank: 'Bronze',
        pv: 0,
        createdAt: new Date(),
        sponsorId: null,
        placementParentId: null,
        position: null,
        children: { left: null, right: null },
        active: true
      };
      const mockDownline = [
        { id: 'user-2', level: 1, position: 'left', active: true, pv: 100, createdAt: new Date() },
        { id: 'user-3', level: 1, position: 'right', active: true, pv: 150, createdAt: new Date() },
        { id: 'user-4', level: 2, position: 'left', active: false, pv: 50, createdAt: new Date() }
      ];

      mockRepository.findUserById.mockResolvedValue(mockUser as any);
      (service as any).getAllDownline = jest.fn().mockResolvedValue(mockDownline);

      const result = await service.getGenealogyStats('user-1');

      expect(result.totalDownline).toBe(3);
      expect(result.activeDownline).toBe(2);
      expect(result.totalPV).toBe(300);
      expect(result.activePV).toBe(250);
      expect(result.leftLeg).toBe(2);
      expect(result.rightLeg).toBe(1);
      expect(result.levels).toHaveLength(2);
    });
  });

  describe('getDownlineWithPagination', () => {
    it('should return paginated downline results', async () => {
      const mockUser = {
        id: 'user-1',
        memberId: 'M001',
        fullName: 'User 1',
        rank: 'Bronze',
        pv: 0,
        createdAt: new Date(),
        sponsorId: null,
        placementParentId: null,
        position: null,
        children: { left: null, right: null },
        active: true
      };
      const mockDownline = [
        { id: 'user-2', createdAt: new Date('2023-01-01'), pv: 100, active: true },
        { id: 'user-3', createdAt: new Date('2023-02-01'), pv: 150, active: true },
        { id: 'user-4', createdAt: new Date('2023-03-01'), pv: 50, active: true }
      ];

      mockRepository.findUserById.mockResolvedValue(mockUser as any);
      (service as any).getAllDownline = jest.fn().mockResolvedValue(mockDownline);

      const result = await service.getDownlineWithPagination('user-1', 1, 2, false, 'createdAt', 'desc');

      expect(result.downline).toHaveLength(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(2);
      expect(result.pagination.total).toBe(3);
      expect(result.pagination.hasNext).toBe(true);
      expect(result.summary.totalMembers).toBe(3);
    });
  });

  describe('getBinaryTree', () => {
    it('should return binary tree structure', async () => {
      const mockLeftChild = {
        id: 'user-2',
        memberId: 'M002',
        fullName: 'Jane Smith',
        rank: 'Silver',
        pv: 150,
        createdAt: new Date('2023-02-01'),
        active: true
      };

      const mockUser = {
        id: 'user-1',
        memberId: 'M001',
        fullName: 'John Doe',
        rank: 'Bronze',
        pv: 100,
        createdAt: new Date('2023-01-01'),
        active: true,
        children: { left: mockLeftChild, right: null }
      };

      mockRepository.findUserWithChildren.mockResolvedValueOnce(mockUser as any);

      const result = await service.getBinaryTree('user-1', 2);

      expect(result?.id).toBe('user-1');
      expect(result?.children).toHaveLength(1);
      expect(result?.children[0].id).toBe('user-2');
      expect(result?.children[0].position).toBe('left');
    });
  });

  describe('validatePlacementMove', () => {
    it('should validate successful placement move', async () => {
      const mockUser = {
        id: 'user-2',
        memberId: 'M002',
        fullName: 'User 2',
        rank: 'Bronze',
        pv: 0,
        createdAt: new Date(),
        sponsorId: null,
        placementParentId: null,
        position: null,
        children: { left: null, right: null },
        active: true
      };
      const mockNewParent = {
        id: 'user-3',
        memberId: 'M003',
        fullName: 'User 3',
        rank: 'Bronze',
        pv: 0,
        createdAt: new Date(),
        sponsorId: null,
        placementParentId: null,
        position: null,
        children: { left: null, right: null },
        active: true
      };

      mockRepository.findUserById
        .mockResolvedValueOnce(mockUser as any)
        .mockResolvedValueOnce(mockNewParent as any);
      mockRepository.validatePlacementMove.mockResolvedValue(true);

      const result = await service.validatePlacementMove('user-2', 'user-3', 'left');

      expect(result.valid).toBe(true);
    });

    it('should reject invalid placement moves', async () => {
      mockRepository.validatePlacementMove.mockResolvedValue(false);

      const result = await service.validatePlacementMove('user-1', 'user-2', 'left');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Invalid placement move');
    });
  });

  describe('getGenealogyMetrics', () => {
    it('should return comprehensive metrics', async () => {
      const mockUser = {
        id: 'user-1',
        memberId: 'M001',
        fullName: 'User 1',
        rank: 'Bronze',
        pv: 0,
        createdAt: new Date(),
        sponsorId: null,
        placementParentId: null,
        position: null,
        children: { left: null, right: null },
        active: true
      };
      const mockDownline = [
        { id: 'user-2', createdAt: new Date('2023-01-01'), active: true, pv: 100 },
        { id: 'user-3', createdAt: new Date('2023-02-01'), active: true, pv: 150 },
        { id: 'user-4', createdAt: new Date('2023-12-01'), active: true, pv: 50 }
      ];

      mockRepository.findUserById.mockResolvedValue(mockUser as any);
      (service as any).getAllDownline = jest.fn().mockResolvedValue(mockDownline);

      const result = await service.getGenealogyMetrics('user-1');

      expect(result).toHaveProperty('totalDownline');
      expect(result).toHaveProperty('activeDownline');
      expect(result).toHaveProperty('recentJoins');
      expect(result).toHaveProperty('topPerformers');
      expect(result).toHaveProperty('growthVelocity');
      expect(result).toHaveProperty('retentionRate');
    });
  });

  describe('bulkUpdateGenealogy', () => {
    it('should perform bulk operations successfully', async () => {
      const operations: Array<{
        type: 'move' | 'activate' | 'deactivate';
        userId: string;
        data?: any;
      }> = [
        { type: 'activate', userId: 'user-1' },
        { type: 'move', userId: 'user-2', data: { newParentId: 'user-3', position: 'left' } }
      ];

      mockRepository.updateUserChildren.mockResolvedValue({} as any);
      mockRepository.updateUserSponsor.mockResolvedValue({} as any);

      const result = await service.bulkUpdateGenealogy(operations);

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle failed operations', async () => {
      const operations: Array<{
        type: 'move' | 'activate' | 'deactivate';
        userId: string;
        data?: any;
      }> = [
        { type: 'activate' as any, userId: 'user-1' } // Invalid type for testing
      ];

      const result = await service.bulkUpdateGenealogy(operations);

      expect(result.success).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });
  });
});