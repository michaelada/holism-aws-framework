import { vi } from 'vitest';

/**
 * A stand-in for `@itsplainsailing/orgadmin-shell`, in one place.
 *
 * ## Why this exists
 *
 * Seven suites in this package each wrote their own `vi.mock` of the shell,
 * and each listed only the hooks the page happened to use at the time. When
 * `usePageHelp` was later added to `MembersDatabasePage` and
 * `MembershipTypesListPage`, every one of those mocks became incomplete and
 * Vitest failed the render with *"No `usePageHelp` export is defined on the
 * mock"* — **57 failing assertions from one new hook**, none of which had
 * anything to do with what the tests were checking.
 *
 * A test for the Add Member button should not break because an unrelated help
 * hook appeared. Mirroring the shell's whole surface here means the next hook
 * is added once, not seven times.
 *
 * ## Keeping it honest
 *
 * This must match `packages/orgadmin-shell/index.ts`. `shell-mock.test.ts`
 * fails if the shell exports something this does not — so the mock cannot
 * silently drift out of date, which is the failure mode it exists to prevent.
 *
 * ## Use
 *
 * ```ts
 * vi.mock('@itsplainsailing/orgadmin-shell', async () => {
 *   const { shellMock } = await import('../../test/shell-mock');
 *   return shellMock();
 * });
 * ```
 *
 * Override a hook per-suite by spreading the result:
 *
 * ```ts
 * return { ...shellMock(), useCapabilities: () => ({ capabilities: ['memberships'] }) };
 * ```
 */
export function shellMock() {
  return {
    // Identity `t`, so assertions read as the i18n key. Several suites in this
    // package rely on that; see CLAUDE.md §3.4.
    useTranslation: () => ({
      t: (key: string) => key,
      i18n: { language: 'en-GB', changeLanguage: vi.fn() },
    }),

    /*
     * Registers the page for contextual help and returns nothing. Pages call it
     * for its side effect, so a no-op is a faithful stand-in — it was the
     * *absence* of the export, not its behaviour, that broke the suites.
     */
    usePageHelp: vi.fn(),

    LocaleProvider: ({ children }: { children: React.ReactNode }) => children,
    useLocale: () => ({ locale: 'en-GB', setLocale: vi.fn() }),

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
      capabilities: ['memberships', 'event-management', 'merchandise', 'calendar-bookings'],
      hasCapability: () => true,
      loading: false,
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
