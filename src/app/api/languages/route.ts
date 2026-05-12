import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/languages
 * Get all supported languages
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeTranslations = searchParams.get('includeTranslations') === 'true';

    // Return supported languages in the expected format
    const languages = [
      { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸', isRTL: false },
      { code: 'km', name: 'Khmer', nativeName: 'ភាសាខ្មែរ', flag: '🇰🇭', isRTL: false },
      { code: 'fil', name: 'Filipino', nativeName: 'Filipino', flag: '🇵🇭', isRTL: false },
      { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳', isRTL: false }
    ].map(lang => ({
      id: lang.code,
      code: lang.code,
      name: lang.name,
      nativeName: lang.nativeName,
      flag: lang.flag,
      isRTL: lang.isRTL,
      isActive: true,
      isBuiltIn: true,
      translations: includeTranslations ? {} : undefined
    }));

    return NextResponse.json({
      success: true,
      data: languages
    });
  } catch (error: any) {
    console.error('Failed to fetch languages:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch languages'
    }, { status: 500 });
  }
}
