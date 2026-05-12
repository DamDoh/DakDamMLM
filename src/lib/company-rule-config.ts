import type { Company } from './types';

/**
 * Company-specific rule configuration management
 * Enables limitless customization for each company's MLM system
 */
export interface CompanyRuleConfiguration {
  id: string;
  companyId: string;
  company: Company;

  // Enabled features and rule types
  enabledRuleTypes: string[];
  disabledRuleTypes: string[];

  // Custom calculation types
  customCalculationTypes: Array<{
    name: string;
    description: string;
    parameters: Array<{
      name: string;
      type: 'number' | 'string' | 'boolean' | 'array' | 'object';
      required: boolean;
      defaultValue?: any;
    }>;
    returnType: 'number' | 'string' | 'boolean' | 'array' | 'object';
  }>;

  // Custom condition types
  customConditionTypes: Array<{
    name: string;
    description: string;
    parameters: Array<{
      name: string;
      type: 'number' | 'string' | 'boolean' | 'array' | 'object';
      required: boolean;
    }>;
  }>;

  // Performance and limits
  maxExecutionTime: number; // milliseconds
  maxMemoryUsage: number; // MB
  maxConcurrentExecutions: number;
  cacheEnabled: boolean;
  cacheTTL: number; // seconds

  // Audit and compliance
  auditEnabled: boolean;
  auditRetentionDays: number;
  complianceMode: 'strict' | 'flexible' | 'disabled';

  // Global overrides and defaults
  globalOverrides: Record<string, any>;
  defaultValues: Record<string, any>;

  // Custom functions
  customFunctions: string[]; // Function IDs

  // Business rules overrides
  ruleOverrides: Record<string, Partial<{
    priority: number;
    conditions: any[];
    calculation: any;
    applicableTo: string[];
    frequency: string;
    payoutTiming: string;
  }>>;

  // Integration settings
  integrations: {
    externalAPIs: Array<{
      name: string;
      endpoint: string;
      apiKey: string;
      enabled: boolean;
    }>;
    webhooks: Array<{
      event: string;
      url: string;
      secret: string;
      enabled: boolean;
    }>;
  };

  // Advanced features
  advancedFeatures: {
    dynamicRuleSets: boolean;
    realTimeExecution: boolean;
    predictiveAnalytics: boolean;
    machineLearning: boolean;
    customReporting: boolean;
  };

  // Version and lifecycle
  version: number;
  isActive: boolean;
  effectiveDate: string;
  expiryDate?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  tags: string[];
  metadata?: Record<string, any>;
}

/**
 * Company rule configuration manager
 */
export class CompanyRuleConfigManager {
  private configurations: Map<string, CompanyRuleConfiguration> = new Map();
  private configVersions: Map<string, CompanyRuleConfiguration[]> = new Map();

  /**
   * Load configuration for a company
   */
  loadConfiguration(config: CompanyRuleConfiguration): void {
    this.configurations.set(config.companyId, config);

    // Store version history
    const versions = this.configVersions.get(config.companyId) || [];
    versions.push(config);
    this.configVersions.set(config.companyId, versions);
  }

  /**
   * Get configuration for a company
   */
  getConfiguration(companyId: string): CompanyRuleConfiguration | undefined {
    return this.configurations.get(companyId);
  }

  /**
   * Update configuration with validation
   */
  updateConfiguration(
    companyId: string,
    updates: Partial<CompanyRuleConfiguration>
  ): CompanyRuleConfiguration {
    const existing = this.configurations.get(companyId);
    if (!existing) {
      throw new Error(`Configuration not found for company: ${companyId}`);
    }

    // Validate updates
    const validation = this.validateConfiguration({ ...existing, ...updates });
    if (!validation.isValid) {
      throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
    }

    // Create new version
    const newConfig: CompanyRuleConfiguration = {
      ...existing,
      ...updates,
      version: existing.version + 1,
      updatedAt: new Date().toISOString()
    };

    this.loadConfiguration(newConfig);
    return newConfig;
  }

  /**
   * Validate configuration
   */
  validateConfiguration(config: CompanyRuleConfiguration): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Basic validation
    if (!config.companyId) {
      errors.push('Company ID is required');
    }

    if (!config.enabledRuleTypes || config.enabledRuleTypes.length === 0) {
      errors.push('At least one rule type must be enabled');
    }

    // Performance limits validation
    if (config.maxExecutionTime < 100 || config.maxExecutionTime > 30000) {
      errors.push('Max execution time must be between 100ms and 30000ms');
    }

    if (config.maxMemoryUsage < 10 || config.maxMemoryUsage > 1000) {
      errors.push('Max memory usage must be between 10MB and 1000MB');
    }

    // Custom types validation
    config.customCalculationTypes?.forEach((calc, index) => {
      if (!calc.name) {
        errors.push(`Custom calculation type ${index} missing name`);
      }
      if (!calc.parameters) {
        errors.push(`Custom calculation type ${calc.name} missing parameters`);
      }
    });

    config.customConditionTypes?.forEach((cond, index) => {
      if (!cond.name) {
        errors.push(`Custom condition type ${index} missing name`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get configuration versions for a company
   */
  getConfigurationVersions(companyId: string): CompanyRuleConfiguration[] {
    return this.configVersions.get(companyId) || [];
  }

  /**
   * Rollback to previous configuration version
   */
  rollbackConfiguration(companyId: string, version: number): CompanyRuleConfiguration {
    const versions = this.configVersions.get(companyId);
    if (!versions) {
      throw new Error(`No versions found for company: ${companyId}`);
    }

    const targetVersion = versions.find(v => v.version === version);
    if (!targetVersion) {
      throw new Error(`Version ${version} not found for company: ${companyId}`);
    }

    // Create rollback version
    const rollbackConfig: CompanyRuleConfiguration = {
      ...targetVersion,
      version: (this.configurations.get(companyId)?.version || 0) + 1,
      updatedAt: new Date().toISOString(),
      tags: [...(targetVersion.tags || []), 'rollback']
    };

    this.loadConfiguration(rollbackConfig);
    return rollbackConfig;
  }

  /**
   * Clone configuration from one company to another
   */
  cloneConfiguration(
    sourceCompanyId: string,
    targetCompanyId: string,
    modifications?: Partial<CompanyRuleConfiguration>
  ): CompanyRuleConfiguration {
    const sourceConfig = this.configurations.get(sourceCompanyId);
    if (!sourceConfig) {
      throw new Error(`Source configuration not found: ${sourceCompanyId}`);
    }

    const clonedConfig: CompanyRuleConfiguration = {
      ...sourceConfig,
      ...modifications,
      id: `${targetCompanyId}-config-${Date.now()}`,
      companyId: targetCompanyId,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [...(sourceConfig.tags || []), 'cloned']
    };

    this.loadConfiguration(clonedConfig);
    return clonedConfig;
  }

  /**
   * Get default configuration template
   */
  getDefaultConfiguration(companyId: string, company: Company): CompanyRuleConfiguration {
    return {
      id: `${companyId}-default-config`,
      companyId,
      company,

      // Enable all standard rule types by default
      enabledRuleTypes: [
        'commission_rate', 'commission_cap', 'rank_requirement', 'stockist_bonus',
        'matching_bonus', 'referral_bonus', 'leadership_bonus', 'pool_bonus',
        'fast_start_bonus', 'retail_profit', 'override_bonus', 'generation_bonus',
        'breakaway_bonus', 'infinity_bonus', 'unilevel_bonus', 'matrix_bonus',
        'binary_bonus', 'stair_step_bonus', 'rank_achievement_bonus', 'loyalty_bonus',
        'performance_bonus', 'team_building_bonus', 'mentorship_bonus', 'qualification_bonus',
        'maintenance_bonus', 'activity_bonus', 'productivity_bonus', 'volume_bonus',
        'growth_bonus', 'retention_bonus', 'recruitment_bonus', 'placement_bonus',
        'sponsorship_bonus', 'upline_bonus', 'downline_bonus', 'pairing_bonus',
        'cycling_bonus', 'spillover_bonus', 'compression_bonus', 'travel_bonus',
        'car_bonus', 'house_bonus', 'vacation_bonus', 'club_bonus', 'elite_bonus',
        'royalty_bonus', 'residual_bonus', 'passive_bonus', 'automated_bonus', 'custom_bonus'
      ],
      disabledRuleTypes: [],

      // No custom types by default
      customCalculationTypes: [],
      customConditionTypes: [],

      // Reasonable performance limits
      maxExecutionTime: 5000, // 5 seconds
      maxMemoryUsage: 100, // 100 MB
      maxConcurrentExecutions: 10,
      cacheEnabled: true,
      cacheTTL: 3600, // 1 hour

      // Audit enabled by default
      auditEnabled: true,
      auditRetentionDays: 2555, // 7 years
      complianceMode: 'flexible',

      // Empty defaults
      globalOverrides: {},
      defaultValues: {},
      customFunctions: [],

      // No rule overrides by default
      ruleOverrides: {},

      // No integrations by default
      integrations: {
        externalAPIs: [],
        webhooks: []
      },

      // Advanced features disabled by default
      advancedFeatures: {
        dynamicRuleSets: false,
        realTimeExecution: false,
        predictiveAnalytics: false,
        machineLearning: false,
        customReporting: false
      },

      // Version info
      version: 1,
      isActive: true,
      effectiveDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'system',
      tags: ['default', 'auto-generated'],
      metadata: {
        description: 'Default company rule configuration',
        generatedBy: 'CompanyRuleConfigManager'
      }
    };
  }

  /**
   * Export configuration as JSON
   */
  exportConfiguration(companyId: string): string {
    const config = this.configurations.get(companyId);
    if (!config) {
      throw new Error(`Configuration not found for company: ${companyId}`);
    }

    return JSON.stringify(config, null, 2);
  }

  /**
   * Import configuration from JSON
   */
  importConfiguration(jsonConfig: string, companyId?: string): CompanyRuleConfiguration {
    try {
      const config = JSON.parse(jsonConfig) as CompanyRuleConfiguration;

      // Override company ID if specified
      if (companyId) {
        config.companyId = companyId;
        config.id = `${companyId}-config-${Date.now()}`;
      }

      // Validate and load
      const validation = this.validateConfiguration(config);
      if (!validation.isValid) {
        throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
      }

      this.loadConfiguration(config);
      return config;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to import configuration: ${message}`);
    }
  }

  /**
   * Get all company configurations
   */
  getAllConfigurations(): CompanyRuleConfiguration[] {
    return Array.from(this.configurations.values());
  }

  /**
   * Clear all configurations
   */
  clear(): void {
    this.configurations.clear();
    this.configVersions.clear();
  }
}

// Export singleton instance
export const companyRuleConfigManager = new CompanyRuleConfigManager();