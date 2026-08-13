# Configurable Stripe Connect application fee per organisation type

The platform's cut of a card payment is now configured per organisation type and payment method,
alongside the handling fee, instead of being fixed at "whatever the handling fee was".

---

## 1. The distinction this rests on

Two amounts that had been the same number:

| | Handling fee | **Application fee** |
|---|---|---|
| Who pays it | the **member** | nobody — it is a split |
| What it does | **adds** to the member's total | decides how the collected money is **divided** |
| Where it appears | the basket, as a surcharge | Stripe Connect's `application_fee_amount` |
| Who receives it | — | the **platform**; the club gets the remainder |

The checkout used to set `application_fee_amount` to the whole handling fee, so the platform took
exactly the surcharge and the club received the item price. That is one reasonable commercial
arrangement, but it cannot express "charge the member 1.5% but take 3% of the sale", or the reverse
— letting the club keep part of the surcharge.

**Changing the application fee does not change what the member pays.** The member's total is settled
by `calculateCartTotals`; this only moves the boundary between the platform and the club.

## 2. ⚠️ Why the columns are nullable

`application_fee_fixed` and `application_fee_percentage` are **nullable, and NULL means "take the
handling fee"** — exactly the previous behaviour.

A `NOT NULL DEFAULT 0` column would have been the obvious choice and would have been a quiet
disaster: every existing organisation type would have switched to an application fee of zero, the
platform would have taken nothing, and the handling fee it had been collecting would have started
settling into the clubs' balances. A revenue change, applied retroactively, with no visible cause.

A super admin opts in by setting them; until then nothing moves.

Two database constraints back this up: the values cannot be negative, and they must be set **both or
neither**. A half-filled pair reads as "0% plus a fixed 50c" when what was meant was "I only filled
in one box", and the difference is the platform's revenue on every sale. `validateApplicationFeeRates`
and the editor's `exampleApplicationFee` both treat a half-filled pair as unconfigured for the same
reason.

## 3. How it is calculated

`calculateApplicationFee` in `src/utils/handling-fee.ts`:

```
applicationFee = applicationFeeFixed + applicationFeePercentage% × cardSubtotal
```

- **The percentage is on the value sold, not on the charge.** Taking a percentage of our own
  surcharge would compound it, and the platform's commission is on what the club sold.
- **Capped at the amount charged.** Stripe rejects a fee larger than the charge, and it would leave
  the club with nothing. Capping rather than refusing is the lesser evil — declining the sale
  punishes the member for a misconfiguration they cannot see, and the cap is visible in the
  `application_fee_amount` recorded on the payment.
- There is **no tax element**, unlike the handling fee. The handling fee's tax is a member-facing
  charge; the platform's share of money already collected is not.

## 4. Where it is set

Super admin → organisation type → payment fees (`PaymentFeeEditor`, screen J1). The two fields sit
in their own block, visually apart from the three handling-fee fields, with a worked example that
says either:

> The platform keeps **€1.74** of that €62.00 charge; the organisation receives the rest.

or, when unset:

> Not set — the platform keeps the handling fee **€1.18**, as it does today.

The separation is deliberate: three abstract rates were already hard to sanity-check, and mixing a
member-facing surcharge with a platform/club split in one undifferentiated list is how a
misconfiguration goes unnoticed.

## 5. Changes

| Area | Change |
|---|---|
| Migration `1709000000012` | Two nullable columns plus the non-negative and both-or-neither constraints |
| `utils/handling-fee.ts` | `calculateApplicationFee`, `ApplicationFeeConfig` |
| `organization-type-payment-fee.service.ts` | `ApplicationFeeRates`, `validateApplicationFeeRates`, read/write |
| `checkout.service.ts` | Uses the configured fee; records what was actually taken |
| `admin/PaymentFeeEditor.tsx` | Two fields, `exampleApplicationFee`, worked example |

**Tests:** 13 for the calculator, 4 for checkout's use of it, 8 for the editor.

## 6. Not done

- **No per-organisation override.** The fee is inherited from the organisation type, like the
  handling fee — G5's model, unchanged.
- **Nothing is backfilled.** Every existing type reads as unconfigured, which preserves today's
  behaviour but means the new fields are blank until someone fills them in.
- **Not exercised against real Stripe.** The value reaches `application_fee_amount` on the
  PaymentIntent, but as with the rest of the Connect work this has only been tested with a stubbed
  client.
