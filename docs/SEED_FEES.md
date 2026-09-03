# What the seed charges

Two different fees, easily confused, and only ever charged on **card** payments.

| | Who pays it | Who receives it | Where it is set |
|---|---|---|---|
| **Handling fee** | the member, on top of the basket | the club | `organization_type_payment_fees` |
| **Application fee** | the club, out of the payment | the platform | `organization_payment_application_fees` |

An offline payment attracts neither: there is no provider to charge and no card
payment for a share to be taken from.

## Handling fee — €0.25 + 1.5%, plus 23% VAT

One setting on the organisation type, inherited by all four clubs, with no
per-club override anywhere in the seed.

**The VAT applies to the fee, never to the order.** 23% of a €25 entry is not
what this is — the club prices its entries as it prices them, and the tax lands
on the 25c + 1.5% charged on top. `calculateHandlingFee` computes the net, then
the tax, then the total.

Worked through, from the fixture's own baskets:

| Fee-bearing base | Net (25c + 1.5%) | VAT at 23% | Charged |
|---:|---:|---:|---:|
| €55.00 | €1.08 | €0.25 | **€1.33** |
| €24.00 | €0.61 | €0.14 | **€0.75** |
| €22.00 | €0.58 | €0.13 | **€0.71** |
| €0.00 | — | — | **€0.00** |

That last row is not a rounding artefact. A basket with nothing fee-bearing in
it attracts **no fee at all**, the fixed 25c included — so no VAT either.
Áine McGrath's "all card, fee included" basket comes to €67.00 flat.

Three rules decide the base, all of them exercised by the seeded baskets:

1. The percentage applies to the **fee-bearing base**, not the card subtotal. An
   item whose price already absorbs its handling fee is excluded, or the member
   is billed for it twice.
2. The fixed 25c is charged **once per payment**, not once per item.
3. No fee-bearing items means no fee, fixed element included.

## Application fee — a flat 60c

**€0.60 and no percentage.** The platform's share is not a proportion of the
basket: one payment, one fixed charge, whatever it was for. Set once on the
organisation type and copied onto each organisation when it is created, exactly
as the admin UI does it.

| Club | Card method | Application fee |
|---|---|---|
| Kildare Hunt PC | Stripe | €0.60 *(type default)* |
| Laois Hunt PC | Stripe | **€0.45** — negotiated |
| Ward Union PC | none | €0.60 *(type default)* |
| Meath Hunt PC | Stripe | €0.60 *(type default)* |

**Laois is on its own rate, and that is the point of it.** Each organisation
gets its own application-fee row when it is created, and that row is what the
platform charges from then on — editing the type does not reach back and rewrite
a rate a club has already agreed. With every club on the default, "copied from
the type" and "read from the type" look identical until somebody edits the type,
so the fixture keeps one club that differs. It used to differ on the percentage;
now that the share carries none, it differs on the amount.

**Ward Union carries it too**, though it takes no card payments so it is never
charged today. It is set so that the day Ward switches Stripe on, the platform's
share is already what it is everywhere else rather than nothing at all. The club
used to hold explicit nulls to demonstrate an unconfigured organisation; a club
quietly paying no share is a worse thing to have in a fixture than a missing
example of one.

## Units, which differ between the two

`handlingFee.fixedFee` and `applicationFee.fixed` are written here in **major**
units — `0.25` is 25c, `0.6` is 60c — and `organizationTypePaymentFeeService`
converts the handling fee to minor units when it reads it back. That conversion
is why `database.ts` does `Math.round(fixedFee * 100)` before computing a
basket's fee.

`percentageFee: 1.5` and `taxPercentage: 23` are percentages, not fractions.
`applicationFee.percentage` is `0`, which is an explicit "no percentage" rather
than an unconfigured `null`.

## Not in Stripe

None of this lives in Stripe. The seed creates a connected account per club
(`acct_…`) and that account carries no fee configuration — every figure above is
in your own database.
