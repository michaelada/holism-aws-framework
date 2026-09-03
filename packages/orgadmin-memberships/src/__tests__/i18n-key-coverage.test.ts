/**
 * Every key this module renders exists in every locale.
 *
 * The module's own suites mock `t()` as the identity function (see
 * `test/shell-mock.ts`), which makes them readable and blind to this: a page
 * asking for a key nobody wrote renders the key itself, the assertions still
 * pass, and the club reads *"memberships.actions.editMember"* across the top of
 * the member they just opened. That is exactly how it shipped.
 *
 * So the keys are checked against the catalogue directly, by reading the
 * sources rather than by listing keys here — a hand-kept list stops covering
 * the page the moment somebody adds a string to it.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

import enGB from '../../../orgadmin-shell/src/locales/en-GB/translation.json';
import deDE from '../../../orgadmin-shell/src/locales/de-DE/translation.json';
import esES from '../../../orgadmin-shell/src/locales/es-ES/translation.json';
import frFR from '../../../orgadmin-shell/src/locales/fr-FR/translation.json';
import itIT from '../../../orgadmin-shell/src/locales/it-IT/translation.json';
import ptPT from '../../../orgadmin-shell/src/locales/pt-PT/translation.json';

const SOURCE = join(__dirname, '..');

/** Every source file of the module, tests and helpers aside. */
const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      return entry === '__tests__' || entry === 'test' ? [] : sources(path);
    }
    return /\.tsx?$/.test(entry) ? [path] : [];
  });

/**
 * Keys the module asks for with no fallback.
 *
 * `t('key', 'Some default')` is excluded deliberately: a fallback is a string
 * on the screen, so a missing key there is untranslated rather than raw.
 */
const keysUsed = (): Map<string, string[]> => {
  const used = new Map<string, string[]>();
  for (const file of sources(SOURCE)) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'\s*([,)])/g)) {
      const [, key, next] = match;
      if (next !== ')' || !key.includes('.')) continue;
      used.set(key, [...(used.get(key) ?? []), relative(SOURCE, file)]);
    }
  }
  return used;
};

const lookup = (catalogue: unknown, key: string): unknown =>
  key.split('.').reduce<unknown>(
    (node, part) =>
      node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
    catalogue
  );

describe('memberships i18n key coverage', () => {
  const used = keysUsed();

  it('reads the module’s own strings, not a list kept by hand', () => {
    // A guard on the guard: a regex that matched nothing would pass everything.
    expect(used.size).toBeGreaterThan(100);
    expect(used.has('memberships.actions.editMember')).toBe(true);
  });

  it('resolves every key it renders', () => {
    const missing = [...used.entries()]
      .filter(([key]) => typeof lookup(enGB, key) !== 'string')
      .map(([key, files]) => `${key} (${files.join(', ')})`);

    expect(missing).toEqual([]);
  });

  /*
   * es-ES and fr-FR are partial catalogues and fall back to en-GB by design, so
   * they are checked for *contradiction* rather than coverage: a key that
   * exists must be a string, not a branch left half-written.
   */
  it.each([
    ['de-DE', deDE],
    ['es-ES', esES],
    ['fr-FR', frFR],
    ['it-IT', itIT],
    ['pt-PT', ptPT],
  ])('holds no half-written branch in %s', (_locale, catalogue) => {
    const broken = [...used.keys()].filter((key) => {
      const value = lookup(catalogue, key);
      return value !== undefined && typeof value !== 'string';
    });

    expect(broken).toEqual([]);
  });
});
