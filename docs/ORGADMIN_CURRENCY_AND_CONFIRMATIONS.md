# Money in the organisation's currency, and one way to ask "are you sure?"

Two i18n defects, both of which looked deliberate.

## Every money figure was hard-coded, in two directions

`formatCurrency(amount, 'GBP', locale)` appeared at twelve call sites across the payments and
lodgement screens. `formatCurrency(amount, 'EUR', i18n.language)` appeared at ten more across
reporting. The core dashboard carried a third: its own local formatter pinned to `en-IE` and `EUR`,
shadowing the shared helper.

So a euro club saw sterling on its payments list, its CSV export and the confirmation for an
irreversible refund — while the same club's revenue report was right by accident. A sterling club
saw the reverse. Each page was internally consistent, which is why no unit test caught it.

PRODUCT.md's headline positioning is *"multi-country from day one… currency fixed per organisation
type"*, and its durable constraints say a design *"must never imply a per-organisation currency
choice"*. The currency was never a per-screen decision.

### What replaced it

`useCurrency()` in `orgadmin-core`, reading the code from the organisation context:

```tsx
const { format: formatMoney } = useCurrency();
formatMoney(payment.amount)   // €50.00 for a euro club, £50.00 for a sterling one
```

**An unknown currency shows no symbol at all.** An organisation still loading, or one whose type
never set a currency, produces a plain formatted number rather than a confident guess — PRODUCT.md's
fifth principle asks for exactly that trade. A malformed code falls back to the bare amount rather
than to somebody else's money.

`formatCurrency`'s `'GBP'` default is gone; the parameter is required. The default *was* the trap:
a call that simply omitted the code rendered sterling, silently correct for one of the seven
currencies this platform supports.

`money-is-not-hard-coded.test.ts` walks the package and fails on any currency literal passed to a
formatter or used to build an `Intl` currency formatter — naming the file and line. It is a
structural test because the defect is a literal typed at a call site, and it was typed at
twenty-two of them before anybody noticed.

## Three ways to confirm a deletion, two of them English-only

- `VenuesListPage` and `EventTypesListPage` called the browser's own `confirm()` — OS chrome, no
  styling, no product context, and **no i18n**. A German administrator was asked *"Are you sure you
  want to delete this venue?"* in English by a dialog that did not look like the product. Their
  failure paths used `alert()` for the same reason.
- `UserDetailsPage` and `DiscountsListPage` use MUI dialogs with the English typed into the JSX.

Every one of them breaks the six-locale constraint PRODUCT.md calls durable. Deletion is also where
an unpaid volunteer decides whether to trust this software with the club's records, which makes it a
poor moment to fall back to something resembling an operating-system error.

### What replaced it

`ConfirmDialog` in `orgadmin-core`:

- **The button names the action** — "Delete venue", not "OK" — so a reader who skimmed the title
  still learns what happens before pressing it.
- Cancel comes first in the DOM, so the safe choice is the one a hurried keyboard user reaches.
- `busy` locks both buttons, so a double-click on a slow delete cannot send it twice.
- `destructive` defaults to true because every existing caller is deleting something.

`venues.*` and `eventTypes.*` keys were added in all six locales for the two screens that had none.

## Still outstanding

Named here so it is a task list rather than a rediscovery:

- **`UserDetailsPage` and `DiscountsListPage`** still hold English in the JSX. They at least render
  inside the design system; moving their strings to i18n and onto `ConfirmDialog` is the follow-up.
- **Save feedback is still in the wrong place.** `OrganisationDetailsTab` renders its success alert
  at the top of the panel while the Save button sits roughly a thousand pixels below, and it
  self-dismisses after three seconds. There is no dirty tracking and no route guard, so an
  interrupted session loses everything typed — the operating context PRODUCT.md names first.
- **Refund failure is `console.error` only**, so a volunteer sees nothing and clicks Refund again.
- **Those two events pages are otherwise untranslated.** Only their destructive confirm and its
  error path were brought into i18n here; the rest of both pages is still hard-coded English.
