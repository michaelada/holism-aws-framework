---
target: packages/admin
total_score: 15
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 3
timestamp: 2026-08-13T15-09-50Z
slug: packages-admin
---
Method: dual-agent (A: design review, source-only and detector-blind · B: detector + browser evidence)

## Design Health Score

All ten heuristics apply — this is an Operate surface, so none was marked `n/a`.

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Every page's loading state is a bare centred `CircularProgress` replacing all content; `OrganizationDetailsPage.tsx:236` `if (loading \|\| !organization)` spins forever on a failed fetch |
| 2 | Match System / Real World | 2 | Nav says "Organisations", Dashboard says "Organizations"; `EditOrganizationTypePage.tsx:31-40` offers Chinese and Japanese in a six-locale product |
| 3 | User Control and Freedom | 1 | Zero unsaved-changes guards anywhere; the back arrow at `CreateOrganizationPage.tsx:229` silently discards ~20 fields; no undo on any delete |
| 4 | Consistency and Standards | 1 | Two delete idioms (`window.confirm` vs MUI `Dialog`); two page architectures (route-per-view vs `viewMode` state); raw `<h2>` beside `variant="h4"` |
| 5 | Error Prevention | 1 | `EditOrganizationTypePage.tsx:244-257` changes a type's currency with no warning while N organisations and cash-denominated fees hang off it |
| 6 | Recognition Rather Than Recall | 2 | `Layout.tsx:23-27` lists 3 of 8 sections; `/tenants`, `/users`, `/roles` must be recalled and typed |
| 7 | Flexibility and Efficiency | 1 | No keyboard shortcuts, no bulk selection, no sorting, no pagination (`react-window` is a dependency, never imported) |
| 8 | Aesthetic and Minimalist Design | 2 | Six clashing stock hues on the dashboard, none of them the theme's primary; pill buttons override `size="small"` |
| 9 | Error Recovery | 2 | `errorHandling.ts` + `RetryDialog.tsx` are decent but only two pages use them; `UsersPage.tsx:60-63` swallows failures to console |
| 10 | Help and Documentation | 1 | Nothing explains what a capability is, what blocking an organisation does to its members, or what a tenant is |
| **Total** | | **15/40** | **Poor (12-19)** |

That sits below the 20-32 band most real interfaces occupy. The three lowest scores — control/freedom, consistency, error prevention — are all about destructive and lossy actions, which is precisely what this surface exists to perform.

## Design Specificity Verdict

**LLM assessment: category-interchangeable, with one genuine exception.**

Strip the word "Organisation" and this is indistinguishable from any CRUD admin of the last decade: `AppBar` + `Container maxWidth="xl"` + `TableContainer` + right-aligned `IconButton` triads + `Grid` of stat cards + top-right `Snackbar`. Six hand-rolled tables (`OrganizationsPage`, `OrganizationTypesPage`, `TenantList`, `RoleList`, `UserList`, `OrganizationList`) repeat the same header row, the same icon column, the same `colSpan` empty cell — six chances to design a list, six identical MUI copies.

The product's own defining facts are the ones left undesigned. Capability-shaped installs are the platform's central concept, and a club's shape renders as `<TableCell>{org.enabledCapabilities.length}</TableCell>` — an integer — then as an unordered pile of `Chip`s printing internal slugs. Currency-follows-type is genuinely unusual and worth designing around; it is handled well once, then contradicted by a free Currency dropdown on the type editor.

The exception is `PaymentFeeEditor.tsx`, which could not be lifted into an unrelated product. It converts three abstract rates into the one number a human can sanity-check, in the type's own currency, live: *"a €62.00 card charge attracts €0.25 + €1.24 = €1.49, plus 21% tax €0.31 = €1.80."* Its own code comment names the reason — *"a mistyped 15% instead of 1.5% obvious immediately."*

**The theme conflict, now resolved.** `warmTheme` is the active `defaultTheme`; the neumorphic theme is commented out as default but still live-exported at `theme/index.ts:10` through a cross-package relative import into `packages/frontend/src/theme/`. Both agents converged here independently: the design review found it in source, and the browser network log confirmed **both** theme modules are fetched at runtime. Worse, `warmTheme.ts:66-77` defines the app's entire display voice — h1 `clamp(2.8rem, 6vw, 4.5rem)` weight 800, h2 `clamp(2rem, 4vw, 3rem)`, negative tracking — and **h1 and h2 are used zero times across all 59 files**. The app imported a marketing site's decoration (pill buttons, gradient fills, hover lifts) and left behind the typography that carried its voice.

**Deterministic scan: zero findings — and that is not a clean bill of health.**

`detect.mjs` over `packages/admin/src` and `index.html` returned `[]`, exit 0. Assessment B did not take that at face value; it verified the tool actually bites on this stack — a synthetic TSX probe with MUI-style `sx` props fired `bounce-easing`, and a three-level-deep probe confirmed directory recursion. Re-running with `--no-config` and against individual subdirectories returned `[]` each time, across 81 real source files. The zero is genuine.

It is also close to meaningless here. The detector is pattern-based over source text, and this app renders through MUI components and theme tokens, so spacing, type scale, contrast and hierarchy never appear as literal CSS strings for a rule to match. A zero means "no detectable literal anti-pattern strings" and says nothing about rendered quality. The rendered-DOM rules would only fire in a URL scan — which auth blocked. **The detector and the design review do not disagree here; the detector simply had nothing to see.** Treat 15/40 as the finding and the clean scan as noise.

**Visual overlays: none.** No user-visible overlay exists. Assessment B never reached an app screen, so injection was correctly skipped rather than attempted against the wrong DOM.

**Browser evidence: the app was never seen running.** `AuthContext.tsx:69-72` initialises Keycloak with `onLoad: 'login-required'` and wraps the entire router, so the gate fires at boot rather than per route — confirmed empirically, since even `/access-denied` and the 404 route, which are *not* wrapped in `ProtectedRoute`, still bounce to Keycloak. With no credentials and bypass out of scope, all 16 pages and 18 components are unobserved in the browser. The backend on `:3000` was also down, so data-bearing screens had nothing behind them regardless.

**Everything below is therefore source-derived, not visually confirmed.** That is a real limit on this critique, and the fix is credentials, not more analysis.

**A brand conflict the browser did catch.** The one screen that did render — the custom Keycloak login theme, title "Super Admin Portal" — leads with an **orange/gold sail-shaped logo mark**. PRODUCT.md, written from your own instruction earlier today, records that "Its Plain Sailing" means *it's easy*, not sailing, and lists nautical imagery as an explicit anti-reference. The shipped mark is a sail. Since the mark was already flagged as a placeholder, this is a cheap fix now and an expensive one later.

## Overall Impression

This is a competent engineer's admin app with two or three genuinely excellent components stranded inside it, and no system connecting them. The quality here is not evenly distributed — it is bimodal. `PaymentFeeEditor` states its blast radius before you commit; organisation delete uses `window.confirm`. The urlCode checker tells you the real member-facing consequence; the org-name field rewrites your keystrokes as you type. Reassurance exists exactly where one thoughtful developer built it, and nowhere else.

The single biggest opportunity is to make that developer's instinct the rule. Every destructive action should have to state its blast radius in the voice `PaymentFeeEditor.tsx:183-192` already uses. That one principle fixes both P0s, most of the P1s, and the emotional shape of the product.

## What's Working

**1. `PaymentFeeEditor.tsx` — the worked example.** It shows consequences, not fields. It separates two things that are genuinely easy to confuse and says so outright: the handling fee is what the member pays on top, the application fee is what the platform keeps out of what's collected. It even handles the unset case honestly — "Not set — the platform keeps the handling fee €1.80, as it does today" — rather than showing a blank.

**2. Currency-as-inherited, made visible.** `CreateOrganizationPage.tsx:430-441` renders Currency read-only with "Set by the *Sailing Club* organisation type," and "Select an organisation type first" when empty. It teaches the domain rule at the moment of confusion instead of just disabling a control — the user learns *why*, not just *no*.

**3. The `urlCode` availability check.** Debounced at 400ms, and the helper text is the product outcome rather than a validation rule: "Members will sign in at /account/khpc". It degrades correctly too — a failed check clears the error rather than blocking the form, with a comment explaining the backend validates on save regardless.

## Priority Issues

### [P0] Half the application has no navigation

**What:** `Layout.tsx:23-27` defines three nav items. `routes/index.tsx` registers eight top-level destinations. `/tenants`, `/tenants/:id`, `/users` and `/roles` are fully built, have passing test suites, and are reachable only by typing the URL.

**Why it matters:** Tenant is the top-level customer boundary in this product's own terminology; Users and Roles are the platform's access-control surface. An operator cannot manage tenants without prior knowledge of a URL that appears nowhere in the UI. This is not a discoverability nit — the task cannot be started.

**Fix:** Replace the three-button AppBar with a persistent left rail carrying all eight destinations, grouped *Platform* (Dashboard, Tenants) / *Configuration* (Organisation Types, Organisations) / *Access* (Users, Roles). Active item gets a filled background token, not `textDecoration: 'underline'`. Collapse to a temporary `Drawer` below `md` — there is currently no responsive handling anywhere in the package, zero `useMediaQuery` hits.

**Suggested command:** `/impeccable layout`

### [P0] A type's currency is freely mutable with cash-denominated fees attached, and no warning

**What:** `EditOrganizationTypePage.tsx:244-257` renders Currency as an ordinary 7-option select. `organisationCount` is already loaded at line 135 and already used to warn about fee changes inside `PaymentFeeEditor.tsx:183`. The currency control, which invalidates those same fees, gets nothing.

**Why it matters:** `fixedFee` is a cash amount in the type's currency. Switching EUR→JPY reinterprets `0.25` as ¥0.25, and every organisation of that type immediately charges a nonsense handling fee on live card payments. `PaymentFeeEditor` receives the new currency and re-renders its worked example with new symbols and *identical numbers* — the app actively displays the wrong thing as if it were right. Highest-consequence control in the application, lowest-friction interaction.

**Fix:** When `organisationCount > 0`, make Currency read-only behind an explicit "Change currency" affordance that opens a confirmation naming the count, showing before/after on the actual current fee values (€0.25 → ¥0.25), and requiring the type's display name to be typed. Move the existing `organisationCount` warning to the top of the form so it governs the whole page.

**Suggested command:** `/impeccable harden`

### [P1] No unsaved-changes protection on any form, and validation is toast-only

**What:** `beforeunload`, `useBlocker`, `usePrompt` and `isDirty` return nothing across the package. `CreateOrganizationPage.tsx:229` is a bare `IconButton` calling `navigate()`. Validation shows one error at a time via toast and never marks a field invalid.

**Why it matters:** That form has ~20 inputs plus two selector blocks. A misclick on the back arrow destroys all of it with no prompt. On `TenantsPage.tsx:16` the create form has no URL at all, so browser Back exits the entire Tenants section rather than returning to the list. The toast-per-error loop means a form with three problems costs three round trips.

**Fix:** Add a `useBlocker` guard on all six create/edit routes, dirty-checked against initial `formData`. Convert validation to per-field state: set `error` and `helperText` on the offending `TextField`, focus the first invalid one, summarise in an `Alert` above the actions. Convert `TenantsPage`/`UsersPage`/`RolesPage` from `viewMode` state to real routes so Back and refresh behave.

**Suggested command:** `/impeccable harden`

### [P1] The tables have no power-user affordances at all

**What:** Across all six tables: no sorting, no pagination, no row selection, no bulk actions, no keyboard handlers, no URL-persisted filters. `react-window` sits in `package.json` and is imported nowhere. `OrganizationsPage.tsx:98-107` filters the entire unpaginated response client-side on every keystroke. Compounding it, `warmTheme.ts:157-164` sets `MuiButton.root` padding to `0.85rem 2rem` with `borderRadius: 60px`, which in MUI v5 beats `sizeSmall` — so every toolbar button is ~48px tall on a screen that is nothing but rows.

**Why it matters:** The audience is a small, expert, repeat-use internal team whose day is scanning and acting on lists. Blocking twelve organisations after a payment incident costs twelve full round trips through row → edit page → status dropdown → save → back. Nothing here is faster on the hundredth use than the first, which is the definition of a tool that does not respect a power user.

**Fix:** Extract one `AdminTable` used by all six lists: sortable headers, server-side pagination, checkbox column with a bulk-action bar (Activate / Block / Delete), `/` to focus search, `n` for new, `j`/`k` row movement, `Enter` to open. Push search and filter into query params so a filtered list is linkable and survives navigation. Add a `size="small"` escape hatch to the button override.

**Suggested command:** `/impeccable optimize`

### [P1] A global backdrop override sits on top of MUI's focus-trap machinery

**What:** `index.css:5-16` applies `opacity: 0 !important; pointer-events: none !important` to every `.MuiBackdrop-root:not([aria-hidden="false"])`, and `App.tsx:14-24` additionally rips backdrop nodes out of the DOM on mount, logging `console.log('Removing orphaned backdrop')` in production.

**Why it matters:** This is a global CSS override keyed on an ARIA attribute, layered on a DOM-mutation workaround, sitting directly on MUI's modal focus trap. If any assistive tech or MUI version shifts `aria-hidden` timing, live dialogs lose their backdrop and their focus containment — and every confirm/edit dialog in the app inherits the risk. Alongside it: no `<h1>` anywhere except the raw 404, no `<nav>`/`<main>`/skip link in `Layout.tsx`, and table action buttons using `title="Delete"` rather than `aria-label`, so a screen-reader user hears "button, button, button" on every row.

**Fix:** Find and fix the actual orphaned-backdrop bug rather than suppressing its symptom; delete both the CSS override and the DOM mutation. Then add landmarks and a skip link to `Layout.tsx`, promote page titles to a real `<h1>`, and convert every `title=` on an icon button to `aria-label=`.

**Suggested command:** `/impeccable audit`

## Cognitive Load

**6 of 8 criteria fail — critical.**

Failing: single focus, chunking, visual grouping, visual hierarchy, minimal choices, working memory. Passing: one-thing-at-a-time. Partial: progressive disclosure.

`EditOrganizationTypePage.tsx:216-360` puts identity, currency, language, locale, membership-numbering policy, card handling fees, Stripe Connect application fees and default capabilities in one flat column stack with `gap={3}` and no dividers, cards or headings. `CreateOrganizationPage.tsx:238-476` is one `Card` holding ~20 controls with exactly one sub-heading covering 6 of them.

Decision points exceeding the four-item working-memory limit:

- `EditOrganizationTypePage.tsx` — Currency (7), Language (8), Default Locale (6): three consecutive, semantically overlapping selects
- `CreateOrganizationPage.tsx:236-476` — ~20 fields visible simultaneously
- `PaymentFeeEditor.tsx:214-316` — 5 money inputs per payment method, all methods expanded at once
- `BulkCapabilityPermissionSelector.tsx:126-275` — **six competing mechanisms for one decision** on one screen: three "All as Read/Write/Admin" buttons, "Select All", a scrolling checkbox list, a "Permission Level" dropdown, "Add N Selected", and a per-row dropdown in the results table
- `CapabilitySelector.tsx:116-117` and `OrganizationsPage.tsx:143-155` — unbounded lists, no cap

Working memory specifically: `EditOrganizationTypePage` shows the affected-organisation count only inside `PaymentFeeEditor`, roughly 100 lines below the Currency dropdown that invalidates those fees. And `OrganizationsPage.tsx:44-45` holds search and filter in component state, so drilling into a detail page and returning loses the filter — you re-type it every time.

## Emotional Journey

**Peak:** the worked fee example in `PaymentFeeEditor.tsx:344-356`. The only place in the product where the tool visibly has the operator's back.

**End: flat, which inverts peak-end.** Every successful task ends identically — `navigate()` away plus a 6-second top-right snackbar. Create an organisation and you land on a table row that looks like every other row. There is no confirmation of what you just brought into existence, no "here is the club's member URL, hand this to them" — despite `CreateOrganizationPage.tsx:291` having *just* computed exactly that string.

**Valleys:** the raw OS `window.confirm` on organisation delete; the eternal spinner on a failed detail fetch; watching the sanitiser rewrite "St. Mary's" into "st-mary-s" keystroke by keystroke; and discovering half the app isn't in the nav.

**Reassurance audit at high-stakes moments:**

| Action | Reassurance |
|---|---|
| Change handling fee rates | **Excellent** — names the blast radius ("affects N organisations"), the timing, and the bound ("payments already taken are unaffected") |
| Change a type's currency | **None** — same page, ~100 lines above the alert that does exist |
| Delete an organisation | **Almost none** — `window.confirm` with no mention of members, admin users, payment history, events, or the `/account/:orgCode` link that stops working |
| Block an organisation | **None** — cutting off an entire club's members is one select and a save |
| Delete a tenant | **Good** — names the consequence. But Tenants isn't in the nav |
| Delete a role assigned to users | **None** — no count of affected users |

## Persona Red Flags

**Alex (impatient power user)** — the persona that matters most here, since the real audience is repeat-use internal staff:

- Zero `onKeyDown` handlers across all 59 files. `/` does not focus search. Nothing opens a create form from the keyboard.
- `window.confirm` blocks the JS thread, can't be Esc-styled, and its button order is OS-dependent — so his muscle memory for "confirm" is wrong on half his machines. The three MUI `Dialog`s elsewhere *do* close on Esc, so the app is inconsistent about its most-repeated interaction.
- No bulk actions. Blocking twelve clubs is 12 × (edit icon → page load → scroll → select → save → back). The core task can't be done in under a minute even once.
- `TenantsPage.tsx:16` holds view state in `useState`, so `/tenants` is the section's only URL. He can't bookmark "new tenant", can't open two tenants in two tabs, and browser Back inside the create form throws him out of Tenants entirely.
- Three unlabelled 20px `IconButton`s per row, with Delete one pixel-target from View.

**Sam (accessibility-dependent):**

- The `index.css` backdrop override plus `App.tsx` DOM mutation — a booby trap under every modal (see P1 above).
- `title="Delete"` instead of `aria-label` on every table action button across five files. `title` is not a reliable accessible name.
- No `<h1>` in the entire application except the raw 404. Page titles are `variant="h4"` → `<h4>`, and `TenantList.tsx:78` / `RoleList.tsx:63` / `UserList.tsx:86` emit bare `<h2>`. Heading order is arbitrary.
- No landmarks, no skip link — he tabs through logo, three nav buttons, username and Logout on every page load before reaching content.
- `OrganizationsPage.tsx:84-95` maps both `inactive` and an unknown status to `'default'`, so "inactive" and "unrecognised" are pixel-identical; the only text is the raw lowercase enum.
- Focus never moves to error output. `AddOrganizationAdminUserPage.tsx:188-192` renders an `Alert` on validation failure and leaves focus where it was — he submits, hears nothing, and doesn't know he was rejected.
- Success and failure share one snackbar with no `role="alert"` distinction.

**Riley (deliberate stress tester):**

- **Silent partial save.** `EditOrganizationTypePage.tsx:137-139` catches a fee-fetch failure with a bare `console.error`; `paymentFees` stays `[]`, the editor never renders, and line 163's `if (paymentFees.length > 0)` skips the fee write entirely. The user sees "Organisation type updated successfully" and never learns fees exist, let alone that they weren't saved.
- **Partial success reported as total failure.** `AddOrganizationAdminUserPage.tsx:110-117` creates the user, then assigns roles via `Promise.all`. One rejection shows "Failed to create administrator user" — but the user *was* created. He retries, hits a duplicate-email error, and concludes nothing worked while a role-less admin sits in Keycloak.
- **"Reset to default" is a partial reset on a money control.** `PaymentFeeEditor.tsx:147-162` restores the three handling-fee fields but not `applicationFeeFixed` or `applicationFeePercentage` — a clean slate that silently keeps a mistyped platform revenue split.
- **Clearing a fee field saves a zero.** `PaymentFeeEditor.tsx:141` stores `'' as unknown as number`; the submit coerces with `|| 0`. Clear a field intending to retype, get distracted, save — the fee is now 0 for every organisation of the type.
- A failed detail load spins forever; refresh mid-flow destroys work silently; you cannot type a normal organisation name; long strings are unguarded with no `noWrap` on any table cell.

## Minor Observations

- `index.html:7` reads `Super Admin - AWS Web Application Framework` — the stale scaffold name PRODUCT.md explicitly forbids in user-facing strings, sitting in every browser tab and bookmark. `package.json` carries the same.
- `public/logo.png` and `public/favicon.png` are byte-identical (60,544 bytes each). `Layout.tsx:34-38` renders the favicon at 40px with `alt="Logo"` — alt text that conveys nothing.
- `DashboardPage.tsx:208` hardcodes `<Chip label="System Operational" color="success" />`. It asserts platform health regardless of platform health, contradicting PRODUCT.md principle 5 on the first screen after login.
- Dashboard stat cards are inert — six obvious navigation targets wasted.
- `warmTheme.ts:281-282` applies `backdropFilter: blur(20px)` to `MuiAppBar`, but `Layout.tsx:31` uses `position="static"`. Nothing ever scrolls beneath it: pure GPU cost for an invisible effect.
- `AccessDeniedPage.tsx:13-21` sets `minHeight: 100vh` and its own background but renders *inside* `Layout`, so it appears below the app chrome with a full extra viewport of grey — and the nav above still offers links the user was just told they can't use.
- Three different language/locale lists exist across two files; only one of the three matches the product's six locales.
- Zero i18n in this package. Defensible for an internal tool, but nowhere declared as an exemption — and it sits beside a dropdown offering Chinese and Japanese.
- `TenantList.tsx:196-209` calls `useNavigate()` conditionally after an early return — a hooks-order violation that will crash if `onViewDetails` ever changes between renders.
- The custom Keycloak login theme emits two malformed-viewport warnings (`The key "viewport" is not recognized`), and `packages/admin/index.html` fetches Sora from `fonts.googleapis.com` at runtime — a third-party request on the critical path of an internal admin tool.

## Questions to Consider

1. **If the super admin's real job is deciding what shape a club is, why is shape rendered as an integer?** What if the organisations list showed a compact capability glyph per row, so the estate's shape is scannable and a misconfigured club is visible without opening it?
2. **The one excellent component shows consequences before commitment. What breaks if that becomes the rule?** Which destructive actions can even *compute* their blast radius today, and what does the backend need to add for the rest?
3. **"Its Plain Sailing" means effortless. What would this tool look like if effortlessness were the brief for the operator too** — creating an organisation as three fields, everything else inherited from its type until someone deliberately diverges?
4. **Who actually uses the Users and Roles pages, given they've never been linked?** Dead surface to delete, or load-bearing surface reached by pasted URL? The answer decides whether the P0 fix is "add nav" or "remove code".
5. **Six of eight cognitive-load criteria fail on the same two pages. Is `EditOrganizationTypePage` one task or four** — identity, localisation, numbering policy, and money — merged because they share a database row?
6. **The sail logo contradicts the brand fact recorded this morning.** The mark was already a known placeholder — is replacing it in-scope now, while it's cheap, or does it wait for a designed identity?
