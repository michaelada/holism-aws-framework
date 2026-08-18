# Every org-admin route now says which organisation it is about

**127 org-admin routes carried `authenticateToken()` and nothing else** — no
capability check, no role check, no organisation check. Any signed-in user of
any club could read and write any other club's data.

Found while scoping the last task of
[ORGADMIN_MULTI_ORGANISATION.md](ORGADMIN_MULTI_ORGANISATION.md), which had
described these routes as "safe today". They were not.

## What it looked like

Verified against the live development database, signed in as an **ordinary
member with no org-admin row anywhere**:

```
caller is an org-admin anywhere? false
GET  /events/:id            -> 200  "Spring Show Jumping League"  (Kildare)
PUT  /events/:id            -> 200        ← it wrote
GET  /events/:id/entries    -> 200
GET  /membership-types/:id  -> 200  "Junior Member"              (Kildare)
```

Read from the code rather than exercised, because running them would have done
real damage:

| | |
|---|---|
| `POST /users/admins/:id/reset-password` | set any administrator's password, in any organisation |
| `POST /users/admins/:organizationId` | make yourself an administrator of any club |
| `POST /payments/:id/refund` | move money |
| `DELETE` on events, calendars, forms, merchandise, registration types | destroy another club's data |

`user-management.routes.ts` applied `router.use(authenticateToken())` and no
other guard to all 14 of its routes.

## Why it was invisible

**Authentication answers *who*. It never answered *where*.** A route with
`authenticateToken()` looks guarded — there is a guard right there in the
declaration — and nothing distinguishes it from one that also asks which club
the caller may act in. The omission had no symptom: every screen worked, every
test passed, and the routes behaved correctly for the only thing anyone ever
did with them, which was to act on their own club.

The 30 routes fixed earlier were the visible half, because those *named* an
organisation in the URL and visibly failed to check it. These named a resource
instead, so there was nothing to notice.

## The fix

One middleware — `src/middleware/organisation-scope.middleware.ts` — that
resolves the organisation a request concerns and runs it through the same
membership check every other org-admin route uses.

Four sources, because the routes genuinely differ:

| Guard | The organisation is | Used by |
|---|---|---|
| `byResource(kind, param)` | whoever owns the thing being acted on | `/events/:id`, `/tickets/:ticketId`, … |
| `byParam(name)` | already in the path under another name | `/admins/:organizationId` |
| `byBodyOrCurrent()` | what a create names, else the current one | `POST /events`, `POST /discounts` |
| `byCurrentOrganisation()` | the one being worked in (`X-Organisation-Id`) | collections with nothing to key on |

### Three details that matter

**A resource in another club and a resource that does not exist answer
identically** — `403`, same message. Otherwise every one of these routes becomes
a way of asking whether an id is real.

**Ownership is resolved by joining, not by copying.** A booking has no
organisation of its own; its calendar does. A ticket's belongs to its event.
Joining keeps the answer true if a resource ever moves, where a denormalised
column would quietly go stale.

**`byBodyOrCurrent` falls back rather than demanding the field.** `POST /events`
has always let the server decide the organisation and its handler reads
`req.organisationId`. A guard that insisted on a body field would have broken
creating an event — and a guard that breaks the thing it protects gets removed.

### The refund route is scoped by the payment, deliberately

Not by the `organisationId` in its body, which the handler used to trust. A
caller supplying both could otherwise refund another club's payment by naming
their own. The body field is now ignored in favour of the verified value.

## What stops it coming back

`src/routes/__tests__/orgadmin-routes-are-scoped.test.ts` reads every org-admin
router and fails if any route is scoped by authentication alone, naming it:

```
+   "GET /api/orgadmin/events/:id   [event.routes.ts]",
```

A structural test rather than a behavioural one, because the failure it guards
against is **omission** — and omission is exactly what no behavioural test
catches, since nothing fails when a guard is simply absent.

It is itself guarded two ways: a count assertion, so a rename that silently
emptied the router list turns into a failure rather than a test that always
passes; and it was checked by deleting a real guard and confirming it failed by
name.

## Verified

| | Before | After |
|---|---|---|
| Ordinary member → another club's event | `200`, and `PUT` wrote | **`403`** |
| Ordinary member → membership types, forms, entries | `200` | **`403`** |
| Ordinary member → create an event | reached the handler | **`403`** |
| Member → reset an administrator's password | reached the service | **`403`** |
| Kildare admin → Ward Union's admins, payments, refunds | `200` | **`403`** |
| Kildare admin → their own club, all of the above | `200` | `200` |

Backend **2902 passing**; type-clean.

Test data touched during verification was restored: two event names, checked
against the seed, and no rows left behind.

## The organisation is in the URL as well

Done after the above, and worth separating: it changes what a request *says*,
not what it is allowed to do.

Every org-admin data router is now mounted twice —

```
/api/orgadmin/organisations/:organisationId/events/:id   ← what the app sends
/api/orgadmin/events/:id                                 ← still accepted
```

— and the org-admin app sends the scoped form. A request is now legible in a log
without cross-referencing a header against a session.

### Done centrally, not at 243 call sites

The front end has **243 org-admin URLs across 81 source files**, and **40 of
those files have no organisation in scope**. Spelling the id out at each call
site would have meant threading state through forty files to change what appears
on the wire — forty chances to break a working screen, for a string that one
function can produce correctly every time.

So `organisationScopedUrl` in `orgadmin-core/src/hooks/useApi.ts` rewrites the
URL as the request goes out, from the organisation the shell already resolved.
`/api/orgadmin/auth/*` is exempt: `/auth/me` is how an administrator finds out
which organisations they have, so requiring one in order to ask would be
circular.

`orgadmin-events`' `discount.service.ts` keeps its own axios instance and
therefore received none of this — **including the organisation header**, which
was a real gap rather than a cosmetic one. Its interceptor now sends both.

### A prefix that cannot lie

The path and the subject must agree. Without that check, an administrator of two
clubs could put club A in the path and club B's event id after it: each check
passes alone, and the URL ends up describing something the request did not do. A
prefix that can lie is worse than no prefix.

```
/organisations/<kildare>/events/<kildare event>  -> 200
/organisations/<laois>/events/<laois event>      -> 200   (same administrator)
/organisations/<kildare>/events/<laois event>    -> 403   ← the check
/organisations/<ward>/events/<kildare event>     -> 403   (not their club)
```

### Mount order is load-bearing

Registering the scoped mount first broke discount filtering, and it took a test
failure to notice. `/organisations/X/discounts/events` had its prefix stripped
and was offered to the same router as `/discounts/events`, where `/discounts/:id`
matched it and read "events" as a discount id — answering `400` instead of a
list.

The bare mount is registered **first**, so a fully-specified route wins where one
exists and everything else falls through to the scoped mount. Verified: the
module-type route answers `200` again, and both URL forms work.

## Still open

Removing the unscoped mounts. Nothing in the app depends on them now except
`/auth/*`, which is exempt by design, but a few direct callers remain and there
is no security reason to hurry — both forms are equally checked.
