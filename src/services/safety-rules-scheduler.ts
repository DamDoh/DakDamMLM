/**
 * Safety Rules Scheduler
 * 
 * Initializes and manages scheduled jobs for safety rules:
 * 1. Daily Flush Service - Flushes excess points at 1:00 AM daily
 * 2. Waiting PV Expiration Service - Expires old waiting PV monthly
 * 
 * This should be called during application startup
 */

import { logger } from '@/lib/logger';

let flushJobInitialized = false;
let expirationJobInitialized = false;

/**
 * Initialize all safety rule scheduled jobs
 * Call this during application startup
 */
export function initializeSafetyRulesScheduler(): void {
  try {
    logger.info('Initializing safety rules scheduler...');

    // Initialize Daily Flush Service (1:00 AM daily)
    try {
      const { initializeDailyFlushJob } = require('./daily-flush-service');
      initializeDailyFlushJob();
      flushJobInitialized = true;
      logger.info('Daily flush job initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize daily flush job', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Initialize Waiting PV Expiration Service (monthly on 1st at 2:00 AM)
    try {
      const { initializeWaitingPVExpirationJob } = require('./waiting-pv-expiration-service');
      initializeWaitingPVExpirationJob();
      expirationJobInitialized = true;
      logger.info('Waiting PV expiration job initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize waiting PV expiration job', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    if (flushJobInitialized && expirationJobInitialized) {
      logger.info('All safety rules scheduled jobs initialized successfully', {
        dailyFlush: '0 1 * * * (1:00 AM daily)',
        pvExpiration: '0 2 1 * * (2:00 AM on 1st of each month)',
      });
    } else {
      logger.warn('Some safety rules scheduled jobs failed to initialize', {
        flushJobInitialized,
        expirationJobInitialized,
      });
    }
  } catch (error) {
    logger.error('Critical error initializing safety rules scheduler', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Check if safety rules scheduler is initialized
 */
export function isSafetyRulesSchedulerInitialized(): {
  flushJob: boolean;
  expirationJob: boolean;
} {
  return {
    flushJob: flushJobInitialized,
    expirationJob: expirationJobInitialized,
  };
}
