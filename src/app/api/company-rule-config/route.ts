import { NextRequest, NextResponse } from 'next/server';
import { companyRuleConfigManager } from '@/lib/company-rule-config';
import { prisma } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'Company ID is required' },
        { status: 400 }
      );
    }

    // Get from database
    const config = await (prisma as any).companyRuleConfig.findUnique({
      where: { companyId },
      include: { company: true }
    });

    if (!config) {
      // Return default configuration
      const defaultConfig = companyRuleConfigManager.getDefaultConfiguration(companyId, {
        id: companyId,
        name: 'Default Company',
        currency: 'USD',
        timezone: 'UTC',
        isActive: true,
        isVerified: false,
        allowEmailLogin: true,
        allowPhoneLogin: true,
        requireEmailVerification: false,
        requirePhoneVerification: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      return NextResponse.json({
        success: true,
        data: defaultConfig
      });
    }

    // Transform config to match interface types (convert null to undefined)
    const transformedConfig = {
      ...config,
      company: config.company ? {
        ...config.company,
        domain: config.company.domain || undefined,
        description: config.company.description || undefined,
        logoUrl: config.company.logoUrl || undefined,
        faviconUrl: config.company.faviconUrl || undefined,
        primaryColor: config.company.primaryColor || undefined,
        secondaryColor: config.company.secondaryColor || undefined,
        website: config.company.website || undefined,
        email: config.company.email || undefined,
        phone: config.company.phone || undefined,
        address: config.company.address || undefined,
        taxId: config.company.taxId || undefined,
        licenseNumber: config.company.licenseNumber || undefined,
        industry: config.company.industry || undefined,
        country: config.company.country || undefined,
        customCss: config.company.customCss || undefined,
        loginPageConfig: config.company.loginPageConfig || undefined
      } : config.company,
      enabledRuleTypes: config.enabledRuleTypes ? JSON.parse(config.enabledRuleTypes as string) : [],
      disabledRuleTypes: config.disabledRuleTypes ? JSON.parse(config.disabledRuleTypes as string) : [],
      customCalculationTypes: config.customCalculationTypes ? JSON.parse(config.customCalculationTypes as string) : [],
      customConditionTypes: config.customConditionTypes ? JSON.parse(config.customConditionTypes as string) : [],
      globalOverrides: config.globalOverrides ? JSON.parse(config.globalOverrides as string) : {},
      defaultValues: config.defaultValues ? JSON.parse(config.defaultValues as string) : {},
      customFunctions: config.customFunctions ? JSON.parse(config.customFunctions as string) : [],
      ruleOverrides: config.ruleOverrides ? JSON.parse(config.ruleOverrides as string) : {},
      integrations: config.integrations ? JSON.parse(config.integrations as string) : { externalAPIs: [], webhooks: [] },
      advancedFeatures: config.advancedFeatures ? JSON.parse(config.advancedFeatures as string) : {
        dynamicRuleSets: false,
        realTimeExecution: false,
        predictiveAnalytics: false,
        machineLearning: false,
        customReporting: false
      },
      tags: config.tags ? JSON.parse(config.tags as string) : [],
      metadata: config.metadata ? JSON.parse(config.metadata as string) : undefined,
      expiryDate: config.expiryDate || undefined
    };

    // Load into manager
    companyRuleConfigManager.loadConfiguration(transformedConfig);

    return NextResponse.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Error fetching company rule config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch company rule configuration' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, ...configData } = body;

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'Company ID is required' },
        { status: 400 }
      );
    }

    // Validate configuration
    const validation = companyRuleConfigManager.validateConfiguration({
      ...configData,
      companyId,
      company: {
        id: companyId,
        name: 'Company',
        currency: 'USD',
        timezone: 'UTC',
        isActive: true,
        isVerified: false,
        allowEmailLogin: true,
        allowPhoneLogin: true,
        requireEmailVerification: false,
        requirePhoneVerification: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    });

    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Configuration validation failed',
          details: validation.errors
        },
        { status: 400 }
      );
    }

    // Create in database
    const config = await (prisma as any).companyRuleConfig.create({
      data: {
        ...configData,
        companyId,
        enabledRuleTypes: JSON.stringify(configData.enabledRuleTypes || []),
        disabledRuleTypes: JSON.stringify(configData.disabledRuleTypes || []),
        customCalculationTypes: JSON.stringify(configData.customCalculationTypes || []),
        customConditionTypes: JSON.stringify(configData.customConditionTypes || []),
        globalOverrides: JSON.stringify(configData.globalOverrides || {}),
        defaultValues: JSON.stringify(configData.defaultValues || {}),
        customFunctions: JSON.stringify(configData.customFunctions || []),
        ruleOverrides: JSON.stringify(configData.ruleOverrides || {}),
        integrations: JSON.stringify(configData.integrations || {}),
        advancedFeatures: JSON.stringify(configData.advancedFeatures || {}),
        tags: JSON.stringify(configData.tags || []),
        metadata: configData.metadata ? JSON.stringify(configData.metadata) : null
      },
      include: { company: true }
    });

    // Transform config to match interface types (convert null to undefined)
    const transformedConfig = {
      ...config,
      company: config.company ? {
        ...config.company,
        domain: config.company.domain || undefined,
        description: config.company.description || undefined,
        logoUrl: config.company.logoUrl || undefined,
        faviconUrl: config.company.faviconUrl || undefined,
        primaryColor: config.company.primaryColor || undefined,
        secondaryColor: config.company.secondaryColor || undefined,
        website: config.company.website || undefined,
        email: config.company.email || undefined,
        phone: config.company.phone || undefined,
        address: config.company.address || undefined,
        taxId: config.company.taxId || undefined,
        licenseNumber: config.company.licenseNumber || undefined,
        industry: config.company.industry || undefined,
        country: config.company.country || undefined,
        customCss: config.company.customCss || undefined,
        loginPageConfig: config.company.loginPageConfig || undefined
      } : config.company,
      enabledRuleTypes: config.enabledRuleTypes ? JSON.parse(config.enabledRuleTypes as string) : [],
      disabledRuleTypes: config.disabledRuleTypes ? JSON.parse(config.disabledRuleTypes as string) : [],
      customCalculationTypes: config.customCalculationTypes ? JSON.parse(config.customCalculationTypes as string) : [],
      customConditionTypes: config.customConditionTypes ? JSON.parse(config.customConditionTypes as string) : [],
      globalOverrides: config.globalOverrides ? JSON.parse(config.globalOverrides as string) : {},
      defaultValues: config.defaultValues ? JSON.parse(config.defaultValues as string) : {},
      customFunctions: config.customFunctions ? JSON.parse(config.customFunctions as string) : [],
      ruleOverrides: config.ruleOverrides ? JSON.parse(config.ruleOverrides as string) : {},
      integrations: config.integrations ? JSON.parse(config.integrations as string) : { externalAPIs: [], webhooks: [] },
      advancedFeatures: config.advancedFeatures ? JSON.parse(config.advancedFeatures as string) : {
        dynamicRuleSets: false,
        realTimeExecution: false,
        predictiveAnalytics: false,
        machineLearning: false,
        customReporting: false
      },
      allowDownlineMovement: config.allowDownlineMovement ?? false,
      movementTimeLimitHours: config.movementTimeLimitHours ?? 24,
      movementRequiresApproval: config.movementRequiresApproval ?? false,
      tags: config.tags ? JSON.parse(config.tags as string) : [],
      metadata: config.metadata ? JSON.parse(config.metadata as string) : undefined,
      expiryDate: config.expiryDate || undefined
    };

    // Load into manager
    companyRuleConfigManager.loadConfiguration(transformedConfig);

    return NextResponse.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Error creating company rule config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create company rule configuration' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, ...updates } = body;

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'Company ID is required' },
        { status: 400 }
      );
    }

    // Get existing config
    const existing = await (prisma as any).companyRuleConfig.findUnique({
      where: { companyId },
      include: { company: true }
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Configuration not found' },
        { status: 404 }
      );
    }

    // Transform existing config to match interface types (convert null to undefined)
    const transformedExisting = {
      ...existing,
      company: existing.company ? {
        ...existing.company,
        domain: existing.company.domain || undefined,
        description: existing.company.description || undefined,
        logoUrl: existing.company.logoUrl || undefined,
        faviconUrl: existing.company.faviconUrl || undefined,
        primaryColor: existing.company.primaryColor || undefined,
        secondaryColor: existing.company.secondaryColor || undefined,
        website: existing.company.website || undefined,
        email: existing.company.email || undefined,
        phone: existing.company.phone || undefined,
        address: existing.company.address || undefined,
        taxId: existing.company.taxId || undefined,
        licenseNumber: existing.company.licenseNumber || undefined,
        industry: existing.company.industry || undefined,
        country: existing.company.country || undefined,
        customCss: existing.company.customCss || undefined,
        loginPageConfig: existing.company.loginPageConfig || undefined
      } : existing.company,
      enabledRuleTypes: existing.enabledRuleTypes ? JSON.parse(existing.enabledRuleTypes as string) : [],
      disabledRuleTypes: existing.disabledRuleTypes ? JSON.parse(existing.disabledRuleTypes as string) : [],
      customCalculationTypes: existing.customCalculationTypes ? JSON.parse(existing.customCalculationTypes as string) : [],
      customConditionTypes: existing.customConditionTypes ? JSON.parse(existing.customConditionTypes as string) : [],
      globalOverrides: existing.globalOverrides ? JSON.parse(existing.globalOverrides as string) : {},
      defaultValues: existing.defaultValues ? JSON.parse(existing.defaultValues as string) : {},
      customFunctions: existing.customFunctions ? JSON.parse(existing.customFunctions as string) : [],
      ruleOverrides: existing.ruleOverrides ? JSON.parse(existing.ruleOverrides as string) : {},
      integrations: existing.integrations ? JSON.parse(existing.integrations as string) : { externalAPIs: [], webhooks: [] },
      advancedFeatures: existing.advancedFeatures ? JSON.parse(existing.advancedFeatures as string) : {
        dynamicRuleSets: false,
        realTimeExecution: false,
        predictiveAnalytics: false,
        machineLearning: false,
        customReporting: false
      },
      allowDownlineMovement: existing.allowDownlineMovement ?? false,
      movementTimeLimitHours: existing.movementTimeLimitHours ?? 24,
      movementRequiresApproval: existing.movementRequiresApproval ?? false,
      tags: existing.tags ? JSON.parse(existing.tags as string) : [],
      metadata: existing.metadata ? JSON.parse(existing.metadata as string) : undefined,
      expiryDate: existing.expiryDate || undefined
    };

    // Validate updated configuration
    const updatedConfig = {
      ...transformedExisting,
      ...updates
    };

    const validation = companyRuleConfigManager.validateConfiguration(updatedConfig);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Configuration validation failed',
          details: validation.errors
        },
        { status: 400 }
      );
    }

    // Update in database
    const config = await (prisma as any).companyRuleConfig.update({
      where: { companyId },
      data: {
        ...updates,
        enabledRuleTypes: updates.enabledRuleTypes ? JSON.stringify(updates.enabledRuleTypes) : undefined,
        disabledRuleTypes: updates.disabledRuleTypes ? JSON.stringify(updates.disabledRuleTypes) : undefined,
        customCalculationTypes: updates.customCalculationTypes ? JSON.stringify(updates.customCalculationTypes) : undefined,
        customConditionTypes: updates.customConditionTypes ? JSON.stringify(updates.customConditionTypes) : undefined,
        globalOverrides: updates.globalOverrides ? JSON.stringify(updates.globalOverrides) : undefined,
        defaultValues: updates.defaultValues ? JSON.stringify(updates.defaultValues) : undefined,
        customFunctions: updates.customFunctions ? JSON.stringify(updates.customFunctions) : undefined,
        ruleOverrides: updates.ruleOverrides ? JSON.stringify(updates.ruleOverrides) : undefined,
        integrations: updates.integrations ? JSON.stringify(updates.integrations) : undefined,
        advancedFeatures: updates.advancedFeatures ? JSON.stringify(updates.advancedFeatures) : undefined,
        tags: updates.tags ? JSON.stringify(updates.tags) : undefined,
        metadata: updates.metadata ? JSON.stringify(updates.metadata) : undefined,
        updatedAt: new Date().toISOString()
      },
      include: { company: true }
    });

    // Transform updated config to match interface types
    const transformedUpdatedConfig = {
      ...config,
      company: config.company ? {
        ...config.company,
        domain: config.company.domain || undefined,
        description: config.company.description || undefined,
        logoUrl: config.company.logoUrl || undefined,
        faviconUrl: config.company.faviconUrl || undefined,
        primaryColor: config.company.primaryColor || undefined,
        secondaryColor: config.company.secondaryColor || undefined,
        website: config.company.website || undefined,
        email: config.company.email || undefined,
        phone: config.company.phone || undefined,
        address: config.company.address || undefined,
        taxId: config.company.taxId || undefined,
        licenseNumber: config.company.licenseNumber || undefined,
        industry: config.company.industry || undefined,
        country: config.company.country || undefined,
        customCss: config.company.customCss || undefined,
        loginPageConfig: config.company.loginPageConfig || undefined
      } : config.company,
      enabledRuleTypes: config.enabledRuleTypes ? JSON.parse(config.enabledRuleTypes as string) : [],
      disabledRuleTypes: config.disabledRuleTypes ? JSON.parse(config.disabledRuleTypes as string) : [],
      customCalculationTypes: config.customCalculationTypes ? JSON.parse(config.customCalculationTypes as string) : [],
      customConditionTypes: config.customConditionTypes ? JSON.parse(config.customConditionTypes as string) : [],
      globalOverrides: config.globalOverrides ? JSON.parse(config.globalOverrides as string) : {},
      defaultValues: config.defaultValues ? JSON.parse(config.defaultValues as string) : {},
      customFunctions: config.customFunctions ? JSON.parse(config.customFunctions as string) : [],
      ruleOverrides: config.ruleOverrides ? JSON.parse(config.ruleOverrides as string) : {},
      integrations: config.integrations ? JSON.parse(config.integrations as string) : { externalAPIs: [], webhooks: [] },
      advancedFeatures: config.advancedFeatures ? JSON.parse(config.advancedFeatures as string) : {
        dynamicRuleSets: false,
        realTimeExecution: false,
        predictiveAnalytics: false,
        machineLearning: false,
        customReporting: false
      },
      tags: config.tags ? JSON.parse(config.tags as string) : [],
      metadata: config.metadata ? JSON.parse(config.metadata as string) : undefined,
      expiryDate: config.expiryDate || undefined
    };

    // Update in manager
    companyRuleConfigManager.updateConfiguration(companyId, updates);

    return NextResponse.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Error updating company rule config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update company rule configuration' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'Company ID is required' },
        { status: 400 }
      );
    }

    // Delete from database
    await (prisma as any).companyRuleConfig.delete({
      where: { companyId }
    });

    return NextResponse.json({
      success: true,
      message: 'Company rule configuration deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting company rule config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete company rule configuration' },
      { status: 500 }
    );
  }
}