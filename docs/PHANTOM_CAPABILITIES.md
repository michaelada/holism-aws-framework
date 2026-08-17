# "Invalid capabilities provided" — editing an organisation type

Reported as: setting the Irish Pony Club's application fee to €0.50 and pressing
save returned a **500**, with `Invalid capabilities provided` in the log.

The application fee had nothing to do with it.

## What was wrong

`organization_types.default_capabilities` held **22** names. Three of them were
not capabilities:

```
discounts            email-notifications            document-uploads
```

None of the three appears in the `capabilities` catalogue, and none is consulted
anywhere in the backend or in any front end. They are plausible-looking names
that gate nothing. All four organisations carried them too, copied from the same
seed.

The capability list is a free-form jsonb array — nothing constrains it on the
way in. But **every update re-validates the whole list**, so a record holding an
unknown name is *writable once and never editable again*. Changing any field
re-submits the capabilities, and validation refuses.

That is why an unrelated edit failed, and why the failure looked nothing like
its cause.

They pre-date the current work: they arrive in commit `ed13904`. The
capabilities added for Meath Hunt in this session were all checked against the
catalogue and are real.

## Four fixes

**1. The refusal now says which.** `validateCapabilities` returned a boolean, so
the message could only ever be "Invalid capabilities provided" — useless to a
super-admin who cannot see the catalogue and may not have touched the
capabilities at all. `unknownCapabilities()` returns the offending names:

```
Unknown capabilities: not-a-thing, also-not-a-thing
```

**2. It is a 400, not a 500.** The organisation-type route mapped errors by
matching substrings of the message, and this one matched none of them, so a
validation refusal fell through to "Failed to update organization type" with a
500. Both handlers now check `ValidationError` by type first. (The organisation
route already returned 400.)

**3. The seed no longer writes them**, and checks itself. It inserts straight
into the table, so nothing else would stop it writing a name the platform has
never heard of — and the consequence surfaces much later, somewhere else. It now
validates every capability it is about to write against the same catalogue the
API uses, and refuses with the offending names.

**4. Existing records are repaired** — migration `1709000000027`, written
generally rather than naming those three, since any record carrying any unknown
name is in the same unsaveable state.

Removing them is safe because a capability is only ever consulted by name: a
name nothing asks about grants nothing. The three were confirmed unused across
the backend and all four front ends first.

## A second fault, found while verifying

**The seeded super admin could not use the Platform Admin at all.**

`admin.routes` applies `requireAdminRole()` — the `admin` realm role — at router
level, and is mounted on `/api/admin` *before* the more specific routers, so it
guards every path under that prefix. The individual handlers then require
`super-admin` on top. A platform administrator needs **both**.

The seed granted only `super-admin`, so `super.admin@itsplainsailing.test` could
sign into the admin app and get a 403 from every request in it — including the
ones that fill the screen it lands on. The seed now grants both.

This is why the original report came from an older account: it had `admin` from
a previous setup, so its request reached the service and failed there instead.

## Verified

Against a running stack, with the exact scenario:

| | |
|---|---|
| `GET` the organisation type as the seeded super admin | 200 (was 403) |
| `PUT` it back with `applicationFeeFixed: 0.50` | **200** (was 500) |
| `PUT` with two genuinely unknown capabilities | 400, `Unknown capabilities: not-a-thing, also-not-a-thing` |
| The record after that refusal | unchanged, 19 capabilities |
| Phantom names anywhere in the database | none |
| Seed with a deliberately bogus capability | refuses, naming it |

Backend suite: 2773 passing. The 11 failures in `packages/admin` are
pre-existing — structural assertions in `RoleForm` and the locale tests, in a
package this change does not touch (CLAUDE.md §3.3).

## The general lesson

A list validated on write but not on read produces records that cannot be
edited, and the error appears on whatever field the user *was* changing. Where
the seed writes directly to a table the API guards, the seed has to enforce the
same rule — otherwise it manufactures records the API will not accept back.
