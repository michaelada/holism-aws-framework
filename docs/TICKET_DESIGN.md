# Designing the ticket

What a club can put on an electronic ticket, and how it is laid out.

---

## 1. Requirements

### 1.1 The ask

> When setting up a ticketed event, let me associate an image with the ticket, with the option to show
> it as a header, footer, top right, or background with a shadow, as with the Announcement. In doing
> so, make sure the QR code is clear — a white background for it regardless. The ticket layout should
> include the Event Name, the Activity Name, the Event Date (as one date if start and end are the
> same, or two dates if they differ). It should also include the event description under the event
> name, and the activity description under the activity name, as that may carry information about the
> event or ticket. Lay it out nicely, maybe with layout options the user can choose from, and a
> preview.

### 1.2 Functional requirements

| # | Requirement |
|---|---|
| R1 | A ticketed event may carry **one image**, uploaded in its ticketing settings |
| R2 | Four placements: **header**, **footer**, **top right**, **background** — the background darkened by a scrim, as an announcement's is |
| R3 | The **QR code is always on white**, whatever the image, scrim or background colour does around it |
| R4 | The ticket shows the **event name**, the **event description** beneath it, the **activity name** and the **activity description** beneath that |
| R5 | The **event date** is one date when it starts and ends on the same day, and two when it does not |
| R6 | Three **layouts** to choose from, so a club can pick what suits its ticket |
| R7 | The settings screen shows a **live preview** of the ticket as it will print |
| R8 | Existing tickets keep working — every new field is optional, and a club that sets none gets the ticket it has today |

### 1.3 Out of scope

- **No per-activity ticket design.** One design per event; an event's classes share it.
- **No PDF engine.** The ticket is HTML, printed by the browser — see
  [TICKET_ACTIONS_THAT_DID_NOTHING.md](TICKET_ACTIONS_THAT_DID_NOTHING.md).
- **No colour picker beyond the background** the config already has.

---

## 2. Design

### 2.1 The ticket has to know what it is for

`electronic_tickets.ticket_data` is written as `{}` and the ticket rows are returned unjoined, so a
ticket knows neither its event's name nor its activity's — which is why the org-admin's Activity
column reads *Not available* for every row. Everything in R4 and R5 is on other tables.

**Joined on read, not copied on write.** `ticketingService.getTicketForRendering` returns the ticket
with its event (name, description, start and end), its activity (name, description) and the event's
ticketing configuration. Copying it into `ticket_data` at issue time would leave every ticket already
issued blank, and would freeze a description the club later corrects.

### 2.2 The image

The same shape as an announcement's, for the same reasons: `ticket_image_key` and
`ticket_image_mime` on `event_ticketing_config` — the **S3 key**, not a URL — uploaded as a separate
step once the config exists, and delivered as a **signed URL** at read time.

`ticket_image_placement` is `header | footer | topRight | background`, constrained, and null where
there is no image. **Background is darkened by the card**, not by the club: a scrim over the image
and light text above it, so legibility does not depend on the photograph.

### 2.3 The QR code is always on white

A scanner reads dark-on-light. A code drawn over a photograph, or over a club's chosen background
colour, is a code that sometimes does not scan — and a ticket that fails at the gate has failed
completely. So the code sits in its own **white panel with white padding**, in every layout and under
every placement. It is the one part of the ticket a club cannot restyle, and the reason is worth
saying out loud on the settings screen.

### 2.4 The three layouts

| Layout | Shape | For |
|---|---|---|
| `stacked` | Everything centred in a column, QR beneath the details | The default, and what a printed ticket usually looks like |
| `sideBySide` | Details on the left, QR panel on the right | A wide ticket, and the easiest to scan from a phone held up beside the details |
| `compact` | Stub proportions, QR left, text right, descriptions trimmed | Printing several to a page, or a gate that only needs the name and the code |

### 2.5 The date

One date when `startDate` and `endDate` are the same day, two when they differ. Formatted by the
shared date helpers, in the reader's locale.

---

## 3. Task breakdown

| # | Task |
|---|---|
| T1 | Migration: `ticket_image_key`, `ticket_image_mime`, `ticket_image_placement`, `ticket_layout` on `event_ticketing_config`, with checks |
| T2 | `getTicketForRendering` — the ticket joined to its event, activity and config, with a signed image URL |
| T3 | Image upload and removal endpoints for a ticketing config |
| T4 | `renderTicketHTML` in `packages/components`: the four placements, three layouts, the white QR panel, the one-or-two dates |
| T5 | Ticketing settings: image, placement, layout, and a **live preview** rendered by the same function |
| T6 | The org-admin ticket dialog prints through the same renderer with the real data |
| T7 | Tests, i18n in six locales, wireframes |

Wireframes: [TICKET_DESIGN_WIREFRAMES.md](TICKET_DESIGN_WIREFRAMES.md).

---

## 4. Two faults found on first use

> I am selecting an image for the ticket, but when I do it does not appear on the preview, plus the
> preview is all darkened so it is hard to make out how it will look to people.

**The chosen image was dropped.** `safeUrl` allowed `http`, `https` and `data:` images — and a
picture chosen but not yet uploaded is a **`blob:`** URL. It failed the allow-list, so the URL went,
and with it the placement (a placement with no image is no placement), and the preview looked exactly
as though nothing had been chosen. `blob:` is now allowed — it can only reference content the page
itself created — and the settings screen sends a **data URL** read with `FileReader` rather than a
blob, because the preview is an iframe and the print target is another frame: carrying the bytes is
surer than carrying a reference that belongs to one document.

**The dark ticket had dark text.** Text colour keyed off the image *placement* — light only when a
background photograph was behind it. The seeded clubs' ticket colour is `#123c2b`, a deep green, so
their tickets rendered near-black on dark green and could not be read. What decides legibility is the
background actually behind the words, however it got there: `isDark()` weighs the colour by Rec. 709
luminance and the whole ticket follows it. The dimmed lines — descriptions, labels, the footer — were
also dimmed with `opacity`, which on a dark ticket faded near-black text into the background; they
now take an explicit colour on the same rule.

Covered by `ticketRender.test.ts` — light text on a dark colour, dark text on a light one, light over
a photograph as before, the quieter lines readable too, `isDark` weighing green as the eye does, and
a `blob:`/`data:` picture appearing — and by `EditTicketingSettingsPage.test.tsx`, where a chosen
image reaches the preview and the placement becomes choosable with it.

---

## 5. "Include Event Logo" is gone

> I don't think I need the "Include Event Logo" option now that I have ticket image functionality.

It never did anything. The column, the DTOs and **two** checkboxes existed — one on the event form's
ticketing step, one on the ticketing settings — and no ticket template ever drew a logo: the one that
could have took a `logoURL` nothing passed. A club that ticked it saw a ticket identical to the one
it had before, which is the same class of defect as the buttons in
[TICKET_ACTIONS_THAT_DID_NOTHING.md](TICKET_ACTIONS_THAT_DID_NOTHING.md).

The ticket image, with its four placements, is what it was reaching for. Two ways to put a picture on
a ticket — one of which does nothing — is worse than one, so the setting is removed rather than
wired up:

| Where | What went |
|---|---|
| `event_ticketing_config` | `include_event_logo`, dropped in `1709000000043` |
| `ticketing.service` / `event.service` | the field on `EventTicketingConfig`, both DTOs, the insert, the update branch and the event-level pass-through |
| `account-ticketing.service` | the flag on the member's ticket payload, and the column from its query |
| Ticketing settings | the checkbox |
| Event form (`EventTicketingSection`) and Event details | the checkbox and the *Include Event Logo: Yes/No* line |
| Six locales | `fields`, `helpers` and `tooltips` entries |
| Seed | `includeLogo` on the fixture and in the writer |

The `down` migration restores the column, defaulted off. The booleans are not restored, and losing
them costs nothing: nothing ever read them.

---

## 6. The picture wins, and the ticket is shown

> If I have selected an image as a background for the ticket it seems to get mixed with the "Ticket
> Background Color" and is not shown, so if a user selects an image as the background then this should
> override the background colour.
>
> Also, when I drill into a specific ticket sold to someone, can the actual ticket as it is shown /
> emailed to the user be shown, with the other information underneath — Scan Status, Scan Date, Scan
> Count, Scan History. Or maybe separate tabs, your call.

### A background picture replaces the colour

Both were applied: the colour painted the card and the picture was laid over it, so a club that had
chosen a deep green and then a photograph got the two fighting — the colour showing wherever the
picture did not reach, and the picture itself lost under a scrim heavy enough to make white text
work over that green. **Choosing a picture is choosing what the background is**, so the colour is now
dropped entirely when the placement is `background`, and the picture is painted on near-black — a
ticket whose image has not arrived is dark, which is what the white text on it expects, rather than a
white card with white writing.

The scrim came down with it, from 0.55–0.78 to 0.30–0.62: enough to read white text through, light
enough that a club can see the photograph it chose. And the colour field on the settings screen says
*"A background image replaces this colour"* while that placement is chosen, so nobody has to work out
where their green went.

The colour is untouched for the other three placements: a header, footer or corner picture sits *on*
the ticket, and the colour is still the ticket's own background.

### Tabs, and the ticket first

**Tabs — my call, and the reason.** The ticket is a tall thing (a photograph, a code, two
descriptions) and the scan history is a table that grows with every gate. Stacked, the scan details
a club opens this dialog to check would sit below a screen and a half of ticket.

- **The ticket** leads, rendered by `renderTicketHTML` in an iframe — *exactly* what the holder sees,
  from the club's own design, not a summary of the database row. The same HTML the printer is handed,
  so the two cannot differ.
- **Scanning** carries what was there before: the QR code, the ticket and customer information, scan
  status, date, count and the full history.

**Whose ticket it is moved into the header** — `Bríd McNamara · TKT-2026-000018`, under the title. It
is the one line that has to stay true wherever the reader is in the dialog: with the details behind
tabs, an administrator who switches to the history would otherwise lose sight of which of forty
tickets they are looking at.

Covered by `ticketRender.test.ts` (the colour dropped under a background picture, the near-black base,
the colour kept for the other placements, the scrim light enough to see through) and by
`TicketDetailsDialog.actions.test.tsx` (the design read on open, the ticket shown as the holder sees
it, the printer handed the very thing on screen, the scan details a tab away, and the holder's name
visible on both tabs).
