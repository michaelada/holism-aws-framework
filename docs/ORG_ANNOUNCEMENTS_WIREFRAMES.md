# Org Announcements — Wireframes

Screens for the feature specified in [ORG_ANNOUNCEMENTS.md](ORG_ANNOUNCEMENTS.md). Org-admin screens
first, then what a member sees.

---

## 1. Announcements list

**Route:** `/orgadmin/announcements` · **Capability:** `org-announcements`

```
┌───────────────────────────────────────────────────────────────────────┐
│  Announcements                                  [ + New announcement ]│
│  Notices your members see when they sign in.                          │
├───────────────────────────────────────────────────────────────────────┤
│  Title                    Showing            Image        Actions     │
│  ───────────────────────────────────────────────────────────────────  │
│  Clubhouse closed Sat     [Showing now]      Background   [✎]  [🗑]   │
│                           1 Sep – 6 Sep                               │
│  Summer camp is open      [Showing now]      Header       [✎]  [🗑]   │
│                           28 Aug – 30 Sep                             │
│  AGM: 14 October          [Scheduled]        —            [✎]  [🗑]   │
│                           1 Oct – 15 Oct                              │
│  Winter league results    [Finished]         Footer       [✎]  [🗑]   │
│                           2 Feb – 1 Mar                               │
└───────────────────────────────────────────────────────────────────────┘
```

**Key features:**

- **Three states, from the window alone** — *Showing now*, *Scheduled*, *Finished*. There is no
  draft or published flag: the dates are the control, so a club can never have an announcement that
  is "published" and invisible, or dated and forgotten.
- **The window is written under the state**, because "showing now" begs the question *until when*.
- **Sorted by start date, newest first**, the same order members see.
- An empty list says *No announcements yet. Members see nothing on their home page until you write
  one.* — an empty table with headings looks like a screen that failed to load.

---

## 2. Writing one — editor and live preview

**Route:** `/orgadmin/announcements/new`, `/orgadmin/announcements/:id/edit`

```
┌─────────────────────────────────────┬─────────────────────────────────┐
│  New announcement                   │  Preview                        │
│                                     │  What a member will see.        │
│  Title *                            │                                 │
│  [ Clubhouse closed Saturday      ] │  ┌─────────────────────────────┐│
│                                     │  │▓▓▓▓ darkened photo ▓▓▓▓▓▓▓▓▓││
│  Description                        │  │▓                          ▓▓││
│  ┌─────────────────────────────────┐│  │▓ Clubhouse closed Saturday▓▓││
│  │ B  I  U  •  1.  🔗             ││  │▓                          ▓▓││
│  │                                 ││  │▓ The clubhouse is closed  ▓▓││
│  │ The clubhouse is closed all day ││  │▓ all day for the floor to ▓▓││
│  │ for the floor to be replaced.   ││  │▓ be replaced.             ▓▓││
│  └─────────────────────────────────┘│  │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓││
│                                     │  └─────────────────────────────┘│
│  Shows from *          Shows until *│                                 │
│  [ 01/09/2026 09:00 ]  [ 06/09 18:00]│  Preview updates as you type.  │
│                                     │                                 │
│  Image (optional)                   │                                 │
│  [ Choose image ]  clubhouse.jpg  ✕ │                                 │
│                                     │                                 │
│  Link text            Link address  │                                 │
│  [ Book a place ]  [ https://…    ] │      [ Book a place ]           │
│  Optional — the words on the button │                                 │
│                                     │                                 │
│  Use it as                          │                                 │
│  ( ) Header   ( ) Footer   (•) Backg│                                 │
│  Background images are darkened so  │                                 │
│  the text stays readable.           │                                 │
│                                     │                                 │
│  [ Cancel ]              [ Save ]   │                                 │
└─────────────────────────────────────┴─────────────────────────────────┘
```

**Key features:**

- **The preview is the member's card**, not a drawing of it — the same `AnnouncementCard` the account
  app renders, from `packages/components`. A preview built separately drifts, and the first thing it
  gets wrong is the one thing the preview exists to check.
- **It updates as you type**, from the form's state rather than from what is saved, so an
  administrator can see a title's length before committing to it.
- **The image is uploaded when it is chosen**, against the saved announcement; on a new announcement
  the record is created first. The preview shows the local file immediately, before the upload
  finishes, so choosing an image feels like choosing an image.
- **Placement is disabled until there is an image**, and the background option carries the note about
  darkening — the club is told what will happen to their photograph rather than discovering it.
- **Shows until must be after shows from.** Refused on save with *Shows until must be after shows
  from*, and the second field carries the error.
- **The link is optional and is one link**, the way a platform post's links are — words and an
  address, shown as a button under the notice. Both halves or neither: with one filled in, Save is
  held and the field says so. `http`/`https` only, checked here and refused again by the server.
- On a narrow screen the preview moves **below** the form rather than beside it.

---

## 3. The three placements

What `AnnouncementCard` renders, in a member's right-hand column:

```
  Background                Header                    Footer
┌────────────────┐      ┌────────────────┐      ┌────────────────┐
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│      │░░░ photo ░░░░░░│      │ Summer camp    │
│▓ Clubhouse   ▓▓│      ├────────────────┤      │                │
│▓ closed Sat  ▓▓│      │ Summer camp    │      │ Places are open│
│▓             ▓▓│      │                │      │ from Monday.   │
│▓ The floor is▓▓│      │ Places are open│      ├────────────────┤
│▓ being done. ▓▓│      │ from Monday.   │      │░░░ photo ░░░░░░│
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│      └────────────────┘      └────────────────┘
│ white text over│       text below the          text above it
│ a dark scrim   │       picture
└────────────────┘
```

- **Background** — the image fills the card, a top-to-bottom scrim darkens it, and the text is white
  with a soft shadow. The scrim is applied by the card, not asked of the club.
- **Header** — the image sits above the text, edge to edge, at a fixed aspect so a portrait
  photograph cannot push the words off the bottom of a member's screen.
- **Footer** — the same, below the text.
- **No image** — an ordinary card. Placement is ignored rather than defaulted, so removing an image
  cannot leave a card claiming to have a background.
- **The link, where there is one**, is a small outlined button under the words — white over a
  background photograph, where the default outline would vanish into the picture. It opens in a new
  tab: a member reading their home page is usually in the middle of something else.

---

## 4. Member's home page — with announcements

**Route:** `/account/:orgCode` (B3) · Wide screens, `md` and up

```
┌────────────────────────────────────────────────┬──────────────────────┐
│  Welcome back, Áine                            │  Notices             │
│  Kildare Hunt Pony Club                        │  ──────────────────  │
│                                                │  ┌────────────────┐  │
│  ┌──────────────────────────────────────────┐  │  │▓ Clubhouse   ▓ │  │
│  │  Your basket · 2 items · €50.00          │  │  │▓ closed Sat  ▓ │  │
│  └──────────────────────────────────────────┘  │  │▓ The floor is▓ │  │
│                                                │  │▓ being done. ▓ │  │
│  Your memberships                              │  └────────────────┘  │
│  ┌────────────────┐  ┌────────────────┐        │  ┌────────────────┐  │
│  │ Full Member    │  │ Junior Member  │        │  │ ░ photo ░░░░░  │  │
│  └────────────────┘  └────────────────┘        │  │ Summer camp    │  │
│                                                │  │ Places open    │  │
│  Coming up                                     │  │ from Monday.   │  │
│  ┌────────────────┐  ┌────────────────┐        │  └────────────────┘  │
│  │ Spring League  │  │ Camp booking   │        │                      │
│  └────────────────┘  └────────────────┘        │                      │
│                                                │                      │
│  What's on · Shop · Book                       │                      │
│                    (8 of 12 columns)           │   (4 of 12)          │
└────────────────────────────────────────────────┴──────────────────────┘
```

**Key features:**

- **Two thirds and one third**, as asked: `md={8}` and `md={4}`.
- **The column is headed *Notices***, so a member knows what they are looking at. Without a heading a
  photograph in a sidebar reads as decoration, or as an advertisement.
- **Nothing about the existing page changes** except its width — and the teaser rows, which went
  from four cards across to **three**: four in two thirds of a page squashes an event's name into
  three lines. One `TEASER_COLUMNS` for all six rows (events, external events, memberships,
  bookings, registrations, shop), so they cannot drift apart.
- **The column scrolls with the page.** It is not sticky: a member scrolling to their entries has
  finished with the notices, and a panel that follows them down is an advertisement.

---

## 5. Member's home page — no announcements

```
┌───────────────────────────────────────────────────────────────────────┐
│  Welcome back, Áine                                                   │
│  Kildare Hunt Pony Club                                               │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  Your basket · 2 items · €50.00                                 │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  Your memberships                                                     │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐           │
│  └────────────────┘  └────────────────┘  └────────────────┘           │
│                          (full width, exactly as today)               │
└───────────────────────────────────────────────────────────────────────┘
```

The page is **not** wrapped in a grid that happens to be full width — it is the page as it is today.
A club without the capability, a club with no announcement showing, and a club whose announcements
have all finished are the same case and look the same.

---

## 6. Narrow screens

```
┌──────────────────┐
│ Welcome back,    │
│ Áine             │
│ Kildare Hunt PC  │
├──────────────────┤
│ Notices          │  ← announcements first
│ ┌──────────────┐ │
│ │▓ Clubhouse ▓ │ │
│ │▓ closed Sat▓ │ │
│ └──────────────┘ │
│ ┌──────────────┐ │
│ │ Summer camp  │ │
│ └──────────────┘ │
├──────────────────┤
│ Your basket      │
│ Your memberships │
│ Coming up        │
│ …                │
└──────────────────┘
```

Announcements come **first** on anything narrower than `md`, above the basket and the memberships —
the club is telling its members something, and on a phone the alternative is a notice nobody scrolls
to. The greeting stays at the top, because a page that opens on a notice with no context reads as an
advertisement rather than as your club's home page.
