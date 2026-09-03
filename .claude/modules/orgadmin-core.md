# `packages/orgadmin-core` — Always-on org-admin features

> **Navigate without `/orgadmin`.** The router carries it as its basename, so a path that includes it
> produces `/orgadmin/orgadmin/…` and a 404. This was live in the payments and account-users lists.
>
> **A payment is `paymentDate` / `paymentStatus` / `paymentType`, plus `userName` and `userEmail`
> from the join** — not `date` / `status` / `type` / `customerName`. Both payments screens declared
> the latter and rendered `Invalid Date` and `common.status.undefined` for it; an interface over an
> untyped response is an assertion, not a check. See docs/ORGADMIN_PAYMENTS_BROKEN_FIELDS.md.

A library, not an app. It supplies the six modules every organisation gets regardless of
capabilities, plus the hooks, contexts and utilities the capability modules build on.

- **Consumed by:** `orgadmin-shell` (aliased to `src`, so no rebuild during development).
- **Tests:** Vitest — `npm run test:orgadmin-core` (~36 test files).
- **First place to look** when functionality is needed by more than one org-admin module.

**Money is never named at the call site.** `useCurrency()` reads the code from the organisation —
fixed by its organisation type — and returns a bound `format`. Twelve payment screens hard-coded
`GBP` and ten reporting screens hard-coded `EUR` before it existed, so a euro club saw sterling on
its refund confirmation and a sterling club saw euro on its revenue report. `formatCurrency` now
*requires* a currency; its old `'GBP'` default was the trap. `money-is-not-hard-coded.test.ts` fails
the build on any currency literal reaching a formatter.

**Every list table sorts by its columns.** `useTableSort(rows)` plus `SortableTableCell` — two
changes per table: the headings that should sort, and the array the body maps over becomes
`sort.rows`. The comparison lives once in `utils/sorting.ts` and reads the type from the value
(number, `Date`, ISO date or date-time, clock time, text), sinks empties in **both** directions, and
compares text with `localeCompare` so case and accents do not split a list into two alphabets.
**Sort by the value, not by what is on screen**: `€1,240.00` sorts as text before `€9.00`, and a
translated status chip would order differently in each of six locales — hence the `accessors`
option. Sorted after filtering and **before** paging. The audit log is the one list that is not
sortable, because it is cursor-paged from the server and sorting fifty of thousands would lie. See
[docs/SORTABLE_TABLES.md](../../docs/SORTABLE_TABLES.md).

**`ConfirmDialog` is the only way to ask "are you sure?"** Two screens used the browser's native
`confirm()`, which carries no i18n at all. The confirm button names the action rather than agreeing
with the question, cancel precedes it in the DOM, and `busy` prevents a double-send.

## Public surface (`src/index.ts`)

```ts
export * from './hooks';        // useApi, useCurrency, useTableSort, AuthTokenContext, OrganisationIdContext
export * from './utils';        // formatting, validation + sorting helpers
export * from './components';   // ConfirmDialog, ResponsiveTable, SortableTableCell
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

Five of the seven have their own summary — read that rather than this table when working on the area.

| Area | Summary | Routes | In brief |
|---|---|---|---|
| `forms/` | [core-forms.md](core-forms.md) | `forms`, `forms/new`, `forms/:id/edit`, `forms/:id/preview`, `forms/fields`, `forms/fields/new`, `forms/fields/:id/edit` | The Form Builder — reusable fields, forms, groups and wizard steps that other modules reference by id |
| `settings/` | [core-settings.md](core-settings.md) | `settings` | Four tabs: Organisation Details, Payment Settings, Email Templates, Branding — all persisting to the `settings` JSONB column |
| `payments/` | [core-payments.md](core-payments.md) | `payments`, `payments/:id`, `payments/lodgements` | Consolidated payment history, detail, refunds and lodgements |
| `reporting/` | [core-reporting.md](core-reporting.md) | `reporting`, `reporting/events`, `reporting/members`, `reporting/revenue` | Reports & Analytics — dashboard plus events, members and revenue reports |
| `users/` | [core-users.md](core-users.md) | `users`, `users/admins`, `users/admins/invite`, `users/accounts`, `users/accounts/create`, `users/:type/:id` | Org-admin users vs account users, roles and Keycloak invitations |
| `audit/` | — | `audit` | This organisation's audit trail — the same events the Platform Admin sees, with the organisation **fixed by the server**. Each event shows the record it was about: its label, its reference (`entityId`), and a button through to it via `auditEntityDestination`. See docs/AUDIT_TRAIL_AND_SESSIONS.md §7 |
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
  A URL that already names one is left alone.
- **Three prefixes are exempt, and the list is load-bearing** — `/api/orgadmin/auth/`,
  `/api/orgadmin/organisation/` (singular) and `/api/orgadmin/users/`. Their routers are mounted
  **once, bare**, so rewriting them yields a path that matches nothing: the users one blanked the
  entire Users area, and the singular organisation one blanked all six Settings tabs. Adding a
  router under `/api/orgadmin` means either putting it in `ORGADMIN_DATA_ROUTERS`
  (`backend/src/index.ts`) or adding its prefix to `UNSCOPED_ORGADMIN_PATHS` — doing neither
  compiles, passes every test, and 404s in the browser. Page tests mock `useApi` and cannot catch
  it; the guard is `hooks/__tests__/organisationScopedUrl.test.ts`. See
  [docs/ORGADMIN_ROUTE_TENANCY.md](../../docs/ORGADMIN_ROUTE_TENANCY.md).
- **Sets `Content-Type: application/json` — except for a file upload.** A `FormData` body is left
  without a content type so axios can write `multipart/form-data` *with the boundary it generated
  with the body*; only the client can produce that. Forcing JSON sent a multipart body under a JSON
  header, the server's parser found no file, and the 400 became `null` — an announcement saved with
  its picture silently missing. A header the caller set is still never overwritten (which is how the
  merchandise gallery worked before the fix, by passing one by hand).
- Options extend Axios config with `showSuccessMessage`, `successMessage`, `showErrorMessage`,
  `onSuccess`, `onError`, `retryCount` (default 2), `retryDelay` (default 1000), and
  **`throwOnError`** (default false — see below).
- Returns loading/error state alongside the resolved data.

### ⚠️ `execute` resolves to `null` on failure — it does not throw

Probably the most misleading thing in this package. **Every `try/catch` wrapped around
`await execute(...)` is dead code in a browser**; a rejection only ever happens under a test double.
A page relying on `catch` therefore renders its **empty state** for a failed request — which on a
money screen means telling a club there is nothing to chase, or that no money has reached its bank.
Both were live defects, in `OfflinePaymentsPage` and `LodgementsPage`.

**For an action — a mutation whose refusal has to be read — pass `throwOnError: true`** and let the
`catch` do its job. It throws the server's own message, which for a refusal is the wording the
administrator needs. Undoing an offline receipt reported *"Undone"* through three consecutive 400s
before this existed; the audit trail was the only place the failures showed. Opt-in rather than the
default, because ~240 call sites read the `null`.

For a **load**, use the `onError` callback and suppress the empty state when it has failed:

```ts
let errored = false;
const response = await execute({ method: 'GET', url, onError: () => { errored = true; } });
if (errored || response === null) { setLoadFailed(true); return; }
```

Showing an error *and* an empty state together is worse than either alone: the reassuring one is
the one that gets believed.

No suite catches a regression here, because every mock rejects. A test must reproduce the real
contract — resolve `null` **and** call `onError`. `LodgementsPage.test.tsx` and
`OfflinePaymentsPage.test.tsx` both do; the rest of the package still asserts against a rejection
that production never produces.

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

Locale-aware display formatting is usually taken from `@itsplainsailing/orgadmin-shell` instead,
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

Most pages need the current organisation and several shell hooks. Three shared helpers exist:

- **`src/test/renderWithProviders.tsx`** — router + `OrganisationProvider`. Rendering a page bare
  throws "useOrganisation must be used within an OrganisationProvider", which was the single largest
  cause of failures in this package.
- **`src/test/orgadminShellMock.tsx`** — a module double for
  `@itsplainsailing/orgadmin-shell`. Mock **every specifier the page imports**, not just the
  package root: pages also import from `/hooks/useTranslation`, `/utils/currencyFormatting`,
  `/utils/dateFormatting` and `/context/LocaleContext`, and mocking only the root leaves the real
  module loaded.

```ts
vi.mock('@itsplainsailing/orgadmin-shell', () => import('../../../test/orgadminShellMock'));
vi.mock('@itsplainsailing/orgadmin-shell/hooks/useTranslation', () => import('../../../test/orgadminShellMock'));
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

### `src/test/shellMock.ts` — the shell double the *other* org-admin packages use

`createShellMock()` returns a plain object covering **every export
`orgadmin-shell/index.ts` publishes**, for suites in `orgadmin-events`,
`orgadmin-registrations`, `orgadmin-merchandise`, `orgadmin-calendar` and `orgadmin-ticketing`.
Those packages each used to hand-write a partial mock listing only the hooks their page called at
the time, so adding `usePageHelp` or `useOnboarding` to a page broke hundreds of unrelated
assertions at once with *"No `usePageHelp` export is defined on the mock"*.

```ts
vi.mock('@itsplainsailing/orgadmin-shell', async () => ({
  ...(await import('@itsplainsailing/orgadmin-core/test/shellMock')).createShellMock(),
  useCapabilities: () => ({ hasCapability: () => false, capabilities: [] }),   // override what matters
}));
```

`t` resolves the real en-GB catalogue by default, exactly as `orgadminShellMock` does; pass
`{ t: translateToKey }` for a suite that asserts on key paths.
`src/test/__tests__/shellMock.test.ts` reads the shell's index and fails if the mock is missing an
export, so it cannot drift — which is the whole reason it is worth having.

See [docs/TEST_SUITE_REPAIR_FRONTEND.md](../../docs/TEST_SUITE_REPAIR_FRONTEND.md) for the repair
this came out of.

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
