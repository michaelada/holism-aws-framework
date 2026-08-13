# Account User Application — platform foundation (phases 1–5)

**Status:** Implemented. **Date:** 8 August 2026

The first five phases of the task breakdown in
[ACCOUNT_USER_APP_WIREFRAMES.md](ACCOUNT_USER_APP_WIREFRAMES.md#next-steps). Nothing user-facing in
the account application yet — this is the platform work every later phase depends on, plus the
super-admin screens that configure it and the API the front end will call.

| Gap | What it closes |
|---|---|
| [G2](ACCOUNT_USER_APP_WIREFRAMES.md#g2--organisations-have-no-url-friendly-short-code) | Organisations had no URL-friendly short code, so `/account/khpc` could not resolve |
| [G5](ACCOUNT_USER_APP_WIREFRAMES.md#g5--handling-fees-are-configured-per-organisation-type) | Nothing stored the card handling-fee rate, so a cart could not display a total |
| [G12](ACCOUNT_USER_APP_WIREFRAMES.md#g12--an-organisations-currency-must-match-its-types) | An organisation's currency could diverge from its type's, making the type's fixed fee meaningless |
| [G1](ACCOUNT_USER_APP_WIREFRAMES.md#g1--there-is-no-account-user-api-surface-at-all) | There was no account-user API at all — every route required `user_type = 'org-admin'` |
| [G3](ACCOUNT_USER_APP_WIREFRAMES.md#g3--payments-cannot-represent-a-multi-item-basket) | `payments` was one-payment-per-thing, so a basket had nowhere to live |
| [G4](ACCOUNT_USER_APP_WIREFRAMES.md#g4--handling_fee_included-exists-only-on-event-activities) | `handling_fee_included` existed only on `event_activities` |
| [G6](ACCOUNT_USER_APP_WIREFRAMES.md#g6--auto-registration-is-an-org-admin-setting) | Self-registration had no defined outcome, and no approval path |

Phases 6–10 (the `account-*` front-end packages, checkout and payment providers, ticketing, PWA) are
**not** started.

---

## 1. Database

Five migrations, all verified against a real Postgres — applied, rolled back and re-applied.

### `1709000000003_add-organization-url-code.js`

Adds `organizations.url_code varchar(50)`, unique, `NOT NULL`, with a format check
(`^[a-z0-9][a-z0-9-]{1,49}$`).

Existing rows are backfilled from their name. The backfill handles the three ways a generated slug
goes wrong, rather than letting them fail against the unique index:

| Input | Code | Why |
|---|---|---|
| `Kildare Hunt Pony Club` | `kildare-hunt-pony-club` | Normal case |
| `Ballinasloe & Districts Tennis Club!!` | `ballinasloe-districts-tennis-club` | Punctuation collapsed |
| `Kildare-Hunt  Pony   Club` (second) | `kildare-hunt-pony-club-2` | Collision suffix |
| `admin` | `admin-org` | Would shadow an application path |
| `A` | `a-org` | Below the two-character minimum |
| *(blank)* | `org` | Nothing usable to slugify |
| 77-character name | truncated to 40, no trailing hyphen | Leaves room for a collision suffix |

### `1709000000004_create-organization-type-payment-fees.js`

```
organization_type_payment_fees
    organization_type_id, payment_method_id     UNIQUE together
    fixed_fee        decimal(10,2)   cash amount in the type's currency
    percentage_fee   decimal(6,3)    1.500 = 1.5%
    tax_percentage   decimal(6,3)    0 = no tax element
    CHECK fixed_fee >= 0, percentages between 0 and 100
```

Plus `payment_methods.default_fee_config jsonb`, holding the platform's starting values. Those live
in the database rather than the admin front end so a super admin can follow a provider's published
rate change without a release.

Seeded defaults are **Stripe** 1.5% + 0.25 and **Helix-Pay** 1.75% + 0.20, both with **tax 0**. Tax
defaults to zero deliberately: it varies by jurisdiction, and a wrong non-zero default would
silently overcharge every member. Every existing organisation type gets a row per card method.

### `1709000000005_align-organization-currency-with-type.js`

Sets each organisation's currency from its type and makes the column `NOT NULL`. Any organisation
whose currency genuinely differed is listed as a `NOTICE` **before** being changed — the value is
about to be overwritten, and that belongs in the migration output rather than being discovered
later.

### `1709000000006_create-cart-tables.js`

```
carts               organisation_id, user_id, status, currency
                    UNIQUE (organisation_id, user_id) WHERE status = 'open'

cart_items          cart_id, item_type, context_ref jsonb, description,
                    form_submission_id, quantity, unit_fee, fee,
                    payment_method_id, handling_fee_included,
                    discount_id, discount_amount, expires_at

payment_transactions payment_id, organisation_id, item_type, context_id,
                     description, fee, handling_fee, payment_method_id,
                     form_submission_id, status
```

plus `payments` gains `cart_id`, `handling_fee`, `offline_amount`, `card_amount`,
`fee_config_snapshot`, `offline_received_at`, `offline_received_by`, and its `payment_type` /
`context_id` become nullable so one row can parent many transactions. Existing single-context
payments are untouched — they simply have no `cart_id` and no transaction rows.

Money is in **integer minor units** throughout `cart_items` and `payment_transactions`. Verified
behaviour: a second open cart for the same member and organisation is rejected; a checked-out cart
plus a new open one is allowed; a payment with no `payment_type`/`context_id` is accepted.

`fee_config_snapshot` records the rates in force at checkout, so a super admin changing an
organisation type's fees cannot retroactively change what a historical receipt says.

The **down** migration deletes basket payments before restoring `NOT NULL`, since rows created by a
cart checkout have no single context to restore. That is destructive by necessity and is called out
here rather than discovered.

### `1709000000007_add-handling-fee-included-to-types.js`

Adds `handling_fee_included boolean NOT NULL DEFAULT false` to `membership_types`,
`registration_types`, `merchandise_types` and `calendars`. False — "the fee is added on top" —
matches the existing `event_activities` behaviour and is the safer default: an organisation that
meant to absorb the fee notices the extra line, whereas defaulting to true leaves them quietly out
of pocket on every sale.

**No front-end work was needed.** All four org-admin type forms and all four backend services
already read and wrote `handlingFeeIncluded`; only the column was missing. See
[§7](#7-pre-existing-schema-drift-found-while-doing-this) — that turned out to be part of a wider
problem.

---

## 2. Backend

### New pure modules

**`src/utils/handling-fee.ts`** — the arithmetic from
[Part 4](ACCOUNT_USER_APP_WIREFRAMES.md#part-4--cart-arithmetic). Everything in integer minor units;
floating-point money drifts by a cent on a cart of this shape, and the drift lands in a total a
member is asked to approve.

```
netHandlingFee = fixedFee + (percentageFee × feeBearingBase)   if base > 0
handlingTax    = taxPercentage × netHandlingFee
handlingFee    = netHandlingFee + handlingTax
```

The four rules it encodes, each of which is easy to get wrong:

1. The percentage applies to the **fee-bearing base**, not the card subtotal — an item whose fee
   already absorbs its handling fee is excluded, or the member is billed twice.
2. The fixed element is charged **once per payment**, not once per item.
3. **No fee-bearing items means no fee at all**, including no fixed element.
4. Tax applies to the **handling fee**, never to the order.

`allocateHandlingFee` splits the fee across bearing lines pro rata using the largest-remainder
method, so the parts always sum to the whole — rounding each share independently leaves a payment's
lines disagreeing with its total on a receipt.

**`src/utils/url-code.ts`** — `slugifyUrlCode`, `validateUrlCode`, `ensureUniqueUrlCode` and the
reserved-word list. Deliberately strict: a supplied code is not trimmed or lower-cased on the
caller's behalf, because quietly rewriting a code the super admin typed puts a different address in
front of members than the one they were shown.

**`src/utils/payment-method.ts`** — `isCardPaymentMethod`, mirroring the existing name-based rule
(`card` / `stripe` / `helix`). This duplicates the front-end copy in `EventActivityForm`; per §1.5
the shared version moves to `packages/components` when the account application needs it, and until
then the two change together.

### New service

**`organization-type-payment-fee.service.ts`**

| Method | Use |
|---|---|
| `getFeesForOrganizationType(id)` | A row per active card method, falling back to platform defaults so callers get a complete set |
| `getCardMethodDefaults()` | Platform starting values, to pre-fill the create form |
| `setFees(id, entries)` | Upserts — a method omitted from the payload keeps its rates, so a partial save cannot zero a rate the form did not render |
| `resolveForOrganisation(id)` | Rates in minor units keyed by payment method — the shape the cart calculator consumes |
| `countOrganisationsOfType(id)` | Blast radius, for the warning before saving |

`validateRates` treats a tax percentage of exactly **0** as valid, since that is how an organisation
type says "no tax element".

### Changed

- `organization.service` — resolves the URL code **before** touching Keycloak, so a rejected code
  cannot leave an orphaned group behind; supplied codes are validated and must be free, generated
  ones are made unique automatically. Currency now always comes from the organisation type; a
  currency sent by a client is ignored rather than rejected, so existing callers keep working.
- `organization.routes` — `GET /api/admin/organizations/url-code-available`, declared before `/:id`
  so it is not captured as an organisation id.
- `organization-type.routes` — `GET`/`PUT /:id/payment-fees` and
  `GET /payment-fees/defaults`, same ordering caveat.

---

## 3. The account-user API surface (phase 3)

Two new route families, mounted in `index.ts`.

### `/api/public/*` — no authentication

Backs the screens a member reaches before they have a session.

| Endpoint | Screen |
|---|---|
| `GET /api/public/organisations?q=&limit=&offset=` | Organisation directory (A1) |
| `GET /api/public/organisations/:code` | Organisation gateway (A2) |

Only public fields are exposed — no ids, contact details or raw settings. The directory excludes
inactive organisations and any that set `settings.listedInDirectory` to `false`; the by-code lookup
deliberately **ignores** that flag, because being unlisted is a discoverability choice rather than
access control. Page size is capped at 100 so the directory cannot be drained in one call.

### `/api/account/*` — authenticated

| Endpoint | Purpose |
|---|---|
| `GET /api/account/organisations` | Every organisation the caller belongs to, for the switcher (A7) |
| `GET /api/account/:orgCode/me` | Member and organisation context for the shell, in one call |

`/organisations` is declared **before** `/:orgCode/...`, or it would be read as an organisation code
and 404 the switcher for everyone. There is a test for exactly that.

### `resolveAccountOrganisation()` — the account-user authorisation boundary

The org-admin equivalent, `loadOrganisationCapabilities`, resolves one organisation from the token
and hard-codes `user_type = 'org-admin'`. None of it is reusable: an account user fails that lookup
by design and may belong to several organisations, so **the organisation comes from the URL** and is
checked against membership of that organisation specifically. The id is resolved from the code
server-side; handlers use `req.account.organisationId` and never an id from the caller.

Refusals carry a machine-readable code, because the application shows a different screen for each
and a bare 403 would collapse them into one dead end:

| Code | HTTP | Screen |
|---|---|---|
| `ORGANISATION_UNAVAILABLE` | 404 | Unknown organisation |
| `NOT_CONNECTED` | 403 | "You're not connected to this club yet" (A6) |
| `PENDING_APPROVAL` | 403 | "Waiting for approval" (A8) |
| `REGISTRATION_REJECTED` | 403 | Rejected variant of A8 |
| `ACCOUNT_INACTIVE` | 403 | Generic refusal |

`PENDING_APPROVAL` and `REGISTRATION_REJECTED` arrive with the registration work in phase 5. They
are handled now so the middleware does not have to change when those statuses start being written —
and so that **any unrecognised status fails closed** as inactive rather than reading as permission.

`requireAccountCapability()` gates a route on the organisation having a capability enabled, reading
what `resolveAccountOrganisation` already resolved. A list means *any* of them is enough, since an
area such as My Entries & Bookings is reachable with either events or calendar bookings.

### A naming trap worth knowing

`organization_users.user_type` holds **`'org-admin'`** and **`'account-user'`** — that is what every
service reads and writes. The `org_admin_users` and `account_users` views created in migration
`013` filter on `'admin'` and `'account'`, so they match nothing. No code uses them; do not reach
for them.

---

## 4. Super-admin UI (`packages/admin`)

**Create / Edit Organisation** — a "Member portal code" field with a debounced availability check as
you type, showing `/account/<code>` beneath it. On edit it warns that changing the code breaks any
link members already have. Currency became **read-only**, showing the value inherited from the
organisation type; it was previously a free choice, which is exactly how a mismatch got created.

**Create / Edit Organisation Type** — the new `PaymentFeeEditor` component (screen
[J1](ACCOUNT_USER_APP_WIREFRAMES.md#j1--super-admin-handling-fees-on-an-organisation-type)): a card
per card method with the three rate fields and a **live worked example** that updates as you type.
The example is the point of the screen — three abstract numbers are hard to sanity-check, but a
concrete figure makes a mistyped `15%` instead of `1.5%` obvious immediately. Edit mode warns how
many organisations the change affects before saving.

---

## 5. The cart (phase 4)

**`cart.service.ts`** — the first consumer of the handling-fee calculator, and where the arithmetic
finally reaches a member.

| Method | Notes |
|---|---|
| `getOrCreateOpenCart` | Scoped by organisation *and* user; switching organisation switches cart |
| `getCart` | Items, totals and warnings in one call — the client renders, never recomputes |
| `addItem` | Snapshots the item's accepted payment methods onto the row |
| `setItemPaymentMethod` | Only to a method in that snapshot |
| `removeItem` / `removeExpiredItems` / `clear` | |

Two decisions worth knowing:

- **An expired hold is excluded from the totals but still shown**, with a warning. An item that
  vanishes between page loads with no explanation is worse than being told the hold lapsed — and an
  item the member can no longer buy must not inflate a total they are about to approve.
- **The accepted payment methods are snapshotted at add-to-cart time**, so a later change to the
  source item cannot retroactively widen what a member may switch to.

Routes, all under `resolveAccountOrganisation` so a member can only ever touch their own cart —
the cart is resolved from the member's identity, never from a cart id in the request:

```
GET    /api/account/:orgCode/cart
POST   /api/account/:orgCode/cart/items
PUT    /api/account/:orgCode/cart/items/:itemId/payment-method
DELETE /api/account/:orgCode/cart/items/:itemId
```

---

## 6. Registration and approval (phase 5)

**`account-registration.service.ts`** plus routes on both sides.

The design point is that **account activation and organisation approval are two independent gates**.
Keycloak owns the first (email verification); `organization_users.status` owns the second. A
verified member can sign in and still be told they are waiting — collapsing the two leaves someone
who has done everything asked of them locked out with no explanation.

| Setting | Behaviour |
|---|---|
| Auto-registration **ON** (default) | Registering makes the member active immediately |
| Auto-registration **OFF** | Registering leaves them `pending` until an administrator decides |

Stored at `organizations.settings.registration` via `jsonb_set` on that key alone — the column is
shared with branding, payment settings and email templates.

### Endpoints

```
POST /api/account/:orgCode/register              Connect the signed-in identity
GET  /api/account/:orgCode/registration-status   Backs "Check again" on screen A8

GET  /api/orgadmin/organisation/registration-settings      Screen I4
PUT  /api/orgadmin/organisation/registration-settings
GET  /api/orgadmin/organisation/registrations?status=      Screen I3
POST /api/orgadmin/organisation/registrations/:id/decision
```

The two account routes are deliberately **not** behind `resolveAccountOrganisation`: that middleware
refuses exactly the people these routes exist for. `registration-status` answers **200** with a
state rather than 403 — a member waiting for approval is asking a legitimate question, and the
awaiting-approval screen polls it.

### Decisions worth knowing

- **The email comes from the verified token, never the request body.** Otherwise a caller could
  register under someone else's address.
- **Registration is idempotent.** Registering twice returns the existing membership rather than
  erroring or creating a second row — a member who taps a link twice should not see a failure.
- **Turning auto-registration on does not approve the existing queue.** That is a separate,
  explicit `approvePending` flag, so flipping a setting cannot silently admit people an
  administrator was still considering.
- **A rejection note is internal.** It is written to `organization_audit_log` and never returned to
  the applicant; surfacing it invites arguments the platform cannot adjudicate.
- **Decisions are scoped to the acting organisation**, so a valid id from another organisation
  cannot be acted on.
- **Audit failures never fail the decision** they describe. A member must not be left un-approved
  because the audit table was busy.

### Emails

Five templates in `email.service`, following the existing invitation-email house style:

| Trigger | Email |
|---|---|
| Registered, auto-registration **on** | Welcome, with a link to the portal |
| Registered, auto-registration **off** | "We'll email you once you're approved" |
| Registered and approval needed | Notification to the organisation's nominated addresses, with the pending count |
| Approved | "You've been approved", with a sign-in link |
| Rejected | Declined, pointing at the club's contact address — **and no reason** |

Two rules the implementation holds to:

- **A mail failure never undoes the state change.** The membership row is committed before any email
  is attempted, and every send is caught and logged. A member must not end up un-registered because
  SES was unavailable.
- **The organisation is told only when someone has to act.** An auto-approved member generates no
  notification, because there is no decision to make.

The rejection email carries the organisation's contact address but never the administrator's note —
there is a test asserting the note does not appear in the payload.

### A deviation from the wireframe worth flagging

The design document sketches `POST /api/public/organisations/:code/register` creating the Keycloak
user as well. This implements it as an **authenticated** `POST /api/account/:orgCode/register` that
connects an identity Keycloak already created. Keycloak's own registration flow is already on the
sign-in screen (A3), so duplicating it would mean maintaining a second path to the same thing — and
an unauthenticated user-creation endpoint is a standing abuse target. The member's journey is
unchanged: register with Keycloak, verify, sign in, get connected. The same endpoint also serves an
existing member of another club joining this one, which is screen A6.

---

## 7. Tests

| Suite | Tests |
|---|---|
| `handling-fee.test.ts` | 28 — the document's worked example, rounding, allocation, multi-provider, all the "no fee" cases |
| `url-code.test.ts` | 24 — slugify, validate, uniqueness, reserved words |
| `organization-url-code.service.test.ts` | 15 — derivation, rejection of taken/malformed codes, ordering against Keycloak, the currency rule |
| `organization-type-payment-fee.service.test.ts` | 10 — rate validation, including tax of 0 |
| `PaymentFeeEditor.test.tsx` (Vitest) | 19 — worked example matching the backend, cleared fields, blast-radius warning, reset to default |
| `account-organisation.service.test.ts` | 23 — public field exposure, directory filters, paging caps, every membership state |
| `account-auth.middleware.test.ts` | 19 — each refusal code and status, failing closed on error and on an unknown status |
| `account-api.routes.test.ts` | 18 — authentication, route ordering, organisation resolved from the path |
| `cart.service.test.ts` | 24 — the worked example end to end, expired holds, payment-method switching, discount and quantity validation |
| `account-registration.service.test.ts` | 25 — both gates, idempotency, scoping, audit behaviour, settings isolation |

The backend and admin worked examples are asserted against the **same** figures (€62.00 base →
€1.18 net → €0.27 tax → €1.45), so the two implementations cannot drift silently.

### Pre-existing failures, unchanged by this work

Per project rule §3.3:

- **`npm run migrate:up` fails on a fresh database.** Migration `004` was later edited to seed
  fourteen capabilities that `018` also inserts, with no `ON CONFLICT` guard, so the run aborts on a
  duplicate key. Existing databases are fine; a new one cannot be bootstrapped. Left alone as
  out of scope — the one-line fix is `ON CONFLICT (name) DO NOTHING` on the inserts in `018`.
- Backend `tsc`: four errors in `index.ts`, `application-form.routes.ts`, `registration.routes.ts`,
  `merchandise.service.ts`.
- Admin Vitest: 11 failures across `RoleForm`, `RolesPage` and `organization-type-locale`
  (a name-sanitisation mismatch and `ApiProvider` wrapping), none in files this work touches.

One pre-existing failure **was** fixed, because it blocked verifying this change:
`organization.service.test.ts` could not compile — its `OrganizationType` mocks predated the
membership-numbering fields. With those added the suite runs and all 25 tests pass.

---

## 8. Pre-existing schema drift found while doing this

Adding `handling_fee_included` surfaced a wider pattern of service code referencing schema that no
migration ever created. **None of it was caused by this work.** It is recorded in full, with the
reasoning behind each type chosen, in [SCHEMA_DRIFT_AUDIT.md](SCHEMA_DRIFT_AUDIT.md).

**Fixed** (`1709000000008_add-missing-service-columns.js`) — eleven columns across six tables that
services INSERT but the schema lacked, breaking the create paths for events, event activities,
membership types, registration types and calendars, plus an account user's phone number.

**Fixed** (`1707000000018_update-capabilities.js`) — `npm run migrate:up` could not bootstrap a new
database: migration `004` was amended to seed capabilities that `018` also inserts, and `018` aborted
the run on a duplicate key. Now `ON CONFLICT (name) DO NOTHING`, matching what `024` already does.

**Fixed** (`1709000000009_create-missing-feature-tables.js`) — nine tables that existed only in code:
`discounts`, `discount_applications`, `discount_usage`, `user_groups`, `user_group_members`,
`event_types`, `venues`, `slot_reservations`, `membership_number_sequences`. The discount tables
came from `DISCOUNT_SYSTEM_PROPOSAL.md`; the rest from the columns their services already read and
write. `events.event_type_id` and `events.venue_id` now carry their foreign keys.

**Fixed** — `discount-validator.service` queried a `memberships` table that does not exist; the real
one is `members`. Membership-based discount eligibility could never be satisfied.

---

## 9. What this does not do

- **Nothing writes to `payment_transactions` yet.** The table and the cart exist; checkout — creating
  the payment, calling Stripe or Helix-Pay, and confirming from a webhook — is a later phase.
- **Nothing puts items into a cart yet.** `POST /cart/items` works, but no domain endpoint offers an
  event activity or membership type to add, and eligibility (entries open, not full — G8) is not
  checked. The cart trusts its caller for now, and says so.
- The account API surface is still thin: directory, switcher, shell bootstrap and cart.
- ~~**No front-end yet for any of this.**~~ Superseded by phase 6 —
  [ACCOUNT_USER_APP_PHASE6_SHELL.md](ACCOUNT_USER_APP_PHASE6_SHELL.md) builds `packages/account-shell`
  with the A-series screens (A1, A2, A4, A6, A7, A8) and the responsive shell. The org-admin
  approval queue (I3/I4) is still unbuilt and belongs in `orgadmin-core`.
- `handling_fee_included` still exists only on `event_activities`
  ([G4](ACCOUNT_USER_APP_WIREFRAMES.md#g4--handling_fee_included-exists-only-on-event-activities)).
- Registration approval ([G6](ACCOUNT_USER_APP_WIREFRAMES.md#g6--auto-registration-is-an-org-admin-setting))
  is not built.
- The handling-fee calculator is complete and tested but **not yet called by anything** — it exists
  for the cart in phase 4.
