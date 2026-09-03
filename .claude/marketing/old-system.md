# The existing product — ItsPlainSailing 4.0

What the live PHP system at **itsplainsailing.com** does, read from the complete help guide in
[`old-system/help/`](../../old-system/help/) (11 sections, ~50,000 words, 200+ screenshots).

This is the product the new platform replaces. It is **ours**, it works, and clubs are running
seasons on it today — which is the frame for every comparison made from it.

> Read this before writing anything that positions the new system as an upgrade. Most of what
> version 4 does, it does well; the argument for moving is rarely "it cannot do that."

---

## 1. What it is, in its own words

> *"Welcome to ItsPlainSailing.com where we try to take some of the administrative hassle out of
> running your small business, club, Society, School… specifically in relation to collecting event
> entries, membership applications, merchandise orders and calendar based bookings … and their
> associated online payments."* — help/intro

The shape of the product:

- An **administrator console** for club officials, explicitly designed for a laptop. The help's very
  first tip is *"Use a PC or Laptop, Not Your Mobile Phone."*
- A **public page per club** at `itsplainsailing.com/org/<shortcode>`, which is where members go to
  enter, apply, buy and book. The club links to it from its own website, social media, a flyer or an
  email; a QR code with the address embedded is provided.
- **Stripe** for card payments, connected per club during a three-step account activation.

## 2. Functional areas

### Events

- Event with name, description, owner, notification emails, date, entries-open and entries-closing
  date/times.
- **Competitions/activities within an event** — the thing people actually enter. Each has its own
  application form, fee, payment methods, terms and conditions, applicant limit, and quantity
  option.
- **Entry limits** at both event and activity level, with an honest caveat in the help that a
  simultaneous pair of entries can exceed them.
- **Pass-code restricted events**, and a pass code on the whole public site.
- **Allow Multiple Entries In One** — enter several activities sharing a form in a single pass.
- **Entries Open To** — all, current members of this branch, or current members of the national body
  (Irish Pony Club; UK Pony Club with area-level granularity).
- **Confirm Entries To Own Branch** — emails the entrant's home club's entries secretary.
- Clone an event with its activities; preview an entry form; edit an entry in place; **download all
  entries to Excel**.
- **Event display groups** — group events visually on the public page.
- **Event calendar view**, optionally public at `/eventcalendar`, driven by per-activity scheduling
  (start time, end time, colour, note).

### Ticketing

- Switched on per event with a single **Generate Electronic Tickets** field.
- Tickets emailed automatically on booking, each carrying a **unique QR code**.
- Ticket text customisable per event and **per ticket type** (activity), with a preview.
- **Native scanning app** — "IPS Scan App" on the Apple App Store (Android referenced), no extra
  charge. A steward logs in with a two-part **event access code**, an optional **event password**,
  and their **name and location** (front gate, back gate). They scan, check the details, and tap
  *Confirm Ticket Scan*.
- **Multi-use tickets** — *Number Of Times A Ticket Can Be Used* per ticket type, and the app asks
  how many people are going through on this scan.
- **Number Of Tickets Created Per Order** per ticket type.
- Live dashboards: tickets sold over time, breakdown by type, scanned vs not scanned, scanned over
  time, **who is currently scanning**, and per-ticket scan history.

### Membership

- **Membership forms** (a specialised application form) and **membership types**.
- Per type: fee, payment methods, terms, pass code, auto-approve, **rolling** (N months from
  payment) or **fixed** (valid until a date), **age restrictions** (born before / born after),
  member labels applied automatically, and which standard fields to show (gender, date of birth,
  contact name, address, mobile).
- **Group/family membership** — one application covering up to N people, with parent/social
  distinction, configurable per-person title labels, and per-person email/phone/address if wanted.
- **Central member database** — searchable table, saved **filters** (status, gender, labels,
  last-renewed and valid-until ranges), **bulk add/remove labels**, **mark processed**, manual add.
- Nightly job moves Active members to **Elapsed** when their valid-until date passes.
- **Member display groups** for the public page.
- Membership secretary notified by email on every application.

### Calendar bookings

- **Calendars** define what is bookable: days of the week open, day start/end, minutes per timeslot,
  fee per day of week, places per timeslot, minimum places, excluded periods within a day (lunch),
  and **excluded date ranges** (Christmas), optionally recurring yearly.
- **Booking types** sit on top of a calendar: status, colour, days in advance (minimum and maximum),
  terms, **member self-cancellation** with an automatic refund and a cancellation deadline, payment
  methods, an **extra custom field**, and a **promotional discount code**.
- **Linked booking types** — booking a slot in one reserves the same slot in the others, which is how
  one facility is offered at two durations and two prices.
- Administrators can **reserve timeslots** manually; bookings are viewable as a list or a calendar
  grid, filterable by date, and downloadable to Excel.

### Merchandise

- **Merchandise types** with **sizes/options**, each with its own fee and optional **stock limit**
  that closes the option automatically at zero.
- **Delivery options**, reusable across products, in four categories: pick up, free delivery, fee per
  item, one fee for all items of this type.
- **Merchandise images**, uploaded once and attached to products.
- Orders list with drill-down and Excel download.

### Payments

- **Orders received**, with drill-down and refund — whole order or individual entries, optionally
  deleting the entry.
- **Bank transfers** — the reconciliation surface. Every Stripe payout with gross, Stripe fee/VAT,
  refunded amount, refunded fee, additional Stripe charges (Radar, 3D Secure, foreign cards) and the
  net transfer amount, each drillable to the payments, refunds and fees inside it.
- **Downloadable monthly transfer report** — an Excel workbook with a *Monthly Summary* sheet (bank
  transfer summary, rolled-up totals by source, and a **reconciliation table** showing total
  deposited vs total received) and a *Breakdown by Transaction* sheet.
- **VAT report** — a monthly Excel of VAT paid on card handling fees.
- **Cheques/offline** — a list of everything committed offline, markable as received.
- **Sent emails** — the last two weeks of confirmation emails, with a **Forward** action for the
  member who says they never got one.
- **Payment plans (instalments)** — a named plan of N payments at an interval, attachable to one
  event activity or one membership type (one plan per use, no sharing). Instalments show on the
  payments list, the entries export and the transfer report, and each one emails the event's
  notification addresses.

### Notice boards

- Named **notice boards** on the public page, each holding notices with a title, body, optional link
  and link-button text, individually hideable.
- **Automatic notices** for entries opening soon and closing soon.

### Settings

- Personal (password, email, name, contact, rows per page, update emails).
- Organisation (name, website, Facebook, contact, **events secretary email**, **membership secretary
  emails**, **shop emails**, **calendar booking emails**, site-wide pass code, public web address,
  QR code, make event calendar public).
- **Users** with roles and an active/blocked status; an email address may belong to only one
  ItsPlainSailing account.
- **Labels** for member categorisation.
- **Audit log**, typically the last 30 days.
- **Display settings** — welcome title and text, background image, logo, Facebook link, editable
  button text and descriptions for every section, an About Us section, and **additional menu links**
  (extra buttons on the public page, e.g. back to the club's own website).

### UK Pony Club (PCUK) integration

A capability-gated integration with the **Pelham** membership system: events and their activities are
registered with Pelham automatically, membership numbers are validated live against it when someone
enters a restricted activity, attendees are reported back afterwards, and badges/achievements earned
at an event can be marked off.

## 3. Commercial model, as documented in the help

- **Free unless you take card payments.** *"Most functionality within ItsPlainSailing.com is
  available for free however there is a fee to use the Online Payments service."* No setup fee, no
  ongoing fee.
- **Per-transaction handling fee**, single option ("Standard: Per Transaction").
  - **Ireland** — 85c + 1.5% + VAT at 23%, of which **60c goes to ItsPlainSailing** and the rest to
    Stripe.
  - **UK** — 75p + 1.5%, of which **55p goes to ItsPlainSailing**.
  - Non-European cards attract Stripe's full rate instead of the discounted one.
- The club chooses per item whether the handling fee is **included in** or **added on top of** the
  price.
- **No fee at all on cheque/offline payments.**
- Refunds: the original handling fee is **not** returned, so the club is out of pocket by the fee.

> These are the figures in the help guide as shipped. Before they appear in any pricing comparison
> they need confirming as current — they are the kind of number that moves without the help being
> rewritten.

## 4. Where version 4 shows its age

Stated plainly, because these are the openings the new product actually walks through. Each is from
the help itself, not inferred:

- **"Use a PC or Laptop, not your mobile phone."** Mobile admin is described as "best effort".
- **English only.** There is no sign of any second language anywhere in the help.
- **The member has no account and no history.** Everything is a one-way form on a public page; there
  is nowhere for a member to see what they entered, paid for or hold.
- **A separate native app to install** before anybody can scan a ticket, plus an access code and
  password to distribute.
- **Configuration is scattered** — the help's own "What's New" is largely about *moving* forms,
  display groups and public-page settings under the sections they belong to, which is an admission
  that they were not.
- **Inline pencil-icon editing** field by field: *"hover over the value in question with your mouse,
  click on the small pencil icon, change the value and then click on the checkbox icon to save."*
- **No self-service for the member**: cancelling a booking is the one exception, and it had to be
  enabled deliberately.
- **Limits are best-effort** — the help says twice that two simultaneous entries can exceed a limit
  and that this is "out of our control."
- **Payment plans are one-use objects** — a plan cannot be shared between two activities, so a club
  running instalments on six things maintains six plans.
