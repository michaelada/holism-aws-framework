# Ticket design — wireframes

Screens and layouts for [TICKET_DESIGN.md](TICKET_DESIGN.md).

---

## 1. Ticketing settings, with the preview beside them

**Route:** `/orgadmin/tickets/:eventId/settings`

```
┌──────────────────────────────────────┬────────────────────────────────┐
│  Ticketing — Tara Hunter Trial       │  Preview                       │
│                                      │  The ticket as it will print.  │
│  [x] Issue electronic tickets        │                                │
│                                      │  ┌────────────────────────────┐│
│  Header text                         │  │▓▓▓ darkened photograph ▓▓▓▓││
│  [ Meath Hunt Pony Club            ] │  │▓ Meath Hunt Pony Club     ▓││
│                                      │  │▓                          ▓││
│  Instructions                        │  │▓ Tara Hunter Trial        ▓││
│  [ Show this at the gate.          ] │  │▓ Cross country over the   ▓││
│                                      │  │▓ Tara banks.              ▓││
│  Footer text                         │  │▓                          ▓││
│  [ Hard hats to current standard.  ] │  │▓ Open class               ▓││
│                                      │  │▓ Open to all grades.      ▓││
│  Image (optional)                    │  │▓ 22 September 2026        ▓││
│  [ Choose image ]  banks.jpg      ✕  │  │▓  ┌──────────────────┐    ▓││
│                                      │  │▓  │ ██▄▄█ ▄█▀ ██ QR  │    ▓││
│  Use it as                           │  │▓  │ white panel      │    ▓││
│  ( ) Header  ( ) Footer              │  │▓  └──────────────────┘    ▓││
│  ( ) Top right  (•) Background       │  │▓ TKT-2026-000018          ▓││
│  Background images are darkened so   │  └────────────────────────────┘│
│  the text stays readable.            │                                │
│                                      │  Preview updates as you type.  │
│  Layout                              │                                │
│  (•) Stacked  ( ) Side by side       │                                │
│  ( ) Compact                         │                                │
│                                      │                                │
│  Ticket background colour            │                                │
│  [ #123c2b ]                         │                                │
│                                      │                                │
│  [ Cancel ]              [ Save ]    │                                │
└──────────────────────────────────────┴────────────────────────────────┘
```

**Key features:**

- **The preview is the ticket**, rendered by `renderTicketHTML` — the same function that prints — in
  an iframe, from the form's state. A preview drawn separately drifts from what prints, and the first
  thing it would get wrong is exactly what a club is checking: how a photograph darkens, whether the
  name fits.
- **Placement is disabled until there is an image**, and the background option carries its note, so
  the club is told their photograph will be darkened rather than discovering it.
- **The QR code's white panel is not configurable**, and the screen says why: a scanner reads
  dark-on-light, and a ticket that will not scan has failed completely.

---

## 2. The four image placements

```
   Header               Footer               Top right            Background
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│░░ photo ░░░░░│    │ Event name   │    │ Event name ░░│    │▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
├──────────────┤    │ Description  │    │ Descript.  ░░│    │▓ Event name ▓│
│ Event name   │    │ Activity     │    │ Activity     │    │▓ Description▓│
│ Description  │    │  ┌────────┐  │    │  ┌────────┐  │    │▓ ┌────────┐ ▓│
│  ┌────────┐  │    │  │ QR     │  │    │  │ QR     │  │    │▓ │ QR     │ ▓│
│  │ QR     │  │    │  └────────┘  │    │  └────────┘  │    │▓ │ white  │ ▓│
│  └────────┘  │    ├──────────────┤    │              │    │▓ └────────┘ ▓│
│  reference   │    │░░ photo ░░░░░│    │  reference   │    │▓ reference  ▓│
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
                                        a small square       white text on
                                        beside the title     a dark scrim
```

The QR panel is white in all four.

---

## 3. The three layouts

```
      Stacked                    Side by side                  Compact
┌──────────────────┐    ┌───────────────────────┐    ┌────────────────────────┐
│   Header text    │    │ Header text           │    │ ┌────┐ Tara Hunter     │
│                  │    │                       │    │ │ QR │ Open class      │
│  Tara Hunter     │    │ Tara Hunter   ┌──────┐│    │ │    │ 22 Sep 2026     │
│  Cross country   │    │ Cross country │  QR  ││    │ └────┘ Bríd McNamara   │
│  over the banks. │    │ over the      │      ││    │        TKT-2026-000018 │
│                  │    │ banks.        └──────┘│    └────────────────────────┘
│  Open class      │    │                       │
│  Open to all.    │    │ Open class     TKT-…  │      descriptions trimmed,
│                  │    │ Open to all.          │      several to a page
│  22 Sep 2026     │    │ 22 Sep 2026           │
│                  │    │ Bríd McNamara         │
│  ┌────────────┐  │    │                       │
│  │     QR     │  │    │ Hard hats to standard │
│  └────────────┘  │    └───────────────────────┘
│  TKT-2026-000018 │
│  Bríd McNamara   │
│                  │
│  Hard hats…      │
└──────────────────┘
```

- **Stacked** — the default, and what a printed ticket usually looks like.
- **Side by side** — the code beside the details rather than under them: easier to hold a phone up to
  at a gate while somebody reads the name.
- **Compact** — stub proportions for printing several to a page. Descriptions are trimmed here on
  purpose: at that size they would crowd out the name and the code, which are what the gate needs.

---

## 4. The dates

```
   Same day                     Different days
┌────────────────┐           ┌──────────────────────────┐
│ 22 Sep 2026    │           │ 22 Sep 2026 – 23 Sep 2026│
└────────────────┘           └──────────────────────────┘
```

One date when the event starts and ends on the same day, two when it does not — never "22 Sep 2026 –
22 Sep 2026", which reads as a two-day event whose second day is missing.
