# Scanning tickets at the gate — options

**Status: research. Nothing here is built.** This is the case for a decision, not a plan that has
been agreed.

## The ask

> The event tickets we create and email to people have a QR code on them. Recommend a solution that
> lets event organisers scan tickets electronically as people enter, linked back automatically to the
> server to mark tickets as scanned, and to make sure a ticket is not used more than its allotted
> amount.

---

## 1. What already exists

More than you might expect, and the parts that exist are the right ones.

| | Where |
|---|---|
| **The QR holds an opaque UUID** — `electronic_tickets.qr_code` | `ticketing.service.issueTicketForEntry` |
| **Look a ticket up by that code**, scoped to the ticket's organisation | `GET /api/orgadmin/tickets/qr/:qrCode`, guarded by `byResource('ticketByQr')` |
| **Mark it scanned**, writing a history row | `PUT /api/orgadmin/tickets/:id/scan-status` |
| **`scan_count`, `scan_status`, `scan_date`, `scan_location`** | `electronic_tickets` |
| **A full scan history** — one row per presentation, with location and who scanned | `ticket_scan_history` |
| **An offline-capable front end**, service worker and response cache | `account-shell` (`vite-plugin-pwa`, `offline/responseCache.ts`) |

What does **not** exist: any scanning interface, and any QR-*reading* library. `qrcode` generates
codes; nothing in the repository reads one.

The opaque UUID is the pivot for everything below. It carries no claims, so it cannot be verified
without asking the server — which is a safe default, and the reason offline scanning needs a
deliberate answer rather than falling out for free.

---

## 2. Three gaps to close whichever option is chosen

These are not option-specific. They are the correctness of the feature.

### 2.1 Marking a ticket is not atomic, and enforces no ceiling

The flow is a lookup followed by an update, and the update is:

```sql
SET scan_count = scan_count + 1
```

with no comparison against anything. Two stewards on two gates scanning the same code at the same
moment both succeed, and a code scanned twice at one gate increments twice without complaint.

The fix is one statement, where **"did I get a row back" is the admission decision**:

```sql
UPDATE electronic_tickets
   SET scan_count = scan_count + 1, scan_status = 'scanned', scan_date = NOW(), ...
 WHERE id = $1 AND scan_count < admits AND status = 'issued' AND valid_until > NOW()
 RETURNING *
```

No row means refused, and the reason is a second cheap query — already used up, wrong event,
cancelled, expired. Postgres serialises the row lock, so two devices cannot both win.

### 2.2 There is no allotment to enforce

"Not used more than its allotted amount" has nothing to compare against today: `electronic_tickets`
has a `scan_count` and no ceiling, and `electronic_tickets_entry_unique` means exactly one ticket per
entry. A family ticket admitting four cannot be expressed at all.

Needed: an `admits` column (default 1), fed from the entry's `quantity` at issue. It is also the
column that makes re-entry policy sayable — a day ticket that permits leaving and returning is
`admits = 2`, or a policy flag if the club wants unlimited re-entry.

### 2.3 Nothing revokes a ticket

Refund an entry, withdraw it (`entry_status = 'removed'`), or cancel the event, and the ticket still
scans green. The refund path already knows how to withdraw entries; it does not touch tickets. Any
scanner will surface this immediately, because it is the first thing a gate meets.

---

## 3. The options

### A. A scanner page in the org-admin, online only

A route like `/orgadmin/tickets/:eventId/scan` using the phone's own camera —
`getUserMedia` with `html5-qrcode` or `@zxing/browser` — posting each code to a new atomic
`POST /tickets/scan`. Full-screen result: green with the holder's name, red with the reason, a beep
for each, camera stays live for the next person.

- **Effort:** small — a few days including §2.
- **Runs on:** any phone with a browser. No install, no store, no second codebase.
- **Needs:** HTTPS (already true behind nginx) and **a signal at the gate**.

The question that decides whether this is enough: *do your venues have coverage?* These are fields in
Meath and Kildare. If the answer is "mostly, and the gate is near the clubhouse", A is the whole
answer. If it is "not reliably", A is a stepping stone to B rather than a solution.

### B. The same page, made offline-tolerant

Before the gate opens, the steward's device downloads that event's tickets — a few hundred rows,
tens of kilobytes. Scans are validated against that list locally, queued, and synced when signal
returns. The pattern already exists in `account-shell` (`responseCache`, `StaleDataContext`, the
online/offline hook), so this is applying something the codebase has rather than inventing it.

- **Effort:** two to three times A.
- **The honest limitation:** offline, **two devices cannot prevent the same ticket being used
  twice**. They can only detect it on sync. Mitigations: one device per gate (which is how a gate
  usually works anyway), or accept detection after the fact — the history already records every
  presentation, so a duplicate is visible in the report.

### C. Signed tokens in the QR instead of an opaque id

> **Built, on top of B** — see [SIGNED_TICKET_CODES.md](SIGNED_TICKET_CODES.md). Two things below
> turned out differently in the building: HMAC rather than a public-key signature, because the
> scanner has the manifest and nothing but the server needs the key; and **no reissue**, because a
> new column carries the token and the old bare UUIDs are still accepted.


The QR carries a small signed payload — ticket id, event, expiry, an HMAC or Ed25519 signature — so a
device can prove the ticket is genuine with no server and no pre-download.

It still cannot know whether the ticket has already been used. **Authenticity and use-count are
different problems**, and only the second one matters at a gate where the fraud is a forwarded
screenshot rather than a forged code. So C needs A or B underneath it regardless, and it changes the
QR format, meaning every ticket already issued must be reissued.

- **Worth it if:** you have events where devices genuinely cannot pre-download — a gate with no
  signal *and* no chance to prepare beforehand.
- **Otherwise:** B buys the same offline capability without touching the ticket format.
- **What it actually bought, once built:** the ability to answer *"not for this event"* and *"not
  one of ours"* as different sentences, offline, which the manifest alone cannot do — a ticket for
  another event is simply absent from it. That, and a refusal reason a club can read afterwards.

### D. A native or Expo application

Better camera handling, support for hardware scanners, background sync.

- **Effort:** weeks, plus app-store accounts, review cycles and a second codebase to keep in step
  with this one.
- **Justified by:** hardware scanners, or throughput a phone camera cannot keep up with. Neither
  sounds like a pony club gate.

### E. An off-the-shelf scanner app opening a deep link

Cheapest possible: the QR encodes a URL, any scanner app opens it in a browser.

**Recommended against.** A generic scanner opens a tab, which is slow at a gate; the steward must
already be signed in; and you control none of the result screen — which is the part that actually
matters when somebody is waiting in the rain.

---

## 4. Recommendation

**Build A, shaped so that B is an increment** — the same scanner interface and the same endpoint,
with the local ticket cache added when a club actually meets a gate with no signal. Close §2 as part
of A: it is small, and without it the feature is wrong rather than incomplete.

Reasons, in order:

1. **The two hard parts are server-side and shared by every option** — atomic admission and an
   allotment to enforce. Do those once, first.
2. **A browser scanner costs a few days and no ongoing distribution.** A native app costs weeks and
   an app store relationship, for a camera the browser already reaches.
3. **Offline is a real risk, but not necessarily today's risk.** B answers it, and the codebase
   already has the machinery. Building it before anybody has met the problem risks solving the wrong
   half — the interesting question is not caching, it is what two gates do about the same ticket.

---

## 5. Two decisions that are not technical

### 5.1 Who is allowed to scan?

Scanning today requires a full org-admin token and the `event-ticketing` capability. A gate steward
is usually a volunteer for the afternoon, and creating an administrator account for them is both
friction and a standing grant of everything else an administrator can do.

| Option | Notes |
|---|---|
| A narrow **gate steward role** | Fits the existing role model; still an account per volunteer |
| A **per-event scanning link or PIN**, short-lived | No account, no cleanup, expires with the event; needs a token scoped to *scan this event and nothing else* |

The second is the better fit for how a club actually runs a day, and it is a small piece of work —
but it is a new kind of credential, and worth deciding deliberately rather than by default.

### 5.2 What does the gate see on a refusal?

Every red is a different sentence to somebody with a queue behind them:

- **Already used** — *"Admitted at 09:20 at the Main gate."* The steward needs the time and place to
  ask a sensible question.
- **Not for this event** — a ticket for last month's gate day.
- **Refunded or withdrawn** — the entry came off; there is no ticket to honour.
- **Expired** — outside its validity window.
- **Not recognised** — not one of ours at all.

This wording matters more to the day than any of the technology above.

---

## 6. Risks worth stating

- **Screenshot sharing is unsolvable with a static QR.** Rotating codes need a live screen and a
  signal, which the holder may not have either. The practical answer everywhere else is to **show the
  holder's name on the result screen** so the steward can match it to a person.
- **Camera access needs HTTPS** and, on iOS, Safari or a WKWebView; a phone in a low-signal field may
  also be in a low-battery state by mid-afternoon.
- **Clock drift** decides validity if any check happens on the device. Server time is the authority in
  A; in B, an expiry check on a device with a wrong clock is a queue nobody can explain.
- **The `scan_result` vocabulary already disagrees with itself** — the front-end type says
  `'valid' | 'invalid' | 'already_scanned' | 'expired'`, the backend only ever writes `'success'`.
  Whatever is built should settle that, because the gate's refusal reasons are exactly what belongs
  in it.

---

## 7. If you want a shape for the work

Not a commitment, just the order the pieces depend on each other:

1. `admits` on `electronic_tickets`, fed from the entry's quantity; ticket revocation on refund and
   withdrawal. **Done** — see [GATE_SCANNING.md](GATE_SCANNING.md).
2. `POST /tickets/scan` — one atomic statement, refusal reasons, history row for every presentation
   including the refused ones.
3. The scanner page: camera, result screen, beep, kept-alive camera.
4. The steward credential (§5.1).
5. Offline (B), if and when a club meets a gate that needs it.

Steps 1 and 2 are worth doing whether or not the scanner is built soon: they make the existing manual
*Mark as Scanned* correct, which today it is not.
