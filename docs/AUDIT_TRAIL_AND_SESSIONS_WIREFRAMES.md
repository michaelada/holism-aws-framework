# Wireframes — audit trail and sessions

Proposal. See [AUDIT_TRAIL_AND_SESSIONS.md](AUDIT_TRAIL_AND_SESSIONS.md).

Both live under a new Platform Admin nav group:

```
  PLATFORM          CONFIGURATION      CONTENT     ACCESS      OVERSIGHT   ← new
  · Dashboard       · Org Types        · Posts     · Users     · Sessions
                    · Organisations                · Roles     · Audit log
```

---

## 1. Sessions — who is signed in

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│  Sessions                                                    [ ⟳ Refresh ]         │
│  Everyone with a live session. A session means somebody signed in and has not       │
│  signed out or timed out — not that they are at the keyboard.                       │
├────────────────────────────────────────────────────────────────────────────────────┤
│  [ Organisation ▾ ]  [ User type ▾ ]  [ Application ▾ ]        27 sessions          │
├──────────────────────┬──────────────┬───────────────┬──────────┬──────────┬────────┤
│  User                │ Type         │ Organisation  │ Signed in│ Last seen│        │
├──────────────────────┼──────────────┼───────────────┼──────────┼──────────┼────────┤
│  Aoife Byrne         │ Org admin    │ Kildare Hunt  │ 09:12    │ 2 min ago│  [ ⋮ ] │
│  admin@kildarehunt…  │              │ Pony Club     │          │          │        │
│  Org Admin · 10.0.0.4│              │               │          │          │        │
├──────────────────────┼──────────────┼───────────────┼──────────┼──────────┼────────┤
│  Niamh Walsh         │ Account user │ Laois Hunt    │ 08:47    │ 31 s ago │  [ ⋮ ] │
│  niamh.walsh@…       │              │ Pony Club     │          │          │        │
│  Account · 10.0.0.9  │              │               │          │          │        │
├──────────────────────┼──────────────┼───────────────┼──────────┼──────────┼────────┤
│  Sam Platform        │ Super admin  │ —             │ 07:55    │ 5 min ago│  [ ⋮ ] │
│  super.admin@…       │              │               │          │          │        │
│  Platform Admin      │              │               │          │          │        │
├──────────────────────┴──────────────┴───────────────┴──────────┴──────────┴────────┤
│  ⋮ = End this session · End all sessions for this person · View their audit trail   │
└────────────────────────────────────────────────────────────────────────────────────┘
```

Each row is one **session**, not one person: somebody signed in on a phone and a
laptop appears twice, which is the point — "end this session" then means
something specific.

### Confirmation — and the honest wording

```
┌──────────────────────────────────────────────────────────────┐
│  Sign Aoife Byrne out of all sessions?                       │
│                                                              │
│  They will be signed out within 5 minutes and will have to   │
│  sign in again. Anything they are part-way through — a form,  │
│  a basket — is kept.                                          │
│                                                              │
│  This is recorded in the audit log.                          │
│                                                              │
│                            [ Cancel ]  [ Sign them out ]     │
└──────────────────────────────────────────────────────────────┘
```

"Within 5 minutes", not "now": ending the Keycloak session stops the refresh,
but the access token already issued stays valid for its remaining lifetime. See
§1.2 of the design for the option that makes it immediate.

---

## 2. Audit log — the list

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  Audit log                                                        [ ⬇ Export CSV ]  │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  🔎 [ membership number KHP-0241…                                    ]              │
│  [ Organisation ▾ ] [ User ▾ ] [ User type ▾ ] [ Category ▾ ] [ Action ▾ ]           │
│  [ From 01/08/2026 ] [ To 21/08/2026 ]   [ Outcome ▾ ]         Clear all             │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  1,284 events                                            Newest first ▾             │
├────────────┬───────────────┬──────────────┬────────────────────────────────┬────────┤
│ When       │ Who           │ Organisation │ What                           │        │
├────────────┼───────────────┼──────────────┼────────────────────────────────┼────────┤
│ 21 Aug     │ Aoife Byrne   │ Kildare Hunt │ ✎ Activity updated             │  [ > ] │
│ 09:41:02   │ Org admin     │ Pony Club    │ Grade 1 — 80cm · fee, limit    │        │
├────────────┼───────────────┼──────────────┼────────────────────────────────┼────────┤
│ 21 Aug     │ Niamh Walsh   │ Laois Hunt   │ 🛒 Entry added to basket        │  [ > ] │
│ 09:38:55   │ Account user  │ Pony Club    │ Autumn Rally · Grade 2          │        │
├────────────┼───────────────┼──────────────┼────────────────────────────────┼────────┤
│ 21 Aug     │ unknown       │ —            │ ⚠ Sign-in failed               │  [ > ] │
│ 09:31:10   │ —             │              │ admin@kildarehunt.test · ×3     │        │
├────────────┼───────────────┼──────────────┼────────────────────────────────┼────────┤
│ 21 Aug     │ Sam Platform  │ —            │ 🔑 Capability granted           │  [ > ] │
│ 09:04:18   │ Super admin   │              │ Kildare Hunt PC · memberships   │        │
├────────────┴───────────────┴──────────────┴────────────────────────────────┴────────┤
│                                                          [ Load older events ]      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

Notes on the shape:

- **Newest first, keyset paginated.** `OFFSET` on a table of millions gets slower
  the further back you look, which is exactly where an investigation goes.
- **A failure row keeps its actor column honest** — a failed sign-in has no
  authenticated actor, so "unknown" is shown rather than blank, and the email
  that was *attempted* sits in the detail line.
- **"Load older"**, not page numbers. Page 47 of an audit log means nothing;
  a time range does.

---

## 3. Audit log — one event

The before/after view is the reason the feature exists.

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  ← Audit log                                                                        │
│  Activity updated                                                                   │
│  21 August 2026 at 09:41:02                                                         │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  Who            Aoife Byrne  ·  Org admin  ·  admin@kildarehunt.test                 │
│                 [ View their audit trail ]  [ View their sessions ]                 │
│  Organisation   Kildare Hunt Pony Club                                              │
│  What           event-activity · Grade 1 — 80cm                                     │
│  Outcome        Success                                                             │
│  Where from     10.0.0.4 · Chrome on macOS · session 8d7000d7                       │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  Changes                                                                            │
│  ┌───────────────────┬─────────────────────────┬─────────────────────────┐          │
│  │ Field             │ Before                  │ After                   │          │
│  ├───────────────────┼─────────────────────────┼─────────────────────────┤          │
│  │ fee               │ €25.00                  │ €30.00                  │          │
│  │ entriesLimit      │ —                       │ 40                      │          │
│  │ entryEligibility  │ all                     │ members                 │          │
│  └───────────────────┴─────────────────────────┴─────────────────────────┘          │
│                                                                                     │
│  ▸ Raw record (JSON)                                                                │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

Values are **formatted for a reader** — `€25.00`, not `2500`; `—` for null —
because the person reading this is answering "was that change reasonable?", not
debugging. The raw JSON stays one click away for when it is a debugging session
after all.

### A creation

```
│  Changes                                                                 │
│  Created with                                                            │
│  ┌───────────────────┬─────────────────────────────────────────┐         │
│  │ name              │ Grade 1 — 80cm                          │         │
│  │ fee               │ €25.00                                  │         │
│  │ entriesLimit      │ 40                                      │         │
│  └───────────────────┴─────────────────────────────────────────┘         │
```

### An entry, with its form answers

Showing the §2.5 redaction decision as it would look under option (c):

```
│  Changes                                                                 │
│  Form answers                                                            │
│  ┌───────────────────────┬─────────────────────────────────────┐         │
│  │ Rider name            │ Saoirse Brennan                     │         │
│  │ Age group             │ Under 14                            │         │
│  │ Pony or horse name    │ Bluebell                            │         │
│  │ Vaccination status    │ Up to date                          │         │
│  │ Medical notes         │ 🔒 hidden — marked sensitive        │         │
│  │ Emergency contact     │ 🔒 hidden — marked sensitive        │         │
│  └───────────────────────┴─────────────────────────────────────┘         │
│  Payment method          Card (Stripe)                                   │
```

The lock is deliberate and visible: a reader can see that a field *was*
answered without the answer being copied into a second store. If you would
rather see everything, that is option (a) in the design — but it should be a
decision, not a default.

---

## 4. Filters — the panel expanded

```
┌──────────────────────────────────────────────────────────────┐
│  Category                                                    │
│  [x] Security          [ ] Events         [ ] Memberships    │
│  [ ] Payments          [ ] Settings       [ ] Registrations  │
│  [ ] Bookings          [ ] Merchandise    [ ] Forms          │
│  [ ] Data & reports    [ ] Platform                          │
│                                                              │
│  User type                                                   │
│  [x] Super admin  [x] Org admin  [ ] Account user  [ ] System│
│                                                              │
│  Outcome                                                     │
│  [x] Success      [x] Failure    [x] Denied                  │
│                                                              │
│  Free text                                                   │
│  [ KHP-0241                                              ]   │
│  Matches names, emails, what was affected, and the values    │
│  that changed.                                               │
└──────────────────────────────────────────────────────────────┘
```

**Failure and denied are ticked by default alongside success.** An audit log
whose default view hides refusals answers "what happened" but not "what was
attempted", and the second question is usually the one being asked.

---

## 5. Empty and degraded states

```
┌──────────────────────────────────────────────────────────────┐
│  No events match those filters.                              │
│  The earliest event recorded is 14 August 2026.              │
│                                          [ Clear filters ]   │
└──────────────────────────────────────────────────────────────┘
```

Naming the earliest event distinguishes "your filters are too narrow" from
"auditing was not running then" — which, given the log will start on a
particular day, is a real question a reader will have.

```
┌──────────────────────────────────────────────────────────────┐
│  ⚠ Some events could not be recorded                         │
│  14 audit writes failed in the last hour. The actions        │
│  themselves succeeded. See the platform logs.                │
└──────────────────────────────────────────────────────────────┘
```

Because audit writes are deliberately non-blocking (§2.6), a silent failure
would leave a gap nobody knew about. The gap is surfaced where the log is read.
