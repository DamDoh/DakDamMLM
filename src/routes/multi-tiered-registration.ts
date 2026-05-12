import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@/lib/database';
import { hashPassword } from '@/lib/auth-service';
import rateLimit from 'express-rate-limit';

// Logging utility
const logRegistrationEvent = async (eventType: string, registrationId: string, data: any, req: any) => {
  try {
    console.log(`[${eventType}] Registration ${registrationId}:`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
      data: JSON.stringify(data).substring(0, 500) // Truncate for logging
    });
  } catch (error) {
    console.error('Logging error:', error);
  }
};

// Multi-Tiered Registration Router
const multiTieredRegistrationRouter = Router();

// Security middleware: Rate limiting
const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 registration attempts per windowMs
  message: {
    error: 'Too many registration attempts from this IP, please try again later.',
    retryAfter: 15 * 60 * 1000
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const validationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // Limit each IP to 50 validation requests per windowMs
  message: {
    error: 'Too many validation requests, please slow down.',
    retryAfter: 5 * 60 * 1000
  }
});

// Input sanitization middleware
const sanitizeInput = (req: any, res: any, next: any) => {
  // Sanitize string inputs to prevent XSS
  const sanitizeString = (str: string) => str?.replace(/[<>]/g, '')?.trim();

  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      return sanitizeString(obj);
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeObject(value);
      }
      return sanitized;
    }
    return obj;
  };

  req.body = sanitizeObject(req.body);
  req.query = sanitizeObject(req.query);
  next();
};

// Security validation middleware
const validateSecurity = async (req: any, res: any, next: any) => {
  try {
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /eval\(/i,
      /alert\(/i
    ];

    const checkForSuspicious = (obj: any): boolean => {
      if (typeof obj === 'string') {
        return suspiciousPatterns.some(pattern => pattern.test(obj));
      }
      if (Array.isArray(obj)) {
        return obj.some(checkForSuspicious);
      }
      if (obj && typeof obj === 'object') {
        return Object.values(obj).some(checkForSuspicious);
      }
      return false;
    };

    if (checkForSuspicious(req.body) || checkForSuspicious(req.query)) {
      return res.status(400).json({
        error: 'Suspicious input detected',
        code: 'SECURITY_VIOLATION'
      });
    }

    // Check request size
    const contentLength = parseInt(req.get('content-length') || '0');
    if (contentLength > 10 * 1024 * 1024) { // 10MB limit
      return res.status(413).json({
        error: 'Request too large',
        code: 'PAYLOAD_TOO_LARGE'
      });
    }

    next();
  } catch (error) {
    res.status(500).json({
      error: 'Security validation failed',
      code: 'VALIDATION_ERROR'
    });
  }
};

// ========================================
// UNIFIED REGISTRATION FLOW DETECTION
// ========================================

// Flow Detection Schema
const flowDetectionSchema = z.object({
  // B2B Enterprise Indicators
  companyInfo: z.object({}).optional(),
  subscriptionPlan: z.string().optional(),

  // B2C Direct Selection Indicators
  companyId: z.string().optional(),
  accountType: z.enum(['customer', 'distributor']).optional(),

  // B2C Referral Indicators (from URL params)
  ref: z.string().optional(),
  sponsor: z.string().optional(),
  company: z.string().optional()
});

// Flow Detection Middleware
const detectRegistrationFlow = (req: any, res: any, next: any) => {
  const queryParams = req.query;
  const bodyData = req.body;

  // B2C Referral Flow (highest priority - from URL)
  if (queryParams.ref) {
    req.registrationFlow = 'referral';
    req.flowParams = {
      referralCode: queryParams.ref,
      sponsorId: queryParams.sponsor,
      companyId: queryParams.company,
      utmParams: {
        source: queryParams.utm_source,
        medium: queryParams.utm_medium,
        campaign: queryParams.utm_campaign
      }
    };
    return next();
  }

  // B2B Enterprise Flow (company info present)
  if (bodyData.companyInfo || bodyData.subscriptionPlan) {
    req.registrationFlow = 'enterprise';
    req.flowParams = {};
    return next();
  }

  // B2C Direct Selection Flow (default)
  if (bodyData.companyId || bodyData.accountType) {
    req.registrationFlow = 'direct';
    req.flowParams = {};
    return next();
  }

  // Fallback - redirect to flow selection
  res.status(400).json({
    error: 'Unable to determine registration flow',
    suggestion: 'Please specify your registration type',
    options: [
      { type: 'enterprise', description: 'Register a new company' },
      { type: 'direct', description: 'Join an existing company' },
      { type: 'referral', description: 'Use referral link' }
    ]
  });
};

// ========================================
// UNIFIED REGISTRATION ENDPOINTS
// ========================================

// GET /api/registration/flows - Get available registration flows
multiTieredRegistrationRouter.get('/flows', (req, res) => {
  res.json({
    flows: [
      {
        id: 'enterprise',
        name: 'Enterprise Company Registration',
        description: 'Register a new MLM company on the DakDam platform',
        targetAudience: 'Business owners and entrepreneurs',
        estimatedTime: '15-30 minutes',
        requirements: ['Business registration', 'Tax documents', 'Company details'],
        features: ['Full platform access', 'White-label options', 'API integrations']
      },
      {
        id: 'direct',
        name: 'Join Existing Company',
        description: 'Become a distributor or customer for an existing company',
        targetAudience: 'Individuals looking to join MLM opportunities',
        estimatedTime: '5-10 minutes',
        requirements: ['Personal information', 'Contact details', 'Account security'],
        features: ['Sponsor selection', 'Network building', 'Commission earnings']
      },
      {
        id: 'referral',
        name: 'Referral Link Registration',
        description: 'Quick registration via personalized referral link',
        targetAudience: 'People invited by existing distributors',
        estimatedTime: '2-5 minutes',
        requirements: ['Basic personal info', 'Contact details'],
        features: ['Pre-selected sponsor', 'Streamlined process', 'Immediate network placement']
      }
    ]
  });
});

// POST /api/registration/initialize - Initialize registration based on flow
multiTieredRegistrationRouter.post('/initialize', registrationLimiter, sanitizeInput, validateSecurity, detectRegistrationFlow, async (req, res) => {
  const { registrationFlow, flowParams } = req;

  try {
    const initializationData = await initializeRegistrationFlow(registrationFlow, flowParams, req);

    res.json({
      flow: registrationFlow,
      registrationId: initializationData.registrationId,
      nextSteps: initializationData.nextSteps,
      prefilledData: initializationData.prefilledData,
      uiConfig: initializationData.uiConfig
    });

  } catch (error: any) {
    res.status(500).json({
      error: 'Registration initialization failed',
      details: error.message,
      flow: registrationFlow
    });
  }
});

// POST /api/registration/validate - Real-time validation for any flow
multiTieredRegistrationRouter.post('/validate', validationLimiter, sanitizeInput, validateSecurity, detectRegistrationFlow, async (req, res) => {
  const { registrationFlow } = req;
  const { step, data } = req.body;

  try {
    const validationResult = await validateRegistrationStep(registrationFlow, step, data);

    res.json({
      valid: validationResult.valid,
      errors: validationResult.errors,
      warnings: validationResult.warnings,
      suggestions: validationResult.suggestions,
      score: validationResult.score,
      nextStep: validationResult.nextStep
    });

  } catch (error: any) {
    res.status(500).json({
      error: 'Validation failed',
      details: error.message
    });
  }
});

// POST /api/registration/submit - Submit registration for processing
multiTieredRegistrationRouter.post('/submit', registrationLimiter, sanitizeInput, validateSecurity, detectRegistrationFlow, async (req, res) => {
  const { registrationFlow, flowParams } = req;
  const registrationData = req.body;

  try {
    // Validate complete registration data
    const validation = await validateCompleteRegistration(registrationFlow, registrationData);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.errors,
        flow: registrationFlow
      });
    }

    // Process registration based on flow
    const result = await processRegistrationByFlow(registrationFlow, registrationData, flowParams);

    res.json({
      success: true,
      registrationId: result.registrationId,
      status: result.status,
      nextActions: result.nextActions,
      estimatedCompletionTime: result.estimatedCompletionTime,
      welcomeMessage: generateWelcomeMessage(registrationFlow, result)
    });

  } catch (error: any) {
    res.status(500).json({
      error: 'Registration submission failed',
      details: error.message,
      flow: registrationFlow
    });
  }
});

// GET /api/registration/:id/status - Get registration status
multiTieredRegistrationRouter.get('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const status = await getRegistrationStatus(id);

    res.json(status);

  } catch (error: any) {
    res.status(500).json({
      error: 'Status retrieval failed',
      details: error.message
    });
  }
});

// ========================================
// FLOW-SPECIFIC ENDPOINTS
// ========================================

// B2B Enterprise Endpoints
multiTieredRegistrationRouter.post('/enterprise/document-upload', async (req, res) => {
  // Handle enterprise document uploads
  const result = await handleEnterpriseDocumentUpload(req.body);
  res.json(result);
});

multiTieredRegistrationRouter.post('/enterprise/verification', async (req, res) => {
  // Handle enterprise verification requests
  const result = await handleEnterpriseVerification(req.body);
  res.json(result);
});

// B2C Direct Selection Endpoints
multiTieredRegistrationRouter.get('/companies/search', async (req, res) => {
  // Search companies for direct selection
  const { query, industry, location } = req.query;
  const results = await searchCompanies({ query, industry, location });
  res.json({ companies: results });
});

multiTieredRegistrationRouter.get('/companies/:id/sponsors', async (req, res) => {
  // Get sponsors for a company
  const { id } = req.params;
  const sponsors = await getCompanySponsors(id);
  res.json({ sponsors });
});

// B2C Referral Endpoints
multiTieredRegistrationRouter.get('/referral/:code/validate', async (req, res) => {
  // Validate referral code
  const { code } = req.params;
  const validation = await validateReferralCode(code);
  res.json(validation);
});

multiTieredRegistrationRouter.post('/referral/track', async (req, res) => {
  // Track referral link clicks
  const trackingData = req.body;
  await trackReferralClick(trackingData);
  res.json({ tracked: true });
});

// ========================================
// UTILITY ENDPOINTS
// ========================================

// GET /api/registration/analytics - Get registration analytics
multiTieredRegistrationRouter.get('/analytics/overview', async (req, res) => {
  const analytics = await getRegistrationAnalytics();
  res.json(analytics);
});

// POST /api/registration/feedback - Submit user feedback
multiTieredRegistrationRouter.post('/feedback', async (req, res) => {
  const feedback = await processUserFeedback(req.body);
  res.json({ success: true, feedback });
});

// Health check endpoint
multiTieredRegistrationRouter.get('/health', async (req, res) => {
  const health = await checkRegistrationSystemHealth();
  res.json(health);
});

// ========================================
// IMPLEMENTATION FUNCTIONS
// ========================================

async function initializeRegistrationFlow(flow: string, params: any, req: any) {
  switch (flow) {
    case 'enterprise':
      return await initializeB2BFlow(params, req);
    case 'direct':
      return await initializeB2CDirectFlow(params, req);
    case 'referral':
      return await initializeB2CReferralFlow(params, req);
    default:
      throw new Error('Invalid registration flow');
  }
}

async function validateRegistrationStep(flow: string, step: string, data: any) {
  switch (flow) {
    case 'enterprise':
      return await validateB2BStep(step, data);
    case 'direct':
      return await validateB2CDirectStep(step, data);
    case 'referral':
      return await validateB2CReferralStep(step, data);
    default:
      throw new Error('Invalid registration flow');
  }
}

async function validateCompleteRegistration(flow: string, data: any) {
  switch (flow) {
    case 'enterprise':
      return await validateCompleteB2BRegistration(data);
    case 'direct':
      return await validateCompleteB2CDirectRegistration(data);
    case 'referral':
      return await validateCompleteB2CReferralRegistration(data);
    default:
      throw new Error('Invalid registration flow');
  }
}

async function processRegistrationByFlow(flow: string, data: any, params: any) {
  switch (flow) {
    case 'enterprise':
      return await processB2BRegistration(data, params);
    case 'direct':
      return await processB2CDirectRegistration(data, params);
    case 'referral':
      return await processB2CReferralRegistration(data, params);
    default:
      throw new Error('Invalid registration flow');
  }
}

function generateWelcomeMessage(flow: string, result: any): string {
  switch (flow) {
    case 'enterprise':
      return `Welcome to DakDam! Your enterprise registration (${result.registrationId}) is being processed. You'll receive login credentials within 24 hours.`;
    case 'direct':
      return `Welcome to DakDam! Your account has been created successfully. You can now log in and start building your network.`;
    case 'referral':
      return `Welcome to DakDam! You've been successfully added to the network. Your sponsor will be in touch soon to help you get started.`;
    default:
      return 'Welcome to DakDam! Registration completed successfully.';
  }
}

// B2B Enterprise Flow Implementation
async function initializeB2BFlow(params: any, req: any) {
  const registrationId = 'b2b_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

  try {
    await logRegistrationEvent('B2B_INIT_START', registrationId, { flow: 'enterprise' }, req);

    // Create initial B2B registration record
    const registration = await prisma.b2BCompanyRegistration.create({
      data: {
        id: registrationId,
        status: 'initialized',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        sessionId: req.session?.id,
        registrationSteps: {
          create: [
            {
              step: 'company_identity',
              status: 'pending',
              stepData: {},
              estimatedTime: 600 // 10 minutes
            },
            {
              step: 'corporate_contacts',
              status: 'pending',
              stepData: {},
              estimatedTime: 900 // 15 minutes
            },
            {
              step: 'system_config',
              status: 'pending',
              stepData: {},
              estimatedTime: 1200 // 20 minutes
            },
            {
              step: 'admin_setup',
              status: 'pending',
              stepData: {},
              estimatedTime: 600 // 10 minutes
            }
          ]
        },
        registrationEvents: {
          create: {
            eventType: 'initialization',
            eventData: {
              timestamp: new Date(),
              source: 'api',
              ipAddress: req.ip,
              userAgent: req.get('User-Agent')
            },
            metadata: {
              flow: 'enterprise',
              initializationSource: 'api'
            }
          }
        }
      }
    });

    // Log initialization event
    await prisma.b2BRegistrationEvent.create({
      data: {
        registrationId,
        eventType: 'flow_initialized',
        eventData: {
          flow: 'enterprise',
          timestamp: new Date(),
          source: 'api'
        },
        metadata: {
          sessionId: req.session?.id,
          userAgent: req.get('User-Agent')
        }
      }
    });

    await logRegistrationEvent('B2B_INIT_SUCCESS', registrationId, { companyId: registration.id }, req);

    return {
      registrationId,
      nextSteps: ['company_identity', 'corporate_contacts', 'system_config', 'admin_setup'],
      prefilledData: {},
      uiConfig: {
        theme: 'enterprise',
        steps: 4,
        estimatedTotalTime: 3300, // 55 minutes
        securityLevel: 'high',
        requiresDocuments: true,
        autoSave: true,
        progressTracking: true
      }
    };
  } catch (error) {
    await logRegistrationEvent('B2B_INIT_ERROR', registrationId, { error: error.message }, req);
    console.error('B2B initialization error:', error);
    throw new Error('Failed to initialize B2B registration flow');
  }
}

async function initializeB2CDirectFlow(params: any, req: any) {
  const registrationId = 'b2c_direct_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

  try {
    // Create initial B2C registration record
    const registration = await prisma.b2CIndividualRegistration.create({
      data: {
        id: registrationId,
        status: 'initialized',
        registrationSource: 'direct',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        sessionId: req.session?.id,
        registrationSteps: {
          create: [
            {
              step: 'company_selection',
              status: 'pending',
              stepData: {},
              estimatedTime: 300 // 5 minutes
            },
            {
              step: 'personal_info',
              status: 'pending',
              stepData: {},
              estimatedTime: 600 // 10 minutes
            },
            {
              step: 'account_security',
              status: 'pending',
              stepData: {},
              estimatedTime: 300 // 5 minutes
            },
            {
              step: 'network_integration',
              status: 'pending',
              stepData: {},
              estimatedTime: 300 // 5 minutes
            }
          ]
        },
        registrationSessions: {
          create: {
            sessionId: req.session?.id || 'temp_' + Date.now(),
            sessionData: {
              ipAddress: req.ip,
              userAgent: req.get('User-Agent'),
              timestamp: new Date()
            },
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
          }
        }
      }
    });

    return {
      registrationId,
      nextSteps: ['company_selection', 'personal_info', 'account_security', 'network_integration'],
      prefilledData: {},
      uiConfig: {
        theme: 'consumer',
        steps: 4,
        estimatedTotalTime: 1500, // 25 minutes
        securityLevel: 'medium',
        requiresDocuments: false,
        autoSave: true,
        progressTracking: true,
        quickStart: true
      }
    };
  } catch (error) {
    console.error('B2C Direct initialization error:', error);
    throw new Error('Failed to initialize B2C Direct registration flow');
  }
}

async function initializeB2CReferralFlow(params: any, req: any) {
  const registrationId = 'b2c_referral_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

  try {
    // Validate referral code and get sponsor info
    const referralValidation = await validateReferralCode(params.referralCode);
    if (!referralValidation.valid) {
      throw new Error('Invalid referral code');
    }

    // Get sponsor details for prefill
    const sponsor = await prisma.user.findUnique({
      where: { id: referralValidation.sponsorId },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true
      }
    });

    if (!sponsor) {
      throw new Error('Sponsor not found');
    }

    // Get company details
    const company = await prisma.company.findUnique({
      where: { id: referralValidation.companyId },
      select: {
        id: true,
        name: true,
        domain: true,
        industry: true
      }
    });

    // Create initial B2C Referral registration record
    const registration = await prisma.b2CReferralRegistration.create({
      data: {
        id: registrationId,
        status: 'initialized',
        referralCode: params.referralCode,
        sponsorId: sponsor.id,
        companyId: company?.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        registrationDuration: 0,
        utmParams: params.utmParams || {},
        clickTimestamp: new Date(),
        registrationTimestamp: new Date()
      }
    });

    // Track referral click
    await trackReferralClick({
      referralCode: params.referralCode,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date(),
      utmParams: params.utmParams,
      sessionId: req.session?.id
    });

    return {
      registrationId,
      nextSteps: ['personal_info', 'account_security', 'confirmation'],
      prefilledData: {
        companyId: company?.id,
        companyName: company?.name,
        sponsorId: sponsor.id,
        sponsorName: sponsor.fullName,
        sponsorUsername: sponsor.username,
        referralCode: params.referralCode,
        industry: company?.industry
      },
      uiConfig: {
        theme: 'referral',
        steps: 3,
        estimatedTotalTime: 480, // 8 minutes
        securityLevel: 'low',
        requiresDocuments: false,
        autoSave: false,
        progressTracking: true,
        showPrefilledData: true,
        quickStart: true,
        sponsorInfo: {
          name: sponsor.fullName,
          username: sponsor.username
        }
      }
    };
  } catch (error) {
    console.error('B2C Referral initialization error:', error);
    throw new Error('Failed to initialize B2C Referral registration flow');
  }
}

// Validation Implementations
async function validateB2BStep(step: string, data: any) {
  switch (step) {
    case 'company_identity':
      return await validateCompanyIdentity(data);
    case 'corporate_contacts':
      return await validateCorporateContacts(data);
    case 'system_config':
      return await validateSystemConfig(data);
    case 'admin_setup':
      return await validateAdminSetup(data);
    default:
      return { valid: false, errors: ['Unknown step'], warnings: [], suggestions: [], score: 0 };
  }
}

async function validateCompanyIdentity(data: any) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  // Company name validation
  if (!data.companyName || data.companyName.length < 2) {
    errors.push('Company name is required and must be at least 2 characters');
  } else {
    score += 0.2;
  }

  // Business registration number
  if (!data.businessRegistrationNumber) {
    errors.push('Business registration number is required');
  } else if (!/^[A-Z0-9\-]+$/.test(data.businessRegistrationNumber)) {
    errors.push('Business registration number format is invalid');
  } else {
    score += 0.2;
  }

  // Industry validation
  if (!data.industry) {
    warnings.push('Industry selection helps optimize your MLM configuration');
    suggestions.push('Select your primary industry for better system recommendations');
  } else {
    score += 0.1;
  }

  // Tax ID validation
  if (data.taxId && !/^[A-Z0-9\-]+$/.test(data.taxId)) {
    errors.push('Tax ID format is invalid');
  } else if (data.taxId) {
    score += 0.15;
  }

  // Website validation
  if (data.website && !/^https?:\/\/.+/.test(data.website)) {
    warnings.push('Website should include http:// or https://');
  } else if (data.website) {
    score += 0.1;
  }

  // Address validation
  if (!data.address || !data.city || !data.country) {
    errors.push('Complete address information is required');
  } else {
    score += 0.25;
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
    score: Math.min(score, 1.0),
    nextStep: errors.length === 0 ? 'corporate_contacts' : null
  };
}

async function validateCorporateContacts(data: any) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  // Primary contact validation
  if (!data.primaryContact?.name || data.primaryContact.name.length < 2) {
    errors.push('Primary contact name is required');
  } else {
    score += 0.2;
  }

  if (!data.primaryContact?.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.primaryContact.email)) {
    errors.push('Valid primary contact email is required');
  } else {
    score += 0.2;
  }

  if (!data.primaryContact?.phone) {
    errors.push('Primary contact phone number is required');
  } else {
    score += 0.15;
  }

  // Secondary contact (optional but recommended)
  if (!data.secondaryContact?.email) {
    warnings.push('Secondary contact email is recommended for backup communication');
    suggestions.push('Add a secondary contact for better support coverage');
  } else {
    score += 0.1;
  }

  // Position validation
  if (!data.primaryContact?.position) {
    warnings.push('Contact position helps establish authority');
  } else {
    score += 0.1;
  }

  // Department validation
  if (data.departments && data.departments.length === 0) {
    warnings.push('Department information helps with organizational setup');
  } else {
    score += 0.15;
  }

  // Emergency contact
  if (!data.emergencyContact?.name || !data.emergencyContact?.phone) {
    warnings.push('Emergency contact information is recommended');
  } else {
    score += 0.1;
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
    score: Math.min(score, 1.0),
    nextStep: errors.length === 0 ? 'system_config' : null
  };
}

async function validateSystemConfig(data: any) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  // Subscription plan validation
  if (!data.subscriptionPlan) {
    errors.push('Subscription plan selection is required');
  } else {
    score += 0.3;
  }

  // Currency validation
  if (!data.currency) {
    errors.push('Default currency selection is required');
  } else {
    score += 0.1;
  }

  // Timezone validation
  if (!data.timezone) {
    errors.push('Timezone selection is required');
  } else {
    score += 0.1;
  }

  // Language validation
  if (!data.defaultLanguage) {
    warnings.push('Default language selection is recommended');
    suggestions.push('Choose your primary business language');
  } else {
    score += 0.1;
  }

  // Commission structure validation
  if (!data.commissionStructure) {
    warnings.push('Commission structure setup is recommended');
    suggestions.push('Configure your MLM commission rules');
  } else {
    score += 0.2;
  }

  // Security settings
  if (!data.securitySettings?.twoFactorRequired) {
    warnings.push('Two-factor authentication is recommended for security');
  } else {
    score += 0.1;
  }

  // Integration preferences
  if (data.integrations && Object.keys(data.integrations).length === 0) {
    warnings.push('Consider setting up integrations for better functionality');
  } else {
    score += 0.1;
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
    score: Math.min(score, 1.0),
    nextStep: errors.length === 0 ? 'admin_setup' : null
  };
}

async function validateAdminSetup(data: any) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  // Admin user validation
  if (!data.adminUser?.username || data.adminUser.username.length < 3) {
    errors.push('Admin username must be at least 3 characters');
  } else {
    score += 0.2;
  }

  if (!data.adminUser?.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.adminUser.email)) {
    errors.push('Valid admin email is required');
  } else {
    score += 0.2;
  }

  // Password strength validation
  if (!data.adminUser?.password || data.adminUser.password.length < 8) {
    errors.push('Admin password must be at least 8 characters');
  } else {
    const hasUpper = /[A-Z]/.test(data.adminUser.password);
    const hasLower = /[a-z]/.test(data.adminUser.password);
    const hasNumber = /\d/.test(data.adminUser.password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(data.adminUser.password);

    if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      errors.push('Password must contain uppercase, lowercase, number, and special character');
    } else {
      score += 0.2;
    }
  }

  // Admin role permissions
  if (!data.adminPermissions || data.adminPermissions.length === 0) {
    warnings.push('Admin permissions should be configured');
    suggestions.push('Select appropriate admin permissions');
  } else {
    score += 0.15;
  }

  // Notification preferences
  if (!data.notificationPreferences) {
    warnings.push('Notification preferences help keep admins informed');
  } else {
    score += 0.1;
  }

  // Backup admin setup
  if (!data.backupAdmin?.email) {
    warnings.push('Backup admin setup is recommended for continuity');
  } else {
    score += 0.15;
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
    score: Math.min(score, 1.0),
    nextStep: errors.length === 0 ? null : null // Final step
  };
}

async function validateB2CDirectStep(step: string, data: any) {
  switch (step) {
    case 'company_selection':
      return await validateCompanySelection(data);
    case 'personal_info':
      return await validatePersonalInfo(data);
    case 'account_security':
      return await validateAccountSecurity(data);
    case 'network_integration':
      return await validateNetworkIntegration(data);
    default:
      return { valid: false, errors: ['Unknown step'], warnings: [], suggestions: [], score: 0 };
  }
}

async function validateCompanySelection(data: any) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  if (!data.companyId) {
    errors.push('Company selection is required');
  } else {
    // Verify company exists and is active
    const company = await prisma.company.findUnique({
      where: { id: data.companyId },
      select: { id: true, status: true, name: true }
    });

    if (!company) {
      errors.push('Selected company does not exist');
    } else if (company.status !== 'active') {
      errors.push('Selected company is not currently active');
    } else {
      score += 0.4;
    }
  }

  if (!data.accountType || !['customer', 'distributor'].includes(data.accountType)) {
    errors.push('Account type selection is required (customer or distributor)');
  } else {
    score += 0.3;
  }

  // Sponsor selection for distributor
  if (data.accountType === 'distributor' && !data.sponsorId) {
    errors.push('Sponsor selection is required for distributor accounts');
  } else if (data.accountType === 'distributor' && data.sponsorId) {
    const sponsor = await prisma.user.findUnique({
      where: { id: data.sponsorId },
      select: { id: true, status: true, username: true }
    });

    if (!sponsor) {
      errors.push('Selected sponsor does not exist');
    } else if (sponsor.status !== 'active') {
      errors.push('Selected sponsor is not active');
    } else {
      score += 0.3;
    }
  } else if (data.accountType === 'customer') {
    score += 0.3; // No sponsor needed for customers
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
    score: Math.min(score, 1.0),
    nextStep: errors.length === 0 ? 'personal_info' : null
  };
}

async function validatePersonalInfo(data: any) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  // Full name validation
  if (!data.fullName || data.fullName.trim().length < 2) {
    errors.push('Full name is required and must be at least 2 characters');
  } else {
    score += 0.2;
  }

  // Email validation
  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('Valid email address is required');
  } else {
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true }
    });

    if (existingUser) {
      errors.push('Email address is already registered');
    } else {
      score += 0.25;
    }
  }

  // Phone validation
  if (!data.phone) {
    errors.push('Phone number is required');
  } else if (!/^\+?[\d\s\-\(\)]+$/.test(data.phone)) {
    errors.push('Phone number format is invalid');
  } else {
    score += 0.15;
  }

  // Date of birth validation
  if (!data.dateOfBirth) {
    errors.push('Date of birth is required');
  } else {
    const dob = new Date(data.dateOfBirth);
    const age = new Date().getFullYear() - dob.getFullYear();
    if (age < 18) {
      errors.push('You must be at least 18 years old to register');
    } else if (age > 120) {
      errors.push('Please enter a valid date of birth');
    } else {
      score += 0.15;
    }
  }

  // Address validation
  if (!data.address?.street || !data.address?.city || !data.address?.country) {
    errors.push('Complete address information is required');
  } else {
    score += 0.25;
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
    score: Math.min(score, 1.0),
    nextStep: errors.length === 0 ? 'account_security' : null
  };
}

async function validateAccountSecurity(data: any) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  // Username validation
  if (!data.username || data.username.length < 3) {
    errors.push('Username must be at least 3 characters');
  } else if (!/^[a-zA-Z0-9_]+$/.test(data.username)) {
    errors.push('Username can only contain letters, numbers, and underscores');
  } else {
    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username: data.username },
      select: { id: true }
    });

    if (existingUser) {
      errors.push('Username is already taken');
    } else {
      score += 0.3;
    }
  }

  // Password validation
  if (!data.password || data.password.length < 8) {
    errors.push('Password must be at least 8 characters');
  } else {
    const hasUpper = /[A-Z]/.test(data.password);
    const hasLower = /[a-z]/.test(data.password);
    const hasNumber = /\d/.test(data.password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(data.password);

    if (!hasUpper || !hasLower || !hasNumber) {
      errors.push('Password must contain at least one uppercase letter, one lowercase letter, and one number');
    } else {
      score += 0.3;
    }

    if (!hasSpecial) {
      warnings.push('Consider adding special characters for stronger security');
    }
  }

  // Password confirmation
  if (data.password !== data.confirmPassword) {
    errors.push('Password confirmation does not match');
  } else if (data.confirmPassword) {
    score += 0.2;
  }

  // Security questions
  if (!data.securityQuestion || !data.securityAnswer) {
    warnings.push('Security questions help recover your account if needed');
    suggestions.push('Set up security questions for account recovery');
  } else {
    score += 0.1;
  }

  // Terms acceptance
  if (!data.acceptTerms) {
    errors.push('You must accept the terms and conditions');
  } else {
    score += 0.1;
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
    score: Math.min(score, 1.0),
    nextStep: errors.length === 0 ? 'network_integration' : null
  };
}

async function validateNetworkIntegration(data: any) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  // Network placement validation (for distributors)
  if (data.accountType === 'distributor') {
    if (!data.placement?.position || !['left', 'right'].includes(data.placement.position)) {
      errors.push('Network placement position is required for distributors');
    } else {
      score += 0.3;
    }

    if (!data.placement?.uplineId) {
      errors.push('Upline selection is required for network placement');
    } else {
      // Verify upline exists and is active
      const upline = await prisma.user.findUnique({
        where: { id: data.placement.uplineId },
        select: { id: true, status: true }
      });

      if (!upline) {
        errors.push('Selected upline member does not exist');
      } else if (upline.status !== 'active') {
        errors.push('Selected upline member is not active');
      } else {
        score += 0.3;
      }
    }
  } else {
    score += 0.6; // Skip for customers
  }

  // Referral preferences
  if (data.referralSettings?.autoShare !== false && data.referralSettings?.autoShare !== true) {
    warnings.push('Consider setting referral sharing preferences');
  } else {
    score += 0.1;
  }

  // Notification preferences
  if (!data.notifications) {
    warnings.push('Notification preferences help you stay updated');
  } else {
    score += 0.1;
  }

  // Marketing preferences
  if (data.marketingOptIn === undefined) {
    warnings.push('Marketing preferences help customize your experience');
  } else {
    score += 0.1;
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
    score: Math.min(score, 1.0),
    nextStep: null // Final step
  };
}

async function validateB2CReferralStep(step: string, data: any) {
  switch (step) {
    case 'personal_info':
      return await validateReferralPersonalInfo(data);
    case 'account_security':
      return await validateReferralAccountSecurity(data);
    case 'confirmation':
      return await validateReferralConfirmation(data);
    default:
      return { valid: false, errors: ['Unknown step'], warnings: [], suggestions: [], score: 0 };
  }
}

async function validateReferralPersonalInfo(data: any) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  // Full name validation
  if (!data.fullName || data.fullName.trim().length < 2) {
    errors.push('Full name is required and must be at least 2 characters');
  } else {
    score += 0.25;
  }

  // Email validation
  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('Valid email address is required');
  } else {
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true }
    });

    if (existingUser) {
      errors.push('Email address is already registered');
    } else {
      score += 0.3;
    }
  }

  // Phone validation
  if (!data.phone) {
    errors.push('Phone number is required');
  } else if (!/^\+?[\d\s\-\(\)]+$/.test(data.phone)) {
    errors.push('Phone number format is invalid');
  } else {
    score += 0.2;
  }

  // Date of birth validation
  if (!data.dateOfBirth) {
    errors.push('Date of birth is required');
  } else {
    const dob = new Date(data.dateOfBirth);
    const age = new Date().getFullYear() - dob.getFullYear();
    if (age < 18) {
      errors.push('You must be at least 18 years old to register');
    } else if (age > 120) {
      errors.push('Please enter a valid date of birth');
    } else {
      score += 0.25;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
    score: Math.min(score, 1.0),
    nextStep: errors.length === 0 ? 'account_security' : null
  };
}

async function validateReferralAccountSecurity(data: any) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  // Username validation
  if (!data.username || data.username.length < 3) {
    errors.push('Username must be at least 3 characters');
  } else if (!/^[a-zA-Z0-9_]+$/.test(data.username)) {
    errors.push('Username can only contain letters, numbers, and underscores');
  } else {
    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username: data.username },
      select: { id: true }
    });

    if (existingUser) {
      errors.push('Username is already taken');
    } else {
      score += 0.4;
    }
  }

  // Password validation
  if (!data.password || data.password.length < 8) {
    errors.push('Password must be at least 8 characters');
  } else {
    const hasUpper = /[A-Z]/.test(data.password);
    const hasLower = /[a-z]/.test(data.password);
    const hasNumber = /\d/.test(data.password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(data.password);

    if (!hasUpper || !hasLower || !hasNumber) {
      errors.push('Password must contain at least one uppercase letter, one lowercase letter, and one number');
    } else {
      score += 0.4;
    }

    if (!hasSpecial) {
      warnings.push('Consider adding special characters for stronger security');
    }
  }

  // Password confirmation
  if (data.password !== data.confirmPassword) {
    errors.push('Password confirmation does not match');
  } else if (data.confirmPassword) {
    score += 0.2;
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
    score: Math.min(score, 1.0),
    nextStep: errors.length === 0 ? 'confirmation' : null
  };
}

async function validateReferralConfirmation(data: any) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  // Terms acceptance
  if (!data.acceptTerms) {
    errors.push('You must accept the terms and conditions');
  } else {
    score += 0.3;
  }

  // Privacy policy acceptance
  if (!data.acceptPrivacy) {
    errors.push('You must accept the privacy policy');
  } else {
    score += 0.3;
  }

  // Marketing preferences (optional)
  if (data.marketingOptIn !== undefined) {
    score += 0.1;
  }

  // Network placement confirmation
  if (!data.confirmPlacement) {
    errors.push('You must confirm your network placement');
  } else {
    score += 0.3;
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
    score: Math.min(score, 1.0),
    nextStep: null // Final step
  };
}

async function validateCompleteB2BRegistration(data: any) {
  const errors: string[] = [];

  // Validate all required fields are present
  const requiredFields = [
    'companyName', 'businessRegistrationNumber', 'industry',
    'address', 'city', 'country', 'postalCode',
    'primaryContact.name', 'primaryContact.email', 'primaryContact.phone',
    'subscriptionPlan', 'currency', 'timezone',
    'adminUser.username', 'adminUser.email', 'adminUser.password'
  ];

  for (const field of requiredFields) {
    const value = field.split('.').reduce((obj, key) => obj?.[key], data);
    if (!value) {
      errors.push(`Required field missing: ${field}`);
    }
  }

  // Business logic validations
  if (data.businessRegistrationNumber) {
    const existing = await prisma.b2BCompanyRegistration.findFirst({
      where: { businessRegistrationNumber: data.businessRegistrationNumber }
    });
    if (existing) {
      errors.push('Business registration number already exists');
    }
  }

  if (data.adminUser?.email) {
    const existing = await prisma.user.findUnique({
      where: { email: data.adminUser.email }
    });
    if (existing) {
      errors.push('Admin email already exists');
    }
  }

  return { valid: errors.length === 0, errors };
}

async function validateCompleteB2CDirectRegistration(data: any) {
  const errors: string[] = [];

  // Validate all required fields
  const requiredFields = [
    'companyId', 'accountType', 'fullName', 'email', 'phone',
    'dateOfBirth', 'address.street', 'address.city', 'address.country',
    'username', 'password', 'confirmPassword', 'acceptTerms'
  ];

  for (const field of requiredFields) {
    const value = field.split('.').reduce((obj, key) => obj?.[key], data);
    if (!value) {
      errors.push(`Required field missing: ${field}`);
    }
  }

  // Business logic validations
  if (data.email) {
    const existing = await prisma.user.findUnique({
      where: { email: data.email }
    });
    if (existing) {
      errors.push('Email already exists');
    }
  }

  if (data.username) {
    const existing = await prisma.user.findUnique({
      where: { username: data.username }
    });
    if (existing) {
      errors.push('Username already exists');
    }
  }

  if (data.accountType === 'distributor' && (!data.sponsorId || !data.placement)) {
    errors.push('Sponsor and placement information required for distributors');
  }

  return { valid: errors.length === 0, errors };
}

async function validateCompleteB2CReferralRegistration(data: any) {
  const errors: string[] = [];

  // Validate all required fields
  const requiredFields = [
    'fullName', 'email', 'phone', 'dateOfBirth',
    'username', 'password', 'confirmPassword',
    'acceptTerms', 'acceptPrivacy', 'confirmPlacement'
  ];

  for (const field of requiredFields) {
    const value = field.split('.').reduce((obj, key) => obj?.[key], data);
    if (!value) {
      errors.push(`Required field missing: ${field}`);
    }
  }

  // Business logic validations
  if (data.email) {
    const existing = await prisma.user.findUnique({
      where: { email: data.email }
    });
    if (existing) {
      errors.push('Email already exists');
    }
  }

  if (data.username) {
    const existing = await prisma.user.findUnique({
      where: { username: data.username }
    });
    if (existing) {
      errors.push('Username already exists');
    }
  }

  return { valid: errors.length === 0, errors };
}

async function processB2BRegistration(data: any, params: any) {
  const registrationId = 'processed_b2b_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

  try {
    // Create company record
    const company = await prisma.company.create({
      data: {
        name: data.companyName,
        domain: data.website || null,
        industry: data.industry,
        status: 'pending_verification',
        address: {
          street: data.address,
          city: data.city,
          state: data.state || null,
          country: data.country,
          postalCode: data.postalCode
        },
        contactInfo: {
          primaryEmail: data.primaryContact.email,
          primaryPhone: data.primaryContact.phone,
          secondaryEmail: data.secondaryContact?.email || null,
          secondaryPhone: data.secondaryContact?.phone || null
        },
        settings: {
          currency: data.currency,
          timezone: data.timezone,
          defaultLanguage: data.defaultLanguage || 'en',
          subscriptionPlan: data.subscriptionPlan,
          commissionStructure: data.commissionStructure || {},
          securitySettings: data.securitySettings || { twoFactorRequired: false },
          integrations: data.integrations || {}
        }
      }
    });

    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        username: data.adminUser.username,
        email: data.adminUser.email,
        password: await hashPassword(data.adminUser.password), // Assume hashPassword function exists
        fullName: data.primaryContact.name,
        role: 'company_admin',
        status: 'pending_verification',
        companyId: company.id,
        profile: {
          position: data.primaryContact.position || 'Administrator',
          department: 'Administration',
          phone: data.primaryContact.phone,
          dateOfBirth: null,
          address: company.address
        },
        permissions: data.adminPermissions || ['manage_company', 'manage_users', 'view_reports']
      }
    });

    // Update B2B registration with completion data
    await prisma.b2BCompanyRegistration.update({
      where: { id: params.registrationId },
      data: {
        status: 'processing',
        companyId: company.id,
        adminUserId: adminUser.id,
        completedAt: new Date(),
        registrationSteps: {
          updateMany: {
            data: { status: 'completed' }
          }
        },
        registrationEvents: {
          create: {
            eventType: 'registration_completed',
            eventData: {
              companyId: company.id,
              adminUserId: adminUser.id,
              timestamp: new Date()
            },
            metadata: {
              processingType: 'automated',
              requiresVerification: true
            }
          }
        }
      }
    });

    // Trigger verification workflow
    await triggerB2BVerification(company.id, adminUser.id);

    return {
      registrationId,
      status: 'processing',
      nextActions: ['await_verification', 'setup_notifications', 'send_welcome_email'],
      estimatedCompletionTime: 24 * 60 * 60, // 24 hours
      companyId: company.id,
      adminUserId: adminUser.id
    };
  } catch (error) {
    console.error('B2B processing error:', error);
    throw new Error('Failed to process B2B registration');
  }
}

async function triggerB2BVerification(companyId: string, adminUserId: string) {
  // Implementation for triggering verification workflow
  // This would typically involve sending verification emails, document checks, etc.
  console.log(`Triggering verification for company ${companyId} and admin ${adminUserId}`);
}

async function processB2CDirectRegistration(data: any, params: any) {
  const registrationId = 'processed_b2c_direct_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

  try {
    // Create user account
    const user = await prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        password: await hashPassword(data.password),
        fullName: data.fullName,
        role: data.accountType === 'distributor' ? 'distributor' : 'customer',
        status: 'active',
        companyId: data.companyId,
        sponsorId: data.sponsorId || null,
        profile: {
          phone: data.phone,
          dateOfBirth: new Date(data.dateOfBirth),
          address: {
            street: data.address.street,
            city: data.address.city,
            state: data.address.state || null,
            country: data.address.country,
            postalCode: data.address.postalCode || null
          },
          position: data.accountType === 'distributor' ? 'Distributor' : 'Customer'
        },
        permissions: data.accountType === 'distributor'
          ? ['view_network', 'place_orders', 'view_commissions']
          : ['place_orders', 'view_profile'],
        preferences: {
          notifications: data.notifications || {},
          marketingOptIn: data.marketingOptIn || false,
          referralSettings: data.referralSettings || {}
        }
      }
    });

    // Handle network placement for distributors
    if (data.accountType === 'distributor' && data.placement) {
      await createNetworkPlacement(user.id, data.placement);
    }

    // Update B2C registration status
    await prisma.b2CIndividualRegistration.update({
      where: { id: params.registrationId },
      data: {
        status: 'completed',
        userId: user.id,
        completedAt: new Date(),
        registrationSteps: {
          updateMany: {
            data: { status: 'completed' }
          }
        }
      }
    });

    // Send welcome email and trigger onboarding
    await sendWelcomeEmail(user.email, user.fullName, data.accountType);
    await triggerUserOnboarding(user.id);

    return {
      registrationId,
      status: 'completed',
      nextActions: ['send_welcome_email', 'create_network_profile', 'setup_wallet'],
      estimatedCompletionTime: 300, // 5 minutes
      userId: user.id
    };
  } catch (error) {
    console.error('B2C Direct processing error:', error);
    throw new Error('Failed to process B2C Direct registration');
  }
}

async function createNetworkPlacement(userId: string, placement: any) {
  // Implementation for creating network placement
  // This would involve updating the binary network structure
  console.log(`Creating network placement for user ${userId}:`, placement);
}

async function sendWelcomeEmail(email: string, name: string, accountType: string) {
  // Implementation for sending welcome email
  console.log(`Sending welcome email to ${email} for ${accountType} account`);
}

async function triggerUserOnboarding(userId: string) {
  // Implementation for triggering user onboarding process
  console.log(`Triggering onboarding for user ${userId}`);
}

async function processB2CReferralRegistration(data: any, params: any) {
  const registrationId = 'processed_b2c_referral_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

  try {
    // Get referral information
    const referralReg = await prisma.b2CReferralRegistration.findUnique({
      where: { id: params.registrationId }
    });

    if (!referralReg) {
      throw new Error('Referral registration not found');
    }

    // Create user account with referral information
    const user = await prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        password: await hashPassword(data.password),
        fullName: data.fullName,
        role: 'distributor', // Referral signups are typically distributors
        status: 'active',
        companyId: referralReg.companyId,
        sponsorId: referralReg.sponsorId,
        profile: {
          phone: data.phone,
          dateOfBirth: new Date(data.dateOfBirth),
          position: 'Distributor'
        },
        permissions: ['view_network', 'place_orders', 'view_commissions'],
        preferences: {
          notifications: { email: true, sms: false },
          marketingOptIn: data.marketingOptIn || false,
          referralSettings: { autoShare: true }
        },
        referralInfo: {
          referralCode: referralReg.referralCode,
          registrationSource: 'referral',
          utmParams: referralReg.utmParams
        }
      }
    });

    // Create automatic network placement under sponsor
    const placement = {
      uplineId: referralReg.sponsorId,
      position: await determinePlacementPosition(referralReg.sponsorId)
    };
    await createNetworkPlacement(user.id, placement);

    // Update referral registration
    await prisma.b2CReferralRegistration.update({
      where: { id: params.registrationId },
      data: {
        status: 'completed',
        userId: user.id,
        registrationDuration: Date.now() - referralReg.registrationTimestamp.getTime(),
        completedAt: new Date()
      }
    });

    // Notify sponsor
    await notifySponsor(referralReg.sponsorId, user);

    // Send welcome email
    await sendWelcomeEmail(user.email, user.fullName, 'distributor');

    return {
      registrationId,
      status: 'completed',
      nextActions: ['notify_sponsor', 'setup_downline_relationship', 'send_referral_bonus'],
      estimatedCompletionTime: 60, // 1 minute
      userId: user.id,
      sponsorId: referralReg.sponsorId
    };
  } catch (error) {
    console.error('B2C Referral processing error:', error);
    throw new Error('Failed to process B2C Referral registration');
  }
}

async function determinePlacementPosition(sponsorId: string): Promise<'left' | 'right'> {
  // Implementation to determine placement position based on sponsor's network
  // This would analyze the binary tree structure
  return 'left'; // Default for simplicity
}

async function notifySponsor(sponsorId: string, newUser: any) {
  // Implementation for notifying sponsor of new downline member
  console.log(`Notifying sponsor ${sponsorId} of new user ${newUser.id}`);
}

async function getRegistrationStatus(id: string) {
  return {
    registrationId: id,
    status: 'processing',
    currentStep: 'verification',
    progressPercentage: 75,
    estimatedCompletionTime: 1800,
    lastUpdated: new Date()
  };
}

async function handleEnterpriseDocumentUpload(data: any) {
  try {
    const documentId = 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    // In a real implementation, this would handle file upload to cloud storage
    // For now, we'll simulate document processing
    const document = await prisma.documentVerification.create({
      data: {
        id: documentId,
        registrationId: data.registrationId,
        documentType: data.documentType,
        fileName: data.fileName,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        uploadPath: `/uploads/enterprise/${data.registrationId}/${documentId}`,
        status: 'uploaded',
        uploadedAt: new Date(),
        metadata: {
          originalName: data.originalName,
          checksum: data.checksum
        }
      }
    });

    // Trigger document verification process
    await triggerDocumentVerification(documentId);

    return {
      success: true,
      documentId,
      status: 'uploaded',
      nextSteps: ['await_verification', 'processing']
    };
  } catch (error) {
    console.error('Document upload error:', error);
    return { success: false, error: 'Failed to upload document' };
  }
}

async function triggerDocumentVerification(documentId: string) {
  // Implementation for triggering document verification
  // This would involve AI-based document analysis, manual review queues, etc.
  console.log(`Triggering verification for document ${documentId}`);
}

async function handleEnterpriseVerification(data: any) {
  try {
    // Initiate verification process for enterprise registration
    const verificationId = 'ver_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    // Update registration status
    await prisma.b2BCompanyRegistration.update({
      where: { id: data.registrationId },
      data: {
        status: 'under_review',
        verificationStatus: 'initiated',
        verificationId
      }
    });

    // Create verification event
    await prisma.b2BRegistrationEvent.create({
      data: {
        registrationId: data.registrationId,
        eventType: 'verification_initiated',
        eventData: {
          verificationId,
          requestedBy: data.requestedBy,
          timestamp: new Date()
        },
        metadata: {
          verificationType: 'enterprise',
          priority: 'high'
        }
      }
    });

    return {
      status: 'initiated',
      verificationId,
      estimatedTime: 3600, // 1 hour
      nextSteps: ['document_review', 'background_check', 'final_approval']
    };
  } catch (error) {
    console.error('Enterprise verification error:', error);
    return { status: 'failed', error: 'Failed to initiate verification' };
  }
}

async function searchCompanies(params: any) {
  try {
    const { query, industry, location, limit = 20 } = params;

    const where: any = {
      status: 'active'
    };

    if (query) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { domain: { contains: query, mode: 'insensitive' } }
      ];
    }

    if (industry) {
      where.industry = industry;
    }

    if (location) {
      where.address = {
        OR: [
          { city: { contains: location, mode: 'insensitive' } },
          { state: { contains: location, mode: 'insensitive' } },
          { country: { contains: location, mode: 'insensitive' } }
        ]
      };
    }

    const companies = await prisma.company.findMany({
      where,
      select: {
        id: true,
        name: true,
        domain: true,
        industry: true,
        address: {
          select: {
            city: true,
            state: true,
            country: true
          }
        },
        _count: {
          select: {
            users: {
              where: { role: 'distributor', status: 'active' }
            }
          }
        }
      },
      take: limit,
      orderBy: [
        { name: 'asc' }
      ]
    });

    return companies.map(company => ({
      id: company.id,
      name: company.name,
      domain: company.domain,
      industry: company.industry,
      location: `${company.address.city}, ${company.address.state || ''} ${company.address.country}`.trim(),
      activeDistributors: company._count.users
    }));
  } catch (error) {
    console.error('Company search error:', error);
    return [];
  }
}

async function getCompanySponsors(companyId: string) {
  try {
    const sponsors = await prisma.user.findMany({
      where: {
        companyId,
        role: 'distributor',
        status: 'active',
        rank: {
          gte: 1 // Only sponsors with some rank
        }
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        rank: true,
        profile: {
          select: {
            position: true
          }
        },
        _count: {
          select: {
            downlines: true
          }
        },
        createdAt: true
      },
      orderBy: [
        { rank: 'desc' },
        { _count: { downlines: 'asc' } }, // Prefer sponsors with fewer downlines for balance
        { createdAt: 'asc' }
      ],
      take: 50
    });

    return sponsors.map(sponsor => ({
      id: sponsor.id,
      username: sponsor.username,
      fullName: sponsor.fullName,
      rank: sponsor.rank,
      position: sponsor.profile?.position,
      downlineCount: sponsor._count.downlines,
      experience: Math.floor((Date.now() - sponsor.createdAt.getTime()) / (1000 * 60 * 60 * 24)) // Days since joining
    }));
  } catch (error) {
    console.error('Sponsor search error:', error);
    return [];
  }
}

async function validateReferralCode(code: string) {
  try {
    // Check if it's a user referral code
    const userReferral = await prisma.user.findFirst({
      where: {
        OR: [
          { username: code },
          { referralCode: code }
        ],
        status: 'active',
        role: 'distributor'
      },
      select: {
        id: true,
        username: true,
        companyId: true,
        referralCode: true
      }
    });

    if (userReferral) {
      return {
        valid: true,
        sponsorId: userReferral.id,
        companyId: userReferral.companyId,
        type: 'user_referral',
        code: userReferral.referralCode || userReferral.username
      };
    }

    // Check if it's a company referral code
    const companyReferral = await prisma.company.findFirst({
      where: {
        referralCode: code,
        status: 'active'
      },
      select: {
        id: true,
        name: true,
        referralCode: true
      }
    });

    if (companyReferral) {
      return {
        valid: true,
        companyId: companyReferral.id,
        sponsorId: null, // Company-level referral
        type: 'company_referral',
        code: companyReferral.referralCode
      };
    }

    return { valid: false, error: 'Referral code not found' };
  } catch (error) {
    console.error('Referral code validation error:', error);
    return { valid: false, error: 'Validation failed' };
  }
}

async function trackReferralClick(data: any) {
  try {
    // Create or update referral tracking record
    const tracking = await prisma.referralTracking.upsert({
      where: {
        referralCode_ipAddress: {
          referralCode: data.referralCode,
          ipAddress: data.ipAddress
        }
      },
      update: {
        clickCount: { increment: 1 },
        lastClickAt: new Date(),
        utmParams: data.utmParams || {},
        sessionId: data.sessionId
      },
      create: {
        referralCode: data.referralCode,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        clickCount: 1,
        firstClickAt: new Date(),
        lastClickAt: new Date(),
        utmParams: data.utmParams || {},
        sessionId: data.sessionId
      }
    });

    // Also track in analytics if needed
    console.log(`Tracked referral click: ${data.referralCode} from ${data.ipAddress}`);
  } catch (error) {
    console.error('Referral tracking error:', error);
  }
}

async function getRegistrationAnalytics() {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get registration counts by type
    const [b2bCount, b2cDirectCount, b2cReferralCount] = await Promise.all([
      prisma.b2BCompanyRegistration.count({
        where: { createdAt: { gte: thirtyDaysAgo } }
      }),
      prisma.b2CIndividualRegistration.count({
        where: { createdAt: { gte: thirtyDaysAgo } }
      }),
      prisma.b2CReferralRegistration.count({
        where: { createdAt: { gte: thirtyDaysAgo } }
      })
    ]);

    const totalRegistrations = b2bCount + b2cDirectCount + b2cReferralCount;

    // Calculate completion rates
    const [b2bCompleted, b2cDirectCompleted, b2cReferralCompleted] = await Promise.all([
      prisma.b2BCompanyRegistration.count({
        where: { status: 'completed', createdAt: { gte: thirtyDaysAgo } }
      }),
      prisma.b2CIndividualRegistration.count({
        where: { status: 'completed', createdAt: { gte: thirtyDaysAgo } }
      }),
      prisma.b2CReferralRegistration.count({
        where: { status: 'completed', createdAt: { gte: thirtyDaysAgo } }
      })
    ]);

    const completionRate = totalRegistrations > 0
      ? ((b2bCompleted + b2cDirectCompleted + b2cReferralCompleted) / totalRegistrations * 100).toFixed(1)
      : 0;

    // Calculate average completion time
    const avgTimeResult = await prisma.$queryRaw`
      SELECT AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_time
      FROM (
        SELECT completed_at, created_at FROM "b2b_company_registrations" WHERE status = 'completed' AND created_at >= $1
        UNION ALL
        SELECT completed_at, created_at FROM "b2c_individual_registrations" WHERE status = 'completed' AND created_at >= $1
        UNION ALL
        SELECT completed_at, created_at FROM "b2c_referral_registrations" WHERE status = 'completed' AND created_at >= $1
      ) combined
    ` as any[];

    const averageTime = avgTimeResult[0]?.avg_time || 0;

    // Get top referral sources
    const referralSources = await prisma.b2CReferralRegistration.groupBy({
      by: ['registrationSource'],
      where: { created_at: { gte: thirtyDaysAgo } },
      _count: { registrationSource: true },
      orderBy: { _count: { registrationSource: 'desc' } },
      take: 5
    });

    const topReferralSources = referralSources.map(r => r.registrationSource);

    return {
      totalRegistrations,
      completionRate: parseFloat(completionRate.toString()),
      averageTime: Math.round(parseFloat(averageTime.toString())),
      topReferralSources,
      breakdown: {
        b2b: b2bCount,
        b2cDirect: b2cDirectCount,
        b2cReferral: b2cReferralCount
      },
      period: 'last_30_days'
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return {
      totalRegistrations: 0,
      completionRate: 0,
      averageTime: 0,
      topReferralSources: [],
      error: 'Failed to fetch analytics'
    };
  }
}

async function processUserFeedback(feedback: any) {
  try {
    // Log feedback for now (could be stored in a feedback table later)
    console.log('User feedback received:', {
      registrationId: feedback.registrationId,
      flowType: feedback.flowType,
      rating: feedback.rating,
      feedback: feedback.feedback,
      suggestions: feedback.suggestions,
      timestamp: new Date()
    });

    return { recorded: true, feedbackId: 'feedback_' + Date.now() };
  } catch (error) {
    console.error('Feedback processing error:', error);
    return { recorded: false, error: 'Failed to record feedback' };
  }
}

async function checkRegistrationSystemHealth() {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`;

    // Get active flows count
    const [activeB2B, activeB2CDirect, activeB2CReferral] = await Promise.all([
      prisma.b2BCompanyRegistration.count({
        where: { status: { in: ['initialized', 'processing'] } }
      }),
      prisma.b2CIndividualRegistration.count({
        where: { status: { in: ['initialized', 'processing'] } }
      }),
      prisma.b2CReferralRegistration.count({
        where: { status: { in: ['initialized', 'processing'] } }
      })
    ]);

    const activeFlows = activeB2B + activeB2CDirect + activeB2CReferral;

    // Get pending validations (simplified)
    const pendingValidations = await prisma.b2BCompanyRegistration.count({
      where: { status: 'pending_verification' }
    });

    // Check for recent errors
    const recentErrors = await prisma.b2BRegistrationEvent.count({
      where: {
        eventType: 'error',
        createdAt: { gte: oneHourAgo }
      }
    });

    const status = recentErrors > 0 ? 'warning' : 'healthy';
    const uptime = 99.9; // This would be calculated from actual uptime monitoring

    return {
      status,
      uptime,
      activeFlows,
      pendingValidations,
      lastIncident: recentErrors > 0 ? 'Recent errors detected' : null,
      timestamp: now.toISOString()
    };
  } catch (error) {
    console.error('Health check error:', error);
    return {
      status: 'unhealthy',
      uptime: 0,
      activeFlows: 0,
      pendingValidations: 0,
      lastIncident: 'Health check failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export default multiTieredRegistrationRouter;