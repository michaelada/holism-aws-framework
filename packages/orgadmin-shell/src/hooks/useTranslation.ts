import { useCallback, useMemo, useRef } from 'react';
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
 *
 * ## Everything this returns is referentially stable
 *
 * `t`, `i18n` and the result object itself keep their identity between renders,
 * changing only when the active language does. That is not a micro-optimisation
 * — it is what makes the hook safe to name in a dependency array.
 *
 * This wrapper used to build a fresh `t` closure on every render. Any component
 * that did the obvious thing:
 *
 *     const load = useCallback(async () => { … }, [execute, t]);
 *     useEffect(() => { void load(); }, [load]);
 *
 * then re-created `load` on each render, re-fired the effect, set state, and
 * rendered again — an unbounded request loop. The offline payments list hit the
 * API hard enough to earn HTTP 429s and then `ERR_INSUFFICIENT_RESOURCES`, with
 * nothing on screen to suggest why. The call site looked correct, because it
 * was; the hook underneath it was not.
 *
 * react-i18next's own `t` is snapshot-cached and changes only on a language
 * change or a resource reload, so keying on it propagates exactly the right
 * invalidation and no more.
 */
export function useTranslation(namespace?: string | string[], options?: UseTranslationOptions<any>): UseTranslationResult {
  const { t: i18nextT, i18n, ready } = useI18nextTranslation(namespace, options);

  // Wrap the translation function to ensure it never throws and always returns a string
  const t: TranslationFunction = useCallback(
    (key: string, options?: Record<string, any>) => {
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
    },
    [i18nextT]
  );

  const language = i18n.language;

  /*
   * Held in a ref rather than named as a dependency. `changeLanguage` has to be
   * invoked as a method — i18next's implementation uses `this` — so it cannot
   * be extracted and called detached, and keying the memo on the whole `i18n`
   * object would make this churn whenever react-i18next hands back a fresh
   * wrapper. The ref gives the callback the current instance without making the
   * callback's identity depend on it.
   */
  const i18nRef = useRef(i18n);
  i18nRef.current = i18n;

  const changeLanguage = useCallback(async (lng: string) => {
    const instance = i18nRef.current;
    if (instance?.changeLanguage) {
      await instance.changeLanguage(lng);
    }
  }, []);

  const wrappedI18n = useMemo(
    () => ({ language, changeLanguage }),
    [language, changeLanguage]
  );

  return useMemo(() => ({ t, i18n: wrappedI18n, ready }), [t, wrappedI18n, ready]);
}

// Re-export useLocale from LocaleContext for convenience
export { useLocale } from '../context/LocaleContext';
