# Messaging — audiences, claims and the words to use

How to talk about the new product. Derived from `PRODUCT.md`, `DESIGN.md`,
[new-system.md](new-system.md) and [what-changed.md](what-changed.md).

---

## 1. Who is being sold to

### The buyer and the daily operator are the same person

A **volunteer or part-time club administrator**. Not technical. Doing this alongside another job, in
short bursts in the evening. They evaluate the product, buy it, configure it and then live in it
every day, and their success is what the product is measured by.

This single fact should shape most of the copy: they are not procuring a system, they are trying to
get Saturday's entries closed before bed.

### The people around them

| | Who | What they care about |
|---|---|---|
| **The committee** | Approves the spend, sees it twice a year | Cost, risk, "does it make the treasurer's job easier" |
| **The treasurer** | Reconciles the bank account monthly | Lodgements, refunds, VAT, the export that goes to the accountant. **See the gaps** — this is where they are |
| **The member** | Enters, joins, pays, holds a ticket | That it works on their phone, at the gate, in a field |
| **The steward on the gate** | One afternoon a season | That they were handed a link and it worked |

### Who this is for, and who it is not

Clubs and membership organisations **of any kind** — the codebase's examples are equestrian because
that is where the first customers were, not because the product is equestrian. Sports clubs,
societies, schools, associations, small businesses running bookings.

## 2. The four positioning claims

From `PRODUCT.md`, which describes them as confirmed and as things a neighbouring product could not
truthfully copy *in combination*:

1. **One system, not five.** Entries, memberships, shop, bookings, ticketing and payments in a single
   organisation record with a shared payment, discount and form subsystem — not separate products
   bridged by exports.
2. **Runs without an IT person.** The club builds its own forms, enables its own capabilities, sets
   its own discounts, connects its own payment provider. No implementation project, no developer.
3. **Each club's own branded app.** Per-club colour and URL short code give the member a club-branded
   PWA, not a vendor portal with a logo in the corner.
4. **Multi-country from day one.** Six locales; currency fixed per organisation type; handling fees
   configured per type and per method in that type's currency.

**Use these as the spine.** Everything else is evidence for one of the four.

## 3. The proof points worth reaching for

Ordered by how well they survive a sceptical question. Each is checkable in the product.

| Claim | The specific thing that proves it |
|---|---|
| It works where clubs actually work | A ticket's QR renders **at the gate with no signal**; the scanner queues and reconciles |
| Nobody has to install anything | The steward opens a **link**, types a PIN and their name |
| It cannot double-admit | The admission is **one atomic database statement**; two gates, one winner |
| It is honest about what it knows | A cached screen says *"Some of this was saved at 09:14"*; an offline action is **disabled with a reason** rather than failing |
| The club is the brand | Per-club colour and logo, `/account/<club>`, the club's own name on the bookings menu |
| It is genuinely multilingual | Six locales, every string a key, a **test that fails the build** on a missing one |
| A club only sees what it bought | Capabilities gate the route, the module, the page and the menu **together** — no greyed-out teasers |
| The money reconciles | Lodgements read **live from Stripe** and broken into the payments inside them; four refund scopes; offline settlement that runs the deferred fulfilment |
| Nothing is quietly destroyed | Withdrawing a membership type keeps last season's members naming what they held |
| It teaches itself | Guided first run with per-user state stored **server-side**, so it follows the person to their next device |

## 4. What may not be said

### Never invent

`PRODUCT.md` is explicit: **no pricing, no plan structure, no customer names, no testimonials, no
adoption figures, no case studies** exist in this repository. Do not write any. Use `[[NEEDS: …]]`
and list it in the deliverable's own gap section.

### Never claim from the gap list

Everything in [what-changed.md](what-changed.md) §3 is off-limits until it is built. Two deserve
naming individually because they are the ones most likely to be assumed:

- **PCUK / Pelham integration does not exist here.** A seeded capability name is not a feature.
- **A refund is a record, not a reversal.** Nothing calls Stripe to send money back.

### Never say it in these words

| Do not say | Because |
|---|---|
| "Set sail", "on course", "all aboard", "plain sailing ahead", anchors, ropes, compasses, portholes, navy-and-rope palettes | **The name means "it's easy", not "sailing."** The product is for clubs of any kind, and nautical framing tells a tennis club it is not for them. The stylised sail mark is the *one* exception |
| "Join the club" for creating an account | An account is not a membership. Blurring them makes a visitor think they must pay to enter an open event |
| "Holism", "Application Framework" | Internal repository names, never user-facing |
| Anything implying a neumorphic or teal-and-grey theme, or a choice of themes | One theme, settled, removed in August 2026 |
| "Fully accessible", "WCAG AA compliant" | No standard has been agreed and nothing has been audited. WCAG AA is the **working floor**, and saying more is a claim we cannot support |
| Anything dating the end of version 4 | Nothing in the repository says when. A club that fears a sunset shops around |

## 5. Tone and visual world

From `DESIGN.md` and `PRODUCT.md`:

- **Effortless is the promise, and the name is the contract.** If a screen makes an unpaid volunteer
  feel they need training, it has failed however it looks. Copy should sound like that too: plain,
  short, and about their Saturday rather than our architecture.
- **Sentence case everywhere.** Nothing is uppercased by transform — not buttons, not headings.
- **The warm world.** Warm paper grounds, hairline rules, one orange that decorates
  (`orange-flare` #FF9800) and one that speaks (`orange-signal` #D24400). No zebra striping, no
  vertical rules, no outer borders on tables.
- **The mark** is a small warm-palette stylised sail, 56×64, approved 13 August 2026. It is the same
  asset everywhere and is settled, not a placeholder.

## 6. Objection handling, honestly

| "…" | The answer |
|---|---|
| *"We already have ItsPlainSailing."* | Then most of what you do carries over. What changes is that your members get an account and an app, your gate needs no app installed, and it is in six languages. What to check first is [what-changed.md](what-changed.md) §3 — if you run instalments or need the VAT report, today is not your day to move |
| *"Our members won't create accounts."* | They create one once, and it buys them their entry history, their tickets on their phone, their receipts, and no re-typing their details every season. The public pages — your What's On, your events — need no account at all |
| *"We're not a sailing club."* | Neither are most of our clubs. The name means it's easy |
| *"Who else uses it?"* | **We have no case studies written down.** Say so and offer to find out — do not invent one |
| *"What does it cost?"* | **Not recorded anywhere in this repository.** Version 4's model was free unless you take card payments, then a per-transaction handling fee. Do not extrapolate that to the new product without confirming |
| *"Is it accessible?"* | Every string goes through six languages and contrast is computed against the club's own chosen colour. No formal audit has been done, and we should not claim one |

## 7. A quick vocabulary check

Terms that must stay consistent (from `PRODUCT.md`):

| Term | Means |
|---|---|
| **Organisation type** | Groups organisations; fixes currency, locale, default capabilities and fee rates |
| **Organisation** | A club or association; almost every record is scoped to one |
| **Capability** | A per-organisation feature switch gating backend, module, route and menu |
| **Account** | Being able to sign in to a club's app. **Not** a membership |
| **Membership** | The paid, club-approved thing the memberships module sells |
| **Entry** | A member's place in an event |
| **Registration** | An expression of interest ahead of a membership or programme |
| **Connecting to a club** | Linking an existing account to an organisation — **not** buying a membership |
