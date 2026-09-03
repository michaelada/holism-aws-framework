# The ticket buttons that did nothing

## The report

> I was looking at a specific ticket in the org-admin Ticket area for an event. When I clicked the
> Download PDF button nothing happened. Also when I clicked "Mark as Scanned" it did not work.
>
> Also on the Event Ticketing page where the ticket entries are listed, can you make the name a link
> so the user can drill in to see the ticket details without having to scroll to the right to click
> the eye icon (leave the eye icon there).

## One fault, three buttons

Both reported buttons called **endpoints that do not exist**, and neither said so:

| Button | Called | Exists? |
|---|---|---|
| Mark as Scanned | `POST /tickets/:id/mark-scanned` | **No** — the route is `PUT /tickets/:id/scan-status` |
| Mark as Not Scanned | `POST /tickets/:id/mark-not-scanned` | **No** — same route, `scanStatus: 'not_scanned'` |
| Download PDF | `GET /tickets/:id/download-pdf` | **No**, and never has |

The silence is the second half of the fault. `useApi.execute` answers `null` on an error rather than
throwing, so the 404 arrived looking exactly like success: the dialog called `onUpdate()`, closed
itself, and left the ticket as it was. Somebody admitting a guest at a gate watched the dialog shut
and nothing change. The PDF handler went further and logged `"PDF download initiated"` to a console
nobody was reading.

Two more of the same kind turned up beside them, both now fixed or removed:

- **Resend Email** posted to `/tickets/:id/resend-email` — no such route — and then announced
  *"Ticket email resent successfully"* whatever came back. A club that believed it had re-sent a
  member's ticket had not. The button is **gone**: one that cannot work is worse than its absence,
  and building a resend is separate work.
- **The batch dialog** posted to `/tickets/batch-operation`, which is not a route either, so every
  batch failed with a message it could not explain.

## What each now does

**Marking a ticket** uses `PUT /tickets/:id/scan-status` with `throwOnError`, so a refusal reaches
the dialog and is shown there instead of closing over it. It records a scan location — a ticket
marked from the office says so — and only calls `onUpdate()` and closes once the server has agreed.

**Printing** builds the ticket in the browser from `generateTicketPDFHTML`, the same template the
rest of the product renders a ticket with, and prints it through a hidden iframe. The browser's print
dialog is what turns it into a PDF; a server-rendered file would mean carrying a PDF engine in the
backend for one button. Because that is what it does, the button now says **Print / Save as PDF**
rather than Download PDF, and is disabled until the QR code has been generated — printing a ticket
nobody can scan looks like a working button and is worse than one briefly greyed out.

An iframe rather than a popup, deliberately: a blocked popup is a button that does nothing, which is
the fault being fixed.

**The batch actions** loop the same working endpoint, one request per ticket, and report *which*
ticket failed. A loop rather than a new endpoint: a batch is a screenful, each is a single-row
update, and the result panel was already shaped to name failures. The progress bar now follows the
work instead of climbing to 90% on a timer.

## The name opens the ticket

The table has nine columns, so on anything but a wide screen the only way in — an eye icon in the
last one — was six columns of sideways scrolling away. The name is what a reader is looking at when
they decide to open a ticket, so the name opens it. **The eye icon stays**: it is where the *Actions*
heading says it is, and somebody who has learned it should not have to learn again.

## One thing left as it is

`electronic_tickets.ticket_data` is written as `{}` and the ticket rows come back unjoined, so a
ticket does not know its own event or activity. The Activity column shows *Not available* for every
row because of it. The **event name** is now passed into the dialog by the page that knows it, so a
printed ticket is headed properly; the activity is still unfilled, and filling it means joining the
rows in `ticketing.service` — worth doing, and not part of this.

## Tests

`TicketDetailsDialog.actions.test.tsx` — marking calls `PUT …/scan-status` with the right status,
records where, asks for the failure (`throwOnError`), refreshes and closes only on success, and
**shows the server's refusal instead of closing**; printing writes the shared template into a frame
and prints it without asking the server for anything, and waits for the QR code first.

`ticketing.test.tsx` — no Resend Email button; the print button is labelled for what it does; the
batch dialog calls `PUT …/scan-status` per ticket and reports which one failed.

`EventTicketingDetailPage.test.tsx` — the name opens the ticket, the eye icon is still there, and
every row has its own way in.
