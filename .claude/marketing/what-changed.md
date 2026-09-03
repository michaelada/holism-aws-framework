# Version 4 → the new platform

The comparison, in three parts: **what is genuinely better**, **what is the same in a different
shape**, and **what version 4 does that the new system does not do yet**.

Part 3 is the one to read first. It is where a deal is lost.

---

## 1. Where the new system is straightforwardly better

Ordered by how much a club would feel it, not by how hard it was to build.

| | Version 4 | Now |
|---|---|---|
| **The member** | Fills a form on a public page. No account, no history, nothing to come back to | Signs in to the club's own app: entries, memberships, tickets, orders, bookings, payments and receipts, all self-service |
| **On a phone** | *"Use a PC or laptop, not your mobile phone."* Mobile admin is "best effort" | The member app is a **PWA**, phone-first, installable, **readable offline**, and it says how stale what it shows is |
| **Gate scanning** | Install the IPS Scan App, distribute a two-part access code and a password | Open a link, type a PIN and your name, scan. **No app.** Works with no signal, queues, reconciles, and every scan carries the steward's name |
| **Two gates, one ticket** | Two devices can both admit; the app detects it afterwards | The admission is one atomic statement — online, exactly one wins. Offline it is detected on sync and **shown**, not dropped |
| **Family tickets** | *Number of times a ticket can be used*, counted by the steward on the phone | `tickets_admit` per activity, **copied onto the ticket at issue**, enforced by the database |
| **Languages** | English | **Six**, with a test that fails the build on a missing key |
| **Refunds** | Whole order, or an individual entry | **Four scopes** — full, less the handling fee, chosen items, or an amount — with partial refunds tracked as their own state and their own list |
| **Money coming in** | A payments list and a bank-transfers list | The same, plus **lodgements read live from Stripe** and broken down into the payments inside them, and an **offline settlement queue** that runs the deferred fulfilment when the cheque arrives |
| **Audit** | A log of changes, about 30 days | A structured trail with categories, labels in six languages, the record each event was about, and a link through to it |
| **Configuring a club** | Settings scattered across sections; version 4's own release notes are mostly about moving them | Capability-gated modules; a club sees only what it has |
| **Forms** | Drag fields into Mandatory/Optional | The same, plus **field groups** and **multi-step wizards**, with the datatype enforced on both sides |
| **Discounts** | A promotional code on a booking type; nothing elsewhere | One discount subsystem across events, memberships, merchandise, bookings and registrations, with usage statistics |
| **Public events** | A public page, and an optional public event calendar | Public event pages at **indexable addresses** with `schema.org/Event`, Open Graph and a canonical URL, plus a **cross-club directory** and a platform-wide events listing |
| **Reports** | Entry and order downloads, transfer and VAT reports | Dashboard plus events, members and revenue reports, each exporting a **server-built workbook**; entry exports carry a column for every question on the form |
| **Lists** | Paged tables with a search box | The same, plus **saved filters shared across the club**, bulk operations, and every column sortable by clicking its heading |

## 2. Same idea, different shape — say it carefully

These are not upgrades or losses. They are **changes a club will notice on day one**, and each needs
a sentence in the migration material rather than a bullet in the brochure.

### 2.1 Entering now requires an account

Version 4: anyone with the link fills in a form and pays. No account, ever.

New: entering, buying or booking requires an **account with the club**. Public pages (the directory,
*What's On*, an event's own page) are open to anyone, but the act of entering is not.

**Why it is better:** it is what gives the member a history, a basket, self-service and a ticket on
their phone — and the club a member record rather than a row in a spreadsheet.

**Why it needs saying out loud:** a club running a gate day for the general public is asking
strangers to register. Note the terminology rule — *"create an account"* is **not** *"join the
club"*, and the copy must never blur them, because a visitor who thinks they must buy a membership
to enter an open event does not enter.

### 2.2 The club's public page is now the club's app

Version 4's customisable welcome page — background image, logo, editable button text and
descriptions, extra menu links, About Us — is replaced by a **branded application**: primary colour
and logo, per-club URL, and a home screen composed of the things the member actually has.

**What is gained:** it is theirs, it is installable, it works offline, and it does not have to be
re-styled every season.

**What is lost:** the free-text, per-section editorial control. A club that wrote its own button
labels and section descriptions has fewer knobs. The one exception preserved deliberately is the
**Bookings menu name**, because "Bookings" is what the software does and "the courts" is what the
members call it.

### 2.3 Notice boards became announcements

Version 4: named notice boards on the public page, plus automatic notices for entries opening and
closing soon.

New: **announcements** on the member's home screen — title, description, image with three
placements, an optional link, and a **scheduling window** rather than a publish flag. The automatic
"entries closing soon" notices have no direct equivalent; the member's home screen leads with what is
open to them instead.

### 2.4 Display groups have no equivalent

Version 4 grouped events and membership types visually on the public page. The new catalogues are
their own screens with their own filtering, so nothing groups by a club-defined heading. If a club
asks, this is a **gap**, not a redesign — see §3.

## 3. What version 4 does that the new system does not do yet

**Read this before promising anything.** Each has been checked against the code, not assumed.

| Version 4 feature | Status here | Why it matters commercially |
|---|---|---|
| **Payment plans / instalments** | **Not built.** No `payment_plan` anywhere | A club selling a €180 summer camp in three instalments cannot do that here. This is the single biggest functional gap and it belongs in the qualifying questions, not the objection handling |
| **VAT report** | **Not built** | Irish clubs reclaim VAT on handling fees. A monthly VAT workbook is a finance-officer requirement, not a nice-to-have |
| **Monthly transfer / reconciliation report** | **Partly.** Lodgements are richer than version 4's on screen — live from Stripe, itemised — but there is **no downloadable monthly workbook** with the reconciliation table | The treasurer's month-end job. Ask how they do it today before demoing lodgements |
| **Sent-emails archive with Forward** | **Not built** | *"I never got my confirmation"* is a weekly support call for every club. Version 4 answers it in two clicks |
| **Pass codes** — on an event, a membership type, or the whole public site | **Not built** | Used for invitation-only events and closed membership rounds |
| **PCUK / Pelham integration** | **Capability seeded, nothing built.** `pcuk-integration` exists in the capability list; no code references Pelham | **Do not sell this.** Any UK Pony Club branch on version 4 is depending on live membership validation, event registration and attendee reporting. They cannot migrate |
| **Irish Pony Club membership validation** | **Not built** in that form. The nearest is `org-type-members` — an active membership of any club of the same organisation type — which is federation-shaped but does not call an external register | Same conversation as PCUK, one step less severe |
| **Event and member display groups** | **Not built** | §2.4 |
| **Public event calendar view** | **Not built.** Version 4 has an admin calendar view of events, optionally public at `/eventcalendar` | The bookings module has a calendar grid; events do not |
| **"Allow multiple entries in one"** — enter several activities sharing a form in one pass | **Not built.** Each entry is its own pass, though the basket holds several | Affects clubs whose events have many classes on one form |
| **"Confirm entries to own branch"** — email the entrant's home club's secretary | **Not built** | Inter-club events in a federation |
| **Linked booking types** — booking one slot reserves the same slot in another type | **Not built** | The pattern for offering one facility at two durations and two prices |
| **Ticket resend by email** | **Removed deliberately.** The button existed and announced success while calling an endpoint that never existed; it was taken out rather than left lying | Easy to rebuild, currently absent |
| **Age restrictions on a membership type** (born before / born after) | **Not built** | Junior and senior membership tiers enforce themselves in version 4 |
| **Automatic elapse of memberships overnight** | **Unverified.** `elapsed` is a status the code knows; no scheduled job was found that moves members into it | Check before claiming renewal chasing works by itself |
| **Refunds actually reversing the charge** | **Not built.** A refund here is a **record**; nothing calls Stripe to reverse | A club will assume the money went back. This one is a support incident waiting to happen, not just a gap |

### How to use this table

- **Qualify on it.** Instalments, VAT reporting, PCUK and pass codes each disqualify a club from
  migrating today. Better found in the first call than the first month.
- **Do not put it on a slide.** It is internal. What goes to a prospect is the answer to the
  question they asked.
- **Keep it current.** When one of these is built, move it to §1 with a note; when a new gap appears,
  add it. A closed gap left in this table costs a sale as surely as an open one left out.

## 4. The migration story

The stated plan: **keep version 4 running, put new organisations on the new system, and migrate
existing clubs over time.**

What that implies for the launch and everything written for it:

- **Two audiences, two documents.** A prospect who has never used ItsPlainSailing does not care what
  version 4 did. An existing club cares about almost nothing else.
- **New clubs first** means the flagship material is a *product* story, not an *upgrade* story. The
  upgrade story is a second wave and needs §3 resolved for the club in question.
- **Nothing may imply version 4 is ending**, or being withdrawn on a date. Nothing in this repository
  says when, and a club that panics about a sunset is a club shopping around.
- **The gaps in §3 are the migration schedule in disguise.** The order they are closed in is the
  order existing clubs become migratable.
