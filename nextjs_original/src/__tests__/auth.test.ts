describe('Authentication Service', () => {
  it('should pass basic test', () => {
    expect(true).toBe(true);
  });
});
import { loginUser, registerUser, ValidationError, AuthenticationError } from '../lib/auth';
import { prisma } from '../lib/database';

// Mock Prisma
jest.mock('../lib/database', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
}));

describe('Authentication Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('loginUser', () => {
    it('should login user successfully with valid credentials', async () => {
      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        password: 'hashedPassword',
        memberId: 'M001',
        firstName: 'John',
        surname: 'Doe',
        fullName: 'John Doe',
        phoneNumber: '+1234567890',
        isAdmin: false,
        accountType: 'Distributor',
        active: true,
      };

      const mockTokens = {
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
      };

      // Mock database and JWT functions
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      require('bcryptjs').compare.mockResolvedValue(true);
      require('jsonwebtoken').sign.mockReturnValueOnce('access_token').mockReturnValueOnce('refresh_token');

      const result = await loginUser({ email: 'test@example.com', password: 'password123' });

      expect(result).toEqual(mockTokens);
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { email: 'test@example.com' },
            { memberId: 'test@example.com' },
            { phoneNumber: 'test@example.com' },
          ],
        },
      });
    });

    it('should throw AuthenticationError for invalid credentials', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(loginUser({ email: 'invalid@example.com', password: 'password' }))
        .rejects.toThrow(AuthenticationError);

      await expect(loginUser({ email: 'invalid@example.com', password: 'password' }))
        .rejects.toThrow('Invalid email or password');
    });

    it('should throw ValidationError for missing email', async () => {
      await expect(loginUser({ email: '', password: 'password' }))
        .rejects.toThrow(ValidationError);

      await expect(loginUser({ email: '', password: 'password' }))
        .rejects.toThrow('Email is required');
    });

    it('should throw ValidationError for missing password', async () => {
      await expect(loginUser({ email: 'test@example.com', password: '' }))
        .rejects.toThrow(ValidationError);

      await expect(loginUser({ email: 'test@example.com', password: '' }))
        .rejects.toThrow('Password is required');
    });

    it('should throw AuthenticationError for inactive user', async () => {
      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        active: false,
      };

      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);

      await expect(loginUser({ email: 'test@example.com', password: 'password' }))
        .rejects.toThrow(AuthenticationError);

      await expect(loginUser({ email: 'test@example.com', password: 'password' }))
        .rejects.toThrow('Account is inactive');
    });
  });

  describe('registerUser', () => {
    it('should register user successfully with valid data', async () => {
      const mockUser = {
        id: 'user123',
        email: 'newuser@example.com',
        memberId: 'M002',
        firstName: 'Jane',
        surname: 'Smith',
        fullName: 'Jane Smith',
        phoneNumber: '+1987654321',
        isAdmin: false,
        accountType: 'Distributor',
      };

      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null); // No conflicts
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);
      require('bcryptjs').hash.mockResolvedValue('hashedPassword');

      const result = await registerUser({
        email: 'newuser@example.com',
        password: 'password123',
        firstName: 'Jane',
        surname: 'Smith',
        phoneNumber: '+1987654321',
        memberId: 'M002',
      });

      expect(result).toEqual(mockUser);
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('should throw ValidationError for duplicate email', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        id: 'existing',
        email: 'existing@example.com',
      });

      await expect(registerUser({
        email: 'existing@example.com',
        password: 'password123',
        firstName: 'Jane',
        surname: 'Smith',
        phoneNumber: '+1987654321',
      })).rejects.toThrow(ValidationError);

      await expect(registerUser({
        email: 'existing@example.com',
        password: 'password123',
        firstName: 'Jane',
        surname: 'Smith',
        phoneNumber: '+1987654321',
      })).rejects.toThrow('Email already exists');
    });

    it('should throw ValidationError for duplicate phone number', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        id: 'existing',
        phoneNumber: '+1987654321',
      });

      await expect(registerUser({
        email: 'newuser@example.com',
        password: 'password123',
        firstName: 'Jane',
        surname: 'Smith',
        phoneNumber: '+1987654321',
      })).rejects.toThrow(ValidationError);

      await expect(registerUser({
        email: 'newuser@example.com',
        password: 'password123',
        firstName: 'Jane',
        surname: 'Smith',
        phoneNumber: '+1987654321',
      })).rejects.toThrow('Phone number already exists');
    });

    it('should throw ValidationError for invalid email format', async () => {
      await expect(registerUser({
        email: 'invalid-email',
        password: 'password123',
        firstName: 'Jane',
        surname: 'Smith',
        phoneNumber: '+1987654321',
      })).rejects.toThrow(ValidationError);

      await expect(registerUser({
        email: 'invalid-email',
        password: 'password123',
        firstName: 'Jane',
        surname: 'Smith',
        phoneNumber: '+1987654321',
      })).rejects.toThrow('Invalid email format');
    });

    it('should throw ValidationError for weak password', async () => {
      await expect(registerUser({
        email: 'test@example.com',
        password: '123',
        firstName: 'Jane',
        surname: 'Smith',
        phoneNumber: '+1987654321',
      })).rejects.toThrow(ValidationError);

      await expect(registerUser({
        email: 'test@example.com',
        password: '123',
        firstName: 'Jane',
        surname: 'Smith',
        phoneNumber: '+1987654321',
      })).rejects.toThrow('Password must be at least 6 characters');
    });

    it('should generate memberId if not provided', async () => {
      const mockUser = {
        id: 'user123',
        email: 'newuser@example.com',
        memberId: 'M001',
        firstName: 'Jane',
        surname: 'Smith',
        fullName: 'Jane Smith',
        phoneNumber: '+1987654321',
        isAdmin: false,
        accountType: 'Distributor',
      };

      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);
      require('bcryptjs').hash.mockResolvedValue('hashedPassword');

      await registerUser({
        email: 'newuser@example.com',
        password: 'password123',
        firstName: 'Jane',
        surname: 'Smith',
        phoneNumber: '+1987654321',
      });

      expect(prisma.user.create).toHaveBeenCalled();
      const createCall = (prisma.user.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.memberId).toMatch(/^M\d{3}$/);
    });
  });
});