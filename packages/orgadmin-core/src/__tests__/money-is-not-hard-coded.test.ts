/**
 * No screen names a currency for itself.
 *
 * A structural test, not a behavioural one, because the defect it guards is a
 * literal typed at a call site — and it was typed at twenty-two of them before
 * anyone noticed. Payments and lodgements rendered `GBP`, reporting rendered
 * `EUR`, and the core dashboard carried its own formatter pinned to `en-IE` and
 * `EUR`. A euro club saw sterling on its refund confirmation. A sterling club
 * saw euro on its revenue report. Both looked deliberate.
 *
 * Nothing about a unit test of any one page would have caught that, because
 * each page was internally consistent. Only the whole tree is.
 *
 * The currency belongs to the organisation — fixed by its organisation type,
 * per PRODUCT.md — so it reaches the interface through `useCurrency()` and
 * nowhere else.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(__dirname, '..');

/** ISO codes this platform offers, as they would appear typed in source. */
const CODES = ['GBP', 'EUR', 'USD', 'AUD', 'CAD', 'JPY', 'CNY'];

/**
 * Places a currency code legitimately appears: the settings dropdown that lists
 * them, its translation keys, and test fixtures that must pick one.
 */
const ALLOWED = [
  'settings/components/OrganisationDetailsTab.tsx', // the options list itself
  'test/',
  '__tests__/',
  '.test.',
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry) ? [full] : [];
  });
}

describe('money is never hard-coded to a currency', () => {
  const files = sourceFiles(SRC).filter((f) => {
    const rel = relative(SRC, f);
    return !ALLOWED.some((allowed) => rel.includes(allowed));
  });

  it('scans a meaningful number of files', () => {
    // Guard against the walk silently matching nothing and the suite passing
    // green over an empty set. The exact figure is not the point; a collapse to
    // zero is.
    expect(files.length).toBeGreaterThan(30);
  });

  it('passes no currency literal to a formatter', () => {
    const offenders: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      source.split('\n').forEach((line, index) => {
        for (const code of CODES) {
          // `formatCurrency(x, 'GBP', …)` and `currency: 'GBP'`
          const passed = new RegExp(`formatCurrency\\([^,]+,\\s*['"]${code}['"]`).test(line);
          const assigned = new RegExp(`currency:\\s*['"]${code}['"]`).test(line);
          if (passed || assigned) {
            offenders.push(`${relative(SRC, file)}:${index + 1}  ${line.trim()}`);
          }
        }
      });
    }

    expect(
      offenders,
      `Use useCurrency() — the organisation owns its currency:\n${offenders.join('\n')}`
    ).toEqual([]);
  });

  it('builds no Intl currency formatter with a literal code', () => {
    // The core dashboard did exactly this, shadowing the shared helper, so the
    // call-site rule above would not have seen it.
    const offenders: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const code of CODES) {
        if (new RegExp(`style:\\s*['"]currency['"][\\s\\S]{0,120}?['"]${code}['"]`).test(source)) {
          offenders.push(`${relative(SRC, file)} pins ${code}`);
        }
      }
    }

    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
