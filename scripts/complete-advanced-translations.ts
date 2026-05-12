// Advanced Translation Completion Script
// Script to run sophisticated MLM translation completion

import { advancedTranslationCompleter } from '../src/lib/advanced-translation-completer';
import { translationManager } from '../src/lib/translation-manager';
import { logger } from '@/lib/logger';

async function main() {
  try {
    logger.info('Starting advanced MLM translation completion process...');

    // Get initial stats
    const initialReport = translationManager.generateCompletionReport();
    logger.info('Initial completion status:', initialReport.summary);

    // Complete MLM translations
    await advancedTranslationCompleter.completeAllMLMLanguages();

    // Validate and clean translations
    const languages = ['zh', 'ja', 'ko', 'th', 'vi', 'id', 'es', 'fil', 'fr', 'de'];
    for (const lang of languages) {
      await advancedTranslationCompleter.validateAndClean(lang);
    }

    // Get final stats
    const finalReport = translationManager.generateCompletionReport();
    logger.info('Final completion status:', finalReport.summary);

    // Calculate improvements
    const improvements: Record<string, number> = {};
    for (const lang of Object.keys(initialReport.summary)) {
      const initial = initialReport.summary[lang] || 0;
      const final = finalReport.summary[lang] || 0;
      improvements[lang] = final - initial;
    }

    logger.info('Completion improvements:', improvements);

    // Detailed report
    console.log('\n=== TRANSLATION COMPLETION REPORT ===');
    console.log(`Most complete: ${finalReport.mostComplete}`);
    console.log(`Least complete: ${finalReport.leastComplete}`);

    console.log('\nDetailed Statistics:');
    finalReport.detailed.forEach(stat => {
      console.log(`${stat.language}: ${stat.completionPercentage}% (${stat.translatedKeys}/${stat.totalKeys} keys)`);
    });

    console.log('\n=== PROCESS COMPLETE ===');

    logger.info('Advanced MLM translation completion process completed successfully!');
  } catch (error) {
    logger.error('Advanced translation completion failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { main as completeAdvancedTranslations };