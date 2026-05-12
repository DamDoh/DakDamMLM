/**
 * Next.js Instrumentation Hook
 * 
 * This file is automatically called by Next.js when the server starts.
 * We use it to initialize scheduled jobs for safety rules.
 * 
 * To enable this, add to next.config.js:
 * experimental: {
 *   instrumentationHook: true
 * }
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Only run on server-side (Node.js runtime)
    try {
      const { initializeSafetyRulesScheduler } = await import('./services/safety-rules-scheduler');
      initializeSafetyRulesScheduler();
    } catch (error) {
      console.error('Failed to initialize safety rules scheduler:', error);
    }
  }
}
