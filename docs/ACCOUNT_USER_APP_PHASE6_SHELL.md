# Account User Application — the application shell (phase 6)

Phases 1–5 built the database, the account API surface, the cart and the registration/approval
machinery, but left the note "**No front-end yet for any of this**"
([phase 1–5 record](ACCOUNT_USER_APP_PHASE1_FOUNDATION.md#9-what-this-does-not-do)). This phase
builds that front end: a new `packages/account-shell` workspace holding the host application, the
organisation-resolution machinery every later module depends on, and the A-series screens.

It deliberately stops short of the domain modules (entries, memberships, bookings, shop, checkout).
Those are phase 7 onward and are listed in [§7](#7-what-this-does-not-do).

---

## 1. The package

`packages/account-shell`, served under `/account`, dev server on **5176** (5173 frontend, 5174
admin, 5175 orgadmin). Wired into the root workspace with `dev:account`, `build:account` and
`test:account` scripts, and appended to `build:all`.

| Area | Files |
|---|---|
| Entry | `index.html`, `src/main.tsx`, `src/App.tsx`, `index.ts` |
| Auth | `src/hooks/useAuth.ts`, `src/context/AuthContext.tsx` |
| API | `src/hooks/useAccountApi.ts` |
| Organisation | `src/context/AccountOrganisationContext.tsx` |
| Routing | `src/components/OrganisationRoute.tsx` |
| Shell | `src/components/AppShell.tsx`, `src/components/navigation.ts` |
| Screens | `src/pages/*.tsx` |
| Theme | `src/theme/index.ts` |
| i18n | `src/i18n/config.ts`, `src/locales/<six>/translation.json` |

---

## 2. Authentication differs from the org-admin shell, on purpose

`orgadmin-shell` initialises Keycloak with `onLoad: 'login-required'` because every one of its
screens is behind a login. That would be wrong here: the directory (A1) and the organisation
gateway (A2) are **public**, and forcing login on load would bounce every anonymous visitor to
Keycloak and make a club's own short link unusable for anyone not already signed in.

So `useAuth` here initialises with **`check-sso`** — it adopts an existing session silently and
otherwise returns quietly, leaving the visitor anonymous. Signing in becomes an explicit act
(`login(orgCode)`), triggered from A2.

This is also what satisfies the brief's "if the person was previously logged in, then they will be
brought to the specific page": the silent check resolves before the router decides what to draw.
`OrganisationRoute` blocks on `authLoading` for exactly that reason — routing a moment early shows
a signed-in member the public gateway before their session lands.

The token is realm-wide, which is what makes switching organisations (A7) a context change rather
than a re-authentication.

---

## 3. Resolving an organisation has seven outcomes, not two

`AccountOrganisationContext` turns the `:orgCode` in the URL into a state, and
`OrganisationRoute` is the single place that maps that state to a screen:

| State | Cause | Screen |
|---|---|---|
| `loading` | resolution in flight | spinner |
| `anonymous` | no session | A2 gateway |
| `connected` | active member | the app, inside `AppShell` |
| `not-connected` | `NOT_CONNECTED` | A6 |
| `pending` | `PENDING_APPROVAL` | A8 |
| `rejected` | `REGISTRATION_REJECTED` | A8, rejected variant |
| `inactive` | `ACCOUNT_INACTIVE` | A8, inactive variant |
| `unavailable` | `ORGANISATION_UNAVAILABLE` or anything unrecognised | A2's not-found variant |

Reducing this to `organisation | null` would lose the distinction between "not signed in", "signed
in but not a member" and "member awaiting approval" — three different screens with three different
ways out.

### `requireConnection`

A4 (register) and A8 (awaiting approval) exist **because** the member is not connected. Gating them
on connection would replace each with the A6 screen that links to them, so "Request to join" would
loop straight back to itself. `OrganisationRoute` takes `requireConnection={false}` for those two
routes: they render for any settled state, but an anonymous visitor still goes to the gateway first,
because connecting to a club needs an identity to connect.

### `refresh()` returns its state

A8's "Check again" needs to know what the re-check found. Reading `state` after `await refresh()`
reads the *previous* render's value, so `refresh` returns the state it settled on instead. Without
that, the "still awaiting approval" notice appears even when approval has just been granted.

---

## 4. Branding comes from the public endpoint

`GET /api/account/:orgCode/me` returns only what the shell needs to draw a menu — url code, display
name, currency, language, capabilities. It carries **no branding**, so there is nothing to theme a
club's shell with.

Rather than add a field to the backend, the context fetches
`GET /api/public/organisations/:code` for every organisation, signed in or not (CLAUDE.md §1.7 —
adapt the front end to the backend that exists). One request then serves both the theme and the A2
gateway screen, and A2 reads it from the context instead of fetching its own copy.

`publicLoading` is tracked separately from `state`. For a signed-out visitor `state` settles to
`anonymous` immediately, well before the club's record arrives — reading that as "not found" would
flash an error at every visitor arriving on a club's own link.

A malformed branding colour falls back to the default rather than throwing: `createTheme` rejects an
unparseable colour, and a club with a bad value should look wrong, not be unreachable.

---

## 5. Screens built

| Screen | Route | Notes |
|---|---|---|
| **A1** Organisation directory | `/` | Public. Server-side search, debounced 300 ms. "Your organisations" strip appears only with a session, and fails silently — a broken convenience must not put an error banner over a working directory. |
| **A2** Organisation gateway | `/:orgCode` (anonymous) | Branded. `registrationOpen` decides between a register button and an explanation. Unknown code → not-found variant offering the directory. |
| **A4** Register with organisation | `/:orgCode/register` | Says plainly that connecting is **not** buying a membership. `active`/`pending` is the club's setting, so the outcome is read from the response, never predicted. Re-resolves the context on success. |
| **A6** Not connected | `/:orgCode` (signed in, unknown) | Offers to request a connection and a route to another club. Deliberately does **not** offer signing in again, which would land in the same place. |
| **A7** Organisation switcher | `/switch` | Lists pending and rejected memberships too — hiding them makes an organisation appear to have vanished. |
| **A8** Awaiting approval | `/:orgCode/pending` | Two-line status block makes both gates visible. Rejection gives no reason. "Other organisations" strip prevents the dead end where a multi-org member is stuck behind one club's queue. |
| **B1/B2** App shell | wraps `connected` | One responsive component: permanent drawer at `md` and up, temporary drawer behind a menu button below it. |
| **B3** Home | `/:orgCode` (connected) | Placeholder. Its cards each need a domain phase 7 builds; empty cards would suggest the member has nothing rather than that nothing has been asked. |

### Capability gating

`src/components/navigation.ts` holds the nav model and `visibleSections()`, a pure function that
drops items whose capabilities are absent and then drops sections left empty. A club with only
`memberships` sees five items, not thirteen, and no empty headings. It is exported and tested
separately from the shell because it is the rule that quietly breaks when a capability is renamed —
a mistyped name hides a feature rather than throwing.

An item listing several capabilities shows when **any** is enabled: "My entries & bookings" covers
two features and is worth showing if the member can have either.

---

## 6. Tests — 110, all passing

`npm run test:account`. Twelve files:

| File | Covers |
|---|---|
| `navigation.test.ts` | Capability gating, section collapsing, any-of semantics |
| `AccountOrganisationContext.test.tsx` | Every refusal code → state, anonymous short-circuit, branding fallback |
| `OrganisationRoute.test.tsx` | The whole state → screen mapping, `requireConnection`, auth-loading gate |
| `AppShell.test.tsx` | Gating in the rendered menu, desktop and phone layouts |
| `OrganisationDirectoryPage.test.tsx` | Public fetch, debounce, empty vs failed, signed-in strip |
| `OrganisationGatewayPage.test.tsx` | Branding, login redirect, closed registration, loading vs not-found |
| `RegisterWithOrganisationPage.test.tsx` | Both outcomes, re-resolution, failure recovery |
| `AwaitingApprovalPage.test.tsx` | Both gates, re-check, three variants, escape strip |
| `NotConnectedPage.test.tsx` | The two ways out |
| `OrganisationSwitcherPage.test.tsx` | Switch by navigation, pending/rejected visibility |
| `i18n.test.ts` | All six locales identical, no empty values, interpolations preserved |
| `theme.test.ts` | Branded colour, fallbacks, malformed input |

Two things in the harness are worth knowing:

- **`src/test/setup.ts` implements `window.matchMedia`**, which jsdom does not. Without it MUI's
  `useMediaQuery` returns false for everything, the shell always believes it is on a phone, and the
  desktop drawer is never rendered — a failure that reads as a missing element rather than a missing
  browser API. `setViewportWidth()` drives it, so a test can state the layout it means.
- **i18next runs against the real en-GB catalogue** rather than a stub returning keys, so assertions
  read as the text a member sees and a missing translation surfaces as a bare key path.

---

## 7. What this does not do

- **No domain modules.** Entries, memberships, bookings, shop, registrations and payments have
  navigation entries but no routes behind them yet. B3 is a placeholder for the same reason.
- **No checkout.** The cart API exists from phase 4; nothing in this UI adds to it, and no payment
  provider is wired. Handling fees are still calculated by a tested utility nothing calls.
- **No ticketing, no PWA/offline.** Both are later phases.
- ~~**No org-admin approval queue** (I3/I4)~~ — built, in
  [REGISTRATION_APPROVAL_ORGADMIN.md](REGISTRATION_APPROVAL_ORGADMIN.md).
- **A default organisation is not stored.** A bare `/account` always shows the directory; A7's note
  about a per-user default in `user_preferences` is not implemented, so a returning single-org
  member sees the directory rather than going straight to their club.
- **Keycloak login-page branding (A3) is not configured.** `login()` passes the org code in the
  redirect, but the theme machinery in `docs/KEYCLOAK_MULTIPLE_LOGIN_THEMES.md` has not been wired to
  it, so the login page is currently unbranded.
- **`kc_locale` is not passed to Keycloak.** The app applies the org's language once resolved, but
  the login page itself does not yet follow it.
