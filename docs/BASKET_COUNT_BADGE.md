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

## Where it lives

| Concern | File |
|---|---|
| The notification, and what counts as a basket write | `src/cart/cartActivity.ts` |
| Fetching and counting | `src/cart/useCartCount.ts` |
| The badge | `src/components/AppShell.tsx` |

## Verified

Account-shell 542 passing. Live: the count moves from 0 → 1 → 2 as lines are
added, and a line of quantity 3 counts as one.

The 3 remaining failures are the pre-existing `packages/components` breakage
described in [PHANTOM_CAPABILITIES.md](PHANTOM_CAPABILITIES.md), unrelated to
this change.
