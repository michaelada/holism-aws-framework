# Signed tokens in the ticket QR

> *"For the ticket QR codes can you update the solution to have signed tokens in the QR instead of
> an opaque id."*

This is **option C** from [TICKET_SCANNING_OPTIONS.md](TICKET_SCANNING_OPTIONS.md), built on top of
the gate scanning in [GATE_SCANNING.md](GATE_SCANNING.md).

---

## 1. What changed, in one line

A ticket's QR used to carry `123e4567-e89b-12d3-a456-426614174000` — the row's own identifier and
nothing else. It now carries a 72-character token containing that identifier, **the event** and
**the expiry**, with an HMAC over all three.

## 2. What signing buys, and what it does not

**It answers "did we issue this?"** and it answers it without asking the database. Before, every
code that reached a gate had to be looked up before anything at all could be said about it, and the
answer to a forgery and to somebody else's ticket was the same word: *not recognised*.

**It does not answer "has this been used?"** Nothing self-contained can — use is a fact about the
world after the code was minted. That is still settled by the atomic `UPDATE` in
`gate-scan.service`, and offline by the manifest the scanner downloads. The options document said
as much when it recommended against C as a standalone, and that has not changed: **signing is a
second lock on the door, not a replacement for the first.**

What a gate can now decide before it looks anything up:

| | Before | Now |
|---|---|---|
| A QR off a poster, a parcel, a WiFi sticker | Looked up, *not recognised* | **Refused on sight** |
| A tampered or invented code | Looked up, *not recognised* | **Refused as a forgery**, and logged as one |
| A ticket for last month's gate day | Looked up, *wrong event* | **Refused on sight**, offline included |
| An expired ticket | Looked up, *expired* | Readable from the token; still checked against the row |

The third line is the one that pays for the feature offline. A manifest holds one event's tickets,
so a ticket for a different event is simply **absent** from it — indistinguishable from a forgery.
The token tells them apart, and *"not for this event"* is a much better thing to say to somebody at
the front of a queue than *"not one of ours"*.

## 3. Why HMAC and not Ed25519

The usual reason to reach for a public-key signature is that the verifier can check it without
holding a secret — which matters when the verifier is untrusted, as a steward's phone certainly is.

**It does not apply here.** The scanner downloads the event's **manifest** when it unlocks, so
offline it recognises our codes without any cryptography at all; online, the server verifies. Nothing
except the server ever needs the key.

So the key never leaves the server, and the token is an HMAC-SHA256 truncated to 128 bits. That is
not just simpler — it is **half the size**. An Ed25519 signature is 64 bytes on its own; the whole
token here is 54. Size is not cosmetic on a QR read in a field, in the rain, on a cracked camera:
72 characters puts the code at about QR version 6, and a 64-byte signature would push it past
version 8 with correspondingly smaller modules.

The scanner still **parses** the token — it reads the claims — it just cannot verify them. That is
the right split: it uses the claims for the two things it could not otherwise answer, and trusts the
manifest and the server for everything that matters.

## 4. The format

```
base64url( payload ‖ tag )

payload = version(1) ‖ keyId(1) ‖ ticketUuid(16) ‖ eventUuid(16) ‖ expiry(4)
tag     = HMAC-SHA256(payload, key)[0..16]
```

54 bytes, 72 characters. The two UUIDs are **raw bytes** rather than their 36-character text form,
which is where nearly all of the saving is. The expiry is Unix **seconds** — four bytes reach 2106
at that resolution and only 1970 at millisecond resolution, and a ticket's expiry is a day boundary
anyway.

`version` is the first byte so that a future format is a parse decision rather than a guess, and
`keyId` is the second so that rotation does not need the key to be tried in turn.

`packages/backend/src/services/ticket-token.service.ts` is the only place any of this is written or
read.

## 5. Old tickets keep working

**No ticket is reissued and none needs to be.** The options document listed "every ticket already
issued must be reissued" as a cost of option C; it is avoidable, and avoiding it is most of the care
in this change.

- `electronic_tickets.qr_code` is unchanged: still the identifier, still unique, still what every
  lookup and the gate's `UPDATE` match on.
- A new column, `qr_token`, holds the **printed** code. It is **nullable and deliberately not
  backfilled**: a ticket issued before this has a bare UUID in an email nobody can recall, so the
  app must draw that same code or the screen and the paper would scan differently. Everything
  renders `qr_token ?? qr_code`.
- `parseTicketCode` accepts a bare UUID and calls it `legacy`. Those codes are no less safe than
  they were yesterday — a v4 UUID is 122 random bits and was never guessable. What they lack is the
  claims, so a legacy code has to be looked up to learn anything at all, exactly as before.

## 6. Configuring the key

```
TICKET_SIGNING_KEYS=2:<base64 of ≥32 bytes>,1:<the previous one>
```

Pairs of `id:secret`, comma separated, **most recent first**. The first signs; **all** of them
verify, which is what makes a key rotatable without invalidating tickets in people's inboxes. Retire
an old key only once every ticket it signed has expired.

```bash
openssl rand -base64 32
```

**Unset is a supported state**, not a failure: tickets are issued carrying the plain identifier,
exactly as they were before signing existed, and a warning is logged once at startup. That is what
makes this deployable without a coordinated config change, and what keeps every test suite and every
developer's machine working. A secret shorter than 32 bytes is **refused rather than used** — a
short HMAC key is the kind of mistake that looks like it is working.

## 7. What it touches

| | |
|---|---|
| Sign, parse, verify | `backend/src/services/ticket-token.service.ts` |
| Migration | `1709000000045_signed-ticket-codes.js` — `electronic_tickets.qr_token` |
| Issue | `ticketing.service.issueTicketForEntry` signs **after** the insert, because the token contains the identifier the database generated |
| The gate | `gate-scan.service.scan` reads the presented code before anything is looked up |
| Lookup by QR | `ticketing.service.getTicketByQRCode` resolves a token or a legacy code to the identifier |
| The member's ticket | `account-ticketing.service` sends `qr_token ?? qr_code` as `qrCode` |
| The club's copy | `TicketDetailsDialog` draws `qrToken ?? qrCode` |
| The scanner | `account-shell/src/scan/gateScan.ts` — `readScannedCode` parses; it does not verify |
| QR rendering | `components/utils/ticketGeneration.ts` — wider by default, see §8 |
| Seed | Demo tickets are signed the same way, so the scanner is exercised against the real path |

### The new refusal

`forged` joins `not_found`, `wrong_event`, `already_used`, `expired`, `cancelled` and `withdrawn`.
It means *we did not mint this*, and it is deliberately **distinct from `not_found`**, which means
*a well-formed code for a ticket we do not hold*. A steward sees the same red screen for both; the
club reading the history afterwards should not, because one is a forgery or a mangled read and the
other is somebody's real ticket for the wrong day.

Nothing is written to `ticket_scan_history` for a forgery — there is no ticket to write it against.
It appears in the session's refusals and in the server log.

## 8. The QR got denser, so it got bigger

72 characters instead of 36 takes the code from about QR version 3 to version 6: more modules in the
same square, and therefore smaller ones for a camera to resolve. Two answers, both defaults rather
than call-site decisions, because every ticket in the product is read in the same conditions:

- **`generateQRCodeDataURL` draws at 360px** rather than 300, so a module stays roughly the physical
  size it was.
- **Error correction stays at `M`** (15%). Raising it to `Q` or `H` to "be safe" is the tempting
  change and it would add another version and shrink the modules again. A ticket is read off a
  screen or clean paper, not off a crate in a warehouse.

The member's own ticket draws at **320px** rather than 260 — it is the one QR in the product read
off a *screen*, at whatever brightness the holder's phone happens to be on.

## 9. What this does not do

- **It does not stop a screenshot being forwarded.** A signed static code is still a static code.
  The answer remains the holder's name on the result screen, as [TICKET_SCANNING_OPTIONS.md](TICKET_SCANNING_OPTIONS.md)
  §6 said. Rotating codes need a live screen and a signal that the holder may not have.
- **It does not let a scanner admit a ticket that is not in its manifest.** A signed token for a
  ticket sold after the manifest was downloaded is still refused offline — nothing on the device
  knows what it admits or whether it has been used. The scan queues, and the server decides.
- **It does not verify on the device.** By design; §3.
- **It does not change how a ticket is looked up.** `qr_code` is still the key.
