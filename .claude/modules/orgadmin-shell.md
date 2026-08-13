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
  hooks/                 useAuth, useTranslation, usePageHelp
  pages/                 DashboardPage
  i18n/config.ts         i18next initialisation
  locales/<locale>/      translation.json × 6 locales  ← all org-admin strings live here
  theme/                 MUI theme
  utils/                 currencyFormatting, dateFormatting, pageMapping, performance
  types/                 module.types
```

## Startup sequence (`App.tsx`)

1. `useAuth(keycloakConfig)` → Keycloak login, returning `user`, `organisation`, `capabilities`,
   `isOrgAdmin`, `getToken`.
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
      OrganisationProvider      (current organisation)
        OnboardingProvider      (first-run dialogs and preferences)
          CapabilityProvider    (capability list for UI gating)
            Layout → Suspense → Routes
```

Order matters — `useApi` cannot authenticate outside `AuthTokenContext`, and capability-aware
components break outside `CapabilityProvider`.

## Module registry

`ALL_MODULES` in `App.tsx` is the single list of everything mountable:

- **Core (always available):** `dashboardModule`, `formsModule`, `settingsModule`, `paymentsModule`,
  `reportingModule`, `usersModule` — all from `@aws-web-framework/orgadmin-core`.
- **Capability-gated:** `eventsModule`, `membershipsModule`, `merchandiseModule`, `calendarModule`,
  `registrationsModule`, `ticketingModule`.

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
| "How does a page get an auth token?" | `useAuth` → `AuthTokenContext` → `useApi` in orgadmin-core |
| "Why is the app stuck loading?" | The four guard conditions at the end of `App.tsx` |
