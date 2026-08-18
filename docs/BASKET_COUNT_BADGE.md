# The basket count in the navigation

The **Basket** menu item now carries a small orange badge with white text
showing how many things are in it.

## What it counts

**Lines, not quantities.** Three of one jumper is one thing to come back to, and
a badge reading "3" beside a basket holding a single item would send the member
to check. Verified live: one line of quantity 3 shows `1`.

**Live lines only.** A hold that has lapsed is no longer something the member
has — checkout refuses the whole basket while one is present — so counting it
would advertise an item they cannot buy.

**Nothing at all when the basket is empty.** A badge reading `0` is a permanent
fixture that stops carrying information, and there is nothing behind it to go
and look at.

## Keeping it honest

The count sits in the shell; the things that change it are scattered — a slot
from the calendar, a size from the shop, an entry from a form, a line removed on
the basket page itself.

Threading a refresh callback through every one of those has a predictable
failure: a screen added later quietly does not update the badge, and nothing
points at why. So the notification is raised where all of them already pass —
`useAccountApi`, which fires `notifyCartChanged()` after any successful write to
a cart or checkout URL:

```
POST   /account/:org/cart/items                    → notify
DELETE /account/:org/cart/items/:id                → notify
PUT    /account/:org/cart/items/:id/payment-method → notify
POST   /account/:org/checkout                      → notify
GET    /account/:org/cart                          → no (it *is* the refresh)
PUT    /account/:org/profile                       → no
```

A page needs to know nothing about the badge, and a page added later gets it
without being told. Reads are excluded deliberately: the count is refreshed *by*
a read, and treating that as a change would have it fetch itself for ever.

The listener registry is a module-level set rather than a context. Putting it in
a provider would re-render every screen whenever anything anywhere touched the
basket, to update one number in the menu.

## Colour and announcement

Orange (`warning.main`) on white, rather than the club's own primary — that
colour is already used by the selected state of this very list, and a count
wearing it would read as selection.

The badge is announced as a phrase: `aria-label="3 items in your basket"`, with
the digits themselves `aria-hidden` so a screen reader does not read them twice.
A bare "3" beside "Basket" is not a sentence.

New i18n key in all six locales: `nav.cartCount` / `nav.cartCount_other`.

## A paid basket is an empty basket

Reported as: a successful card payment, and the badge still carrying the count
it had before.

A basket write is what tells the badge to look again — and a card payment does
not end in one. The sequence is:

1. `POST /checkout` — a write, so the badge refetches. The cart is **still
   full**: checkout only reserves the payment.
2. The browser confirms the card with Stripe. Nothing goes through the account
   API at all.
3. Stripe's webhook reaches the server, and `confirmPayment` sets the cart to
   `ordered`. **This is where the basket empties**, and it happens with no
   client request involved.
4. The client polls `GET /payments/:id` — a read, deliberately excluded, since
   the count is refreshed *by* a read and treating one as a change would have
   it fetch itself for ever.

So the last thing the badge heard was step 1, where the basket was full, and
that is the number it kept.

Paying **offline** was unaffected, which is what made this look inconsistent:
`markAwaitingOfflinePayment` closes the cart *during* the checkout request, so
by the time that write returned the basket really was empty.

The fix names the missing event rather than widening what counts as a write.
`notifyIfSettled` announces a payment that has reached any status but `pending`,
and the two screens that watch one resolve call it: the checkout page when its
poll settles, and the confirmation page whenever it reads a settled payment.

Both, not either — the confirmation can land after the checkout screen has given
up waiting, and a member can reach the confirmation page directly, returning
from a bank's 3-D Secure step or opening the link again days later.

A `failed` payment is announced too. The basket stays open, but a decline drops
its holds back to the browsing window, so a line may now be expired and out of
the count.

## Where it lives

| Concern | File |
|---|---|
| The notification, what counts as a basket write, and settlement | `src/cart/cartActivity.ts` |
| Fetching and counting | `src/cart/useCartCount.ts` |
| The badge | `src/components/AppShell.tsx` |
| Announcing a settled payment | `src/pages/CheckoutPage.tsx`, `src/pages/OrderConfirmationPage.tsx` |

## Verified

Account-shell 561 passing. Live: the count moves from 0 → 1 → 2 as lines are
added, and a line of quantity 3 counts as one. The cart-closing update was
traced to `confirmPayment`, reached only from the webhook — confirming there is
no client write between checkout and an emptied basket.

The 3 remaining failures are the pre-existing `packages/components` breakage
described in [PHANTOM_CAPABILITIES.md](PHANTOM_CAPABILITIES.md), unrelated to
this change.
