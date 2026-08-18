# One administrator, several clubs

Being an org admin in more than one organisation with a single email address.

**Status: implemented**, and it grew. What began as "can one person administer
two clubs?" turned up a tenancy fault in 30 routes (§0), and then — while
scoping the last task — a much larger one in **127 more**. All of it is fixed and
verified; see [ORGADMIN_ROUTE_TENANCY.md](ORGADMIN_ROUTE_TENANCY.md) for the
second, larger finding.

> **Correction.** §2.1 of this document originally described the routes that do
> not name an organisation in their URL as *"safe today, ambiguous under
> multi-org"*. That was wrong. It assumed they resolved the organisation from
> the token; 127 of them resolved nothing at all, and were reachable by any
> authenticated user of any club. The table below has been corrected and the
> full account is in the companion document.

The database has always allowed it — `organization_users` is unique on
`(organization_id, keycloak_user_id)`, not on email, and account users already
live that way. Three things in the application prevent it, and finding them
turned up a fourth problem that is worse and has nothing to do with this
feature.

---

## 0. Read this first: the tenancy check that wasn't there

**Fixed.** Before this change an org admin could read and write another
organisation's data, with one organisation and no multi-org work involved.

The org-admin data routes take the organisation from the URL:

```ts
router.get(
  '/organisations/:organisationId/events',
  authenticateToken(),
  ...requireOrgAdminCapability('event-management'),
  async (req, res) => {
    const { organisationId } = req.params;                    // ← the URL
    res.json(await eventService.getEventsByOrganisation(organisationId));
  }
);
```

`requireOrgAdminCapability` looks up the caller's *own* organisation from the
token, checks that **it** has the capability, and sets `req.organisationId`. The
handler then ignores that and uses `req.params`. **Nothing compares the two.**

Reproduced against the running stack, driving the real middleware chain with the
Kildare administrator's identity and Laois's id in the URL:

```
own org      -> allowed
ANOTHER org  -> allowed                             ← the fault
  middleware resolved organisationId = eae60fd0…  (Kildare)
  but the URL said                    3752a3be…  (Laois)
  Laois events the handler would return: 4
```

And after the fix, through the real HTTP stack, as an administrator of Kildare
**and** Laois but not Ward Union:

```
events @ Kildare     -> 200  6 events
events @ Laois       -> 200  4 events
events @ Ward Union  -> 403  You do not administer this organisation
events @ garbage id  -> 403
```

Any authenticated org admin whose own organisation had a given capability could
substitute another organisation's id and act on it. **30 routes across 12 files**
were shaped this way — events, memberships, merchandise, calendars, discounts,
registrations, ticketing, venues, payments, reporting, event types and
application forms. One condition in one middleware covers all of them, because
they all pass through the same chain.

This is a prerequisite rather than a digression: **the fix and the feature are
the same change.** Once the guard asks "does the caller administer *the
organisation in this URL*?", multi-org support falls out of it, because the
question stops being "what is this administrator's organisation?" and becomes
"is this one of them?".

---

## 1. Requirements

### 1.1 Tenancy (the fix)

| | |
|---|---|
| **R1** | A request naming an organisation is refused unless the caller administers **that** organisation |
| **R2** | Capabilities are read from the organisation being acted on, never from another |
| **R3** | Roles are evaluated per organisation — a role held at club A grants nothing at club B |
| **R4** | Refusal is `403` and says nothing about whether the organisation exists |

### 1.2 Multiple organisations (the feature)

| | |
|---|---|
| **R5** | One email address can be an administrator in any number of organisations |
| **R6** | Adding an existing person to a second organisation reuses their identity — no second Keycloak user, no second password |
| **R7** | After signing in, an administrator of several sees which one they are in, and can change it |
| **R8** | The choice survives a reload and a new session |
| **R9** | An administrator of exactly one sees no switcher and nothing new |
| **R10** | Capabilities, roles, branding and language all follow the selected organisation |

### 1.3 The three blockers

**Creation fails at Keycloak.** `org-admin-user.service.create` checks for a
duplicate *within the organisation*:

```sql
SELECT id FROM organization_users WHERE organization_id = $1 AND email = $2
```

so a second organisation passes the check — and then calls
`client.users.create({ username: data.email, … })` unconditionally, which
Keycloak refuses because that username already exists in the realm. There is no
adopt-existing path. The seed's `upsertUser` already has one ("creates a user, or
adopts one that already exists with the same username"); this is the missing
half.

**Sign-in picks arbitrarily.** `orgadmin-auth.routes` and the capability
middleware both end in:

```sql
WHERE ou.keycloak_user_id = $1 AND ou.user_type = 'org-admin' AND ou.status = 'active'
LIMIT 1
```

`LIMIT 1` with **no `ORDER BY`**. With two rows the administrator lands in
whichever one Postgres returns, and nothing makes that stable between requests.

**Roles are gathered across every organisation.** `orgadmin-role.middleware`
collects role names for the identity with no organisation filter at all, so a
role held at club A would satisfy a role check for a request against club B.
Harmless while everyone has one organisation; a privilege escalation the moment
they do not. This is R3.

---

## 2. Design

### 2.1 Two families of route, two answers

| | Count | Organisation comes from | Today | Under multi-org |
|---|---|---|---|---|
| **A** | 30 routes, 12 files | the URL (`/organisations/:organisationId/…`) | ~~unverified — §0~~ **membership verified** | works unchanged |
| **B** | 23 routes | `withOrganisation`, from the token | correct; now header-aware | explicit |
| **C** | **127 routes** | ~~**nothing at all**~~ | ~~reachable by any authenticated user~~ **scoped by resource, param, body or current organisation** | explicit |

Family C is the correction above: these name a *resource* rather than an
organisation, and asked no question about either. See
[ORGADMIN_ROUTE_TENANCY.md](ORGADMIN_ROUTE_TENANCY.md).

Family A is the fix. Family B is the design question.

### 2.2 Family A — verify what the URL claims

One middleware, replacing the lookup inside `requireOrgAdminCapability`:

```
resolveOrgAdminOrganisation()
  organisationId := req.params.organisationId
  row := org-admin row for (this identity, THAT organisation), active, org active
  none? → 403
  set req.organisationId, req.organisationUserId, req.capabilities from THAT row
```

The capability check then reads the organisation being acted on, which is R2.
`req.organisationId` becomes trustworthy for the first time, and the 29 handlers
reading `req.params.organisationId` can keep doing so — the value has been
verified by the time they see it.

**Multi-org needs nothing further here.** "Do they administer this one?" is
already the right question for an administrator of six.

### 2.3 Family B — a current organisation, chosen explicitly

These routes have no organisation in the URL: Settings, Users, Forms, file
uploads and most of Payments. Three ways to tell them which club:

| | |
|---|---|
| **Put it in the URL, like Family A** | Consistent, and makes every org-admin URL self-describing. ~60 routes and every front-end call site change |
| **A request header** (`X-Organisation-Id`) | Small change: one interceptor client-side, one middleware server-side. But an organisation that is not in the URL is invisible in logs, unshareable as a link, and easy to forget |
| **Server-side "current organisation"** (a column, set by the switcher) | Smallest client change. Worst behaviour: two tabs on two clubs fight, and the answer to "which club is this?" lives outside the request |

**Recommendation: the header, then migrate to the URL.** The header closes the
gap in one place and is what makes the feature shippable; moving Family B under
`/organisations/:organisationId/` afterwards is mechanical, testable route by
route, and can happen without the front end changing again if the interceptor
keeps sending the header during the transition.

Server-side current-organisation is the one to avoid: it makes the answer depend
on hidden state, and the two-tabs case has no good outcome.

### 2.4 Sign-in returns a list

`GET /api/orgadmin/auth/me` currently returns one `organisation`. It becomes:

```jsonc
{
  "user": { … },
  "organisations": [                    // every active org-admin row, name-ordered
    { "id": "…", "displayName": "Kildare Hunt Pony Club", "urlCode": "khpc" },
    { "id": "…", "displayName": "Laois Hunt Pony Club",   "urlCode": "lhpc" }
  ],
  "organisation": { … },                // the current one, in full, as today
  "capabilities": [ … ],                // of the current one
  "roles": [ … ]                        // in the current one
}
```

`organisation`, `capabilities` and `roles` keep their present shape, so nothing
downstream of `useAuth` changes. Which one is current: the header if it names one
the caller administers, else the last one they used
(`user_onboarding_preferences`, which already exists), else the first by name.
Deterministic in every case — the `LIMIT 1` is gone.

**An administrator of one sees no difference.** `organisations` has one entry,
the shell renders no switcher, and R9 is satisfied by the data rather than by a
flag.

### 2.5 Adopt, don't create

`org-admin-user.service.create` gains what the seed already does: look the
username up first, adopt the existing Keycloak user if there is one, and only
create when there is not. The per-organisation duplicate check stays as it is —
it is already the right check.

Adopting means the person keeps **one password, one email address, and one set
of credential-change flows** ([ACCOUNT_SELF_SERVICE_CREDENTIALS.md](ACCOUNT_SELF_SERVICE_CREDENTIALS.md)).
Two Keycloak users sharing an email would be two passwords that drift apart, and
the address is the username, so the second could not be created anyway.

Two consequences to handle explicitly:

- **No invitation email with a temporary password** when the identity already
  exists — they have a password. They get "you now administer X" instead, which
  is a different mail and a different sentence.
- **Removing them from one organisation must not delete the Keycloak user.**
  Today's delete path can assume one row per identity; it will need to delete the
  Keycloak user only when the last row goes.

### 2.6 Keycloak groups already work

Org admins are added to their organisation's `admins` subgroup. Membership of
several such groups is ordinary Keycloak, needs no change, and is not what
authorises anything — the `organization_users` row is. Worth stating because it
looks like it might be the blocker and is not.

---

## 3. Screens

Wireframes: [ORGADMIN_MULTI_ORGANISATION_WIREFRAMES.md](ORGADMIN_MULTI_ORGANISATION_WIREFRAMES.md).

The account app has solved this once already (A7), and the org-admin version
should not invent a second idiom. The differences are that an administrator's
switch changes capabilities — so the **navigation itself** changes — and that
there is no `:orgCode` in the URL to switch to.

---

## 4. Task breakdown

Ordered so the security fix ships first and alone.

| # | Task | Where |
|---|---|---|
| ✅ **1** | `resolveOrgAdminRow` — verify the URL's organisation against the caller | `capability.middleware.ts` |
| ✅ **2** | Scope `orgadmin-role.middleware` to one organisation (R3) | `orgadmin-role.middleware.ts` |
| ✅ **3** | Regression tests: cross-organisation access refused, by URL and by header | `orgadmin-tenancy.middleware.test.ts` |
| ✅ 4 | `/auth/me` returns `organisations[]` and a deterministic current one | `orgadmin-auth.routes.ts` |
| ✅ 5 | `X-Organisation-Id`, honoured by the routes that name no organisation | `capability.middleware.ts` |
| ✅ 6 | Adopt-or-create, and delete-last-row-only | `org-admin-user.service.ts` |
| ✅ 7 | "You now administer X" email | `email.service.ts` |
| ✅ 8 | Switcher in the shell; send the header; persist the choice | `orgadmin-shell`, `orgadmin-core` |
| ✅ 9 | Re-resolve capabilities, roles and navigation on switch | `orgadmin-shell` |
| ✅ 10 | i18n × 6, seed, docs, module summaries | |
| ✅ 11 | Scope every remaining org-admin route | 127 routes — [ORGADMIN_ROUTE_TENANCY.md](ORGADMIN_ROUTE_TENANCY.md) |
| ⬜ 12 | *Optional:* move the resource-keyed routes under `/organisations/:organisationId/` too | cosmetic |

**Task 11 turned out not to be the tidying this document called it.** Scoping
those routes was the remediation of a live hole, not a legibility improvement.
What remains (12) genuinely is cosmetic: every org-admin route now establishes
and verifies its organisation, and putting the id in the path as well would only
make the URLs self-describing in a log.

## 7. Verified

Live, against the running stack, as an administrator of two clubs:

| | |
|---|---|
| `/auth/me` | both organisations listed, Kildare current |
| `/auth/me` + `X-Organisation-Id: laois` | current becomes Laois, **with Laois's capabilities** |
| `/auth/me` with no header, next call | still Laois — the choice was remembered |
| Events at Kildare / Laois | `200`, 6 and 4 events |
| Events at Ward Union | `403` — administered by somebody else |
| Events at a malformed id | `403`, no query issued |

Backend 2881 passing, orgadmin-core 699, orgadmin-shell 686.

The seed now makes Kildare's administrator an administrator of Laois as well
(`ORG_ADMIN_ALSO_ADMINISTERS`), because an administrator of one club cannot
demonstrate any of this.

## 5. Deliberately left

**Super admins are unaffected.** They already reach every organisation through
`/api/admin`, by a different route and a different role.

**No per-organisation profile.** Name, phone and language stay properties of the
identity, as they are for account users. An administrator called something
different at two clubs is not a requirement anybody has.

**Account-user and org-admin rows stay separate**, keyed by `user_type`. One
person can already be a member of one club and an administrator of another; that
works today and nothing here changes it.
