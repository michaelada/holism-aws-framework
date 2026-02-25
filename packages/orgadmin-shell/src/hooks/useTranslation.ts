import { useTranslation as useI18nextTranslation, UseTranslationOptions } from 'react-i18next';

/**
 * Translation function type
 */
export type TranslationFunction = (key: string, options?: Record<string, any>) => string;

/**
 * Result of useTranslation hook
 */
export interface UseTranslationResult {
  t: TranslationFunction;
  i18n: {
    language: string;
    changeLanguage: (lng: string) => Promise<void>;
  };
  ready: boolean;
}

/**
 * Wrapper around react-i18next's useTranslation hook
 * Provides a consistent interface for all modules to access translations
 * 
 * @param namespace - Optional namespace for translations (defaults to 'translation')
 * @returns Translation function and i18n instance
 * 
 * @example
 * const { t } = useTranslation();
 * const saveText = t('common.actions.save'); // Returns "Save"
 * 
 * @example
 * const { t } = useTranslation();
 * const minLengthError = t('common.validation.minLength', { min: 5 }); // Returns "Must be at least 5 characters"
 */
export function useTranslation(namespace?: string | string[], options?: UseTranslationOptions<any>): UseTranslationResult {
  const { t: i18nextT, i18n, ready } = useI18nextTranslation(namespace, options);

  // Wrap the translation function to ensure it never throws and always returns a string
  const t: TranslationFunction = (key: string, options?: Record<string, any>) => {
    try {
      const result = i18nextT(key, options);
      
      // If the result is the same as the key, it means the translation is missing
      // This is expected behavior - i18next returns the key when translation is not found
      if (result === key && process.env.NODE_ENV === 'development') {
        // Only log in development to help developers identify missing translations
        console.warn(`Missing translation for key: ${key}`);
      }
      
      return result;
    } catch (error) {
      // If translation fails for any reason, return the key itself as fallback
      console.error(`Error translating key "${key}":`, error);
      return key;
    }
  };

  return {
    t,
    i18n: {
      language: i18n.language,
      changeLanguage: async (lng: string) => {
        if (i18n.changeLanguage) {
          await i18n.changeLanguage(lng);
        }
      },
    },
    ready,
  };
}

// Re-export useLocale from LocaleContext for convenience
export { useLocale } from '../context/LocaleContext';
