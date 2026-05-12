import { prisma } from '@/lib/database';

export class OnboardingSeeder {
  private readonly sampleProgress = [
    {
      memberId: 'user-2',
      currentStep: 5,
      completedSteps: [1, 2, 3, 4, 5],
      isCompleted: true,
      totalTimeSpent: 45,
      quizScores: [85, 92, 78, 88],
      notes: 'Completed all onboarding steps successfully'
    },
    {
      memberId: 'user-3',
      currentStep: 3,
      completedSteps: [1, 2, 3],
      isCompleted: false,
      totalTimeSpent: 28,
      quizScores: [90, 85, 82],
      notes: 'Currently on step 4'
    },
    {
      memberId: 'user-4',
      currentStep: 1,
      completedSteps: [1],
      isCompleted: false,
      totalTimeSpent: 12,
      quizScores: [88],
      notes: 'Just started onboarding'
    }
  ];

  async seed(): Promise<number> {
    let count = 0;
    for (const progress of this.sampleProgress) {
      try {
        await prisma.memberProgress.upsert({
          where: { memberId: progress.memberId },
          update: {
            currentStep: progress.currentStep,
            completedSteps: progress.completedSteps,
            lastActivity: new Date(),
            isCompleted: progress.isCompleted,
            totalTimeSpent: progress.totalTimeSpent,
            quizScores: progress.quizScores,
            notes: progress.notes,
          },
          create: {
            memberId: progress.memberId,
            currentStep: progress.currentStep,
            completedSteps: progress.completedSteps,
            startedDate: new Date(),
            lastActivity: new Date(),
            isCompleted: progress.isCompleted,
            totalTimeSpent: progress.totalTimeSpent,
            quizScores: progress.quizScores,
            notes: progress.notes,
          }
        });
        count++;
      } catch (error) {
        console.error(`Failed to seed progress for ${progress.memberId}:`, error);
      }
    }

    return count;
  }
}