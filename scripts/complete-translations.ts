// Translation Completion Script
// Script to automatically complete missing translations

import { translationCompleter } from '../src/lib/translation-completer';
import { logger } from '@/lib/logger';

async function main() {
  try {
    logger.info('Starting translation completion process...');

    // Get initial stats
    const initialStats = translationCompleter.getCompletionProgress();
    logger.info('Initial translation status:', initialStats.before);

    // Complete all translations
    await translationCompleter.completeAllLanguages();

    // Get final stats
    const finalStats = translationCompleter.getCompletionProgress();
    logger.info('Final translation status:', finalStats.after);

    // Validate completions
    const validation = await translationCompleter.validateCompletions();

    logger.info('Translation completion summary:', {
      validLanguages: validation.validLanguages.length,
      invalidLanguages: validation.invalidLanguages.length,
      totalLanguages: validation.validLanguages.length + validation.invalidLanguages.length,
    });

    if (validation.invalidLanguages.length > 0) {
      logger.warn('Languages with validation errors:', validation.invalidLanguages);
      Object.entries(validation.errors).forEach(([lang, errors]) => {
        logger.warn(`${lang} errors:`, errors);
      });
    }

    logger.info('Translation completion process completed successfully!');
  } catch (error) {
    logger.error('Translation completion failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { main as completeTranslations };