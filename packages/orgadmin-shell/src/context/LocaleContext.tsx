import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import i18n, { preloadTranslation } from '../i18n/config';
import { SupportedLocale, DEFAULT_LOCALE, SUPPORTED_LOCALES } from '../i18n/config';

interface LocaleContextValue {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => Promise<void>;
  isLoading: boolean;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

interface LocaleProviderProps {
  children: ReactNode;
  organizationLocale?: string;
}

/**
 * LocaleProvider component that wraps the app and provides locale context
 * Integrates with i18next to manage language changes with lazy loading
 */
export function LocaleProvider({ children, organizationLocale }: LocaleProviderProps): JSX.Element {
  const [locale, setLocaleState] = useState<SupportedLocale>(() => {
    // Initialize with organization locale if valid, otherwise use default
    if (organizationLocale && SUPPORTED_LOCALES.includes(organizationLocale as SupportedLocale)) {
      return organizationLocale as SupportedLocale;
    }
    return DEFAULT_LOCALE;
  });
  const [isLoading, setIsLoading] = useState(false);

  // Update i18n language and HTML lang attribute when locale changes
  useEffect(() => {
    // i18n should be initialized by the time this component renders
    // but we'll still check to be safe
    if (i18n.isInitialized && i18n.language !== locale) {
      i18n.changeLanguage(locale).catch((error) => {
        console.error('Failed to change language:', error);
      });
    }
    
    // Update HTML lang attribute for accessibility (screen readers)
    // Convert locale format from 'en-GB' to 'en-gb' (lowercase) as per HTML spec
    document.documentElement.lang = locale.toLowerCase();
  }, [locale]);

  // Update locale when organizationLocale prop changes and preload translation
  useEffect(() => {
    if (organizationLocale && SUPPORTED_LOCALES.includes(organizationLocale as SupportedLocale)) {
      const newLocale = organizationLocale as SupportedLocale;
      if (newLocale !== locale) {
        // Preload the translation for the new locale
        preloadTranslation(newLocale).then(() => {
          setLocaleState(newLocale);
        }).catch((error) => {
          console.error('Failed to preload translation:', error);
          // Still set the locale, i18n will handle loading on demand
          setLocaleState(newLocale);
        });
      }
    }
  }, [organizationLocale, locale]);

  /**
   * Change the active locale
   * Preloads the translation before switching
   * @param newLocale - The locale to switch to
   */
  const setLocale = async (newLocale: SupportedLocale): Promise<void> => {
    if (!SUPPORTED_LOCALES.includes(newLocale)) {
      console.error(`Unsupported locale: ${newLocale}. Falling back to ${DEFAULT_LOCALE}`);
      newLocale = DEFAULT_LOCALE;
    }

    if (newLocale === locale) {
      return; // No change needed
    }

    // Wait for i18n to be initialized
    if (!i18n.isInitialized) {
      console.warn('i18n not initialized yet, waiting...');
      // Set locale state anyway, it will be applied when i18n initializes
      setLocaleState(newLocale);
      return;
    }

    setIsLoading(true);
    try {
      // Preload the translation before switching
      await preloadTranslation(newLocale);
      await i18n.changeLanguage(newLocale);
      setLocaleState(newLocale);
    } catch (error) {
      console.error('Failed to change locale:', error);
      // Fall back to default locale on error
      try {
        await preloadTranslation(DEFAULT_LOCALE);
        await i18n.changeLanguage(DEFAULT_LOCALE);
        setLocaleState(DEFAULT_LOCALE);
      } catch (fallbackError) {
        console.error('Critical: Failed to fall back to default locale:', fallbackError);
        // Keep current locale if fallback also fails
      }
    } finally {
      setIsLoading(false);
    }
  };

  const value: LocaleContextValue = {
    locale,
    setLocale,
    isLoading,
  };

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/**
 * Hook to access the locale context
 * @throws Error if used outside of LocaleProvider
 */
export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (context === undefined) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
}
