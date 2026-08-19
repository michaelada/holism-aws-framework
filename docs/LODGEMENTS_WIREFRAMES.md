# Lodgements — wireframes

Companion to [LODGEMENTS.md](LODGEMENTS.md). Amounts are illustrative; the fee arithmetic is not —
it follows the destination-charge model described in §2 there, where **Stripe's processing fee is
borne by the platform and does not reduce the club's lodgement**.

---

## 1. Lodgements list — `payments/lodgements`

```
Kildare Hunt Pony Club › Payments › Lodgements
┌──────────────────────────────────────────────────────────────────────────────┐
│  Lodgements                                                                  │
│  Money Stripe has paid into your bank account.                               │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  Not yet paid out                                              €412.80  │  │
│  │  Collected but not yet scheduled for a lodgement.                       │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  Date arriving   Amount      Status        Payments   To account             │
│  ──────────────────────────────────────────────────────────────────────────  │
│  21 Aug 2026    €1,842.50   ⧗ In transit      12      AIB ····6789      ›    │
│  14 Aug 2026    €2,104.00   ✓ Paid            18      AIB ····6789      ›    │
│  07 Aug 2026      €986.25   ✓ Paid             9      AIB ····6789      ›    │
│  31 Jul 2026      €740.00   ✕ Failed           7      AIB ····6789      ›    │
│                  ↳ The bank account details were rejected.                   │
│                                                                              │
│                                                    [ Show more ]             │
└──────────────────────────────────────────────────────────────────────────────┘
```

Notes:
- "Not yet paid out" is a **card, not a row** — it has no date and is not a lodgement (R4).
- A failed payout keeps its reason on the row. A club chasing missing money needs this more than it
  needs the successful ones (R5).
- `Show more` pages through Stripe's cursor; there is no total count to show, so no page numbers.

### Empty and unconnected states

```
┌────────────────────────────────────────────────────────────────┐   ┌─────────────────────────────┐
│  ⓘ  You are not connected to Stripe yet, so there are no       │   │  ⓘ  No lodgements yet.      │
│     lodgements to show.                                        │   │     They will appear here   │
│                                                                │   │     once Stripe has paid    │
│     [ Go to Payment Settings ]                                 │   │     money into your bank.   │
└────────────────────────────────────────────────────────────────┘   └─────────────────────────────┘
        R10 — connect first                                                  connected, nothing yet
```

---

## 2. Lodgement detail — `payments/lodgements/:id`

```
Kildare Hunt Pony Club › Payments › Lodgements › 14 Aug 2026
┌──────────────────────────────────────────────────────────────────────────────┐
│  ‹ Lodgements                                                                │
│                                                                              │
│  Lodgement · 14 Aug 2026                              ✓ Paid                 │
│  AIB ····6789                                                                │
│                                                                              │
│  ┌───────────────────────── How this adds up ─────────────────────────────┐  │
│  │  Charged to members (18 payments)                          €2,214.00   │  │
│  │  Handling fees kept by the platform                       −  €110.00   │  │
│  │  Refunds                                                  −    €0.00   │  │
│  │  ───────────────────────────────────────────────────────────────────   │  │
│  │  Into your bank                                            €2,104.00   │  │
│  │                                                                        │  │
│  │  ⓘ Stripe's processing fee is paid by the platform and is not          │  │
│  │    deducted from your lodgement.                                       │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  Payments in this lodgement                                                  │
│  ──────────────────────────────────────────────────────────────────────────  │
│  ▾  Sinéad Gallagher      11 Aug 2026        €180.00            €175.00      │
│     ┌──────────────────────────────────────────────────────────────────┐     │
│     │  In the basket                                                   │     │
│     │    Family Membership 2026              × 1           €170.00     │     │
│     │    Cross-country entry                 × 1             €5.00     │     │
│     │    Handling fee                                        €5.00     │     │
│     │    ────────────────────────────────────────────────────────────  │     │
│     │    Charged to Sinéad                                 €180.00     │     │
│     │    Handling fee kept by the platform               −   €5.00     │     │
│     │    ────────────────────────────────────────────────────────────  │     │
│     │    Into this lodgement                               €175.00     │     │
│     │                                            [ View payment › ]    │     │
│     └──────────────────────────────────────────────────────────────────┘     │
│  ▸  Cillian Murphy        11 Aug 2026         €45.00             €43.75      │
│  ▸  Áine McGrath          12 Aug 2026        €120.00            €116.50      │
│  ▸  Refund · Órla Kavanagh 13 Aug 2026       −€60.00            −€60.00      │
│  ──────────────────────────────────────────────────────────────────────────  │
│                                              Total              €2,104.00    │
└──────────────────────────────────────────────────────────────────────────────┘
```

Notes:
- Two money columns: **what the member was charged** and **what reached this lodgement**. They are
  different numbers and the whole screen exists to explain the gap (R7).
- The refund row is a balance-transaction entry with no basket, so it does not expand. Without these
  entries the column would not sum to the payout total (R9), and a total that does not add up is
  worse than no total.
- The final `Total` row is the reconciliation the user asked for: the lines add to the payout (R8).
- `View payment ›` links to the existing `PaymentDetailsPage`, which owns refunds — this screen
  reports, it does not act.

### A payment we cannot resolve

```
│  ▸  Payment not in this system     11 Aug 2026    €95.00      €92.10        │
│     ⓘ This arrived through Stripe but has no matching record here.          │
```

Shown rather than hidden. A missing row breaks the reconciliation and looks like a bug in the total;
an honest row explains it. This is expected for payments taken before the link was recorded and for
anything created directly in Stripe.

---

## 3. Narrow widths

The reconciliation card stacks label-over-value below `sm`; the payments table keeps its two money
columns and scrolls inside its own container rather than widening the page — the *Reachable Not
Optimised Rule*, and the same `min-width: 0` discipline as the rest of the shell.

```
┌────────────────────────────┐
│ Lodgement · 14 Aug 2026    │
│ ✓ Paid · AIB ····6789      │
│                            │
│ Charged to members         │
│                  €2,214.00 │
│ Handling fees              │
│                 − €110.00  │
│ ────────────────────────── │
│ Into your bank             │
│                  €2,104.00 │
│                            │
│ ▾ Sinéad Gallagher         │
│   11 Aug · €180.00         │
│   → €175.00                │
└────────────────────────────┘
```
