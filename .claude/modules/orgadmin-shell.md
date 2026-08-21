# `packages/orgadmin-shell` — Org-admin host application

The deployable org-admin SPA. It authenticates the user, decides which modules that organisation
may see, provides layout and context, and owns **all** translations for the org-admin surface.

- **Dev:** `npm run dev:orgadmin` → `http://localhost:5175`, basename `/orgadmin`, `/api` proxied to
  `:3000`.
- **Tests:** Vitest — `npm run test:orgadmin` (~49 test files, including `__tests__/e2e`,
  `__tests__/integration`, `__tests__/i18n`).

## Layout

```
src/
  main.tsx, App.tsx      Bootstrap; ALL_MODULES registry; auth/i18n gating; route composition
  components/            Layout, ModuleLoader, dashboard cards, help drawer, onboarding dialogs
  context/               Capability, Locale, Organisation, Onboarding providers
  hooks/                 useAuth, useTranslation, usePageHelp   ← see the note on `t` below
  pages/                 DashboardPage
  i18n/config.ts         i18next initialisation
  locales/<locale>/      translation.json × 6 locales  ← all org-admin strings live here
  theme/                 MUI theme — `warmTheme` only; the neumorphic alternative was removed
  utils/                 currencyFormatting, dateFormatting, pageMapping, performance
  types/                 module.types
```

## Startup sequence (`App.tsx`)

1. `useAuth(keycloakConfig)` → Keycloak login, returning `user`, `organisation`, `organisations`,
   `capabilities`, `isOrgAdmin`, `getToken`, `getOrganisationId`, `switchOrganisation`.
2. Derive the locale: `organisation.language` → `organisationType.defaultLocale` → `en-GB`.
3. `await initializeI18n(locale)` — nothing renders until this resolves.
4. Filter `ALL_MODULES` down to modules with no `capability` or whose capability the organisation
   holds.
5. Render the provider stack and compose routes.

Guard states, in order: error screen → loading screen → access-denied (authenticated but not an
org admin) → redirecting-to-login → the app.

## Provider stack

```
BrowserRouter basename="/orgadmin"
  LocaleProvider                (i18n + formatting)
    AuthTokenContext.Provider   (getToken, consumed by orgadmin-core's useApi)
     OrganisationIdContext.Provider  (X-Organisation-Id on every call)
      OrganisationProvider      (current organisation)
        OnboardingProvider      (first-run dialogs and preferences)
          CapabilityProvider    (capability list for UI gating)
            Layout → Suspense → Routes
```

Order matters — `useApi` cannot authenticate outside `AuthTokenContext`, and capability-aware
components break outside `CapabilityProvider`.

## One administrator, several clubs

`organization_users` is unique on `(organization_id, keycloak_user_id)`, so an administrator may
hold rows in several organisations. `/auth/me` returns `organisations[]` alongside the current one;
`OrganisationSwitcher` renders in the AppBar and **shows a plain label rather than a menu when
there is only one** — which falls out of the list's length, not a flag.

**The rail is permanent, global, and grouped.** It renders on every route including the dashboard, in
two groups: *Running the club* (everything with a `capability`) above *Setup* (everything without —
the registry's `capability: undefined` is the marker for an always-on core area, so the split needs
no extra metadata). The module you are inside expands to its `subMenuItems`; every other module stays
a single collapsed row. Expansion follows the route rather than a toggle, so there is no state to
restore after a reload. **A group with no visible members renders no heading at all** — a
memberships-only club must look deliberate, not broken. Labels wrap rather than truncate: the longest
module name across the six locales is Spanish at 30 characters, which cannot fit 248px on one line.

Two landmarks exist by design — the rail (`aria-label` `navigation.sections`) and the breadcrumb
(`navigation.breadcrumb`). Both are named, because two unnamed `nav`s would give a screen-reader user
two indistinguishable entries in the landmarks list. `accessibility.test.tsx` asserts exactly this.

**`main` carries `minWidth: 0`, and that is load-bearing.** It is a flex child, and a flex child's
default `min-width: auto` will not shrink below its content — so a 997px table pushed the whole
document to 1093px on a 390px phone rather than scrolling itself. Removing that property puts the
horizontal scrollbar back on the page. Page header rows across 37 files carry `flexWrap: 'wrap'` for
the same reason: without it the action buttons overflow instead of dropping below the title.

**A switch is not a relabelling.** Capabilities belong to the organisation, so the navigation itself
differs between two clubs. `switchOrganisation` re-fetches `/auth/me`, and `Layout` then navigates
to the dashboard — half the time the open page is a module the other club does not have, and
staying put lands the administrator on a capability-denied screen the instant they choose.

The choice is sent as `X-Organisation-Id` on every API call, via `OrganisationIdContext` in
orgadmin-core's `useApi`, for the routes that do not name an organisation in their path. It is read
from a **ref**, not from state: a callback closing over state would send whichever organisation was
current when it was last rebuilt, and a stale id acts on the wrong club. `localStorage` holds it
across reloads so the shell does not flicker through the wrong branding, and the server remembers it
too for a fresh session elsewhere — but the server verifies membership of whatever is named before
acting on it, so neither store is trusted.

Full record: [docs/ORGADMIN_MULTI_ORGANISATION.md](../../docs/ORGADMIN_MULTI_ORGANISATION.md).

## Module registry

`ALL_MODULES` in `App.tsx` is the single list of everything mountable:

- **Core (always available):** `dashboardModule`, `formsModule`, `settingsModule`, `paymentsModule`,
  `reportingModule`, `usersModule`, `auditModule` — all from `@aws-web-framework/orgadmin-core`.
- **Capability-gated:** `eventsModule`, `membershipsModule`, `merchandiseModule`, `calendarModule`,
  `registrationsModule`, `ticketingModule`.

The rail's two groups are **not** a straight capability split. `RUNNING_MODULES`
in `Layout.tsx` names the core areas that still belong under "Running the Org" —
`payments` and `reporting`, which every organisation has but neither of which is
setup. Within that group the capability modules come first: the core areas were
numbered 1–9 when they all sat in Setup, so `order` alone puts Payments above
Events.

Routes are then filtered a second time per-route against `organisation.enabledCapabilities`, so a
module can appear with some pages hidden. `ModuleLoader` supplies the `Suspense` fallback and the
404 page.

**To add a page:** add a route to that module's registration. The shell needs no change unless a
whole new module is being introduced.

## Translations

`src/locales/{en-GB,de-DE,es-ES,fr-FR,it-IT,pt-PT}/translation.json` — a single large nested
document per locale covering the shell, `orgadmin-core` and every capability module.

Rules:
- A new key goes into all six files, in the same position in the tree.
- Components never hard-code English; they call `t('some.key')`.
- Edit surgically — do not reformat or re-serialise the whole file.
- `__tests__/i18n` and the modules' own translation tests check key usage; one property-based
  translation test is known to be flaky because it generates keys containing i18next separators.

### `useTranslation` returns stable references — keep it that way

`t`, `i18n` and the result object keep their identity between renders, changing only when the
language does, so `t` is safe to name in a `useCallback`/`useEffect` dependency array. That is not a
micro-optimisation: the wrapper used to rebuild `t` on every render, and a page that wrote the
obvious `useCallback(load, [execute, t])` fetched in an unbounded loop until the API answered 429.
Guarded by `hooks/__tests__/useTranslation.stability.test.tsx`. Note that the test doubles in the
other packages return a stable `t` from module scope, so a regression here will **not** show up in
their suites — it only shows up in a browser.

## Vite configuration worth knowing

- Aliases `@aws-web-framework/{components,orgadmin-core,orgadmin-events,…}` to each package's
  `src`, so module edits hot-reload with no rebuild.
- `fs.strict: false` so files outside the package root can be served.
- `dedupe: ['react','react-dom','@mui/material','@mui/x-date-pickers','date-fns']` — duplicate
  instances break React context (the historic blank-screen/date-picker bug).

## Onboarding dialogs and "Don't show this again"

`OnboardingProvider` shows the welcome dialog once, and each module's introduction dialog on first
visit. Dismissals are stored per user by `GET`/`PUT /api/user-preferences/onboarding`; within a
session `modulesShownThisSessionRef` stops a dialog reappearing even when it was closed without
ticking the box.

**The module list exists twice.** `MODULE_IDS` here (`context/OnboardingContext.tsx`, with `ModuleId`
derived from it) and `ONBOARDING_MODULE_IDS` in `backend/src/utils/onboarding-modules.ts`, which the
`PUT` validates against. **Adding a module means adding it to both** —
`__tests__/context/OnboardingProvider.module-parity.test.ts` fails if they diverge. Without that
guard the failure is invisible: the save is rejected with a 400, the provider reverts its optimistic
update and only logs, and the user sees the dialog they dismissed return on their next login. Four
modules were in that state (`docs/ONBOARDING_DISMISSAL_IGNORED.md`).

## Where to look for what

| Question | Start at |
|---|---|
| "Why can't this org see module X?" | `ALL_MODULES` filter in `App.tsx` + the org's capabilities |
| "Why does a dismissed help dialog keep coming back?" | The two module-id lists above; then the browser console for `Failed to save module intro preference` |
| "Where is this label defined?" | `locales/en-GB/translation.json` |
| "How does the sidebar get built?" | `components/Layout.tsx` + each module's `menuItem`/`subMenuItems` |
| "Why is a module missing from the rail?" | Its capability is off, or it is the `dashboard` module — withheld on purpose; see the filter's comment |
| "How does a page get an auth token?" | `useAuth` → `AuthTokenContext` → `useApi` in orgadmin-core |
| "Why is the app stuck loading?" | The four guard conditions at the end of `App.tsx` |
