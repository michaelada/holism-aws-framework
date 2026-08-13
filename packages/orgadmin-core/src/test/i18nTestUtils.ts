/**
 * Test helpers for components that resolve copy through the shell's i18n.
 *
 * `resolveTranslation` looks a dotted key up in the real en-GB translation
 * file, so tests can keep asserting on the English a user would see rather than
 * on raw i18n keys. Keys that are genuinely missing come back unchanged, which
 * makes a missing translation visible in the failure message.
 */

import enGB from '../../../orgadmin-shell/src/locales/en-GB/translation.json';

type Interpolation = Record<string, unknown> | undefined;

function lookup(key: string): string | undefined {
  const value = key
    .split('.')
    .reduce<any>((node, part) => (node && typeof node === 'object' ? node[part] : undefined), enGB);
  return typeof value === 'string' ? value : undefined;
}

/**
 * Resolve a key the way i18next would: substitute {{placeholders}} from the
 * options object, and fall back to the key itself when nothing is defined.
 */
export function resolveTranslation(key: string, options?: Interpolation): string {
  const template = lookup(key);
  if (template === undefined) {
    return key;
  }
  if (!options) {
    return template;
  }
  return template.replace(/{{\s*(\w+)\s*}}/g, (match, name) =>
    options[name] !== undefined ? String(options[name]) : match
  );
}

/** Drop-in replacement for the shell's useTranslation in tests. */
export function useTranslationMock() {
  return {
    t: resolveTranslation,
    i18n: { language: 'en-GB', changeLanguage: () => Promise.resolve() },
  };
}

/** Deterministic currency formatting, independent of Intl's locale data. */
export function formatCurrencyMock(value: number, currency = 'EUR'): string {
  const symbols: Record<string, string> = { EUR: '€', GBP: '£', USD: '$' };
  const symbol = symbols[currency] ?? `${currency} `;
  return `${symbol}${value.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
