/**
 * The modules whose introduction dialogs a user can dismiss.
 *
 * **This list is a copy, and copies drift.** The original is the `ModuleId`
 * union in `packages/orgadmin-shell/src/context/OnboardingContext.tsx`; the two
 * are held together by a test in that package, because a module missing from
 * *this* list fails in the worst possible way:
 *
 * `PUT /user-preferences/onboarding` rejects the whole request with a 400, the
 * provider reverts its optimistic update, and the user — who ticked "Don't show
 * this again" and watched the dialog close — is shown the same dialog on their
 * next visit. Nothing surfaces the refusal. That is exactly what happened to
 * merchandise, registrations, ticketing and settings, which were added to the
 * front end long after this list was written.
 *
 * @see docs/ONBOARDING_DISMISSAL_IGNORED.md
 */
export const ONBOARDING_MODULE_IDS = [
  'dashboard',
  'users',
  'forms',
  'events',
  'memberships',
  'registrations',
  'calendar',
  'payments',
  'merchandise',
  'ticketing',
  'settings',
] as const;

export type OnboardingModuleId = (typeof ONBOARDING_MODULE_IDS)[number];

/** Whether this is a module a dismissal may be recorded against. */
export function isOnboardingModuleId(value: unknown): value is OnboardingModuleId {
  return typeof value === 'string' && (ONBOARDING_MODULE_IDS as readonly string[]).includes(value);
}
