---
target: orgadmin
total_score: 15
max_score: 40
na_heuristics: 
p0_count: 3
p1_count: 2
timestamp: 2026-08-19T06-02-00Z
slug: packages-orgadmin-shell
---
Method: dual-agent (A: a3bf6815e22078dae · B: a03b744c714d73a41)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 1 | Save confirmation renders ~1000px above the Save button and self-destructs in 3s; `document.title` identical on every route; no result count on any list |
| 2 | Match System / Real World | 2 | Good club vocabulary, but every money figure is hard-coded `GBP` for a EUR club, and a dialog says "integrated throughout **OrgAdmin**" |
| 3 | User Control and Freedom | 2 | Settings tab lives in `useState(0)`, not the URL — refresh loses it, Back exits the module; no unsaved-changes guard |
| 4 | Consistency and Standards | 1 | Three destructive-confirm mechanisms, two with hard-coded English; native `confirm()` beside MUI dialogs |
| 5 | Error Prevention | 1 | Save never disabled, no dirty tracking, no field validation; refund failure is `console.error` only |
| 6 | Recognition Rather Than Recall | 1 | `Layout.tsx:172` — the rail shows only the current module; dashboard has no rail at all |
| 7 | Flexibility and Efficiency | 1 | Actions column clipped off-screen at 1200px; no shortcuts, no linkable settings tab, no global search |
| 8 | Aesthetic and Minimalist Design | 2 | The look is genuinely pleasant, undercut by a translated debug string, mid-word truncation, and console.logs on every navigation |
| 9 | Error Recovery | 1 | Failed refund shows the user nothing; zero field-level validation messages |
| 10 | Help and Documentation | 3 | Genuinely strong four-step fallback help system; drawer overflows a 390px phone and its links sit at 2.16:1 |
| **Total** | | **15/40** | **Poor — major UX work required** |

## Design Specificity Verdict

**LLM assessment.** DESIGN.md is authored for a volunteer-run club platform; the running application is not. The eight dashboard accents are Material Design's stock palette unedited (`#E53935`, `#6D4C41`, `#ED6C02`, `#3949AB`, `#2E7D32`, `#F9A825`, `#D81B60`, `#757575`) against DESIGN.md's "one accent family, orange to gold" and "red, green and blue exist only to report state, never to decorate". `warmTheme.ts` is the pre-remediation palette in full. Rename "Members Database" to "Customer Records" and this is an unbranded B2B console.

One component has a point of view: `DashboardCardIllustration` — bespoke per-module line art inheriting the accent via `currentColor`, restrained hover choreography, an explicit keyboard handler, and a documented heading-level override for screen readers.

**Deterministic scan.** CLI: 2 findings — `layout-transition` (DashboardCard.tsx:82) and `side-tab` accent border (BrandingPreview.tsx:329). In-page detector across four routes: 61 flagged elements — dashboard 5, members 29, settings 18, payments 9. Measured `#ffffff` on `#ff9800` at **2.2:1**; dashboard "Go" affordances at 4.2:1, 3.1:1 and **2.0:1**; dashboard subtitle at **4.49:1** against a 4.5:1 requirement.

Detector caught what the review missed: `clipped-overflow-container` on the settings Card and Tabs, and a `side-tab` 4px accent border. Review caught what no detector could: GBP hard-coding, absent global navigation, a remote-hotlinked brand mark, and a debug string translated into all six locales.

**Visual overlays.** Injection preflight passed (title mutation + executing `<script>`), the detector ran in-page, but it writes nothing to console and exposes globals instead; results were read via `impeccableScanAsync()`. The helper has been stopped, so **no user-visible overlay remains**.

## Overall Impression

A warm, likeable surface sitting on an unfinished implementation. The dashboard's first viewport is the best thing here and the debug string in the same viewport is the tell. The single biggest opportunity is not visual: it is that the product has no persistent navigation, so a volunteer with twenty minutes pays three interactions and a visual search to move between the two modules they came to use.

## What's Working

1. **Contextual help resolves through a four-step fallback** (page/locale → module/locale → page/en-GB → module/en-GB), so a partially-translated locale degrades to English rather than nothing, and `modulesVisited` persists server-side so guidance follows the person across devices.
2. **The refund flow slows the user in proportion to the stakes** — reason required, confirm disabled until typed, amount restated, reason stored and displayed afterwards.
3. **`DashboardCardIllustration`** is the one component authored for this product rather than assembled from defaults.

## Priority Issues

**[P0] Every money figure in Payments is hard-coded to GBP.** `formatCurrency(amount, 'GBP', locale)` across PaymentsListPage, PaymentDetailsPage and LodgementsPage — including the CSV export and the irreversible refund confirmation. Kildare Hunt is EUR. PRODUCT.md's headline claim is "multi-country from day one". Fix: take currency from `useOrganisation().organisation.currency` via one `useCurrency()` hook in orgadmin-core; lint-ban the literal `'GBP'`. → `/impeccable harden`

**[P0] There is no persistent navigation.** `Layout.tsx:172`: `visibleModules = currentModule ? [currentModule] : []`, and the drawer is suppressed entirely on the dashboard. Fix: permanent global rail listing all capability-enabled modules with the current one expanded; breadcrumb in the app bar. → `/impeccable shape`

**[P0] Primary actions are unreachable at both desktop and phone width.** Members renders 997px of table in an 844px well at 1200px, clipping Actions with no scroll affordance. At 390px: members overflows to **1093px**, settings **877px**, payments **693px**; "Add Member" sits 464px past the right edge. Fix: stack rows into cards below `md` as DESIGN.md already specifies; sticky bottom action bar; pin the Actions column at desktop. → `/impeccable adapt`

**[P1] The shipped theme is the pre-remediation palette, and state signals are the least readable thing on screen.** Active tab, selected nav item and primary button all measure ~2.1–2.2:1. Fix: apply DESIGN.md's values to `warmTheme.ts` (`#D24400 → #BF360C`, status `#D32F2F / #15803D / #1D4ED8 / #A15C00`, focus ring 3px orange-signal), then derive module accents from the warm family instead of Material's eight hues. → `/impeccable polish`

**[P1] Commit and destroy give feedback in the wrong place, or none.** Save confirmation ~1000px from the button; refund failure console-only; three delete-confirm mechanisms, two hard-coded English. Fix: one i18n `ConfirmDialog` in `packages/components`; snackbar anchored near the action with no auto-dismiss on failure; dirty tracking with a route guard. → `/impeccable harden`

## Persona Red Flags

**Alex (power user)**: Members → Payments costs three interactions and a visual search. Payment Settings has no URL. The Actions column he uses daily is clipped. Eight separate "don't show again" checkboxes. Four `console.log` calls fire on every navigation.

**Sam (keyboard + screen reader)**: Zero `<h1>` on dashboard and settings; the only `<h1>` on members/payments comes from a *dialog's* markdown, and payments loses it entirely at 390px. No skip link — nine tab stops before the first content control. Route changes are silent. `DashboardCardIllustration` sets `aria-label` on the card, suppressing its own description — Sam hears "Events, button" and never the explanatory line. The members-row "Processed" toggle mutates a record and has no accessible name.

**Peig (volunteer, 20 minutes, no training)**: Second 20, the dashboard says `"Debug: 11 capabilities enabled, 8 modules available"` — translated into all six locales. Eight equal cards, every explanatory sentence clipped mid-word. First settings field is "Organisation Name", disabled, showing a slug; the field with her club's real name is "Display Name". She saves and the confirmation appears off-screen behind her. On her phone she cannot reach "Add Member".

## Minor Observations

- `DRAWER_WIDTH = 260`; DESIGN.md specifies 248.
- `(a.order || 999) - (b.order || 99)` — the typo sorts unordered modules ahead of ordered ones.
- `t('dashboard.learnMore')` renders as "Go"; key and value disagree.
- `warmTheme.shadows[5..24]` are 20 identical copies, so any elevation above 4 silently gets the modal shadow.
- `rgba(255,152,0,0.12)` carries three unrelated meanings: selected nav, row hover, and label chips.
- Native `<input type="date">` on Payments beside MUI pickers elsewhere.
- Console is clean: 0 errors on all four routes, no missing `alt`, no positive `tabindex`.
- Detector false positives confirmed: `dark-glow` on a white page, `layout-transition` on stock MUI `<legend>` notches, `cramped-padding` on default MuiChips, and the `::before` height transition that cannot reflow siblings.

## Questions to Consider

1. DESIGN.md's "Known divergence" table lists five rows and omits the eight Material hues, the GBP hard-coding, the missing navigation and the desktop clipping. Has anyone opened the running app since that document was written?
2. The dashboard is eight doors and zero information. What stops it from being the one screen worth opening — *4 unpaid invoices, 3 registrations awaiting approval, renewal opens in 12 days* — when Reports already computes all three?
3. PRODUCT.md calls the eight-module install rare and the two-module club normal. Has anyone opened a memberships-only install?
4. Six locales are a durable constraint and the **English** settings tabs already overflow at 1200px. Has any screen been rendered in de-DE?
