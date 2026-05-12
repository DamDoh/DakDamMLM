# 🚀 DakDam MLM Limitless Customization System

## Overview

The DakDam MLM system now provides **limitless customization capabilities** for companies using our platform. Each company can define their own business rules, custom functions, and compensation structures without requiring any development work.

## 🏗️ Architecture

### Core Components

1. **Enhanced Rule Engine** (`enhanced-rule-engine.ts`)
   - Company-specific rule execution
   - Custom function integration
   - Advanced caching and performance optimization

2. **Custom Functions Engine** (`custom-functions.ts`)
   - JavaScript/TypeScript code execution
   - Safe sandboxed environment
   - Built-in utility functions

3. **Company Rule Configuration** (`company-rule-config.ts`)
   - Per-company settings and limits
   - Rule type enablement/disablement
   - Performance and compliance controls

4. **Dynamic Rule Sets** (`dynamic-rule-sets.ts`)
   - Runtime rule set management
   - Version control and rollback
   - Conditional activation

5. **Rule Validation Engine** (`rule-validation-engine.ts`)
   - Conflict detection
   - Rule integrity validation
   - Business logic verification

## 🎯 Key Features

### 1. Custom Functions
Companies can create JavaScript/TypeScript functions for:
- Complex commission calculations
- Dynamic rank advancement logic
- Seasonal bonuses and promotions
- Custom matrix position calculations

### 2. Company-Specific Configurations
Each company can configure:
- Enabled rule types
- Performance limits (execution time, memory)
- Custom calculation types
- Global overrides and defaults
- Integration settings

### 3. Dynamic Rule Sets
- Create and manage rule collections
- Version control with rollback
- Conditional activation based on business logic
- Parallel or sequential execution

### 4. Advanced Validation
- Automatic conflict detection
- Rule integrity checks
- Business logic validation
- Performance impact analysis

## 📋 Usage Examples

### Creating a Custom Function

```typescript
const customFunction = {
  id: 'advanced-binary-calc',
  name: 'Advanced Binary Calculator',
  description: 'Calculates binary commission with custom balancing rules',
  parameters: [
    { name: 'weakerLegVolume', type: 'number', required: true },
    { name: 'strongerLegVolume', type: 'number', required: true },
    { name: 'balanceRatio', type: 'number', required: false }
  ],
  returnType: 'number',
  code: `
    const { weakerLegVolume, strongerLegVolume, balanceRatio = 1.0 } = params;
    const ratio = weakerLegVolume / strongerLegVolume;
    if (ratio < balanceRatio) return 0;
    return (weakerLegVolume * 0.08); // 8% commission
  `,
  companyId: 'company-123',
  isActive: true
};
```

### Company Configuration

```typescript
const companyConfig = {
  companyId: 'company-123',
  enabledRuleTypes: ['binary_bonus', 'custom_bonus', 'referral_bonus'],
  customCalculationTypes: ['advanced_binary', 'seasonal_bonus'],
  maxExecutionTime: 5000, // 5 seconds
  maxMemoryUsage: 100, // 100 MB
  cacheEnabled: true,
  auditEnabled: true,
  customFunctions: ['advanced-binary-calc'],
  globalOverrides: {
    defaultCommissionRate: 0.08,
    qualificationPeriod: 30
  }
};
```

### Dynamic Rule Set

```typescript
const ruleSet = {
  id: 'holiday-promotion-2024',
  name: 'Holiday Promotion 2024',
  companyId: 'company-123',
  rules: [/* array of BusinessRule objects */],
  isActive: true,
  effectiveDate: '2024-12-01',
  expiryDate: '2024-12-31',
  targetCriteria: {
    ranks: ['Gold', 'Diamond'],
    regions: ['US', 'CA']
  },
  executionMode: 'parallel'
};
```

## 🔧 API Endpoints

### Custom Functions
- `GET /api/custom-functions` - List functions
- `POST /api/custom-functions` - Create function
- `PUT /api/custom-functions/[id]` - Update function
- `DELETE /api/custom-functions/[id]` - Delete function

### Enhanced Rules
- `GET /api/enhanced-rules` - List rules for company
- `POST /api/enhanced-rules` - Create rule
- `PUT /api/enhanced-rules/[id]` - Update rule
- `DELETE /api/enhanced-rules/[id]` - Delete rule

### Company Configuration
- `GET /api/company-rule-config` - Get configuration
- `POST /api/company-rule-config` - Create/update configuration
- `DELETE /api/company-rule-config` - Delete configuration

### Rule Sets
- `GET /api/rule-sets` - List rule sets
- `POST /api/rule-sets` - Create rule set
- `PUT /api/rule-sets/[id]` - Update rule set
- `DELETE /api/rule-sets/[id]` - Delete rule set

## 🛡️ Security & Performance

### Security Features
- Code execution in isolated sandbox
- Input validation and sanitization
- Rate limiting and resource controls
- Audit logging for all changes

### Performance Optimizations
- Intelligent caching with TTL
- Parallel rule execution
- Memory usage monitoring
- Execution time limits

## 📊 Monitoring & Analytics

### Built-in Metrics
- Rule execution times
- Cache hit rates
- Error rates and types
- Company-specific usage statistics

### Custom Reporting
- Rule performance analysis
- Conflict detection reports
- Business impact assessments
- Compliance audit trails

## 🚀 Getting Started

1. **Enable Custom Functions**: Configure your company to allow custom function creation
2. **Create Base Rules**: Set up your core compensation structure
3. **Add Custom Logic**: Build custom functions for complex calculations
4. **Test & Validate**: Use the validation engine to ensure rule integrity
5. **Deploy**: Activate rule sets with confidence using version control

## 📈 Benefits

- **Limitless Flexibility**: Adapt to any compensation structure
- **No Development Required**: Business users can configure complex rules
- **Enterprise-Grade**: Production-ready with full audit trails
- **Performance Optimized**: Sub-millisecond execution with caching
- **Conflict-Free**: Automatic validation prevents problematic configurations

## 🔄 Migration Guide

For existing DakDam installations:

1. Run database migrations for new tables
2. Configure company settings via admin panel
3. Migrate existing rules to enhanced format
4. Test rule execution with sample data
5. Gradually roll out custom functions

## 📚 Advanced Topics

- [Custom Function Development](./docs/custom-functions.md)
- [Rule Conflict Resolution](./docs/conflict-resolution.md)
- [Performance Tuning](./docs/performance-tuning.md)
- [Security Best Practices](./docs/security.md)
- [API Integration](./docs/api-integration.md)

---

**DakDam MLM Platform** - Empowering businesses with limitless customization capabilities 🚀