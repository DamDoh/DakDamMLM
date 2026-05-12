import { generateMemberId, validateMemberId, generateUniqueMemberId } from '@/lib/member-id-generator';

describe('Member ID Generator', () => {
  describe('generateMemberId', () => {
    test('should generate correct format for valid inputs', () => {
      const result = generateMemberId('John', 'Doe', '+1234567890');
      expect(result).toBe('JD7890');
    });

    test('should handle different names correctly', () => {
      expect(generateMemberId('Jane', 'Smith', '+0987654321')).toBe('JS4321');
      expect(generateMemberId('Bob', 'Johnson', '+1122334455')).toBe('BJ4455');
    });

    test('should take first letter of each name', () => {
      expect(generateMemberId('Michael', 'Anderson', '+1234567890')).toBe('MA7890');
    });

    test('should handle phone numbers with different formats', () => {
      expect(generateMemberId('John', 'Doe', '1234567890')).toBe('JD7890');
      expect(generateMemberId('John', 'Doe', '+1-234-567-890')).toBe('JD7890');
    });

    test('should throw error for phone numbers with less than 4 digits', () => {
      expect(() => generateMemberId('John', 'Doe', '123')).toThrow('Phone number must contain at least 4 digits');
    });
  });

  describe('validateMemberId', () => {
    test('should validate correct format', () => {
      expect(validateMemberId('JD7890')).toBe(true);
      expect(validateMemberId('AB1234')).toBe(true);
    });

    test('should reject incorrect formats', () => {
      expect(validateMemberId('JD789')).toBe(false); // Too short
      expect(validateMemberId('JD78901')).toBe(false); // Too long
      expect(validateMemberId('jd7890')).toBe(false); // Lowercase
      expect(validateMemberId('J37890')).toBe(false); // Number in name part
      expect(validateMemberId('JD789O')).toBe(false); // Letter in number part
    });
  });

  describe('generateUniqueMemberId', () => {
    test('should generate unique ID when first attempt succeeds', async () => {
      const mockCheckExistence = jest.fn().mockResolvedValue(false);

      const result = await generateUniqueMemberId('John', 'Doe', '+1234567890', mockCheckExistence);

      expect(result).toBe('JD7890');
      expect(mockCheckExistence).toHaveBeenCalledWith('JD7890');
    });

    test('should increment when ID exists', async () => {
      const mockCheckExistence = jest.fn()
        .mockResolvedValueOnce(true) // JD7890 exists
        .mockResolvedValueOnce(false); // JD7891 available

      const result = await generateUniqueMemberId('John', 'Doe', '+1234567890', mockCheckExistence);

      expect(result).toBe('JD7891');
      expect(mockCheckExistence).toHaveBeenCalledTimes(2);
    });

    test('should handle multiple collisions', async () => {
      const mockCheckExistence = jest.fn()
        .mockResolvedValueOnce(true) // JD7890 exists
        .mockResolvedValueOnce(true) // JD7891 exists
        .mockResolvedValueOnce(true) // JD7892 exists
        .mockResolvedValueOnce(false); // JD7893 available

      const result = await generateUniqueMemberId('John', 'Doe', '+1234567890', mockCheckExistence);

      expect(result).toBe('JD7893');
      expect(mockCheckExistence).toHaveBeenCalledTimes(4);
    });

    test('should fallback to timestamp when too many collisions', async () => {
      const mockCheckExistence = jest.fn().mockResolvedValue(true);

      // Mock Date.now to return a predictable value
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => 1640995200000); // 2022-01-01 00:00:00 UTC

      const result = await generateUniqueMemberId('John', 'Doe', '+1234567890', mockCheckExistence);

      expect(result).toBe('JD7892'); // 7890 + 2 from timestamp slice(-2)

      Date.now = originalDateNow;
    });
  });
});