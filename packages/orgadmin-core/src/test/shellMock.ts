import { vi } from 'vitest';
import type { ReactNode } from 'react';
import enGB from '../../../orgadmin-shell/src/locales/en-GB/translation.json';

/** What `useTranslation().t` returns for a key. */
export type Translator = (key: string, options?: Record<string, unknown>) => string;

/**
 * Resolve against the real en-GB catalogue, falling back to the key.
 *
 * Returning the key would be simpler, but then every assertion reads
 * `events.searchPlaceholder` instead of "Search events..." and the suites stop
 * describing what a user actually sees. Falling back to the key also makes a
 * missing translation visible in a test failure rather than silently rendering
 * blank.
 */
export const translateFromCatalogue: Translator = (key, options) => {
  const lookup = (path: string): unknown =>
    path.split('.').reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
      enGB as unknown
    );

  /*
   * Plurals, the way i18next selects them.
   *
   * A catalogue entry with a count has no bare key at all — only `_one` and
   * `_other` — so looking up "events.entries.count" finds nothing and the page
   * renders the key path. Every assertion on a counted string then reads as a
   * broken page rather than as the sentence a user sees.
   */
  const value =
    lookup(key) ??
    (options && typeof options.count === 'number'
      ? lookup(`${key}_${options.count === 1 ? 'one' : 'other'}`)
      : undefined);

  if (typeof value !== 'string') return key;

  // i18next-style interpolation. Without this, "{{count}} entries" renders
  // literally and every assertion on an interpolated string fails in a way that
  // looks like the page is broken.
  return value.replace(/\{\{(\w+)\}\}/g, (match, name) =>
    options && name in options ? String(options[name]) : match
  );
};

/** Returns the key unchanged, for suites that assert on key paths. */
export const translateToKey: Translator = (key) => key;

/**
 * A complete stand-in for `@aws-web-framework/orgadmin-shell`, in one place.
 *
 * ## Why this exists
 *
 * Every org-admin module mocks the shell, and each mock used to list only the
 * hooks the page under test happened to call at the time it was written. When
 * `usePageHelp`, `useOnboarding` and `useCapabilities` were later added to
 * pages, all of those mocks became incomplete at once and Vitest failed the
 * render with *"No `usePageHelp` export is defined on the mock"* — hundreds of
 * failing assertions across five packages, none of which had anything to do
 * with what the tests were checking.
 *
 * A test for the Add Member button should not break because an unrelated help
 * hook appeared. Mirroring the shell's whole surface here means the next export
 * is added once, not once per suite.
 *
 * ## Keeping it honest
 *
 * This must match `packages/orgadmin-shell/index.ts`. `__tests__/shellMock.test.ts`
 * reads that file and fails if the shell exports something this does not, so the
 * mock cannot silently drift out of date — which is the failure mode it exists
 * to prevent.
 *
 * ## Use
 *
 * ```ts
 * vi.mock('@aws-web-framework/orgadmin-shell', async () => {
 *   const { createShellMock } = await import('@aws-web-framework/orgadmin-core/test/shellMock');
 *   return createShellMock();
 * });
 * ```
 *
 * Override anything per-suite by spreading the result:
 *
 * ```ts
 * return { ...createShellMock(), useCapabilities: () => ({ capabilities: [], hasCapability: () => false }) };
 * ```
 *
 * ## Translations
 *
 * `t` resolves the real en-GB catalogue by default, so assertions read as the
 * text a member sees. Packages whose suites assert on key paths instead pass
 * `{ t: translateToKey }`.
 */
export function createShellMock({ t = translateFromCatalogue }: { t?: Translator } = {}) {
  return {
    useTranslation: () => ({
      t,
      i18n: { language: 'en-GB', changeLanguage: vi.fn() },
    }),

    /*
     * Registers the page for contextual help and returns nothing. Pages call it
     * for its side effect, so a no-op is a faithful stand-in — it was the
     * *absence* of the export, not its behaviour, that broke the suites.
     */
    usePageHelp: vi.fn(),

    LocaleProvider: ({ children }: { children: ReactNode }) => children,
    useLocale: () => ({ locale: 'en-GB', setLocale: vi.fn(), isLoading: false }),

    /*
     * The whole `OnboardingContextType`, not a guess at it. Pages call
     * `setCurrentModule` and `setCurrentPageId` in effects, and a mock missing
     * one fails with "is not a function" from inside a render — an error that
     * points at the page rather than at the mock that caused it.
     */
    useOnboarding: () => ({
      welcomeDismissed: false,
      modulesVisited: [],
      welcomeDialogOpen: false,
      moduleIntroDialogOpen: false,
      currentModule: null,
      introModule: null,
      helpDrawerOpen: false,
      currentPageId: null,
      preferences: { welcomeDismissed: false, modulesVisited: [] },
      loading: false,
      dismissWelcomeDialog: vi.fn(async () => undefined),
      dismissModuleIntro: vi.fn(async () => undefined),
      toggleHelpDrawer: vi.fn(),
      checkModuleVisit: vi.fn(),
      setCurrentPageId: vi.fn(),
      setCurrentModule: vi.fn(),
    }),

    // Everything on, so a capability gate is never the accidental reason a test
    // sees an empty page. Suites testing the gate itself override this.
    useCapabilities: () => ({
      capabilities: [
        'memberships',
        'event-management',
        'merchandise',
        'calendar-bookings',
        'registrations',
        'event-ticketing',
      ],
      hasCapability: () => true,
      loading: false,
      error: null,
      refetch: vi.fn(async () => undefined),
    }),

    formatDate: (value: string | Date) =>
      value ? new Date(value).toLocaleDateString('en-GB') : '',
    formatTime: (value: string | Date) =>
      value ? new Date(value).toLocaleTimeString('en-GB') : '',
    formatDateTime: (value: string | Date) =>
      value ? new Date(value).toLocaleString('en-GB') : '',
    formatCurrency: (value: number) => `€${(value ?? 0).toFixed(2)}`,
  };
}
