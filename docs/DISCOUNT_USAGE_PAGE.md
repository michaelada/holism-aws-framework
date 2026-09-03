# View Usage led to Page Not Found

## The report

> The View Usage Stats icon on a discount row, when I click on it I get a Page Not Found 404, e.g.
> `http://localhost:5175/orgadmin/members/discounts/d1a250d5-…/stats` in the Memberships Discounts
> section.

## Why every module 404'd

`DiscountsListPage` is shared — five modules mount it under their own section with a `moduleType` —
and its *View Usage* icon has always navigated to:

```ts
navigate(`${getBasePath()}/discounts/${discount.id}/stats`);
```

**No module ever registered that path.** Events, memberships, merchandise and calendar each register
the list, the create form and the edit form, and nothing else; the page the icon reached for was
never built. So the icon 404'd in every module, not only memberships — and nothing could catch it,
because the navigation lives in `orgadmin-events` and the routing lives in four other packages.

## The page

`DiscountUsagePage`, in `orgadmin-events` beside the list it belongs to, wrapped by
`orgadmin-memberships`, `orgadmin-merchandise` and `orgadmin-calendar` the way `DiscountsListPage`
already is, and registered at `‹section›/discounts/:id/stats` **under the same capability as the
list** — a club without the module's discounts should not reach a discount's figures by typing the
URL.

```
Family membership 10%  [Active]
Code FAMILY10 — how often this discount has been used, and what it has taken off.

┌ Times used ─┐ ┌ Total discount ─┐ ┌ Average per use ┐ ┌ Uses remaining ─┐
│      4      │ │     €60.00      │ │     €15.00      │ │       36        │
└─────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘

Who used it
─────────────────────────────────────────────
Member                     Uses    Discount received
Aoife Byrne                   3               €45.00
Conor McGrath                 1               €15.00

[← Back to discounts]  [✎ Edit]
```

- **Uses remaining says *No limit*** where the discount has no cap. `0` would read as one that has
  run out — the opposite.
- **Members are named**, not listed as uuids. A use by somebody since removed still counts, under
  *Member no longer on record*.
- **A discount nobody has used says so.** That is the ordinary state of one just created; a table of
  nothing under four zeroes reads as a page that failed to load.
- **Back goes to the section it was opened from**, because the page is shared and the section is not.

## The numbers had to come from somewhere real

`getUsageStats` counted rows in `discount_usage`. That table is written by `discountService.
recordUsage` — **which nothing has ever called.** It is empty in every environment, so a page built
on it would have reported nought uses for a discount used all season, and reported it confidently.

Where a discount *is* recorded against a purchase is the cart line: `cart_items.discount_id` and
`cart_items.discount_amount`. The cart survives checkout as `ordered` (`payments.cart_id` points back
at it), so the line is still there to be counted afterwards. The query now reads that:

- **A use is a line on a cart that became an order.** Not an open cart — a shopper still thinking —
  and not an abandoned one. The payment behind it may still be outstanding: an offline order awaiting
  a cheque has used the discount, and the club's next question is who owes what.
- **Members are named** through `carts.user_id → organization_users`, left outer so a removed member
  still counts.
- **Amounts convert to major units.** Cart lines are minor units; every other money field this API
  returns is major, and a page that formats one field in cents is worse than one that formats none.

Verified against the development database: with one ordered cart line carrying a €7.50 discount, the
service reports one use, €7.50 given, against *Darragh O'Toole*; the line was restored afterwards.

## What this does not fix

**Nothing applies a discount to a purchase yet.** No account journey sets `cart_items.discount_id` —
the field is written by `cart.service` if a caller passes `discountId`, and no caller does. Discounts
can be created, edited, listed, gated and now measured, but nothing has ever taken money off with
one, so every club's figures will read zero until that is built. The page is honest about it (*This
discount has not been used yet*) rather than implying a measurement.

Two related gaps, sighted and left alone because they were not part of this report:

- `recordUsage` and `discount_usage` are dead code. `discount-validator.service` reads the same empty
  table for `perUserLimit`, so a **per-user usage limit is not enforced** — it always sees nought.
- The seed writes `usage_limits` as `{used, totalUses, usesPerMember}`, while the service and the
  form use `{totalUsageLimit, perUserLimit, currentUsageCount}`. The list's Usage column reads the
  latter, so seeded discounts show `0` regardless.
- `orgadmin-registrations` has `DiscountsListPage`, `CreateDiscountPage` and `EditDiscountPage` but
  **registers no discount routes at all**, so that module's discounts are unreachable.

## Tests

| Suite | Covers |
|---|---|
| `discount.usage-stats.test.ts` (backend) | reads cart lines rather than `discount_usage`; ordered carts only; major units out; no divide-by-nought; names members; counts a removed member; the remainder against a cap, floored at nought and absent without one |
| `discount.service.test.ts` (backend) | the pre-existing Usage Statistics block, updated to the new contract |
| `DiscountUsagePage.test.tsx` | reads the discount and its stats together; the four figures; *No limit*; names rather than ids; the not-used-yet state; a load failure; Back and Edit per module |
| `discount-usage-route.test.ts` | **the guard for the reported defect** — every module that mounts the shared list also mounts the usage page, under the same capability, at the path the list actually navigates to |
| `DiscountNavigation.integration.test.tsx` (memberships) | the route is registered and gated |
