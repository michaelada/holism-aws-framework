# Organisation status: two states, and no deletion

Organisation status collapses from three values to two, and deleting an organisation is retired in
favour of deactivating it.

---

## 1. Why `blocked` is gone

The column allowed `active`, `inactive` and `blocked`. **Nothing in the platform ever distinguished
the last two.** Every gate tested `status = 'active'`:

| Where | Check |
|---|---|
| Public club directory | `o.status = 'active'` |
| Club lookup by `url_code` | `o.status = 'active'` |
| A member's organisation list | `o.status = 'active'` |
| `/me` → `ORGANISATION_UNAVAILABLE` | `status !== 'active'` |

So `inactive` and `blocked` produced byte-for-byte identical behaviour. They differed in exactly one
place: the admin UI coloured one grey and the other red, implying a severity the platform did not
implement.

A distinction that lives only in a chip colour is worse than no distinction, because an operator
reasonably assumes "blocked" is more forceful than "inactive" and acts on that belief. Two states
make the model honest.

The column had no `CHECK` constraint, which is how a third value accumulated meaning it never had.
It has one now, so a fourth cannot appear the same way.

## 2. What `inactive` means

**Closed to everyone. Nothing deleted.**

| Audience | Effect |
|---|---|
| Members | The club vanishes from the public directory, `/account/:urlCode` stops resolving, and anyone signed in gets the unavailable screen |
| **Club administrators** | **Cannot sign in to `/orgadmin`, and any existing session stops working on its next request** |
| Platform super admin | Sees the organisation normally, and can set it back to `active` |
| The data | Entries, memberships, orders, tickets, bookings and payment history are all untouched and return intact on reactivation |

The administrator row is the change. Until now, deactivating an organisation shut its *members* out
while its *administrators* carried on working inside it — the opposite of what "inactive" is taken
to mean.

### Where that is enforced

| File | Gate |
|---|---|
| `routes/orgadmin-auth.routes.ts` | Sign-in refused with `ORGANISATION_INACTIVE` and a message naming the reason |
| `middleware/capability.middleware.ts` | Every capability-gated request re-checks `o.status` |
| `middleware/orgadmin-role.middleware.ts` | Role resolution joins `organizations` and requires `o.status = 'active'` |

All three, not just the first. Gating only sign-in would leave every administrator already signed in
working normally until their token expired — precisely the window that matters when an organisation
is deactivated. The capability middleware re-reads the status on every request, so deactivation
takes effect immediately.

The refusal message names the reason rather than saying "access denied". The administrator already
knows the organisation exists; a vague refusal would send them to support to be told the same thing.

## 3. Deleting an organisation is retired

The delete action is gone from the admin UI. In its place, the organisations list offers **Make
inactive** (per row and in bulk) and **Reactivate**, and the organisation editor's Status field
carries the consequences inline.

### The endpoint refuses rather than disappearing

`DELETE /api/admin/organizations/:id` still exists and answers **409** with
`code: DELETE_NOT_SUPPORTED` and an instruction to deactivate instead. Removing the route would
answer 404, which reads as "wrong URL" and invites a caller to go looking for the right one. A 409
that names the alternative says what actually changed — and stops an older client believing a delete
succeeded.

`organizationService.deleteOrganization` remains on the service, now unreferenced by any route.
Removing it is a separate decision about an operational escape hatch; this change is about the
product surface.

`deleteOrganization` was removed from the admin API client, since nothing calls it.

### Why deactivation is the better primitive

A club's record is the spine of its members' history: entries, memberships, orders, tickets and
payments all hang off `organization_id`. Deleting it either cascades that away or fails on foreign
keys — and the old implementation refused outright when the organisation still had users, so in
practice deleting a club that had ever been used was already impossible. Deactivation does what an
operator actually wants (make it stop) without the part nobody wants (lose the history).

## 4. Confirmation copy

Both the row action and the bulk action state the blast radius before running, in the same voice
`PaymentFeeEditor` established, and the single-organisation action requires the club's name to be
typed:

> **Killarney Sailing Club** will be closed to everyone until it is set back to active. Nothing is
> deleted.
>
> ⚠ 214 members lose access immediately and the club disappears from the public directory —
> `/account/khpc` will stop working. Its 3 administrators will not be able to sign in either.
> Entries, memberships, orders and payment history are all kept and return when you reactivate it.

The Status field in the organisation editor shows the same warning when the value is changed from
active to inactive, because that is the other route to the same outcome and it is an ordinary save
rather than a confirmed action.

## 5. Changes

| Area | Change |
|---|---|
| Migration `1709000000022` | `blocked` → `inactive`, NULL → `active`, plus a `CHECK` constraint on the two values |
| `types/organization.types.ts` (backend, admin), `admin.types.ts`, `OrganisationContext.tsx` | `'active' \| 'inactive'` |
| `orgadmin-auth.routes.ts` | Sign-in gated on `o.status`, with `ORGANISATION_INACTIVE` |
| `capability.middleware.ts` | Per-request gate on `o.status` |
| `orgadmin-role.middleware.ts` | Role query joins `organizations` and requires active |
| `organization.routes.ts` | `DELETE` retired to a 409 |
| `organizationApi.ts` (admin) | `deleteOrganization` removed |
| `OrganizationsPage.tsx` | Delete → deactivate/reactivate, per row and in bulk, with blast-radius copy |
| `EditOrganizationPage.tsx` | Two-state Status with per-option help text and an inline warning |
| `StatusChip.tsx`, `OrganizationList.tsx` | `blocked` removed; `inactive` toned `warning`, not neutral |

**Tests:** 5 for the middleware gate, 1 for the retired status value in `StatusChip`.

## 6. Not done

- **Not run against a database.** The migration is written and parses, but neither it nor the new
  `CHECK` constraint has been exercised against Postgres. Run `npm run migrate` on a scratch
  database first — if any organisation carries a status outside the two values, the constraint will
  refuse to install.
- **The account-user app was not changed.** It already treated any non-active organisation as
  unavailable, so it needed nothing; its `ORGANISATION_UNAVAILABLE` refusal code is unchanged.
- **`deleteOrganization` still exists on the service.** See §3.
- **No audit trail.** Who deactivated an organisation and when is not recorded beyond
  `organizations.updated_by`. Worth having if deactivation becomes a commercial lever.
