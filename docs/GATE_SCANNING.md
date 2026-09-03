# Scanning tickets at the gate

Built from [TICKET_SCANNING_OPTIONS.md](TICKET_SCANNING_OPTIONS.md) — **option B**, the offline-
tolerant browser scanner, with the three gaps that document names closed as part of it.

---

## 1. Requirements

### 1.1 The ask

> Implement B. Allow the number admitted to be configured per event activity, defaulting to 1. Use a
> short-lived link with a PIN, where the person gives their name, so more than one person can scan
> tickets and the org-admin can see who scanned a ticket.

### 1.2 Functional requirements

| # | Requirement |
|---|---|
| R1 | An activity says **how many people one of its tickets admits**, defaulting to **1** |
| R2 | A ticket cannot be used more than it admits — enforced by the **server**, atomically, so two gates cannot both win |
| R3 | A club creates a **short-lived scanning link** for an event, protected by a **PIN** |
| R4 | A steward opens the link, **gives their name** and the PIN, and is scanning within seconds — no account, no install |
| R5 | **Several people** can scan the same event at once, each identified by their own name |
| R6 | The org-admin can see **who scanned each ticket**, and who is scanning now |
| R7 | Scanning **keeps working without a signal**, and reconciles when one returns |
| R8 | A refunded or withdrawn entry's ticket **does not admit anybody** |

### 1.3 Out of scope

- **No native app.** The browser's camera, on the phone the steward already has.
- **No rotating codes.** A forwarded screenshot is answered by showing the holder's name to the
  steward, not by cryptography — see §6.
- **No hardware scanners.**

---

## 2. Design

### 2.1 How many a ticket admits

`event_activities.tickets_admit`, **default 1**, is the club's setting: a day ticket admits one, a
family ticket four, a car pass a carful. The number is **copied onto the ticket** at issue
(`electronic_tickets.admits`) rather than read live through a join, because it is what the holder was
sold: a club that changes the activity in March must not change what a ticket bought in February
lets somebody through with.

### 2.2 What the QR carries

**A signed token, since [SIGNED_TICKET_CODES.md](SIGNED_TICKET_CODES.md).** The identifier below is
still what everything is keyed by; the *printed* code now wraps it together with the event and the
expiry under an HMAC, so a gate can refuse a forgery and a ticket for another event before it looks
anything up. Tickets issued before that change carry a bare UUID and are still accepted.

It changes nothing about the decision that follows.

### 2.3 The gate's decision is one statement

```sql
UPDATE electronic_tickets
   SET scan_count = scan_count + 1, scan_status = 'scanned', scan_date = $2, scan_location = $3
 WHERE qr_code = $1
   AND event_id = $4
   AND status = 'issued'
   AND scan_count < admits
   AND valid_until > $2
 RETURNING id, customer_name, scan_count, admits
```

**Whether a row comes back *is* the admission.** Two stewards on two gates scanning the same code at
the same moment are serialised by the row lock, and exactly one wins. The old flow — look up, then
increment with no ceiling — let both through and counted twice.

No row means refused, and the reason is a second, cheap query: already used (and when, and where),
wrong event, cancelled, expired, withdrawn, or not one of ours — plus `forged`, which the token
answers without a query at all. Every presentation is written to
`ticket_scan_history`, **including the refusals**, because a duplicate at a gate is exactly the
event a club wants to look at afterwards.

### 2.4 A link, a PIN, and a name

A steward is a volunteer for the afternoon. Giving them an administrator account is both friction and
a standing grant of everything an administrator can do, so scanning has its own credential:

1. The club creates a **scanning session** for one event, choosing how long it lasts. That produces a
   link carrying an opaque token and a **six-digit PIN, shown once**.
2. The steward opens the link and gives their **name** and the PIN.
3. The server creates a **device** row for that steward and answers with an opaque scanner token.
   Every scan from that phone carries it, and every scan records **who** made it.

Why a device row rather than a signed token: the club asked to see who is scanning, and a row is the
answer to that question. It is also revocable — a phone left in a field can be cut off without
changing anybody else's afternoon.

The PIN is stored as **scrypt** with a per-session salt, and unlock attempts are limited per session:
six digits is a small space, and the link is shared in a WhatsApp group.

The scanner endpoints are their own surface, `/api/scan/*`, authenticated by the scanner token alone.
They can reach **one event's tickets** and nothing else — not the club's members, not its payments,
not another event.

### 2.5 Working without a signal

These are fields. On unlock, the scanner downloads that event's **manifest** — one row per ticket:
code, holder, activity, how many it admits, how many scans it has already had. A few hundred rows,
tens of kilobytes.

- **Online**, a scan posts immediately and the server's answer is the one shown.
- **Offline**, the scan is decided against the manifest, shown, and **queued**. The queue drains when
  a signal returns, and the server applies the same rule to each queued scan.
- **The reconciliation is visible.** A queued scan the server then refuses — because another gate
  admitted that ticket first — is surfaced afterwards rather than silently dropped.

The honest limit, from the options document: **offline, two devices cannot prevent the same ticket
being used twice.** They can only detect it on sync. One device per gate is how a gate usually works;
where it is not, the history now names both stewards and the club can act on it.

### 2.6 Where the scanner lives

In **`account-shell`**, at `/scan/:token`. Three reasons: it is a PWA with a service worker and an
offline cache already (which is the substance of §2.5); its Keycloak client uses `check-sso`, so an
anonymous route is not bounced to a login page; and it is already the app with an unbranded anonymous
route (`/confirm-email`) for exactly this kind of link.

The org-admin's side of it — create a session, see who is scanning, revoke — lives with the rest of
ticketing in `orgadmin-ticketing`.

---

## 3. Task breakdown

| # | Task | |
|---|---|---|
| T1 | Migration: `event_activities.tickets_admit`, `electronic_tickets.admits`, `ticket_scan_sessions`, `ticket_scan_devices`, and the new columns on `ticket_scan_history` | done |
| T2 | Sessions — create, unlock (PIN, name, device), list, revoke | done |
| T3 | The manifest, and the atomic decision with its refusal reasons | done |
| T4 | Routes: org-admin session management, and the `/api/scan/*` surface | done |
| T5 | Issue tickets carrying `admits`; the activity form's "people admitted per ticket" | done |
| T6 | The scanner: camera, result screen, offline queue, sync (`account-shell`) | done |
| T7 | The club's view: the link and PIN, who is scanning, who scanned each ticket | done |
| T8 | Tests, six locales, wireframes | done |

T2 and T3 landed in one service rather than two: unlocking and admitting share the session, and
splitting them would have meant a service that could say who may scan and another that could not
check it.

Wireframes: [GATE_SCANNING_WIREFRAMES.md](GATE_SCANNING_WIREFRAMES.md).

---

## 4. Where it lives

| | |
|---|---|
| Migration | `packages/backend/migrations/1709000000044_gate-scanning.js` |
| Sessions, devices, manifest, the admission | `packages/backend/src/services/gate-scan.service.ts` |
| The gate's surface — `POST /api/scan/:token/unlock`, `GET /api/scan/manifest`, `POST /api/scan/scans` | `packages/backend/src/routes/gate-scan.routes.ts` |
| The club's surface — `POST`/`GET /api/orgadmin/events/:eventId/scan-sessions`, `DELETE /api/orgadmin/scan-sessions/:id` | `packages/backend/src/routes/scan-session.routes.ts` |
| `admits` copied onto a ticket at issue | `ticketing.service.issueTicketForEntry` |
| "People admitted per ticket" | `orgadmin-events` → `EventActivityForm` |
| The scanner | `account-shell` → `/scan/:token`, `pages/GateScanPage.tsx` and `scan/gateScan.ts` |
| The club's panel | `orgadmin-ticketing` → `components/GateScanningPanel.tsx`, on the event ticketing page |
| Audit | `ticket-scanning.session-created`, `ticket-scanning.session-revoked` |

### 4.1 Two things a reader should not have to discover

**The scanner is unauthenticated in the Keycloak sense, and that is the design.** `/api/scan/*` is
mounted outside every `authenticateToken()` guard. What makes it safe is the narrowness of what the
device token reaches: one event's manifest, and the right to admit somebody against it. It is
checked on *every* request rather than at unlock alone, so revoking a session stops a phone that is
already scanning.

**The camera needs a QR reader, which the repository did not have.** `qrcode` generates codes;
nothing read one. `html5-qrcode` is a dependency of `account-shell` only, and is the sole new
package this feature adds.

### 4.2 The limits, stated plainly

- **Offline, two phones cannot prevent the same ticket being used twice.** They detect it on sync,
  and the scanner shows what the server refused rather than dropping it. One device per gate is how
  a gate usually works; where it is not, the history now names both stewards.
- **A screenshot of a QR still scans.** The answer is the holder's name on the result screen, not
  cryptography — see [TICKET_SCANNING_OPTIONS.md](TICKET_SCANNING_OPTIONS.md) §6.
- **The `scan_result` vocabulary is still two vocabularies.** The gate writes `success` / `refused`
  with a separate `refusal_reason`; the older front-end type says `valid | invalid |
  already_scanned | expired`. The new column is the one to read.
