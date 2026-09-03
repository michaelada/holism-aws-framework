import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { shellMock } from '../shell-mock';

/**
 * The shared shell mock must cover everything the shell exports.
 *
 * This test is the reason the mock is worth having. Seven suites once carried
 * their own partial mock of `@itsplainsailing/orgadmin-shell`; adding
 * `usePageHelp` to two pages broke all seven at once, with 57 failing
 * assertions about a hook none of them cared about.
 *
 * Centralising the mock only helps if it stays complete — otherwise the next
 * export reintroduces exactly the same failure, in one place instead of seven.
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
    const missing = shellExports().filter((name) => !(name in shellMock()));

    expect(
      missing,
      `shell-mock.ts is missing ${missing.join(', ')} — add them, or seven suites ` +
        'will fail with "No export is defined on the mock" about a hook they do not use'
    ).toEqual([]);
  });

  it('gives usePageHelp in particular, which is what broke before', () => {
    expect(shellMock().usePageHelp).toBeTypeOf('function');
  });

  it('returns a fresh set of stubs each call, so suites cannot leak into each other', () => {
    const first = shellMock();
    const second = shellMock();

    expect(first.usePageHelp).not.toBe(second.usePageHelp);
  });

  it('resolves translations to the key, as this package’s suites expect', () => {
    expect(shellMock().useTranslation().t('memberships.title')).toBe('memberships.title');
  });
});
