# The org-admin payments screens described a payment nobody sends

## The report

> All dates display as "Invalid Date". The Status and Type columns show
> `common.status.undefined` and `payments.paymentTypes.undefined`. Clicking into
> a payment gives a 404.

Four symptoms, two causes.

## Cause one: a hand-written interface that was never true

`PaymentsListPage` and `PaymentDetailsPage` each declared:

```ts
interface Payment {
  date: string;
  status: 'pending' | 'paid' | 'refunded' | 'failed';
  type: 'event' | 'membership' | …;
  customerName: string;
  customerEmail: string;
  relatedTransaction: { id: string; name: string; type: string };
}
```

The endpoint returns:

```
paymentDate, createdAt, paymentStatus, paymentType, paymentMethod,
paymentProvider, providerTransactionId, contextId, amount, currency, metadata
```

Not one of the named fields exists. So:

| On screen | Because |
|---|---|
| `Invalid Date` | `new Date(payment.date)` on `undefined` |
| `common.status.undefined` | `t(\`common.status.${payment.status}\`)` |
| `payments.paymentTypes.undefined` | the same, for `type` |
| a blank customer | `customerName` / `customerEmail` |

**Nothing failed, and nothing could.** The response is untyped, so an interface
over it is an assertion rather than a check — TypeScript was told the shape and
believed it. The tests encoded the same fiction in their fixtures, so the suite
and the code agreed with each other and both disagreed with the server.

The detail page was worse: it read `payment.relatedTransaction.name` with no
guard, so it threw before it could paint.

## Cause two: a doubled route prefix

```ts
navigate(`/orgadmin/payments/${paymentId}`);
```

The router already carries `/orgadmin` as its basename, so this produced
`/orgadmin/orgadmin/payments/…` and a 404. Every other page in the package
navigates without the prefix.

**The same bug was in `AccountUsersListPage`**, unreported — `/orgadmin/users/accounts/…`
— and is fixed with it.

## What changed

- Both interfaces now name what the API sends, and both pages read those fields.
- **The date shows the time.** `dd MMM yyyy HH:mm` on the list, date-and-time on
  the detail. Two payments on one day are told apart by nothing else, and "when
  exactly" is the first question asked of a payment being traced.
- **`paymentDate` falls back to `createdAt`.** The former is null until the
  money moves, so an unpaid payment would otherwise be the one row with no date
  — and the unpaid rows are the ones being chased.
- Status and type render with a `defaultValue`, so an unmapped value shows
  itself rather than the missing key. `paymentTypes.cart` was added: every
  basket checkout writes `cart`, and the six existing types are the older
  per-item shape.
- **`payment.service.rowToPayment` returns the payer.** Both queries have always
  joined `organization_users` for `user_name` and `user_email`, and the mapper
  dropped them. `user_name` is `first_name || ' ' || last_name`, which Postgres
  makes null when either part is, so it is trimmed to null rather than reaching
  a screen as `"null"`.
- **The refund card is gone from the detail page.** Every field in it — the
  refund date, the reason — lives in the `refunds` table, which
  `GET /payments/:id` does not return, so for a refunded payment it rendered an
  empty box with "N/A" in it. Bringing it back means loading a payment's
  refunds: a feature, not a fix.

## Also: the time on the member's own payments

`MyPaymentsPage` now uses `formatDisplayDateTime` — the function was already
there beside `formatDisplayDate`, unused on this screen. A member checking this
against a card statement needs the hour.

## Verified in the browser

```
Date               Customer         Amount   Status   Type    Method
29 Aug 2026 12:08  Órla Kavanagh    €40.00   Pending  Basket  Offline
01 Sep 2026 11:45  Áine McGrath     €76.70   Paid     Basket  Card
```

and the row's "View Details" now opens
`/orgadmin/payments/e366b9f6-…` — payment id, amount, status, method, date and
time, and the payer's name and email.

## Tests

The fixtures in `PaymentsListPage.test.tsx` and `PaymentDetailsPage.test.tsx`
carried the invented shape, which is why 22 of them passed against a screen that
could not render. They now describe what the API sends. `payment.service.test.ts`
gained the payer coming through the join, and a null name reported as absent
rather than as a space.
