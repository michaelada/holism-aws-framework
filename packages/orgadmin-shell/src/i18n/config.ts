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
 * @param namespace - The namespace to load (default: 'translation')
 * @returns Promise resolving to the translation object
 */
async function loadTranslation(locale: SupportedLocale, namespace: string = 'translation'): Promise<any> {
  // Check cache first
  const cacheKey = `${locale}-${namespace}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  try {
    // Dynamically import the translation file
    const translation = await import(`../locales/${locale}/${namespace}.json`);
    
    // Cache the loaded translation
    translationCache.set(cacheKey, translation.default || translation);
    
    return translation.default || translation;
  } catch (error) {
    console.error(`Failed to load ${namespace} translation for locale ${locale}:`, error);
    
    // If not default locale, try to load default as fallback
    if (locale !== DEFAULT_LOCALE && !translationCache.has(`${DEFAULT_LOCALE}-${namespace}`)) {
      try {
        const defaultTranslation = await import(`../locales/${DEFAULT_LOCALE}/${namespace}.json`);
        translationCache.set(`${DEFAULT_LOCALE}-${namespace}`, defaultTranslation.default || defaultTranslation);
        return defaultTranslation.default || defaultTranslation;
      } catch (fallbackError) {
        console.error(`Failed to load default locale ${namespace} translation:`, fallbackError);
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
    // Load the initial locale translations for all namespaces
    const initialTranslation = await loadTranslation(locale as SupportedLocale, 'translation');
    const initialOnboarding = await loadTranslation(locale as SupportedLocale, 'onboarding');
    const initialHelp = await loadTranslation(locale as SupportedLocale, 'help');
    
    const resources: Record<string, { translation: any; onboarding: any; help: any }> = {
      [locale]: { 
        translation: initialTranslation,
        onboarding: initialOnboarding,
        help: initialHelp,
      },
    };
    
    // Optionally preload all translations (for testing)
    if (preloadAll) {
      for (const loc of SUPPORTED_LOCALES) {
        if (loc !== locale) {
          try {
            const translation = await loadTranslation(loc, 'translation');
            const onboarding = await loadTranslation(loc, 'onboarding');
            const help = await loadTranslation(loc, 'help');
            resources[loc] = { translation, onboarding, help };
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
        ns: ['translation', 'onboarding', 'help'],
        defaultNS: 'translation',
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
        missingKeyHandler: (lngs, _ns, key) => {
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
            const translation = await loadTranslation(lng as SupportedLocale, 'translation');
            i18n.addResourceBundle(lng, 'translation', translation, true, true);
          } catch (error) {
            console.error(`Failed to load translation for ${lng}:`, error);
          }
        }
        if (!i18n.hasResourceBundle(lng, 'onboarding')) {
          try {
            const onboarding = await loadTranslation(lng as SupportedLocale, 'onboarding');
            i18n.addResourceBundle(lng, 'onboarding', onboarding, true, true);
          } catch (error) {
            console.error(`Failed to load onboarding translation for ${lng}:`, error);
          }
        }
        if (!i18n.hasResourceBundle(lng, 'help')) {
          try {
            const help = await loadTranslation(lng as SupportedLocale, 'help');
            i18n.addResourceBundle(lng, 'help', help, true, true);
          } catch (error) {
            console.error(`Failed to load help translation for ${lng}:`, error);
          }
        }
      });
    }
  } catch (error) {
    console.error('Failed to initialize i18n, falling back to English:', error);
    // Attempt to initialize with minimal English-only configuration
    try {
      const fallbackTranslation = await loadTranslation(DEFAULT_LOCALE, 'translation');
      const fallbackOnboarding = await loadTranslation(DEFAULT_LOCALE, 'onboarding');
      const fallbackHelp = await loadTranslation(DEFAULT_LOCALE, 'help');
      await i18n
        .use(initReactI18next)
        .init({
          resources: {
            [DEFAULT_LOCALE]: { 
              translation: fallbackTranslation,
              onboarding: fallbackOnboarding,
              help: fallbackHelp,
            },
          },
          lng: DEFAULT_LOCALE,
          fallbackLng: DEFAULT_LOCALE,
          ns: ['translation', 'onboarding', 'help'],
          defaultNS: 'translation',
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
