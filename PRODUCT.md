# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary — the club administrator.** A volunteer or part-time staff member at a club or membership
organisation, working in `orgadmin-shell` at `/orgadmin`. They configure the organisation and then
run it day to day: opening events for entry, approving registrations, issuing memberships, taking
payments, chasing what has not been paid, pulling a report before a committee meeting. They are the
buyer and the daily operator, and their success defines the product. They are usually not technical,
often doing this alongside another job, and frequently working in short bursts rather than a
sustained session.

**Secondary — the club member.** The person who joins, enters events, renews, buys from the shop,
books a facility and holds a ticket, working in `account-shell` at `/account/:orgCode`. A real
audience with a real surface, but their app exists to serve what the administrator has set up.

**Also present — the platform super admin.** Esker staff operating `admin`: organisations,
organisation types, payment methods, handling-fee rates. Internal, not a customer audience.

## Product Purpose

Its Plain Sailing is a multi-tenant SaaS platform for clubs and membership organisations. One
organisation record carries events and entries, memberships, a merchandise shop, facility bookings,
registrations, ticketing and the payments that run through all of them, so a club stops operating
out of several disconnected tools and a spreadsheet.

Success is a club that configures itself without help and then runs a full season inside the
product — where the administrator's recurring work takes minutes rather than an evening, and the
member never has to email the club to ask what they have paid for.

## Positioning

Four claims, all confirmed, that a neighbouring club-management product could not truthfully copy in
combination:

- **One system, not five.** Entries, memberships, shop, facility bookings, ticketing and payments
  live in a single organisation record with a shared payment, discount and application-form
  subsystem — not separate products bridged by exports.
- **Runs without an IT person.** The club builds its own application forms, enables its own
  capabilities, sets its own discounts and connects its own payment provider. There is no
  implementation project and no developer in the loop.
- **Each club's own branded app.** Per-club primary colour and a URL short code (`/account/khpc`)
  give the member a club-branded PWA rather than a vendor portal with a club logo in the corner.
- **Multi-country from day one.** Six locales; currency fixed per organisation type; card handling
  fees configured per organisation type and per payment method, in that type's currency.

## Operating Context

- **The administrator's session is interrupted.** Work happens in gaps — evenings, between other
  jobs, on a laptop at the club. Long uninterrupted configuration sessions are the exception.
- **Capability-shaped installs.** No two organisations see the same product. Capabilities are per
  organisation and gate backend routes, module availability, and individual routes and menu items
  simultaneously. A club with only `memberships` and one with all seven modules are both normal.
- **The member is often on a phone, often on bad signal.** `account-shell` is a PWA that works
  offline: the last server answer is cached per member and URL, screens declare how stale their data
  is, and server-dependent actions disable when the device is offline.
- **A club's public link is its front door.** `/account/:orgCode` must work for an anonymous
  visitor — the member app deliberately uses Keycloak `check-sso`, not `login-required`, so a club
  can hand out one link to members and non-members alike.
- **Money is real and audited.** Card handling fees, Stripe Connect application fees, refunds,
  lodgements and offline payment settlement are all live product surface, not future work.
- **Seasonal rhythm.** Membership renewal and event-entry opening produce sharp load and support
  peaks; most of the year is quieter.

## Capabilities and Constraints

**Shipped functional areas.** Org-admin core (Form Builder, Settings, Payments, Reports &
Analytics, Users) is always on. Seven capability-gated modules: events, memberships, merchandise,
calendar bookings, registrations, ticketing, plus the cross-cutting discounts subsystem. The member
app covers directory and gateway, registration and approval, entries, memberships, tickets,
merchandise and orders, bookings, registrations, payments, profile and dashboard.

**Terminology that must stay consistent.**

| Term | Means |
|---|---|
| Organisation type | Top-level customer boundary; fixes currency, locale, default capabilities and fee rates |
| Organisation | A club/association of a given organisation type; almost every business record is scoped to one |
| Organisation type | Groups organisations; fixes currency and handling-fee rates |
| Capability | Per-organisation feature flag gating backend, module, route and menu |
| Org admin / account user | The two `user_type` values; an account user fails the org-admin lookup by design |
| `url_code` | The organisation's URL-friendly short code, e.g. `khpc` |
| Entry | A member's place in an event | 
| Registration | Expression of interest ahead of a membership or programme |
| Connecting to a club | Linking an existing account to an organisation — **not** the same as buying a membership |

**Durable constraints.**

- Six locales — `en-GB`, `de-DE`, `es-ES`, `fr-FR`, `it-IT`, `pt-PT` — and every user-facing string
  is an i18n key present in all six. No hard-coded English, ever. Layouts must survive German and
  Portuguese string lengths.
- Per-club branding is a single primary colour plus a logo. Any design must stay legible across an
  arbitrary club-chosen hue, and must fall back gracefully when the value is missing or malformed.
- The member app must render usefully offline and must say when what it is showing is stale.
- The org-admin front end adapts to the existing backend rather than expanding it when the two
  disagree.
- Currency and handling-fee arithmetic are centralised; a design must never imply a per-organisation
  currency choice, because currency follows organisation type.

**Undecided / not established.**

- No confirmed accessibility standard. Several wireframe documents assert "WCAG AA compliant
  contrast ratios" as an intent, but no target has been agreed with a customer or verified by audit.
- Pricing, licensing, customer names, adoption numbers and case studies are not recorded anywhere in
  this repository. Future work must not invent them.

## Brand Commitments

- **The public name is "Its Plain Sailing."** It appears in code, docs, environment config and
  Keycloak themes as the compound `ItsPlainSailing`, and on the domain `itsplainsailing.com`.
- **The name means "it's easy," not "sailing."** The product is aimed at clubs and membership
  organisations of *any* sport or kind; sailing clubs are simply where the codebase's examples came
  from. The promise the name makes is *effortlessness*, and that is what design should carry. No
  copy, illustration or metaphor may imply the platform is for sailing clubs — no "set sail," "on
  course," "all aboard," no anchors, ropes, compasses, portholes or navy-and-rope palettes.
- **The mark is a stylised sail, and it is confirmed.** Approved 13 August 2026. It is *the* one
  exception to the line above: the mark may read as a sail, the rest of the product may not lean on
  that reading. It is a small warm-palette form in the brand orange/gold at 56×64, and it is the
  same asset everywhere — `packages/admin/public/logo.png`, `packages/admin/public/favicon.png`, and
  the four Keycloak login themes under `infrastructure/keycloak/themes/*/login/resources/img/`.
  Treat it as settled, not as a placeholder awaiting a designed replacement.
- The repository names **Holism** (the working directory) and **"Application Framework"** (the root
  README, a stale scaffold heading) are internal artefacts, not product names. They must not surface
  in any user-facing string.
- `.claude/sessions.md` records the mark as an unresolved placeholder. That note is **superseded**;
  see the confirmation above.

## Evidence on Hand

**Real and usable:**

- 20 module summaries in [.claude/modules/](.claude/modules/) — the authoritative description of
  every package, route, service and convention.
- ~50 feature documents in [docs/](docs/), including per-module wireframe sets:
  [ACCOUNT_USER_APP_WIREFRAMES.md](docs/ACCOUNT_USER_APP_WIREFRAMES.md) (51 wireframes),
  [EVENTS_MODULE_WIREFRAMES.md](docs/EVENTS_MODULE_WIREFRAMES.md),
  [MEMBERSHIPS_MODULE_WIREFRAMES.md](docs/MEMBERSHIPS_MODULE_WIREFRAMES.md),
  [ORGANIZATION_MANAGEMENT_WIREFRAMES.md](docs/ORGANIZATION_MANAGEMENT_WIREFRAMES.md).
- A running system: Docker compose, Keycloak realm with four bespoke login themes, Postgres,
  Prometheus/Grafana, Terraform for staging and production.
- Six complete locale files at `packages/orgadmin-shell/src/locales/<locale>/translation.json`.
- A marketing site exists — [docs/WARM_THEME_IMPLEMENTATION.md](docs/WARM_THEME_IMPLEMENTATION.md)
  cites its design as the source of an in-app theme. Its URL and assets are not in this repository.

**Absent — do not fabricate:**

- No customer names, testimonials, quotes, adoption figures or case studies.
- No pricing or plan structure.
- No brand guidelines and no typographic or colour specification of record. The mark exists and is
  confirmed; what surrounds it is not written down.
- No usability testing, analytics or support data on how administrators actually use the product.

## Product Principles

1. **Effortless is the promise, and the name is the contract.** If a screen makes an unpaid
   volunteer feel like they need training, it has failed regardless of how it looks.
2. **The administrator's time is the scarce resource.** Optimise for the interrupted session:
   recoverable state, obvious next action, nothing that must be completed in one sitting.
3. **Design for a product that is never fully installed.** Capability gating means missing modules
   are the normal case. A layout that only reads well when everything is switched on is broken.
4. **The club is the brand; the platform is the plumbing.** In the member app, the club's identity
   leads. Platform identity earns its place in the administrator's tools, not in front of members.
5. **Never assert more certainty than the data has.** Offline caches, pending approvals, unsettled
   payments and stale figures must be visibly qualified rather than shown as fact.

## Accessibility & Inclusion

No product-specific standard has been agreed. Two requirements are nonetheless structural and hold
regardless: every string resolves through i18n across six locales, and per-club primary colours are
chosen by the club — so contrast must be computed against the resolved brand colour rather than
assumed from a fixed palette. Treat WCAG AA as the working floor and flag it as unconfirmed until a
customer or audit fixes the target.
