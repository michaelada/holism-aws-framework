# Offline Payments — navigation, audit trail, and four defects underneath

**Request:** add an *Offline Payments* option to the left-hand navigation under Payments, where an
administrator can see every order that used a Paid Offline option, mark the payment as received —
recording who marked it and when, automatically — and unmark it if that was done in error.

Most of the screen already existed. `OfflinePaymentsPage`, its route, the `offline_received_at` /
`offline_received_by` columns and the mark and unmark endpoints were all in place from
[OFFLINE_PAYMENT_SETTLEMENT.md](OFFLINE_PAYMENT_SETTLEMENT.md). None of it was reachable, and the
parts that were reachable were not correct. What follows is what was actually wrong.

---

## 1. The menu item never rendered

`subMenuItems` was declared **inside** `menuItem` in `packages/orgadmin-core/src/payments/index.ts`.
It is not part of that type, so it was a pre-existing `TS2353` and the rail never saw it.

Moved to the root of the module registration. Payments now expands to two children:

| Label | Key | Path |
|---|---|---|
| All payments | `payments.allMenu` | `/payments` |
| Offline payments | `payments.offline.menu` | `/payments/offline` |

`payments.allMenu` is new — reusing the module name gave a breadcrumb reading "Payments › Payments".
Added to all six locales.

## 2. "Who marked it" was recorded but never read back

The list query selected `offline_received_at` and nothing about the person. The interface could say
*when* a payment was marked received but not *by whom* — the half that matters when it was marked in
error, which is the case the request is about.

Added a second join to `organization_users` on `offline_received_by`, three aliased columns, and
`receivedBy` in the response. The page renders `payments.offline.receivedByOn`
("Recorded by {{name}} on {{date}}"), falling back to `receivedByUnknownOn` when the administrator's
record has since been removed — the money still arrived, so the row must still show a date.

## 3. Marking a payment wrote the wrong id into the foreign key

`offline_received_by` references `organization_users(id)`. The route passed the **Keycloak** user id.
Against the live database those are different values for the same person, and that person had one
row *per organisation*:

```
organization_users.id  = 7f981b74-…   (Laois)   /  a5888d5a-… (Kildare)
keycloak_user_id       = 507fd29a-…             (the same human)
```

The service now resolves the org-user id itself, scoped to **both** the person and the organisation,
so a two-club administrator is recorded against the club they were actually working in.

The existing service test had asserted the buggy value, which is why nothing caught it. It now
asserts the opposite: `expect(update?.[1]).not.toContain(ADMIN_KEYCLOAK_ID)`.

## 4. The page fetched in an unbounded loop

Opening the screen issued requests until the API answered **HTTP 429** and Chrome gave up with
`ERR_INSUFFICIENT_RESOURCES`. Nothing on screen suggested a loop; the page sat on its spinner.

The page did the obvious, correct-looking thing:

```ts
const load = useCallback(async () => { … }, [execute, settled, t]);
useEffect(() => { void load(); }, [load]);
```

The fault was one level down. `orgadmin-shell`'s `useTranslation` wrapper built a **new `t` closure on
every render**, so `load` was rebuilt every render and the effect re-fired forever. Every module in
the org-admin gets `t` from that wrapper.

Two fixes, because either alone leaves a trap:

- **`useTranslation` now returns stable references** — `t`, `i18n` and the result object keep their
  identity, changing only when the language does. react-i18next's own `t` is snapshot-cached, so
  keying on it propagates exactly the right invalidation. `changeLanguage` is held in a ref, since it
  must be invoked as a method and keying the memo on the whole `i18n` object would reintroduce the
  churn.
- **The page no longer names `t` in the loader.** The load failure is held as a flag and translated
  at render, which also means the message follows a language change instead of freezing at fetch
  time.

No test caught this because the shell test double returns a stable `t` from module scope — **the mock
was more correct than production**. Both sides are now guarded: `useTranslation.stability.test.tsx`
in orgadmin-shell, and a page-level test in orgadmin-core that renders against the churning `t`
production actually had and asserts a single fetch.

---

## Two further defects found while verifying, both pre-existing and wider than this screen

### Every screen served by `orgadmin-organisation.routes` was 404ing

`useApi` rewrites `/api/orgadmin/…` to the organisation-scoped form. That router is mounted **once,
bare** — it is not one of the dual-mounted data routers — so the rewrite produced
`/api/orgadmin/organisations/<id>/organisation/payment-settings`, which matches nothing.

Confirmed in a browser, not inferred: opening **Settings → Payment Settings** fired four requests and
got four 404s.

| Path | Before |
|---|---|
| `/api/orgadmin/organisation/payment-settings` | 401 (mounted, auth reached) |
| `/api/orgadmin/organisations/<id>/organisation/payment-settings` | **404** (not mounted) |

Blast radius: all six Settings tabs, the registrations screen, and offline payments.

Fixed by adding `/api/orgadmin/organisation/` to `UNSCOPED_ORGADMIN_PATHS` rather than by adding a
scoped mount. That router resolves the organisation from the signed-in user and, unlike the
dual-mounted routers, has no check that a path id agrees — so a scoped mount would accept a URL
naming one club while the handler worked on another. A URL that misreports its subject is worse than
no URL scoping. The trailing slash keeps the exclusion from swallowing the plural
`/api/orgadmin/organisations/…`.

### The same router served the wrong club to a two-club administrator

`resolveOrganisationId` was `SELECT organization_id … LIMIT 1` with no `ORDER BY` — an arbitrary row,
chosen by the planner — while the app was already sending the club the administrator had opened in
`X-Organisation-Id`. This router was the one place that ignored it.

Signed in to **Kildare Hunt Pony Club**, it resolved to **Laois Hunt Pony Club**. The offline
payments list showed the wrong club's money, and payment settings, branding, email templates and
Stripe Connect read *and wrote* against a club that had not been opened. Nothing on screen said so;
both clubs were legitimately theirs. This is how the defect surfaced — a test payment inserted for
Kildare did not appear on Kildare's screen.

The header is now honoured and **verified** against the caller's own org-admin rows, so it selects
among their organisations and can never reach beyond them. A club the caller does not administer is
refused with 403 rather than served from a different one — silently substituting an organisation is
the bug, and doing it on the error path would be the same bug. A malformed id is refused before it
reaches the `::uuid` cast, so an invalid request is not answered as a server fault. With no header,
the fallback is ordered, so a direct caller at least gets the same club every time.

---

## A partial fulfilment no longer looks like success

Recording a payment can half-succeed: the money settles but a membership or ticket cannot be
created. That was announced in a green alert with a tick, reading *"Recorded, but 1 item(s) could not
be created"* — the one pairing certain to be skimmed past, while a member has paid and has nothing.
It is now a warning; a clean settlement stays a success, so the distinction carries information.

## Verification

End-to-end in a browser against the local stack, with a payment inserted for Kildare and removed
afterwards:

1. Outstanding tab lists the payment with member, line items and amount.
2. **Mark received** → `payment_status` `paid`, `offline_received_at` set, and `offline_received_by`
   resolving to a real `organization_users` row **in the correct organisation**.
3. Recorded tab shows *"Recorded by Aoife Byrne on 19 Aug 2026"*.
4. **Undo** → status back to `awaiting_offline`, both audit columns `NULL`.
5. Console: **0 errors**, and exactly two requests (React StrictMode's double-invoke), not hundreds.

## Tests

| Suite | Result |
|---|---|
| `orgadmin-core` | 731 passing (47 files) |
| `orgadmin-shell` | 700 passing (54 files) |
| `backend` — offline payment routes + service | 39 passing |

New: 4 organisation-selection route tests, 2 alert-severity tests, 1 page-level loop guard, 2
scoped-URL tests, 5 `useTranslation` stability tests. Each regression guard was checked by mutating
the fix back and confirming the test fails — the loop guard reports `expected 6 to be 1`.

## Files

**Front end**
- `packages/orgadmin-core/src/payments/index.ts` — `subMenuItems` moved to the registration root
- `packages/orgadmin-core/src/payments/pages/OfflinePaymentsPage.tsx` — `receivedBy`, loop fix, alert severity
- `packages/orgadmin-core/src/hooks/useApi.ts` — `UNSCOPED_ORGADMIN_PATHS`
- `packages/orgadmin-shell/src/hooks/useTranslation.ts` — stable `t`, `i18n`, result
- Six locale files — `payments.allMenu`, `payments.offline.receivedByOn`, `receivedByUnknownOn`

**Backend**
- `packages/backend/src/routes/orgadmin-organisation.routes.ts` — `receivedBy` join, organisation selection
- `packages/backend/src/services/payment.service.ts` — resolve the org-user id for `offline_received_by`

---

# Follow-up: the settlement was missing from the audit log

> I marked a payment as received, which seemed to work, but the audit log shows no record of it.
> Marking a payment as received, or undoing it, should log a clear message.

The event *was* written — `offline-payment.recorded` was in `audit_events` all along. Three separate
faults kept it out of the reader's way, or made it worthless once found.

## 1. It was recorded against no organisation

`audited()` scopes an event with `organisationFromRequest(req)`, which reads `req.organisationId` —
set by `organisation-scope.middleware` on every router that takes the club from the URL.

**This router is the exception.** It resolves the organisation itself, from the caller's token
narrowed by the `X-Organisation-Id` header (see *choosing the organisation* above), and kept the
answer in a local variable. So `req.organisationId` was never set, every event it produced was
written with `organisation_id = NULL`, and the org-admin audit log — which filters on exactly that —
showed none of them.

```
 action                    | no_org | count
---------------------------+--------+-------
 offline-payment.recorded  | t      |     1
 settings.organisation-updated | f  |     3
```

The settings routes escaped it by accident: they PUT the whole organisation, so
`organisationFromRequest` found an id in the request *body*. An empty POST has nowhere to look.

`withOrganisation` now puts the resolved id on the request before calling the handler, which fixes
every audited route on this router at once — payment settings, branding, email templates,
registration settings and the account-user approval queue, as well as these two.

## 2. A receipt and its reversal were the same action

Both routes wrote `offline-payment.recorded`, so an undo was indistinguishable in the log from the
thing it reversed — and the undo is the entry an auditor is most likely to be hunting for. The
DELETE now writes **`offline-payment.receipt-undone`**, registered in `AUDIT_ACTIONS`, labelled in
`packages/components/src/utils/auditLabels.ts` and translated in all six locales.

`offline-payment.recorded` was relabelled *"Offline payment recorded as received"* — "recorded" on
its own reads as "a payment was recorded", which is the checkout, not the settlement.

## 3. The record said nothing

Both routes take an empty body, and `audited()` records what was *sent*. The entry read:

```
changes: {"created": {}}
entity_label: (null)
```

— an event saying somebody did something to a uuid. What the money was is in the **response**, not
the request, so `audited()`'s `values` composer now receives the response body as well as the
request:

```ts
values?: (req: Request, after: Record<string, unknown> | null) => Record<string, unknown> | null;
```

Backwards compatible — every existing caller ignores the second argument — and `null` on the failure
path, where there is no successful response to describe. The two routes compose from it:

| | |
|---|---|
| **Label** | `Fionn Doyle — EUR 45.00`, falling back to the email when no name is recorded |
| **Changes** | `payer`, `amount`, `currency`, `paymentStatus`, `receivedAt`, and — for a receipt — `itemsCreated` / `itemsFailed` |

`itemsFailed` is the reason the fulfilment outcome is in there at all: a settlement that half-worked
is announced once, in an alert the administrator may close, and afterwards the audit trail is the
only place that remembers.

A refused undo — one whose receipt has already produced memberships — is recorded as a `failure`
carrying the refusal as its reason. A rejected reversal is at least as interesting as an accepted
one.

## The one event already in the database

The receipt recorded before this fix was backfilled with its payment's organisation, so it is
visible in that club's log. Its label and values stay empty; they were never captured.

## Tests

| Suite | Covers |
|---|---|
| `src/routes/__tests__/orgadmin-offline-payments.routes.test.ts` | 6 new: the organisation on the event, the money and the fulfilment outcome in `changes`, the label and its email fallback, the undo as its own action, and a refused undo recorded as a failure |
| `src/middleware/__tests__/audit.middleware.test.ts` | 3 new: `values` receives the response, the request-body default is unchanged, and `after` is null on the failure path |

## 4. …and the entry still did not say *which* payment

> I see it now, however it is not possible to know what payment it was that was marked as received,
> or undone.

Right, and the label alone would not have fixed it. "Offline payment recorded as received — Fionn
Doyle, EUR 45.00" does not identify one payment: a member who pays two cheques of the same amount
produces two events that read identically. And the id the event *was* filed against —
`entity_id`, present on every row — **was never shown on the screen at all**. The page's
`AuditEvent` interface did not even declare the field, though the API had been returning it all
along.

Three changes to `orgadmin-core/src/audit/pages/AuditLogPage.tsx`:

- **The reference is shown in the detail**, whether or not anything can be opened. A reader can
  quote it, search on it, or paste it into a URL. That is the minimum a trail owes them, and it is
  what makes the events recorded *before* this work legible — their labels were never captured and
  cannot honestly be invented after the fact.
- **A row with no label is marked with the head of its reference** in the list, so two otherwise
  identical lines can be told apart while scanning.
- **`auditEntityDestination(entityType, entityId)`** maps an event to the screen that shows the
  record, and the detail offers a button to it:

  | Entity type | Opens |
  |---|---|
  | `payment` | `/payments/:id` |
  | `event` | `/events/:id` |
  | `member`, `membership` | `/members/:id` |
  | `membershipType` | `/members/types/:id` |
  | `merchandiseType` | `/merchandise/:id` |
  | `merchandiseOrder`, `order` | `/merchandise/orders/:id` |
  | `booking` | `/calendar/bookings/:id` |
  | `calendar` | `/calendar/:id` |
  | `applicationForm` | `/forms/:id/edit` |
  | `eventType`, `venue`, `registration` | the list that holds them — there is no per-record page |

  Both spellings are handled because the trail writes both: `audited()` defaults `entityType` to its
  `resource` (`merchandiseOrder`), while routes that set it explicitly use the domain word
  (`order`).

  **Null rather than a guess** for a kind this app cannot show — a capability, a role, a session —
  and for an `entity_id` that is not a uuid, since a few events are filed against a name or a code
  and `/payments/payment-settings` is a route to nowhere. No button appears; the reference still
  does.

New keys `audit.reference` and `audit.viewEntity.*` in all six locales, the latter falling back to
*"Open this record"* for the kinds with no wording of their own.

Six further tests in `orgadmin-core/src/audit/pages/__tests__/AuditLogPage.test.tsx`: the reference
on screen, the button leading to the payment, a labelless row marked by its reference, no button for
a record with no page, no button when the event names no record, and the mapping itself.

---

# Follow-up: "it said Undone, and nothing moved"

> I marked an offline order as received, then clicked Undo. The screen said it was undone, but it did
> not move back to the Outstanding section.

The audit trail said what the screen would not:

```
15:43  offline-payment.receipt-undone   failure
14:52  offline-payment.receipt-undone   failure
14:52  offline-payment.receipt-undone   failure
14:50  offline-payment.recorded         success
```

Three refusals, reported as three successes. Two separate defects.

## 1. `useApi.execute` answers `null` instead of throwing

Every `try { await execute(...) } catch` around a mutation in this codebase is **dead code**. The
hook records the message in its own `error` state and resolves to `null`; the `catch` never fires,
and the page runs its success path. That suits a screen that *loads* data — it renders an empty
state and moves on — and it is wrong for an action.

Changing the default would touch ~240 call sites that read the `null`, so the option is opt-in:

```ts
await execute({ method: 'DELETE', url: '…/received', throwOnError: true });
```

It throws the **server's own words**, which for a refusal are the words the administrator needs.
Applied to the mark-received and undo calls, and to the new buttons on the payment detail.

## 2. The undo refused what the receipt had not created

```sql
-- was: everything the payment has ever produced
WHERE pt.payment_id = p.id AND pt.fulfilled_at IS NOT NULL
```

An entry, a booking and a merchandise order are created **when the order is placed** — that is the
rule in `fulfilment.service`, and it is deliberate: an offline order might wait weeks for a cheque
and the member should not be without their entry for all of it. So on the payment in question the
line had been fulfilled on **24 August** and the receipt on **1 September** released nothing — and
the undo was refused for records the receipt had not made.

Which made the Undo button a permanent lie for almost every offline order there is.

```sql
-- now: what this receipt released
AND pt.fulfilled_at >= p.offline_received_at
```

A membership or a registration — the two fulfilment defers — is created *by* the receipt, so those
still refuse the undo, which is the case the rule exists for. The message says so in those terms
now: *"Recording this payment created memberships, bookings or orders."*

Read back on the payment that failed:

```
line: event_entry fulfilled 2026-08-24 — before any receipt
marked received: paid, released 0
undone:          awaiting_offline, received —
back on the Outstanding list? true
```

## Settling from the payment itself

> If I drill into an offline payment, add a "Mark Received" button so the user doesn't have to go to
> the Offline Payments section.

Both buttons are now on the payment detail, beside Request Refund, calling the same two endpoints:

| Button | Shown when |
|---|---|
| **Mark received** | `payment_status = 'awaiting_offline'` — what a finished offline checkout writes, and what the Offline Payments screen selects on, so the two agree about which payments are outstanding |
| **Undo** | the payment has an `offline_received_at`. Whether the undo is *allowed* is the server's to say, so the button is offered and the refusal is shown in its own words |

The outcome is reported on the page — including a **partial fulfilment as a warning**, which is the
one an administrator must not skim past: the member has paid and has not got everything.

> The settlement history the same ask mentions was built earlier and is on this page already — the
> **Offline settlement** card, below "What this paid for": who marked it received or undid it, when,
> and what the receipt released. It reads the audit trail, and shows successes only; the three
> refusals above are in the audit log itself, under Failures.

## Tests

| Suite | Covers |
|---|---|
| `useApi.test.ts` | `throwOnError` throws the server's message; the default still answers `null`; the error is recorded either way |
| `payment.offline-received.test.ts` | an undo allowed where the lines were fulfilled before the receipt, and the query scoped to `fulfilled_at >= offline_received_at` |
| `PaymentDetailsPage.test.tsx` | both buttons and when they appear, the endpoints they call, the refusal shown rather than a claimed success, and the reload afterwards |
