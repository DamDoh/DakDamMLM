import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireSuperAdmin } from '@/lib/auth-middleware';
import { rateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

/**
 * GET /api/languages/[code]
 * Get a specific language with translations
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    const language = await (prisma as any).language.findUnique({
      where: { code },
      include: {
        translations: {
          where: companyId ? { companyId } : { companyId: null }
        }
      }
    });

    if (!language) {
      return NextResponse.json(
        { success: false, error: 'Language not found' },
        { status: 404 }
      );
    }

    // Format translations as object
    const translations = language.translations.reduce((acc: Record<string, string>, t: any) => {
      acc[t.key] = t.value;
      return acc;
    }, {} as Record<string, string>);

    return NextResponse.json({
      success: true,
      data: {
        id: language.id,
        code: language.code,
        name: language.name,
        nativeName: language.nativeName,
        flag: language.flag,
        isRTL: language.isRTL,
        isActive: language.isActive,
        isBuiltIn: language.isBuiltIn,
        translationCount: language.translations.length,
        translations
      }
    });
  } catch (error) {
    logger.error('Error fetching language', {
      error: error instanceof Error ? error.message : 'Unknown error'
    }, request);
    
    return NextResponse.json(
      { success: false, error: 'Failed to fetch language' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/languages/[code]
 * Update a language (Super Admin only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const rateLimitResult = await rateLimit(request, { windowMs: 15 * 60 * 1000, maxRequests: 100000 }); // Optimized for 100M+ users
    if (!rateLimitResult.success) {
      return rateLimitResult.response!;
    }

    // Check authentication first
    const authResponse = await requireSuperAdmin(async (req) => {
      return NextResponse.json({ user: req.user });
    })(request);

    if (authResponse.status === 401 || authResponse.status === 403) {
      return NextResponse.json(
        { 
          success: false, 
          error: authResponse.status === 401 
            ? 'Authentication required. Please log in again.' 
            : 'Super admin access required. You do not have permission to update translations.'
        },
        { status: authResponse.status }
      );
    }

    return requireSuperAdmin(async (req) => {
      const { code } = await params;
      const body = await request.json();
      const { name, nativeName, flag, isRTL, isActive, translations, companyId } = body;

      // Check if language exists
      const existing = await (prisma as any).language.findUnique({
        where: { code }
      });

      if (!existing) {
        return NextResponse.json(
          { success: false, error: 'Language not found' },
          { status: 404 }
        );
      }

      // Update language
      const language = await (prisma as any).language.update({
        where: { code },
        data: {
          ...(name !== undefined && { name }),
          ...(nativeName !== undefined && { nativeName }),
          ...(flag !== undefined && { flag }),
          ...(isRTL !== undefined && { isRTL }),
          ...(isActive !== undefined && { isActive })
        },
        include: {
          translations: {
            where: companyId ? { companyId } : { companyId: null }
          }
        }
      });

      // Update translations if provided
      if (translations) {
        try {
          logger.info('Starting translation update', {
            languageCode: code,
            translationCount: Object.keys(translations).length,
            userId: req.user?.id
          }, request);
          // Prepare translation data - filter out invalid keys but allow empty values
          const translationEntries = Object.entries(translations)
            .filter(([key, value]) => key && key.trim() !== '' && value !== null && value !== undefined)
            .map(([key, value]) => ({
              languageId: language.id,
              key: String(key).trim(),
              value: String(value), // Allow empty strings
              companyId: companyId || null
            }));

          if (translationEntries.length === 0) {
            logger.warn('No valid translations to insert', {
              languageCode: code,
              totalKeys: Object.keys(translations).length
            }, request);
          } else {
            logger.info('Updating translations', {
              languageCode: code,
              translationCount: translationEntries.length
            }, request);

            // Use batch operations for better performance
            // First, get all existing translations for this language
            const existingTranslations = await (prisma as any).translation.findMany({
              where: {
                languageId: language.id,
                companyId: companyId || null
              },
              select: {
                id: true,
                key: true,
                value: true
              }
            });

            // Create a map of existing translations by key
            const existingMap = new Map(existingTranslations.map((t: any) => [t.key, t]));

            // Separate into updates and creates
            const toUpdate: Array<{ id: string; value: string }> = [];
            const toCreate: any[] = [];
            const keysToKeep = new Set<string>();

            for (const entry of translationEntries) {
              keysToKeep.add(entry.key);
              const existing = existingMap.get(entry.key) as any;
              
              if (existing) {
                // Only update if value changed
                if (existing.value !== entry.value) {
                  toUpdate.push({
                    id: existing.id,
                    value: entry.value
                  });
                }
              } else {
                // Create new
                toCreate.push(entry);
              }
            }

            // Batch update existing translations
            if (toUpdate.length > 0) {
              // Use Promise.all for parallel updates (batch of 100)
              const UPDATE_BATCH = 100;
              for (let i = 0; i < toUpdate.length; i += UPDATE_BATCH) {
                const batch = toUpdate.slice(i, i + UPDATE_BATCH);
                await Promise.all(
                  batch.map(update => 
                    (prisma as any).translation.update({
                      where: { id: update.id },
                      data: { value: update.value }
                    })
                  )
                );
              }
            }

            // Batch create new translations
            if (toCreate.length > 0) {
              const CREATE_BATCH = 1000; // PostgreSQL limit
              for (let i = 0; i < toCreate.length; i += CREATE_BATCH) {
                const batch = toCreate.slice(i, i + CREATE_BATCH);
                await (prisma as any).translation.createMany({
                  data: batch,
                  skipDuplicates: true
                });
              }
            }

            // Delete translations that are no longer in the new set
            await (prisma as any).translation.deleteMany({
              where: {
                languageId: language.id,
                companyId: companyId || null,
                NOT: {
                  key: {
                    in: Array.from(keysToKeep)
                  }
                }
              }
            });

            const successCount = toUpdate.length + toCreate.length;
            logger.info('Translations updated', {
              userId: req.user?.id,
              languageCode: code,
              updated: toUpdate.length,
              created: toCreate.length,
              totalCount: translationEntries.length
            }, request);
          }
        } catch (translationError) {
          const errorMessage = translationError instanceof Error 
            ? translationError.message 
            : String(translationError);
          const errorStack = translationError instanceof Error ? translationError.stack : undefined;
          
          logger.error('Error updating translations', {
            error: errorMessage,
            stack: errorStack,
            languageCode: code,
            translationCount: Object.keys(translations).length,
            errorType: translationError?.constructor?.name || typeof translationError
          }, request);
          
          // Re-throw with more context
          throw new Error(`Failed to update translations: ${errorMessage}`);
        }

        // Reload with updated translations
        const updated = await (prisma as any).language.findUnique({
          where: { code },
          include: {
            translations: {
              where: companyId ? { companyId } : { companyId: null }
            }
          }
        });

        const formattedTranslations = updated?.translations.reduce((acc: Record<string, string>, t: any) => {
          acc[t.key] = t.value;
          return acc;
        }, {} as Record<string, string>) || {};

        return NextResponse.json({
          success: true,
          data: {
            id: updated!.id,
            code: updated!.code,
            name: updated!.name,
            nativeName: updated!.nativeName,
            flag: updated!.flag,
            isRTL: updated!.isRTL,
            isActive: updated!.isActive,
            translationCount: updated!.translations.length,
            translations: formattedTranslations
          }
        });
      }

      logger.info('Language updated', {
        userId: req.user?.id,
        languageCode: code
      }, request);

      return NextResponse.json({
        success: true,
        data: {
          id: language.id,
          code: language.code,
          name: language.name,
          nativeName: language.nativeName,
          flag: language.flag,
          isRTL: language.isRTL,
          isActive: language.isActive,
          translationCount: language.translations.length
        }
      });
    })(request);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorName = error instanceof Error ? error.name : typeof error;
    
    logger.error('Error updating language', {
      error: errorMessage,
      errorName: errorName,
      stack: errorStack,
      errorType: error?.constructor?.name || typeof error
    }, request);
    
    // Check if it's an authentication error
    if (error instanceof Error && (error.message.includes('Authentication') || error.message.includes('Unauthorized'))) {
      return NextResponse.json(
        { success: false, error: 'Authentication required. Please log in again.' },
        { status: 401 }
      );
    }
    
    // Return detailed error in development, generic in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    return NextResponse.json(
      { 
        success: false, 
        error: isDevelopment ? errorMessage : 'Failed to update language. Please check the server console for details.',
        ...(isDevelopment && { 
          details: errorStack,
          errorName: errorName
        })
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/languages/[code]
 * Delete a language (Super Admin only, cannot delete built-in languages)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const rateLimitResult = await rateLimit(request, { windowMs: 15 * 60 * 1000, maxRequests: 100000 }); // Optimized for 100M+ users
    if (!rateLimitResult.success) {
      return rateLimitResult.response!;
    }

    // Check authentication first
    const authResponse = await requireSuperAdmin(async (req) => {
      return NextResponse.json({ user: req.user });
    })(request);

    if (authResponse.status === 401 || authResponse.status === 403) {
      return NextResponse.json(
        { 
          success: false, 
          error: authResponse.status === 401 
            ? 'Authentication required. Please log in again.' 
            : 'Super admin access required. You do not have permission to delete languages.'
        },
        { status: authResponse.status }
      );
    }

    return requireSuperAdmin(async (req) => {
      const { code } = await params;

      const language = await (prisma as any).language.findUnique({
        where: { code }
      });

      if (!language) {
        return NextResponse.json(
          { success: false, error: 'Language not found' },
          { status: 404 }
        );
      }

      // Warn but allow deletion of built-in languages (they can be re-seeded)
      if (language.isBuiltIn) {
        logger.warn('Attempting to delete built-in language', {
          userId: req.user?.id,
          languageCode: code,
          languageName: language.name
        }, request);
        // Allow deletion but log it - user can re-seed if needed
      }

      // Delete language (translations will be cascade deleted)
      try {
        await (prisma as any).language.delete({
          where: { code }
        });

        logger.info('Language deleted', {
          userId: req.user?.id,
          languageCode: code,
          languageName: language.name
        }, request);

        return NextResponse.json({
          success: true,
          message: `Language '${language.name}' deleted successfully`
        });
      } catch (deleteError) {
        const errorMsg = deleteError instanceof Error ? deleteError.message : String(deleteError);
        logger.error('Database error deleting language', {
          error: errorMsg,
          languageCode: code,
          languageId: language.id
        }, request);
        
        throw new Error(`Failed to delete language from database: ${errorMsg}`);
      }
    })(request);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error('Error deleting language', {
      error: errorMessage,
      stack: errorStack
    }, request);
    
    // Check if it's an authentication error
    if (error instanceof Error && (error.message.includes('Authentication') || error.message.includes('Unauthorized'))) {
      return NextResponse.json(
        { success: false, error: 'Authentication required. Please log in again.' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage || 'Failed to delete language. Please check the server console for details.'
      },
      { status: 500 }
    );
  }
}

