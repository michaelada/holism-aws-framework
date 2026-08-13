import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

/**
 * `t(...)` written as JSX children without braces renders as literal text.
 *
 * ```jsx
 * <Button>
 *   t('users.admins.invite')     ← renders the characters t('users.admins.invite')
 * </Button>
 * ```
 *
 * This is not an i18n failure and does not look like one. `t()` is never
 * called, so nothing reports a missing key, the catalogue is complete, and
 * every i18n test passes — while the user reads `t('users.admins.invite')` off
 * a button. Seven of these were live at once across the users pages, including
 * two breadcrumbs, and no test caught any of them because the assertions are on
 * keys the mocked `t` returns rather than on what the element actually renders.
 *
 * A scanner is the right shape for this: the mistake is invisible to
 * TypeScript (it is valid JSX text), invisible to i18n tooling (the key exists
 * and is simply never looked up), and cheap to detect by eye only if you
 * already suspect it.
 */

const REPO_ROOT = resolve(__dirname, '../../../..');
const PACKAGES = join(REPO_ROOT, 'packages');

/** A whole line that is nothing but a `t(...)` call. */
const BARE_CALL = /^\s*t\(\s*['"][^'"]+['"]\s*(,.*)?\)\s*[,;]?\s*$/;

function collectTsx(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) collectTsx(full, found);
    else if (entry.endsWith('.tsx')) found.push(full);
  }
  return found;
}

/**
 * A bare `t(...)` line is only a bug in JSX child position. The same shape is
 * correct as one element of a multi-line expression:
 *
 *   setError(
 *     t('users.groups.deletedButReferenced', { count })
 *   );
 *
 * so the neighbouring lines decide it: JSX children sit after a tag that has
 * just closed (`>`) or before a closing tag (`</`).
 */
function isJsxChild(lines: string[], index: number): boolean {
  const prev = (lines[index - 1] ?? '').trim();
  const next = (lines[index + 1] ?? '').trim();
  const afterOpeningTag = prev.endsWith('>') && !prev.endsWith('=>');
  const beforeClosingTag = next.startsWith('</');
  return afterOpeningTag || beforeClosingTag;
}

describe('translation calls in JSX', () => {
  it('are never written as bare JSX text', () => {
    const offenders: string[] = [];

    for (const file of collectTsx(PACKAGES)) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (BARE_CALL.test(line) && isJsxChild(lines, i)) {
          offenders.push(`${file.replace(REPO_ROOT + '/', '')}:${i + 1}  ${line.trim()}`);
        }
      });
    }

    expect(
      offenders,
      `t(...) used as JSX children without braces — these render as literal text:\n` +
        offenders.map((o) => `  ${o}`).join('\n') +
        `\n\nWrap each in braces: {t('…')}`
    ).toEqual([]);
  });
});
