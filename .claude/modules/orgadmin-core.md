# `packages/orgadmin-core` — Always-on org-admin features

A library, not an app. It supplies the six modules every organisation gets regardless of
capabilities, plus the hooks, contexts and utilities the capability modules build on.

- **Consumed by:** `orgadmin-shell` (aliased to `src`, so no rebuild during development).
- **Tests:** Vitest — `npm run test:orgadmin-core` (~36 test files).
- **First place to look** when functionality is needed by more than one org-admin module.

## Public surface (`src/index.ts`)

```ts
export * from './hooks';        // useApi, AuthTokenContext, OrganisationIdContext
export * from './utils';        // formatting + validation helpers
export { OrganisationProvider, useOrganisation } from './context/OrganisationContext';
export * from './dashboard';    // dashboardModule
export * from './forms';        // formsModule
export * from './settings';     // settingsModule
export * from './payments';     // paymentsModule
export * from './reporting';    // reportingModule
export * from './users';        // usersModule
```

Each feature folder exports a `ModuleRegistration` (`dashboardModule`, `formsModule`, …) that the
shell adds to `ALL_MODULES`. None of them declare a `capability`, so they are always available.

## Feature areas

Five of the six have their own summary — read that rather than this table when working on the area.

| Area | Summary | Routes | In brief |
|---|---|---|---|
| `forms/` | [core-forms.md](core-forms.md) | `forms`, `forms/new`, `forms/:id/edit`, `forms/:id/preview`, `forms/fields`, `forms/fields/new`, `forms/fields/:id/edit` | The Form Builder — reusable fields, forms, groups and wizard steps that other modules reference by id |
| `settings/` | [core-settings.md](core-settings.md) | `settings` | Four tabs: Organisation Details, Payment Settings, Email Templates, Branding — all persisting to the `settings` JSONB column |
| `payments/` | [core-payments.md](core-payments.md) | `payments`, `payments/:id`, `payments/lodgements` | Consolidated payment history, detail, refunds and lodgements |
| `reporting/` | [core-reporting.md](core-reporting.md) | `reporting`, `reporting/events`, `reporting/members`, `reporting/revenue` | Reports & Analytics — dashboard plus events, members and revenue reports |
| `users/` | [core-users.md](core-users.md) | `users`, `users/admins`, `users/admins/invite`, `users/accounts`, `users/accounts/create`, `users/:type/:id` | Org-admin users vs account users, roles and Keycloak invitations |
| `dashboard/` | — | `dashboard` | A single `DashboardPage` composed of the available modules' cards; no summary of its own |

## `useApi` — the API hook everything uses

`src/hooks/useApi.ts` exports `useApi<T>()`, `AuthTokenContext` and `OrganisationIdContext`.

```ts
const { data, error, loading, execute, reset } = useApi<Event[]>();
await execute({ method: 'GET', url: '/api/orgadmin/events', retryCount: 3 });
```

- Injects the bearer token supplied by the shell through `AuthTokenContext`.
- Injects `X-Organisation-Id` from `OrganisationIdContext` — which organisation the administrator is
  working in, for the org-admin routes that do not name one in their path. An administrator may
  belong to several ([orgadmin-shell.md](orgadmin-shell.md)). A header rather than a value each
  caller passes, for the same reason the token is one: a caller that has to remember is a caller
  that will forget, and forgetting here means acting on the wrong club's data. A header the caller
  set deliberately is never overwritten, and the server verifies membership regardless.
- **Rewrites the URL to name the organisation** — `organisationScopedUrl` turns
  `/api/orgadmin/events/:id` into `/api/orgadmin/organisations/<current>/events/:id`, so a request is
  legible in a log without cross-referencing a header against a session. Done here rather than at
  the ~240 call sites because half of them live in components with no organisation in scope.
  `/api/orgadmin/auth/*` is exempt — `/auth/me` is how an administrator learns which organisations
  they have. A URL that already names one is left alone.
- Options extend Axios config with `showSuccessMessage`, `successMessage`, `showErrorMessage`,
  `onSuccess`, `onError`, `retryCount` (default 2), `retryDelay` (default 1000).
- Returns loading/error state alongside the resolved data.

**Testing note:** `execute` is a new function identity on each render. Components typically wrap
loaders in `useCallback([…, execute])` and call them from a `useEffect`, so a test mock that returns
a fresh `execute` (or a fresh `organisation` object) each render causes an infinite reload loop and
a hanging test. Mocks must return stable references.

## Context

`OrganisationContext` — `OrganisationProvider` / `useOrganisation()`, giving the current
organisation (`id`, `name`, `currency`, `enabledCapabilities`, …). Most data loaders are keyed on
`organisation?.id` and no-op until it is present.

## Utilities

- `utils/formatting.ts` — `formatDate`, `formatDateTime`, `formatRelativeTime`, `formatCurrency`,
  `formatNumber`, `formatPercentage`, `formatFileSize`.
- `utils/validation.ts` — composable rules (`required`, `email`, `minLength`, `maxLength`, `min`,
  `max`, `pattern`, `url`, `phone`, `date`, `custom`) plus `validate` / `validateObject`.

Locale-aware display formatting is usually taken from `@aws-web-framework/orgadmin-shell` instead,
which binds the organisation's locale.

## Conventions

- Anything two capability modules would both want belongs here, not duplicated in each.
- Pages are default exports re-exported from the feature `index.ts` and lazy-loaded via the module
  registration.
- All strings are i18n keys resolved from the shell's locale files.

## Where to look for what

| Question | Start at |
|---|---|
| "How do I call the API from a page?" | `hooks/useApi.ts` |
| "Where are organisation settings edited?" | `settings/components/*Tab.tsx` |
| "How are application forms built?" | `forms/pages/FormBuilderPage.tsx` |
| "How does a module become a menu entry?" | The `ModuleRegistration` in each feature's `index.ts` |
| "Where is the current organisation?" | `context/OrganisationContext.tsx` |

## Testing pages in this package

Most pages need the current organisation and several shell hooks. Two shared helpers exist:

- **`src/test/renderWithProviders.tsx`** — router + `OrganisationProvider`. Rendering a page bare
  throws "useOrganisation must be used within an OrganisationProvider", which was the single largest
  cause of failures in this package.
- **`src/test/orgadminShellMock.tsx`** — a module double for
  `@aws-web-framework/orgadmin-shell`. Mock **every specifier the page imports**, not just the
  package root: pages also import from `/hooks/useTranslation`, `/utils/currencyFormatting`,
  `/utils/dateFormatting` and `/context/LocaleContext`, and mocking only the root leaves the real
  module loaded.

```ts
vi.mock('@aws-web-framework/orgadmin-shell', () => import('../../../test/orgadminShellMock'));
vi.mock('@aws-web-framework/orgadmin-shell/hooks/useTranslation', () => import('../../../test/orgadminShellMock'));
// …and the other deep specifiers the page uses
```

The mock resolves **real en-GB translations** (with `{{count}}` interpolation) and delegates to the
**real formatters**, so assertions read as the text a user sees — `"Paid"`, `"£50.00"` — rather than
key paths. A key with no translation falls through to the key, which makes a missing string visible
in the failure.

Do **not** mock the shell in suites that initialise their own i18next instance
(`reporting-i18n`, `OrganisationDetailsTab`) — they exist to test translation, and the mock would
override the thing under test.

Hooks returned by the mock use **stable references**; a fresh object per render re-triggers the
`useEffect` they feed and the test times out rather than failing readably (§3.4).

### Traps this package has hit more than once

- **`vi.clearAllMocks()` does not drain queued `mockResolvedValueOnce` values.** An unconsumed one
  leaks into the next test and shows up as a wrong URL or a missing error. Use `mockReset()` on the
  mock itself.
- **A mock that rejects only once** is not enough for anything `useApi` retries — the retry gets
  `undefined` and throws a `TypeError` whose message replaces the real error.
- **MUI labels a required field `"Name *"`,** so `getByLabelText('Name')` never matches. Use a regex.
- **MUI `Select` is not a labelled form control** in the a11y tree; target `role="combobox"` and open
  it with `fireEvent.mouseDown`, not `click`.
- **Pages navigate without the `/orgadmin` basename** — the router supplies it. `PaymentsListPage`
  is the exception and does include it, so check the page before assuming either way.

### Previously skipped tests

The package has no skipped tests — 623 pass. Two clusters were un-skipped, and both had been
attributed to the wrong cause, so the reasoning is kept here rather than the skips.

`InviteUserDialog.test.tsx` had 4, marked "MUI Select dropdown doesn't close properly in test
environment". The role Select is `multiple`, so MUI keeps its menu open after a choice by design,
and the open menu's backdrop covers the submit button. The tests tried to dismiss it by clicking the
dialog title, which never reaches the backdrop MUI listens to. `fireEvent.keyDown(listbox, { key:
'Escape' })` closes it. Worth adding to the patterns in CLAUDE.md §3.4.

`FormPreviewPage`'s 8 date-picker tests used to be skipped and now run. Two separate faults were at
work, and MUI's error — "Can not find the date and time pickers localization context" — names a
third (duplicate installs) that was never the cause; there is exactly one copy of
`@mui/x-date-pickers` installed.

1. **The package resolved to two builds at once.** `LocalizationProvider` came from the ESM build
   while the pickers' `useLocalizationContext` came from the CJS build under
   `@mui/x-date-pickers/node`, so the context object each side referenced was a different one. The
   config already listed the package under `deps.inline`, but Vitest deprecated that key and ignores
   it; moving it to **`server.deps.inline`** in `vite.config.ts` made it take effect.
2. **The suite stubbed the provider away.** It mocked
   `@mui/x-date-pickers/LocalizationProvider` with a plain `<div data-testid="localization-provider">`,
   so even with (1) fixed, nothing published the context. The stub is gone; the page tags its own
   `Box` with that test id, inside the real provider.

If a picker test starts throwing this again, check both before suspecting duplicate installs.
