# Org-admin navigation

A permanent, grouped navigation rail, replacing a drawer that showed only the module you were
already in.

## What was wrong

`Layout.tsx` computed `visibleModules = currentModule ? [currentModule] : []`, and suppressed the
drawer entirely on `/`. Two consequences:

- **The dashboard — the screen every administrator starts from — had no navigation.** It *was* the
  navigation: eight cards, and the only way between modules.
- **Crossing from one module to another cost three interactions and a visual search.** Members →
  Payments meant "Back to Main Page", re-scan eight cards, click. PRODUCT.md's primary user works in
  twenty-minute interrupted bursts; that is the session this charged the most for.

On `/settings` the result was 260px of chrome holding one navigation item and a link home.

## What it is now

A rail on every route, in two groups:

| Group | Contents | Rule |
|---|---|---|
| **Running the club** | Events, Memberships, Merchandise, Calendar, Registrations, Ticketing | everything with a `capability` |
| **Setup** | Payments, Reports, Forms, Users, Settings | everything without one |

The split needs no new metadata: `capability: undefined` is already the registry's marker for an
always-on core area, and `order` already runs < 10 for core and ≥ 10 for capability modules.

- The module you are inside **expands** to its `subMenuItems`; every other module stays one
  collapsed row. Expansion follows the route, not a toggle, so the rail's height is predictable and
  nothing needs restoring after a reload.
- Sub-items are capability-gated individually, so Discounts appears under Events only when
  `entry-discounts` is enabled.
- **An empty group renders no heading.** A club with only `memberships` sees one group, not an
  empty "Running the club".
- Labels wrap rather than truncate. The longest module name in the six locales is Spanish —
  *"Venta de entradas para eventos"*, 30 characters — which cannot fit 248px on one line. A wrapped
  label is correct; a truncated one in a navigation rail is not.

A breadcrumb in the app bar reads *organisation › module › page*, each step but the last a link.

## Also in this change

- `DRAWER_WIDTH` 260 → **248**, the width DESIGN.md specifies.
- `(a.order || 999) - (b.order || 99)` → `(a.order ?? 999) - (b.order ?? 999)`. The two defaults
  disagreed by a factor of ten, so a module with no `order` sorted *ahead* of every module that had
  one.
- The settings tab moved from `useState(0)` into the URL as `?tab=<slug>`. Held in state it could
  not be linked or shared, a reload dropped you back on Organisation Details, and Back left the
  module instead of returning to the previous tab. Slugs rather than indices, so a link survives a
  tab being inserted ahead of it.
- Four `console.log` calls that fired on every navigation, removed.
- `navigation.backToMainPage` retired; `dashboard`, `groupWork`, `groupSetup`, `sections` and
  `breadcrumb` added, in all six locales.
- The app bar's logout button went with the landing-page special case — the rail carries it on every
  route now.

## Known: the `dashboard` module is withheld from the rail

`orgadmin-core` registers a `dashboard` module at `/dashboard`, distinct from `/`. It is filtered out
of the rail for two reasons, and the filter should be deleted once the second is fixed:

1. Its label is also "Dashboard", so the rail would show that word twice for two different pages.
2. **The page throws.** `dashboard/pages/DashboardPage.tsx:186` reads `data.events.total` where
   `data.events` is undefined, and renders a blank screen.

It was unreachable from the interface before this rail existed, which is why nobody had hit it. The
rail is meant to be driven by the registry, not by exceptions — this is a temporary guard around a
crash, not a design decision.

## Untouched

Dashboard cards and illustrations, module content pages, the organisation switcher, the help drawer.
Colour and contrast belong to the theme remediation; mobile table behaviour belongs to the responsive
pass. Neither is pre-empted here.
