/**
 * The one list of each. There used to be three different language/locale lists
 * across two pages — one offering Chinese and Japanese, one offering en-US, and
 * one correct — so the same field offered different options depending on which
 * page you opened.
 *
 * The platform ships six locales (see `.claude/modules/architecture.md`). The
 * language list is derived from them rather than maintained separately, so the
 * two cannot drift apart again.
 */

export const LOCALES = [
  { code: 'en-GB', name: 'English (UK)', language: 'en' },
  { code: 'de-DE', name: 'Deutsch (Deutschland)', language: 'de' },
  { code: 'es-ES', name: 'Español (España)', language: 'es' },
  { code: 'fr-FR', name: 'Français (France)', language: 'fr' },
  { code: 'it-IT', name: 'Italiano (Italia)', language: 'it' },
  { code: 'pt-PT', name: 'Português (Portugal)', language: 'pt' },
] as const;

export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'de', name: 'German' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
] as const;

/**
 * Currencies an organisation type may be denominated in.
 *
 * Organisations inherit this from their type and cannot diverge from it, so the
 * list is deliberately short and deliberately lives in one place.
 */
export const CURRENCIES = ['GBP', 'EUR', 'USD', 'AUD', 'CAD', 'JPY', 'CNY'] as const;
