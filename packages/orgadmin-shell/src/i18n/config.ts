import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Supported locales
export const SUPPORTED_LOCALES = [
  'en-GB',
  'fr-FR',
  'es-ES',
  'it-IT',
  'de-DE',
  'pt-PT',
] as const;

export type SupportedLocale = typeof SUPPORTED_LOCALES[number];

export const DEFAULT_LOCALE: SupportedLocale = 'en-GB';

// Cache for loaded translations to avoid repeated fetches
const translationCache = new Map<string, any>();

/**
 * Lazy load translation resources on demand
 * @param locale - The locale to load
 * @returns Promise resolving to the translation object
 */
async function loadTranslation(locale: SupportedLocale): Promise<any> {
  // Check cache first
  if (translationCache.has(locale)) {
    return translationCache.get(locale);
  }

  try {
    // Dynamically import the translation file
    const translation = await import(`../locales/${locale}/translation.json`);
    
    // Cache the loaded translation
    translationCache.set(locale, translation.default || translation);
    
    return translation.default || translation;
  } catch (error) {
    console.error(`Failed to load translation for locale ${locale}:`, error);
    
    // If not default locale, try to load default as fallback
    if (locale !== DEFAULT_LOCALE && !translationCache.has(DEFAULT_LOCALE)) {
      try {
        const defaultTranslation = await import(`../locales/${DEFAULT_LOCALE}/translation.json`);
        translationCache.set(DEFAULT_LOCALE, defaultTranslation.default || defaultTranslation);
        return defaultTranslation.default || defaultTranslation;
      } catch (fallbackError) {
        console.error('Failed to load default locale translation:', fallbackError);
        return {};
      }
    }
    
    return {};
  }
}

/**
 * Preload a translation for a specific locale
 * Useful for preloading the organization's locale before it's needed
 * @param locale - The locale to preload
 */
export async function preloadTranslation(locale: SupportedLocale): Promise<void> {
  if (!translationCache.has(locale)) {
    await loadTranslation(locale);
  }
}

/**
 * Get the current size of the translation cache
 * Useful for monitoring memory usage
 * @returns Number of cached translations
 */
export function getTranslationCacheSize(): number {
  return translationCache.size;
}

/**
 * Clear the translation cache
 * Useful for testing or memory management
 */
export function clearTranslationCache(): void {
  translationCache.clear();
}

/**
 * Initialize i18next with configuration for all supported locales
 * Uses lazy loading to load translations on demand
 * @param locale - Optional initial locale (defaults to DEFAULT_LOCALE)
 * @param preloadAll - If true, preload all translations (useful for testing)
 * @returns Promise that resolves when initialization is complete
 */
export async function initializeI18n(locale: string = DEFAULT_LOCALE, preloadAll: boolean = false): Promise<void> {
  try {
    // Load the initial locale translation
    const initialTranslation = await loadTranslation(locale as SupportedLocale);
    
    const resources: Record<string, { translation: any }> = {
      [locale]: { translation: initialTranslation },
    };
    
    // Optionally preload all translations (for testing)
    if (preloadAll) {
      for (const loc of SUPPORTED_LOCALES) {
        if (loc !== locale) {
          try {
            const translation = await loadTranslation(loc);
            resources[loc] = { translation };
          } catch (error) {
            console.error(`Failed to preload translation for ${loc}:`, error);
          }
        }
      }
    }
    
    await i18n
      .use(LanguageDetector)
      .use(initReactI18next)
      .init({
        resources,
        lng: locale,
        fallbackLng: DEFAULT_LOCALE,
        supportedLngs: [...SUPPORTED_LOCALES],
        interpolation: {
          escapeValue: false, // React already escapes values
        },
        react: {
          useSuspense: false, // Avoid suspense for better UX
        },
        detection: {
          // Disable automatic detection, we'll set locale explicitly
          order: [],
        },
        // Log missing keys in development mode only
        saveMissing: process.env.NODE_ENV === 'development',
        missingKeyHandler: (lngs, ns, key) => {
          if (process.env.NODE_ENV === 'development') {
            console.warn(`Missing translation key: ${key} for languages: ${lngs.join(', ')}`);
          }
        },
      });
    
    // Set up lazy loading for language changes (only if not preloading all)
    if (!preloadAll) {
      i18n.on('languageChanged', async (lng) => {
        if (!i18n.hasResourceBundle(lng, 'translation')) {
          try {
            const translation = await loadTranslation(lng as SupportedLocale);
            i18n.addResourceBundle(lng, 'translation', translation, true, true);
          } catch (error) {
            console.error(`Failed to load translation for ${lng}:`, error);
          }
        }
      });
    }
  } catch (error) {
    console.error('Failed to initialize i18n, falling back to English:', error);
    // Attempt to initialize with minimal English-only configuration
    try {
      const fallbackTranslation = await loadTranslation(DEFAULT_LOCALE);
      await i18n
        .use(initReactI18next)
        .init({
          resources: {
            [DEFAULT_LOCALE]: { translation: fallbackTranslation },
          },
          lng: DEFAULT_LOCALE,
          fallbackLng: DEFAULT_LOCALE,
          interpolation: {
            escapeValue: false,
          },
          react: {
            useSuspense: false,
          },
        });
    } catch (fallbackError) {
      console.error('Critical: Failed to initialize i18n even with fallback:', fallbackError);
      // At this point, the app will continue but translations won't work
      // The app should still be functional with translation keys displayed
    }
  }
}

export default i18n;
