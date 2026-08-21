# `packages/backend` — Express API

The only server in the system. Every front end talks to it; it owns all persistence, Keycloak
administration, payments, email and file handling.

- **Stack:** Node + Express + TypeScript, `pg` (raw SQL, no ORM), `node-pg-migrate`, Keycloak,
  Swagger, Prometheus.
- **Dev:** `npm run dev:backend` (`tsx watch src/index.ts`) → `:3000`. Config from
  `packages/backend/.env`, already pointed at the Dockerised Postgres and Keycloak.
- **Tests:** Jest — `npm run test:backend`. ~103 test files under `src/**/__tests__`.
- **Migrations:** `npm run migrate:up --workspace=packages/backend` (45 files in `migrations/`).

## Layout

```
src/
  index.ts        App wiring: middleware order, every route mount, /health, /metrics, /api-docs
  routes/         One router per resource area (HTTP + validation only)
  services/       Business logic and SQL — the substance of the backend
  middleware/     Auth, capabilities, CSRF, rate limiting, XSS, validation, metrics, errors
  utils/          Pure helpers: handling-fee arithmetic, organisation URL codes,
                  payment-method classification
  config/         database, aws, secrets, logger, metrics, swagger
  database/       pool.ts, utils.ts, migrations helpers
  types/          Shared request/domain types
  __mocks__/      Jest mocks
migrations/       node-pg-migrate migrations (the schema's source of truth)
```

## Route mounts (`src/index.ts`)

| Prefix | Router |
|---|---|
| `/api/metadata` | `metadata.routes` |
| `/api/objects` | `generic-crud.routes` |
| `/api/admin` | `admin.routes` |
| `/api/admin/capabilities` | `capability.routes` |
| `/api/admin/payment-methods` | `payment-method.routes` |
| `/api/admin/organization-types` | `organization-type.routes` |
| `/api/admin/organizations` | `organization.routes`, `organization-payment-method.routes`, `organization-user.routes`, `organization-role.routes` |
| `/api/orgadmin` | `orgadmin-auth`, `event`, `event-type`, `venue`, `discount`, `membership`, `merchandise`, `calendar`, `registration`, `ticketing`, `application-form`, `payment`, `reporting` |
| `/api/orgadmin/organisation` | `orgadmin-organisation.routes` — payment settings, branding, email templates, registration settings, offline payment settlement and the account-user approval queue |
| `/api/orgadmin/files` | `file-upload.routes` |
| `/api/orgadmin/users` | `user-management.routes` |
| `/api/orgadmin` | `user-group.routes` — account-user groups, used by discount eligibility |
| `/api/user-preferences` | `user-preferences.routes` |
| `/api/public` | `public.routes` — **unauthenticated**, backs the account app's organisation directory and sign-in gateway, plus the email-change confirmation whose link is opened with no session |
| `/api/account` | `account.routes` — account-user application; the organisation comes from the URL, not the token |

Several routers share the `/api/orgadmin` prefix, so a path collision between two routers is
possible — check the mount order in `index.ts` when an endpoint appears not to fire.

## Services

Grouped by area; each is a class or object exported from `src/services`.

**Organisation & tenancy** — `organization.service`, `organization-type.service`,
`organization-type-payment-fee.service`,
`organization-user.service`, `organization-admin-role.service`,
`organization-payment-settings.service`, `organization-branding.service`,
`account-organisation.service`, `account-registration.service`, `cart.service`, `user-group.service`,
`organization-email-templates.service`, `org-payment-method-data.service`,
`org-admin-user.service`, `account-user.service`, `user.service`, `role.service`,
`user-preferences.service`.

**Identity** — `keycloak-admin.service`, `keycloak-admin.factory`, `keycloak-error-handler`.

**Domain** — `event.service`, `event-activity.service`, `event-entry.service`, `event-type.service`,
`venue.service`, `membership.service`, `membership-number-generator.service`,
`membership-number-validator.service`, `merchandise.service`, `merchandise-option.service`,
`registration.service`, `calendar.service`, `delivery-rule.service`, `ticketing.service`.

**Organisation type logos** — a type may set a shared logo that every organisation of that type
inherits, and may forbid replacing it. `effectiveLogo` in `organization-branding.service` is the one
place the rule lives: a **locked** type logo beats a club's own (or locking changes nothing for the
clubs it was meant to bring into line), then the club's own, then the type's as a default, then
nothing. The flag only bites once the type has a logo — otherwise it would leave every club unable
to have any. Enforced in `updateBrandingSettings`, not merely by hiding the upload. The branding read
carries derived `logoSource` / `canOverrideLogo`, never stored. See
[docs/ORGANISATION_TYPE_LOGO.md](../../docs/ORGANISATION_TYPE_LOGO.md).

**Platform posts** — `platform-post.service` holds the announcements shown on both login pages.
The public image URL carries a `?v=` token hashed from the S3 key, so replacing or removing a
picture changes the address — without it the same URL served different bytes and a removed image
stayed on screen until the browser's copy expired. The post list is `no-cache` (revalidated) rather
than held for a minute, because a stale announcements panel reads as a failed save.
Writes are `super-admin` only (`platform-post.routes`, mounted at `/api/admin/posts`); the two
anonymous reads live in `public.routes` with the rest of the no-token surface. The public read is
**sanitised in the service, not by its callers** — one caller is a Keycloak login theme with no
sanitiser of its own — while the admin read is deliberately raw so the editor round-trips. Link URLs
are restricted to http/https on write, because they become anchors on an anonymous page. A failing
public read answers `[]` with a 200: a login page must render whatever happens. See
[docs/PLATFORM_POSTS.md](../../docs/PLATFORM_POSTS.md).

⚠️ `__mocks__/isomorphic-dompurify.js` used to be an **identity function**, wired in through
`moduleNameMapper` — which silently disabled every sanitisation assertion in the repo, and which no
individual suite could opt out of (`moduleNameMapper` intercepts `jest.requireActual` too). It now
delegates to the real DOMPurify; making it honest broke nothing.

**Who an entry is for** — `entrant.service` backs the name field every event entry form opens with.
Scope (this club's roster, or every club in the organisation type) is derived from the activity's
`entry_eligibility` and is **never** accepted as a parameter — a client that could name its own scope
could ask an open club event for the federation-wide roster. `searchEntrants` and `resolveEntrant`
share one scope function and one definition of "active" (`status = 'active'` **and** `valid_until >=
today`); those two agreeing is the safety property, since one decides what is offered and the other
what is accepted. Deliberately over the whole roster rather than the caller's own memberships —
entries are made on other people's behalf constantly — with a two-character minimum, a cap of 20, and
no contact details in the payload. See [docs/ENTRANT_NAME.md](../../docs/ENTRANT_NAME.md).

**Availability and fulfilment** — `account-catalogue.service` decides what a member may buy;
`fulfilment.service` turns each paid `payment_transactions` line into the thing it bought.
`utils/slot-availability.ts` holds the booking rules and is a **deliberate second implementation** of
the browser calculator in `orgadmin-calendar` — the two must agree, and both are tested against the
same cases ([docs/ACCOUNT_USER_APP_PHASE11_CATALOGUE_COMPLETION.md](../../docs/ACCOUNT_USER_APP_PHASE11_CATALOGUE_COMPLETION.md)).

**Cross-cutting** — `discount.service`, `discount-calculator.service`, `discount-validator.service`,
`member-filter.service` (saved filters over the members database — see
[docs/MEMBER_CUSTOM_FILTERS.md](../../docs/MEMBER_CUSTOM_FILTERS.md)),
`application-form.service`, `form-submission.service`, `payment.service`, `payment-method.service`,
`capability.service`, `metadata.service`, `generic-crud.service`, `table-generator.service`,
`reporting.service`, `email.service`, `file-upload.service`, `cache.service`, `validation.service`,
`session.service`.

**Audit** (`services/audit/`) — `audit.service` (`record()`, batched and non-throwing),
`audit.redaction` (`diff`/`created`/`deleted`, the never-log list), `audit.types` (the action
registry — ~90 actions in 11 categories), `audit.query` (keyset paging, organisation **mandatory**),
`with-audit` (`withAudit`, `recordAudit`), `sensitive-fields` (the club's own marked form fields),
`audit-partitions` (monthly rotation, retention helper). See
[docs/AUDIT_TRAIL_AND_SESSIONS.md](../../docs/AUDIT_TRAIL_AND_SESSIONS.md).

## Middleware

| File | Purpose |
|---|---|
| `auth.middleware` | `authenticateToken()`, `requireAuth()`, `requireRole()`, `requireAllRoles()`, `requireAdminRole()`, `optionalAuth()` |
| `orgadmin-role.middleware` | `requireOrgAdminRole()`, `requireOrgAdmin()` |
| `capability.middleware` | `loadOrganisationCapabilities()`, `requireCapability()`, `requireAllCapabilities()`, `requireOrgAdminCapability()` — org admins only |
| `account-auth.middleware` | `resolveAccountOrganisation()`, `requireAccountCapability()` — the account-user equivalent |
| `organisation-scope.middleware` | `scopeToOrganisation()` and its shorthands — **which organisation a request concerns, and whether the caller may act there.** Required on every org-admin route; a structural test enforces it |
| `audit.middleware` | `audited({...})` — records a route without touching its handler. Loads the before-row for an update or delete, captures the response as the after-row, records on `finish`. On 101 mutating routes |
| `audit-auth.middleware` | `noteAuthenticatedRequest()`, `auditRefusals()` — logins and access refusals |
| `field-capability.middleware` | Capability gating at field granularity |
| `input-validation.middleware`, `xss-protection.middleware`, `csrf.middleware`, `rate-limit.middleware` | Request hardening |
| `request-logger.middleware`, `metrics.middleware` | Observability |
| `error-handler.middleware`, `errors.ts` | Typed errors → HTTP responses |

**Dual mounting makes a `:param` in the last segment ambiguous.** Every data router is mounted at
both `/api/orgadmin` and `/api/orgadmin/organisations/:organisationId`, bare first. A router that
also declares its own `/organisations/:organisationId/<thing>/:something` therefore matches the
*scoped* form of `/<thing>/:id` on the bare mount, binding the id to the wrong parameter. That is
what made `GET .../discounts/:id` answer 403 on a discount the caller owned: it reached
`/discounts/:moduleType` with a uuid as the module, so the capability lookup returned `undefined`
and `requireCapability(undefined)` refused a capability it could not name. Constrain such a
parameter to its known values — `:moduleType(events|memberships|…)` — and never let a capability
lookup return `undefined`. `discount-route-collision.test.ts` pins both halves.

**The trusted-origin list comes from `PUBLIC_URL`, not only `ALLOWED_ORIGINS`.** `utils/allowed-origins`
is the single definition used by both CORS and the open-redirect check. It always includes the origin
of `PUBLIC_URL`, because the browser is on that origin and refusing it refuses the application;
`ALLOWED_ORIGINS` adds anything else. Getting this wrong is not obviously fatal — browsers omit
`Origin` on a same-origin GET and send it on PUT/POST/DELETE, so the symptom is a site that reads
perfectly and cannot save anything. A refused origin is a `ForbiddenError` (403) naming the origin,
not the bare `Error` that used to surface as an opaque 500.

**Token validation reads two Keycloak addresses, and behind a proxy they differ.** `KEYCLOAK_URL` is
how this process *reaches* Keycloak, and is what the signing keys are fetched from.
`KEYCLOAK_ISSUER_URL` is what a valid token must claim in `iss` — the hostname the **browser** used.
It defaults to `KEYCLOAK_URL`, so a direct-to-Keycloak setup needs nothing set; behind nginx the two
are `http://keycloak:8080/auth` and `https://itsps.org/auth` respectively. Setting only the first
rejects every token as untrusted, which presents as *sign-in succeeds and then every API call is
401* — a whole-system outage that looks like an application bug. Audience is separate and pinned to
`KEYCLOAK_CLIENT_ID`; each front-end client carries an audience mapper for it.

## Database

Raw SQL through `db` (`src/database/pool.ts`). Schema is defined solely by `migrations/`. Tables:

```
organizations  organization_types  organization_users  organization_user_roles
organization_admin_roles  audit_events (partitioned by month)  users  roles  capabilities
events  event_activities  event_entries  event_ticketing_config  electronic_tickets
ticket_scan_history  members  membership_types  member_filters
registrations  registration_types  registration_filters
merchandise_types  merchandise_orders  merchandise_order_history
merchandise_option_types  merchandise_option_values  delivery_rules
calendars  bookings  booking_history  blocked_periods  schedule_rules
time_slot_configurations  duration_options
application_forms  application_form_fields  application_fields  field_definitions
form_submissions  form_submission_files
object_definitions  object_fields
payments  payment_methods  refunds  org_payment_method_data
organization_type_payment_fees  organization_payment_application_fees
carts  cart_items  payment_transactions
discounts  discount_applications  discount_usage  user_groups  user_group_members
event_types  venues  slot_reservations  membership_number_sequences
reports  user_onboarding_preferences
pending_email_changes  org_admin_last_organisation
```

**`user_onboarding_preferences.user_id` is a Keycloak subject, not a row id, and deliberately has no
foreign key** (migration `1709000000019`). Identity lives in Keycloak; the preference belongs to the
person, not to one of their `organization_users` memberships. It was originally declared
`uuid REFERENCES organization_users(id)` while every writer passed the JWT subject, so every save
returned 500 and the read path masked it by falling back to defaults
([docs/ONBOARDING_DISMISSAL_IGNORED.md](../../docs/ONBOARDING_DISMISSAL_IGNORED.md)).

**`payment_transactions` carries the whole basket line, not just an id** (migration
`1709000000020`): `context_ref` and `quantity` are copied from `cart_items` at checkout. Fulfilment
runs from the payment line long after the basket is emptied, so an id alone cannot say which size or
how many — which is why merchandise, bookings and registrations all need them.

**Hold windows are per organisation**, in `organizations.settings.holds`, set by the super-admin
([docs/CONFIGURABLE_HOLD_WINDOWS.md](../../docs/CONFIGURABLE_HOLD_WINDOWS.md)). Defaults are **3
minutes** for the basket (was a fixed 2) and 15 for payment; ranges 1–60 and 5–180. Reading
(`holdWindowsFrom`) falls back and clamps, because it is asked while a member is adding to a basket;
writing (`holdWindowsError`) refuses and names the limit. `hold-windows.service` caches for 30s and
`updateOrganization` drops the entry, so an edit applies to the next basket.

**A lapsed hold is deleted from the basket on read** — `getCart` removes those lines and returns a
warning naming what went (`itemId: null`, because the row has gone). Only lines that held something
are touched; a membership does not vanish for sitting in a basket. Still no sweeper and no timer.

**`cart_items.expires_at` is a soft hold, and the only one there is** (migrations
`1709000000025`–`26`, [docs/BASKET_SOFT_HOLDS.md](../../docs/BASKET_SOFT_HOLDS.md)). Adding a
booking, or an event entry against a capped event or activity, stamps an expiry two minutes out;
`listCalendarAvailability` and `listEvents` subtract lines where `expires_at > NOW()` on a cart
still `open`. Starting checkout extends every live hold to 15 minutes, `failPayment` drops them back
to two, and a paid cart moving to `'ordered'` takes them out of the query. **Nothing sweeps the
table** — an abandoned basket just stops counting. `slot_reservations` is a different thing: a club
official blocking a court, with a `reason`, written only by the org-admin API.

Two faults were fixed to make that work: `carts_status_check` did not permit `'ordered'`, the status
`confirmPayment` sets, so every confirmation rolled back; and `expires_at` was
`timestamp without time zone`, which made a two-minute hold last two minutes *plus the server's UTC
offset* — right in winter, an hour wrong in summer.

**Five tables are soft-deleted**, all with the same `deleted` / `deleted_at` / `deleted_by` shape
and an `(organisation_id, deleted)` index: `events` (migration `1709000000017`) and
`merchandise_types`, `membership_types`, `registration_types`, `calendars` (`1709000000018`). Their
services mark rather than remove, because `event_entries`, `electronic_tickets`,
`merchandise_orders`, `members`, `registrations` and `bookings` all reference these rows — a hard
`DELETE` either fails on a foreign key or takes the history with it.

The rule when adding a query: **withdrawn rows stop being choosable but stay resolvable.** Lists,
catalogues, get-by-id and eligibility checks filter `deleted = FALSE`; historical joins deliberately
do **not** — `reporting.service` still counts members of a retired membership type, and
`merchandise.service`'s order-line name lookup still names a withdrawn product. Adding a filter to
those in the name of consistency blanks out history. `soft-delete.service.test.ts` pins both halves.

**`bookings` is not in that list on purpose.** It has `booking_status`, `cancelled_at`,
`cancelled_by` and `cancellation_reason` already; cancellation is the domain's own soft delete and
carries more than a boolean would. A second flag beside it would mean every query had to check two.

`events.deleted` was assumed by the code long before the column existed, which surfaced as
`42703 column e.deleted does not exist` on every events list.

`organizations.settings` is JSONB shared by several features — always merge, never replace
(see [architecture.md](architecture.md)).

`organizations.url_code` is the short code the account-user application addresses an organisation
by. It is unique, format-checked in the database, and must not collide with the application's own
path segments — `src/utils/url-code.ts` owns the rule, and the reserved list there must stay in step
with the one in `migrations/1709000000003_add-organization-url-code.js`.

**Money in the cart and payment-transaction tables is in integer minor units.** The older
`payments.amount` and the domain `fee` columns are `decimal`; do not mix the two without converting.

`organizations.currency` always equals its organisation type's. The type's fixed card handling fee
is a cash amount in that currency, so the two cannot diverge; `organization.service` ignores a
currency sent by a client rather than honouring it.

## Conventions

- A new endpoint = a router in `src/routes` + a service in `src/services` + the mount in
  `index.ts` + an `@openapi` JSDoc block.
- Resolve the organisation from `req.user.userId` via `organization_users`; never trust an
  organisation id from the client.
- **Two audiences, two resolvers.** Org-admin routes resolve one organisation from the token
  (`loadOrganisationCapabilities`). Account-user routes take the organisation's `url_code` from the
  path and check membership of *that* organisation (`resolveAccountOrganisation`), because an
  account user may belong to several. Neither trusts an id from the caller.
- `organization_users.user_type` is **`'org-admin'`** or **`'account-user'`**. The `org_admin_users`
  and `account_users` views from migration `013` filter on `'admin'`/`'account'` and so match
  nothing — they are unused; do not reach for them.
- Guard org-admin endpoints with `authenticateToken()` **and** something that establishes the
  organisation — `requireOrgAdminCapability()` where the path names one, otherwise a
  `scopeToOrganisation` shorthand. `authenticateToken()` alone says who the caller is and nothing
  about where they may act; 127 routes were once wrong in exactly that way.
- **Answers submitted against a definition are validated server-side.** `POST
  /account/:orgCode/form-submissions` checks `submissionData` against the form's own fields
  (`src/utils/application-field-validation.ts`) and refuses with `400 INVALID_SUBMISSION` plus a
  per-field list. The client checks first for the member's sake; this is the guarantee, because
  `members.form_submission_id` is NOT NULL and the submission is the record the club works from.
- Schema changes are migrations, never ad-hoc SQL — and check whether the data could live in the
  existing `settings` JSONB before adding a column.
- The schema and the services were badly out of step until August 2026 — nine tables and eleven
  columns existed only in code. All are now created; the reasoning, and the two `ON CONFLICT`
  subtleties behind them, are in
  [docs/SCHEMA_DRIFT_AUDIT.md](../../docs/SCHEMA_DRIFT_AUDIT.md).

## Where to look for what

| Question | Start at |
|---|---|
| "Which endpoint serves X?" | `src/index.ts` mounts, then the named router |
| "What does this table hold?" | `migrations/` (search the table name) |
| "Why does this service fail on a column/table?" | [docs/SCHEMA_DRIFT_AUDIT.md](../../docs/SCHEMA_DRIFT_AUDIT.md) |
| "How is this authorised?" | The middleware chain on the route |
| "Why is this 403?" | `capability.middleware` (the organisation's `enabled_capabilities`) or `organisation-scope.middleware` (the caller does not administer the organisation the request concerns) |
| "Where is this business rule?" | The matching `*.service.ts` |
| "How is a card handling fee calculated?" | `src/utils/handling-fee.ts` — pure, and the only place the rules live |
| "Where do cart totals come from?" | `cart.service.getCart` — computed server-side and returned whole; the client never recomputes |
| "How does a payment cover several items?" | `payments` is the parent, `payment_transactions` are its lines; legacy rows keep `payment_type`/`context_id` |
| "Where do handling-fee rates come from?" | `organization_type_payment_fees`, per organisation type; resolved by `organization-type-payment-fee.service` |
| "Why was this URL code rejected?" | `src/utils/url-code.ts` — format, length, or the reserved list |
| "Why was a form submission rejected with `INVALID_SUBMISSION`?" | `src/utils/application-field-validation.ts` — the answers are checked against the form's own fields before storing, and the 400 names each one |
| "Why won't an onboarding dialog stay dismissed?" | Two causes, both fixed: `src/utils/onboarding-modules.ts` (the id must also be in orgadmin-shell's `MODULE_IDS`, else 400) and migration `1709000000019` (`user_onboarding_preferences.user_id` held a Keycloak id under a FK to `organization_users`, so every write 500'd) |
| "Why did an account user get a 403?" | `account-auth.middleware` — the `error.code` says which of the five refusals it was |
| "Why isn't a discount restriction applying?" | `discount-validator.service` — and check the stored `eligibility_criteria` key: older rows use `membershipTypeIds`, current ones `membershipTypes`; both are read |
| "What can an account user call?" | `public.routes` (no token) and `account.routes` (token + membership) |
| "Why was an item refused from the basket?" | `assertAddable` in `account.routes` → `account-catalogue.service`; the cart itself trusts its caller by design |
| "Why was an entry refused for the person it names?" | `assertAddable` → `entrant.service.resolveEntrant`. Members-only takes a member in scope and refuses a typed name; open entries require *a name* and still check a `memberId` if one is sent |
| "How does a paid line become an order/entry/membership?" | `fulfilment.service.fulfilLine`, from `payment_transactions` alone — `context_ref` and `quantity` are copied there at checkout because the basket is gone by then |
| "Why is this slot unavailable?" | `src/utils/slot-availability.ts` — generate → block → window → occupy → hold. Availability is derived, never stored |
| "Why can't a member cancel this booking?" | `src/utils/booking-cancellation.ts` — the club's three settings, and no money moves |
| "Why is a registered member still locked out?" | Two gates: Keycloak email verification, then `organization_users.status`. See `account-registration.service` |

## Running the tests

Tests use a **separate database** — `aws_framework_test`, configured in `packages/backend/.env.test`
and loaded by `src/__tests__/jest.setup.js`. It is not the app's `aws_framework`. Without it every
DB-backed suite fails with `ECONNREFUSED` or "database does not exist"; standing it up recovered 14
suites in one go. See [docs/BACKEND_TEST_SUITE_REPAIR.md](../../docs/BACKEND_TEST_SUITE_REPAIR.md).

Three traps worth knowing:

- **Some migration tests are destructive and do not clean up.**
  `src/__tests__/migrations/membership-type-discount-ids-migration.test.ts` drops
  `membership_types` from the shared `aws_framework_test` database and never restores it; others
  drop `payment_methods` and `org_payment_method_data`. They pass, so it is silent — and because
  `pgmigrations` still records the creation, `migrate:up` will not put the table back. If a suite
  fails with `relation "…" does not exist`, rebuild the test database rather than hunting the code.

- **`tsc` is a suite-level gate.** Almost every route and integration suite imports `src/index.ts`,
  so one unused import there is a compile error that takes ~22 suites down at once — and they report
  as failures having run **zero** tests, so the breakage looks far worse and far vaguer than it is.
  Check `npx tsc --noEmit` before reading any jest output.
- **Services that write in a transaction take `db.getClient()`.** A pool mock providing only `query`
  returns `undefined`, and the failure surfaces later as "Cannot read properties of undefined
  (reading 'release')", which reads as a service bug. Use
  `src/test-helpers/mock-db-client.ts`. That helper sits outside `src/__tests__/` deliberately: jest's
  `testMatch` collects every `.ts` under that directory and would treat it as an empty suite.

## Payments and checkout

`services/payment-providers/` holds the `PaymentProvider` contract, `StripeProvider` and a
**deliberately unimplemented** `HelixPayProvider` (no API contract is available; `isConfigured()`
returns false so the registry never selects it). `checkout.service.ts` turns a cart into a payment;
`webhook.service.ts` processes provider events exactly once.

Things worth knowing before touching any of it:

- **Every org-admin route establishes which organisation it is about, and verifies it.**
  Two guards do this and they share one membership check:
  `loadOrganisationCapabilities` for the 30 routes that name an organisation in
  their path, and `scopeToOrganisation` (`organisation-scope.middleware.ts`) for
  the rest — `byResource` / `byParam` / `byBodyOrCurrent` /
  `byCurrentOrganisation`, chosen by what the route has to work with.

  **127 routes previously had no organisation check of any kind** — only
  `authenticateToken()`. Any signed-in user of any club could read and write any
  other club's data; verified live as an ordinary member, including a successful
  `PUT /events/:id`. `POST /users/admins/:id/reset-password` would set any
  administrator's password anywhere. Authentication answers *who*; it never
  answered *where*, and a route that omits the second question looks exactly like
  one that asks it — which is why
  `src/routes/__tests__/orgadmin-routes-are-scoped.test.ts` enumerates every
  org-admin route and fails, by name, on any scoped by authentication alone.

  Ownership is resolved by **joining** to the parent (a booking through its
  calendar, a ticket through its event) rather than by a denormalised column, so
  the answer stays true if a resource moves. A resource in another club and a
  resource that does not exist answer identically, or the routes become a way of
  testing whether an id is real. See docs/ORGADMIN_ROUTE_TENANCY.md.
- **Every org-admin data router is mounted twice**, bare and under
  `/api/orgadmin/organisations/:organisationId`, so a request says which club it
  is about. Both forms are equally checked, and where the path names an
  organisation it must **agree** with the resource being acted on — otherwise an
  administrator of two clubs could put one in the path and the other's resource
  id after it, and the URL would describe something the request did not do.

  **The bare mount is registered first, and the order is load-bearing.** Several
  routers already declare scoped collection routes of their own
  (`/organisations/:organisationId/discounts/:moduleType`); mounting the scoped
  prefix first strips it off and re-offers `/discounts/events` to the same
  router, where `/discounts/:id` matches and reads "events" as an id. Bare-first
  lets the fully-specified route win and everything else fall through.
- **An org admin may act only on an organisation they administer, and may administer several.**
  `loadOrganisationCapabilities` resolves the organisation from the **request** —
  `req.params.organisationId` for the 30 data routes that carry it, else the
  `X-Organisation-Id` header the shell sends — and verifies membership of *that*
  one before attaching `organisationId`, `organisationUserId` and `capabilities`.
  The URL wins over the header.

  It previously looked up the caller's *own* organisation, checked the capability
  against it, and left the handler to use `req.params.organisationId` anyway —
  with nothing comparing the two. An administrator of one club could substitute
  another club's id and be served; reproduced live before it was fixed.
  `requireOrgAdminRole` was worse in a second way: it gathered role names across
  every organisation the identity belonged to, so a role at one club would
  satisfy a check against another. Both are scoped now, through the same
  resolver so they cannot disagree.

  With no organisation named, the fallback is ordered (remembered choice, then
  display name) rather than an unordered `LIMIT 1`. `org_admin_last_organisation`
  is a *starting point*, never an authority: what decides which organisation a
  request acts on is the request. `/auth/me` returns `organisations[]` so the
  shell can offer a switcher, and `org-admin-user.service` now **adopts** an
  existing Keycloak identity rather than trying to create a second user with the
  same username — deleting it only when the last membership row goes.
  See docs/ORGADMIN_MULTI_ORGANISATION.md.
- **An account user's own profile edits fan out across their identity.**
  `account-profile.service.ts` writes Keycloak **first and fatally**, then every
  `organization_users` row sharing that `keycloak_user_id` (scoped to `user_type = 'account-user'`).
  Name, phone and language belong to the person, not to one club.
  See docs/ACCOUNT_USER_APP_PHASE10_PROFILE.md.
- **Email and password are changed through the API too**, by `account-credentials.service.ts`, with
  no hand-off to Keycloak's account console. Two things about it are load-bearing:

  **Keycloak can set a password but cannot verify one.** There is no "is this the current password?"
  in the Admin API, so the check is a direct-grant login against `account-password-check` — a
  *confidential* client that exists only for this, created by the seed. The public `account-app`
  client is untouched: turning direct grants on there would let anyone post username-and-password
  pairs at the token endpoint with no secret. The tokens it returns are discarded, and the auth
  middleware pins the audience to `KEYCLOAK_CLIENT_ID`, so a token from this client cannot be used
  to call the API. **If `KEYCLOAK_PASSWORD_CHECK_CLIENT_SECRET` is unset the service throws rather
  than falling through** — Keycloak answers a secretless confidential client with the same 401 it
  uses for a bad password, so without that guard every member is told their correct password is
  wrong.

  **An account user's Keycloak username *is* their email address**, so changing the address changes
  the credential. Nothing moves until a link sent to the new address is followed
  (`pending_email_changes`, token hashed at rest, single-use, one hour); confirmation then updates
  `email` **and** `username` together, plus every `organization_users` row for that identity. The
  request endpoint answers identically whether or not the address is already taken, so it cannot be
  used to discover which addresses are registered. See docs/ACCOUNT_SELF_SERVICE_CREDENTIALS.md.
- **Fulfilment runs at a different moment for card and offline orders.** A card order fulfils when
  Stripe confirms it; an **offline order fulfils when checkout completes**, because a cheque may
  take weeks and the member should not be without their entry or ticket until then. The entry is
  written `pending`/`offline` and the ticket reads "awaiting payment". Only `event-entry` lines are
  created ahead of the money — memberships are **deferred, not failed**, and `complete` stays false.
  What releases the deferred half is the club recording the money: see the offline-settlement entry
  below. See docs/ACCOUNT_USER_APP_PHASE9_TICKETS.md.
- **Tickets are issued on the fulfilment path, not on request.** `fulfilment.service.ts` calls
  `ticketingService.issueTicketForEntry` immediately after creating an event entry. It is wrapped: a
  ticketing failure is logged, never thrown, because the entry already exists. Issuance is
  idempotent on `event_entry_id`, because Stripe replays webhooks.
- **A connected account id does not mean a club can be paid.** `accounts.create` runs the moment
  onboarding starts, so an `acct_…` is on file long before Stripe sets `charges_enabled`. Checkout
  guards on `settings.stripeConnect.chargesEnabled`, not on the id's presence — see
  docs/CHECKOUT_CONNECT_READINESS_GUARD.md.
- **Stripe is Connect, on the PLATFORM's key from the environment** (`STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`). The club's connected account id is
  `settings.stripeConnect.accountId`; the handling fee is the `application_fee_amount`. There are
  **no per-organisation Stripe keys** — the direct-charge fields were removed from the settings tab,
  the `PaymentSettings` contract and stored data (migration `1709000000014`). See
  docs/ACCOUNT_USER_APP_PHASE8_CHECKOUT.md §1 and docs/REMOVE_PER_ORG_STRIPE_KEYS.md.
- **Payments authorise first and capture second** (`capture_method: 'manual'`,
  [docs/MANUAL_CAPTURE_AND_HOLD_CONTROL.md](../../docs/MANUAL_CAPTURE_AND_HOLD_CONTROL.md)).
  Confirming holds the funds; `payment_intent.amount_capturable_updated` arrives as the
  **`authorised`** outcome, and `settleAuthorisation` re-checks the order through
  `order-availability.service` before capturing or reversing. Nothing is confirmed or fulfilled on an
  authorisation — that still happens on `payment_intent.succeeded`, which follows the capture.
  Reversing costs nothing, where the old automatic capture left the club owing a refund. The price:
  `automatic_payment_methods` now excludes bank redirects (iDEAL, Bancontact, SEPA), which cannot
  authorise without taking. `POST /:orgCode/checkout/:paymentId/abandon` cancels the intent when a
  hold lapses, so a stale tab's client secret stops working.
- **An offline order closes its own cart, and creates its bookings**
  ([docs/OFFLINE_CHECKOUT.md](../../docs/OFFLINE_CHECKOUT.md)). `confirmPayment` closes the cart for
  a card order; the offline path had no equivalent, so the basket kept every line and members
  checked out repeatedly — five payments against one pair of slots. Separately, fulfilment created
  only `event_entry` ahead of the money: right for a membership or goods, wrong for a **booking**,
  because a slot that is not booked is still on sale and the hold lapses two minutes later.
  **`event_entry`, `booking` and `merchandise` are created before payment**; each can exist in a
  state that grants nothing (`merchandise_orders` defaults both `order_status` and `payment_status`
  to `pending`, so an order is recorded and nothing is dispatched). `membership` and `registration`
  stay deferred, because `createMember`/`createRegistration` set `active` when the type
  auto-approves — creating one unpaid hands over the entitlement. A membership bought offline is
  therefore still invisible until the club records the payment.
- **A `::uuid` cast is not local to its clause.** Postgres infers one type per parameter for the
  whole statement, so casting `$5` once types it everywhere. `account-profile.service` wrote
  `($5::uuid IS NOT NULL AND keycloak_user_id = $5)` — `keycloak_user_id` is `character varying`, so
  every profile save failed with "operator does not exist: character varying = uuid" and a 500
  ([docs/PROFILE_SAVE_AND_BASKET_WORDING.md](../../docs/PROFILE_SAVE_AND_BASKET_WORDING.md)). Cast
  each parameter to the type its column actually has.
- **Capability lists are validated on write but not constrained in the database**, so a record
  holding a name that is not in the `capabilities` catalogue is writable once and **never editable
  again** — every update re-validates the whole list
  ([docs/PHANTOM_CAPABILITIES.md](../../docs/PHANTOM_CAPABILITIES.md)). That is how editing an
  organisation type's application fee came to fail with "Invalid capabilities provided" about three
  seeded names (`discounts`, `email-notifications`, `document-uploads`) that gate nothing.
  `capabilityService.unknownCapabilities()` now names the offenders, the org-type routes return
  **400** rather than falling through to a 500, migration `1709000000027` strips unknown names from
  existing rows, and the seed checks itself against the same catalogue before writing.
- **`/api/admin` is guarded by `requireAdminRole()` at router level.** `admin.routes` mounts on that
  prefix *before* the more specific routers, so its `router.use` guards run for every path beneath
  it. A platform administrator therefore needs **both** `admin` and `super-admin` — the handlers
  require the latter on top. Granting only `super-admin` produces a user who can sign into the admin
  app and gets 403 from every request in it.
- **`registry.get(name)` tolerates a null name.** `payments.payment_provider` is null until an intent
  is attached and stays null on an offline order, so callers hold a name read from a row rather than
  a literal; `name.toLowerCase()` turned each of those into a 500.
- **A `pending` payment with a card amount but no client secret is discarded, not resumed.**
  `createPayment` writes the row before asking the provider, so a failure between the two leaves one
  that cannot be confirmed — handing it back gives the member a checkout with no card form.
- **`chargesEnabled` is a cache of Stripe's answer, and a `false` is re-checked before it is
  believed.** Verification is asynchronous, so a club that finished verifying after the last refresh
  was recorded as unable to take payments and stayed that way until somebody opened its Payment
  Settings — refusing every member in the meantime. `attachProviderIntent` now calls
  `refreshState` on that branch only.
- **The API serves the Stripe *publishable* key** (`CheckoutResult.publishableKey`,
  [docs/CHECKOUT_KEY_AND_MEMBERSHIP_DETAILS.md](../../docs/CHECKOUT_KEY_AND_MEMBERSHIP_DETAILS.md)).
  The account app used to read its own `VITE_STRIPE_PUBLISHABLE_KEY` from a `.env` that does not
  exist in this repo, so `loadStripe('')` rejected, `useStripe()` stayed null and Pay Now was
  permanently disabled with nothing on screen to say why. Serving it beside the secret key also
  stops the two drifting onto different Stripe accounts.
- **A pending payment is a snapshot, and is retired when its basket changes**
  ([docs/STALE_PENDING_PAYMENT.md](../../docs/STALE_PENDING_PAYMENT.md)). `startCheckout` reuses an
  in-flight payment so a page reload cannot charge twice, but that reuse was unconditional — a
  member who edited their basket got the old total, the old lines and the old Stripe intent.
  `payments.metadata.cartFingerprint` records what was priced; a mismatch marks the payment
  `abandoned`, cancels its intent and creates a fresh one. A payment with no fingerprint predates
  the check and counts as stale.
- **`listPayments` excludes `pending` and `abandoned`** — attempts are not payments, and listing
  them put orders in a member's history that were never placed. `paid`, `awaiting_offline`,
  `refunded` and `failed` all stay.
- **A booking is refused if the same slot is already in the basket**, checked against `cart_items`
  directly rather than through availability. Availability only counts unlapsed holds, so two minutes
  after adding an exclusive slot it read as free and could be added again.
- **`payment_transactions.item_type` is the basket's spelling, `event_entry`** — fulfilment switched
  on `event-entry` and failed every paid entry until `itemTypeOf` normalised both. It hid behind the
  `carts.status` fault above (no payment ever reached fulfilment) *and* behind a test fixture that
  used the hyphen, so the tests agreed with the code rather than the database.
- **Never validate a redirect target against `req.get('host')`.** Every front end reaches this API
  through a proxy that rewrites `Host` (Vite's `changeOrigin: true`, nginx), so the backend sees its
  own address and rejects the origin the browser is actually on. Use
  `utils/allowed-origins.ts`, which checks `ALLOWED_ORIGINS` and is shared with CORS.
- **`/api/webhooks` mounts before `express.json()`** in `index.ts`. Stripe signs the exact bytes it
  sent; parsing and re-serialising invalidates every signature.
- **Webhook status codes drive retries.** Bad signature → 400. Processing failure → 500 (so it
  retries). Already-processed or ignored → **200**, or the provider retries forever.
- **Exactly-once is an insert-first claim** on `processed_webhook_events` (unique on
  `provider, event_id`), released on failure so a retry can succeed. `confirmPayment` also locks the
  payment row `FOR UPDATE` and re-checks its status.
- **Organisation status gates org-admin access.** `active` or `inactive` only. Sign-in and every
  capability- or role-gated request check `o.status = 'active'`, so deactivating an organisation
  locks out its administrators immediately, not when their token expires. `DELETE` on an
  organisation is retired and answers 409 — see `docs/ORGANISATION_STATUS_AND_DEACTIVATION.md`.
- **The Connect application fee is configurable per organisation type** **and per organisation.** The type's value is
  the default a new organisation is created with; from then on the organisation carries its own row
  in `organization_payment_application_fees` and a later edit to the type does not reach it.
  Resolution at checkout is organisation-first, falling back to the type. Only the *application*
  fee works this way — the three handling-fee elements stay on `organization_type_payment_fees` and
  are inherited live. See `docs/ORGANISATION_APPLICATION_FEE.md`.
  (`organization_type_payment_fees.application_fee_*`), and is **not** the same thing as the handling
  fee: the handling fee is added to what the member pays, the application fee splits the money
  already collected. Both columns are nullable and NULL means "take the handling fee" — a
  `DEFAULT 0` would have silently handed the platform's revenue to the clubs. See
  docs/CONNECT_APPLICATION_FEE.md.
- **Fulfilment is `fulfilment.service.ts`**, and runs *after* the payment is confirmed rather than
  inside its transaction — if it failed, a payment genuinely taken must still be recorded as paid.
  State is **per line** on `payment_transactions` (`fulfilled_at`, `fulfilment_ref`,
  `fulfilment_error`) so lines can fail independently and a retry resumes. A webhook **redelivery
  still attempts fulfilment** even though the claim returns early — the claim guards event
  processing, not order completion. Memberships delegate to `membershipService.createMember`.
- **An offline payment's fulfilment waits for the money.** Checkout with an offline method leaves
  the payment `awaiting_offline` and fulfilment defers everything except an event entry — a
  membership runs for a year, and granting one before the cheque clears gives it away. The club
  releases it from **Payments → Offline Payments**, which calls
  `paymentService.markOfflinePaymentReceived` (org resolved from the token): status to `paid`,
  `offline_received_at`/`_by` recorded under `COALESCE` so a second marking changes nothing, then
  `fulfilPayment` runs and its `{ fulfilled, failed, complete }` is returned so the screen can say
  what the money produced. `undoOfflinePaymentReceived` reverses it, but **refuses once any
  `payment_transactions` line has `fulfilled_at`** — flipping the status back would strand every
  membership and booking it created. See docs/OFFLINE_PAYMENT_SETTLEMENT.md.

## Public event listings and search discovery

`public-event.service` serves every anonymous surface: a club's programme, the platform search with
filters and counts, one event by slug, and the sitemap's URL list. One SQL projection behind all
four, because writing the shape four times is how one of them ends up exposing a column the others
do not. Two rules it applies in one place:

- **Nothing about people.** No entrants, no member names. Asserted against the *queries*, not the
  output — an output test only proves the fixture had no names in it.
- **Published twice.** `status = 'published'` **and** a public flag. A draft cannot reach the world
  by ticking a second box.

A finished event keeps its page deliberately; the listings order it away rather than deleting it.
A withdrawn one answers **410**, not 404, so a crawler drops it promptly instead of retrying for
weeks.

`seo.routes` serves `robots.txt` and a generated `sitemap.xml` at the site root, and injects a real
`<head>` plus a `<noscript>` block into the account shell for public event pages —
`ACCOUNT_SHELL_HTML` points at the built `index.html`, and unset the routes do nothing and nginx
serves the static shell as before.

See [PUBLIC_EVENTS.md](../../docs/PUBLIC_EVENTS.md) and
[PUBLIC_EVENTS_SEO.md](../../docs/PUBLIC_EVENTS_SEO.md).
