import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, localeForLanguage } from '../i18n/config';

const LOCALES_DIR = join(__dirname, '..', 'locales');

function load(locale: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(LOCALES_DIR, locale, 'translation.json'), 'utf8'));
}

function flatten(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key)
  );
}

/**
 * CLAUDE.md §3.2 requires every key in all six locales.
 *
 * A missing key does not throw — i18next falls back to the key path — so a
 * member in one language quietly sees `pending.statusApproval` where everyone
 * else sees a sentence. Only a test catches that.
 */
describe('translation catalogues', () => {
  const reference = flatten(load(DEFAULT_LOCALE)).sort();

  it('covers all six locales', () => {
    expect(SUPPORTED_LOCALES).toHaveLength(6);
  });

  it.each(SUPPORTED_LOCALES.filter((l) => l !== DEFAULT_LOCALE))(
    '%s defines exactly the same keys as en-GB',
    (locale) => {
      const keys = flatten(load(locale)).sort();
      expect(keys).toEqual(reference);
    }
  );

  it.each(SUPPORTED_LOCALES)('%s leaves no value empty', (locale) => {
    const walk = (value: unknown, path: string): void => {
      if (typeof value === 'string') {
        expect(value.trim(), `${locale} ${path} is empty`).not.toBe('');
        return;
      }
      Object.entries(value as Record<string, unknown>).forEach(([key, child]) =>
        walk(child, path ? `${path}.${key}` : key)
      );
    };
    walk(load(locale), '');
  });

  it.each(SUPPORTED_LOCALES)('%s keeps every interpolation en-GB uses', (locale) => {
    const placeholders = (catalogue: Record<string, unknown>) => {
      const found = new Map<string, string[]>();
      const walk = (value: unknown, path: string): void => {
        if (typeof value === 'string') {
          found.set(path, [...value.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort());
          return;
        }
        Object.entries(value as Record<string, unknown>).forEach(([key, child]) =>
          walk(child, path ? `${path}.${key}` : key)
        );
      };
      walk(catalogue, '');
      return found;
    };

    // A translation that drops `{{organisation}}` renders a sentence with a
    // hole in it, which reads as a bug in the club's data rather than in the
    // catalogue.
    const expected = placeholders(load(DEFAULT_LOCALE));
    const actual = placeholders(load(locale));
    for (const [path, names] of expected) {
      expect(actual.get(path), `${locale} ${path}`).toEqual(names);
    }
  });
});

describe('localeForLanguage', () => {
  it('maps a bare language code onto its regional catalogue', () => {
    // `organizations.language` stores `en`/`fr`, the catalogues are `en-GB`/
    // `fr-FR`. Without the prefix match every club would fall back to English.
    expect(localeForLanguage('fr')).toBe('fr-FR');
    expect(localeForLanguage('de')).toBe('de-DE');
    expect(localeForLanguage('pt')).toBe('pt-PT');
  });

  it('passes an exact locale through', () => {
    expect(localeForLanguage('it-IT')).toBe('it-IT');
  });

  it('falls back to the default for an unsupported or absent language', () => {
    expect(localeForLanguage('ga')).toBe(DEFAULT_LOCALE);
    expect(localeForLanguage(null)).toBe(DEFAULT_LOCALE);
    expect(localeForLanguage(undefined)).toBe(DEFAULT_LOCALE);
    expect(localeForLanguage('')).toBe(DEFAULT_LOCALE);
  });
});
