# Timestamps that walked backwards

Saving an event moved its entry opening and closing times back by the server's
UTC offset — **every time it was saved**. Nobody edited the field. It just lost
an hour per save, and would have gone on losing one.

---

## How it was found

Not by anyone noticing. The audit trail found it: an event edit that changed
only the confirmation message recorded a change to `openDateEntries` as well,
from `17:23:46.269Z` to `16:23:46.269Z`. The natural assumption was a fault in
the new diffing code. It was not — the value really had changed.

Worth keeping, because it is the argument for the audit trail in one paragraph:
the drift was invisible from every screen, and only became visible once
something wrote down what the values had been.

---

## The mechanism

The columns are `timestamp without time zone` — a wall clock with no zone
attached. Reading and writing them were not inverse operations:

| step | what happened |
|---|---|
| **read** | node-postgres parses a naive timestamp as **local** time, so `17:23` became the instant `16:23Z` on a UTC+1 machine |
| **send** | the API serialised that instant: `2026-09-19T16:23:46.269Z` |
| **write** | Postgres cast it back to `timestamp without time zone` by **discarding the offset**, storing `16:23` |

Read applied the offset. Write discarded it. One round trip, one hour gone.

The user-visible half: a club typing *18:23* saved it and, on reloading the
page, saw *17:23*.

---

## Where it did and did not bite

**The deployed containers run UTC**, where local and UTC are the same and the
asymmetry cancels. So it was latent in production and live on any developer
machine in another zone — which is where it was found, on Europe/Dublin.

That is the reason to fix it rather than shrug:

- Local development data drifted silently, and dev disagreeing with production
  is the kind of difference that hides a fault until it is expensive.
- Setting `TZ` on the container — an entirely reasonable thing to do for an
  Irish product wanting readable logs — would have switched the corruption on
  in production, with no code change to blame.

**No data needs correcting.** Production never drifted, because it is UTC.

---

## The fix

One type parser, in `src/database/pool.ts`:

```ts
pgTypes.setTypeParser(1114, (value) =>
  value === null ? null : new Date(`${value.replace(' ', 'T')}Z`)
);
```

Naive timestamps are read as UTC, which is how they are written back. `17:23`
reads as `17:23Z`, is sent as `17:23Z`, and is stored again as `17:23`.

**At the driver, not in the event service.** The asymmetry belongs to the
driver, and every naive column shares it — `discounts.valid_from`,
`electronic_tickets.valid_until`, `reports.next_run_at` and a couple of dozen
more would each have needed the same patch, and would each have been forgotten
once. On a UTC server the change is a no-op, so this aligns development with
production rather than altering production.

### `date` is deliberately left alone

`date` (OID 1082) has the same local-midnight quirk: `2026-06-15` is read as
`2026-06-14T23:00:00.000Z` in Dublin. But a browser in the server's zone renders
that back as *15 June*, so the round trip is already correct, and turning these
into strings would change every caller that does arithmetic on them.

Where a `date` has to cross a zone boundary **server-side** — formatting one for
JSON rather than handing it to a browser — the caller converts explicitly. See
`asDateString` in `member-filter.service.ts`, which exists for exactly that
reason.

---

## The regression test

`src/database/__tests__/timestamp-round-trip.test.ts` pins `process.env.TZ` to
`Europe/Dublin`, because on UTC the bug is invisible and the test would pass
against broken code.

It was verified to fail before it was trusted: restoring the old local-time
reading fails five of its seven cases. It covers a single save, three
consecutive saves (the drift was cumulative), a date on the far side of the
daylight-saving boundary, a timestamp with no fractional seconds, and null.

One extra care: `src/__tests__/database/pool.test.ts` mocks `pg`, and the parser
registers at **import** time, so that mock must carry a `types` stub or the
suite fails before a single test runs.
