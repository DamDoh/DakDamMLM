import { Router } from 'express';
import { onboardingWorkflow } from '../lib/onboarding-workflow';
import { rbacService } from '../lib/rbac-service';

const onboardingApiRouter = Router();

/**
 * Onboarding API Routes - Backend Support for Enhanced Registration
 */

// ========================================
// AUTO-SAVE FUNCTIONALITY
// ========================================

/**
 * POST /api/onboarding/autosave
 * Auto-save registration progress
 */
onboardingApiRouter.post('/autosave', async (req, res) => {
  try {
    const { sessionId, stepData, progress } = req.body;

    // For now, we'll use a simple in-memory store or database
    // In production, this would use Redis or a database

    const autoSaveKey = `autosave_${sessionId || 'anonymous'}_${Date.now()}`;

    // Store auto-save data (simplified - would use Redis in production)
    global.autoSaveStore = global.autoSaveStore || new Map();
    global.autoSaveStore.set(autoSaveKey, {
      stepData,
      progress,
      savedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    });

    res.json({
      success: true,
      key: autoSaveKey,
      savedAt: new Date()
    });

  } catch (error) {
    console.error('Auto-save error:', error);
    res.status(500).json({ error: 'Auto-save failed' });
  }
});

/**
 * GET /api/onboarding/autosave
 * Retrieve auto-saved data
 */
onboardingApiRouter.get('/autosave', async (req, res) => {
  try {
    const { sessionId } = req.query;

    // Retrieve auto-save data (simplified)
    global.autoSaveStore = global.autoSaveStore || new Map();

    let savedData = null;
    if (sessionId) {
      // Find the most recent save for this session
      for (const [key, data] of global.autoSaveStore.entries()) {
        if (key.includes(sessionId) && (!savedData || data.savedAt > savedData.savedAt)) {
          savedData = data;
        }
      }
    }

    if (savedData && savedData.expiresAt > new Date()) {
      res.json(savedData);
    } else {
      res.json({ data: null });
    }

  } catch (error) {
    console.error('Auto-save retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve auto-saved data' });
  }
});

/**
 * DELETE /api/onboarding/autosave
 * Clear auto-saved data
 */
onboardingApiRouter.delete('/autosave', async (req, res) => {
  try {
    const { sessionId } = req.query;

    // Clear auto-save data
    global.autoSaveStore = global.autoSaveStore || new Map();

    if (sessionId) {
      // Remove all saves for this session
      for (const [key] of global.autoSaveStore.entries()) {
        if (key.includes(sessionId)) {
          global.autoSaveStore.delete(key);
        }
      }
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Auto-save clear error:', error);
    res.status(500).json({ error: 'Failed to clear auto-saved data' });
  }
});

// ========================================
// ENHANCED REGISTRATION PROCESSING
// ========================================

/**
 * POST /api/onboarding/register/enhance
 * Enhanced registration processing with validation
 */
onboardingApiRouter.post('/register/enhance', async (req, res) => {
  try {
    const registrationData = req.body;

    // Enhanced validation
    const validation = await validateEnhancedRegistration(registrationData);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.errors,
        suggestions: validation.suggestions
      });
    }

    // Process registration with enhancements
    const result = await processEnhancedRegistration(registrationData);

    res.json({
      success: true,
      registrationId: result.registrationId,
      nextSteps: result.nextSteps,
      estimatedCompletion: result.estimatedCompletion
    });

  } catch (error) {
    console.error('Enhanced registration error:', error);
    res.status(500).json({ error: 'Enhanced registration failed' });
  }
});

/**
 * GET /api/onboarding/register/:id/validation-status
 * Get real-time validation status for registration
 */
onboardingApiRouter.get('/register/:id/validation-status', async (req, res) => {
  try {
    const { id } = req.params;

    // Get validation status (simplified)
    const validationStatus = {
      overall: 'valid',
      fields: {
        companyId: { status: 'valid', score: 1.0 },
        email: { status: 'valid', score: 0.9 },
        phoneNumber: { status: 'valid', score: 1.0 },
        password: { status: 'valid', score: 0.8 },
        idCardNumber: { status: 'valid', score: 0.95 }
      },
      riskScore: 0.15,
      recommendations: []
    };

    res.json(validationStatus);

  } catch (error) {
    console.error('Validation status error:', error);
    res.status(500).json({ error: 'Failed to get validation status' });
  }
});

/**
 * POST /api/onboarding/smart-suggestions
 * Get smart suggestions based on current form state
 */
onboardingApiRouter.post('/smart-suggestions', async (req, res) => {
  try {
    const { currentData, step } = req.body;

    const suggestions = await generateSmartSuggestions(currentData, step);

    res.json({ suggestions });

  } catch (error) {
    console.error('Smart suggestions error:', error);
    res.status(500).json({ error: 'Failed to generate suggestions' });
  }
});

// ========================================
// ANALYTICS & INSIGHTS
// ========================================

/**
 * GET /api/onboarding/analytics/completion-rates
 * Get registration completion analytics
 */
onboardingApiRouter.get('/analytics/completion-rates', async (req, res) => {
  try {
    // Simplified analytics - would aggregate from database
    const analytics = {
      overallCompletionRate: 85.2,
      stepCompletionRates: {
        company_selection: 95.1,
        personal_info: 89.3,
        security_setup: 82.7,
        verification: 78.4
      },
      dropOffPoints: [
        { step: 'verification', rate: 21.6, reason: 'Document upload complexity' },
        { step: 'security_setup', rate: 17.3, reason: 'Password complexity' }
      ],
      averageTimePerStep: {
        company_selection: 45, // seconds
        personal_info: 120,
        security_setup: 180,
        verification: 300
      }
    };

    res.json(analytics);

  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to retrieve analytics' });
  }
});

/**
 * GET /api/onboarding/analytics/user-journey
 * Get user journey analytics
 */
onboardingApiRouter.get('/analytics/user-journey', async (req, res) => {
  try {
    const journey = {
      funnel: [
        { stage: 'Landing', users: 1000, conversion: 100 },
        { stage: 'Started', users: 750, conversion: 75 },
        { stage: 'Company Selected', users: 680, conversion: 68 },
        { stage: 'Personal Info', users: 620, conversion: 62 },
        { stage: 'Security Setup', users: 580, conversion: 58 },
        { stage: 'Verification', users: 520, conversion: 52 },
        { stage: 'Completed', users: 442, conversion: 44.2 }
      ],
      timeDistribution: {
        'Under 5 min': 15,
        '5-10 min': 25,
        '10-15 min': 35,
        '15-30 min': 20,
        'Over 30 min': 5
      },
      deviceBreakdown: {
        desktop: 45,
        mobile: 40,
        tablet: 15
      }
    };

    res.json(journey);

  } catch (error) {
    console.error('Journey analytics error:', error);
    res.status(500).json({ error: 'Failed to retrieve journey analytics' });
  }
});

// ========================================
// UTILITY ENDPOINTS
// ========================================

/**
 * GET /api/onboarding/health
 * Onboarding system health check
 */
onboardingApiRouter.get('/health', async (req, res) => {
  try {
    // Check system components
    const health = {
      status: 'healthy',
      timestamp: new Date(),
      checks: {
        database: true, // Would check actual DB connection
        cache: true,    // Would check Redis/cache
        api: true,      // Current request successful
        services: true  // Would check microservices
      },
      metrics: {
        activeSessions: 42,     // Would count actual sessions
        pendingValidations: 8,  // Would count pending validations
        avgResponseTime: 145    // milliseconds
      }
    };

    res.json(health);

  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date()
    });
  }
});

/**
 * POST /api/onboarding/feedback
 * Submit user feedback on registration process
 */
onboardingApiRouter.post('/feedback', async (req, res) => {
  try {
    const { registrationId, rating, feedback, step, issues } = req.body;

    // Store feedback for analysis
    console.log('Registration feedback received:', {
      registrationId,
      rating,
      feedback,
      step,
      issues,
      timestamp: new Date()
    });

    res.json({ success: true, message: 'Thank you for your feedback!' });

  } catch (error) {
    console.error('Feedback submission error:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// Helper functions

async function validateEnhancedRegistration(data: any): Promise<{
  valid: boolean;
  errors: any[];
  suggestions: string[];
}> {
  const errors = [];
  const suggestions = [];

  // Enhanced validation logic
  if (!data.email && !data.phoneNumber) {
    errors.push({ field: 'contact', message: 'Either email or phone number is required' });
  }

  if (data.password && data.password.length < 8) {
    errors.push({ field: 'password', message: 'Password must be at least 8 characters' });
  }

  if (data.companyId && data.sponsorId) {
    // Validate sponsor belongs to selected company
    const isValidSponsor = await validateSponsorForCompany(data.sponsorId, data.companyId);
    if (!isValidSponsor) {
      suggestions.push('Consider choosing a different sponsor from the selected company');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    suggestions
  };
}

async function processEnhancedRegistration(data: any): Promise<{
  registrationId: string;
  nextSteps: string[];
  estimatedCompletion: number;
}> {
  // Enhanced processing with additional validations and setup
  const registrationId = `reg_enhanced_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  return {
    registrationId,
    nextSteps: ['email_verification', 'profile_setup', 'network_onboarding'],
    estimatedCompletion: 900 // 15 minutes
  };
}

async function generateSmartSuggestions(currentData: any, step: string): Promise<string[]> {
  const suggestions = [];

  switch (step) {
    case 'company_selection':
      if (!currentData.industry) {
        suggestions.push('💡 Selecting an industry helps us recommend the best companies for your needs');
      }
      break;

    case 'personal_info':
      if (!currentData.email) {
        suggestions.push('📧 Adding an email enables account recovery and important notifications');
      }
      break;

    case 'security':
      if (currentData.password && currentData.password.length >= 12) {
        suggestions.push('🔒 Great password strength! Consider enabling two-factor authentication');
      }
      break;

    case 'verification':
      if (!currentData.idCard) {
        suggestions.push('🆔 Uploading your ID now will speed up the verification process');
      }
      break;
  }

  return suggestions;
}

async function validateSponsorForCompany(sponsorId: string, companyId: string): Promise<boolean> {
  // Validate sponsor belongs to company (simplified)
  return true;
}

export default onboardingApiRouter;