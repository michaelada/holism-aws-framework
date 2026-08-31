# Sign-ins nobody could see, and sign-outs nobody recorded

Two faults in the session half of the audit trail, found while investigating an
unrelated event-date report. Both made the trail quietly incomplete rather than
wrong, which is why neither had been noticed.

## 1. A multi-club administrator could not see their own sign-ins

### Symptom

Signing in and out of the org-admin area produced no visible sign-in record.

### What the data said

The rows existed. What differed was `organisation_id`:

```
11:29  (null)                                admin@kildarehunt.test
11:27  0720cc06-a1a3-4290-abf6-a182419432cf  admin@meathhunt.test
11:23  (null)                                admin@kildarehunt.test
11:19  (null)                                admin@kildarehunt.test
```

Meath's administrator got a scoped row every time; Kildare's never did.

### Cause

`audit-auth.middleware.ts` attributed the event only when the person belonged to
exactly one organisation:

```ts
organisationId: result.rows.length === 1 ? result.rows[0].organization_id : null,
```

`admin@kildarehunt.test` administers two clubs — Kildare and Laois — so the
count was not 1 and the row was filed under nothing.

The org-admin viewer then scopes hard on that column:

```ts
if (query.organisationId !== 'all') add('a.organisation_id = ?', query.organisationId);
```

A null row matches no organisation, so it appears in **nobody's** trail.

The original reasoning was sound as far as it went — "somebody who administers
three clubs has not signed in to any particular one, and picking would put the
event in a trail it does not belong to". The consequence was not followed
through: the person most likely to ask "was that sign-in me?" is exactly the one
who could never find out.

### Fix

One row per organisation the person belongs to, via a new shared
`recordSessionEvent`. Each club's trail correctly shows that an administrator of
theirs signed in — true of every one of them — and no club is shown anything
about a club it has no relationship with.

Somebody who belongs to no organisation, such as a platform admin, still gets a
single unattributed row visible at platform level. A failed lookup still records
the event unattributed rather than losing it.

The cost is N rows for an N-club admin, once per session — bounded by the
existing `rememberSession` guard, and small next to what a null row costs in
usefulness.

## 2. Sign-out was never recorded at all

### Symptom

No `auth.logout` row had ever been written. Not one, in 721 events.

### Cause

`auth.logout` existed as a *label* only — in the permitted-action list
(`audit.types.ts`), in `auditLabels.ts`, and translated into all six locales.
Nothing emitted it. Every front end signed out like this:

```ts
const logout = useCallback(() => {
  keycloak?.logout();
}, [keycloak]);
```

The browser leaves for Keycloak and the API is never told. The viewer had been
built ready to display an event with no producer.

### Also found: the session-report endpoint had no callers

`POST /api/audit/session` exists to let applications report sign-in outcomes,
and the code comments state that "the applications report it". They do not — no
package calls it. `auth.login-failed` is therefore never recorded either, and
that half of the design has always been inert. This fix does not change that;
it is recorded here because the comments claimed otherwise and now say so
plainly.

### Fix

A new authenticated endpoint, `POST /api/audit/session/logout`, which records
`auth.logout` through the same `recordSessionEvent` used by sign-in, so both
halves of a session land in the same trails.

Authenticated, unlike the sign-in report: the token is still valid at that
point, and the actor must come from it rather than from the body, or anybody
could write a sign-out naming anybody. It also drops the session from the
sign-in memo, so the map does not hold dead sessions for its full twelve hours.

A shared `reportSignOut` in `packages/components` calls it, used by all four
front ends (`orgadmin-shell`, `account-shell`, `admin`, `frontend`).

Two properties matter, and both are about not getting in the way:

- **`keepalive: true`.** The redirect to Keycloak begins immediately afterwards,
  and a normal request is cancelled when the page goes away. Anything that
  awaited a response would either delay signing out or lose the event.
- **Every error is swallowed.** A lost sign-out row is a gap in a log; a failed
  sign-out is a security problem.

`admin`'s `ApiContext` also calls `keycloak.logout()`, on a 401. That one is
deliberately left alone: the token has already been rejected, so the report
could not authenticate, and a session expiry is not a sign-out.

## Tests

| File | Covers |
|---|---|
| `packages/backend/src/middleware/__tests__/audit-auth.middleware.test.ts` | One row per organisation; single and zero-organisation cases; the event survives a failed lookup; sign-out behaves like sign-in; one sign-in per session; anonymous requests ignored; a forgotten session records again |
| `packages/backend/src/__tests__/routes/audit-session.routes.test.ts` | The endpoint records `auth.logout` for the token's owner, forgets the session, refuses an unauthenticated report, ignores a non-string application, and answers 202 even when recording throws |
| `packages/components/src/utils/__tests__/signOutReport.test.ts` | Posts with the bearer token, sets `keepalive`, does nothing without a token, and swallows both rejected and synchronously-throwing fetches |

## Related

- `docs/AUDIT_TRAIL_AND_SESSIONS.md` — the design this corrects, §2.2 updated.
- `docs/EVENT_ENTRY_DATE_INVENTION_FIX.md` — found in the same investigation.
