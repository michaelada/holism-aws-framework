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
| `/api/public` | `public.routes` — **unauthenticated**, backs the account app's organisation directory and sign-in gateway |
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

**Availability and fulfilment** — `account-catalogue.service` decides what a member may buy;
`fulfilment.service` turns each paid `payment_transactions` line into the thing it bought.
`utils/slot-availability.ts` holds the booking rules and is a **deliberate second implementation** of
the browser calculator in `orgadmin-calendar` — the two must agree, and both are tested against the
same cases ([docs/ACCOUNT_USER_APP_PHASE11_CATALOGUE_COMPLETION.md](../../docs/ACCOUNT_USER_APP_PHASE11_CATALOGUE_COMPLETION.md)).

**Cross-cutting** — `discount.service`, `discount-calculator.service`, `discount-validator.service`,
`application-form.service`, `form-submission.service`, `payment.service`, `payment-method.service`,
`capability.service`, `metadata.service`, `generic-crud.service`, `table-generator.service`,
`reporting.service`, `email.service`, `file-upload.service`, `cache.service`, `audit-log.service`,
`validation.service`.

## Middleware

| File | Purpose |
|---|---|
| `auth.middleware` | `authenticateToken()`, `requireAuth()`, `requireRole()`, `requireAllRoles()`, `requireAdminRole()`, `optionalAuth()` |
| `orgadmin-role.middleware` | `requireOrgAdminRole()`, `requireOrgAdmin()` |
| `capability.middleware` | `loadOrganisationCapabilities()`, `requireCapability()`, `requireAllCapabilities()`, `requireOrgAdminCapability()` — org admins only |
| `account-auth.middleware` | `resolveAccountOrganisation()`, `requireAccountCapability()` — the account-user equivalent |
| `field-capability.middleware` | Capability gating at field granularity |
| `input-validation.middleware`, `xss-protection.middleware`, `csrf.middleware`, `rate-limit.middleware` | Request hardening |
| `request-logger.middleware`, `metrics.middleware` | Observability |
| `error-handler.middleware`, `errors.ts` | Typed errors → HTTP responses |

## Database

Raw SQL through `db` (`src/database/pool.ts`). Schema is defined solely by `migrations/`. Tables:

```
organizations  organization_types  organization_users  organization_user_roles
organization_admin_roles  organization_audit_log  admin_audit_log  users  roles  capabilities
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
- Guard org-admin endpoints with `authenticateToken()` and the appropriate capability middleware.
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
| "Why is this 403?" | `capability.middleware` and the organisation's `enabled_capabilities` |
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

- **An account user's own profile edits fan out across their identity.**
  `account-profile.service.ts` writes Keycloak **first and fatally**, then every
  `organization_users` row sharing that `keycloak_user_id` (scoped to `user_type = 'account-user'`).
  Name, phone and language belong to the person, not to one club. Email and password are not
  editable through the API at all — they hand off to Keycloak's account console, which already
  implements the verification flows. See docs/ACCOUNT_USER_APP_PHASE10_PROFILE.md.
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
