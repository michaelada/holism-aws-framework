# Schema drift audit

**Date:** 8 August 2026

Service code and org-admin forms in this repository referenced database columns and tables that no
migration ever created. **All of it is now fixed** — nine tables, eleven columns, a broken
bootstrap and a wrong table name.

Found while adding `handling_fee_included` to the sellable types for the account-user application
([G4](ACCOUNT_USER_APP_WIREFRAMES.md#g4--handling_fee_included-exists-only-on-event-activities)) —
that column turned out to be one instance of a wider pattern.

---

## How to reproduce the audit

Both checks below run against a database migrated to head. The second is the useful one to re-run
after any schema change.

```bash
# every column a service INSERTs, checked against information_schema
# (see the inline script in the phase-4 work, or adapt this query)
psql "$DATABASE_URL" -c "select table_name, column_name from information_schema.columns
                         where table_schema='public'"
```

---

## 1. Fixed — missing columns

`migrations/1709000000008_add-missing-service-columns.js`

Six tables were missing eleven columns their services INSERT and SELECT, so those create and update
paths failed outright with `column ... does not exist`:

| Table | Columns added | Type, and where the type came from |
|---|---|---|
| `events` | `discount_ids`, `event_type_id`, `venue_id` | `jsonb '[]'`, `uuid`, `uuid` |
| `event_activities` | `discount_ids`, `supported_payment_methods` | `jsonb '[]'` — as on the other four sellable types |
| `membership_types` | `discount_ids`, `fee` | `jsonb '[]'`, `decimal(10,2)` — as on `event_activities.fee` |
| `registration_types` | `discount_ids`, `fee` | same |
| `calendars` | `discount_ids`, `application_form_id` | `jsonb '[]'`, `uuid` — as on `event_activities` |
| `organization_users` | `phone` | `varchar(50)` — as on `organizations.contact_mobile` |

No type was invented: each is taken from an existing column of the same name elsewhere in the
schema, with the service bindings (`JSON.stringify(ids || [])` → `jsonb`) confirming the choice.

**What this unblocked:** creating an event, an event activity, a membership type, a registration
type or a calendar, and storing an account user's phone number. Verified by running each service's
own INSERT column list against a freshly migrated database.

**Two notes carried in the migration:**

- `event_activities` now has both `allowed_payment_method` (varchar, the original single-method
  form) and `supported_payment_methods` (jsonb, what the code actually uses). The old column is
  left in place — nothing reads it, but dropping it is a separate decision.
- `fee` here is `decimal(10,2)`, matching the existing domain tables. The newer cart tables use
  **integer minor units**. Convert at the boundary; never mix the two.

## 2. Fixed — `migrate:up` could not bootstrap a new database

`migrations/1707000000018_update-capabilities.js`

Migration `004` was amended at some point to seed fourteen capabilities that `018` also inserts.
On a database that ran the original `004` there is no overlap, so this was invisible. On a **fresh**
database `004` seeds them first and `018` aborted the entire run on a duplicate key — so
`npm run migrate:up` could not create a new database at all.

Fixed by making `018`'s inserts `ON CONFLICT (name) DO NOTHING`, in both `up` and `down`. Migration
`024` already took that approach, so this is the established pattern rather than a new one. Existing
databases are unaffected: `018` has already run for them and will not run again.

**Verified:** `npm run migrate:up` against an empty database now applies every migration and seeds
20 capabilities, with no manual intervention.

---

## 3. Fixed — nine tables that did not exist

`migrations/1709000000009_create-missing-feature-tables.js`

An earlier revision of this audit reported six. **The real count was nine** — the audit script
filtered for names containing an underscore, so `discounts`, `venues` and `user_groups` were missed.
The whole discount subsystem had no schema at all.

| Table | Source of its shape |
|---|---|
| `discounts` | [DISCOUNT_SYSTEM_PROPOSAL.md](DISCOUNT_SYSTEM_PROPOSAL.md) — the columns match `discount.service` exactly |
| `discount_applications` | Same, including the unique `(discount_id, target_type, target_id)` the service's `ON CONFLICT` needs |
| `discount_usage` | Same, with `user_id` pointed at `organization_users` rather than the proposal's `account_users` view |
| `user_groups`, `user_group_members` | `discount-validator.service` — group-based eligibility |
| `event_types`, `venues` | `event-type.service`, `venue.service` — plus the unique-per-organisation constraints whose `23505` the services already translate into a friendly message |
| `slot_reservations` | `calendar.service` — `rowToReservation` gives the full column list |
| `membership_number_sequences` | `membership-number-generator.service` |

With the tables in place, `events.event_type_id` and `events.venue_id` **now carry their foreign
keys** (`ON DELETE SET NULL`, so removing a venue leaves its events intact and unclassified).

### Two details that needed care

**`membership_number_sequences` uses `UNIQUE NULLS NOT DISTINCT`.** A null `organization_id` means
"numbering is unique across the whole organisation type". The generator upserts with
`ON CONFLICT (organization_type_id, organization_id)`, and Postgres treats each null as *distinct* by
default — so without this the organisation-type-level row would be inserted afresh on every
allocation instead of conflicting, and numbering would restart every time. Requires Postgres 15+;
this project runs 16.

**`discount_applications` needed its unique constraint** for the same reason: the service's
`ON CONFLICT (discount_id, target_type, target_id) DO NOTHING` infers against exactly that index, and
without it applying a discount twice would duplicate the row.

Both were verified by executing the services' own upserts three times and confirming one row.

## 4. Fixed — a wrong table name

`discount-validator.service` queried `FROM memberships`, which does not exist. The real table is
`members`, and it has the `user_id`, `status` and `membership_type_id` columns the query expects.
The call was wrapped in a `try`, so instead of crashing it pushed `ELIGIBILITY_CHECK_FAILED` —
meaning **membership-based discount eligibility could never be satisfied**. One-word fix.

---

## 5. Verification

Everything above was verified against **Postgres 16**, the version in `docker-compose.yml`. That
mattered: the local development machine had Postgres 14, on which `NULLS NOT DISTINCT` is a syntax
error, and the fault would have reached the Docker environment undetected.

- `npm run migrate:up` on an empty database: 34 migrations, no intervention.
- The audit re-run afterwards: **no column drift, no missing tables.**
- Each previously-broken service INSERT executed successfully.
- Both `ON CONFLICT` upserts verified idempotent.
- Full `down` then `up` round-trip with no errors.

---

## 6. Do the new tables have a UI?

Checked after the fact, tracing each table from an org-admin page through its route registration to
a mounted backend endpoint. **Six of the nine are complete end to end**; the other three are
explained below, and only one is a genuine gap.

| Table | Backend route | Admin page | Routed |
|---|---|---|---|
| `event_types` | ✅ | `EventTypesListPage` | ✅ `events/types` |
| `venues` | ✅ | `VenuesListPage` | ✅ `events/venues` |
| `discounts` | ✅ | `DiscountsListPage` / `CreateDiscountPage` / `EditDiscountPage` in five modules | ✅ |
| `discount_applications` | ✅ `POST /discounts/:id/apply` | via `DiscountSelector` | ✅ |
| `slot_reservations` | ✅ `POST /calendars/:id/reservations` | `ReserveSlotDialog` | ✅ `calendar/bookings` |
| `discount_usage` | ✅ `GET /discounts/:id/usage`, `/stats` | — | — |
| `membership_number_sequences` | — | — | — |
| `user_groups` | ❌ | ❌ | ❌ |
| `user_group_members` | ❌ | ❌ | ❌ |

**`discount_usage` and `membership_number_sequences` need no admin UI, by design.** Both are written
by the system rather than by a person: `discount.service.recordUsage` writes a usage row inside the
redemption transaction, and `membership-number-generator` allocates from the sequence when a member
is created. The sequence's *configuration* — internal vs external numbering, the starting number,
and whether numbering is unique per organisation or per organisation type — is on the super-admin
organisation type form. Usage has two read endpoints ready for a reporting screen whenever one is
wanted.

**`user_groups` / `user_group_members` was a real dead end — now built.** The validator could enforce
a `userGroups` criterion but nothing could create a group or put anyone in one. Closed by:

1. `user-group.service` and `user-group.routes` — CRUD plus membership, mounted at
   `/api/orgadmin/user-groups`, organisation resolved from the caller's token;
2. `UserGroupsPage` in `orgadmin-core`, routed at `users/groups`, with member management;
3. a **User groups** multi-select on the discount eligibility form.

Three further faults surfaced while wiring it up, all pre-existing — see §7.

---

## 7. Three eligibility faults found while building user groups

All three meant a discount restriction silently did nothing, which is the worst way for this to
fail: the org admin sets a rule, sees it saved, and it never applies.

**The membership-type criterion was stored under a key nothing reads.** The events discount form
wrote `membershipTypeIds`; `EligibilityCriteria` declares — and `discount-validator` reads —
`membershipTypes`. So a discount restricted to certain membership types read as having no
restriction and **applied to everyone**.

Fixed on both sides: the form now writes the canonical `membershipTypes`, and the validator
normalises either spelling so discounts saved before the change still work. Reading both was
preferred over migrating the stored JSONB, which would have to guess at rows this code has never
seen. The form also reads either key when loading a discount for editing.

**The user-group check failed open.** Its `catch` logged "tables may not exist yet" and returned no
error — a workaround for the missing table that, now the table exists, would grant eligibility to
everyone whenever the query failed. It now pushes `ELIGIBILITY_CHECK_FAILED`, matching the
membership check beside it. An eligibility check that fails open is worse than one that refuses.

**A property-based test asserted the bug.** `discount-validator.property.test.ts` expected the query
to contain `FROM memberships` — the table that does not exist. Updated to `FROM members`, which is
what made the suite go green again rather than the fix being reverted to satisfy it.

---

## 8. Also fixed: the discount eligibility block was English-only

`discounts.eligibility.*` existed only in `en-GB`; the other five locales had none of it. Adding the
`userGroups` label alone would have rendered one translated field beside a column of raw i18n keys,
so the whole block — twelve keys — is now present in all six locales, along with the new
`users.groups.*` set for the management page.
