# Profile save, basket wording, and the slot you already hold

Three changes. The first was a bug that made saving a profile impossible for
every member.

## "Failed to save the profile"

`PUT /api/account/:orgCode/profile` returned a 500 for any member with a
Keycloak identity — which is all of them. The real error was in the log:

```
operator does not exist: character varying = uuid
```

The update matched on either the Keycloak subject or the row id:

```sql
WHERE user_type = 'account-user'
  AND (
    ($5::uuid IS NOT NULL AND keycloak_user_id = $5)
    OR ($5::uuid IS NULL AND id = $6)
  )
```

`$5` is a **Keycloak subject**, and `organization_users.keycloak_user_id` is
`character varying`. The `::uuid` was intended as a local coercion for the null
test, but **Postgres infers one type per parameter for the whole statement** —
so that single cast made `$5` a `uuid` everywhere, including
`keycloak_user_id = $5`, where no `=` operator exists for that pair.

Fixed by casting to what the column actually is, and giving `$6` its own cast so
neither parameter's type depends on where it first appears:

```sql
($5::text IS NOT NULL AND keycloak_user_id = $5::text)
OR ($5::text IS NULL AND id = $6::uuid)
```

Verified live with the exact payload the profile page sends: 200, and the name,
phone and language written to **all three** of that member's club rows — which
is the documented intent, since these details belong to the person rather than
to one club.

The file was unchanged from `HEAD`, so this pre-dates the current work.

## The basket says what the expander does

`Your 2 answers` → **`Click to see your 2 entry form values`**, with the
singular form to match. It is a control, and the old label read as a heading
over content that was not there.

Applied to the `cart` section in all six locales. Worth noting: `yourAnswers`
also exists under `entry` — a different screen — so this had to be scoped rather
than replaced by name.

## A slot already in your basket is red

It was drawn in the club's primary colour. It is now `error.light` with an
`error.main` border, and remains unclickable.

The reasoning changed with it. Red is the right signal because this is the same
"not available to take" state as a slot somebody else holds — what it must *not*
look like is the disabled grey of a slot that was never on offer, which says
nothing about why. The "In your basket" caption and the live countdown beneath
are what tell the member this particular one is theirs rather than a stranger's.

## The entry detail screen shows the answers

`My entries & bookings` → an entry → **Your answers** said *"Your answers are not
available to view here."*

It was not a fallback for a missing case. The line was **unconditional** — the
screen had never rendered answers at all, and the message was a placeholder that
read like an explanation.

The member has nowhere else to look: the form is gone once the entry exists, and
`GET /form-submissions/:id` only serves lines still sitting in an **open**
basket, so it refuses the moment checkout completes. The reported entry was
awaiting payment — precisely when someone wants to check what they typed before
paying.

`getEntry` now returns `formSummary`, built by the same `utils/form-summary.ts`
the basket and My Memberships use, so all three describe one submission the same
way.

Shown in full rather than behind an expander, unlike My Memberships: that screen
lists several memberships each carrying a form, and the answers would bury the
number and expiry date. This page is *about* one entry, and there is nothing for
them to bury.

When an activity asked nothing, the page now says the entry had no form —
`entry.noAnswers` — which is a different statement from "we cannot show you what
you wrote". The old `entry.answersUnavailable` key is gone from all six locales.

Verified against the reported entry itself: Ward Union's *Hunt Ball Tickets —
Individual ticket*, still awaiting payment, now returns the four answers given,
including the dietary requirement.

## Verified

Backend 2776 passing; account-shell 524 passing.

The 3 remaining account-shell failures are all in `EntryFormPage`, from the
`packages/components` breakage described in
[PHANTOM_CAPABILITIES.md](PHANTOM_CAPABILITIES.md) — `FieldDatatype.PHONE` and
the `MultiSelectRenderer` checkbox rendering are absent from the working tree
while everything that consumes them still exists. Unrelated to these changes and
unchanged by them.
