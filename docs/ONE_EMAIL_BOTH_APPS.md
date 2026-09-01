# One email address, both applications

## The requirement

A person who administers a club should also be able to hold a member account at that club, on the
**same email address**. Running a club and taking part in it are ordinary things for one person to
do — the club secretary enters their own pony.

That was not possible. Pressing "Create an account" in the account app as an administrator of the
club first produced a 500, and then — after a wrong first fix — a refusal:

> This email already administers this club, so it cannot also hold a member account here. Sign in
> with a different email address to join as a member.

That message has been removed. It described a database constraint as though it were a policy.

## What was actually stopping it

```
"organization_users_org_kc_user_unique" UNIQUE (organization_id, keycloak_user_id)
```

One row per identity per organisation, whatever its `user_type`. So an identity could be an
administrator *or* a member of a club, never both. Nothing about the rest of the design required
that: it came in with the table in migration `1707000000003` and was never revisited.

The first fix took the constraint as intent and made the collision a polite 409. It was the wrong
reading — a guard for a rule nobody had asked for.

## The change

Migration `1709000000038_organization-user-per-type` puts `user_type` in the key:

```
"organization_users_org_kc_user_type_unique" UNIQUE (organization_id, keycloak_user_id, user_type)
```

The uniqueness that *is* wanted still holds — one administrator row and one member row per identity
per club, and no duplicates of either.

### Why this is safe

**Both applications already resolve their own row by type.** That is what makes two rows two
independent relationships rather than an ambiguity:

| Resolver | Filter |
|---|---|
| `organisation-scope.middleware` — every org-admin route | `user_type = 'org-admin'` |
| `capability.middleware.resolveOrgAdminRow` | `user_type = 'org-admin'` |
| `orgadmin-auth.routes` `/auth/me` | `user_type = 'org-admin'` |
| `account-organisation.service.resolveMembership` | `user_type = 'account-user'` |
| `account-organisation.service.getOrganisationsForUser` | `user_type = 'account-user'` |

Everything that hangs off a person in a club — carts, bookings, entries, payments, memberships —
references `organization_users.id`, and the account app only ever obtains that id through
`resolveMembership`. So a member's basket belongs to the member row and an administrator's actions
to the administrator row, with no shared state between them.

Every query touching `organization_users` by `keycloak_user_id` was audited. Twenty-four already
named a `user_type`. Of the six that did not, four are unaffected — a `SELECT DISTINCT
organization_id`, a lookup by primary key, an "is this Keycloak identity still used anywhere" check
before deleting a realm user (which is now *more* correct), and a join that reaches
`organization_users` only through `members`. Two needed fixing:

| Where | Why |
|---|---|
| `registration.routes` — `GET /organisations/:id/registrations/filters` | An org-admin route reading that administrator's own saved filters, with an unqualified `LIMIT 1`. Two rows and it could key the filters to the wrong one. Now `user_type = 'org-admin'` |
| `account-dashboard.service` — `already_joined` | Marks other clubs a member has joined. Administering a club is not being a member of it, so a club the person only administers read as already joined and the offer to join it never appeared. Now `user_type = 'account-user'` |

### Registering twice

`register` still returns the existing membership rather than failing when one is already there. The
insert now carries `ON CONFLICT (organization_id, keycloak_user_id, user_type) DO NOTHING` and reads
back the winner, which covers the one case the check cannot: two requests racing, as a
double-tapped button produces. Registering twice has never been an error and is not one here.

### Reversing it

`down` restores the old constraint, and **fails if anyone has taken up the offer** — recreating it
would mean deciding which of somebody's two rows to delete, which is a decision about their data,
not a schema detail. Resolve the duplicates deliberately, then run it.

## Verified against the running system

With the backend on `:3000`, as `admin@kildarehunt.test` — an administrator of `khpc`:

```
POST /api/account/khpc/register   →  200 {"outcome":"active"}          (was 500, then 409)

GET  /api/account/organisations   →  member of khpc, wupc
GET  /api/orgadmin/auth/me        →  administers khpc, lhpc
```

Both, at the same time, on one email address. The row created by that check was removed afterwards,
so the flow is unexercised and behaves as it will for the first real user.

## Tests

`account-registration.service.test.ts` — an identity that already administers the club registers
successfully; the guard looks only for a member row, which is exactly what the constraint keys on
(guard and constraint agreeing is the property that matters, and their disagreeing is what caused
the original 500); a racing duplicate resolves to the existing membership; the insert carries its
`ON CONFLICT`.

The tests written for the 409, in the account service, the route and the register page, are gone
along with the behaviour, as are the six translations of that message.
