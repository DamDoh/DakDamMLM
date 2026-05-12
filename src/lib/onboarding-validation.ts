import { prisma } from '@/lib/database';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: string[];
  score: number; // 0-1 validation confidence score
}

export interface ValidationError {
  field: string;
  code: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion: string;
}

export interface DocumentValidationResult extends ValidationResult {
  extractedData?: any;
  authenticityScore?: number;
  fraudIndicators?: string[];
}

/**
 * Comprehensive Onboarding Validation System
 * Handles all validation logic for the registration process
 */
export class OnboardingValidation {

  /**
   * Validate qualification input data
   */
  async validateQualificationInput(data: {
    email: string;
    companyInfo: any;
    requirements: any;
  }): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: string[] = [];

    // Email validation
    if (!this.isValidEmail(data.email)) {
      errors.push({
        field: 'email',
        code: 'INVALID_EMAIL',
        message: 'Please enter a valid email address',
        severity: 'error'
      });
    }

    // Company info validation
    if (!data.companyInfo?.name?.trim()) {
      errors.push({
        field: 'companyInfo.name',
        code: 'MISSING_COMPANY_NAME',
        message: 'Company name is required',
        severity: 'error'
      });
    }

    if (!data.companyInfo?.industry) {
      warnings.push({
        field: 'companyInfo.industry',
        message: 'Industry selection helps us provide better recommendations',
        suggestion: 'Please select your industry from the dropdown'
      });
    }

    // Domain validation
    if (data.companyInfo?.domain) {
      const domainErrors = await this.validateDomain(data.companyInfo.domain);
      errors.push(...domainErrors);
    }

    // Company size validation
    if (!data.companyInfo?.size) {
      suggestions.push('Selecting company size helps us recommend the right plan');
    }

    const score = this.calculateValidationScore(errors, warnings);
    const valid = errors.filter(e => e.severity === 'error').length === 0;

    return {
      valid,
      errors,
      warnings,
      suggestions,
      score
    };
  }

  /**
   * Validate step data for each registration step
   */
  async validateStepData(step: string, data: any): Promise<ValidationResult> {
    switch (step) {
      case 'company_details':
        return this.validateCompanyDetails(data);
      case 'contact_information':
        return this.validateContactInformation(data);
      case 'business_verification':
        return this.validateBusinessVerification(data);
      case 'system_configuration':
        return this.validateSystemConfiguration(data);
      default:
        return {
          valid: true,
          errors: [],
          warnings: [],
          suggestions: [],
          score: 1.0
        };
    }
  }

  /**
   * Validate company details step
   */
  private async validateCompanyDetails(data: any): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: string[] = [];

    // Required fields
    if (!data.name?.trim()) {
      errors.push({
        field: 'name',
        code: 'MISSING_COMPANY_NAME',
        message: 'Company name is required',
        severity: 'error'
      });
    }

    if (!data.domain?.trim()) {
      errors.push({
        field: 'domain',
        code: 'MISSING_DOMAIN',
        message: 'Company domain is required',
        severity: 'error'
      });
    } else {
      // Domain format validation
      const domainErrors = await this.validateDomain(data.domain);
      errors.push(...domainErrors);
    }

    // Industry validation
    if (!data.industry) {
      warnings.push({
        field: 'industry',
        message: 'Industry selection improves plan recommendations',
        suggestion: 'Select your industry for personalized suggestions'
      });
    }

    // Company size validation
    if (!data.size) {
      suggestions.push('Company size helps determine appropriate plan limits');
    }

    // Address validation
    if (data.address) {
      const addressValidation = this.validateAddress(data.address);
      errors.push(...addressValidation.errors);
      warnings.push(...addressValidation.warnings);
    }

    // Tax ID validation (if provided)
    if (data.taxId) {
      const taxValidation = await this.validateTaxId(data.taxId, data.country);
      errors.push(...taxValidation.errors);
    }

    const score = this.calculateValidationScore(errors, warnings);
    const valid = errors.length === 0;

    return {
      valid,
      errors,
      warnings,
      suggestions,
      score
    };
  }

  /**
   * Validate contact information step
   */
  private async validateContactInformation(data: any): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: string[] = [];

    // Primary contact validation
    if (!data.primary) {
      errors.push({
        field: 'primary',
        code: 'MISSING_PRIMARY_CONTACT',
        message: 'Primary contact information is required',
        severity: 'error'
      });
    } else {
      const primaryValidation = await this.validateContactPerson(data.primary, 'primary');
      errors.push(...primaryValidation.errors);
      warnings.push(...primaryValidation.warnings);
    }

    // Billing contact validation (if different from primary)
    if (data.billing && data.billing.email !== data.primary?.email) {
      const billingValidation = await this.validateContactPerson(data.billing, 'billing');
      errors.push(...billingValidation.errors);
      warnings.push(...billingValidation.warnings);
    }

    // Technical contact validation
    if (data.technical) {
      const technicalValidation = await this.validateContactPerson(data.technical, 'technical');
      errors.push(...technicalValidation.errors);
      warnings.push(...technicalValidation.warnings);
    }

    const score = this.calculateValidationScore(errors, warnings);
    const valid = errors.length === 0;

    return {
      valid,
      errors,
      warnings,
      suggestions,
      score
    };
  }

  /**
   * Validate business verification step
   */
  private async validateBusinessVerification(data: any): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: string[] = [];

    // Business type validation
    if (!data.businessType) {
      errors.push({
        field: 'businessType',
        code: 'MISSING_BUSINESS_TYPE',
        message: 'Business type selection is required',
        severity: 'error'
      });
    }

    // Incorporation date validation
    if (data.incorporationDate) {
      const dateValidation = this.validateIncorporationDate(data.incorporationDate);
      errors.push(...dateValidation.errors);
    }

    // Business registration validation
    if (data.registrationNumber) {
      const registrationValidation = await this.validateBusinessRegistration(data.registrationNumber, data.country);
      errors.push(...registrationValidation.errors);
      warnings.push(...registrationValidation.warnings);
    }

    // Financial information validation
    if (data.annualRevenue) {
      const revenueValidation = this.validateAnnualRevenue(data.annualRevenue);
      warnings.push(...revenueValidation.warnings);
    }

    const score = this.calculateValidationScore(errors, warnings);
    const valid = errors.length === 0;

    return {
      valid,
      errors,
      warnings,
      suggestions,
      score
    };
  }

  /**
   * Validate system configuration step
   */
  private async validateSystemConfiguration(data: any): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: string[] = [];

    // Plan validation
    if (!data.plan) {
      errors.push({
        field: 'plan',
        code: 'MISSING_PLAN',
        message: 'Plan selection is required',
        severity: 'error'
      });
    } else {
      const planValidation = await this.validatePlanSelection(data.plan, data.companySize);
      warnings.push(...planValidation.warnings);
      suggestions.push(...planValidation.suggestions);
    }

    // Features validation
    if (data.features && data.features.length > 0) {
      const featureValidation = this.validateFeatureSelection(data.features, data.plan);
      errors.push(...featureValidation.errors);
      warnings.push(...featureValidation.warnings);
    }

    // Integrations validation
    if (data.integrations) {
      const integrationValidation = this.validateIntegrations(data.integrations);
      errors.push(...integrationValidation.errors);
    }

    // Security settings validation
    if (data.securitySettings) {
      const securityValidation = this.validateSecuritySettings(data.securitySettings);
      errors.push(...securityValidation.errors);
      warnings.push(...securityValidation.warnings);
    }

    const score = this.calculateValidationScore(errors, warnings);
    const valid = errors.length === 0;

    return {
      valid,
      errors,
      warnings,
      suggestions,
      score
    };
  }

  /**
   * Validate document upload
   */
  async validateDocument(documentType: string, file: any): Promise<DocumentValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: string[] = [];

    // File type validation
    const allowedTypes = this.getAllowedFileTypes(documentType);
    if (!allowedTypes.includes(file.mimetype)) {
      errors.push({
        field: 'file',
        code: 'INVALID_FILE_TYPE',
        message: `File type ${file.mimetype} not allowed. Allowed types: ${allowedTypes.join(', ')}`,
        severity: 'error'
      });
    }

    // File size validation
    const maxSize = this.getMaxFileSize(documentType);
    if (file.size > maxSize) {
      errors.push({
        field: 'file',
        code: 'FILE_TOO_LARGE',
        message: `File size ${file.size} bytes exceeds maximum ${maxSize} bytes`,
        severity: 'error'
      });
    }

    // File name validation
    if (!file.originalname || file.originalname.length < 3) {
      warnings.push({
        field: 'file',
        message: 'File name seems incomplete',
        suggestion: 'Use a descriptive file name'
      });
    }

    // Virus scan simulation
    const virusCheck = await this.performVirusScan(file);
    if (!virusCheck.safe) {
      errors.push({
        field: 'file',
        code: 'VIRUS_DETECTED',
        message: 'File failed security scan',
        severity: 'error'
      });
    }

    const score = this.calculateValidationScore(errors, warnings);
    const valid = errors.length === 0;

    return {
      valid,
      errors,
      warnings,
      suggestions,
      score,
      authenticityScore: 0.95, // Placeholder
      fraudIndicators: [] // Placeholder
    };
  }

  /**
   * Validate business registration number
   */
  private async validateBusinessRegistration(registrationNumber: string, country: string): Promise<{
    errors: ValidationError[];
    warnings: ValidationWarning[];
  }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Country-specific validation
    switch (country?.toLowerCase()) {
      case 'us':
        if (!/^\d{9}$/.test(registrationNumber.replace(/[-\s]/g, ''))) {
          errors.push({
            field: 'registrationNumber',
            code: 'INVALID_US_EIN',
            message: 'US EIN should be 9 digits',
            severity: 'error'
          });
        }
        break;
      case 'uk':
        if (!/^[A-Z]{2}\d{6}$/.test(registrationNumber.replace(/\s/g, ''))) {
          warnings.push({
            field: 'registrationNumber',
            message: 'UK company number format may be incorrect',
            suggestion: 'Format should be 2 letters followed by 6 digits'
          });
        }
        break;
      // Add more country validations as needed
    }

    return { errors, warnings };
  }

  /**
   * Validate tax ID
   */
  private async validateTaxId(taxId: string, country: string): Promise<{
    errors: ValidationError[];
  }> {
    const errors: ValidationError[] = [];

    // Remove formatting characters
    const cleanTaxId = taxId.replace(/[-\s]/g, '');

    switch (country?.toLowerCase()) {
      case 'us':
        // EIN validation (XX-XXXXXXX)
        if (!/^\d{9}$/.test(cleanTaxId)) {
          errors.push({
            field: 'taxId',
            code: 'INVALID_US_EIN',
            message: 'US EIN should be 9 digits',
            severity: 'error'
          });
        }
        break;
      case 'ca':
        // Canadian BN validation
        if (!/^\d{9}[A-Z]{2}\d{4}$/.test(cleanTaxId.toUpperCase())) {
          errors.push({
            field: 'taxId',
            code: 'INVALID_CA_BN',
            message: 'Canadian Business Number format is incorrect',
            severity: 'error'
          });
        }
        break;
      // Add more tax ID validations
    }

    return { errors };
  }

  /**
   * Validate domain
   */
  private async validateDomain(domain: string): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // Basic domain format validation
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!domainRegex.test(domain)) {
      errors.push({
        field: 'domain',
        code: 'INVALID_DOMAIN_FORMAT',
        message: 'Domain format is invalid',
        severity: 'error'
      });
    }

    // Check for common typos
    const commonTypos = ['gmai.com', 'gmial.com', 'hotmai.com', 'yaho.com'];
    if (commonTypos.some(typo => domain.includes(typo))) {
      errors.push({
        field: 'domain',
        code: 'DOMAIN_TYPO_DETECTED',
        message: 'Domain appears to contain a typo',
        severity: 'warning'
      });
    }

    // DNS lookup (optional - can be expensive)
    try {
      const dnsResult = await this.performDNSLookup(domain);
      if (!dnsResult.exists) {
        errors.push({
          field: 'domain',
          code: 'DOMAIN_NOT_FOUND',
          message: 'Domain does not appear to exist',
          severity: 'warning'
        });
      }
    } catch (error) {
      // DNS lookup failed - don't block registration
    }

    return errors;
  }

  /**
   * Validate contact person
   */
  private async validateContactPerson(contact: any, type: string): Promise<{
    errors: ValidationError[];
    warnings: ValidationWarning[];
  }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Name validation
    if (!contact.firstName?.trim()) {
      errors.push({
        field: `${type}.firstName`,
        code: 'MISSING_FIRST_NAME',
        message: `${type} contact first name is required`,
        severity: 'error'
      });
    }

    if (!contact.lastName?.trim()) {
      errors.push({
        field: `${type}.lastName`,
        code: 'MISSING_LAST_NAME',
        message: `${type} contact last name is required`,
        severity: 'error'
      });
    }

    // Email validation
    if (!contact.email) {
      errors.push({
        field: `${type}.email`,
        code: 'MISSING_EMAIL',
        message: `${type} contact email is required`,
        severity: 'error'
      });
    } else if (!this.isValidEmail(contact.email)) {
      errors.push({
        field: `${type}.email`,
        code: 'INVALID_EMAIL',
        message: `${type} contact email format is invalid`,
        severity: 'error'
      });
    }

    // Phone validation
    if (!contact.phone) {
      errors.push({
        field: `${type}.phone`,
        code: 'MISSING_PHONE',
        message: `${type} contact phone is required`,
        severity: 'error'
      });
    } else {
      const phoneValidation = this.validatePhoneNumber(contact.phone, contact.country);
      errors.push(...phoneValidation.errors);
    }

    // Role validation
    if (!contact.role) {
      warnings.push({
        field: `${type}.role`,
        message: `${type} contact role helps us understand their responsibilities`,
        suggestion: 'Please specify the contact\'s role in the company'
      });
    }

    return { errors, warnings };
  }

  /**
   * Validate address
   */
  private validateAddress(address: any): {
    errors: ValidationError[];
    warnings: ValidationWarning[];
  } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!address.street?.trim()) {
      errors.push({
        field: 'address.street',
        code: 'MISSING_STREET',
        message: 'Street address is required',
        severity: 'error'
      });
    }

    if (!address.city?.trim()) {
      errors.push({
        field: 'address.city',
        code: 'MISSING_CITY',
        message: 'City is required',
        severity: 'error'
      });
    }

    if (!address.country) {
      errors.push({
        field: 'address.country',
        code: 'MISSING_COUNTRY',
        message: 'Country is required',
        severity: 'error'
      });
    }

    if (!address.postalCode && address.country === 'US') {
      errors.push({
        field: 'address.postalCode',
        code: 'MISSING_POSTAL_CODE',
        message: 'ZIP code is required for US addresses',
        severity: 'error'
      });
    }

    return { errors, warnings };
  }

  /**
   * Validate incorporation date
   */
  private validateIncorporationDate(date: string): {
    errors: ValidationError[];
  } {
    const errors: ValidationError[] = [];
    const incorporationDate = new Date(date);
    const now = new Date();

    if (isNaN(incorporationDate.getTime())) {
      errors.push({
        field: 'incorporationDate',
        code: 'INVALID_DATE',
        message: 'Incorporation date format is invalid',
        severity: 'error'
      });
    } else if (incorporationDate > now) {
      errors.push({
        field: 'incorporationDate',
        code: 'FUTURE_DATE',
        message: 'Incorporation date cannot be in the future',
        severity: 'error'
      });
    }

    return { errors };
  }

  /**
   * Validate annual revenue
   */
  private validateAnnualRevenue(revenue: number): {
    warnings: ValidationWarning[];
  } {
    const warnings: ValidationWarning[] = [];

    if (revenue < 0) {
      warnings.push({
        field: 'annualRevenue',
        message: 'Annual revenue cannot be negative',
        suggestion: 'Please enter a positive value'
      });
    }

    if (revenue > 1000000000) { // $1B
      warnings.push({
        field: 'annualRevenue',
        message: 'Very high revenue reported - please verify',
        suggestion: 'Consider confirming this figure with financial records'
      });
    }

    return { warnings };
  }

  /**
   * Validate plan selection
   */
  private async validatePlanSelection(plan: string, companySize: string): Promise<{
    warnings: ValidationWarning[];
    suggestions: string[];
  }> {
    const warnings: ValidationWarning[] = [];
    const suggestions: string[] = [];

    const planLimits = {
      starter: { maxUsers: 5, features: ['basic'] },
      professional: { maxUsers: 25, features: ['basic', 'api'] },
      enterprise: { maxUsers: 1000, features: ['basic', 'api', 'white_label'] }
    };

    const selectedPlan = planLimits[plan as keyof typeof planLimits];
    if (!selectedPlan) {
      warnings.push({
        field: 'plan',
        message: 'Selected plan may not be available',
        suggestion: 'Please choose from available plans'
      });
    }

    // Suggest plan upgrades based on company size
    if (companySize === 'enterprise' && plan === 'starter') {
      suggestions.push('Consider upgrading to Enterprise plan for unlimited users and advanced features');
    }

    return { warnings, suggestions };
  }

  /**
   * Validate feature selection
   */
  private validateFeatureSelection(features: string[], plan: string): {
    errors: ValidationError[];
    warnings: ValidationWarning[];
  } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const planFeatures = {
      starter: ['basic_setup', 'user_management'],
      professional: ['basic_setup', 'user_management', 'api_access', 'advanced_reporting'],
      enterprise: ['basic_setup', 'user_management', 'api_access', 'advanced_reporting', 'white_label', 'custom_integrations']
    };

    const allowedFeatures = planFeatures[plan as keyof typeof planFeatures] || [];

    for (const feature of features) {
      if (!allowedFeatures.includes(feature)) {
        warnings.push({
          field: 'features',
          message: `Feature '${feature}' may not be available in ${plan} plan`,
          suggestion: 'Consider upgrading plan or remove incompatible features'
        });
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate integrations
   */
  private validateIntegrations(integrations: string[]): {
    errors: ValidationError[];
  } {
    const errors: ValidationError[] = [];
    const supportedIntegrations = ['slack', 'teams', 'zapier', 'webhook', 'api'];

    for (const integration of integrations) {
      if (!supportedIntegrations.includes(integration)) {
        errors.push({
          field: 'integrations',
          code: 'UNSUPPORTED_INTEGRATION',
          message: `Integration '${integration}' is not currently supported`,
          severity: 'error'
        });
      }
    }

    return { errors };
  }

  /**
   * Validate security settings
   */
  private validateSecuritySettings(settings: any): {
    errors: ValidationError[];
    warnings: ValidationWarning[];
  } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (settings.mfaRequired && !settings.mfaMethods?.length) {
      errors.push({
        field: 'securitySettings.mfaMethods',
        code: 'MISSING_MFA_METHODS',
        message: 'MFA methods must be specified when MFA is required',
        severity: 'error'
      });
    }

    if (settings.sessionTimeout < 300) { // 5 minutes
      warnings.push({
        field: 'securitySettings.sessionTimeout',
        message: 'Very short session timeout may impact user experience',
        suggestion: 'Consider increasing to at least 15 minutes'
      });
    }

    return { errors, warnings };
  }

  // Utility methods

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private validatePhoneNumber(phone: string, country?: string): {
    errors: ValidationError[];
  } {
    const errors: ValidationError[] = [];
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');

    // Basic phone validation
    if (!/^\+?[\d\s\-\(\)]{10,15}$/.test(phone)) {
      errors.push({
        field: 'phone',
        code: 'INVALID_PHONE_FORMAT',
        message: 'Phone number format is invalid',
        severity: 'error'
      });
    }

    return { errors };
  }

  private getAllowedFileTypes(documentType: string): string[] {
    const typeMap: { [key: string]: string[] } = {
      business_license: ['application/pdf', 'image/jpeg', 'image/png'],
      tax_certificate: ['application/pdf', 'image/jpeg', 'image/png'],
      address_proof: ['application/pdf', 'image/jpeg', 'image/png'],
      id_proof: ['application/pdf', 'image/jpeg', 'image/png']
    };

    return typeMap[documentType] || ['application/pdf'];
  }

  private getMaxFileSize(documentType: string): number {
    // 10MB default
    return 10 * 1024 * 1024;
  }

  private async performVirusScan(file: any): Promise<{ safe: boolean }> {
    // Simulate virus scan
    return { safe: true };
  }

  private async performDNSLookup(domain: string): Promise<{ exists: boolean }> {
    // Simulate DNS lookup
    return { exists: true };
  }

  private calculateValidationScore(errors: ValidationError[], warnings: ValidationWarning[]): number {
    const errorPenalty = errors.length * 0.3;
    const warningPenalty = warnings.length * 0.1;

    return Math.max(0, Math.min(1, 1 - errorPenalty - warningPenalty));
  }
}

// Export singleton instance
export const onboardingValidation = new OnboardingValidation();