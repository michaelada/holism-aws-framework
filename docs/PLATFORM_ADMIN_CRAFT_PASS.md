# Platform admin — craft pass

A design and hardening pass over `packages/admin`, the platform super-admin console, driven by a
recorded design critique. The critique snapshot is at
`.impeccable/critique/2026-08-13T15-09-50Z__packages-admin.md` (15/40 on Nielsen's heuristics, two
P0s, three P1s).

Nothing here changes what the app configures or which endpoints it calls. It changes what the
operator can reach, what the app tells them before a destructive action, and what it looks like.

---

## 1. The two P0s

### 1.1 A type's currency was freely mutable with cash-denominated fees attached

`EditOrganizationTypePage` rendered Currency as an ordinary seven-option select. `fixedFee` is a
cash amount **in that currency**, so switching EUR → JPY reinterpreted `0.25` as ¥0.25 and every
organisation of the type immediately charged a nonsense handling fee on live card payments. The fee
editor even re-rendered its worked example with the new symbol and identical numbers, so the app
actively displayed the wrong figure as if it were right.

The page already knew `organisationCount` — it was loaded at mount and used to warn about *fee*
changes inside `PaymentFeeEditor`. The currency control, which invalidates those same fees, had
nothing.

Now:

- Currency is **read-only** whenever `organisationCount > 0`, behind an explicit "Change currency"
  affordance.
- Unlocking opens a `ConfirmDialog` that names the count, explains that amounts are re-denominated
  rather than converted, and requires the type's display name to be typed.
- A standing `Alert` at the top of the page states how many organisations the whole form reaches.
- Changing the currency after unlocking raises a second warning showing the re-denomination on the
  real values (`€0.25` → `¥0.25`).

Covered by `src/pages/__tests__/EditOrganizationTypePage.currency.test.tsx`.

### 1.2 Half the application had no navigation

`Layout` listed three destinations. `routes/index.tsx` registers eight. `/tenants`, `/tenants/:id`,
`/users` and `/roles` were fully built, had passing test suites, and were reachable only by typing a
URL that appeared nowhere in the interface — including Tenants, the product's top-level customer
boundary.

`Layout` is now a persistent left rail carrying all eight, grouped **Platform** (Dashboard,
Tenants) / **Configuration** (Organisation Types, Organisations) / **Access** (Users, Roles). It
collapses to a temporary `Drawer` below `md`; the package previously had no responsive handling at
all (zero `useMediaQuery` uses). The current section is marked with `aria-current="page"` and stays
current while inside its detail pages.

---

## 2. Data-loss and silent-failure fixes

| Defect | Was | Now |
|---|---|---|
| Fee load failure | Bare `console.error`. `paymentFees` stayed `[]`, the save path's `if (paymentFees.length > 0)` skipped the fee write, and the operator saw "updated successfully" | Failure is tracked as state, surfaced as a warning, and the success message says fees were not saved |
| Cleared fee field | `Number('') \|\| 0` wrote a **zero fee** for every organisation of the type | `hasIncompleteRates()` blocks submission; each blank field is marked with "Required — enter 0 for no fee" |
| "Reset to default" | Restored the three handling-fee fields, silently keeping a mistyped Stripe Connect application fee | Resets the application fee to unset too; relabelled "Reset all *&lt;method&gt;* rates" |
| Adding an administrator | `Promise.all` on role assignment — one rejection reported "Failed to create administrator user" although the user *was* created, sending the operator into a duplicate-email retry | `Promise.allSettled`, naming exactly which roles failed and where to assign them |
| Failed detail load | `if (loading \|\| !organization)` spun forever on a 404 or 500 | A named error state with a "Try again" action |
| Unsaved changes | No guard anywhere in the package | `useUnsavedChanges` — `beforeunload` plus a confirm on every in-app exit |
| Validation | One toast at a time; no field ever marked | All fields validated at once, `error`/`helperText` on the offender, focus moved to it |
| Name sanitiser | Stripped trailing hyphens per keystroke, so a typed space was converted to a hyphen and immediately deleted — "my org" became "myorg" | Trailing hyphens survive until submit |

### Router blockers, deliberately not used

`unstable_useBlocker` requires a data router (`createBrowserRouter`); this app mounts a plain
`BrowserRouter`. Migrating the router to guard a form would be a far larger change than the problem
warrants, so in-app exits are guarded at the controls instead (§1.7 — adapt to what exists).

---

## 3. Accessibility

The most serious finding was not a missing label. `index.css` applied
`opacity: 0 !important; pointer-events: none !important` to every
`.MuiBackdrop-root:not([aria-hidden="false"])`, and `App.tsx` additionally removed backdrop nodes
from the DOM on mount, logging to the console in production. A global override keyed on an ARIA
attribute, sitting on top of MUI's modal focus trap: any shift in `aria-hidden` timing would have
left live dialogs without a backdrop **and without focus containment**.

Both are deleted, and the cause they were suppressing is fixed at source. `TenantList`, `UserList`
and `RoleList` each invoked their delete callback *before* closing the dialog; where that callback
unmounted the list, the modal never completed its exit and stranded its backdrop. They now close
first and act second.

Also fixed:

- Real `<h1>` on every page via `PageHeader`. The app previously had none outside its raw 404, and
  `TenantList` / `RoleList` / `UserList` emitted bare `<h2>` elements beside `variant="h4"`.
- `<nav aria-label="Sections">`, `<main id="main-content">`, and a skip link.
- `title="Delete"` → `aria-label` across five files, with the target named ("Delete Killarney
  Sailing Club", not "Delete").
- `StatusChip` — `inactive` and an *unrecognised* status both rendered the same neutral chip, so a
  build out of step with the backend looked identical to a switched-off club. Unknown statuses are
  now named as unknown, and every status carries text as well as colour.
- Errors announce through `role="alert"` and persist until dismissed; successes use `role="status"`
  and auto-hide. They previously shared one channel with identical urgency.
- Focus moves to the error summary when a form is rejected.
- `:focus-visible` ring defined in the theme.

---

## 4. The tables

Six pages had each hand-rolled the same table with no sorting, pagination, selection, bulk actions
or keyboard support — on a tool whose users are a small internal team that lives in these lists.
Blocking twelve organisations cost twelve full round trips through row → edit page → dropdown →
save → back.

`components/AdminTable.tsx` now carries: sortable headers, pagination, a checkbox column with a
bulk-action bar, `/` to focus search, `n` to create, `j`/`k` to move, `Enter` to open, `x` to
select. Search, filter, sort and page live in **URL parameters**, so a filtered list is linkable and
survives a drill-down instead of being retyped.

Pagination is client-side: the admin API returns whole collections and has no paged endpoints, and
adapting the front end to the existing backend beats expanding the backend (§1.7). It still removes
the real cost, which was rendering every row of every collection into the DOM at once.

Applied to `OrganizationsPage` and `OrganizationTypesPage`. `TenantsPage`, `UsersPage` and
`RolesPage` still use their own list components — they carry pre-existing test failures unrelated to
this pass (see §7) and were left alone rather than converted on top of a broken baseline.

### Bulk actions run with `allSettled`

Blocking or activating a selection reports partial outcomes precisely: "9 updated, 3 failed:
&lt;names&gt;". One failure never hides the successes.

---

## 5. Visual system

The app was a stock MUI scaffold wearing the marketing site's decoration. `warmTheme` defined an
entire display voice — h1 at `clamp(2.8rem, 6vw, 4.5rem)` weight 800 — that **no file used**, while
importing pill buttons, gradient fills, hover lifts and glow shadows that belong on a landing page.

`warmTheme` is now a tool-shaped derivation of the same palette:

- **Contrast.** `primary.main` moved from `#FF9800` to `#E65100`. The old value carried white text
  at 2.1:1 on every contained button — a straight WCAG AA failure. `#E65100` is 4.6:1; `#FF9800`
  survives as `primary.light` for tints, where it never has to pass a check.
- **Type.** A fixed rem scale with a ~1.12 step (h1 1.75rem → h6 1rem), replacing fluid `clamp()`
  headings. `body1` no longer hard-codes a muted grey, which had made every piece of primary body
  copy in the app read as secondary.
- **Restraint.** Button radius 60px → 8px, padding `0.85rem 2rem` → per-size (so `size="small"`
  works at all — the root override used to beat `sizeSmall`, making every toolbar button ~48px
  tall). Card hover-lift removed; nothing on this surface is a clickable card. `backdropFilter:
  blur(20px)` removed from an AppBar that is `position="static"` and has nothing scrolling beneath
  it.
- **A second neutral layer.** `background.default` is the warm `#FAF8F5` for chrome; content sits on
  white.
- **The dead theme.** `theme/index.ts` re-exported `neumorphicTheme` across a package boundary from
  `packages/frontend/src/theme/` for a look this app never rendered. Deleted.

The dashboard's six hardcoded MUI stock hues (`#1976d2`, `#9c27b0`, `#f57c00`, `#388e3c`, `#0288d1`,
`#7b1fa2`) — none of them the theme's own colour — are gone. Cards are neutral, the figure carries
the weight, and four of the six now navigate somewhere.

---

## 6. Copy and identity

- `index.html` title was `Super Admin - AWS Web Application Framework` — the stale scaffold name
  PRODUCT.md forbids in user-facing strings, in every browser tab and bookmark. Now
  `Platform Admin · Its Plain Sailing`.
- The AppBar rendered `favicon.png` (byte-identical to `logo.png`) at 40px with `alt="Logo"` — alt
  text that conveys nothing. The rail now carries the mark and the wordmark as one lockup; see §9.
- `DashboardPage` hardcoded `<Chip label="System Operational" color="success" />`, asserting platform
  health regardless of platform health on the first screen after login. Nothing in this app measures
  uptime; the chip is gone and the remaining figures are ones the page can stand behind.
- Three different language/locale lists existed across two files — one offering Chinese and
  Japanese, one offering `en-US`, one correct. `src/constants/localisation.ts` is now the single
  source, derived from the platform's six locales.
- `AccessDeniedPage` set `minHeight: 100vh` and its own background while rendering *inside*
  `Layout`, producing an extra viewport of grey below the chrome.
- The 404 was an unthemed `<div>` with inline styles and no way back.
- `console.log('Removing orphaned backdrop')` no longer ships.
- `TenantList` called `useNavigate()` conditionally after an early return — a hooks-order violation
  that would throw the moment `onViewDetails` changed between renders. The router-dependent branch
  is now its own component, so the hook is unconditional *and* the component still works outside a
  `<Router>`.

---

## 7. Tests

New: `AdminTable.test.tsx`, `ConfirmDialog.test.tsx` (with `StatusChip`), `Layout.test.tsx`,
`useUnsavedChanges.test.tsx`, `EditOrganizationTypePage.currency.test.tsx`.

Updated: the suites querying `getByTitle(...)` now query by accessible name, which is the stronger
assertion and the one the a11y work makes true. `PaymentFeeEditor.test.tsx` gained cases for the
application-fee reset and the blank-field guard. `CreateOrganizationPage-payment-methods.test.tsx`
asserted `name: 'testorg'` with the comment "hyphens removed" — that expectation encoded the
sanitiser bug, on a field whose own helper text says hyphens are allowed; it now expects
`test-org`.

**Suite state: 247 passing, 11 failing.** All 11 pre-date this work and live in files untouched by
it — `RoleForm.test.tsx` (6, a structural mismatch: the test expects three inputs, the component
renders two), `organization-type-locale.test.tsx` (4), and one in `RolesPage.test.tsx` that fails
downstream of the same `RoleForm` problem. The baseline before this pass was 40 failures.

No new lint errors; the 17 reported are all on pre-existing lines.

---

## 8. Not done

- **Browser verification.** None of this was seen rendering. The app sits behind Keycloak
  (`onLoad: 'login-required'` wrapping the whole router) and no admin credentials were available, so
  every change here is source-verified and test-verified but not visually confirmed.
- **`TenantsPage` / `UsersPage` / `RolesPage`** were not converted to `AdminTable` — see §4.
- **The Keycloak themes' copies of the mark** still carry the 58KB of editor metadata described in
  §9. Only the two assets inside `packages/admin` were stripped.

---

## 9. The mark

The sail mark was confirmed on 13 August 2026 and PRODUCT.md updated accordingly — it is no longer
a placeholder, and the blanket "nautical imagery is an anti-reference" line has been narrowed: the
*mark* may read as a sail, the rest of the product may not lean on that reading.

It now appears in `Layout`:

- **Desktop** — beside the wordmark in the rail header, as one lockup. The image carries `alt=""`
  because the words "Its Plain Sailing" sit immediately next to it; an announced logo there would
  say the brand twice and tell a screen-reader user nothing.
- **Below `md`** — in the top bar, where the rail is behind the hamburger and the mark would
  otherwise be invisible. Labelled `alt="Its Plain Sailing"` here, because no wordmark accompanies
  it.

Both are plain `<img>` elements with real `width`/`height` attributes, so the space is reserved
before the asset loads. MUI's `Box component="img"` was tried first and is wrong for this: `width`
and `height` are system *style* props there, so they never reach the element as attributes and no
layout-shift reservation happens. The test asserts the attributes for that reason.

### The asset was 97% metadata

`logo.png` and `favicon.png` were **60,544 bytes each** for a 56×64 image. The actual compressed
image data (`IDAT`) is **1,826 bytes**. The rest was Adobe Fireworks working state — `mkTS` (21KB),
eight `mkBT` chunks (~22KB), `mkBF`, `mkBS`, `prVW` — plus a 12.8KB `iTXt` block. Since this file is
also the favicon, all 60KB was fetched on every page load.

Stripping the ancillary chunks takes both files to **1,920 bytes**, a 96.8% reduction. This is
provably lossless rather than a re-encode: for colour-type 6 a PNG's pixel output depends only on
`IHDR` and `IDAT`, and both were copied byte-for-byte (`IDAT` sha256 unchanged). `sBIT` and `pHYs`
were kept; nothing that affects rendering was touched.

The four Keycloak login themes still carry the unstripped copy.
