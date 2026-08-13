# Phase 12 — the app works without a connection

The strongest case is a member standing at a gate with a ticket and no signal. Everything needed for
that was already in place — `TicketPage` renders its QR **on the device** from the stored payload
rather than fetching an image — except the two things that make it reachable: the application has to
boot offline, and the ticket has to already be on the device.

Design: **H1–H3** in [ACCOUNT_USER_APP_WIREFRAMES.md](ACCOUNT_USER_APP_WIREFRAMES.md), plus the
capability table beneath them.

## What was built

| Piece | Where |
|---|---|
| App shell precached, so a cold start works offline | `vite.config.ts` — `vite-plugin-pwa`, Workbox `generateSW` |
| Installable, with a manifest scoped to `/account/` | same |
| Last server answer kept per member, per URL | `src/offline/responseCache.ts` |
| Reads fall back to it; writes are refused | `src/hooks/useAccountApi.ts` |
| H1 — the offline banner | `src/components/OfflineBanner.tsx` |
| "Some of this was saved at…" | `src/offline/StaleDataContext.tsx`, `src/components/StaleDataNotice.tsx` |
| H3 — the install prompt | `src/components/InstallPrompt.tsx` |
| Actions that need the server, refused before they are attempted | `BookCalendarPage`, `CartPage`, `ShopItemPage`, `RegistrationFormPage`, `EntryFormPage` |

## The decisions

**One choke point, not twelve screens.** Every request in this app already went through
`useAccountApi`, so offline behaviour lives there: a member with no signal gets the same explanation
whichever screen they are on, and a page added next year inherits it without knowing anything about
caching. Editing each page would have been a dozen chances to be inconsistent.

**A read falls back; a write is refused.** `OfflineError` carries `code: 'OFFLINE'`, so a screen says
"you are offline" rather than "something went wrong" (H2). Attempting the write first would surface
an axios network message that says nothing a member can act on.

**Nothing is queued for later.** An entry made offline and replayed an hour afterwards could take a
place that had already gone — having told the member it succeeded. The design says the same; it is
worth restating because background sync is the obvious feature to reach for and it is wrong here.

**A refusal is never papered over with cache.** The fallback fires only when the request reached
nobody (`status === 0`). A 403 is the server's considered answer: serving yesterday's data over
`PENDING_APPROVAL` would show a member screens they are no longer entitled to.

**`navigator.onLine` explains, it does not decide.** A `false` is reliable; a `true` means only that
an interface exists, which a captive-portal wifi reports while nothing can reach the server. So reads
always try, and always fall back on failure — gating them on `onLine` would strand exactly the member
on the flaky connection who most needs the app to keep trying. The banner is a courtesy.

**Every cached answer carries when it was fetched**, and the screen says so. `servedFrom.fetchedAt`
comes back with the data, and the request layer also publishes it to `StaleDataContext`, which the
shell renders as a caption beneath the offline banner. Stale data presented as current is worse than
no data — a member reading a three-hour-old entry list as live turns up to an event that filled.

Tracked centrally for the same reason offline is: a page added later is honest about its data without
doing anything, and a screen making four requests would otherwise have to decide which of them to
believe. **Any cached answer marks the screen** and the **oldest wins**, because that is the weakest
thing the screen is standing on. It **clears on navigation** — the claim is about the page in front of
the member, and carrying it forward would leave a fresh screen wearing a stale label.

The time is shown rather than "3 hours ago": a member deciding whether to trust a list compares it
against when they think something changed, and a relative age has to be converted back first. The
date appears only when the data is not from today.

### H2, in place rather than after the fact

The design draws H2 as a screen shown when an offline action is attempted. What is built refuses
*before* the attempt: the control is disabled and says why. Both satisfy the rule; this one is
better, because a dialog explaining that something has just failed is a worse experience than a
button that was never offered — and on one screen the difference is substantive.

**The calendar is that screen.** The capability table says availability may be shown offline but
"never allow selection". A member picking a slot from a grid that is hours old, filling in the form
and being refused at the basket has been invited and then rejected; the slots are therefore not
selectable at all, and the caption names *staleness* rather than only the connection —
"Availability may be out of date. You need a connection to book."

**Checkout is stopped at the basket**, not at the payment step: it takes a member through a provider
and a webhook, and beginning that with no connection wastes their time at the worst moment.

The three add-to-basket flows — shop, registration, entry — refuse for the same reason: the server
re-checks stock, options and availability when the line is added, so there is nothing useful the
browser could do alone.

Everything read-only stays readable throughout. The basket still lists what is in it, the item page
still prices the shirt, the week still shows its slots. That is the point of the cache.

### The privacy rule

Cached data is keyed by **identity and URL**, and sign-out clears **everything for everybody** rather
than only the departing member. A club device passed between people must not show the previous one's
payment history, and that is a privacy failure rather than a caching bug. It is also why the service
worker precaches the **app shell only** and no API responses: a second copy in Workbox's cache would
outlive the clearing that `useAccountApi` does.

`localStorage`, not the IndexedDB the design named. What is stored is a few dozen small JSON
documents, well inside the 5MB budget, and synchronous reads mean a cached screen paints on the first
render rather than flashing empty. IndexedDB buys volume and transactions this does not need — revisit
if cached form definitions or images ever land here.

### The install prompt

Third visit or later, never on a first load, and never twice. A member who has just arrived does not
yet know whether they want this club on their home screen, and an install prompt is the fastest way
to make a first visit feel like an advertisement. The event is captured and held rather than shown —
the browser only allows its own prompt from a gesture — and a decision either way is remembered.

## Tests

54: 11 on the cache (including that one member's data cannot be recalled by another, and that
sign-out clears every entry rather than every other one), 9 on the request layer, 8 on the banner,
8 on the stale-data notice, 9 on the install prompt, and 9 across the screens that refuse an action
offline.

## What this does not do yet

- **The icon artwork is a placeholder.** The *set* is now complete and correctly declared —
  `icon-192.png`, `icon-512.png`, a separate `icon-maskable-512.png` whose mark sits inside the
  central 80% a platform mask guarantees, `apple-touch-icon.png` for iOS (which ignores the
  manifest), and `favicon.png` — but the mark itself is a plain placeholder awaiting a designed
  ItsPlainSailing one. An installed icon cannot be branded per club at runtime the way the app's
  theme is, so this is one mark for every club.

  The PNGs are generated from the SVGs and committed; regenerate them if the artwork changes.
