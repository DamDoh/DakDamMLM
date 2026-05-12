import type { MemberProgress, OnboardingTemplate } from '@/lib/types';
import { prisma } from '@/lib/database';

export async function initializeMemberOnboarding(
  memberId: string,
  templateId: string = 'new-member-onboarding'
): Promise<MemberProgress | null> {
  try {
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

    return progress;
  } catch (error: any) {
    console.error('Failed to initialize member onboarding:', error);
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
    const progress = await prisma.memberProgress.findUnique({
      where: { memberId },
    });

    if (!progress) {
      return await initializeMemberOnboarding(memberId);
    }

    return {
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
  } catch (error) {
    console.error('Error in getMemberProgress:', error);
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
    const progress = await getMemberProgress(memberId);
    if (!progress) {
      throw new Error('Member progress not found');
    }

    if (!progress.completedSteps.includes(stepId)) {
      progress.completedSteps.push(stepId);
    }

    progress.currentStep = Math.max(
      progress.currentStep,
      progress.completedSteps.length
    );
    progress.lastActivity = new Date().toISOString();
    progress.totalTimeSpent += timeSpent;

    const template = await getOnboardingTemplate('new-member-onboarding');
    if (template) {
      const requiredSteps = template.steps
        .filter((step) => step.isRequired)
        .map((step) => step.id);
      progress.isCompleted = requiredSteps.every((id) =>
        progress.completedSteps.includes(id)
      );
    }

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

    await prisma.memberProgress.update({
      where: { memberId },
      data: updateData,
    });

    return true;
  } catch (error) {
    console.error('Failed to complete onboarding step:', error);
    return false;
  }
}


