import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

export const SUPPORTED_LOCALES = [
  'en-GB',
  'fr-FR',
  'es-ES',
  'it-IT',
  'de-DE',
  'pt-PT',
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'en-GB';

const cache = new Map<string, unknown>();

/**
 * Map an organisation's stored language onto a supported locale.
 *
 * `organizations.language` holds a bare language code (`en`, `fr`), while the
 * catalogues are regional (`en-GB`, `fr-FR`). Without this the org's language
 * silently fails to match and every member sees English.
 */
export function localeForLanguage(language: string | null | undefined): SupportedLocale {
  if (!language) return DEFAULT_LOCALE;
  const exact = SUPPORTED_LOCALES.find((l) => l === language);
  if (exact) return exact;
  const byPrefix = SUPPORTED_LOCALES.find(
    (l) => l.split('-')[0] === language.split('-')[0]
  );
  return byPrefix || DEFAULT_LOCALE;
}

async function loadTranslation(locale: SupportedLocale): Promise<unknown> {
  if (cache.has(locale)) return cache.get(locale);

  try {
    const mod = await import(`../locales/${locale}/translation.json`);
    const resource = mod.default || mod;
    cache.set(locale, resource);
    return resource;
  } catch (error) {
    console.error(`Failed to load translation for ${locale}:`, error);
    // Returning {} rather than throwing keeps the app usable — i18next falls
    // back to the key, which is visibly wrong but not a blank screen.
    return {};
  }
}

/**
 * Initialise i18next.
 *
 * Locale is set explicitly rather than detected: the organisation's own
 * language wins over the browser's, because a club's members are shown the
 * club's language. That is decided once the organisation resolves, so
 * `changeLocale` exists to switch after the fact (A7 — switching organisations
 * reloads the locale if the new org's language differs).
 */
export async function initializeI18n(
  locale: SupportedLocale = DEFAULT_LOCALE
): Promise<typeof i18n> {
  const translation = await loadTranslation(locale);

  await i18n.use(initReactI18next).init({
    resources: { [locale]: { translation: translation as Record<string, unknown> } },
    lng: locale,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: [...SUPPORTED_LOCALES],
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

  return i18n;
}

/** Switch locale, loading the catalogue first if it has not been seen. */
export async function changeLocale(locale: SupportedLocale): Promise<void> {
  if (!i18n.hasResourceBundle(locale, 'translation')) {
    const translation = await loadTranslation(locale);
    i18n.addResourceBundle(locale, 'translation', translation, true, true);
  }
  await i18n.changeLanguage(locale);
}

export default i18n;
