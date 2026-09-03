/**
 * Test double for `@itsplainsailing/orgadmin-shell`.
 *
 * Pages in this package read translations, onboarding, page help, capabilities
 * and locale from the shell. Standing up the shell's real providers in a unit
 * test means initialising i18next and a provider stack for what is usually a
 * single assertion, so the module is mocked instead:
 *
 *     vi.mock('@itsplainsailing/orgadmin-shell', () =>
 *       import('../../../test/orgadminShellMock'));
 *
 * Two things this file is careful about, both of which cause silent, confusing
 * failures when got wrong:
 *
 *  - **Stable references.** `useOnboarding`, `useCapabilities` and `useLocale`
 *    feed `useEffect` dependency arrays. Returning a fresh object per render
 *    re-triggers those effects forever and the test times out rather than
 *    failing with anything readable (CLAUDE.md §3.4).
 *  - **`t()` resolves the real en-GB catalogue**, so assertions read as the text
 *    a user sees rather than as key paths. A key with no translation falls
 *    through to the key itself, which makes the gap visible in a failure.
 */

import { vi } from 'vitest';
import enGB from '../../../orgadmin-shell/src/locales/en-GB/translation.json';
import {
  formatDate as realFormatDate,
  formatDateTime as realFormatDateTime,
} from '../../../orgadmin-shell/src/utils/dateFormatting';
import { formatCurrency as realFormatCurrency } from '../../../orgadmin-shell/src/utils/currencyFormatting';

/** Spies the suites can assert on, e.g. `expect(shellMock.checkModuleVisit)`. */
export const checkModuleVisit = vi.fn();
export const setCurrentModule = vi.fn();
export const setCurrentPageId = vi.fn();
export const setLocale = vi.fn();

/**
 * Capability gate. Defaults to permissive so a page under test renders its
 * whole surface; a suite that needs a capability withheld can override it with
 * `hasCapability.mockReturnValue(false)`.
 */
export const hasCapability = vi.fn(() => true);

const onboarding = { checkModuleVisit, setCurrentModule, setCurrentPageId };
const capabilities = { hasCapability, capabilities: [] as string[] };
const locale = { locale: 'en-GB', setLocale };
/**
 * Resolve against the real en-GB catalogue, falling back to the key.
 *
 * Returning the key would be simpler, but then every assertion reads
 * `users.fields.email` instead of "Email" and the suites stop describing what a
 * member actually sees. Falling back to the key also makes a missing
 * translation visible in a test failure rather than silently rendering blank.
 */
function translate(key: string, options?: Record<string, unknown>): string {
  const lookup = (path: string): unknown =>
    path.split('.').reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
      enGB as unknown
    );

  /*
   * Plurals, the way i18next selects them. A counted entry has no bare key at
   * all — only `_one` and `_other` — so looking up the plain path finds nothing
   * and the page renders "payments.settlement.itemsCreated", which reads in a
   * failure as though the page were broken.
   */
  const value =
    lookup(key) ??
    (options && typeof options.count === 'number'
      ? lookup(`${key}_${options.count === 1 ? 'one' : 'other'}`)
      : undefined);

  if (typeof value !== 'string') return key;

  // i18next-style interpolation. Without this, "{{count}} lodgements" renders
  // literally and every assertion on an interpolated string fails in a way that
  // looks like the page is broken.
  return value.replace(/\{\{(\w+)\}\}/g, (match, name) =>
    options && name in options ? String(options[name]) : match
  );
}

const translation = { t: translate, i18n: { language: 'en-GB' } };

export const useOnboarding = () => onboarding;
export const useCapabilities = () => capabilities;
export const useLocale = () => locale;
export const useTranslation = () => translation;

/** Called for its side effect only; the real hook returns nothing useful. */
export const usePageHelp = vi.fn();

/**
 * Formatters delegate to the real implementations rather than being stubbed.
 * Several suites assert on rendered output like "£50.00" or "15 Jan 2024", and
 * a stub would force those assertions to describe the raw value instead of what
 * a user sees.
 */
export const formatDate = realFormatDate;
export const formatDateTime = realFormatDateTime;
export const formatCurrency = realFormatCurrency;

/** Reset every spy between tests. */
export function resetShellMock(): void {
  [checkModuleVisit, setCurrentModule, setCurrentPageId, setLocale, usePageHelp].forEach(
    (spy) => spy.mockClear()
  );
  hasCapability.mockClear();
  hasCapability.mockReturnValue(true);
}
