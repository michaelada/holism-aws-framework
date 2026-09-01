# Account User Application — Proposed Screens & Wireframes

**Status:** Proposal for review. Q1–Q11 answered 13 Feb 2026 and folded in. No code has been written.
**Date:** 13 February 2026

A new front end for **account users** — the members and customers of an organisation, as opposed to
the org admins served by `/orgadmin` and the super admins served by `/admin`.

This document has three parts:

1. [Requirements analysis](#part-1--requirements-analysis) — what the platform already supports,
   and the gaps that must be closed before these screens can exist.
2. [Proposed architecture and screen inventory](#part-2--architecture-and-screen-inventory).
3. [Wireframes](#part-3--wireframes) — 51 screens, desktop and mobile.

Followed by the [cart arithmetic](#part-4--cart-arithmetic), the
[offline behaviour matrix](#part-5--pwa-and-offline-behaviour), the
[decisions taken](#part-6--decisions-taken) and the
[remaining questions](#part-7--remaining-questions) those decisions surfaced.

> **Implementation status** — phases 1–5 of the task breakdown are built: organisation URL codes
> ([G2](#g2--organisations-have-no-url-friendly-short-code)), handling-fee configuration
> ([G5](#g5--handling-fees-are-configured-per-organisation-type)), the currency rule
> ([G12](#g12--an-organisations-currency-must-match-its-types)), the cart arithmetic from
> [Part 4](#part-4--cart-arithmetic), screen
> [J1](#j1--super-admin-handling-fees-on-an-organisation-type), and the account-user API surface
> ([G1](#g1--there-is-no-account-user-api-surface-at-all)) — `/api/public/*`, `/api/account/*` and
> the membership resolver behind screens A6/A7/A8.
> See [ACCOUNT_USER_APP_PHASE1_FOUNDATION.md](ACCOUNT_USER_APP_PHASE1_FOUNDATION.md).
> Phase 4 adds the cart and payment schema
> ([G3](#g3--payments-cannot-represent-a-multi-item-basket),
> [G4](#g4--handling_fee_included-exists-only-on-event-activities)) and a working cart service.
> Phase 5 adds registration and approval
> ([G6](#g6--auto-registration-is-an-org-admin-setting)) — the endpoints behind screens A8, I3 and
> I4. Phases 6–10 (the front-end packages, checkout, ticketing, PWA) are not started.

> **Editing a wireframe** — the diagrams are generated SVGs. Edit the ASCII source in
> [`images/account-user/src/`](images/account-user/src/) and rebuild with
> `python3 scripts/wireframes/ascii_to_svg.py build --out docs/images/account-user`.
> See [images/account-user/README.md](images/account-user/README.md).

> **Changes in this revision** — handling fees are now configured by the super admin per
> **organisation type** per payment method, with fixed + percentage + tax elements
> ([G5](#g5--handling-fees-are-configured-per-organisation-type)), which in turn requires an
> organisation to share its type's currency ([G12](#g12--an-organisations-currency-must-match-its-types));
> registration approval is an org-admin toggle ([G6](#g6--auto-registration-is-an-org-admin-setting));
> **event ticketing is in scope** ([G11](#g11--event-ticketing-is-in-scope)). Six new screens:
> A8, C9, C10, I3, I4, J1. The worked cart totals throughout have been recalculated under the new
> fee formula — the example cart now comes to €288.45 with €108.45 charged to the card.

---

# Part 1 — Requirements analysis

## 1.1 What the platform already gives us

| Capability | Status |
|---|---|
| Keycloak identity, realm `aws-framework`, JWT validated by `authenticateToken()` | ✅ Exists |
| Account users as a distinct `user_type` in `organization_users` | ✅ Exists |
| A user belonging to **several** organisations (one row per org) | ✅ Supported by the schema already |
| Per-organisation capability flags (`enabled_capabilities`) | ✅ Exists |
| Capability-gated module registration, lazy-loaded, menu-aware | ✅ Exists (`ModuleRegistration`) |
| Application forms + `form_submissions` | ✅ Exists |
| Domain data — events/activities, membership types, registration types, merchandise, calendars | ✅ Exists |
| Per-item `supported_payment_methods` on membership/merchandise/calendar/registration types | ✅ Exists |
| Payment methods per org (`pay-offline`, `stripe`, `helix-pay`) with credentials in `org_payment_method_data.payment_data` | ✅ Exists |
| Six locales, org-derived locale selection | ✅ Exists |
| Per-organisation branding (logo + 5 colours) in `settings.branding` | ✅ Exists (new, uncommitted) |

## 1.2 Gaps that must be closed

These are the things the requirements assume but the codebase does not yet have. Each one is work
that precedes or accompanies the screens.

### G1 — There is no account-user API surface at all

Every backend route today is mounted under `/api/admin/*` or `/api/orgadmin/*`, and every one of
them resolves the caller's organisation with:

```sql
SELECT organization_id FROM organization_users
WHERE keycloak_user_id = $1 AND user_type = 'org-admin' AND status = 'active'
```

An account user fails that lookup by design. **Nothing in the current API can be reused as-is.**

Proposed two new route families:

| Prefix | Auth | Purpose |
|---|---|---|
| `/api/public/*` | none | Organisation directory, org lookup by code, branding, public event/membership/merchandise listings for the pre-login landing page |
| `/api/account/*` | `authenticateToken()` + a new `resolveAccountOrganisation()` middleware | Everything behind the login |

`resolveAccountOrganisation()` is the account-user mirror of the org-admin resolver: it takes the
organisation from the URL/header, checks the caller has an **active** `organization_users` row of
`user_type = 'account'` for it, and rejects otherwise. Capability gating then reuses the existing
`loadOrganisationCapabilities()` / `requireCapability()` middleware unchanged.

### G2 — Organisations have no URL-friendly short code

`organizations` has `id`, `name`, `display_name`, `domain` — no slug. Requirement (2) needs one.

Proposed: migration adding `organizations.url_code varchar(50) UNIQUE NOT NULL`, plus a field on the
super-admin create/edit organisation pages with format validation (`^[a-z0-9][a-z0-9-]{1,49}$`), a
uniqueness check, and a reserved-word list so `khpc` is fine but `api`, `admin`, `login`, `assets`,
`static`, `health` are not — they would collide with the app's own paths.

### G3 — `payments` cannot represent a multi-item basket

This is the single biggest gap. The table is one-payment-per-thing:

```
payments( id, organisation_id, user_id, payment_type, context_id, amount, currency,
          payment_method, payment_status, payment_provider, provider_transaction_id, ... )
```

`payment_type` + `context_id` point at exactly one entry / membership / booking. A checkout that
covers an entry **and** a membership **and** three bookings has nowhere to live, and the
"drill into a payment and see its transactions" requirement has nothing to drill into.

Proposed new tables:

```
carts               id, organisation_id, user_id, status(open|checked_out|abandoned),
                    currency, created_at, updated_at
                    UNIQUE (organisation_id, user_id) WHERE status = 'open'

cart_items          id, cart_id, item_type(event_entry|membership|registration|booking|merchandise),
                    context_ref jsonb,          -- activity id, membership type id, slot, variant…
                    form_submission_id,         -- the completed application form
                    quantity, unit_fee, fee,
                    payment_method_id,          -- the user's current choice
                    handling_fee_included bool, -- snapshot from the source item
                    discount_id, discount_amount,
                    expires_at,                 -- soft hold for capacity-limited items
                    created_at

payment_transactions  id, payment_id, organisation_id, item_type, context_id,
                      description, fee, handling_fee, payment_method_id,
                      form_submission_id, status, created_at
```

and additions to `payments`:

```
+ handling_fee decimal(10,2)
+ offline_amount decimal(10,2)
+ card_amount decimal(10,2)
+ offline_received_at timestamp
+ offline_received_by uuid          -- organization_users.id of the admin who marked it
+ cart_id uuid
  payment_type / context_id  →  become nullable (a basket payment has many)
```

Existing single-context payments keep working; a basket payment leaves `context_id` null and hangs
its detail off `payment_transactions`. The org-admin Payments list reads the parent row, the new
detail drill-down reads the children.

### G4 — `handling_fee_included` exists only on event activities

`event_activities.handling_fee_included` is there. `membership_types`, `registration_types`,
`merchandise_types` and `calendars` have `supported_payment_methods` but **no handling-fee flag**.

The cart rules in the requirements apply the included/not-included distinction to entry, membership,
calendar, registration *and* merchandise fees. So this needs a migration adding the column to the
other four tables, plus the corresponding checkbox in each org-admin type form (mirroring
`EventActivityForm`, which reveals it only when a card method is selected).

### G5 — Handling fees are configured per organisation type

The flag says whether the fee is absorbed. Nothing says what the fee **is** — the Payment
Configuration section that held currency and handling fees was removed from `PaymentSettingsTab.tsx`
in recent work, so today the rate has no home at all.

**Decided (Q3):** the **super admin** configures handling fees on the **organisation type**, once
per card payment method. Every organisation of that type inherits them; there is no per-organisation
override. Three elements per method:

| Element | Example | Notes |
|---|---|---|
| Fixed | €0.25 | A flat amount per card payment |
| Percentage | 1.5% | Of the amount being charged to the card |
| Tax percentage | 23% | May be **0**, in which case no tax element is added |

Proposed storage — a table rather than JSONB, because these are queried on every cart load and a
new provider must not need a schema change:

```
organization_type_payment_fees
    id
    organization_type_id     → organization_types(id)  ON DELETE CASCADE
    payment_method_id        → payment_methods(id)     ON DELETE CASCADE
    fixed_fee                decimal(10,2)  NOT NULL DEFAULT 0
    percentage_fee           decimal(6,3)   NOT NULL DEFAULT 0   -- 1.500 = 1.5%
    tax_percentage           decimal(6,3)   NOT NULL DEFAULT 0   -- 0 = no tax element
    created_at, updated_at
    UNIQUE (organization_type_id, payment_method_id)
```

Only methods classified as card methods (`stripe`, `helix-pay`, and anything else whose name
contains `card`/`stripe`/`helix`) get a row; `pay-offline` never carries a handling fee.

**Auto-populated defaults.** The Create Organisation Type page must arrive with Stripe and Helix-Pay
pre-filled. Those defaults should live on the payment method itself —
`payment_methods.default_fee_config jsonb` — rather than being hard-coded in the admin front end, so
that when Stripe changes its published rates a super admin can update the platform default without a
release. Existing organisation types keep whatever they were configured with; only new ones pick up
the changed default.

**Resolution at runtime.** `organization → organization_type_id → organization_type_payment_fees`,
cached per request. A missing row means zero fee, not an error — an organisation type whose fees
have never been set simply charges no handling fee.

This changes the arithmetic in [Part 4](#part-4--cart-arithmetic) and adds one new super-admin
screen, [J1](#j1--super-admin-handling-fees-on-an-organisation-type).

### G6 — Auto-registration is an org-admin setting

Keycloak's registration flow creates an *identity*. It does not create the
`organization_users` row that connects that identity to Kildare Hunt Pony Club. Something must:
`POST /api/public/organisations/:code/register` creates the Keycloak user (via the existing
`keycloak-admin.service`) and the `organization_users` row with `user_type = 'account'`.

**Decided (Q4):** the org admin controls whether that row starts active, via an **Auto-registration**
toggle stored in `organizations.settings.registration.autoRegistration` (merged into the JSONB, never
replacing it — see [architecture.md](../.claude/modules/architecture.md)).

**Auto-registration ON** — the current-best case:

```
register → Keycloak user created, organization_users.status = 'active'
        → verification email → user activates → signs in → full access
```

**Auto-registration OFF** — approval required:

```
register → Keycloak user created, organization_users.status = 'pending'
        → verification email → user activates their account (they can sign in)
        → signs in → sees "Awaiting approval" (screen A8), no app access
        → org admin approves in the pending-registrations queue (screen I3)
        → status = 'active' + approval email → user signs in → full access
```

The distinction that matters in the implementation: **account activation and organisation approval
are two separate gates.** Keycloak owns the first (email verification), `organization_users.status`
owns the second. A pending user authenticates successfully — they simply have no capabilities, so
the shell renders A8 instead of the app. Rejection is a third state (`rejected`) with its own
variant of A8.

New screens: [A8](#a8--awaiting-approval) (account app), [I3](#i3--org-admin-pending-registrations)
(approval queue) and [I4](#i4--org-admin-registration-settings) (the toggle).

### G7 — Renewal needs a source for its pre-populated answers

"Much of the required information is already available in the system" — concretely, the previous
membership's `form_submission_id` plus the `members` row. The renewal flow loads the prior
submission, maps answers onto the *current* form definition by field id, and marks fields that no
longer exist (dropped from the form) or have no prior answer (newly added to the form). Fields whose
validation rules have tightened since must be re-validated, not trusted.

Same mechanism serves registration renewal.

### G8 — Eligibility rules need a server-side answer

"Not open yet / closed / full" must be decided by the backend, not the browser — a client-side check
is a race with every other user. Proposed: every activity/type in a listing response carries a
computed `availability` object:

```json
{ "state": "open|not_yet_open|closed|full|activity_full",
  "opensAt": "...", "closesAt": "...",
  "spacesRemaining": 12 }
```

and `POST /api/account/cart/items` re-checks it server-side and can reject with `409`. The cart item
`expires_at` gives a soft hold so a user filling in a long form does not lose a place they were shown
as available.

### G9 — All money arithmetic belongs on the server

The requirements are emphatic that the total must be correct, and the rules are genuinely fiddly
(offline vs card, included vs added-on handling fee, discounts, quantities, multi-currency). The
cart UI must **never** compute a total. `GET /api/account/cart` returns the fully-computed
breakdown, and checkout re-computes it from the database rather than trusting anything posted.
See [Part 4](#part-4--cart-arithmetic).

### G10 — Translations

Six locale files (`en-GB`, `de-DE`, `es-ES`, `fr-FR`, `it-IT`, `pt-PT`) for the new shell, holding
every string for the shell and all account modules — the same arrangement as `orgadmin-shell`.
That is a substantial translation surface; expect ~450–550 keys × 6.

**Decided (Q11):** all six locales from day one, not English-first. The practical consequence is
that the key tree must be settled early — retro-fitting keys across six files after the UI is built
is where org-admin's i18n debt came from. Every PR that adds a string adds it to all six.

### G11 — Event ticketing is in scope

**Decided (Q9).** `orgadmin-ticketing` already issues electronic tickets against event entries
(`electronic_tickets`), configured per event in `event_ticketing_config` (header text, instructions,
footer, validity period, logo, background colour) and scanned into `ticket_scan_history`. What does
not exist is any way for the **member** to get at their ticket.

What this adds:

- An `account-ticketing` package gated on `event-ticketing`, with **My Tickets**
  ([C9](#c9--my-tickets)) and a ticket view ([C10](#c10--ticket-)).
- Account endpoints to list a user's tickets and fetch one for rendering.
- **Automatic issuance.** Today tickets are issued from the org-admin side. For the account app a
  ticket must appear on its own once the entry is confirmed — on successful card payment, or when an
  org admin marks an offline payment received ([I2](#i2--mark-received--undo)). This is the same
  confirmation transition that activates a membership, so it belongs in the same service method, not
  a parallel one.
- **Offline-first rendering.** A ticket that needs a signal at a field gate is worthless. Tickets
  for events in the next 30 days are precached with their QR payload and rendered entirely from the
  cache — see [Part 5](#part-5--pwa-and-offline-behaviour).
- `services/ticketGeneration.ts` currently lives in `orgadmin-ticketing` and builds tickets
  client-side. Both front ends must render an identical ticket, so per §1.5 it moves to
  `packages/components`.

### G12 — An organisation's currency must match its type's

**Decided (N3).** Because `fixed_fee` is a currency amount held on the organisation type and
inherited by every organisation of that type, the two currencies cannot be allowed to diverge — a
€0.25 fixed fee inherited by an organisation trading in GBP is meaningless.

Today they can. `organization_types.currency` is `varchar(3) NOT NULL DEFAULT 'USD'`;
`organizations.currency` is `varchar(3)` and **nullable**, set independently on the super-admin
organisation form.

What this requires:

1. **Backfill** — a migration setting `organizations.currency` from its type wherever it is null or
   differs. Existing mismatches need reviewing before the migration runs rather than being
   silently overwritten; there may be none, but that has to be checked, not assumed.
2. **Constraint** — a foreign-key-style check is not expressible in SQL across the join, so enforce
   it in `organization.service` on create and update, and add a repo-level test.
3. **Super-admin UI** — the currency field on Create/Edit Organisation becomes read-only, showing
   the inherited value with "Set by the *Pony Club* organisation type", rather than a free choice
   that can be set wrong. Changing an organisation's type therefore changes its currency, which
   deserves a confirmation.
4. **Organisation type currency changes** are the dangerous case: they would reinterpret every
   inherited `fixed_fee` and every historical price. Blocked once the type has organisations, with
   the error explaining why.

This is a small change with a wide surface — it touches the super-admin app, the organisation
service and a migration — so it is called out separately rather than buried in the fee work.

## 1.3 Interpretation decisions

| Point | Decision |
|---|---|
| Landing page (1) **or** short code (2)? | **Both** (Q1). `/account` gives the directory, `/account/khpc` skips straight to that org's gateway — option 2 is a deep link into option 1's flow. |
| Where does merchandise history appear? | The "My …" areas listed cover entries, bookings, memberships and registrations, but the use case mentions "purchased merchandise". Added as **My Orders** ([C8](#c8--my-orders-merchandise)), gated on `merchandise`. |
| Is the cart per-organisation? | **Yes.** Carts are scoped by `organisation_id`; switching org switches cart. Merging carts across orgs is meaningless — different currencies, different payment providers, different handling fees. The header cart badge shows the current org's cart only, and the switcher flags other orgs with open carts. |
| Ticketing? | **In scope** (Q9) — see [G11](#g11--event-ticketing-is-in-scope). My Tickets, a rendered ticket, and automatic issuance on entry confirmation. |
| Discounts? | **In scope** (Q8). Automatic discounts are applied and shown per line at the point of application and again in the cart; a discount-code box sits in the cart. A fee shown without an applicable discount is simply wrong. |
| Self-cancellation? | **Bookings only** (Q6), governed by the existing `cancellationValidator`. Entries, memberships, registrations and orders cannot be cancelled by the account user — they contact the club. |
| Entering on behalf of someone else? | **Yes** (Q7). Every application form starts with "who is this for?", offering the people on the user's membership. |

---

# Part 2 — Architecture and screen inventory

## 2.1 Packages

Mirrors the org-admin arrangement exactly, so the module registry, capability gating, `useApi`
pattern and lazy-loading all carry over unchanged.

```
packages/
  account-shell            Deployable SPA. Auth, org resolution/switching, routing,
                           module registry, layout, PWA service worker,
                           locales/<locale>/translation.json × 6          :5176
  account-core             Always-on: Home, Cart, Checkout, Payments, Profile,
                           useAccountApi, OrganisationContext, CartContext,
                           OfflineContext, ApplicationFormRenderer
  account-events           capability: event-management
  account-memberships      capability: memberships
  account-registrations    capability: registrations
  account-merchandise      capability: merchandise
  account-calendar         capability: calendar-bookings
  account-ticketing        capability: event-ticketing
```

Per project rule §1.5, anything both front ends can use goes to `packages/components` instead —
concretely: the application-form renderer (metadata-driven, already half-there in `MetadataForm`),
the payment widgets in `OrgPaymentWidget`, `OrgDataTable`, `OrgDatePicker`, `OrgFileUpload`, and the
new cart-total presentation component.

## 2.2 URL scheme

Basename `/account`. Organisation code is the first path segment — it is in the URL rather than only
in session state so links are shareable, refresh-safe, and a user can keep two orgs open in two tabs.

```
/account                                  Organisation directory (public)
/account/:orgCode                         Org gateway (public) → Home (authenticated)
/account/:orgCode/pending                 Awaiting approval (auto-registration off)
/account/:orgCode/tickets                 My Tickets
/account/:orgCode/tickets/:id             A ticket
/account/:orgCode/entries                 My Entries & Bookings
/account/:orgCode/entries/:id
/account/:orgCode/bookings/:id
/account/:orgCode/memberships             My Memberships
/account/:orgCode/memberships/:id
/account/:orgCode/registrations           My Registrations
/account/:orgCode/registrations/:id
/account/:orgCode/orders                  My Orders (merchandise)
/account/:orgCode/orders/:id
/account/:orgCode/browse/events           Events
/account/:orgCode/browse/events/:id
/account/:orgCode/browse/events/:id/activities/:activityId/apply
/account/:orgCode/browse/memberships      Membership types
/account/:orgCode/browse/memberships/:id
/account/:orgCode/browse/memberships/:id/apply?renew=:membershipId
/account/:orgCode/browse/registrations    Registration types
/account/:orgCode/browse/registrations/:id
/account/:orgCode/browse/registrations/:id/apply
/account/:orgCode/browse/merchandise      Merchandise
/account/:orgCode/browse/merchandise/:id
/account/:orgCode/browse/calendars        Calendars
/account/:orgCode/browse/calendars/:id
/account/:orgCode/browse/calendars/:id/book
/account/:orgCode/cart                    Cart
/account/:orgCode/checkout                Checkout
/account/:orgCode/checkout/confirmation/:paymentId
/account/:orgCode/payments                My Payments
/account/:orgCode/payments/:id
/account/:orgCode/payments/:id/transactions/:transactionId
/account/:orgCode/profile                 Profile & Settings
/account/switch                           Organisation switcher
```

## 2.3 Screen inventory

51 screens. ✳ marks a screen with a distinct mobile layout, not just a reflow.
**New in this revision:** A8, C9, C10, I3, I4, J1.

| # | Screen | Area | Gated on |
|---|---|---|---|
| A1 | Organisation Directory | Entry | — |
| A2 | Organisation Gateway (branded) | Entry | — |
| A3 | Keycloak login (branded theme) | Entry | — |
| A4 | Register with organisation | Entry | — |
| A5 | Registration submitted | Entry | — |
| A6 | Not connected to this organisation | Entry | — |
| A7 | Organisation switcher ✳ | Entry | — |
| A8 | Awaiting approval | Entry | — |
| B1 | App shell — desktop | Shell | — |
| B2 | App shell — mobile ✳ | Shell | — |
| B3 | Home / My Dashboard | Shell | — |
| C1 | My Entries & Bookings | My activity | `event-management` ∨ `calendar-bookings` |
| C2 | Entry detail | My activity | `event-management` |
| C3 | Booking detail | My activity | `calendar-bookings` |
| C4 | My Memberships | My activity | `memberships` |
| C5 | Membership detail + renew | My activity | `memberships` |
| C6 | My Registrations | My activity | `registrations` |
| C7 | Registration detail | My activity | `registrations` |
| C8 | My Orders | My activity | `merchandise` |
| C9 | My Tickets | My activity | `event-ticketing` |
| C10 | Ticket ✳ | My activity | `event-ticketing` |
| D0 | Application form step (shared) ✳ | Browse | — |
| D1 | Events list | Browse | `event-management` |
| D2 | Event detail + activities | Browse | `event-management` |
| D3 | Enter an activity | Browse | `event-management` |
| D4 | Membership types list | Browse | `memberships` |
| D5 | Membership type detail | Browse | `memberships` |
| D6 | Membership application / renewal | Browse | `memberships` |
| D7 | Registration types list | Browse | `registrations` |
| D8 | Registration type detail + apply | Browse | `registrations` |
| D9 | Merchandise list | Browse | `merchandise` |
| D10 | Merchandise detail | Browse | `merchandise` |
| D11 | Calendars list | Browse | `calendar-bookings` |
| D12 | Calendar availability ✳ | Browse | `calendar-bookings` |
| D13 | Slot booking form | Browse | `calendar-bookings` |
| E1 | Cart — desktop | Cart | — |
| E2 | Cart — mobile ✳ | Cart | — |
| E3 | Change payment method | Cart | — |
| E4 | Checkout review | Cart | — |
| E5 | Card payment (Stripe / Helix-Pay) | Cart | — |
| E6 | Payment confirmation | Cart | — |
| E7 | Offline checkout confirmation | Cart | — |
| E8 | Payment failed | Cart | — |
| F1 | My Payments | Payments | — |
| F2 | Payment detail + transactions | Payments | — |
| F3 | Transaction detail | Payments | — |
| P1 | Profile & Settings | Profile | — |
| P2 | Change password (Keycloak) | Profile | — |
| H1 | Offline mode | PWA | — |
| H2 | Offline-blocked action | PWA | — |
| H3 | Install prompt | PWA | — |
| I1 | **Org admin:** Offline Payments list | orgadmin-core | — |
| I2 | **Org admin:** Mark received / undo | orgadmin-core | — |
| I3 | **Org admin:** Pending registrations | orgadmin-core | — |
| I4 | **Org admin:** Registration settings | orgadmin-core | — |
| J1 | **Super admin:** Handling fees on an organisation type | admin | — |

Screens I1–I4 are additions to the **existing** org-admin app (`packages/orgadmin-core`), and J1 is
an addition to the **existing** super-admin app (`packages/admin`) — not the new front end.

## 2.4 Responsive strategy

| Breakpoint | Layout |
|---|---|
| `xs` < 600 | Bottom navigation bar (5 items: Home, Browse, My Stuff, Cart, Profile), overflow in a drawer. Lists become cards. Tables become stacked key/value blocks. Calendar defaults to day view. |
| `sm` 600–899 | Collapsible drawer, 2-column grids, calendar defaults to 3-day view. |
| `md` 900–1199 | Permanent sidebar, 3-column grids, calendar week view. |
| `lg` ≥ 1200 | Sidebar + content max-width 1280, cart summary becomes a sticky right rail. |

---

# Part 3 — Wireframes

## A. Entry, identity and organisation context

### A1 — Organisation Directory

**Route:** `/account` (public) · **API:** `GET /api/public/organisations?q=`

The base-URL landing page from requirement option (1).

![A1 — Organisation Directory](images/account-user/A1-organisation-directory.svg)

**Notes**
- Search matches `display_name` and `url_code`, debounced, server-side.
- The "Your organisations" strip appears only when a valid session already exists — it is the fast
  path for the returning multi-org user and is populated from `GET /api/account/organisations`.
- Only organisations with `status = 'active'` and a flag such as `settings.listedInDirectory`
  (default true) appear. A club that does not want to be publicly discoverable is still reachable
  by its code ([Q5](#part-6--decisions-taken)) — hiding from the directory is not access control.

---

### A2 — Organisation Gateway

**Route:** `/account/:orgCode` when unauthenticated · **API:** `GET /api/public/organisations/:code`

Requirement option (2) lands here directly. Branded from `settings.branding`.

![A2 — Organisation Gateway](images/account-user/A2-organisation-gateway.svg)

**Notes**
- "Sign in" redirects to Keycloak with `kc_locale` set from the org's language and a redirect_uri
  back to `/account/khpc`.
- If a valid session already exists, this screen never renders — the router goes straight to B3
  (Home), satisfying "if the person was previously logged in, then they will be brought to the
  specific page".
- Unknown `:orgCode` → a 404 screen offering the directory.
- The "What's on" preview is optional per org and read-only; every card's CTA routes through login.

---

### A3 — Keycloak login (branded)

**Not a React screen** — Keycloak's own login page, using the custom theme machinery already
documented in `docs/KEYCLOAK_MULTIPLE_LOGIN_THEMES.md` / `KEYCLOAK_THEME_SWITCHING.md`.

![A3 — Keycloak login (branded)](images/account-user/A3-keycloak-login-branded.svg)

**Notes**
- One realm, one credential set — this is what makes "one set of credentials for many organisations"
  work with no extra machinery. The org branding is a theme parameter, not a separate realm.
- Forgot-password and registration are Keycloak's own flows; registration hands off to A4 to
  capture the organisation connection (see [G6](#g6--auto-registration-is-an-org-admin-setting)).

---

### A4 — Register with organisation

**Route:** `/account/:orgCode/register`

Two entry paths: a brand-new user, or an existing ItsPlainSailing user who is not yet connected to
this organisation (arriving from A6).

![A4 — Register with organisation](images/account-user/A4-register-with-organisation.svg)

**Notes**
- Creating an account here does **not** create a membership — it creates the login and the
  `organization_users` connection. Applying for membership is a separate, paid flow (D4–D6).
- If the email already exists in Keycloak, the response must not leak that fact: show a neutral
  "Check your email" screen and send a connect-this-club link instead.
- Existing-user path (from A6) collapses this to a single "Connect to this club" confirmation.
- The button sends **no request body**: the platform already knows who is pressing it, so identity —
  email *and* name — comes from the verified token. A caller must not be able to register under
  someone else's details, and a body-only read meant every request arrived nameless and was refused
  as invalid, telling the member the club could not be joined.

---

### A5 — Registration submitted

![A5 — Registration submitted](images/account-user/A5-registration-submitted.svg)

Variant when the org has **auto-registration off**
([G6](#g6--auto-registration-is-an-org-admin-setting)): the body gains a second sentence — "Once
you've activated your account, a club administrator will review your request before you can sign
in." The user still activates via the email; approval is the separate second gate, and they land on
[A8](#a8--awaiting-approval) when they next sign in.

---

### A6 — Not connected to this organisation

Shown when authentication succeeds but there is no active `organization_users` row for this org —
the "otherwise they should be redirected to a registration page" branch.

![A6 — Not connected to this organisation](images/account-user/A6-not-connected-to-this-organisation.svg)

A `status = 'pending'` row shows a third variant: "Your request is awaiting approval."

**Notes**
- **Sign out and "Sign in as someone else" both have to be here.** This screen renders outside the
  app shell, so it carries no navigation of its own — without them a member who opened a club they
  do not belong to has no way to become anybody else, and no way to leave.
- Signing in again as the *same* member returns here, which is why the primary offer is to request
  a connection. Signing in as a **different** member does not — but an ordinary sign-in cannot do
  it. The Keycloak session is realm-wide (see [A7](#a7--organisation-switcher-)), so it returns
  immediately as whoever is already signed in, drawing no form. "Sign in as someone else" therefore
  sends `prompt=login`, which forces re-authentication whatever session exists.
- **The screen names who it is signed in as**, above the body text — `Signed in as Sam Rivers
  (member@example.com)`. The realm-wide session is shared with the **org-admin app**, and this shell
  initialises with `check-sso`, so a person can arrive here as an identity they never chose: an
  administrator who opens a club link in a second tab is silently authenticated as their admin
  account. The old screen described only the club — "this club has no record of you yet" — which is
  true and no help at all in working out that the identity was the problem. The email is always
  shown, not just the name: it is the part that distinguishes an admin account from the same
  person's member account.
- **The enrolment button names them too** — "Create an account for Sam Rivers
  (member@example.com)". As a bare "Create an account" it enrolled whoever the session happened to
  be into a club they were only looking at, which is the one action on this screen that is hard to
  undo. Nothing in the request distinguishes a member deliberately joining a new club from a
  mis-adopted session, so the screen does not guess a primary action for one case over the other —
  it states the identity and lets both routes read plainly.
- **What this does not fix**: two different people signed in at once, in two tabs of the same
  browser. Keycloak's session is one cookie per browser per realm, so that is not achievable in the
  product as it stands — use a second browser profile or a private window. See
  docs/ACCOUNT_ORGADMIN_SESSION_SHARING.md.

---

### A7 — Organisation switcher ✳

**Route:** `/account/switch`, and as a header popover. **API:** `GET /api/account/organisations`

![A7 — Organisation switcher ✳](images/account-user/A7-organisation-switcher.svg)

**Notes**
- Switching is a **client-side context change plus a URL change**, not a re-authentication — the
  Keycloak token is realm-wide, so the same token serves every org the user belongs to. This is what
  makes switching instant.
- What switching *must* do: change `orgCode` in the URL, swap the active `OrganisationContext`,
  re-resolve capabilities and therefore the menu, re-theme from the new org's branding, reload
  the locale if the org's language differs, and swap to that org's cart.
- Open carts in other orgs are surfaced here so a half-finished basket is not silently orphaned.
- The default organisation is stored per user (reuse `user_preferences`) and decides where a bare
  `/account` sends an authenticated user.

---

### A8 — Awaiting approval

**Route:** `/account/:orgCode/pending`

Where a user lands after signing in when the org has **auto-registration off** and their
`organization_users.status` is still `pending`. They are authenticated — they simply have no
capabilities yet, so the shell renders this instead of the app.

![A8 — Awaiting approval](images/account-user/A8-awaiting-approval.svg)

**Rejected variant**

![A8 — Awaiting approval](images/account-user/A8-awaiting-approval-2.svg)

**Notes**
- The two-line status block makes the two gates visible, which matters when a user has verified
  their email and cannot understand why they are still locked out.
- The "other organisations" strip prevents the dead end where a multi-org user is stuck on a pending
  club with no way through to one they already belong to. It is omitted when they have no others.
- "Check again" re-fetches status rather than reloading, so an approval that happened a minute ago is
  picked up without a sign-out/sign-in cycle.
- The rejection message deliberately gives no reason. Whatever the admin recorded in
  [I3](#i3--org-admin-pending-registrations) is internal — surfacing it invites arguments the
  platform cannot adjudicate.
- Like [A6](#a6--not-connected-to-this-organisation), this renders outside the app shell and so must
  carry its own sign-out and "Sign in as someone else". The latter sends `prompt=login`, because the
  realm-wide Keycloak session means an ordinary sign-in returns the same member without ever
  drawing a form.

---

## B. Application shell

### B1 — App shell (desktop)

![B1 — App shell (desktop)](images/account-user/B1-app-shell-desktop.svg)

**Notes**
- Every item under MY ACTIVITY and BROWSE is capability-gated; an org with only `memberships`
  enabled sees four items in total, not thirteen. Section headings hide when empty.
- The org name in the header is the switcher trigger and doubles as the "it should be clear which
  organisation they are accessing" affordance required by the brief. It carries the org's primary
  colour and logo.
- Theme derives from `settings.branding` at runtime, so the shell must build its MUI theme after the
  org resolves — the same ordering constraint `orgadmin-shell` has with i18n.

### B2 — App shell (mobile) ✳

![B2 — App shell (mobile) ✳](images/account-user/B2-app-shell-mobile.svg)

Browse and Mine open a sheet listing only the capability-enabled areas; with a single enabled area
the tab navigates directly instead of opening a sheet.

---

### B3 — Home / My Dashboard

**Route:** `/account/:orgCode`

![B3 — Home / My Dashboard](images/account-user/B3-home-my-dashboard.svg)

**Notes**
- Every card is capability-gated and hides entirely when it has nothing to show, so a
  memberships-only org sees a clean two-card dashboard rather than a grid of empty states.
- **Upcoming events** is the events row, with a **View all** button beside the heading leading to
  [D1](#d1--browse--whats-on). Four teasers read as the whole programme otherwise, and a member who
  takes them that way never opens the listing. Registrations have their own row rather than sitting
  under an events heading.
- **Memberships are a row of cards, one per active membership**, in the same shape as the what's-on
  teasers and headed *Memberships*. A single card about the soonest to expire was the wrong shape
  once parents turned out to hold their children's: it announced that something was expiring without
  showing the other three, which were only reachable by thinking to open [C4](#c4--my-memberships).
  Each card is named for the **member**, with the type as its subtitle. Absent entirely when the
  member holds none — an empty heading is worse than no heading.
- **Renewal lives on the card that needs it**, not in a banner over the page. With several
  memberships a banner has to pick one to be about, and naming one child while three other cards sit
  below says less than a button on the card concerned. The two states stay apart as they do on C4:
  `canRenew` gets the button, and due-but-nothing-published gets a note instead of a button leading
  nowhere. Cards are sorted soonest-to-expire, so anything due leads the row.
- The renewal banner is driven by the same rule as C4: `valid_until - today ≤ 30 days` **and** a
  membership type exists for the following period. Without the second condition the button leads to
  a dead end.
- **What's on** teasers lead with a compact `EventDateTile` for anything dated — the row is scanned
  for *when*, and a date set as another line of prose makes every card read the same at a glance.
  Undated kinds (shop, bookings, registrations) simply have no tile.
- Beneath the name, an event teaser carries **one** status chip — *Open*, *Opening soon*,
  *Closing soon*, *Closed* or *Entries full* — and the moment that state turns on. Deliberately
  smaller than [D1](#d1--browse--whats-on)'s `EntryStatus`, which also weighs capacity ("12 of 50
  places left") because a member choosing between events is judging their chances; here they are
  glancing at a card whose job is to get them to the listing. The states come from the same
  `entryWindowFor` rules, so the two screens cannot disagree about whether an event is open.

  | State | What is shown beneath the chip |
  |---|---|
  | Opening soon | opens *and* closes — when can I enter, and how long will I have |
  | Open | closes |
  | Closing soon | closes |
  | Closed | when entries closed |
  | Entries full | the closing moment, if the window is still running |

  **Times, not just dates.** A closing at 09:00 is a different thing to plan around than one at
  23:59, and "closes 20 August" for a deadline that passes before breakfast is the kind of omission
  a member only notices once they have missed it.

  **Ordinal days** — "closes 22nd Sept 2026, 23:59". Shared with [D1](#d1--browse--whats-on)'s
  event list via `formatOrdinalDateTime`, and applied only in languages that ordinal-suffix dates:
  English and French. German already writes `1.`, and Spanish, Italian and Portuguese use a plain
  numeral.
- *Entries full* outranks the window, but only while the window is running. A closed event reads as
  **Closed**, never "full" — which would be a detail about a door that is shut anyway.
- **Events an entrant cannot act on are still teased**, unlike every other kind. Entries opening on
  Friday, closing yesterday, or a camp that filled up are all things a member wants to know, and an
  events list that silently omitted them would read as a club with nothing on. The chip says which,
  so nothing is mistakable for an invitation. Two exclusions remain: an event the member has
  **already entered**, and one that opens more than `OPENING_WITHIN_DAYS` (3) away — not news yet,
  and it would push out something closing this week.
- The **tab icon follows the club**: `useOrganisationFavicon` swaps the favicon to the uploaded logo
  and restores the platform icon on the way out. The logo is proved to decode before it is applied,
  because a browser that fails to decode an icon falls back to a blank glyph rather than to the
  previous one — so an unverified swap would let a bad upload cost the club its icon entirely.

---

## C. My activity

### C1 — My Entries & Bookings

**Route:** `/account/:orgCode/entries`

![C1 — My Entries & Bookings](images/account-user/C1-my-entries-bookings.svg)

**Notes**
- Status vocabulary, shared across C1/C4/C6/C8: **Awaiting payment** (in a checked-out offline
  payment not yet received), **Confirmed**, **Completed** (in the past), **Cancelled**.
- The Bookings tab swaps the columns for Calendar / Slot / Date / Duration / Fee / Status, and adds
  a calendar-view toggle.

---

### C2 — Entry detail

**Route:** `/account/:orgCode/entries/:id`

![C2 — Entry detail](images/account-user/C2-entry-detail.svg)

**Notes**
- "Your answers" renders the stored `form_submissions` row against the form definition **as it was
  at submission time**. Rendering against the current definition would silently drop answers to
  since-deleted fields.
- **No self-cancellation** (Q6). Entries cannot be cancelled by the account user — the confirmation
  panel gives the club's contact details instead. Only bookings are self-cancellable ([C3](#c3--booking-detail)).
- The ticket panel appears only when `event-ticketing` is enabled, the event is ticketed, and the
  entry is confirmed. While an offline payment is outstanding it shows
  "🎟 Your ticket will be available once the club records your payment" with no button — see
  [G11](#g11--event-ticketing-is-in-scope).

---

### C3 — Booking detail

![C3 — Booking detail](images/account-user/C3-booking-detail.svg)

The cancellation rule reuses the existing `cancellationValidator.ts` from `orgadmin-calendar`,
which is exactly the sort of logic that should move to `packages/components` rather than being
reimplemented (§1.5).

---

### C4 — My Memberships

**Route:** `/account/:orgCode/memberships`

![C4 — My Memberships](images/account-user/C4-my-memberships.svg)

**Renew button logic** — the brief's rule, made explicit:

```
show Renew  ⟺  status = active
            ∧  valid_until − today ≤ 30 days
            ∧  ∃ a membership type for the following period that is
               open for applications and available to this member
```

If the first two hold but the third does not, show "Renewals for 2026 are not open yet" instead of a
button that leads nowhere.

**Notes**
- **Each card is headed by the member's name**, with the membership type as a subtitle beneath it.
  A membership belongs to a *person*, and the person signed in is not always that person: a parent
  holds their children's memberships, and those children may have no login at all. Headed by the
  type, a parent holding three sees three cards reading "Junior Member" that differ only by a
  membership number they have no reason to recognise. The type still leads when no name is
  recorded — a card headed by nothing would be worse.
- The same applies to the membership card on [B3](#b3--home--my-dashboard), which is about the
  membership expiring **soonest**. It names whom that membership is for, and adds "1 of 4
  memberships" when there are others, so it does not read as the whole story.

---

### C5 — Membership detail + renew

![C5 — Membership detail + renew](images/account-user/C5-membership-detail-renew.svg)

---

### C6 / C7 — My Registrations, Registration detail

Structurally identical to C4/C5 with membership vocabulary replaced. Registrations have no
member-number concept and typically no group of people, so the "People" panel is absent and the
renewal panel keys off the registration type's period rather than `valid_until` where the type is
period-based.

![C6 / C7 — My Registrations, Registration detail](images/account-user/C6-C7-my-registrations-registration-detail.svg)

---

### C8 — My Orders (merchandise)

![C8 — My Orders (merchandise)](images/account-user/C8-my-orders-merchandise.svg)

Status steps come from `merchandise_orders` and the existing `OrderStatusUpdateDialog` vocabulary.

---

### C9 — My Tickets

**Route:** `/account/:orgCode/tickets` · **Capability:** `event-ticketing`

![C9 — My Tickets](images/account-user/C9-my-tickets.svg)

**Notes**
- Grouped by event date, soonest first — at a gate, the ticket you want is almost always the next one.
- Four ticket states: **Valid**, **Awaiting payment** (entry confirmed only once the offline payment
  is recorded), **Used** (a scan exists in `ticket_scan_history`), **Expired** (past the config's
  validity period).
- A user holding tickets for several people sees one row each, with the entrant's name prominent —
  a parent at a gate needs to hand over the right one.

---

### C10 — Ticket ✳

**Route:** `/account/:orgCode/tickets/:id`

Rendered from `event_ticketing_config` — header text, instructions, footer, logo and background
colour are all the org's. The layout below is the frame; the content is configuration.

![C10 — Ticket ✳](images/account-user/C10-ticket.svg)

**Notes**
- **Screen brightness is raised automatically** while a ticket is open and restored on exit. Gate
  scanners fail on dim phone screens, and this is the single cheapest thing that makes scanning work
  in daylight.
- **Fully offline.** The QR payload, the config and the entrant details are precached for every
  valid ticket for an event in the next 30 days. No network call renders this screen.
- Used and expired tickets render the same frame with the QR greyed and a clear banner — "Used
  14 Mar 2026, 09:52". Never hide a used ticket; a member who scanned in and out needs to see why it
  will not scan again.
- Apple/Google Wallet passes are a nice-to-have, not v1 — they need pass-type certificates per
  organisation, which is real operational work. Shown here so the layout allows for them.
- PDF generation reuses `services/ticketGeneration.ts`, moved to `packages/components`.

---

## D. Browse and apply

### D0 — Application form step (shared) ✳

**The single most reused screen in the app.** Every one of D3, D6, D8, D10, D13 ends here, so it is
specified once and parameterised. It should be built in `packages/components` so the org-admin form
preview and this renderer are the same code.

![D0 — Application form step (shared) ✳](images/account-user/D0-application-form-step-shared.svg)

**Notes**
- **The two-button pattern is the brief's requirement**: when the source item supports both an
  offline and a card method, both buttons show. When it supports one, a single
  "Add to cart" button shows and the method is implicit. When it supports two *card* methods
  (Stripe and Helix-Pay), the choice is the org's, not the user's — a single "Pay By Card" button.
- The method chosen here is only a default; it is changeable in the cart (E3), as required.
- "Who is this entry for?" ([Q7](#part-6--decisions-taken)) — entering on behalf of a child is the
  overwhelmingly common case for a pony club or junior tennis section, and without it the entrant's
  details have to be retyped every time. The list is the people on the user's active membership,
  plus "someone else", which falls back to free entry of the entrant's details.
- Field rendering reuses `FieldRenderer` and its existing renderers; wizard steps reuse
  `MetadataWizard` / `WizardConfiguration`, which `application_forms` already supports via
  `form_groups_wizard_config`. The builder's datatypes and options are translated for the renderers
  by `applicationFieldToFieldDefinition` in `packages/components` — shared with the org-admin
  preview, which is what makes "the same code" above literally true. Skipping it renders every
  choice field as a text box (`docs/APPLICATION_FORM_FIELD_TYPES.md`).
- On mobile the fee panel and buttons become a sticky bottom bar.

---

### D1 — Events list

![D1 — Events list](images/account-user/D1-events-list.svg)

The four availability states — open / filling / not yet open / closed — are server-computed
([G8](#g8--eligibility-rules-need-a-server-side-answer)) and colour-coded consistently everywhere
they appear.

**Notes**
- Events render **collapsed**. A club with three is fine either way; one with eighteen becomes a
  wall of activities, and the dates — the thing an events list is actually scanned for — get pushed
  apart by screenfuls. Collapsed the page is a programme; expanded it is a catalogue.
- **`/:orgCode/browse/events/:eventId` is the same screen showing one event**, drawn as a card
  rather than an accordion: the date, the entry status, the description and every activity with its
  entry button. It is where a teaser points — the home page's "Upcoming events", and anything else
  that names one event — because a member arriving from one has already chosen, and landing them on
  the collapsed programme makes them choose again. It carries an "All events" link back, since
  there is usually nothing useful behind it in the member's history.
- An event id that is no longer in the catalogue says so and offers the list. A teaser can outlive
  the event it points at, and a link from a month-old notification is the ordinary way to arrive.
- **Each activity shows its description** under its name, above the fee — "Grade 1 — 80cm" then
  "Introductory round for newer combinations." A club's class names are shorthand, and this is the
  screen where the choice between four of them is made; the entry page (D7) and the public event
  page have always shown it, so the browse row was the only place it was dropped. The fee and the
  places count keep a line of their own beneath it: they are what the row is scanned for.
- `?event={id}` on the list is a different thing and stays: it expands that row in place and scrolls
  to it, which is what the public event pages link to and what a member is returned to after signing
  in.

---

### D2 — Event detail

![D2 — Event detail](images/account-user/D2-event-detail.svg)

**Notes** — the four disable reasons required by the brief, each with its own message:

| Condition | Button | Message |
|---|---|---|
| `now < event.open_date_entries` or activity's own open date | disabled | "Entries open *date*" |
| `now > event.entries_closing_date` | disabled | "Entries closed on *date*" |
| event-level limit reached | disabled on **all** activities | "This event is full" |
| `applicants_limit` reached for the activity | disabled on that one | "This class is full" |

Never hide the activity — a hidden class reads as a bug to a member who knows it exists.

---

### D3 — Enter an activity

D0 with the event/activity's application form, terms and fee. No separate wireframe.

---

### D4 / D5 — Membership types

![D4 / D5 — Membership types](images/account-user/D4-D5-membership-types.svg)

The detail screen (D5) expands one card: full description, benefits, what the application asks for,
who it is available to, and the same Apply/Renew actions.

---

### D6 — Membership application / renewal ✳

The renewal variant of D0. The distinction the brief calls for — "much of the required information
is already available… the application form can be auto populated and then only needs to be
confirmed" — is expressed as a review-first layout:

![D6 — Membership application / renewal ✳](images/account-user/D6-membership-application-renewal.svg)

**Notes**
- Three field categories, visually separated: **carried over** (collapsed, editable), **needs
  attention** (prior answer exists but is stale/expiring, or the field is new since last year), and
  **cannot be carried over** (fails current validation — surfaces as a normal required field).
- A *new* application uses the plain D0 layout with nothing pre-filled beyond the user's own contact
  details.
- Group membership types drive the "People" panel from `PersonConfigurationSection`'s configuration;
  single types omit it.

---

### D7 / D8 — Registration types

Same shape as D4/D5. Cards show the registration period, fee, and available-to rules; the detail
screen adds the description and the Apply action, which routes to D0.

---

### D9 — Merchandise list

![D9 — Merchandise list](images/account-user/D9-merchandise-list.svg)

Mobile: two columns at `xs`, four at `md`.

---

### D10 — Merchandise detail

![D10 — Merchandise detail](images/account-user/D10-merchandise-detail.svg)

Pricing display comes from the server, computed by the same rules as
`orgadmin-merchandise/utils/priceCalculator.ts` — which should move to `packages/components` so the
two front ends cannot drift.

---

### D11 — Calendars list

![D11 — Calendars list](images/account-user/D11-calendars-list.svg)

---

### D12 — Calendar availability ✳

The one screen where desktop and mobile genuinely need different structures.

![D12 — Calendar availability ✳](images/account-user/D12-calendar-availability.svg)

**Notes**
- Availability is derived, never stored — `slotAvailabilityCalculator.ts` is the authority and must
  run server-side for the account app (the org-admin version runs client-side over a full data set
  that an account user must not receive).
- Contiguous selected slots collapse into one cart item ("10:00–12:00, 2 hours") when the calendar's
  duration options allow it; otherwise they become separate items.
- Selection places a soft hold (`cart_items.expires_at`) so the form in D13 does not lose the slot.

---

### D13 — Slot booking form

D0 with the calendar's application form, preceded by a fixed summary of the chosen slots.

---

## E. Cart and checkout

### E1 — Cart (desktop)

**Route:** `/account/:orgCode/cart` · **API:** `GET /api/account/cart`

The worked example from [Part 4](#part-4--cart-arithmetic) — a deliberately mixed cart.

![E1 — Cart (desktop)](images/account-user/E1-cart-desktop.svg)

**Notes**
- **"(plus handling fee)"** appears exactly where the brief specifies: on a card item whose
  `handling_fee_included = false`. The €45.00 entry shows no such note because its handling fee is
  already inside the €45.
- **"[ Change ]"** appears only on items whose source declared more than one usable payment method.
- The summary shows the three-block breakdown because the cart is mixed. The
  [display rules](#45-display-rules) below collapse it to a single total when it is not.
- Item-level warnings (an event closing, a held slot expiring, an item that has since sold out)
  appear inline and again on E4 — the cart is re-validated on load and on checkout.

---

### E2 — Cart (mobile) ✳

![E2 — Cart (mobile) ✳](images/account-user/E2-cart-mobile.svg)

---

### E3 — Change payment method

![E3 — Change payment method](images/account-user/E3-change-payment-method.svg)

**Notes**
- Each option shows the **resulting order total**, not a per-item handling fee. Once the fee formula
  has a fixed element ([G5](#g5--handling-fees-are-configured-per-organisation-type)), per-item fees
  are not additive — moving this €12.00 booking to card adds only **€0.22** here, because the fixed
  €0.25 is already being charged for the merchandise item. Standalone, the same booking would carry
  €0.53. Quoting either number as "the handling fee for this item" would be wrong, and quoting
  nothing would leave the member guessing. The order total is the honest figure, and the one they
  actually care about.
- Both figures move, because switching an item between offline and card changes what is collected
  now as well as the total.
- Only methods the source item actually supports are listed; a method whose org credentials are
  missing or inactive is hidden.

---

### E4 — Checkout review

![E4 — Checkout review](images/account-user/E4-checkout-review.svg)

**Notes**
- The button says what will actually be charged to the card **now** (€108.45), not the order total
  (€288.45) — this is precisely the requirement that "only that part of the cart total that is Pay
  By Card based needs to be collected, plus any calculated handling fee".
- If every item is offline the button becomes "Confirm order" and no provider is involved.
- The offline instructions come from the source item's `cheque_payment_instructions` (which exists
  on `event_activities` today) falling back to an org-level default; where items give different
  instructions, all distinct sets are listed.
- Totals are re-computed server-side on submit. If anything changed since the cart was loaded — a
  place taken, a held slot expired, a fee changed — checkout stops and returns to a re-validated
  cart with the change explained. Never silently charge a different amount.

---

### E5 — Card payment

Two implementations behind one screen, chosen by which method the org has active.

![E5 — Card payment](images/account-user/E5-card-payment.svg)

**Implementation notes**
- Stripe: `POST /api/account/checkout` creates a **PaymentIntent** server-side for the card portion
  only, returns the client secret, and the browser confirms it. The order is created from the
  **webhook** (`payment_intent.succeeded`), never from the browser's success callback — a closed tab
  must not lose the order. Idempotency key = cart id.
- Helix-Pay: same server-side shape, hosted redirect + webhook confirmation, returning to
  `/account/:orgCode/checkout/confirmation/:paymentId`.
- 3-D Secure / SCA is handled by the provider's own step-up; the confirmation screen must tolerate
  a "processing" state that resolves asynchronously.

---

### E6 / E7 — Confirmation

![E6 / E7 — Confirmation](images/account-user/E6-E7-confirmation.svg)

A mixed cart produces **one** payment record with both portions, as shown in the card variant.

---

### E8 — Payment failed

![E8 — Payment failed](images/account-user/E8-payment-failed.svg)

Provider decline codes map to plain-language reasons; the raw code goes to the log, not the screen.
Held items keep their hold for a grace period after a failure.

---

## F. Payments history

### F1 — My Payments

**Route:** `/account/:orgCode/payments`

![F1 — My Payments](images/account-user/F1-my-payments.svg)

Sortable on every column, searchable across reference and item descriptions, filterable by method,
status and date range — as the brief requires. Available offline, read-only (see
[Part 5](#part-5--pwa-and-offline-behaviour)).

---

### F2 — Payment detail

![F2 — Payment detail](images/account-user/F2-payment-detail.svg)

This is the screen that `payment_transactions` exists for
([G3](#g3--payments-cannot-represent-a-multi-item-basket)) — it cannot be built on today's schema.

---

### F3 — Transaction detail

![F3 — Transaction detail](images/account-user/F3-transaction-detail.svg)

"All of the information provided in the original order for that specific item" — the stored
`form_submissions` row rendered against the form definition captured at submission time.

---

## P. Profile

### P1 — Profile & Settings

![P1 — Profile & Settings](images/account-user/P1-profile-settings.svg)

**Notes**
- Name/mobile/email write to **both** Keycloak (the identity) and `organization_users` (the org's
  copy). Email changes need verification before the sign-in address moves — otherwise a typo locks
  the user out.
- These details are shared across every organisation the user belongs to, since there is one
  identity. That should be said on the screen; a user who changes their mobile for the tennis club
  will change it for the pony club too.
- Language preference: per user, overriding the org default; the org default remains the fallback.

### P2 — Change password

Redirect to the Keycloak account console with a return URL, exactly as the brief assumes. A brief
interstitial explains where the user is going and that they will come back.

---

## H. PWA and offline

### H1 — Offline mode

![H1 — Offline mode](images/account-user/H1-offline-mode.svg)

The banner is persistent, dismissible only to a compact chip, and coloured distinctly from success
and error states.

### H2 — Offline-blocked action

![H2 — Offline-blocked action](images/account-user/H2-offline-blocked-action.svg)

### H3 — Install prompt

![H3 — Install prompt](images/account-user/H3-install-prompt.svg)

Shown once, after a successful checkout or on the third visit — never on first load.

---

## I. Org-admin additions

These belong in the **existing** org-admin app, under Payments
(`packages/orgadmin-core/src/payments`), as a second menu item beside the current list.

### I1 — Offline Payments

**Route:** `/orgadmin/payments/offline`

![I1 — Offline Payments](images/account-user/I1-offline-payments.svg)

### I2 — Mark received / undo

![I2 — Mark received / undo](images/account-user/I2-mark-received-undo.svg)

**Notes**
- Recording who and when is a requirement: `payments.offline_received_at` and
  `offline_received_by`. Undo must not erase that history — write both actions to
  `organization_audit_log` and keep the trail, clearing only the current-state columns.
- Marking received is what confirms the underlying items (membership active, entry confirmed,
  booking confirmed, order released) — the same state transition a successful card payment triggers.
  That transition should be **one** service method with two callers, not two implementations.
- Where a payment is partly card and partly offline, only the offline portion is affected; the card
  portion is already settled.
- Marking an offline payment received is also what **issues electronic tickets** for any ticketed
  entries in it ([G11](#g11--event-ticketing-is-in-scope)) — the same transition, one service method.

---

### I3 — Org admin: Pending registrations

**Route:** `/orgadmin/users/accounts/pending` · Shown only when auto-registration is **off**.

![I3 — Org admin: Pending registrations](images/account-user/I3-org-admin-pending-registrations.svg)

**Notes**
- The **Verified** column is the crux of the two-gate model
  ([G6](#g6--auto-registration-is-an-org-admin-setting)): Keycloak email verification and club
  approval are independent, and an admin needs to see both. Approving someone who has not verified
  is allowed — they simply get in once they do.
- Approve → `organization_users.status = 'active'` + approval email. Reject → `'rejected'` + a
  neutral email. Both write to `organization_audit_log` with the acting admin and timestamp.
- The rejection dialog takes an internal note. It is **not** shown to the applicant
  ([A8](#a8--awaiting-approval)).
- A pending count badge belongs on the Users menu item — an approval queue nobody looks at is worse
  than no queue, because the member is left waiting on A8 indefinitely.

---

### I4 — Org admin: Registration settings

A new block in **Settings**, alongside Organisation Details and Payment Settings.

![I4 — Org admin: Registration settings](images/account-user/I4-org-admin-registration-settings.svg)

**Notes**
- Stored at `organizations.settings.registration` — **merged** into the JSONB, never replacing it.
  A wholesale write here would destroy branding, payment settings and email templates.
- Switching from OFF to ON does **not** retroactively approve the existing pending queue. That has
  to be a deliberate act, so the toggle offers it as a separate confirmation: "Approve the 4 people
  currently waiting as well?"
- The portal address is surfaced here because this is where an admin is thinking about how members
  get in — it is the `url_code` from [G2](#g2--organisations-have-no-url-friendly-short-code).

---

## J. Super-admin additions

### J1 — Super admin: Handling fees on an organisation type

Added to `CreateOrganizationTypePage` and `EditOrganizationTypePage` in `packages/admin`.

![J1 — Super admin: Handling fees on an organisation type](images/account-user/J1-super-admin-handling-fees-on-an-organisation-type.svg)

**Edit-mode variant** carries one extra warning, because the blast radius is large:

![J1 — Super admin: Handling fees on an organisation type](images/account-user/J1-super-admin-handling-fees-on-an-organisation-type-2.svg)

**Notes**
- **The live example under each method is the point of the screen.** Three abstract numbers are hard
  to reason about; a worked figure that updates as you type makes a fat-fingered `15.000` instead of
  `1.500` obvious immediately.
- Defaults come from `payment_methods.default_fee_config`, so "Reset to default" is meaningful and
  the platform's notion of Stripe's going rate can be updated without a release
  ([G5](#g5--handling-fees-are-configured-per-organisation-type)).
- Only methods classified as card methods get a card here. The list is driven by the same name-based
  classification the rest of the platform uses.
- Validation: fixed ≥ 0, percentage 0–100, tax 0–100. Tax of exactly 0 is valid and expected —
  the form must not treat it as "not filled in".
- The fixed fee's currency symbol is the **type's** currency, set above in Details, and every
  organisation of the type inherits it ([G12](#g12--an-organisations-currency-must-match-its-types)).
  Changing the type's currency once it has organisations is blocked.
- `packages/admin` is not internationalised, so this screen needs no locale keys.

---

# Part 4 — Cart arithmetic

The rules, then the worked example, then what to display.

## 4.1 Per-item inputs

| Field | Source |
|---|---|
| `fee` | The source item's fee × quantity, minus any discount |
| `paymentMethod` | The user's choice, constrained by the source item's `supported_payment_methods` |
| `handlingFeeIncluded` | Snapshot from the source item at add-to-cart time |
| `isCard` | `paymentMethod.name` contains `card`, `stripe` or `helix` — the platform's existing name-based classification |

## 4.2 Fee configuration inputs

Resolved from the organisation's **type**, per card payment method
([G5](#g5--handling-fees-are-configured-per-organisation-type)):

| Field | Example |
|---|---|
| `fixedFee` | €0.25 |
| `percentageFee` | 1.5% |
| `taxPercentage` | 23% (may be 0) |

## 4.3 Totals

```
offlineSubtotal   = Σ item.fee                       where ¬isCard
cardSubtotal      = Σ item.fee                       where  isCard
feeBearingBase    = Σ item.fee                       where  isCard ∧ ¬handlingFeeIncluded

netHandlingFee    = fixedFee + (percentageFee × feeBearingBase)      if feeBearingBase > 0
                  = 0                                                otherwise
handlingTax       = taxPercentage × netHandlingFee
handlingFee       = netHandlingFee + handlingTax

chargedToCardNow  = cardSubtotal + handlingFee
orderTotal        = offlineSubtotal + chargedToCardNow
```

Four rules this encodes, each of which is easy to get wrong:

1. **`feeBearingBase`, not `cardSubtotal`, drives the percentage.** Items whose fee already absorbs
   the handling fee are excluded — charging on them bills the member twice.
2. **The fixed element is charged once per payment, not once per item**
   ([N2](#part-6--decisions-taken)). The provider charges the organisation once per transaction, and
   one checkout produces one card charge. Four fee-bearing items in a cart still attract one €0.25.
3. **No fee-bearing items means no fee at all** — including no fixed element. A cart of entirely
   fee-included card items must not be handed a stray €0.25.
4. **Tax applies to the handling fee, not to the order** ([N1](#part-6--decisions-taken)).
   `taxPercentage` is a tax on the service charge the organisation is levying, so it multiplies
   `netHandlingFee` — never `cardSubtotal`. Setting it to 0 removes the element entirely, as
   required.

Where a cart mixes two card providers the whole calculation runs per provider and the results are
summed; the summary still shows one "Card handling fee" line, and the fixed element is charged once
per provider because that is how many transactions there are.

## 4.4 Allocating the fee back to individual transactions

`payment_transactions` records a `handling_fee` per line ([F2](#f2--payment-detail) shows them), but
the fee is computed on the aggregate. Allocate **pro rata by fee-bearing amount**, giving the last
line the rounding remainder so the parts always sum to the whole:

```
booking  12.00 / 62.00 × 1.45 = 0.2806 → €0.28
polo     remainder            = 1.45 − 0.28 → €1.17
                                              ─────
                                              €1.45  ✓
```

Never re-derive a line's fee from the rate — that reintroduces the fixed element per line and the
parts stop summing to the total.

## 4.5 Display rules

Straight from the brief:

| Cart composition | Summary shows |
|---|---|
| All offline | One total |
| All card, all `handlingFeeIncluded` | One total |
| All card, some not included | Card subtotal, handling fee, tax on it (if non-zero), total |
| Mixed offline + card | Offline subtotal, card subtotal, handling fee (if any), tax (if non-zero), order total, and a note that the offline portion is paid to the club |

Per line: `handlingFeeIncluded = false` **and** card → append "(plus handling fee)". Never on an
offline line, never when the fee is included.

The tax line is **suppressed entirely when `taxPercentage` is 0** rather than shown as €0.00 — a
zero-tax organisation type should produce a summary with no trace of tax in it.

## 4.6 Worked example (the cart in E1)

| # | Item | Fee | Method | Handling included? |
|---|---|---|---|---|
| 1 | Event entry — Class 2, Sarah Adams | €45.00 | Card | **Yes** |
| 2 | Family Membership 2026 | €180.00 | Offline | n/a |
| 3 | Court 1, Sat 14 Mar 10:00–11:00 | €12.00 | Card | No |
| 4 | Club Polo (Navy, M) × 2 | €50.00 | Card | No |

Organisation type "Pony Club", Stripe: fixed €0.25, percentage 1.5%, tax 23%
(illustrative values — the real ones are whatever the super admin sets in [J1](#j1--super-admin-handling-fees-on-an-organisation-type)):

```
offlineSubtotal  = 180.00
cardSubtotal     =  45.00 + 12.00 + 50.00         = 107.00
feeBearingBase   =          12.00 + 50.00         =  62.00    ← item 1 excluded

netHandlingFee   = 0.25 + (1.5% × 62.00)
                 = 0.25 + 0.93                    =   1.18
handlingTax      = 23% × 1.18 = 0.2714            =   0.27    ← rounded once, here
handlingFee      = 1.18 + 0.27                    =   1.45

chargedToCardNow = 107.00 + 1.45                  = 108.45    ← this is what goes to Stripe
orderTotal       = 180.00 + 108.45                = 288.45
```

The two traps this is designed to avoid:

- Charging the percentage on €107.00 (€1.61 + tax) rather than €62.00 — double-charging the member
  for item 1, whose €45.00 already absorbs its handling fee.
- Charging the €0.25 fixed element **twice**, once for the booking and once for the polo shirt.
  There is one card transaction, so there is one fixed element.

## 4.7 Rounding, currency and integrity

- Store and compute in **integer minor units** (cents), format for display only. Decimal arithmetic
  in JavaScript floats will produce off-by-a-cent totals on a cart this shape.
- One currency per cart, taken from the organisation. Two orgs' items can never share a cart —
  another reason carts are org-scoped.
- **Round twice, not more**: once when `netHandlingFee` is computed, once when `handlingTax` is
  computed. Rounding per line, or at every intermediate step, drifts by cents on a cart this shape.
- `fixedFee` is a currency amount, so it is meaningful only in a known currency. It is stored in the
  **organisation type's** currency and inherited by that type's organisations. Per
  [N3](#part-6--decisions-taken), an organisation must therefore share its type's currency — see
  [G12](#g12--an-organisations-currency-must-match-its-types) for what that constrains.
- The **fee configuration in force is snapshotted onto the payment** at checkout
  (`payments.fee_config_snapshot jsonb`). A super admin changing an organisation type's rates must
  not retroactively change what a historical receipt says.
- The server returns every figure above; the client renders them. If the client ever needs to
  recompute, that is a bug.

---

# Part 5 — PWA and offline behaviour

| Area | Offline | Notes |
|---|---|---|
| Home | ✅ Read-only, cached | Actions disabled with H2 |
| My Entries & Bookings | ✅ Read-only | Including detail and stored answers |
| My Memberships / Registrations / Orders | ✅ Read-only | Renew button → H2 |
| **My Tickets / a ticket** | ✅ **Fully functional** | The strongest offline case in the app — see below |
| My Payments | ✅ Read-only | The brief's explicit requirement |
| Events / Memberships / Merchandise / Registrations browsing | ✅ Last-fetched list and detail, marked stale | Availability may be out of date — say so |
| Calendar availability | ⚠ Cached grid, visibly stale | Never allow selection offline |
| Application forms | ❌ | Form definitions cached, submission blocked |
| Cart | ⚠ View cached contents; no add/remove/change | Mutations require the server |
| Checkout | ❌ | H2 |
| Profile | ⚠ View only | |

**Implementation**

- `vite-plugin-pwa` with Workbox; app shell precached, API responses cached stale-while-revalidate
  into IndexedDB keyed by `(orgCode, resource)`.
- Cached data is **per organisation and per user**, and must be cleared on sign-out and on org
  switch-away — a shared device must not leak one member's payment history to the next.
- Every cached screen shows its `lastSynced` time. Stale data presented as current is worse than no
  data.
- No background sync of mutations. Queuing an event entry made offline and replaying it later would
  hand a member a place that was taken hours earlier; the honest answer is H2.
- Service-worker updates prompt rather than reload silently — a silent reload mid-checkout would be
  destructive.

**Tickets are the exception that justifies the PWA.** Everything else degrades to read-only
gracefully; a ticket has to *work*. Rural showgrounds, sailing clubs and pitches are exactly where
mobile coverage fails, and a member standing at a gate with a spinner has a broken product.

- Every valid ticket for an event within the next 30 days is precached — QR payload, ticket config,
  entrant details, event details — on every successful sync.
- The QR payload is generated and signed **server-side at issue time** and stored, not derived at
  render time. A client that cannot reach the server must still produce a scannable code.
- [C10](#c10--ticket-) makes no network call at all, online or offline. It reads the cache in both
  cases, so the offline path is the path that is exercised every time and cannot rot.
- Scan state (used/unused) is the one thing that may be stale offline. The gate scanner is the
  authority; the member's copy is a display. Show the last-synced time on the ticket and never let
  a cached "Valid" contradict a scanner.

---

# Part 6 — Decisions taken

Answered 13 February 2026. Everything above reflects these.

| # | Question | Decision | Where it lands |
|---|---|---|---|
| **Q1** | Landing directory **and** short-code URLs, or only one? | **Both** | [A1](#a1--organisation-directory), [A2](#a2--organisation-gateway), [G2](#g2--organisations-have-no-url-friendly-short-code) |
| **Q2** | Confirm the new cart/payment schema | **Proceed** — `carts`, `cart_items`, `payment_transactions`, plus additions to `payments`. Existing single-context payments keep working | [G3](#g3--payments-cannot-represent-a-multi-item-basket) |
| **Q3** | Where does the handling-fee rate live, and what shape is it? | **Super admin configures it per organisation type, per card payment method.** Three elements: fixed amount, percentage of the card charge, and a tax percentage (0 = no tax). Stripe and Helix-Pay defaults are pre-filled on the create page. All organisations inherit from their type; no per-org override | [G5](#g5--handling-fees-are-configured-per-organisation-type), [J1](#j1--super-admin-handling-fees-on-an-organisation-type), [Part 4](#part-4--cart-arithmetic) |
| **Q4** | Immediate access on registration, or admin approval? | **Org-admin toggle.** Auto-registration ON → access once the email is verified. OFF → the user verifies their email and can sign in, but sees "awaiting approval" until an admin approves | [G6](#g6--auto-registration-is-an-org-admin-setting), [A8](#a8--awaiting-approval), [I3](#i3--org-admin-pending-registrations), [I4](#i4--org-admin-registration-settings) |
| **Q5** | Can an org stay out of the public directory but remain reachable by code? | **Yes** — `settings.listedInDirectory`, default true | [A1](#a1--organisation-directory) |
| **Q6** | Self-cancellation? | **Bookings yes**, via the existing `cancellationValidator`. Entries, memberships, registrations and orders **no** | [C2](#c2--entry-detail), [C3](#c3--booking-detail) |
| **Q7** | Apply on behalf of another person? | **Yes** | [D0](#d0--application-form-step-shared-) |
| **Q8** | Discounts in the account UI? | **Yes** — automatic discounts shown per line at application and in the cart, plus a discount-code box | [D0](#d0--application-form-step-shared-), [E1](#e1--cart-desktop) |
| **Q9** | Event ticketing? | **In scope** — My Tickets, a rendered offline-capable ticket, and automatic issuance on entry confirmation | [G11](#g11--event-ticketing-is-in-scope), [C9](#c9--my-tickets), [C10](#c10--ticket-) |
| **Q10** | Stripe embedded or hosted redirect? | **Embedded** Payment Element. Helix-Pay stays a hosted redirect | [E5](#e5--card-payment) |
| **Q11** | Six locales from day one? | **All six**, from day one | [G10](#g10--translations) |

Three follow-ups from Q3, confirmed the same day:

| # | Question | Decision | Where it lands |
|---|---|---|---|
| **N1** | Does the tax percentage apply to the handling fee, or to the whole card charge? | **To the handling fee.** €62.00 base → €1.18 fee → €0.27 tax. Applying 23% to the full €107.00 card charge would have added €24.61 | [§4.3](#43-totals) |
| **N2** | Is the fixed element charged once per payment, or once per fee-bearing item? | **Once per payment.** One checkout is one card transaction, and the provider charges the organisation once | [§4.3](#43-totals) |
| **N3** | An organisation's `currency` can differ from its type's, but `fixedFee` is a currency amount inherited from the type. Which wins? | **The organisation type's currency is authoritative.** An organisation must match its type's currency, enforced in the super-admin UI and the backend | [§4.7](#47-rounding-currency-and-integrity), [G5](#g5--handling-fees-are-configured-per-organisation-type) |

---

# Part 7 — Remaining questions

Three left, none of them blocking. Each has a stated assumption the document is built to; overriding
any of them is a contained change.

| # | Question | What I have assumed |
|---|---|---|
| **N4** | When exactly is a ticket issued for an entry paid **offline**? On entry, or when the club records payment? | On payment received. Otherwise a member can attend without paying, which defeats ticketing. The entry shows "your ticket will be available once the club records your payment" in the meantime |
| **N5** | Does an org admin need to see and act on a member's cart (abandoned-basket recovery, or adding an item for someone who phoned in)? | Out of scope for v1 |
| **N6** | Should approving a registration in [I3](#i3--org-admin-pending-registrations) also create a `members` record, or is club membership always a separate paid application? | Separate. Registration grants portal access; membership is a paid application through [D6](#d6--membership-application--renewal-) |

---

## Next steps

1. **Requirements document** — `docs/ACCOUNT_USER_APP_REQUIREMENTS.md`, incorporating Q1–Q11 and
   N1–N3, and resolving N4–N6.
2. **Design document** — `docs/ACCOUNT_USER_APP_DESIGN.md`: schema migrations, the
   `/api/public/*` and `/api/account/*` route inventories, the account-user auth middleware, the
   fee-resolution service, the cart/checkout state machine, ticket issuance, and the PWA caching
   policy.
3. **Task breakdown**, sequenced so the platform gaps land first:

   | Phase | Work |
   |---|---|
   | 1 | [G2](#g2--organisations-have-no-url-friendly-short-code) org `url_code` + super-admin field |
   | 2 | [G5](#g5--handling-fees-are-configured-per-organisation-type) fee config: migration, `payment_methods.default_fee_config`, [J1](#j1--super-admin-handling-fees-on-an-organisation-type), fee-resolution service, plus [G12](#g12--an-organisations-currency-must-match-its-types) currency backfill and constraint **— everything downstream needs a total** |
   | 3 | [G1](#g1--there-is-no-account-user-api-surface-at-all) `/api/public/*` + `/api/account/*` + account auth middleware |
   | 4 | [G3](#g3--payments-cannot-represent-a-multi-item-basket) + [G4](#g4--handling_fee_included-exists-only-on-event-activities) cart, transaction and handling-fee schema, plus the four org-admin type forms |
   | 5 | [G6](#g6--auto-registration-is-an-org-admin-setting) registration, approval and the org-admin screens [I3](#i3--org-admin-pending-registrations)/[I4](#i4--org-admin-registration-settings) |
   | 6 | `account-shell` — auth, org resolution and switching, branding, layout, routing, six locale files |
   | 7 | **One vertical slice end to end: memberships.** It exercises application forms, renewal pre-population, the cart, both payment paths, offline payments ([I1](#i1--offline-payments)/[I2](#i2--mark-received--undo)) and confirmation — everything the rest of the modules then repeat |
   | 8 | Events → ticketing → calendar → merchandise → registrations |
   | 9 | Payments history, profile |
   | 10 | PWA and offline, with tickets as the first-class case |

   Phase 2 before phase 4 is deliberate: the cart cannot render a line, let alone a total, until the
   fee configuration exists and can be resolved.
