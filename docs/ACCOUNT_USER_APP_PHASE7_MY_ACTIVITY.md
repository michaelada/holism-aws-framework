# Account User Application — My activity (phase 7)

Phase 6 built the shell and the A-series screens but left every "My activity" menu item pointing at
nothing ([phase 6 record](ACCOUNT_USER_APP_PHASE6_SHELL.md#7-what-this-does-not-do)). This phase
builds the first of them end to end — backend endpoints included, because none existed.

**Screens:** C1 (My Entries & Bookings), C2 (Entry detail), C4 (My Memberships).

---

## 1. Backend

### `src/utils/activity-status.ts` — the shared vocabulary

Four words, used for entries, bookings and memberships alike: **Awaiting payment**, **Confirmed**,
**Completed**, **Cancelled**. One derivation rather than one per query, because a member should not
have to learn two vocabularies for the same four situations.

This is deliberately **not** the payment status on the row. `paid` and `pending` describe money;
these describe what the member can expect. A confirmed entry to an event that already happened is
`completed`, and no payment column says so.

The precedence is the substance, and each step encodes a decision:

1. **Cancelled beats everything.** A cancelled booking for a past date is cancelled, not completed —
   the member did not attend, and saying they did misrepresents their own history back to them.
2. **Past beats unpaid.** An outstanding balance on something that has already happened is a debt to
   settle with the club, not something the member can still act on, so it reads as completed rather
   than inviting a payment that changes nothing.
3. **Unpaid beats confirmed**, because an unpaid *future* entry is exactly what needs acting on.

Dates compare at day granularity, normalised to midnight on both sides. An event finishing today is
still today's event, and without the normalisation the answer would depend on the hour the query ran.

`isDueForRenewal` covers only two thirds of the C4 rule — see §3.

### `src/services/account-activity.service.ts`

Four read-only methods: `listEntries`, `getEntry`, `listBookings`, `listMemberships`.

**Every query is scoped by both the organisation and the member's `organization_users.id`, and the
caller supplies neither.** Both come from `req.account`, which `resolveAccountOrganisation` derived
from the token. That pairing is the whole security model here.

`event_entries` and `bookings` carry no organisation column of their own, so the boundary is enforced
by the join — through `events.organisation_id` and `calendars.organisation_id` respectively. Dropping
either join would leak every organisation's records for that member, and nothing in the response
shape would reveal it.

`getEntry` reports another member's entry as **not found**, not forbidden: a 403 confirms the id is
real to anyone probing for it.

Every method takes `today`. Status depends on the current date, so without it the results depend on
the wall clock and cannot be tested against fixed rows. This was caught by the tests — the first
version threaded `today` into `listMemberships` only, leaving the other three half-deterministic.

### Routes

Added to `account.routes.ts`, all behind `authenticateToken()` + `resolveAccountOrganisation()`:

```
GET /api/account/:orgCode/entries
GET /api/account/:orgCode/entries/:entryId
GET /api/account/:orgCode/bookings
GET /api/account/:orgCode/memberships
```

---

## 2. The C4 renewal rule

The wireframe states it as three conditions:

```
show Renew  ⟺  status = active
            ∧  valid_until − today ≤ 30 days
            ∧  ∃ a membership type for the following period that is
               open for applications and available to this member
```

The third cannot be answered from the membership row, so the service checks it separately and the
response distinguishes the outcomes:

| Field | Meaning | Screen shows |
|---|---|---|
| `canRenew` | all three hold | **Renew** button |
| `renewalNotOpen` | first two hold, third does not | "Renewals are not open yet." |
| neither | not due | nothing |

Collapsing these into one boolean is precisely the failure the wireframe warns about: a button that
leads to a page with nothing on it.

A **lapsed** membership is still offered for renewal — a member a week late should be able to rejoin
rather than be told to start again. The screen says "Expired 6 days ago" rather than counting
backwards; a naive countdown renders "Expires in -6 days".

---

## 3. Front end

| Screen | Route | Notes |
|---|---|---|
| **C1** My entries & bookings | `/:orgCode/entries` | Two datasets, one screen — a member does not think of an event entry and a court booking as different parts of an app. Tabs are gated independently and vanish when only one applies. The active tab lives in `?tab=`, so the screen is linkable and survives reload. |
| **C2** Entry detail | `/:orgCode/entries/:entryId` | **No cancel action** (Q6). 404 covers both "no such entry" and "not yours", and the screen does not distinguish them either. |
| **C4** My memberships | `/:orgCode/memberships` | The renewal rule above. Countdown appears only inside 30 days. |

### `CapabilityGate`

Hiding a menu item is presentation, not access control — a member can still type the URL, and the
page behind it would call an endpoint the capability middleware refuses, producing an error where an
explanation belongs. `CapabilityGate` redirects to the organisation home instead, and renders nothing
while capabilities are still loading so an entitled member is not bounced off a page they may see.

C1 also declines to *request* what the club has not enabled: asking a calendar-less club for bookings
guarantees a 403.

### "Your answers" is deliberately absent from C2

The stored `form_submissions` row must be rendered against the form definition **as it was at
submission time**. Rendering it against the current definition would silently drop answers to
since-deleted fields — worse than not showing them, because it looks correct. No endpoint serves the
historical definition yet, so the panel says the answers are unavailable rather than showing a
rendering that is quietly wrong.

### Shared formatters — `packages/components/src/utils/formatting.ts`

`formatCurrency`, `formatDisplayDate`, `formatDisplayDateTime`, `formatDateRange`. Placed in the
component library because more than one front end needs them (§1.5).

`orgadmin-shell/src/utils/{currencyFormatting,dateFormatting}.ts` predate this and keep their own
memoising implementations. **They are not changed here** — converging them is a refactor of a
working, tested surface with no behavioural gain, and should be a deliberate change rather than a
side effect of building a screen.

They fail soft by design: a missing amount or date renders an em dash, and an unrecognised currency
falls back to a plain number. Nullable columns feed these, and "Invalid Date" in a member's own
record reads as a fault in their data.

---

## 4. Tests

| Suite | Tests |
|---|---|
| `activity-status.test.ts` (Jest) | 27 — precedence, day-granularity, renewal window |
| `account-activity.service.test.ts` (Jest) | 22 — scoping, status derivation, renewal states |
| `account-activity.routes.test.ts` (Jest) | 16 — auth, scoping from session not request, refusal passthrough |
| `MyEntriesPage.test.tsx` (Vitest) | 12 |
| `MyMembershipsPage.test.tsx` (Vitest) | 11 |
| `EntryDetailPage.test.tsx` (Vitest) | 9 |
| `CapabilityGate.test.tsx` (Vitest) | 5 |
| `formatting.test.ts` (Vitest, components) | 15 |

`packages/account-shell` is now **145 passing, 0 skipped**; typecheck clean; builds.

### Pre-existing failures, unchanged by this work (§3.3)

- **Backend: 156 failures across 36 suites.** None touch account, activity or cart; the four suites
  above all pass, as does the phase-6 `account-api.routes.test.ts` (29).
- **`packages/components`: 9 failures across 4 suites.** Three in `FieldRenderer.test.tsx` are the
  *same* MUI fault fixed in `orgadmin-core` last session — "Can not find the date and time pickers
  localization context", caused by the ESM and CJS builds both loading. This package has no
  `server.deps.inline` at all, so the fix is the same three lines. **Not applied here**, because it is
  unrelated to this phase; §3.3 asks that such failures be reported rather than silently fixed. The
  remaining six are unseeded property tests.

  Verified pre-existing rather than assumed: the only changes to `components` are a new untracked
  `src/utils/` directory and one appended export line, and the failing tests import `../FieldRenderer`
  directly, never the barrel.

---

## 5. What this does not do

- **No booking detail (C3) and no self-cancellation.** Bookings are the one self-cancellable thing,
  and the rule belongs in `packages/components` (the wireframe notes `cancellationValidator.ts` in
  `orgadmin-calendar` as the thing to move).
- **No browse or join flow.** C4's Renew navigates to `/:orgCode/join`, which does not exist yet, so
  the button currently leads to the directory redirect. The membership-type catalogue, the cart
  wiring and checkout are the next phase.
- **No form-submission rendering** (see §3), no registrations (C6), no merchandise orders (C8), no
  payments list.
- **B3 is still a placeholder.** Its cards need these lists plus the ones above.
- **`event_entries` has no cancellation column**, so a withdrawn entry cannot currently be
  represented at all; `deriveActivityStatus` handles `cancelled` for bookings and memberships only.
