import { describe, it, expect } from 'vitest';
import { translateFromCatalogue } from '../shellMock';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createShellMock, translateToKey } from '../shellMock';

/**
 * The shared shell mock must cover everything the shell exports.
 *
 * This test is the reason the mock is worth having. Five org-admin packages
 * each carried their own partial mock of `@itsplainsailing/orgadmin-shell`;
 * adding `usePageHelp`, `useOnboarding` and `useCapabilities` to pages broke
 * them all at once, with hundreds of failing assertions about hooks none of
 * those tests cared about.
 *
 * Centralising the mock only helps if it stays complete — otherwise the next
 * export reintroduces exactly the same failure, in one place instead of many.
 * So this reads the shell's real export list and fails if the mock has fallen
 * behind, naming what is missing.
 */

const SHELL_INDEX = join(__dirname, '../../../../orgadmin-shell/index.ts');

/** Every name `orgadmin-shell/index.ts` re-exports. */
function shellExports(): string[] {
  const source = readFileSync(SHELL_INDEX, 'utf-8');
  const names: string[] = [];

  for (const match of source.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const part of match[1].split(',')) {
      // `export { a as b }` publishes `b`.
      const name = part.includes(' as ') ? part.split(' as ')[1] : part;
      const cleaned = name.trim();
      if (cleaned) names.push(cleaned);
    }
  }

  return names;
}

describe('the shared shell mock', () => {
  it('finds the real shell to compare against', () => {
    // A silently-empty list would make every assertion below vacuous.
    expect(shellExports().length).toBeGreaterThan(5);
  });

  it('covers every export the shell publishes', () => {
    const missing = shellExports().filter((name) => !(name in createShellMock()));

    expect(
      missing,
      `shellMock.ts is missing ${missing.join(', ')} — add them, or every suite ` +
        'that mocks the shell fails with "No export is defined on the mock" about ' +
        'a hook it does not use'
    ).toEqual([]);
  });

  it('gives usePageHelp in particular, which is what broke before', () => {
    expect(createShellMock().usePageHelp).toBeTypeOf('function');
  });

  it('returns a fresh set of stubs each call, so suites cannot leak into each other', () => {
    expect(createShellMock().usePageHelp).not.toBe(createShellMock().usePageHelp);
  });

  it('resolves translations against the real catalogue by default', () => {
    expect(createShellMock().useTranslation().t('events.searchPlaceholder')).toBe(
      'Search events...'
    );
  });

  it('falls back to the key when the catalogue has no entry, so the gap is visible', () => {
    expect(createShellMock().useTranslation().t('events.noSuchKey')).toBe('events.noSuchKey');
  });

  it('returns key paths when a package asks for them', () => {
    expect(createShellMock({ t: translateToKey }).useTranslation().t('events.title')).toBe(
      'events.title'
    );
  });
});

/**
 * Counted strings.
 *
 * A catalogue entry with a count has no bare key — only `_one` and `_other` —
 * so a mock that looks up the bare path renders "events.entries.count" and the
 * assertion reads as a broken page.
 */
describe('plurals', () => {
  it('selects the singular for one', () => {
    expect(translateFromCatalogue('events.entries.count', { count: 1 })).toBe('1 entry');
  });

  it('selects the plural for anything else', () => {
    expect(translateFromCatalogue('events.entries.count', { count: 4 })).toBe('4 entries');
    expect(translateFromCatalogue('events.entries.count', { count: 0 })).toBe('0 entries');
  });

  it('still returns the key when neither form exists', () => {
    expect(translateFromCatalogue('nothing.here', { count: 2 })).toBe('nothing.here');
  });
});
