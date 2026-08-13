# Soft delete for organisation catalogue entities

Five tables are soft-deleted: `events`, `merchandise_types`, `membership_types`,
`registration_types` and `calendars`. Deleting one marks it; the row stays.

| Table | Migration | Was |
|---|---|---|
| `events` | `1709000000017` | soft delete assumed by the code, columns missing — every list 500'd |
| `merchandise_types` | `1709000000018` | hard `DELETE`, cascading into option types, option values and delivery rules |
| `membership_types` | `1709000000018` | hard `DELETE` |
| `registration_types` | `1709000000018` | hard `DELETE` |
| `calendars` | `1709000000018` | hard `DELETE` |

## Why these five

Every one of them is referenced by something a member paid for or booked:
`event_entries` and `electronic_tickets` → events; `merchandise_orders` → merchandise types;
`members` → membership types; `registrations` → registration types; `bookings` → calendars.

A hard `DELETE` against a referenced row does one of two things, both bad: it fails on a foreign key
(so the button simply does not work, with a constraint name for an error message), or it succeeds
and takes the history with it. An organisation that stops offering a membership type still needs
last season's members to *have* a membership type.

Withdrawal is also not a rare admin action — it is the normal end of a season.

## The rule: withdrawn things stop being choosable, but stay resolvable

This is the part that is easy to get half-right, and getting it half-right is worse than not doing
it at all.

**Filtered (`deleted = FALSE`)** — anywhere a row is offered as a choice:

- org-admin lists: `getMerchandiseTypesByOrganisation`, `getMembershipTypesByOrganisation`,
  `getRegistrationTypesByOrganisation`, `getCalendarsByOrganisation`, `getEventsByOrganisation`
- get-by-id: stops a withdrawn row being reached by a stale link, an old cart line or an edit form —
  the id is still valid, so nothing else would refuse it
- the member-facing catalogue: `account-catalogue.service` for events and membership types
- renewal eligibility: `account-activity.service`'s set of types a member may renew into
- discount usage: `discount.service`'s "which types still use this discount?", which guards discount
  deletion — a withdrawn type must not keep a discount alive

**Deliberately not filtered** — anywhere a row is named rather than chosen:

- `reporting.service`'s membership aggregate: members who joined before a type was retired are still
  members, and their revenue still happened
- `merchandise.service`'s order-line name lookup: past orders must keep saying what was bought

Adding `deleted = FALSE` to those two in the name of consistency would blank out history rather than
tidy it. `soft-delete.service.test.ts` asserts both halves, including that the historical joins stay
unfiltered.

## What deletion now does

```sql
UPDATE <table>
SET deleted = TRUE, deleted_at = NOW(), deleted_by = $2, updated_at = NOW()
WHERE id = $1 AND deleted = FALSE
```

`AND deleted = FALSE` makes a repeat call a no-op that throws `not found or already deleted`, rather
than re-stamping the timestamp and overwriting the record of who withdrew it first.

`deleted_by` is the acting `organisation_users.id`, `ON DELETE SET NULL` — losing an administrator
must not erase the record that something was withdrawn. It is **optional** on these four services:
the routes pass it when the middleware has resolved an organisation user and `NULL` otherwise, so
adding attribution could not turn a working endpoint into a 400. `events` requires it, which is the
one inconsistency here and is worth levelling up rather than down.

## Merchandise: children are no longer destroyed

`deleteMerchandiseType` used to hard-delete the type's option types, option values **and** delivery
rules before deleting the type itself. That made the action unrecoverable in a way the word "delete"
did not convey — the sizes and colours a garment was sold in vanished, and any order referencing
them lost its meaning.

Withdrawing the parent now hides the whole thing from the catalogue, which is what the action is
for. The children stay with it.

## `bookings` is deliberately excluded

A booking already carries `booking_status`, `cancelled_at`, `cancelled_by`, `cancellation_reason`,
`refund_processed` and `refunded_at`, and `cancelBookingWithRefund` sets them. Cancellation *is* the
soft delete for bookings, and it records more than a boolean could.

Adding `deleted` beside that would create a second, competing answer to "is this booking still
real?", and every query touching bookings would have to remember to check both — which is precisely
the kind of thing that gets missed in one place and produces a booking that is cancelled on one
screen and live on another.

## Not included

- **No restore.** Nothing un-sets `deleted`. The columns make it possible, but no endpoint or screen
  exposes it, so a withdrawal is currently reversible only by hand in SQL.
- **No purge.** Withdrawn rows stay indefinitely. That is the intent for records tied to payment
  history, but there is no retention policy expressed anywhere.
- **The org-admin UI still says "Delete".** The API now withdraws; the wording in the front ends has
  not been revisited, so a user is told something more final than what happens.
