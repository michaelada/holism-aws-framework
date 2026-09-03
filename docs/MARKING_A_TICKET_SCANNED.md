# Marking a ticket scanned in the org-admin

> *"When a ticket is scanned by the administrator in the Orgadmin … the Scanned by column shows '-'.
> It should show the name of the logged in user that marked the ticket as scanned."*
>
> *"For each activity it should be possible to configure how many scans are allowed on the ticket
> before it is considered used, this field should default to 1."*

Two reports, one cause: the club's own **Mark as scanned** never grew up alongside the gate.
[GATE_SCANNING.md](GATE_SCANNING.md) rebuilt the gate around an atomic admission that records who
made it; this screen kept the original 2023 implementation, which recorded nobody and counted
against nothing.

---

## 1. The second one already existed — under the wrong name

**How many scans a ticket allows is `event_activities.tickets_admit`**, added with gate scanning:
per activity, minimum 1, defaulting to 1, and copied onto each ticket at issue as
`electronic_tickets.admits` so that changing it later cannot change what an already-sold ticket is
worth.

Two reasons it did not look like it existed:

- **It was labelled in people, not scans** — *"People admitted per ticket"*. That is the same
  number seen from the other end, but somebody looking for a scan limit would not recognise it.
  The label is now **"Scans allowed per ticket"**, and the helper says both: *"How many times one of
  this activity's tickets can be scanned before it is used up — which is how many people it lets
  through the gate."*
- **The org-admin ignored it.** The gate enforced the ceiling; this screen did not, so a limit set
  to 4 could be exceeded from the ticket dialog without complaint. That is §2.

No migration, no new column, no second setting. A second field meaning the same thing is how two
answers to one question get into a product.

## 2. What was actually wrong

`updateTicketScanStatus` was the original implementation and did three things badly.

### 2.1 It recorded nobody

```sql
INSERT INTO ticket_scan_history (ticket_id, scan_location, scanned_by, scan_result, notes)
```

`scanned_by` is a **foreign key to `organization_users`** and the value came from
`req.body.scannedBy` — which the dialog never sent. So the column was null on every row, and
`scanned_by_name` (added for the gate, which is what the column actually renders) was never written
at all. Hence the dash.

Now the administrator comes from the **verified request**, not the body:
`byResource('ticket', 'ticketId')` has already established that the caller administers this
ticket's organisation and set their `organization_users.id` while doing it. The service resolves
their name and writes **both** — the id for the foreign key, the name for the trail, because
`scanned_by` points at a row that can be deleted and the history has to outlive it.

This is the rule a refund's `requestedBy` follows, and for the same reason: it is the accountability
record for an act, so it cannot be something the client chooses.

### 2.2 It counted against nothing

```sql
SET scan_count = scan_count + 1
```

No ceiling. A one-use ticket could be marked scanned indefinitely and the count simply climbed.

It is now the same statement the gate uses, and **whether a row comes back is whether there was
room**:

```sql
UPDATE electronic_tickets
   SET scan_count = scan_count + 1, scan_status = 'scanned', scan_date = NOW(), …
 WHERE id = $1 AND scan_count < admits
 RETURNING *
```

No row means no room, and the administrator is told which — *"This ticket admits 4 and all 4 have
been used"* — as a **409**, not a 500. The refusal is written to `ticket_scan_history` with
`refusal_reason = 'already_used'`, because a ticket turned away at a desk is as much a fact about it
as one let through.

### 2.3 Undoing did not give the place back

Marking a ticket *not scanned* relabelled it and left the count alone. On a one-use ticket nobody
noticed. On a ticket that admits four, correcting a mistake cost a place permanently.

It now decrements, floored at zero, and `scan_status` follows the **count** rather than the button:
a ticket that admits four and has been used twice is `scanned`, and only returns to `not_scanned`
when the last of them is undone.

## 3. The dialog could not admit the second person

The two buttons were keyed on `scanStatus`. The moment the first of four was admitted the ticket
read `scanned`, so the only control left was *undo* — the other three could not be let in from this
screen at all.

They are now keyed on the facts they act on: **admitting** is offered while there is room,
**undoing** while anything has been used. For a one-use ticket exactly one of those holds at a time,
so the common case is unchanged.

The scan count reads **"2 of 4"** where a ticket admits more than one, and stays a bare number where
it admits one — *"1 of 1"* is noise on an ordinary ticket, and a bare *"2"* is a mystery on a family
one.

A refusal now shows the **server's own words**. `useApi.execute` with `throwOnError` rejects with an
axios error whose `message` is *"Request failed with status code 409"*; the sentence worth reading is
in `response.data.error.message`.

## 4. What it touches

| | |
|---|---|
| The admission, the ceiling, who did it | `ticketing.service.updateTicketScanStatus` |
| The administrator, from the request | `ticketing.routes` — `PUT /tickets/:ticketId/scan-status` |
| Both buttons, the count, the refusal | `orgadmin-ticketing` → `TicketDetailsDialog` |
| The label | `events.activities.activity.ticketsAdmit` / `…Helper`, six locales |
| New key | `ticketing.details.scanCountOf` — *"{{used}} of {{admits}}"*, six locales |

## 5. What is still true afterwards

- **The gate is unchanged.** It already did all of this; this screen was brought up to it.
- **`scan_status` is still two values.** The count is what carries partial use; a third status would
  be a second answer to a question the count already answers.
- **Batch operations get the ceiling for free.** `BatchTicketOperationsDialog` loops the same
  endpoint per ticket and reports which one failed, so a batch over used-up tickets now names them
  rather than silently inflating counts.
- **The older `scan_result` vocabulary still disagrees with itself** — see
  [GATE_SCANNING.md](GATE_SCANNING.md). This path now writes `refused` with a `refusal_reason`, as
  the gate does, so the two agree with each other even though the front-end type still declares a
  third set of values.
