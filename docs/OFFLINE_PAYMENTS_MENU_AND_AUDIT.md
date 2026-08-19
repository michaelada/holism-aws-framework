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
