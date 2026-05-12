import { Router } from 'express';
import { onboardingWorkflow } from '../lib/onboarding-workflow';
import { onboardingValidation } from '../lib/onboarding-validation';
import { rbacService } from '../lib/rbac-service';

const onboardingRouter = Router();

/**
 * Comprehensive Onboarding API
 * Streamlined company registration and activation process
 */

// ========================================
// QUALIFICATION & PRE-REGISTRATION
// ========================================

/**
 * POST /api/onboarding/qualify
 * AI-powered company qualification and plan recommendation
 */
onboardingRouter.post('/qualify', async (req, res) => {
  try {
    const { email, companyInfo, requirements } = req.body;

    // Validate input
    const validation = await onboardingValidation.validateQualificationInput({
      email,
      companyInfo,
      requirements
    });

    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid qualification data',
        details: validation.errors
      });
    }

    // Perform qualification
    const qualification = await onboardingWorkflow.qualifyCompany(email, {
      ...companyInfo,
      ...requirements
    });

    // Track qualification event
    await onboardingWorkflow.trackQualificationEvent(email, qualification);

    res.json({
      qualified: qualification.qualified,
      recommendedPlan: qualification.plan,
      estimatedTimeline: qualification.estimatedTimeline,
      requirements: qualification.requirements,
      nextSteps: qualification.qualified ?
        ['Start registration process', 'Prepare required documents'] :
        ['Contact sales team', 'Schedule consultation call']
    });

  } catch (error) {
    console.error('Qualification error:', error);
    res.status(500).json({ error: 'Qualification failed' });
  }
});

/**
 * GET /api/onboarding/plans
 * Get available plans and pricing
 */
onboardingRouter.get('/plans', async (req, res) => {
  try {
    const plans = await onboardingWorkflow.getAvailablePlans();
    res.json({ plans });
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({ error: 'Failed to retrieve plans' });
  }
});

// ========================================
// REGISTRATION PROCESS
// ========================================

/**
 * POST /api/onboarding/register
 * Initialize registration process
 */
onboardingRouter.post('/register', async (req, res) => {
  try {
    const { companyInfo, contactInfo, source } = req.body;

    // Create registration record
    const registration = await onboardingWorkflow.createRegistration({
      companyInfo,
      contactInfo,
      source,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: req.session?.id
    });

    // Create onboarding session
    const session = await onboardingWorkflow.createOnboardingSession(
      registration.id,
      contactInfo.primary.email,
      req
    );

    res.status(201).json({
      registrationId: registration.id,
      sessionId: session.id,
      nextStep: 'company_details',
      progress: {
        completed: 0,
        total: 4,
        currentStep: 'company_details'
      }
    });

  } catch (error) {
    console.error('Registration initialization error:', error);
    res.status(500).json({ error: 'Failed to initialize registration' });
  }
});

/**
 * PUT /api/onboarding/register/:id/step/:step
 * Update specific registration step with auto-save
 */
onboardingRouter.put('/register/:id/step/:step', async (req, res) => {
  try {
    const { id, step } = req.params;
    const stepData = req.body;

    // Validate step data
    const validation = await onboardingValidation.validateStepData(step, stepData);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid step data',
        details: validation.errors,
        suggestions: validation.suggestions
      });
    }

    // Update registration step
    const updateResult = await onboardingWorkflow.updateRegistrationStep(id, step, stepData);

    // Emit progress update via WebSocket
    const progress = await onboardingWorkflow.getRegistrationProgress(id);
    req.io?.to(`registration-${id}`).emit('progress-update', progress);

    res.json({
      success: true,
      progress,
      nextStep: updateResult.nextStep,
      validation: validation.feedback
    });

  } catch (error) {
    console.error('Step update error:', error);
    res.status(500).json({ error: 'Failed to update registration step' });
  }
});

/**
 * GET /api/onboarding/register/:id/progress
 * Get real-time registration progress
 */
onboardingRouter.get('/register/:id/progress', async (req, res) => {
  try {
    const progress = await onboardingWorkflow.getRegistrationProgress(req.params.id);
    res.json(progress);
  } catch (error) {
    console.error('Progress retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve progress' });
  }
});

/**
 * POST /api/onboarding/register/:id/auto-save
 * Auto-save current form state
 */
onboardingRouter.post('/register/:id/auto-save', async (req, res) => {
  try {
    const { step, data } = req.body;

    await onboardingWorkflow.autoSaveStep(req.params.id, step, data);

    res.json({ success: true, savedAt: new Date() });

  } catch (error) {
    console.error('Auto-save error:', error);
    res.status(500).json({ error: 'Auto-save failed' });
  }
});

/**
 * GET /api/onboarding/register/:id/auto-save/:step
 * Retrieve auto-saved data for step
 */
onboardingRouter.get('/register/:id/auto-save/:step', async (req, res) => {
  try {
    const savedData = await onboardingWorkflow.getAutoSavedData(req.params.id, req.params.step);

    if (savedData) {
      res.json({
        data: savedData.data,
        savedAt: savedData.savedAt,
        expiresAt: savedData.expiresAt
      });
    } else {
      res.json({ data: null });
    }

  } catch (error) {
    console.error('Auto-save retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve auto-saved data' });
  }
});

// ========================================
// DOCUMENT MANAGEMENT
// ========================================

/**
 * POST /api/onboarding/register/:id/documents
 * Upload and process documents
 */
onboardingRouter.post('/register/:id/documents', async (req, res) => {
  try {
    const { documentType, file } = req.body;

    // Validate document
    const validation = await onboardingValidation.validateDocument(documentType, file);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid document',
        details: validation.errors
      });
    }

    // Upload and process document
    const documentResult = await onboardingWorkflow.uploadDocument(
      req.params.id,
      documentType,
      file
    );

    // Emit document processing update
    req.io?.to(`registration-${req.params.id}`).emit('document-update', {
      type: documentType,
      status: 'processing',
      progress: 0
    });

    res.json({
      documentId: documentResult.id,
      status: 'processing',
      estimatedProcessingTime: documentResult.estimatedTime
    });

  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({ error: 'Document upload failed' });
  }
});

/**
 * GET /api/onboarding/register/:id/documents/:documentId/status
 * Get document processing status
 */
onboardingRouter.get('/register/:id/documents/:documentId/status', async (req, res) => {
  try {
    const status = await onboardingWorkflow.getDocumentStatus(
      req.params.id,
      req.params.documentId
    );

    res.json(status);

  } catch (error) {
    console.error('Document status error:', error);
    res.status(500).json({ error: 'Failed to get document status' });
  }
});

/**
 * GET /api/onboarding/register/:id/documents/requirements
 * Get document requirements for company
 */
onboardingRouter.get('/register/:id/documents/requirements', async (req, res) => {
  try {
    const requirements = await onboardingWorkflow.getDocumentRequirements(req.params.id);

    res.json({ requirements });

  } catch (error) {
    console.error('Document requirements error:', error);
    res.status(500).json({ error: 'Failed to get document requirements' });
  }
});

// ========================================
// VERIFICATION PROCESS
// ========================================

/**
 * POST /api/onboarding/register/:id/verify
 * Start verification process
 */
onboardingRouter.post('/register/:id/verify', async (req, res) => {
  try {
    // Check if registration is complete
    const canVerify = await onboardingWorkflow.canStartVerification(req.params.id);
    if (!canVerify.canStart) {
      return res.status(400).json({
        error: 'Cannot start verification',
        reason: canVerify.reason,
        missingSteps: canVerify.missingSteps
      });
    }

    // Start verification
    const verificationId = await onboardingWorkflow.startVerification(req.params.id);

    // Emit verification start
    req.io?.to(`registration-${req.params.id}`).emit('verification-started', {
      verificationId,
      estimatedTime: canVerify.estimatedTime
    });

    res.json({
      verificationId,
      status: 'started',
      estimatedCompletion: canVerify.estimatedTime
    });

  } catch (error) {
    console.error('Verification start error:', error);
    res.status(500).json({ error: 'Failed to start verification' });
  }
});

/**
 * GET /api/onboarding/register/:id/verification-status
 * Get real-time verification status
 */
onboardingRouter.get('/register/:id/verification-status', async (req, res) => {
  try {
    const status = await onboardingWorkflow.getVerificationStatus(req.params.id);

    // Emit status update for real-time UI
    req.io?.to(`registration-${req.params.id}`).emit('verification-update', status);

    res.json(status);

  } catch (error) {
    console.error('Verification status error:', error);
    res.status(500).json({ error: 'Failed to get verification status' });
  }
});

/**
 * POST /api/onboarding/register/:id/verification/:checkId/retry
 * Retry failed verification check
 */
onboardingRouter.post('/register/:id/verification/:checkId/retry', async (req, res) => {
  try {
    const result = await onboardingWorkflow.retryVerificationCheck(
      req.params.id,
      req.params.checkId
    );

    res.json({
      success: true,
      status: 'retrying',
      estimatedCompletion: result.estimatedTime
    });

  } catch (error) {
    console.error('Verification retry error:', error);
    res.status(500).json({ error: 'Failed to retry verification' });
  }
});

/**
 * GET /api/onboarding/verification/webhook/:provider
 * Webhook endpoint for third-party verification services
 */
onboardingRouter.post('/verification/webhook/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const webhookData = req.body;

    await onboardingWorkflow.processVerificationWebhook(provider, webhookData);

    res.json({ received: true });

  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ========================================
// ACTIVATION & PROVISIONING
// ========================================

/**
 * POST /api/onboarding/register/:id/activate
 * Final activation and system provisioning
 */
onboardingRouter.post('/register/:id/activate', async (req, res) => {
  try {
    // Check if verification is complete
    const canActivate = await onboardingWorkflow.canActivateCompany(req.params.id);
    if (!canActivate.canActivate) {
      return res.status(400).json({
        error: 'Cannot activate company',
        reason: canActivate.reason,
        failedChecks: canActivate.failedChecks
      });
    }

    // Start activation process
    const activation = await onboardingWorkflow.startActivation(req.params.id);

    // Emit activation start
    req.io?.to(`registration-${req.params.id}`).emit('activation-started', {
      activationId: activation.id,
      estimatedTime: activation.estimatedTime
    });

    res.json({
      activationId: activation.id,
      status: 'provisioning',
      estimatedCompletion: activation.estimatedTime
    });

  } catch (error) {
    console.error('Activation start error:', error);
    res.status(500).json({ error: 'Failed to start activation' });
  }
});

/**
 * GET /api/onboarding/register/:id/activation-status
 * Get real-time activation status
 */
onboardingRouter.get('/register/:id/activation-status', async (req, res) => {
  try {
    const status = await onboardingWorkflow.getActivationStatus(req.params.id);

    // Emit status update
    req.io?.to(`registration-${req.params.id}`).emit('activation-update', status);

    res.json(status);

  } catch (error) {
    console.error('Activation status error:', error);
    res.status(500).json({ error: 'Failed to get activation status' });
  }
});

// ========================================
// ADMIN MANAGEMENT ENDPOINTS
// ========================================

/**
 * GET /api/onboarding/admin/registrations
 * Admin view of all registrations (requires super admin access)
 */
onboardingRouter.get('/admin/registrations', async (req, res) => {
  try {
    // Check super admin access
    const hasAccess = await rbacService.checkPermission({
      userId: req.user?.id,
      action: 'R',
      resource: 'system_settings'
    });

    if (!hasAccess.allowed) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { page = 1, limit = 20, status, search } = req.query;

    const registrations = await onboardingWorkflow.getAdminRegistrations({
      page: Number(page),
      limit: Number(limit),
      status: status as string,
      search: search as string
    });

    res.json(registrations);

  } catch (error) {
    console.error('Admin registrations error:', error);
    res.status(500).json({ error: 'Failed to retrieve registrations' });
  }
});

/**
 * POST /api/onboarding/admin/register/:id/approve
 * Admin approval for registration
 */
onboardingRouter.post('/admin/register/:id/approve', async (req, res) => {
  try {
    const { approvalNotes } = req.body;

    // Check super admin access
    const hasAccess = await rbacService.checkPermission({
      userId: req.user?.id,
      action: 'U',
      resource: 'system_settings'
    });

    if (!hasAccess.allowed) {
      return res.status(403).json({ error: 'Admin approval access required' });
    }

    const result = await onboardingWorkflow.adminApproveRegistration(
      req.params.id,
      req.user!.id,
      approvalNotes
    );

    res.json(result);

  } catch (error) {
    console.error('Admin approval error:', error);
    res.status(500).json({ error: 'Approval failed' });
  }
});

/**
 * POST /api/onboarding/admin/register/:id/reject
 * Admin rejection of registration
 */
onboardingRouter.post('/admin/register/:id/reject', async (req, res) => {
  try {
    const { rejectionReason, feedback } = req.body;

    // Check super admin access
    const hasAccess = await rbacService.checkPermission({
      userId: req.user?.id,
      action: 'U',
      resource: 'system_settings'
    });

    if (!hasAccess.allowed) {
      return res.status(403).json({ error: 'Admin rejection access required' });
    }

    const result = await onboardingWorkflow.adminRejectRegistration(
      req.params.id,
      req.user!.id,
      rejectionReason,
      feedback
    );

    res.json(result);

  } catch (error) {
    console.error('Admin rejection error:', error);
    res.status(500).json({ error: 'Rejection failed' });
  }
});

// ========================================
// ANALYTICS & MONITORING
// ========================================

/**
 * GET /api/onboarding/analytics/overview
 * Get onboarding analytics overview
 */
onboardingRouter.get('/analytics/overview', async (req, res) => {
  try {
    const analytics = await onboardingWorkflow.getOnboardingAnalytics();

    res.json(analytics);

  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to retrieve analytics' });
  }
});

/**
 * GET /api/onboarding/analytics/funnel
 * Get conversion funnel analytics
 */
onboardingRouter.get('/analytics/funnel', async (req, res) => {
  try {
    const funnel = await onboardingWorkflow.getConversionFunnel();

    res.json(funnel);

  } catch (error) {
    console.error('Funnel analytics error:', error);
    res.status(500).json({ error: 'Failed to retrieve funnel analytics' });
  }
});

/**
 * GET /api/onboarding/analytics/bottlenecks
 * Identify process bottlenecks
 */
onboardingRouter.get('/analytics/bottlenecks', async (req, res) => {
  try {
    const bottlenecks = await onboardingWorkflow.identifyBottlenecks();

    res.json({ bottlenecks });

  } catch (error) {
    console.error('Bottleneck analysis error:', error);
    res.status(500).json({ error: 'Failed to identify bottlenecks' });
  }
});

export default onboardingRouter;