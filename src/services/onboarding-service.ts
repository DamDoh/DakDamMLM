import type { MemberProgress, OnboardingTemplate } from '@/lib/types';
import { prisma } from '@/lib/database';

export async function initializeMemberOnboarding(
  memberId: string,
  templateId: string = 'new-member-onboarding'
): Promise<MemberProgress | null> {
  try {
    console.log(`[Onboarding] Initializing onboarding for member ${memberId}`);
    
    const template = await getOnboardingTemplate(templateId);
    if (!template) {
      throw new Error('Onboarding template not found');
    }

    const progress: MemberProgress = {
      memberId,
      currentStep: 0,
      completedSteps: [],
      startedDate: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      isCompleted: false,
      totalTimeSpent: 0,
      quizScores: {},
      notes: [],
    };

    // Store progress in database using Prisma
    await prisma.memberProgress.upsert({
      where: { memberId },
      update: {
        currentStep: progress.currentStep,
        completedSteps: progress.completedSteps,
        lastActivity: new Date(progress.lastActivity),
        isCompleted: progress.isCompleted,
        totalTimeSpent: progress.totalTimeSpent,
        quizScores: progress.quizScores,
        notes: progress.notes,
      },
      create: {
        memberId: progress.memberId,
        currentStep: progress.currentStep,
        completedSteps: progress.completedSteps,
        startedDate: new Date(progress.startedDate),
        lastActivity: new Date(progress.lastActivity),
        isCompleted: progress.isCompleted,
        totalTimeSpent: progress.totalTimeSpent,
        quizScores: progress.quizScores,
        notes: progress.notes,
      },
    });

    console.log(`[Onboarding] ✅ Successfully initialized onboarding for member ${memberId}`);
    return progress;
  } catch (error: any) {
    console.error('[Onboarding] ❌ Failed to initialize member onboarding:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      memberId,
      templateId
    });
    return null;
  }
}

export async function getOnboardingTemplate(
  templateId: string
): Promise<OnboardingTemplate | null> {
  const DEFAULT_ONBOARDING_TEMPLATE: OnboardingTemplate = {
    id: 'new-member-onboarding',
    name: 'New Member Welcome',
    description: 'Complete onboarding for new DakDam members',
    targetAudience: 'new_member',
    version: '1.0',
    isActive: true,
    steps: [
      {
        id: 'welcome-video',
        title: 'Welcome to DakDam',
        description: 'Watch our welcome video',
        type: 'video',
        isRequired: true,
        estimatedMinutes: 5,
        order: 1,
      },
      {
        id: 'company-overview',
        title: 'Company Overview',
        description: 'Learn about DakDam',
        type: 'document',
        isRequired: true,
        estimatedMinutes: 15,
        order: 2,
      },
      {
        id: 'compensation-quiz',
        title: 'Compensation Plan Quiz',
        description: 'Test your understanding',
        type: 'quiz',
        isRequired: true,
        estimatedMinutes: 10,
        order: 3,
      },
      {
        id: 'first-product-order',
        title: 'Place Your First Order',
        description: 'Experience our products',
        type: 'action',
        isRequired: true,
        estimatedMinutes: 20,
        order: 4,
      },
      {
        id: 'setup-profile',
        title: 'Complete Your Profile',
        description: 'Set up your profile',
        type: 'action',
        isRequired: true,
        estimatedMinutes: 10,
        order: 5,
      },
    ],
  };

  if (templateId === 'new-member-onboarding') {
    return DEFAULT_ONBOARDING_TEMPLATE;
  }
  return null;
}

export async function getMemberProgress(
  memberId: string
): Promise<MemberProgress | null> {
  try {
    console.log(`[Onboarding] Getting progress for member ${memberId}`);
    
    const progress = await prisma.memberProgress.findUnique({
      where: { memberId },
    });

    if (!progress) {
      console.log(`[Onboarding] No progress found for member ${memberId}, initializing...`);
      return await initializeMemberOnboarding(memberId);
    }

    const result = {
      memberId: progress.memberId,
      currentStep: progress.currentStep,
      completedSteps: (progress.completedSteps as string[]) || [],
      startedDate: progress.startedDate.toISOString(),
      lastActivity: progress.lastActivity.toISOString(),
      isCompleted: progress.isCompleted,
      totalTimeSpent: progress.totalTimeSpent,
      quizScores: (progress.quizScores as Record<string, number>) || {},
      notes: (progress.notes as string[]) || [],
    };

    console.log(`[Onboarding] ✅ Retrieved progress for member ${memberId}:`, {
      completedSteps: result.completedSteps.length,
      currentStep: result.currentStep,
      isCompleted: result.isCompleted
    });

    return result;
  } catch (error: any) {
    console.error('[Onboarding] ❌ Error in getMemberProgress:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      memberId
    });
    throw error;
  }
}

export async function completeOnboardingStep(
  memberId: string,
  stepId: string,
  timeSpent: number,
  metadata?: Record<string, any>
): Promise<boolean> {
  try {
    console.log(`[Onboarding] Completing step ${stepId} for member ${memberId}`);
    
    // Ensure member progress exists, create if it doesn't
    let progress = await getMemberProgress(memberId);
    if (!progress) {
      console.log(`[Onboarding] Progress not found for ${memberId}, initializing...`);
      progress = await initializeMemberOnboarding(memberId);
      if (!progress) {
        throw new Error('Failed to initialize member onboarding');
      }
    }

    // Check if step is already completed
    if (progress.completedSteps.includes(stepId)) {
      console.log(`[Onboarding] Step ${stepId} already completed for member ${memberId}`);
      return true; // Already completed, return success
    }

    // Add step to completed steps
    progress.completedSteps.push(stepId);

    // Update current step
    progress.currentStep = Math.max(
      progress.currentStep,
      progress.completedSteps.length
    );
    progress.lastActivity = new Date().toISOString();
    progress.totalTimeSpent += timeSpent;

    // Check if all required steps are completed
    const template = await getOnboardingTemplate('new-member-onboarding');
    if (template) {
      const requiredSteps = template.steps
        .filter((step) => step.isRequired)
        .map((step) => step.id);
      progress.isCompleted = requiredSteps.every((id) =>
        progress.completedSteps.includes(id)
      );
    }

    // Prepare update data
    const updateData: any = {
      currentStep: progress.currentStep,
      completedSteps: progress.completedSteps,
      lastActivity: new Date(progress.lastActivity),
      totalTimeSpent: progress.totalTimeSpent,
      isCompleted: progress.isCompleted,
    };

    if (metadata?.quizScore !== undefined) {
      updateData.quizScores = {
        ...progress.quizScores,
        [stepId]: metadata.quizScore,
      };
    }

    // Update database
    await prisma.memberProgress.update({
      where: { memberId },
      data: updateData,
    });

    console.log(`[Onboarding] ✅ Successfully completed step ${stepId} for member ${memberId}`, {
      completedSteps: progress.completedSteps,
      currentStep: progress.currentStep,
      isCompleted: progress.isCompleted
    });

    return true;
  } catch (error: any) {
    console.error('[Onboarding] ❌ Failed to complete onboarding step:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      memberId,
      stepId
    });
    return false;
  }
}


