# Comprehensive Multi-Tiered Registration System - DakDam Binary MLM Platform

## Executive Overview

This specification outlines a comprehensive, enterprise-grade multi-tiered registration system for the DakDam Binary MLM platform. The system accommodates three distinct user flows with unique data schemas, validation logic, and user experiences while maintaining a unified backend architecture and consistent branding.

## System Architecture

### Core Principles
- **Unified Backend**: Single codebase handling all registration types
- **Progressive Enhancement**: Features unlock based on registration type
- **Data Integrity**: Consistent validation across all flows
- **Scalability**: Handle thousands of concurrent registrations
- **Security**: Enterprise-grade encryption and fraud prevention
- **Analytics**: Comprehensive tracking and conversion optimization

### Technical Stack
```
Frontend: Next.js 15 + React + TypeScript + Tailwind CSS
Backend: Node.js + Express + Prisma + PostgreSQL
Validation: Zod + Custom business logic
Authentication: JWT + MFA support
File Storage: AWS S3 / Cloudflare R2
Email: SendGrid / AWS SES
Analytics: Custom events + Mixpanel integration
```

## 1. B2B Enterprise Onboarding (Company Registration)

### Overview
High-touch registration process for MLM marketing firms licensing the DakDam Binary system. Creates a new independent ecosystem with full administrative control.

### Data Fields & Validation Rules

#### **Step 1: Company Identity**
```typescript
interface CompanyIdentity {
  // Required Fields
  legalEntityName: string;           // 2-100 chars, alphanumeric + special chars
  businessRegistrationNumber: string; // Country-specific validation
  taxIdentificationNumber: string;   // Country-specific format
  incorporationCountry: string;       // ISO country code
  incorporationDate: Date;           // Must be in past, max 50 years old

  // Optional Fields
  dbaName?: string;                  // Doing Business As name
  industryCategory?: string;         // Predefined categories
  companyWebsite?: string;           // Valid URL format
  companyDescription?: string;       // 50-500 characters
}
```

#### **Step 2: Corporate Contact Information**
```typescript
interface CorporateContact {
  // Primary Contact (Required)
  primaryContact: {
    firstName: string;               // 2-50 chars, letters + hyphens
    lastName: string;                // 2-50 chars, letters + hyphens
    title: string;                   // Job title/role
    email: string;                   // Corporate email validation
    phoneNumber: string;             // E.164 international format
    phoneExtension?: string;         // Max 5 digits
  };

  // Billing Contact (Optional, defaults to primary)
  billingContact?: {
    firstName: string;
    lastName: string;
    email: string;                   // Must be different from primary if specified
    phoneNumber: string;
  };

  // Technical Contact (Optional)
  technicalContact?: {
    firstName: string;
    lastName: string;
    email: string;                   // Must be different from others
    phoneNumber: string;
  };
}
```

#### **Step 3: System Configuration**
```typescript
interface SystemConfiguration {
  // Subscription Plan (Required)
  subscriptionPlan: 'starter' | 'professional' | 'enterprise' | 'custom';

  // Feature Selection (Plan-dependent)
  selectedFeatures: string[];        // Predefined feature set based on plan

  // Branding Customization (Optional)
  branding: {
    primaryColor?: string;           // Hex color code
    logo?: File;                     // PNG/JPG, max 2MB, min 200x200px
    favicon?: File;                  // ICO/PNG, max 100KB, 32x32px
    customDomain?: string;           // Valid domain format
  };

  // Security Settings
  securityLevel: 'standard' | 'enhanced' | 'maximum';
  mfaRequired: boolean;
  ipRestrictions?: string[];         // CIDR notation
}
```

#### **Step 4: Administrative Setup**
```typescript
interface AdministrativeSetup {
  // Super Admin Account
  superAdmin: {
    firstName: string;               // 2-50 chars
    lastName: string;                // 2-50 chars
    email: string;                   // Must be corporate domain
    phoneNumber: string;             // E.164 format
    password: string;                // Enterprise complexity requirements
    confirmPassword: string;
  };

  // Company Preferences
  preferences: {
    timezone: string;                // IANA timezone
    currency: string;                // ISO 4217 currency code
    language: string;                // ISO 639-1 language code
    dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  };

  // Legal Acceptance
  legalAcceptance: {
    termsOfService: boolean;         // Must be true
    privacyPolicy: boolean;          // Must be true
    dataProcessingAgreement: boolean; // Required for EU companies
    gdprCompliance?: boolean;        // Required if company in EU
  };
}
```

### Validation Logic

#### **Business Rules**
```typescript
class B2BValidationEngine {
  // Company Identity Validation
  async validateCompanyIdentity(data: CompanyIdentity): Promise<ValidationResult> {
    const errors = [];

    // Legal entity name uniqueness
    const existingCompany = await prisma.company.findFirst({
      where: { legalEntityName: data.legalEntityName }
    });
    if (existingCompany) {
      errors.push({
        field: 'legalEntityName',
        code: 'COMPANY_NAME_EXISTS',
        message: 'A company with this legal name already exists'
      });
    }

    // Business registration validation by country
    const registrationValid = await this.validateBusinessRegistration(
      data.businessRegistrationNumber,
      data.incorporationCountry
    );
    if (!registrationValid) {
      errors.push({
        field: 'businessRegistrationNumber',
        code: 'INVALID_BUSINESS_REGISTRATION',
        message: 'Business registration number format is invalid for selected country'
      });
    }

    // Incorporation date validation
    const ageInYears = (Date.now() - data.incorporationDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (ageInYears < 0 || ageInYears > 50) {
      errors.push({
        field: 'incorporationDate',
        code: 'INVALID_INCORPORATION_DATE',
        message: 'Incorporation date must be within the last 50 years'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      score: this.calculateValidationScore(errors)
    };
  }

  // Corporate Contact Validation
  async validateCorporateContacts(data: CorporateContact): Promise<ValidationResult> {
    const errors = [];

    // Email domain validation (must be corporate)
    const primaryDomain = data.primaryContact.email.split('@')[1];
    const isCorporateEmail = await this.validateCorporateEmailDomain(primaryDomain);

    if (!isCorporateEmail) {
      errors.push({
        field: 'primaryContact.email',
        code: 'NON_CORPORATE_EMAIL',
        message: 'Primary contact must use a corporate email address'
      });
    }

    // Phone number validation with country context
    const phoneValid = await this.validateInternationalPhone(data.primaryContact.phoneNumber);
    if (!phoneValid) {
      errors.push({
        field: 'primaryContact.phoneNumber',
        code: 'INVALID_PHONE_FORMAT',
        message: 'Phone number must be in international format (e.g., +1234567890)'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      score: this.calculateValidationScore(errors)
    };
  }

  // System Configuration Validation
  async validateSystemConfiguration(data: SystemConfiguration): Promise<ValidationResult> {
    const errors = [];

    // Plan-specific feature validation
    const allowedFeatures = this.getFeaturesForPlan(data.subscriptionPlan);
    const invalidFeatures = data.selectedFeatures.filter(f => !allowedFeatures.includes(f));

    if (invalidFeatures.length > 0) {
      errors.push({
        field: 'selectedFeatures',
        code: 'INVALID_FEATURE_SELECTION',
        message: `Features not available in ${data.subscriptionPlan} plan: ${invalidFeatures.join(', ')}`
      });
    }

    // Custom domain validation
    if (data.branding?.customDomain) {
      const domainValid = await this.validateDomainOwnership(data.branding.customDomain);
      if (!domainValid) {
        errors.push({
          field: 'branding.customDomain',
          code: 'DOMAIN_NOT_OWNED',
          message: 'Please verify domain ownership before proceeding'
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      score: this.calculateValidationScore(errors)
    };
  }
}
```

### UI/UX Design - Enterprise Onboarding

#### **Step-by-Step Progressive Disclosure**
```
┌─────────────────────────────────────────────────────────┐
│ 🏢 DakDam Binary MLM - Enterprise Onboarding          │
│                                                         │
│ Step 1 of 4: Company Identity          [••••] 25%       │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 📋 Company Information                              │ │
│ │                                                     │ │
│ │ Legal Entity Name *                                 │ │
│ │ [DakDam Marketing Solutions LLC________________]    │ │
│ │                                                     │ │
│ │ Business Registration # *                           │ │
│ │ [123456789_____________________________________]    │ │
│ │                                                     │ │
│ │ Tax ID *                                           │ │
│ │ [98-7654321___________________________________]    │ │
│ │                                                     │ │
│ │ Country of Incorporation *                          │ │
│ │ [🇺🇸 United States ____________________________]     │ │
│ │                                                     │ │
│ │ Date of Incorporation *                             │ │
│ │ [📅 01/15/2020 _______________________________]     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [Back]                                      [Continue]  │
└─────────────────────────────────────────────────────────┘
```

#### **Advanced Features**
- **Document Upload**: Drag-and-drop for incorporation documents
- **Real-time Validation**: Field-by-field validation with suggestions
- **Progress Persistence**: Auto-save every 60 seconds with 7-day retention
- **Plan Comparison**: Interactive pricing calculator with feature matrix
- **Security Assessment**: Pre-launch security configuration wizard

### Database Schema - B2B Registration

```sql
-- B2B Company Registrations
CREATE TABLE b2b_company_registrations (
    id VARCHAR(36) PRIMARY KEY,
    status ENUM('draft', 'submitted', 'verifying', 'verified', 'provisioning', 'active', 'rejected'),
    current_step VARCHAR(50) DEFAULT 'company_identity',

    -- Company Identity
    legal_entity_name VARCHAR(255) NOT NULL,
    business_registration_number VARCHAR(100) NOT NULL,
    tax_identification_number VARCHAR(100) NOT NULL,
    incorporation_country CHAR(2) NOT NULL,
    incorporation_date DATE NOT NULL,
    dba_name VARCHAR(255),
    industry_category VARCHAR(100),
    company_website VARCHAR(255),
    company_description TEXT,

    -- Corporate Contacts (JSON)
    corporate_contacts JSON NOT NULL,

    -- System Configuration (JSON)
    system_configuration JSON NOT NULL,

    -- Administrative Setup (JSON)
    administrative_setup JSON NOT NULL,

    -- Metadata
    ip_address INET,
    user_agent TEXT,
    referral_source VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,

    -- Indexes
    INDEX idx_status (status),
    INDEX idx_country (incorporation_country),
    INDEX idx_created (created_at),
    INDEX idx_legal_name (legal_entity_name),

    -- Constraints
    UNIQUE KEY unique_legal_name (legal_entity_name),
    UNIQUE KEY unique_registration (business_registration_number, incorporation_country)
);

-- B2B Registration Steps
CREATE TABLE b2b_registration_steps (
    id VARCHAR(36) PRIMARY KEY,
    registration_id VARCHAR(36) NOT NULL,
    step_name VARCHAR(100) NOT NULL,
    status ENUM('pending', 'in_progress', 'completed', 'error'),
    step_data JSON,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,

    FOREIGN KEY (registration_id) REFERENCES b2b_company_registrations(id) ON DELETE CASCADE,
    INDEX idx_registration (registration_id),
    INDEX idx_step (step_name),
    INDEX idx_status (status)
);

-- B2B Document Verifications
CREATE TABLE b2b_document_verifications (
    id VARCHAR(36) PRIMARY KEY,
    registration_id VARCHAR(36) NOT NULL,
    document_type VARCHAR(50) NOT NULL,
    document_name VARCHAR(255),
    file_path VARCHAR(500),
    file_size INT,
    mime_type VARCHAR(100),
    extracted_data JSON,
    verification_status ENUM('pending', 'processing', 'verified', 'rejected'),
    verification_score DECIMAL(3,2),
    verified_at TIMESTAMP,
    verified_by VARCHAR(36),
    rejection_reason TEXT,

    FOREIGN KEY (registration_id) REFERENCES b2b_company_registrations(id) ON DELETE CASCADE,
    INDEX idx_registration (registration_id),
    INDEX idx_status (verification_status),
    INDEX idx_type (document_type)
);

-- B2B Registration Events (Audit Trail)
CREATE TABLE b2b_registration_events (
    id VARCHAR(36) PRIMARY KEY,
    registration_id VARCHAR(36) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_data JSON,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (registration_id) REFERENCES b2b_company_registrations(id) ON DELETE CASCADE,
    INDEX idx_registration (registration_id),
    INDEX idx_event_type (event_type),
    INDEX idx_created (created_at)
);
```

## 2. B2C Direct Company Selection (Individual-to-Existing Company)

### Overview
Streamlined registration for individuals joining existing MLM companies in the DakDam ecosystem. Focus on speed and simplicity while maintaining data integrity.

### Data Fields & Validation Rules

#### **Step 1: Company Discovery**
```typescript
interface CompanyDiscovery {
  // Company Selection (Required)
  selectedCompanyId: string;         // Valid company UUID
  searchQuery?: string;              // For company search
  filterCriteria?: {
    industry?: string;
    location?: string;
    companySize?: 'small' | 'medium' | 'large';
  };

  // Account Type Selection (Required)
  accountType: 'customer' | 'distributor';
}
```

#### **Step 2: Personal Information**
```typescript
interface PersonalInformation {
  // Basic Information (Required)
  firstName: string;                 // 2-50 chars, letters + hyphens + apostrophes
  lastName: string;                  // 2-50 chars, letters + hyphens + apostrophes
  dateOfBirth: Date;                 // Must be 18+ years old
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';

  // Contact Information (Email OR Phone required)
  email?: string;                    // Valid email format, unique across platform
  phoneNumber?: string;              // E.164 international format, unique if provided

  // Address Information (Required for distributors)
  address: {
    streetAddress: string;           // 5-100 chars
    city: string;                    // 2-50 chars
    stateProvince: string;           // 2-50 chars or state code
    postalCode: string;              // Country-specific format
    country: string;                 // ISO country code
  };
}
```

#### **Step 3: Account Security**
```typescript
interface AccountSecurity {
  // Authentication (Required)
  password: string;                  // 8-128 chars with complexity requirements
  confirmPassword: string;           // Must match password

  // Security Questions (Optional but recommended)
  securityQuestions?: Array<{
    question: string;                // Predefined questions
    answer: string;                  // 3-100 chars, case-insensitive
  }>;

  // Multi-Factor Authentication Setup (Optional)
  mfaSetup?: {
    method: 'sms' | 'email' | 'authenticator';
    phoneNumber?: string;            // Required for SMS
    email?: string;                  // Required for email
  };

  // Marketing Preferences (Optional)
  marketingPreferences: {
    emailMarketing: boolean;
    smsMarketing: boolean;
    promotionalOffers: boolean;
  };
}
```

#### **Step 4: Network Integration**
```typescript
interface NetworkIntegration {
  // Sponsor Selection (Required for distributors)
  sponsorId?: string;                // Valid user UUID from selected company
  sponsorSearchQuery?: string;       // For sponsor search

  // Placement Preferences (Optional)
  placementPreferences?: {
    preferredPosition: 'left' | 'right' | 'auto';
    placementNotes?: string;         // Max 500 chars
  };

  // Initial Product Selection (Optional)
  initialProductPurchase?: {
    productId: string;
    quantity: number;
    paymentMethodId?: string;
  };

  // Terms Acceptance (Required)
  legalAcceptance: {
    termsOfService: boolean;         // Must be true
    privacyPolicy: boolean;          // Must be true
    companyPolicies: boolean;        // Company-specific policies
    ageVerification: boolean;        // Must be 18+
  };
}
```

### Validation Logic

#### **Progressive Validation Engine**
```typescript
class B2CValidationEngine {
  // Company Selection Validation
  async validateCompanySelection(data: CompanyDiscovery): Promise<ValidationResult> {
    const errors = [];

    // Verify company exists and is active
    const company = await prisma.company.findUnique({
      where: { id: data.selectedCompanyId }
    });

    if (!company) {
      errors.push({
        field: 'selectedCompanyId',
        code: 'COMPANY_NOT_FOUND',
        message: 'Selected company not found in our system'
      });
    } else if (!company.isActive) {
      errors.push({
        field: 'selectedCompanyId',
        code: 'COMPANY_INACTIVE',
        message: 'Selected company is currently inactive'
      });
    }

    // Account type validation
    if (!['customer', 'distributor'].includes(data.accountType)) {
      errors.push({
        field: 'accountType',
        code: 'INVALID_ACCOUNT_TYPE',
        message: 'Please select a valid account type'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      score: this.calculateValidationScore(errors)
    };
  }

  // Personal Information Validation
  async validatePersonalInformation(data: PersonalInformation): Promise<ValidationResult> {
    const errors = [];

    // Age verification
    const age = this.calculateAge(data.dateOfBirth);
    if (age < 18) {
      errors.push({
        field: 'dateOfBirth',
        code: 'UNDERAGE_USER',
        message: 'You must be at least 18 years old to register'
      });
    }

    // Contact information validation
    if (!data.email && !data.phoneNumber) {
      errors.push({
        field: 'contact',
        code: 'MISSING_CONTACT_INFO',
        message: 'Either email or phone number is required'
      });
    }

    // Email uniqueness check
    if (data.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email }
      });
      if (existingUser) {
        errors.push({
          field: 'email',
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'An account with this email already exists'
        });
      }
    }

    // Address validation for distributors
    if (data.accountType === 'distributor') {
      const addressErrors = await this.validateAddress(data.address);
      errors.push(...addressErrors);
    }

    return {
      valid: errors.length === 0,
      errors,
      score: this.calculateValidationScore(errors)
    };
  }

  // Security Validation
  async validateAccountSecurity(data: AccountSecurity): Promise<ValidationResult> {
    const errors = [];

    // Password complexity
    const passwordErrors = this.validatePasswordComplexity(data.password);
    errors.push(...passwordErrors);

    // Confirm password match
    if (data.password !== data.confirmPassword) {
      errors.push({
        field: 'confirmPassword',
        code: 'PASSWORD_MISMATCH',
        message: 'Passwords do not match'
      });
    }

    // Security questions validation
    if (data.securityQuestions) {
      const questionErrors = this.validateSecurityQuestions(data.securityQuestions);
      errors.push(...questionErrors);
    }

    return {
      valid: errors.length === 0,
      errors,
      score: this.calculateValidationScore(errors)
    };
  }

  // Network Integration Validation
  async validateNetworkIntegration(data: NetworkIntegration, companyId: string): Promise<ValidationResult> {
    const errors = [];

    // Sponsor validation for distributors
    if (data.accountType === 'distributor') {
      if (!data.sponsorId) {
        errors.push({
          field: 'sponsorId',
          code: 'MISSING_SPONSOR',
          message: 'A sponsor is required for distributor accounts'
        });
      } else {
        const sponsorValid = await this.validateSponsor(data.sponsorId, companyId);
        if (!sponsorValid) {
          errors.push({
            field: 'sponsorId',
            code: 'INVALID_SPONSOR',
            message: 'Selected sponsor is not valid for this company'
          });
        }
      }
    }

    // Legal acceptance validation
    if (!data.legalAcceptance.termsOfService || !data.legalAcceptance.privacyPolicy) {
      errors.push({
        field: 'legalAcceptance',
        code: 'LEGAL_ACCEPTANCE_REQUIRED',
        message: 'You must accept the terms of service and privacy policy'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      score: this.calculateValidationScore(errors)
    };
  }
}
```

### UI/UX Design - Direct Company Selection

#### **Company Discovery Interface**
```
┌─────────────────────────────────────────────────────────┐
│ 🌐 Join DakDam Binary MLM - Find Your Company         │
│                                                         │
│ Search companies by name, industry, or location...      │
│ [🔍 _______________________________________________]    │
│                                                         │
│ 📊 Popular Companies                                    │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🏢 DakDam Global Marketing                        │ │
│ │ 🌟 4.8/5 (2,341 members)                          │ │
│ │ 📍 United States | 💼 Health & Wellness          │ │
│ │ [View Details] [Join Now]                         │ │
│ └─────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🏢 Wellness Solutions Inc                          │ │
│ │ 🌟 4.6/5 (1,892 members)                          │ │
│ │ 📍 Canada | 💼 Nutrition                          │ │
│ │ [View Details] [Join Now]                         │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Filters: [All] [Health] [Tech] [Finance] [Location ▼]   │
│                                                         │
│ Account Type:                                           │
│ ○ Customer (Purchase products)                          │
│ ○ Distributor (Build network & earn commissions)        │
│                                                         │
│ [Continue to Registration]                              │
└─────────────────────────────────────────────────────────┘
```

#### **Streamlined Registration Flow**
```
Step 1: Company Selection → Step 2: Personal Info → Step 3: Security → Step 4: Network
     [2 minutes]                [3 minutes]             [2 minutes]        [2 minutes]
```

### Database Schema - B2C Direct Selection

```sql
-- B2C Individual Registrations
CREATE TABLE b2c_individual_registrations (
    id VARCHAR(36) PRIMARY KEY,
    status ENUM('draft', 'submitted', 'verifying', 'verified', 'provisioning', 'active', 'rejected'),
    current_step VARCHAR(50) DEFAULT 'company_discovery',

    -- Company Selection
    selected_company_id VARCHAR(36) NOT NULL,
    account_type ENUM('customer', 'distributor') NOT NULL,

    -- Personal Information
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender ENUM('male', 'female', 'other', 'prefer_not_to_say'),
    email VARCHAR(255),
    phone_number VARCHAR(20),
    address JSON,

    -- Account Security
    password_hash VARCHAR(255) NOT NULL,
    security_questions JSON,
    mfa_config JSON,
    marketing_preferences JSON,

    -- Network Integration
    sponsor_id VARCHAR(36),
    placement_preferences JSON,
    initial_product_purchase JSON,
    legal_acceptance JSON,

    -- Metadata
    ip_address INET,
    user_agent TEXT,
    referral_source VARCHAR(255),
    registration_source ENUM('direct', 'search', 'social', 'advertisement'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,

    -- Foreign Keys
    FOREIGN KEY (selected_company_id) REFERENCES companies(id),

    -- Indexes
    INDEX idx_status (status),
    INDEX idx_company (selected_company_id),
    INDEX idx_account_type (account_type),
    INDEX idx_email (email),
    INDEX idx_phone (phone_number),
    INDEX idx_created (created_at),

    -- Constraints
    CHECK (email IS NOT NULL OR phone_number IS NOT NULL),
    CHECK (account_type = 'customer' OR sponsor_id IS NOT NULL)
);

-- Company Search Index
CREATE TABLE company_search_index (
    company_id VARCHAR(36) PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    industry VARCHAR(100),
    location VARCHAR(100),
    member_count INT DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0.0,
    is_featured BOOLEAN DEFAULT FALSE,
    search_vector TSVECTOR,

    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,

    INDEX idx_industry (industry),
    INDEX idx_location (location),
    INDEX idx_rating (rating),
    INDEX idx_featured (is_featured),
    INDEX idx_search (search_vector)
);

-- Registration Session Tracking
CREATE TABLE b2c_registration_sessions (
    id VARCHAR(36) PRIMARY KEY,
    registration_id VARCHAR(36),
    device_fingerprint VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_steps JSON,
    session_data JSON,
    is_active BOOLEAN DEFAULT TRUE,

    FOREIGN KEY (registration_id) REFERENCES b2c_individual_registrations(id),
    INDEX idx_registration (registration_id),
    INDEX idx_active (is_active),
    INDEX idx_started (started_at)
);
```

## 3. B2C Referral-Driven Onboarding (Direct Link Registration)

### Overview
Ultra-streamlined registration process triggered by unique referral URLs. Maximizes conversion by pre-populating company and sponsor information, removing friction from the registration flow.

### Data Fields & Validation Rules

#### **Pre-populated from URL Parameters**
```typescript
interface ReferralParameters {
  // URL Parameters (Automatically populated)
  companyId: string;                // From URL: /register?ref=ABC123&company=COMPANY_ID
  sponsorId: string;                // From URL: /register?ref=ABC123&sponsor=SPONSOR_ID
  referralCode: string;             // From URL: /register?ref=ABC123

  // Referral Metadata (Auto-generated)
  referralSource: 'link' | 'email' | 'social' | 'sms';
  campaignId?: string;              // For tracking marketing campaigns
  utmParameters?: {                 // Standard UTM tracking
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };
}
```

#### **Minimal Required Fields**
```typescript
interface ReferralRegistration {
  // Pre-populated (Read-only display)
  companyName: string;              // Display only
  sponsorName: string;              // Display only
  accountType: 'distributor';       // Fixed as distributor for referrals

  // Required User Input
  firstName: string;                // 2-50 chars
  lastName: string;                 // 2-50 chars
  email: string;                    // Valid email, unique
  phoneNumber: string;              // E.164 format, unique
  password: string;                 // 8+ chars with basic requirements
  confirmPassword: string;          // Must match password

  // Optional Enhancements
  profileImage?: File;              // PNG/JPG, max 5MB
  bio?: string;                     // Max 200 chars
  socialLinks?: {                   // Social media profiles
    facebook?: string;
    instagram?: string;
    linkedin?: string;
    twitter?: string;
  };

  // Legal & Marketing
  termsAccepted: boolean;           // Must be true
  marketingConsent: boolean;        // Optional
  ageVerification: boolean;         // Must be true (18+)
}
```

### Validation Logic

#### **Referral Validation Engine**
```typescript
class ReferralValidationEngine {
  // URL Parameter Validation
  async validateReferralParameters(params: ReferralParameters): Promise<ValidationResult> {
    const errors = [];

    // Company validation
    const company = await prisma.company.findUnique({
      where: { id: params.companyId }
    });

    if (!company) {
      errors.push({
        field: 'companyId',
        code: 'INVALID_COMPANY_REFERRAL',
        message: 'The referral link points to an invalid company'
      });
    } else if (!company.isActive) {
      errors.push({
        field: 'companyId',
        code: 'INACTIVE_COMPANY_REFERRAL',
        message: 'The company associated with this referral is currently inactive'
      });
    }

    // Sponsor validation
    if (params.sponsorId) {
      const sponsor = await prisma.user.findUnique({
        where: { id: params.sponsorId }
      });

      if (!sponsor) {
        errors.push({
          field: 'sponsorId',
          code: 'INVALID_SPONSOR_REFERRAL',
          message: 'The referral link points to an invalid sponsor'
        });
      } else if (!sponsor.active) {
        errors.push({
          field: 'sponsorId',
          code: 'INACTIVE_SPONSOR_REFERRAL',
          message: 'The sponsor associated with this referral is currently inactive'
        });
      } else if (sponsor.companyId !== params.companyId) {
        errors.push({
          field: 'sponsorId',
          code: 'SPONSOR_COMPANY_MISMATCH',
          message: 'The sponsor does not belong to the referenced company'
        });
      }
    }

    // Referral code validation
    const referralLink = await prisma.referralLink.findUnique({
      where: { code: params.referralCode }
    });

    if (!referralLink) {
      errors.push({
        field: 'referralCode',
        code: 'INVALID_REFERRAL_CODE',
        message: 'The referral link is invalid or has expired'
      });
    } else if (referralLink.expiresAt && referralLink.expiresAt < new Date()) {
      errors.push({
        field: 'referralCode',
        code: 'EXPIRED_REFERRAL_CODE',
        message: 'The referral link has expired'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      score: this.calculateValidationScore(errors)
    };
  }

  // User Input Validation
  async validateReferralRegistration(data: ReferralRegistration): Promise<ValidationResult> {
    const errors = [];

    // Email uniqueness
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (existingUser) {
      errors.push({
        field: 'email',
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'An account with this email already exists. Please log in instead.'
      });
    }

    // Phone uniqueness (if provided)
    if (data.phoneNumber) {
      const existingPhone = await prisma.user.findUnique({
        where: { phoneNumber: data.phoneNumber }
      });

      if (existingPhone) {
        errors.push({
          field: 'phoneNumber',
          code: 'PHONE_ALREADY_EXISTS',
          message: 'An account with this phone number already exists.'
        });
      }
    }

    // Password validation
    const passwordErrors = this.validatePasswordRequirements(data.password);
    errors.push(...passwordErrors);

    // Password confirmation
    if (data.password !== data.confirmPassword) {
      errors.push({
        field: 'confirmPassword',
        code: 'PASSWORD_MISMATCH',
        message: 'Passwords do not match'
      });
    }

    // Legal acceptance
    if (!data.termsAccepted) {
      errors.push({
        field: 'termsAccepted',
        code: 'TERMS_NOT_ACCEPTED',
        message: 'You must accept the terms of service to continue'
      });
    }

    if (!data.ageVerification) {
      errors.push({
        field: 'ageVerification',
        code: 'AGE_NOT_VERIFIED',
        message: 'You must be at least 18 years old to register'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      score: this.calculateValidationScore(errors)
    };
  }

  // File validation for profile images
  async validateProfileImage(file: File): Promise<ValidationResult> {
    const errors = [];

    // File type validation
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      errors.push({
        field: 'profileImage',
        code: 'INVALID_FILE_TYPE',
        message: 'Profile image must be a JPEG, PNG, or WebP file'
      });
    }

    // File size validation (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      errors.push({
        field: 'profileImage',
        code: 'FILE_TOO_LARGE',
        message: 'Profile image must be less than 5MB'
      });
    }

    // Image dimension validation (would require client-side processing)
    // This would validate minimum dimensions, aspect ratios, etc.

    return {
      valid: errors.length === 0,
      errors,
      score: this.calculateValidationScore(errors)
    };
  }
}
```

### UI/UX Design - Referral-Driven Onboarding

#### **Frictionless Single-Page Design**
```
┌─────────────────────────────────────────────────────────┐
│ 🎯 Welcome to DakDam! You're invited to join...        │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🏢 Company: Wellness Solutions Inc                 │ │
│ │ 👤 Sponsor: Sarah Johnson                          │ │
│ │ 🌟 Rating: 4.8/5 (1,892 members)                   │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Create your account in 60 seconds:                      │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 👤 Personal Information                             │ │
│ │ First Name *        Last Name *                     │ │
│ │ [John____________] [Doe___________]                │ │
│ │                                                     │ │
│ │ 📧 Email Address *                                 │ │
│ │ [john.doe@email.com________________________]        │ │
│ │                                                     │ │
│ │ 📱 Phone Number *                                  │ │
│ │ [+1 (555) 123-4567_________________________]        │ │
│ │                                                     │ │
│ │ 🔒 Password *                                      │ │
│ │ [•••••••••••••••••] Show                      │ │
│ │                                                     │ │
│ │ Confirm Password *                                 │ │
│ │ [•••••••••••••••••]                                │ │
│ │ Password strength: 🟢 Strong                      │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 📸 Profile Picture (Optional)                       │ │
│ │ [📷 Choose File] No file selected                   │ │
│ │                                                     │ │
│ │ ✍️ Bio (Optional)                                   │ │
│ │ Tell us about yourself...                           │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ✅ Legal & Marketing                                │ │
│ │ ☑ I am 18 years or older                           │ │
│ │ ☑ I accept the Terms of Service                    │ │
│ │ ☐ I want to receive marketing emails               │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [🚀 Join Wellness Solutions Inc Now]                   │
│                                                         │
│ * Required fields                                      │
└─────────────────────────────────────────────────────────┘
```

#### **Conversion Optimization Features**
- **Social Proof**: Company rating and member count
- **Trust Indicators**: Verified sponsor badge
- **Progress Indicator**: "60 seconds" messaging
- **Mobile-First**: Optimized for mobile completion
- **One-Click Registration**: Minimal form fields

### Database Schema - Referral-Driven Registration

```sql
-- Referral Links
CREATE TABLE referral_links (
    id VARCHAR(36) PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    sponsor_id VARCHAR(36) NOT NULL,
    company_id VARCHAR(36) NOT NULL,
    campaign_id VARCHAR(36),
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    utm_term VARCHAR(100),
    utm_content VARCHAR(100),
    click_count INT DEFAULT 0,
    conversion_count INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (sponsor_id) REFERENCES users(id),
    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (campaign_id) REFERENCES marketing_campaigns(id),

    INDEX idx_code (code),
    INDEX idx_sponsor (sponsor_id),
    INDEX idx_company (company_id),
    INDEX idx_active (is_active),
    INDEX idx_expires (expires_at)
);

-- Referral Tracking
CREATE TABLE referral_tracking (
    id VARCHAR(36) PRIMARY KEY,
    referral_link_id VARCHAR(36) NOT NULL,
    visitor_ip INET,
    user_agent TEXT,
    referrer_url TEXT,
    device_type VARCHAR(50),
    browser VARCHAR(50),
    location JSON,
    session_id VARCHAR(36),
    converted BOOLEAN DEFAULT FALSE,
    converted_at TIMESTAMP,
    new_user_id VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (referral_link_id) REFERENCES referral_links(id),
    FOREIGN KEY (new_user_id) REFERENCES users(id),

    INDEX idx_referral (referral_link_id),
    INDEX idx_converted (converted),
    INDEX idx_created (created_at)
);

-- B2C Referral Registrations
CREATE TABLE b2c_referral_registrations (
    id VARCHAR(36) PRIMARY KEY,
    status ENUM('draft', 'submitted', 'verifying', 'verified', 'provisioning', 'active', 'rejected'),
    current_step VARCHAR(50) DEFAULT 'personal_info',

    -- Referral Parameters (Pre-populated)
    referral_code VARCHAR(20) NOT NULL,
    company_id VARCHAR(36) NOT NULL,
    sponsor_id VARCHAR(36),
    referral_source VARCHAR(50),
    campaign_id VARCHAR(36),
    utm_parameters JSON,

    -- User Input
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    profile_image_path VARCHAR(500),
    bio TEXT,
    social_links JSON,

    -- Legal & Marketing
    terms_accepted BOOLEAN NOT NULL DEFAULT FALSE,
    marketing_consent BOOLEAN DEFAULT FALSE,
    age_verified BOOLEAN NOT NULL DEFAULT FALSE,

    -- Metadata
    ip_address INET,
    user_agent TEXT,
    device_fingerprint VARCHAR(255),
    registration_duration INT, -- seconds
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Foreign Keys
    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (sponsor_id) REFERENCES users(id),
    FOREIGN KEY (referral_code) REFERENCES referral_links(code),

    -- Indexes
    INDEX idx_status (status),
    INDEX idx_referral_code (referral_code),
    INDEX idx_company (company_id),
    INDEX idx_sponsor (sponsor_id),
    INDEX idx_email (email),
    INDEX idx_created (created_at),

    -- Constraints
    CHECK (terms_accepted = TRUE),
    CHECK (age_verified = TRUE)
);

-- Marketing Campaigns
CREATE TABLE marketing_campaigns (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50), -- email, social, sms, referral
    target_audience JSON,
    budget DECIMAL(10,2),
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_type (type),
    INDEX idx_active (is_active),
    INDEX idx_date_range (start_date, end_date)
);
```

## Unified API Architecture

### **Multi-Tenant Registration Router**
```typescript
// Main registration router with flow detection
const registrationRouter = Router();

// Flow detection middleware
registrationRouter.use('/register', async (req, res, next) => {
  const { ref, company, sponsor } = req.query;

  if (ref) {
    // B2C Referral-Driven flow
    req.registrationFlow = 'referral';
    req.flowParams = { ref, company, sponsor };
  } else if (req.body.companyInfo) {
    // B2B Enterprise flow
    req.registrationFlow = 'enterprise';
  } else {
    // B2C Direct Selection flow
    req.registrationFlow = 'direct';
  }

  next();
});

// Unified registration endpoint
registrationRouter.post('/register', async (req, res) => {
  const { registrationFlow } = req;

  switch (registrationFlow) {
    case 'enterprise':
      return handleB2BRegistration(req, res);
    case 'direct':
      return handleB2CDirectRegistration(req, res);
    case 'referral':
      return handleB2CReferralRegistration(req, res);
    default:
      return res.status(400).json({ error: 'Invalid registration flow' });
  }
});

// Flow-specific handlers
async function handleB2BRegistration(req: Request, res: Response) {
  const b2bWorkflow = new B2BRegistrationWorkflow();
  const result = await b2bWorkflow.processRegistration(req.body);
  res.json(result);
}

async function handleB2CDirectRegistration(req: Request, res: Response) {
  const b2cDirectWorkflow = new B2CDirectRegistrationWorkflow();
  const result = await b2cDirectWorkflow.processRegistration(req.body);
  res.json(result);
}

async function handleB2CReferralRegistration(req: Request, res: Response) {
  const b2cReferralWorkflow = new B2CReferralRegistrationWorkflow();
  const result = await b2cReferralWorkflow.processRegistration(req.body, req.flowParams);
  res.json(result);
}
```

### **Shared Services**
```typescript
// Common validation service
export class SharedValidationService {
  async validateEmail(email: string): Promise<boolean> {
    // Email validation logic
  }

  async validatePhone(phone: string): Promise<boolean> {
    // Phone validation logic
  }

  async validatePassword(password: string): Promise<ValidationResult> {
    // Password complexity validation
  }

  async checkUniqueness(field: string, value: string): Promise<boolean> {
    // Uniqueness validation across all flows
  }
}

// Common audit service
export class RegistrationAuditService {
  async logRegistrationEvent(
    flow: string,
    eventType: string,
    data: any,
    userId?: string
  ): Promise<void> {
    // Unified audit logging for all flows
  }

  async trackConversion(
    flow: string,
    registrationId: string,
    source: string
  ): Promise<void> {
    // Conversion tracking across flows
  }
}

// Common notification service
export class RegistrationNotificationService {
  async sendWelcomeEmail(
    flow: string,
    userData: any,
    companyData?: any
  ): Promise<void> {
    // Flow-specific welcome emails
  }

  async sendVerificationEmail(
    flow: string,
    email: string,
    token: string
  ): Promise<void> {
    // Unified verification emails
  }
}
```

## Implementation Roadmap

### **Phase 1: Foundation (Weeks 1-2)**
- [ ] Database schema implementation for all three flows
- [ ] Basic API endpoints and routing logic
- [ ] Shared validation and utility services
- [ ] Basic UI components and layouts

### **Phase 2: B2B Enterprise Flow (Weeks 3-4)**
- [ ] Complete B2B registration workflow
- [ ] Document upload and verification
- [ ] Company provisioning system
- [ ] Admin approval workflows

### **Phase 3: B2C Direct Selection Flow (Weeks 5-6)**
- [ ] Company discovery interface
- [ ] Individual registration workflow
- [ ] Sponsor selection and network integration
- [ ] Customer vs distributor paths

### **Phase 4: B2C Referral Flow (Weeks 7-8)**
- [ ] Referral link generation and tracking
- [ ] Pre-populated registration forms
- [ ] Conversion optimization features
- [ ] Referral analytics dashboard

### **Phase 5: Integration & Optimization (Weeks 9-10)**
- [ ] Unified API architecture
- [ ] Cross-flow analytics and reporting
- [ ] Performance optimization
- [ ] A/B testing framework

## Success Metrics

### **Quantitative Targets**
- **B2B Conversion**: 85% completion rate for enterprise registrations
- **B2C Direct Conversion**: 75% completion rate for individual registrations
- **B2C Referral Conversion**: 90% completion rate for referral-driven registrations
- **Average Registration Time**: < 5 minutes across all flows
- **Mobile Completion Rate**: > 80% on mobile devices
- **Support Ticket Reduction**: 70% decrease in registration-related support

### **Quality Metrics**
- **Data Accuracy**: > 98% validated data accuracy
- **Security Score**: Zero security incidents from registration flows
- **User Satisfaction**: 4.5/5 average rating across all flows
- **System Reliability**: 99.9% uptime for registration services

This comprehensive multi-tiered registration system provides enterprise-grade user experiences for every type of user joining the DakDam Binary MLM platform, from large corporations to individual distributors via referral links.