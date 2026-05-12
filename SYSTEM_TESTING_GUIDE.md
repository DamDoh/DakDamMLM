# 🧪 **Business Rules System - Testing Guide**

## 📋 **Testing Overview**

This guide provides comprehensive testing procedures for the Business Rules Management System. The testing strategy covers unit tests, integration tests, performance tests, and user acceptance testing to ensure system reliability and performance.

## 🧪 **Testing Strategy**

### **Testing Pyramid**
```
End-to-End Tests (10%)
  ↳ Integration Tests (20%)
    ↳ Unit Tests (70%)
```

### **Test Categories**
- **Unit Tests**: Individual functions and components
- **Integration Tests**: API endpoints and database operations
- **Performance Tests**: Load testing and stress testing
- **User Acceptance Tests**: Business rule validation
- **Security Tests**: Authentication and authorization

## 🛠️ **Test Environment Setup**

### **Prerequisites**
```bash
# Install testing dependencies
npm install --save-dev jest @testing-library/react @testing-library/jest-dom
npm install --save-dev supertest artillery playwright
npm install --save-dev @types/jest @types/supertest
```

### **Test Database**
```sql
-- Create test database
CREATE DATABASE business_rules_test;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE business_rules_test TO test_user;
```

### **Environment Configuration**
```env
# Test environment variables
NODE_ENV="test"
DATABASE_URL="postgresql://test_user:test_pass@localhost:5432/business_rules_test"
REDIS_URL="redis://localhost:6379/1"  # Use different DB for tests
TEST_JWT_SECRET="test-jwt-secret-key"
```

## 🧪 **Unit Testing**

### **Rule Engine Tests**
```typescript
// tests/rule-engine.test.ts
import { ruleEngine } from '@/lib/rule-engine';
import type { BusinessRule, RuleExecutionContext } from '@/lib/types';

describe('Rule Engine', () => {
  beforeEach(() => {
    ruleEngine.clearCache();
  });

  describe('Rule Loading', () => {
    test('should load rules correctly', () => {
      const rules: BusinessRule[] = [
        {
          id: 'rule1',
          name: 'Test Rule',
          type: 'commission_rate',
          category: 'commission',
          priority: 10,
          isActive: true,
          conditions: [],
          calculation: { type: 'percentage', percentage: 10 },
          applicableTo: ['distributor'],
          frequency: 'monthly',
          payoutTiming: 'end_of_period',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'test',
          version: 1,
          tags: []
        }
      ];

      ruleEngine.loadRules(rules);
      const stats = ruleEngine.getStats();
      expect(stats.ruleCount).toBe(1);
    });
  });

  describe('Rule Execution', () => {
    test('should execute percentage-based rules', async () => {
      const rules: BusinessRule[] = [
        {
          id: 'commission_rule',
          name: 'Binary Commission',
          type: 'binary_bonus',
          category: 'commission',
          priority: 10,
          isActive: true,
          conditions: [
            { type: 'rank', operator: 'equals', value: 'Gold' }
          ],
          calculation: { type: 'percentage', percentage: 10 },
          applicableTo: ['distributor'],
          frequency: 'monthly',
          payoutTiming: 'end_of_period',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'test',
          version: 1,
          tags: []
        }
      ];

      const context: RuleExecutionContext = {
        memberId: 'M001',
        period: { start: '2024-01-01', end: '2024-01-31' },
        volumes: { personal: 1000, group: 5000, left: 3000, right: 2000 },
        ranks: { current: 'Gold', paidAs: 'Gold', qualifiedFor: [] },
        team: { directRecruits: 5, totalDownline: 25, activeMembers: 20, qualifiedLegs: 2 },
        genealogy: { generation: 2, upline: [], downline: [], sponsor: 'M002', placement: 'M003' },
        products: []
      };

      ruleEngine.loadRules(rules);
      const results = await ruleEngine.executeRules(context);

      expect(results).toHaveLength(1);
      expect(results[0].amount).toBe(100); // 10% of 1000 PV
      expect(results[0].ruleId).toBe('commission_rule');
    });

    test('should skip inactive rules', async () => {
      const rules: BusinessRule[] = [
        {
          id: 'inactive_rule',
          name: 'Inactive Rule',
          type: 'commission_rate',
          category: 'commission',
          priority: 10,
          isActive: false, // Inactive
          conditions: [],
          calculation: { type: 'percentage', percentage: 10 },
          applicableTo: ['distributor'],
          frequency: 'monthly',
          payoutTiming: 'end_of_period',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'test',
          version: 1,
          tags: []
        }
      ];

      const context: RuleExecutionContext = {
        memberId: 'M001',
        period: { start: '2024-01-01', end: '2024-01-31' },
        volumes: { personal: 1000, group: 5000, left: 3000, right: 2000 },
        ranks: { current: 'Gold', paidAs: 'Gold', qualifiedFor: [] },
        team: { directRecruits: 5, totalDownline: 25, activeMembers: 20, qualifiedLegs: 2 },
        genealogy: { generation: 2, upline: [], downline: [], sponsor: 'M002', placement: 'M003' },
        products: []
      };

      ruleEngine.loadRules(rules);
      const results = await ruleEngine.executeRules(context);

      expect(results).toHaveLength(0);
    });

    test('should handle tiered calculations', async () => {
      const rules: BusinessRule[] = [
        {
          id: 'tiered_bonus',
          name: 'Tiered Matching Bonus',
          type: 'matching_bonus',
          category: 'bonus',
          priority: 5,
          isActive: true,
          conditions: [],
          calculation: {
            type: 'tiered_percentage',
            tiers: [
              { min: 1, max: 5, value: 5 },
              { min: 6, max: 10, value: 7 },
              { min: 11, value: 10 }
            ]
          },
          applicableTo: ['distributor'],
          frequency: 'monthly',
          payoutTiming: 'end_of_period',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'test',
          version: 1,
          tags: []
        }
      ];

      const context: RuleExecutionContext = {
        memberId: 'M001',
        period: { start: '2024-01-01', end: '2024-01-31' },
        volumes: { personal: 1000, group: 5000, left: 3000, right: 2000 },
        ranks: { current: 'Diamond', paidAs: 'Diamond', qualifiedFor: [] },
        team: { directRecruits: 8, totalDownline: 25, activeMembers: 20, qualifiedLegs: 2 },
        genealogy: { generation: 2, upline: [], downline: [], sponsor: 'M002', placement: 'M003' },
        products: []
      };

      ruleEngine.loadRules(rules);
      const results = await ruleEngine.executeRules(context);

      expect(results).toHaveLength(1);
      expect(results[0].amount).toBe(70); // 7% of 1000 PV for 6-10 tier
    });
  });

  describe('Condition Evaluation', () => {
    test('should evaluate rank conditions', async () => {
      const rules: BusinessRule[] = [
        {
          id: 'rank_specific',
          name: 'Gold Member Bonus',
          type: 'rank_achievement_bonus',
          category: 'bonus',
          priority: 1,
          isActive: true,
          conditions: [
            { type: 'rank', operator: 'equals', value: 'Gold' }
          ],
          calculation: { type: 'fixed_amount', baseValue: 50 },
          applicableTo: ['distributor'],
          frequency: 'one_time',
          payoutTiming: 'achievement_date',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'test',
          version: 1,
          tags: []
        }
      ];

      const goldContext: RuleExecutionContext = {
        memberId: 'M001',
        period: { start: '2024-01-01', end: '2024-01-31' },
        volumes: { personal: 1000, group: 5000, left: 3000, right: 2000 },
        ranks: { current: 'Gold', paidAs: 'Gold', qualifiedFor: [] },
        team: { directRecruits: 5, totalDownline: 25, activeMembers: 20, qualifiedLegs: 2 },
        genealogy: { generation: 2, upline: [], downline: [], sponsor: 'M002', placement: 'M003' },
        products: []
      };

      const silverContext: RuleExecutionContext = {
        ...goldContext,
        ranks: { current: 'Silver', paidAs: 'Silver', qualifiedFor: [] }
      };

      ruleEngine.loadRules(rules);

      const goldResults = await ruleEngine.executeRules(goldContext);
      const silverResults = await ruleEngine.executeRules(silverContext);

      expect(goldResults).toHaveLength(1);
      expect(goldResults[0].amount).toBe(50);
      expect(silverResults).toHaveLength(0);
    });

    test('should evaluate volume conditions', async () => {
      const rules: BusinessRule[] = [
        {
          id: 'volume_threshold',
          name: 'High Volume Bonus',
          type: 'volume_bonus',
          category: 'bonus',
          priority: 1,
          isActive: true,
          conditions: [
            { type: 'personal_volume', operator: 'greater_equal', value: 5000 }
          ],
          calculation: { type: 'percentage', percentage: 5 },
          applicableTo: ['distributor'],
          frequency: 'monthly',
          payoutTiming: 'end_of_period',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'test',
          version: 1,
          tags: []
        }
      ];

      const highVolumeContext: RuleExecutionContext = {
        memberId: 'M001',
        period: { start: '2024-01-01', end: '2024-01-31' },
        volumes: { personal: 6000, group: 15000, left: 8000, right: 7000 },
        ranks: { current: 'Diamond', paidAs: 'Diamond', qualifiedFor: [] },
        team: { directRecruits: 10, totalDownline: 50, activeMembers: 40, qualifiedLegs: 4 },
        genealogy: { generation: 2, upline: [], downline: [], sponsor: 'M002', placement: 'M003' },
        products: []
      };

      const lowVolumeContext: RuleExecutionContext = {
        ...highVolumeContext,
        volumes: { personal: 3000, group: 8000, left: 4000, right: 4000 }
      };

      ruleEngine.loadRules(rules);

      const highResults = await ruleEngine.executeRules(highVolumeContext);
      const lowResults = await ruleEngine.executeRules(lowVolumeContext);

      expect(highResults).toHaveLength(1);
      expect(highResults[0].amount).toBe(300); // 5% of 6000 PV
      expect(lowResults).toHaveLength(0);
    });
  });

  describe('Performance', () => {
    test('should execute rules within time limits', async () => {
      const rules: BusinessRule[] = Array.from({ length: 100 }, (_, i) => ({
        id: `rule_${i}`,
        name: `Rule ${i}`,
        type: 'commission_rate',
        category: 'commission',
        priority: i,
        isActive: true,
        conditions: [],
        calculation: { type: 'percentage', percentage: 1 },
        applicableTo: ['distributor'],
        frequency: 'monthly',
        payoutTiming: 'end_of_period',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'test',
        version: 1,
        tags: []
      }));

      const context: RuleExecutionContext = {
        memberId: 'M001',
        period: { start: '2024-01-01', end: '2024-01-31' },
        volumes: { personal: 1000, group: 5000, left: 3000, right: 2000 },
        ranks: { current: 'Gold', paidAs: 'Gold', qualifiedFor: [] },
        team: { directRecruits: 5, totalDownline: 25, activeMembers: 20, qualifiedLegs: 2 },
        genealogy: { generation: 2, upline: [], downline: [], sponsor: 'M002', placement: 'M003' },
        products: []
      };

      ruleEngine.loadRules(rules);

      const startTime = Date.now();
      const results = await ruleEngine.executeRules(context);
      const executionTime = Date.now() - startTime;

      expect(executionTime).toBeLessThan(100); // Should execute within 100ms
      expect(results).toHaveLength(100);
    });

    test('should utilize caching effectively', async () => {
      const rules: BusinessRule[] = [
        {
          id: 'cached_rule',
          name: 'Cached Rule',
          type: 'commission_rate',
          category: 'commission',
          priority: 10,
          isActive: true,
          conditions: [],
          calculation: { type: 'percentage', percentage: 10 },
          applicableTo: ['distributor'],
          frequency: 'monthly',
          payoutTiming: 'end_of_period',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'test',
          version: 1,
          tags: []
        }
      ];

      const context: RuleExecutionContext = {
        memberId: 'M001',
        period: { start: '2024-01-01', end: '2024-01-31' },
        volumes: { personal: 1000, group: 5000, left: 3000, right: 2000 },
        ranks: { current: 'Gold', paidAs: 'Gold', qualifiedFor: [] },
        team: { directRecruits: 5, totalDownline: 25, activeMembers: 20, qualifiedLegs: 2 },
        genealogy: { generation: 2, upline: [], downline: [], sponsor: 'M002', placement: 'M003' },
        products: []
      };

      ruleEngine.loadRules(rules);

      // First execution
      const startTime1 = Date.now();
      await ruleEngine.executeRules(context);
      const time1 = Date.now() - startTime1;

      // Second execution (should use cache)
      const startTime2 = Date.now();
      await ruleEngine.executeRules(context);
      const time2 = Date.now() - startTime2;

      // Cached execution should be faster
      expect(time2).toBeLessThanOrEqual(time1);

      const stats = ruleEngine.getStats();
      expect(stats.executionCacheSize).toBeGreaterThan(0);
    });
  });
});
```

### **Conflict Detector Tests**
```typescript
// tests/conflict-detector.test.ts
import { ruleConflictDetector } from '@/lib/rule-conflict-detector';
import type { BusinessRule } from '@/lib/types';

describe('Rule Conflict Detector', () => {
  beforeEach(() => {
    ruleConflictDetector = new RuleConflictDetector();
  });

  describe('Validation', () => {
    test('should validate correct rules', () => {
      const rule: BusinessRule = {
        id: 'valid_rule',
        name: 'Valid Rule',
        type: 'commission_rate',
        category: 'commission',
        priority: 10,
        isActive: true,
        conditions: [
          { type: 'rank', operator: 'equals', value: 'Gold' }
        ],
        calculation: { type: 'percentage', percentage: 10 },
        applicableTo: ['distributor'],
        frequency: 'monthly',
        payoutTiming: 'end_of_period',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'test',
        version: 1,
        tags: []
      };

      const result = ruleConflictDetector.validateRule(rule);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject invalid rules', () => {
      const invalidRule: BusinessRule = {
        id: 'invalid_rule',
        name: '', // Invalid: empty name
        type: 'commission_rate',
        category: 'commission',
        priority: 10,
        isActive: true,
        conditions: [],
        calculation: { type: 'percentage' }, // Invalid: missing percentage
        applicableTo: [],
        frequency: 'monthly',
        payoutTiming: 'end_of_period',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'test',
        version: 1,
        tags: []
      };

      const result = ruleConflictDetector.validateRule(invalidRule);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Rule name is required');
      expect(result.errors).toContain('Percentage calculation requires percentage value');
      expect(result.errors).toContain('Rule applies to no member types');
    });
  });

  describe('Conflict Detection', () => {
    test('should detect priority conflicts', () => {
      const rules: BusinessRule[] = [
        {
          id: 'rule1',
          name: 'Rule 1',
          type: 'commission_rate',
          category: 'commission',
          priority: 10,
          isActive: true,
          conditions: [],
          calculation: { type: 'percentage', percentage: 10 },
          applicableTo: ['distributor'],
          frequency: 'monthly',
          payoutTiming: 'end_of_period',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'test',
          version: 1,
          tags: []
        },
        {
          id: 'rule2',
          name: 'Rule 2',
          type: 'commission_rate',
          category: 'commission',
          priority: 10, // Same priority
          isActive: true,
          conditions: [],
          calculation: { type: 'percentage', percentage: 5 },
          applicableTo: ['distributor'],
          frequency: 'monthly',
          payoutTiming: 'end_of_period',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'test',
          version: 1,
          tags: []
        }
      ];

      ruleConflictDetector.loadRules(rules);
      const conflicts = ruleConflictDetector.analyzeConflicts();

      const priorityConflicts = conflicts.filter(c => c.type === 'duplicate_priorities');
      expect(priorityConflicts).toHaveLength(1);
      expect(priorityConflicts[0].rules).toContain('rule1');
      expect(priorityConflicts[0].rules).toContain('rule2');
    });

    test('should detect mutually exclusive conditions', () => {
      const rules: BusinessRule[] = [
        {
          id: 'gold_rule',
          name: 'Gold Rule',
          type: 'commission_rate',
          category: 'commission',
          priority: 10,
          isActive: true,
          conditions: [
            { type: 'rank', operator: 'equals', value: 'Gold' }
          ],
          calculation: { type: 'percentage', percentage: 10 },
          applicableTo: ['distributor'],
          frequency: 'monthly',
          payoutTiming: 'end_of_period',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'test',
          version: 1,
          tags: []
        },
        {
          id: 'diamond_rule',
          name: 'Diamond Rule',
          type: 'commission_rate',
          category: 'commission',
          priority: 9,
          isActive: true,
          conditions: [
            { type: 'rank', operator: 'equals', value: 'Diamond' }
          ],
          calculation: { type: 'percentage', percentage: 15 },
          applicableTo: ['distributor'],
          frequency: 'monthly',
          payoutTiming: 'end_of_period',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'test',
          version: 1,
          tags: []
        }
      ];

      ruleConflictDetector.loadRules(rules);
      const conflicts = ruleConflictDetector.analyzeConflicts();

      // These rules don't conflict since they have different rank conditions
      const conditionConflicts = conflicts.filter(c => c.type === 'mutually_exclusive_conditions');
      expect(conditionConflicts).toHaveLength(0);
    });
  });
});
```

## 🧪 **Integration Testing**

### **API Endpoint Tests**
```typescript
// tests/api/business-rules.test.ts
import { createMocks } from 'node-mocks-http';
import { POST, GET } from '@/app/api/business-rules/route';
import { prisma } from '@/lib/database';

describe('/api/business-rules', () => {
  beforeEach(async () => {
    // Clear test database
    await prisma.businessRule.deleteMany();
  });

  describe('POST /api/business-rules', () => {
    test('should create valid rule', async () => {
      const ruleData = {
        name: 'Test Commission Rule',
        type: 'commission_rate',
        category: 'commission',
        priority: 10,
        isActive: true,
        conditions: [
          { type: 'rank', operator: 'equals', value: 'Gold' }
        ],
        calculation: { type: 'percentage', percentage: 10 },
        applicableTo: ['distributor'],
        frequency: 'monthly',
        payoutTiming: 'end_of_period',
        tags: ['test']
      };

      const { req, res } = createMocks({
        method: 'POST',
        body: ruleData
      });

      await POST(req, res);

      expect(res._getStatusCode()).toBe(200);
      const response = JSON.parse(res._getData());
      expect(response.success).toBe(true);
      expect(response.data.name).toBe('Test Commission Rule');
    });

    test('should reject invalid rule', async () => {
      const invalidRuleData = {
        name: '', // Invalid: empty name
        type: 'commission_rate',
        category: 'commission',
        priority: 10,
        isActive: true,
        conditions: [],
        calculation: { type: 'percentage' }, // Invalid: missing percentage
        applicableTo: [],
        frequency: 'monthly',
        payoutTiming: 'end_of_period',
        tags: []
      };

      const { req, res } = createMocks({
        method: 'POST',
        body: invalidRuleData
      });

      await POST(req, res);

      expect(res._getStatusCode()).toBe(400);
      const response = JSON.parse(res._getData());
      expect(response.success).toBe(false);
      expect(response.error).toBe('Validation failed');
    });
  });

  describe('GET /api/business-rules', () => {
    test('should return rules list', async () => {
      // Create test rule
      await prisma.businessRule.create({
        data: {
          name: 'Test Rule',
          type: 'commission_rate',
          category: 'commission',
          priority: 10,
          isActive: true,
          conditions: [],
          calculation: { type: 'percentage', percentage: 10 },
          applicableTo: ['distributor'],
          frequency: 'monthly',
          payoutTiming: 'end_of_period',
          createdBy: 'test',
          version: 1,
          tags: []
        }
      });

      const { req, res } = createMocks({
        method: 'GET'
      });

      await GET(req, res);

      expect(res._getStatusCode()).toBe(200);
      const response = JSON.parse(res._getData());
      expect(response.success).toBe(true);
      expect(response.data).toHaveLength(1);
      expect(response.data[0].name).toBe('Test Rule');
    });

    test('should filter by category', async () => {
      // Create test rules
      await prisma.businessRule.createMany({
        data: [
          {
            name: 'Commission Rule',
            type: 'commission_rate',
            category: 'commission',
            priority: 10,
            isActive: true,
            conditions: [],
            calculation: { type: 'percentage', percentage: 10 },
            applicableTo: ['distributor'],
            frequency: 'monthly',
            payoutTiming: 'end_of_period',
            createdBy: 'test',
            version: 1,
            tags: []
          },
          {
            name: 'Bonus Rule',
            type: 'matching_bonus',
            category: 'bonus',
            priority: 9,
            isActive: true,
            conditions: [],
            calculation: { type: 'percentage', percentage: 5 },
            applicableTo: ['distributor'],
            frequency: 'monthly',
            payoutTiming: 'end_of_period',
            createdBy: 'test',
            version: 1,
            tags: []
          }
        ]
      });

      const { req, res } = createMocks({
        method: 'GET',
        url: 'http://localhost/api/business-rules?category=commission'
      });

      await GET(req, res);

      expect(res._getStatusCode()).toBe(200);
      const response = JSON.parse(res._getData());
      expect(response.success).toBe(true);
      expect(response.data).toHaveLength(1);
      expect(response.data[0].category).toBe('commission');
    });
  });
});
```

### **Database Integration Tests**
```typescript
// tests/database/business-rules.test.ts
import { prisma } from '@/lib/database';

describe('Database Integration', () => {
  beforeEach(async () => {
    // Clear all test data
    await prisma.ruleExecutionLog.deleteMany();
    await prisma.ruleValidationLog.deleteMany();
    await prisma.businessRule.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Business Rule CRUD', () => {
    test('should create and retrieve rule', async () => {
      const ruleData = {
        name: 'Integration Test Rule',
        type: 'commission_rate' as const,
        category: 'commission' as const,
        priority: 5,
        isActive: true,
        conditions: [
          { type: 'rank' as const, operator: 'equals' as const, value: 'Gold' }
        ],
        calculation: { type: 'percentage' as const, percentage: 10 },
        applicableTo: ['distributor'] as const,
        frequency: 'monthly' as const,
        payoutTiming: 'end_of_period' as const,
        createdBy: 'test',
        version: 1,
        tags: ['integration', 'test']
      };

      const created = await prisma.businessRule.create({
        data: ruleData
      });

      expect(created.id).toBeDefined();
      expect(created.name).toBe('Integration Test Rule');
      expect(created.version).toBe(1);

      const retrieved = await prisma.businessRule.findUnique({
        where: { id: created.id }
      });

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Integration Test Rule');
    });

    test('should handle rule versioning', async () => {
      const ruleData = {
        name: 'Version Test Rule',
        type: 'commission_rate' as const,
        category: 'commission' as const,
        priority: 5,
        isActive: true,
        conditions: [],
        calculation: { type: 'percentage' as const, percentage: 10 },
        applicableTo: ['distributor'] as const,
        frequency: 'monthly' as const,
        payoutTiming: 'end_of_period' as const,
        createdBy: 'test',
        version: 1,
        tags: []
      };

      const created = await prisma.businessRule.create({
        data: ruleData
      });

      // Update rule (should increment version)
      const updated = await prisma.businessRule.update({
        where: { id: created.id },
        data: {
          priority: 10,
          version: { increment: 1 }
        }
      });

      expect(updated.version).toBe(2);
      expect(updated.priority).toBe(10);
    });
  });

  describe('Audit Logging', () => {
    test('should log rule validation', async () => {
      const validationLog = await prisma.ruleValidationLog.create({
        data: {
          ruleId: 'test-rule-id',
          action: 'create',
          isValid: true,
          errors: [],
          warnings: ['Test warning'],
          suggestions: ['Test suggestion'],
          validatedAt: new Date(),
          validatedBy: 'test-user'
        }
      });

      expect(validationLog.id).toBeDefined();
      expect(validationLog.isValid).toBe(true);
      expect(validationLog.warnings).toContain('Test warning');
    });

    test('should log rule execution', async () => {
      const executionLog = await prisma.ruleExecutionLog.create({
        data: {
          ruleId: 'test-rule-id',
          memberId: 'M001',
          periodStart: new Date('2024-01-01'),
          periodEnd: new Date('2024-01-31'),
          amount: 100.50,
          breakdown: [
            { component: 'commission', amount: 100.50, description: 'Monthly commission' }
          ],
          executedAt: new Date()
        }
      });

      expect(executionLog.id).toBeDefined();
      expect(executionLog.amount).toBe(100.50);
      expect(executionLog.memberId).toBe('M001');
    });
  });
});
```

## 🧪 **Performance Testing**

### **Load Testing with Artillery**
```yaml
# tests/performance/load-test.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 120
      arrivalRate: 50
      name: "Load testing"
    - duration: 60
      arrivalRate: 100
      name: "Stress testing"
  defaults:
    headers:
      Authorization: 'Bearer test-jwt-token'

scenarios:
  - name: 'Rule execution simulation'
    weight: 70
    flow:
      - post:
          url: '/api/business-rules/simulate'
          json:
            rules:
              - id: 'perf-test-rule'
                name: 'Performance Test Rule'
                type: 'commission_rate'
                category: 'commission'
                priority: 10
                isActive: true
                conditions: []
                calculation:
                  type: 'percentage'
                  percentage: 10
                applicableTo: ['distributor']
                frequency: 'monthly'
                payoutTiming: 'end_of_period'
                createdAt: '2024-01-01T00:00:00Z'
                updatedAt: '2024-01-01T00:00:00Z'
                createdBy: 'perf-test'
                version: 1
                tags: []
            context:
              memberId: 'M001'
              period:
                start: '2024-01-01'
                end: '2024-01-31'
              volumes:
                personal: 1000
                group: 5000
                left: 3000
                right: 2000
              ranks:
                current: 'Gold'
                paidAs: 'Gold'
                qualifiedFor: []
              team:
                directRecruits: 5
                totalDownline: 25
                activeMembers: 20
                qualifiedLegs: 2
              genealogy:
                generation: 2
                upline: []
                downline: []
                sponsor: 'M002'
                placement: 'M003'
              products: []

  - name: 'Rule CRUD operations'
    weight: 30
    flow:
      - post:
          url: '/api/business-rules'
          json:
            name: 'Load Test Rule {{ $randomInt }}'
            type: 'commission_rate'
            category: 'commission'
            priority: 10
            isActive: true
            conditions: []
            calculation:
              type: 'percentage'
              percentage: 10
            applicableTo: ['distributor']
            frequency: 'monthly'
            payoutTiming: 'end_of_period'
            tags: ['load-test']
      - get:
          url: '/api/business-rules'
```

### **Running Performance Tests**
```bash
# Install Artillery
npm install -g artillery

# Run load test
artillery run tests/performance/load-test.yml

# Generate report
artillery report report.json
```

### **Performance Benchmarks**
- **Rule Execution**: < 50ms for single rule
- **Bulk Operations**: < 200ms for 100 rules
- **API Response**: < 100ms average
- **Concurrent Users**: Support 1000+ simultaneous requests
- **Memory Usage**: < 512MB under normal load
- **Database Queries**: < 10ms average response time

## 🧪 **End-to-End Testing**

### **User Workflow Tests**
```typescript
// tests/e2e/rule-management.test.ts
import { test, expect } from '@playwright/test';

test.describe('Rule Management E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/admin/login');
    await page.fill('[name="email"]', 'admin@example.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');

    // Navigate to business rules
    await page.goto('/admin/business-rules');
  });

  test('should create new rule successfully', async ({ page }) => {
    // Click create rule button
    await page.click('button:has-text("Create Rule")');

    // Fill rule form
    await page.fill('[name="name"]', 'E2E Test Rule');
    await page.selectOption('[name="type"]', 'commission_rate');
    await page.selectOption('[name="category"]', 'commission');
    await page.fill('[name="priority"]', '5');
    await page.fill('[name="percentage"]', '10');

    // Submit form
    await page.click('button[type="submit"]');

    // Verify success message
    await expect(page.locator('.toast-success')).toContainText('Rule created successfully');

    // Verify rule appears in list
    await expect(page.locator('table')).toContainText('E2E Test Rule');
  });

  test('should simulate rule execution', async ({ page }) => {
    // Navigate to simulation tab
    await page.click('button[data-tab="simulation"]');

    // Fill simulation form
    await page.fill('[name="memberId"]', 'M001');
    await page.fill('[name="personalVolume"]', '1000');
    await page.selectOption('[name="rank"]', 'Gold');

    // Run simulation
    await page.click('button:has-text("Run Simulation")');

    // Verify results
    await expect(page.locator('.simulation-results')).toBeVisible();
    await expect(page.locator('.total-amount')).toContainText('$100.00');
  });

  test('should detect rule conflicts', async ({ page }) => {
    // Create conflicting rules
    await createRule(page, 'Conflict Rule 1', 10);
    await createRule(page, 'Conflict Rule 2', 10);

    // Navigate to validation tab
    await page.click('button[data-tab="validation"]');

    // Check for conflicts
    await expect(page.locator('.conflict-alert')).toBeVisible();
    await expect(page.locator('.conflict-alert')).toContainText('duplicate priorities');
  });

  test('should rollback rule changes', async ({ page }) => {
    // Create and modify rule
    const ruleId = await createRule(page, 'Rollback Test Rule', 5);
    await editRule(page, ruleId, { priority: 10 });

    // Navigate to versioning tab
    await page.click('button[data-tab="versioning"]');

    // Select rule and view versions
    await page.selectOption('[name="rule-select"]', ruleId);

    // Rollback to version 1
    await page.click('button:has-text("Rollback to v1")');

    // Confirm rollback
    await page.click('button:has-text("Confirm Rollback")');

    // Verify success
    await expect(page.locator('.toast-success')).toContainText('Version restored');
  });
});

async function createRule(page: Page, name: string, priority: number): Promise<string> {
  await page.click('button:has-text("Create Rule")');
  await page.fill('[name="name"]', name);
  await page.selectOption('[name="type"]', 'commission_rate');
  await page.selectOption('[name="category"]', 'commission');
  await page.fill('[name="priority"]', priority.toString());
  await page.fill('[name="percentage"]', '10');
  await page.click('button[type="submit"]');

  // Extract rule ID from success message or table
  await page.waitForSelector('.rule-row');
  const ruleRow = page.locator('.rule-row').last();
  return await ruleRow.getAttribute('data-rule-id') || '';
}

async function editRule(page: Page, ruleId: string, changes: any): Promise<void> {
  await page.click(`[data-rule-id="${ruleId}"] button:has-text("Edit")`);

  if (changes.priority) {
    await page.fill('[name="priority"]', changes.priority.toString());
  }

  await page.click('button[type="submit"]');
}
```

## 🧪 **Continuous Integration**

### **GitHub Actions Workflow**
```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:6
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run linting
      run: npm run lint

    - name: Run unit tests
      run: npm test -- --coverage
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/business_rules_test

    - name: Run integration tests
      run: npm run test:integration
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/business_rules_test

    - name: Generate coverage report
      run: npm run coverage

    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info

  performance:
    runs-on: ubuntu-latest
    needs: test

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: npm install

    - name: Run performance tests
      run: npm run test:performance

    - name: Upload performance results
      uses: actions/upload-artifact@v3
      with:
        name: performance-results
        path: performance-results/
```

## 📊 **Test Reporting**

### **Coverage Requirements**
- **Unit Tests**: > 80% coverage
- **Integration Tests**: > 90% API coverage
- **E2E Tests**: All critical user workflows
- **Performance Tests**: < 100ms average response time

### **Quality Gates**
- ✅ All tests pass
- ✅ No critical security vulnerabilities
- ✅ Performance benchmarks met
- ✅ Code coverage requirements satisfied
- ✅ No high-severity conflicts detected

## 🚀 **Running Tests**

### **Local Development**
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run integration tests
npm run test:integration

# Run performance tests
npm run test:performance

# Run E2E tests
npm run test:e2e
```

### **CI/CD Pipeline**
```bash
# Run in CI environment
npm run ci:test

# Deploy to staging
npm run deploy:staging

# Run production smoke tests
npm run test:smoke
```

---

**This comprehensive testing suite ensures your Business Rules Management System is production-ready with enterprise-grade quality assurance!** 🧪✨