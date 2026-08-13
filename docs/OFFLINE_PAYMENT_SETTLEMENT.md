# Offline Payment Settlement

The club's side of money paid outside the system — cheques, bank transfers, cash
at the desk.

## Why this exists

A member checking out with an offline payment method leaves their order in
`awaiting_offline`. Fulfilment deliberately defers everything except an event
entry until the money is recorded: a membership runs for a year, and granting
one before the cheque clears gives it away.

Until this feature there was no way for the club to record that the money had
arrived. The member's own payments screen said "the club has still to record
this as received", the membership was held, and nothing an administrator could
do would release it. **This is the step that finishes an offline order.**

## What an administrator does

**Org admin → Payments → Offline Payments** (`/orgadmin/payments/offline`).

Two tabs:

| Tab | Shows |
|---|---|
| Outstanding | Everything still `awaiting_offline`, oldest first — the longest-outstanding cheque is the one to chase |
| Recorded | What has already been marked received, so a mistake can be found and undone |

Each entry carries who owes it, when they ordered, what they bought line by
line, and **the offline half of the amount** — not the order total. A mixed
order's card half has already been taken, and the figure an administrator needs
is the one to look for on the bank statement.

### Marking one received

One click. Behind it:

1. The payment becomes `paid`, with `offline_received_at` and
   `offline_received_by` recorded.
2. The deferred fulfilment runs immediately — the memberships, orders, bookings
   and registrations the member paid for are created.
3. The screen reports what that produced: "Sam Rivers now has everything they
   paid for", or a warning naming how many lines could not be created.

That last point is the reason fulfilment runs here rather than on a schedule: a
failed line means the member has paid and has nothing, and the club needs to
know while the administrator is still looking at the screen, not when the member
rings up.

Marking is idempotent. A double click, or two administrators at once, keeps the
original time and the original administrator (`COALESCE`), and fulfilment skips
lines it has already fulfilled (`fulfilled_at`).

### Undoing one

Recorded a cheque against the wrong member? Undo puts the payment back to
`awaiting_offline`.

**Undo is refused once the receipt has produced anything.** The message is
deliberately specific:

> This payment has already produced memberships, bookings or orders. Refund it
> or cancel those individually instead of undoing the receipt.

Flipping the status back would leave every membership, order and booking in
place, granted against money the club never had, with nothing recording why.

## Rules

| Situation | Result |
|---|---|
| Payment belongs to another organisation | 404 — the organisation comes from the caller's token, never the URL |
| Payment was never going to settle offline (a card payment) | 400. Its status is the webhook's to set; marking it by hand would overwrite what Stripe said with a guess |
| Already marked received | Accepted, changes nothing |
| A line fails to fulfil | The payment stays received; the line carries its own `fulfilment_error`, as a card payment's would |
| Undo, nothing fulfilled yet | Back to `awaiting_offline` |
| Undo, something fulfilled | 400 with the message above |

## API

All three resolve the organisation from `req.user.userId`; none takes an
organisation id from the client.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/orgadmin/organisation/payments/offline?settled=false` | Outstanding (or, with `settled=true`, recorded) offline payments with their lines |
| `POST` | `/api/orgadmin/organisation/payments/:id/received` | Record the money as arrived and run the deferred fulfilment. Returns the payment and `{ fulfilled, failed, complete }` |
| `DELETE` | `/api/orgadmin/organisation/payments/:id/received` | Undo the receipt, unless it has already produced records |

## Where the code is

| Piece | File |
|---|---|
| Service | `packages/backend/src/services/payment.service.ts` — `markOfflinePaymentReceived`, `undoOfflinePaymentReceived` |
| Fulfilment | `packages/backend/src/services/fulfilment.service.ts` — `fulfilPayment`, unchanged; this feature calls it later than a card payment does |
| Routes | `packages/backend/src/routes/orgadmin-organisation.routes.ts` |
| Screen | `packages/orgadmin-core/src/payments/pages/OfflinePaymentsPage.tsx` |
| Strings | `payments.offline.*` in all six locales |

## Tests

| Suite | Covers |
|---|---|
| `payment.offline-received.test.ts` | Recording, idempotency, the refusals, and that fulfilment runs — 10 tests |
| `orgadmin-offline-payments.routes.test.ts` | The three routes, oldest-first ordering, name fallback, and that the organisation comes from the token — 10 tests |
| `OfflinePaymentsPage.test.tsx` | Both tabs, marking, undoing, and that the screen says what the money produced — 12 tests |

## What a member sees

Nothing changes on their side until the club records the money — and then
everything does at once. Their payment moves from "the club has still to record
this as received" to paid, and the membership, order, booking or registration
appears in **My Activity**.
