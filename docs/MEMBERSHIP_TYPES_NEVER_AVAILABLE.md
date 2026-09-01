# No member could apply for a membership

## The symptom

Every membership type, in every club, came back refused:

```
Associate Member    available=false  reason=not-open-for-applications
Family Membership   available=false  reason=not-open-for-applications
Junior Member       available=false  reason=not-open-for-applications
Senior Member       available=false  reason=not-open-for-applications
```

Reported as "open up the membership types in the seed so I can test paying for membership". The seed
was not the problem — four of its five types are `open`, and the fifth is closed on purpose.

## The cause

One line, in `account-catalogue.service`:

```ts
if (row.membership_status !== 'active') {
  reason = 'not-open-for-applications';
}
```

The column does not hold `'active'`. It holds `'open'`:

- migration `1707000000006` defaults it to `'open'`
- the org-admin form writes `'open'` and `'closed'`
- `account-activity.service` selects on `membership_status = 'open'`

So the test was true of every row ever written, and every membership type in every club read as not
open for applications. Nothing errored. The list simply came back all-refused, which looks exactly
like a club that has not opened its memberships yet.

## Why it survived

`account-catalogue.renewal.test.ts` built its fixtures with `membership_status: 'active'` and
`'inactive'` — the same wrong vocabulary as the code under test. Both being wrong in the same way is
why the suite passed: it asserted the bug.

The fixtures now say `'open'` and `'closed'`, and two cases assert the vocabulary itself — that the
column's own word for open is treated as open, and that some other word is not.

## The fix

`membership_status !== 'open'`. The seed is unchanged.

Verified against the running backend, as a signed-in member of Kildare:

```
Associate Member    available=true
Family Membership   available=true
Junior Member       available=true
Senior Member       available=true
Founder Member      available=false  not-open-for-applications   ← closed in the seed, correctly
```
