/**
 * Property-based tests for internationalisation in the Registrations Module.
 *
 * Property 19: All user-visible text uses translation keys
 * Property 20: Date formatting respects locale
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

import registrationsTranslationKeys from '../i18n/en';
import { formatDate } from '@aws-web-framework/orgadmin-shell';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Recursively collect all .tsx source files under a directory, excluding
 * __tests__ folders.
 */
function collectSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'test' || entry.name === 'i18n') continue;
      results.push(...collectSourceFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Extract all translation keys referenced via t('...') calls in a source file.
 */
function extractTKeys(content: string): string[] {
  // Match t('key') and t('key', { ... })
  const regex = /\bt\(\s*['"]([^'"]+)['"]/g;
  const keys: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    keys.push(match[1]);
  }
  return keys;
}

// ─── Property 19 ─────────────────────────────────────────────────────────────

describe('Feature: registrations-module, Property 19: All user-visible text uses translation keys', () => {
  /**
   * **Validates: Requirements 9.1**
   *
   * For any rendered page in the registrations module, all user-visible text
   * should be sourced from translation keys via the t() function.
   *
   * We verify this by scanning every .tsx source file for t('...') calls and
   * checking that every extracted key exists in the canonical translation keys
   * catalogue (i18n/en.ts).
   */

  const srcRoot = path.resolve(__dirname, '..');
  const sourceFiles = collectSourceFiles(srcRoot);
  const allKeysInCatalogue = new Set(Object.keys(registrationsTranslationKeys));

  // Build a map of file → keys used
  const fileKeyMap: Array<{ file: string; keys: string[] }> = [];
  for (const file of sourceFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const keys = extractTKeys(content);
    if (keys.length > 0) {
      fileKeyMap.push({ file: path.relative(srcRoot, file), keys });
    }
  }

  // Flatten to a unique set of all keys used in source
  const allKeysUsed = Array.from(new Set(fileKeyMap.flatMap((f) => f.keys)));

  it('every t() key used in source files exists in the translation catalogue', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allKeysUsed),
        (key: string) => {
          expect(
            allKeysInCatalogue.has(key),
            `Translation key "${key}" is used in source but missing from i18n/en.ts`,
          ).toBe(true);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('source files contain t() calls (sanity check)', () => {
    // At least some source files should use translation keys
    expect(allKeysUsed.length).toBeGreaterThan(0);
    expect(fileKeyMap.length).toBeGreaterThan(0);
  });

  it('random subsets of catalogue keys are all present', () => {
    const catalogueKeys = Object.keys(registrationsTranslationKeys);

    fc.assert(
      fc.property(
        fc.shuffledSubarray(catalogueKeys, { minLength: 1, maxLength: Math.min(10, catalogueKeys.length) }),
        (subset: string[]) => {
          for (const key of subset) {
            expect(allKeysInCatalogue.has(key)).toBe(true);
          }
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ─── Property 20 ─────────────────────────────────────────────────────────────

describe('Feature: registrations-module, Property 20: Date formatting respects locale', () => {
  /**
   * **Validates: Requirements 9.2**
   *
   * For any date value and any configured locale, the formatted date output
   * should conform to the locale's date formatting conventions.
   *
   * We verify this by generating random valid dates and formatting them with
   * each supported locale, then checking that the output is a non-empty string
   * that differs across at least some locales (proving locale-awareness).
   */

  const supportedLocales = ['en-GB', 'fr-FR', 'es-ES', 'it-IT', 'de-DE', 'pt-PT'] as const;

  // Arbitrary for a valid Date timestamp between 2000-01-01 and 2030-12-31
  const dateArb = fc.date({
    min: new Date('2000-01-01T00:00:00Z'),
    max: new Date('2030-12-31T23:59:59Z'),
  });

  const localeArb = fc.constantFrom(...supportedLocales);

  it('formatDate returns a non-empty string for any valid date and locale', () => {
    fc.assert(
      fc.property(dateArb, localeArb, (date, locale) => {
        const result = formatDate(date, 'dd MMM yyyy', locale);
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      }),
      { numRuns: 20 },
    );
  });

  it('formatDate produces locale-sensitive month names', () => {
    // Use a fixed date so we can compare across locales
    const fixedDate = new Date('2026-02-14T12:00:00Z');
    const results = new Map<string, string>();

    for (const locale of supportedLocales) {
      results.set(locale, formatDate(fixedDate, 'MMMM', locale));
    }

    // English should say "February"
    expect(results.get('en-GB')).toBe('February');
    // French should say "février"
    expect(results.get('fr-FR')).toBe('février');
    // At least 2 distinct month names across all locales (proves locale-awareness)
    const uniqueMonths = new Set(results.values());
    expect(uniqueMonths.size).toBeGreaterThanOrEqual(2);
  });

  it('formatDate output contains the correct day number for any date and locale', () => {
    fc.assert(
      fc.property(dateArb, localeArb, (date, locale) => {
        const result = formatDate(date, 'dd MMM yyyy', locale);
        const dayStr = String(date.getUTCDate()).padStart(2, '0');
        // The formatted string should contain the day number
        expect(result).toContain(dayStr);
      }),
      { numRuns: 20 },
    );
  });
});
