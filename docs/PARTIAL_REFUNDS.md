# Refunding part of a payment, and what that does to what it bought

## The ask

> Support four options: refund the complete payment; refund it minus the handling fee where the fee
> was added on; refund an individual item within the payment; refund an arbitrary amount up to what
> is still refundable. Mark the order **Partially Refunded** for the last two, and allow more than
> one refund. If items are refunded at different times until everything is refunded, the payment
> should show **Refunded**, not Partially Refunded. When items are refunded, ask whether to remove
> the entries from the event — and if so mark them "Removed" so they no longer appear on the event
> entries page while still existing for tracking.

## The four scopes

They are not four ways of typing a number. The difference decides what the payment becomes, so the
scope — not the figure — is what the screen sends:

| Scope | Amount | Payment becomes |
|---|---|---|
| `full` | everything still refundable | `refunded` |
| `lessHandlingFee` | everything but the fee the card cost | `refunded` |
| `items` | the chosen lines, at what was paid for each | `partially_refunded`, or `refunded` once the parts cover the payment |
| `amount` | what the administrator typed, capped at what is left | as above |

**The server computes the amount for every scope but `amount`.** A client able to name both a scope
and a figure could refund the whole of a payment while calling it one line of it, and the status
would follow the label rather than the money.

**`lessHandlingFee` settles the payment, deliberately.** The handling fee is what the card cost the
club, added on top of the price rather than part of it; a club that has returned everything it took
for the goods has refunded the order, and leaving it "partially" refunded for ever would be
misleading. The option is offered **only where a fee was added on** — an item whose price already
absorbs its fee has none to keep back, and `payments.handling_fee` is zero for such a basket, so the
option would be a distinction that is not one. Asking for it there is refused rather than silently
treated as a full refund.

**A line is refunded at its fee plus its share of the handling fee.** The member paid both, and is
owed both back with it.

**`items` is offered only where there is a choice to make** — two or more lines with something left
on them. With one refundable item, "particular items" and "the whole payment" are the same refund
said two ways, and offering it invites a click, a checkbox and a second confirmation to reach
somewhere one click already goes. The same applies part-way through: once everything but one line
has been refunded, the option goes.

## Repeatable, and it ends at Refunded

`partially_refunded` is as refundable as `paid` — that is what refunding one item at a time means.
Each refund records what it covered in `refund_transactions`, so:

- an item already refunded is not offered again, and is refused if asked for;
- a line refunded in part (which an `amount` refund can leave behind) can be refunded up to what is
  left of it;
- when the parts cover the payment, the payment becomes `refunded`. A club refunding two children's
  entries a week apart ends at *Refunded*, not at a payment that is "partially" so for ever.

A fully refunded payment offers no further refund, and one where nothing is left is refused with
*"This payment has already been refunded in full"*.

## Withdrawing the entries

**Asked, never assumed.** A refund can be a goodwill gesture with the rider still expected on the
day, so the dialog offers a checkbox — *"Also withdraw 2 entries from the event"* — and says what it
means: withdrawn entries come off the entrant list but stay on record.

`event_entries.entry_status` goes to `removed`, with `removed_at`, `removed_by` and
`removal_reason`. **Not a delete, and not a `deleted` flag:** the entry happened, was paid for and
was refunded, and all three are worth keeping. What changes is where it appears.

| | |
|---|---|
| The entrant list | gone — `getEntriesByEvent` excludes `removed` unless asked (`includeRemoved`) |
| Entry counts | gone — the event list, the capacity checks in the account catalogue, the public listings. A withdrawn entry must not hold a place |
| The entry's own page | still there, headed by *"This entry was withdrawn on …"* and its reason. It is reachable from the payment that refunded it, so it must not read as an entry that still stands |
| The payment's items table | the line is chipped **Entry withdrawn** beside the item |

Which entries: the lines the refund named, or — for a refund that settles the whole payment — every
line on it. **Never for an arbitrary amount that leaves the payment short**: €20 off a basket of four
names no item, and picking entries to withdraw would be inventing a decision the club did not make.
The option is not offered for that scope, and is refused server-side if it is sent anyway.

Only `event_entry` lines. A membership or a booking that is refunded is a different conversation, and
quietly cancelling either off the back of a refund would be doing something nobody asked for.

## What this paid for, line by line

The items table carries a **Status** column, because a basket can hold one line refunded, one still
owed offline and two paid for, and the payment's own status says nothing about which is which:

```
┌──────────────────────────────┬─────────┬─────────────────────┬─────────┬──────────────┐
│ Item                         │ Method  │ Status              │  Amount │ Handling fee │
├──────────────────────────────┼─────────┼─────────────────────┼─────────┼──────────────┤
│ Intermediate — Spring League │ Card    │ [Refunded]          │  €25.00 │        €0.62 │
│ Áine McGrath                 │         │                     │         │              │
│ [Entry withdrawn] View entry │         │                     │         │              │
├──────────────────────────────┼─────────┼─────────────────────┼─────────┼──────────────┤
│ Club hoodie (Navy, M)        │ Card    │ [Partially refunded]│  €38.00 │            — │
│ View order                   │         │ €10.00 refunded     │         │              │
├──────────────────────────────┼─────────┼─────────────────────┼─────────┼──────────────┤
│ Full Member 2026             │ Offline │ [Pending]           │  €96.00 │            — │
└──────────────────────────────┴─────────┴─────────────────────┴─────────┴──────────────┘
```

`itemStatus` is **derived from what has gone back against the line**, not stored: the money is the
fact, and a second column recording the same thing would be free to disagree with it. A line counts
as refunded when its fee **and its share of the handling fee** have gone back — that is what the
member paid for it — so €25.00 returned on a €25.62 line is *partly* refunded, and the figure is
shown beneath, because "partly refunded" with no amount leaves the club to work it out from two
other columns. A line with nothing back keeps its own status, which is how an offline line still
owed reads as *Pending* rather than as settled.

**Entry withdrawn** stays beside the item rather than moving into the status column: the money and
the entry are separate decisions, and one line can be refunded with the rider still expected.

## The dialog

```
Request Refund
─────────────────────────────────────────────────────────────
How much to refund
 ( ) The whole payment — €56.08
 ( ) Everything but the handling fee — €55.00 (keeping back €1.08)
 (•) Particular items      ← only with two or more left to choose between
 ( ) Another amount
     ☑ Intermediate — Spring League — €25.62
         Áine McGrath
     ☐ Club hoodie (Navy, M) — €38.00
     Items already refunded are not listed.

 Refund Reason *
 [ Rónán withdrew from the 80cm before the closing date.        ]

 ☑ Also withdraw 1 entry from the event
   Withdrawn entries come off the entrant list but stay on record.

 ⓘ €25.62 will be refunded.
                                        [ Cancel ] [ Confirm Refund ]
```

The reason stays required: it is the whole point of the record afterwards. The dialog forgets its
answers when it is reopened — a second refund on the same payment must not start from the first
one's selection.

## Schema

Migration `1709000000039_refund-scope-and-entry-removal`:

- `refunds.refund_scope` — how the amount was arrived at, so the payment's status does not have to be
  inferred from arithmetic that cannot tell "everything" from "everything that was left".
- `refund_transactions` (`refund_id`, `payment_transaction_id`, `amount`) — a join table, because one
  refund can cover several lines and one line can be refunded in parts over time.
- `event_entries.entry_status`, `removed_at`, `removed_by`, `removal_reason`, and an index on
  `(event_id, entry_status)`.

## Status everywhere

`partially_refunded` is new, so it needed: the payments list filter and its chip colour (amber —
money has gone back and some of it has not, so it is neither settled nor spent), the payment detail
chip, and `common.status.partially_refunded` in all six org-admin locales plus
`payments.status.partially_refunded` in the account app, where a member sees their own payment. The
member's payment history already excluded only `pending` and `abandoned`, so it appears there
without further change.

## The one default worth knowing

A request that names `refundAmount` and no scope is treated as an **amount** refund. Defaulting to
`full` there would ignore the figure the caller sent and refund the whole payment — the one mistake
in this method that moves more money than was asked for.

## Tests

| Suite | Covers |
|---|---|
| `payment.service.test.ts` | each scope's amount and resulting status; `lessHandlingFee` refused where no fee was added; an item refused twice; an item from another payment; an amount beyond what is left; a payment already fully refunded; the org-admin row for the requester; the amount-with-no-scope default |
| `payment.service.test.ts` — *withdrawing entries* | nothing unless asked; only the named lines; every line for a full refund; nothing for a partial amount; marked rather than deleted; the count reported |
| `RefundDialog.test.tsx` (new) | the four options, the fee option's presence and absence, the items option appearing only with two or more refundable lines, item selection and what it comes to, the cap, the required reason, the withdraw question and when it is offered, and the dialog forgetting its last answers |
| `PaymentDetailsPage.test.tsx` | the scope sent rather than a figure, refunding again while part-refunded, nothing offered once settled, the per-line status (refunded, partly refunded with its figure, an unpaid line still unpaid) and the withdrawn mark, `itemStatus` itself, and the scope and items shown in the refund history |
| `EventEntryDetailsPage.test.tsx` | a withdrawn entry says so, and one that stands says nothing |
| `orgadmin-workflows.integration.test.ts` | the endpoint's outcome shape, `refund_scope` written, and the payment's status against the real database |

---

## Follow-up: a seeded refund that named its item only in prose

> The payment shows Partially refunded and the refund section shows the Show Cap was refunded, but
> "What this paid for" still shows the Show Cap as Paid. Also, refunding a second item let me pick
> one that had already been refunded.

One cause behind both. The **seeded** part refunds were written with `scope: 'amount'` and a reason
that *mentioned* an item — *"Cap ordered in the wrong size"* — and nothing linked them to a line.
So the screens were each telling the truth about different things: the refund history read the
reason, the status column read the money, and no money had been recorded against the cap. The item
list had the same blind spot, because an unlinked refund leaves every line looking fully refundable.

The fixture now names the item it refunded, and the writer links it:

```ts
{ basket: 'mcnamara-day', item: { description: 'Show cap' }, … }
{ basket: 'mcgrath-season', item: { description: '80cm', subject: 'Rónán McGrath' }, … }
```

- **Matched to exactly one line**, or the seed refuses to run: a fixture that quietly matched none
  would write the very state this fixes.
- **The entrant, where a description is not enough.** Two children entered in the same class produce
  two identical lines; `subject` reads `context_ref.entrantName`, which is how the writer tells the
  Rónán line (€25.61) from the Áine one (€25.62).
- **The amount comes from the line** — its fee plus the share of the handling fee it bore — rather
  than being restated in the fixture, so the two cannot drift. The Show cap refund is €18.44, not
  the €18.00 the fixture used to claim.
- The refund is written with scope `items` and a `refund_transactions` row.

The three already in the development database were linked the same way rather than left as they
were.

**A second guard on the dialog.** Items adding up to more than the payment has left are now refused
before the server refuses them. That is reachable *without* any of the chosen items having been
refunded: an earlier refund of an arbitrary amount comes off the payment without naming a line, so
the lines can still add up to more than remains.
