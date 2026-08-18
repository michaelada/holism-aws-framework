# `packages/account-shell` — the Account User application

The member-facing front end: the app a club's members sign into to see their entries, memberships
and bookings. Served under `/account`, dev server **5176**.

Distinct from `orgadmin-shell` (the club *administrator's* app) and `admin` (the platform
super-admin's). It is the only front end with **public, unauthenticated screens**.

Full implementation record: [docs/ACCOUNT_USER_APP_PHASE6_SHELL.md](../../docs/ACCOUNT_USER_APP_PHASE6_SHELL.md).
Design and all 51 wireframes: [docs/ACCOUNT_USER_APP_WIREFRAMES.md](../../docs/ACCOUNT_USER_APP_WIREFRAMES.md).

---

## Structure

| Path | Purpose |
|---|---|
| `src/App.tsx` | Routes. `/`, `/switch`, `/:orgCode`, `/:orgCode/register`, `/:orgCode/pending`, `/:orgCode/entries`, `/:orgCode/entries/:entryId`, `/:orgCode/memberships`, `/:orgCode/tickets`, `/:orgCode/tickets/:ticketId`, `/:orgCode/profile`, `/:orgCode/browse/events`, `/:orgCode/browse/memberships`, `/:orgCode/browse/events/:itemId/enter`, `/:orgCode/browse/memberships/:itemId/apply`, `/:orgCode/shop`, `/:orgCode/shop/:itemId`, `/:orgCode/orders`, `/:orgCode/book`, `/:orgCode/book/:calendarId`, `/:orgCode/register-interest`, `/:orgCode/register-interest/:typeId`, `/:orgCode/registrations`, `/:orgCode/payments`, `/confirm-email` (unbranded, anonymous) |
| `src/hooks/useAuth.ts` | Keycloak, **`check-sso`** not `login-required` |
| Keycloak client | **`account-app`**, created by hand — see docs/ACCOUNT_APP_KEYCLOAK_SETUP.md. Served under base path **`/account`**, so both `…/account` and `…/account/*` must be registered as redirect URIs or logout breaks |
| `src/context/AuthContext.tsx` | Holds the single `useAuth` instance |
| `src/hooks/useAccountApi.ts` | The only way this app calls the backend; `AccountApiError` carries the refusal code, and offline behaviour lives here |
| `src/offline/responseCache.ts` | Last server answer per member and URL, cleared on sign-out |
| `src/offline/StaleDataContext.tsx` | Whether anything on this screen came from cache, and how old |
| `src/hooks/useOnlineStatus.ts` | `navigator.onLine` plus its events — explains, never decides |
| `src/context/AccountOrganisationContext.tsx` | `:orgCode` → state, capabilities, branding |
| `src/components/OrganisationRoute.tsx` | Maps that state to a screen |
| `src/components/AppShell.tsx` | B1/B2 responsive shell |
| `src/components/navigation.ts` | Nav model + `visibleSections()` capability gate |
| `src/pages/` | A1, A2, A4, A6, A7, A8, B3, C1, C2, C4, C6, C8, C9, C10, D7–D13, F1, F2, P1, P6 |
| `src/theme/index.ts` | `buildTheme(primaryColor)` — per-club branding |
| `src/i18n/config.ts` | Six locales, `localeForLanguage()` |
| `src/test/` | `setup.ts` (matchMedia), `renderWithProviders.tsx` |

## Backend endpoints it uses

Only these — everything else is a later phase.

```
GET  /api/public/organisations?q=        A1 directory        (anonymous)
GET  /api/public/organisations/:code     A2 + branding       (anonymous)
GET  /api/account/organisations          A7 switcher
GET  /api/account/:orgCode/me            resolves the shell
GET  /api/account/:orgCode/dashboard     B3 — the whole home screen in one call
POST /api/account/:orgCode/register      A4
GET  /api/account/:orgCode/entries       C1
GET  /api/account/:orgCode/entries/:id   C2
GET  /api/account/:orgCode/bookings      C1, bookings tab
GET  /api/account/:orgCode/memberships   C4
GET  /api/account/:orgCode/tickets        C9   (capability: event-ticketing)
GET  /api/account/:orgCode/tickets/:id    C10  (capability: event-ticketing)
GET  /api/account/:orgCode/profile        P1
PUT  /api/account/:orgCode/profile        P1   (name, phone, language only)
POST /api/account/:orgCode/profile/password   P4   (current password required)
POST /api/account/:orgCode/profile/email      P5   (asks for a link; changes nothing yet)
POST /api/public/email-change/confirm         P6   (anonymous — the link is the authority)
GET  /api/account/:orgCode/catalogue/merchandise  D9, D10 (capability: merchandise)
GET  /api/account/:orgCode/orders         C8   (capability: merchandise)
GET  /api/account/:orgCode/catalogue/calendars                        D11 (capability: calendar-bookings)
GET  /api/account/:orgCode/catalogue/calendars/:id/availability?from=&to=  D12, D13
GET  /api/account/:orgCode/catalogue/registration-types  D7, D8 (capability: registrations)
GET  /api/account/:orgCode/registrations  C6   (capability: registrations)
GET  /api/account/:orgCode/payments       F1, F2  (no capability — receipts belong to the member)
POST /api/account/:orgCode/bookings/:id/cancel   C1 bookings tab (capability: calendar-bookings)
```

---

## Questions this answers without opening code

**Why doesn't it force login like orgadmin-shell?** Because A1 and A2 are public. `login-required`
would bounce every anonymous visitor to Keycloak and make a club's short link unusable for anyone
not already signed in. `check-sso` adopts an existing session silently and leaves everyone else
anonymous; signing in is an explicit act from A2.

**Where does the branded theme come from?** `GET /api/public/organisations/:code`, not `/me` — `/me`
carries no branding. The context fetches the public record for every organisation regardless of
session, so one request serves both the theme and the A2 screen (§1.7: adapt to the backend that
exists rather than extend it). `publicLoading` is separate from `state` because `state` settles to
`anonymous` immediately for a signed-out visitor, and treating that as "not found" would flash an
error at every visitor arriving on a club's own link.

**How does a member end up on the awaiting-approval screen?** `/me` refuses with
`PENDING_APPROVAL`; `AccountOrganisationContext` maps the code to a state and `OrganisationRoute`
renders A8. The same mechanism handles `NOT_CONNECTED`, `REGISTRATION_REJECTED`, `ACCOUNT_INACTIVE`
and `ORGANISATION_UNAVAILABLE` — five codes, five screens.

**Why does `refresh()` return a state instead of void?** A8's "Check again" needs the outcome.
Reading `state` after awaiting reads the previous render's value, so the notice would say "still
awaiting approval" even when approval had just been granted.

**Why do `/register` and `/pending` pass `requireConnection={false}`?** They exist because the
member is *not* connected. Gating them on connection would replace each with the A6 screen that
links to them, so "Request to join" would loop back to itself.

**How is the menu gated?** `visibleSections()` in `navigation.ts` — a pure function, tested on its
own. It drops items whose capabilities are absent, then drops sections left empty. An item listing
several capabilities shows if **any** is enabled.

**Is switching organisations a re-login?** No. The Keycloak token is realm-wide, so A7 navigates to
`/:newOrgCode` and the context re-resolves capabilities, theme and locale.

---

## Testing notes

`npm run test:account` — 145 tests, 16 files, all passing. No skips.

- **`src/test/setup.ts` polyfills `window.matchMedia`.** jsdom has none, so MUI's `useMediaQuery`
  returns false for every query and the shell always renders its phone layout — the desktop drawer
  never appears and the failure looks like a missing element. `setViewportWidth(400)` drives the
  mobile tests; the default is desktop.
- **i18next runs against the real en-GB catalogue** (`renderWithProviders.tsx`), so assertions read
  as member-visible text and a missing key shows as a bare key path.
- **`useAccountApi` is mocked with one stable `execute`** that dispatches on URL. The context makes
  two calls (`/me` and the public record); handing back a fresh function per hook call re-triggers
  the effects forever and the test times out rather than failing (CLAUDE.md §3.4).
- `i18n.test.ts` enforces §3.2 — all six catalogues must hold identical keys, no empty values, and
  the same `{{interpolations}}` as en-GB.

---

## My activity (phase 7)

C1 `/:orgCode/entries`, C2 `/:orgCode/entries/:entryId`, C4 `/:orgCode/memberships`, backed by
`GET /api/account/:orgCode/{entries,entries/:id,bookings,memberships}`. Full record:
[docs/ACCOUNT_USER_APP_PHASE7_MY_ACTIVITY.md](../../docs/ACCOUNT_USER_APP_PHASE7_MY_ACTIVITY.md).

**Status vocabulary** — four words shared across entries, bookings and memberships (Awaiting
payment / Confirmed / Completed / Cancelled), derived server-side in
`backend/src/utils/activity-status.ts`, rendered by `ActivityStatusChip`. It is *not* the payment
status: a paid entry to a past event is `completed`, and cancelled beats everything.

**The renewal rule** has three conditions and the third — that a membership type is open to renew
into — cannot be answered from the membership row. The API returns `canRenew` and `renewalNotOpen`
separately so C4 can say "renewals are not open yet" instead of showing a button that leads nowhere.

**Renewing goes through the membership catalogue.** Holding a membership normally marks its type
`already-a-member`; a type the member holds and is within `RENEWAL_WINDOW_DAYS` of losing comes back
available and flagged `isRenewal`, so D4 reads "Renew". Holding *two* and losing one still bars it —
the other covers them. The Renew button used to point at `/:orgCode/join`, which never existed.

**`CapabilityGate`** guards the routes. Hiding a menu item is presentation, not access control — a
member can still type the URL.

**Formatting** comes from `@aws-web-framework/components` (`formatCurrency`, `formatDisplayDate`,
`formatDateRange`). `orgadmin-shell` keeps its own older copies; they were deliberately not merged.

## Catalogue, basket and checkout (phase 8)

`/:orgCode/browse`, `/cart`, `/checkout`, `/orders/:paymentId`. Full record:
[docs/ACCOUNT_USER_APP_PHASE8_CHECKOUT.md](../../docs/ACCOUNT_USER_APP_PHASE8_CHECKOUT.md).

**Stripe is Connect, and the publishable key is the PLATFORM's** — `VITE_STRIPE_PUBLISHABLE_KEY`.
Charges are destination charges on the platform account with the handling fee taken as an
application fee; the club's connected account never appears in the browser. The per-organisation
Stripe keys in the org-admin settings tab belong to the older direct-charge model and are unused.

**Every money figure comes from the server.** The handling fee depends on which items are card-paid,
on the organisation type's configuration and on tax — a second implementation in the browser would
eventually disagree with the one that takes the money.

**The client's success is not the order's.** Stripe accepting the card is not the order existing:
that happens when the webhook is processed. Checkout polls the payment status before showing a
receipt, and F3 keeps checking while pending. Both give up after a bounded wait.

Basket and checkout are deliberately **not** capability-gated — a basket can hold items from any
enabled area.

## The shop (phase 11)

`/:orgCode/shop` (D9), `/:orgCode/shop/:itemId` (D10) and `/:orgCode/orders` (C8), gated on
**`merchandise`**. Full record:
[docs/ACCOUNT_USER_APP_PHASE11_CATALOGUE_COMPLETION.md](../../docs/ACCOUNT_USER_APP_PHASE11_CATALOGUE_COMPLETION.md).

**An item has no price — its option values do.** The price is the sum of one value per option type,
so the list can quote only a *from* price (the cheapest combination) and the detail screen can quote
nothing at all until every option is answered. The same sum runs again in
`merchandise.service.createOrder`, and that is the one that decides what is charged; the browser's
copy exists so a member is not asked to commit to a number they have not seen.

**Sold-out sizes stay in the list, disabled.** A member looking for their size needs to see that it
is the size that has gone, not wonder whether the club stocks it. Whole items behave the same way
unless the club chose `hide`, which the server honours by not sending them.

**`/orders` is declared before `/orders/:paymentId`** so C8 is not swallowed by the payment
confirmation route. They are different things sharing a word: one is the member's merchandise
orders, the other is a receipt.

**C8 shows two statuses on purpose.** `ActivityStatusChip` answers "have I paid?"; the club's own
`orderStatus` answers "can I collect it?". One chip cannot say both.

## Booking (phase 11)

`/:orgCode/book` (D11) and `/:orgCode/book/:calendarId` (D12 + D13 on one screen), gated on
**`calendar-bookings`**.

**Availability is derived, never stored**, and derived *on the server* — there is no table of slots.
The org-admin app computes the same thing in the browser; the two implementations are deliberate and
must agree (`docs/ACCOUNT_USER_APP_PHASE11_CATALOGUE_COMPLETION.md`).

**A week at a time.** A month of half-hour slots is thousands of rows and an unreadable wall; the
endpoint refuses more than 62 days.

**Taken slots are shown, disabled, with the reason** — full, in use, or being booked by somebody
else. Hiding them turns a busy Saturday into what looks like a closed one.

**Choosing a slot holds nothing; adding it to the basket does.** The slot is re-checked when the
line reaches the basket and again at fulfilment, because a court is the thing two members reliably
want at once. When the add is refused, the week is re-read *and then* the refusal is shown —
reloading clears the error, so the order matters.

Since [docs/BASKET_SOFT_HOLDS.md](../../docs/BASKET_SOFT_HOLDS.md), a line in the basket holds its
slot for two minutes (15 once checkout starts). The grid draws the three states differently: the
member's own line is `in-your-basket`, **in red** with a live `HoldCountdown` — the same
"cannot be taken" signal a stranger's hold gets, rather than the disabled grey of a slot that was
never on offer, which says nothing about why. **It stays red after the hold lapses**, because the
line is still in the basket and the add guard still refuses a second copy; the countdown then reads
*Hold expired*, and the places are released to everybody else;
somebody else's is `held` — **worded as held rather than full**, because it may come back, and grey
would read as "you lost it"; and `full` stays for places that are genuinely gone. The server never
sends another member's expiry, so a countdown can only ever be your own. When one reaches zero the
week is re-read, so the grid never keeps drawing a slot the member no longer has.

## Registrations (phase 11)

`/:orgCode/register-interest` (D7), `/:orgCode/register-interest/:typeId` (D8) and
`/:orgCode/registrations` (C6), gated on **`registrations`**.

**A registration is of a *thing*** — a horse, a boat, a dog. The club's word for it is
`entityName` on the type, and the screens use it verbatim ("Register a horse", "Horse name"), so the
same pages read correctly for a boat club. The **name of the thing is a first-class field**, not one
of the club's form questions: `registrations.entity_name` is NOT NULL and is what every list
identifies the record by.

**Holding one is no bar to another**, unlike a membership — a member with two horses registers twice,
so nothing is hidden once used.

**A club that reviews registrations says so before payment**, and fulfilment creates the row
`pending` rather than `active`. C6 then shows two chips: the shared one for the money, the club's own
for approval — and only while it means something.

## Payments (F1, F2)

`/:orgCode/payments`, **not** capability-gated: a payment can cover items from any area, and a member
has a right to their own receipts whatever the club has since switched off.

**The total is `cardAmount + offlineAmount`.** One order can be part card and part cheque, so
`payments.amount` — the decimal legacy column predating the split — is deliberately unused. The two
are shown separately only when the order genuinely was both.

**F2 expands in place** rather than being its own route: a payment's detail is its lines and their
fees, and a receipt behind a navigation is a receipt read once. F3 has nothing further to show.

**A line paid for that produced nothing shows `fulfilmentError`** — the club's to fix, but better
read here than discovered at the gate.

**"The club has still to record this as received" now has a club-side counterpart.** An offline
payment sits here unpaid until an administrator marks it received in org-admin's **Payments →
Offline Payments**, which is also what releases the membership or order it was holding. See
[core-payments.md](core-payments.md) and docs/OFFLINE_PAYMENT_SETTLEMENT.md.

## Cancelling a booking

C1's bookings tab. **The club's policy decides it, on the server**: `listBookings` returns
`canCancel` and, when false, the reason, so the screen explains a missing button rather than merely
lacking one. `POST /bookings/:id/cancel` re-reads the policy — `canCancel` on the list is a snapshot,
and a member who leaves the page open until the notice lapses must not slip through.

**No money moves.** The response says whether the club's policy means a refund is due;
`refund_processed` stays false, because it records that money has gone back and it has not. The
refund is the club's act, through org-admin.

Zero notice means up to the day itself; a past booking is refused as *passed* rather than *too late*;
already-cancelled beats every other reason. **Entries stay non-cancellable** (Q6) — a withdrawn entry
has consequences for a start list the club has to manage.

## The home screen (B3)

`GET /:orgCode/dashboard` — **one request, assembled server-side** by
`account-dashboard.service`, for the reason `/me` is: eight round trips on the first screen a member
sees, each repeating the same auth and membership resolution.

**It decides nothing.** Every figure comes from the service that owns it — the renewal rule from C4,
the cart total and handling fee from `cart.service`, the statuses from `activity-status`. A dashboard
that computed its own answers would start disagreeing with the screens it links to.

**A section the club has not enabled is `null`**, and the card is not rendered at all. An area that is
enabled but empty returns `[]` — a different answer, and the screen shows it differently. The basket
and the "what's on" row **fail soft**: neither is worth taking the home screen down for.

**There is no recent-payments card**
([docs/HOME_SCREEN_RECENT_PAYMENTS_REMOVED.md](../../docs/HOME_SCREEN_RECENT_PAYMENTS_REMOVED.md)),
and the dashboard therefore does not read payments at all —
the `listPayments` call was removed from the `Promise.all` with it, so the section is not merely
hidden. Payments have their own page (C6), and the home screen is for what a member can act on
rather than a receipt they have already had.

## Offline and the PWA (phase 12)

Full record:
[docs/ACCOUNT_USER_APP_PHASE12_OFFLINE.md](../../docs/ACCOUNT_USER_APP_PHASE12_OFFLINE.md).

**The app shell is precached** (`vite-plugin-pwa`, scoped to `/account/`), so a cold start works with
no connection — which is what makes a ticket at a gate possible, since `TicketPage` already renders
its QR on the device.

**Offline lives in `useAccountApi`, not in the screens.** A read falls back to the last answer and
reports `servedFrom.fetchedAt`; a write is refused with `OfflineError` (`code: 'OFFLINE'`) rather
than attempted. Nothing is queued: an entry replayed an hour later could take a place that had gone.
A **refusal is never replaced by cache** — the fallback fires only when the request reached nobody
(`status === 0`), so a 403 stays a 403.

**Cached data is keyed by identity, and sign-out clears everything for everybody.** A club device
passed between members must not show the previous one's payments — a privacy rule, not a caching one.
The service worker precaches the **shell only** for the same reason: a copy in Workbox's cache would
outlive that clearing.

**`navigator.onLine` explains, it does not decide** — a captive portal reports `true` while nothing
can reach the server, so reads always try and always fall back.

**Actions that need the server are refused before they are attempted**, not after: the control is
disabled and says why. On the calendar that is a rule rather than a nicety — slots are **not
selectable offline at all**, because picking one from an hours-old grid and being refused at the
basket is an invitation followed by a rejection. Checkout is stopped at the basket for the same
reason. Everything read-only stays readable.

**A cached screen says so.** The request layer publishes each cache serve to `StaleDataContext`, and
the shell renders "Some of this was saved at 09:14" beneath the banner. Any cached answer marks the
screen, the **oldest** one wins, and it **clears on navigation** — the claim is about the page in
front of the member.

## Not built yet

Booking detail (C3) and registration detail (C7) are unbuilt — each is a card's worth of facts
already on its list screen. No PWA/offline (H1–H3). No stored
default organisation, so a bare `/account` always shows the directory. Keycloak's login page is not
yet branded per club and does not receive `kc_locale`.

---

## Tickets (C9, C10)

`/:orgCode/tickets` and `/:orgCode/tickets/:ticketId`, gated on **`event-ticketing`** — not
`event-management`, because a club can run events without issuing tickets and an always-empty My
Tickets page is worse than no page. Full record:
[docs/ACCOUNT_USER_APP_PHASE9_TICKETS.md](../../docs/ACCOUNT_USER_APP_PHASE9_TICKETS.md).

**Tickets are issued by the backend, not requested by the member.** `fulfilment.service.ts` calls
`ticketingService.issueTicketForEntry` right after it creates the entry, so a ticket appears by the
same rule that activates a membership. Nothing in this app can create one.

**Four states — valid / awaiting-payment / used / expired — computed in SQL**, shared by the list
and detail endpoints so the two screens cannot disagree at a gate. Used and expired tickets are
shown, never filtered: a member whose ticket will not scan is the one who most needs the screen.

**The QR is rendered on the device** from the payload via `generateQRCodeDataURL`
(`packages/components`), not fetched as an image — that is what will let this work offline once a
service worker exists.

**Screen brightness is deliberately not implemented.** C10 asks for it; no browser exposes it. The
page takes a `navigator.wakeLock` instead. Revisit only if the app is wrapped natively.

**Deviation from G11:** the design calls for an `account-ticketing` package. There is no module
registry in `account-shell` — every screen is a page here — so these are pages (CLAUDE.md §1.7).

---

## Profile & settings (P1, P4, P5, P6)

`/:orgCode/profile`, **not** capability-gated — every member has an identity to maintain whatever
the club has enabled. Full record:
[docs/ACCOUNT_USER_APP_PHASE10_PROFILE.md](../../docs/ACCOUNT_USER_APP_PHASE10_PROFILE.md).

**One identity, many clubs.** Name, phone and language belong to the person, not to a club, so an
edit writes Keycloak *and every* `organization_users` row for that identity. Updating only the
current club's row is the obvious bug: the copies drift and the member stays misspelled elsewhere.
The screen warns about this only when the member belongs to more than one organisation.

**Email and password are changed here, in dialogs**, with Keycloak updated underneath — no
redirect to the account console, and no interstitial
([docs/ACCOUNT_SELF_SERVICE_CREDENTIALS.md](../../docs/ACCOUNT_SELF_SERVICE_CREDENTIALS.md)).
`ChangePasswordDialog` and `ChangeEmailDialog` are the two components; `ConfirmEmailChangePage` is
the unbranded `/confirm-email` route the emailed link lands on, outside `/:orgCode` because an
address belongs to the identity and the page is opened with no session.

Two things the console used to do for us still happen, and both matter:

- **The current password is required** for either change, verified by a direct-grant login against
  a confidential Keycloak client (see [backend.md](backend.md)). Keycloak can *set* a password and
  cannot *verify* one.
- **A new address is proved before it is used.** An account user's Keycloak username *is* their
  email, so an unverified change hands them a login they do not own. The link goes to the new
  address and nothing moves until it is followed.

Password policy is never duplicated in the client — the realm's own complaint is shown verbatim, so
a tightened policy needs no front-end change. The email dialog's success state says nothing about
whether an address was already taken; the server answers identically either way, and reporting a
clash would give back exactly what that identical response exists to withhold.

**Language preference is stored twice on purpose**: `organization_users.preferred_language` for the
app (read on every organisation resolve, via `GET /me` → `user.preferredLanguage`) and Keycloak's
`locale` attribute so the **login page** follows it too. `OrganisationRoute` prefers the member's
language over the organisation's; null means "follow the organisation".

## Browse: entry windows, capacity and the date tile

An event row answers two questions: *can I enter?* and *should I enter now?*

**Whether** is the server's decision — `unavailableReason` from
`account-catalogue.service` (G8). **When and how tight** is arithmetic, done in
`utils/entryWindow.ts` and rendered by `components/EntryStatus.tsx`:

| State | Rule |
|---|---|
| `not-open` / `opening-soon` | opens in the future; "soon" is within `OPENING_SOON_DAYS` (14) |
| `open` / `closing-soon` | "soon" is within `CLOSING_SOON_DAYS` (7) — shorter, because missing a closing means not entering at all |
| `closed` | past the closing date |

`not-open` beats `closed` when the two dates are the wrong way round: a misconfigured event should
read as the earlier problem rather than a slammed door.

**Capacity takes the tighter of the event and activity limits.** Quoting an event's twenty beside a
class with two left is a promise the next screen breaks. `capacityFor` returns the limit as well as
the remainder, so the chip can say "12 of 50" — how tight it is, not just what is left. The count is
**suppressed once the window is shut**, since "entries closed" beside "3 places left" reads as an
invitation to try anyway. The backend exposes `entriesLimit` and `placesRemaining` on
`CatalogueEvent` for this; activity-level capacity was already there.

**`EventDateTile`** (in `packages/components`, §1.5 — org-admin event lists can use it too) draws
the date as a tear-off calendar page: month band, weekday, day, year. Month and weekday come from
`Intl`, so a French member reads AOÛT / jeudi. It renders one `role="group"` with the full date as
its label, the visible pieces `aria-hidden` — "AUG Thursday 20 2026" is worse spoken than seen.

### Entry-window dates are ordinal

Both surfaces render opening and closing moments through `formatOrdinalDateTime` — "closes 22nd
Sept 2026, 23:59" rather than "22 Sept 2026". These are dates a member reads as a *deadline* rather
than scans in a column, and an ordinal reads the way the date is spoken.

**Only where the language uses one.** The suffix table in `packages/components/src/utils/formatting.ts`
covers English (`st`/`nd`/`rd`/`th`, chosen by `Intl.PluralRules` so 21 takes `st` while 11 takes
`th`) and French (`1er`, then nothing). German already writes `1.` and Spanish, Italian and
Portuguese use a plain numeral — inventing suffixes there would not be a nicer date but a wrong one.
The formatter is built on `formatToParts` and only rewrites the `day` token, so the locale keeps its
own order and separators, and a two-digit hour is never mistaken for a day.

### The same rules, twice over, at two sizes

The home screen's "What's on" teasers reuse those rules through
`components/WhatsOnStatus.tsx`, which collapses the window and the capacity into **one** chip —
*Open*, *Opening soon*, *Closing soon*, *Closed*, *Entries full* — plus the moment that state turns
on, with the date drawn by the same `EventDateTile` at `size="small"`.

Browse and home differ in what the member is doing, so they differ in how much they say. Choosing
between events wants the places remaining as well; glancing at a teaser wants the state and the
deadline. Both call `entryWindowFor`, so the two screens can never disagree about whether an event
is open — only about how much detail is worth the space.

Which moment appears follows the state: *opening soon* shows both the opening and the closing (when
can I enter, and how long will I have), *open* and *closing soon* show only the closing, and
*closed* says when entries closed. Times are shown throughout, because a closing at 09:00 is a
different thing to plan around than one at 23:59.

**The dashboard teases events the member cannot enter**, which nothing else in the list does.
`buildWhatsOn` admits `entries-closed` and `event-full`, and `entries-not-open` when it is within
`OPENING_WITHIN_DAYS` (3) — deliberately shorter than the client's `OPENING_SOON_DAYS` (14), which
decides how a window is *phrased* rather than whether it belongs on the screen at all. An event the
member has already entered stays out. The reasoning is that an event's unavailability is itself the
news: entries opening on Friday or a camp that filled up are what a member wants to know, and a list
that omitted them would read as a club with nothing on.

`full` outranks the window while entries are running, and never once they have closed: a closed
event reads as *Closed*, because "full" would be a detail about a door that is shut anyway. The
dashboard endpoint hands over `startDate`, `endDate`, the two window dates, `entriesLimit` and
`placesRemaining` raw rather than a decided status — a second opinion computed server-side would
eventually disagree with the client's.

## A membership belongs to a person, not to a login

`members.user_id` is the **holder** — whoever signs in — while `first_name` / `last_name` on the row
are who it is *for*. A parent holds their children's memberships, and those children may have no
login at all.

So both membership surfaces lead with the member's name and demote the type to a subtitle:
`MyMembershipsPage`'s cards and the home dashboard's membership card. Headed by the type, a parent
holding three sees three cards reading "Junior Member" that differ only by a number nobody
recognises. Both fall back to the type when no name is recorded, since a card headed by nothing is
worse than one headed by the type.

The dashboard card is about the membership expiring **soonest**, which makes whose it is essential
rather than decorative — otherwise it announces that something is expiring without saying for whom.
`totalMemberships` lets it add "1 of 4 memberships" instead of implying it is the whole story.

> **Fixed here:** `openMembershipTypeIds` filtered `membership_status = 'active'`, a value that
> column never takes — it is `open` or `closed`. The set was therefore always empty, `canRenew`
> always false, and no membership could ever be renewed; the screen offered "renewals are not open
> yet" to everyone. A test asserting the literal `'active'` had pinned the bug in place.

## The club names its own bookings area

`useBookingsLabel()` is the single reader for what this club calls bookings — `branding.bookingsLabel`
from the public record, falling back to the translated `nav.calendar`. Both places the app names the
area (the navigation entry and the home screen's second row) go through it, so they cannot drift.

The custom label is deliberately **not** translated: it is a name the club chose, and
machine-translating "Court Booking" into five languages would produce five things it never agreed to.

The home screen puts bookings in **their own row** beneath "What's on", headed by that label. They
recur where events and shirts are one-offs, and mixing them in buried both that and the club's own
word. Each booking card leads with its calendar's icon in its calendar's colour — a court, an arena
and a clubhouse are not interchangeable, and colour alone does not carry that. See
`docs/BOOKINGS_NAMING_AND_CALENDAR_ICONS.md`.

## Five rows on the home screen, each with its own budget

**Upcoming events** first — what a member opens the home screen to find out — then memberships (what
they already hold, which is reference rather than news), bookings under the club's own word for
them, the shop, and registrations. The order is pinned by a test, since a reorder would otherwise
pass every other case on the page.

*Upcoming events* carries a **View all** button level with its heading. Four teasers look like the
whole programme, and a member who reads them that way never opens the events page; putting the way
out beside the title says there is more before they have finished scanning what is there. Memberships are every *active* one as its own card rather than a single
card about the soonest to expire, which left a parent's other three invisible; renewal is a button
on the card that needs it rather than a banner that would have to pick one membership to be about.

### The teaser rows

Each row is capped at four **independently** — one shared cap meant a club with events, a shop and three calendars showed
exactly one calendar, with nothing on screen to say that was a limit rather than all it had.

Each card leads with what identifies its kind: a date tile for anything dated, the calendar's icon
in its colour for a booking, a thumbnail for a product. Cards in a named row drop their kind caption
(`showKind={false}`), since "Shop" above a grid of cards each captioned "Shop" is the same word
twice.

## Joining a second club sends nothing

`POST /api/account/:orgCode/register` takes the caller's **identity from the verified token**, not
the request body: the email, so nobody can register under someone else's address, and the name for
the same reason.

That matters because A4 is a single button. The platform already knows who is pressing it, so the
request carries no body at all — and reading the name from `req.body` meant every such request
arrived nameless and was refused as invalid. The member was told the club could not be joined, when
nothing about the club was the problem.

`extractUserInfo` reads `given_name` / `family_name`, falling back to splitting `name` for a realm
that releases only that. Empty rather than undefined when a realm releases neither, so callers cope
with absence explicitly. The body remains a fallback for that case.

## Every basket line carries a mark

`CartItemIcon` draws a tinted square in the item's own colour — the same treatment the home screen
gives its cards, because a basket is where a member checks they picked the right things and it
should look like the screens they picked them from.

A **booking** uses its calendar's own icon and colour, resolved in the cart service from
`context_ref.calendarId` (one query per basket, none when it holds no bookings). A club's bookable
things are meant to be told apart, which is why a calendar carries a mark at all.

Everything else takes the icon for its **type** — event, membership, registration, shop — because
one event entry is not visually distinct from another and pretending otherwise would be noise.

## Held lines carry their own clock

A basket holding a court and a jumper has one line on a timer and one not, and a single warning at
the top of the page cannot say which. So `HoldCountdown` sits under the description of any line with
an `expiresAt`, and lines without one — memberships, merchandise — show nothing rather than an
expiry they do not have.

When a countdown reaches zero the basket reloads, which is what turns it into the `HOLD_EXPIRED`
warning and stops checkout. That refusal is deliberate: charging for a place that is no longer
reserved is worse than making the member add it again.

The payment screen carries the same clock — see
[docs/MANUAL_CAPTURE_AND_HOLD_CONTROL.md](../../docs/MANUAL_CAPTURE_AND_HOLD_CONTROL.md). `CheckoutPage`
was already **embedded** (Stripe's `PaymentElement`, not a hosted redirect), it simply knew nothing
about holds. It now shows `checkout.holdExpiresAt` counting down, disables *Pay now* the moment it
lapses, offers *Back to basket*, and posts to `/checkout/:paymentId/abandon` — which cancels the
payment intent, so the client secret in a tab left open stops working. The countdown hides once the
payment is in flight: a timer beside "processing" reads as a threat to a payment that has already
left.

## Entries and bookings share one table

C1 lists both in a single table, ordered **coming up first (soonest), then past (most recent)** —
a single sort either way opens on the least useful end
([docs/MERGED_ACTIVITY_LIST.md](../../docs/MERGED_ACTIVITY_LIST.md)). The tabs are gone, with
`?tab=` and the per-kind column keys.

Each row carries `CartItemIcon`, reused from the basket: an entry gets the event glyph, a booking
gets **its own calendar's icon in its own colour**, which `listBookings` now returns as
`displayIcon` / `displayColour`. Only entry rows are clickable — a booking's detail is already in
the row, and there is no page behind it.

## The basket block on the home screen

In **its own full-width row**, before the teaser rows — a basket with something in it is the most
actionable thing on the page. That row is what fixes the alignment: it was previously the second
cell of a two-column summary grid, so the card sat in the right-hand half while every row below
started at the left ([docs/CONFIGURABLE_HOLD_WINDOWS.md](../../docs/CONFIGURABLE_HOLD_WINDOWS.md)).

The title stays **inside** the card, as "Coming up" keeps its own, with a
shopping-cart mark in `warning.main` — the same orange as the count in the navigation, so the badge
and the card read as one thing. *Go to basket* sits level with the figures under
`justifyContent: space-between`, not beneath them: it takes a row off the card's height, and pins
the button right as the figures grow.

## The basket count is pushed, not polled

The **Basket** menu item carries an orange badge with the number of **lines** in the basket — not
quantities, and not expired holds
([docs/BASKET_COUNT_BADGE.md](../../docs/BASKET_COUNT_BADGE.md)). Nothing when it is empty.

The screens that change the basket are scattered, so rather than threading a refresh through each
one, `useAccountApi` fires `notifyCartChanged()` after any successful **write** to a cart or
checkout URL, and `useCartCount` refetches. A page needs to know nothing about the badge, and a page
added later gets it for free. Reads are excluded — the count is refreshed *by* a read. The listener
registry is a module-level set in `src/cart/cartActivity.ts`, not a context, so one number in the
menu does not re-render every screen.

**A card payment is the exception, and needs `notifyIfSettled`.** The basket is emptied by
`confirmPayment`, reached only from the Stripe webhook — so it happens after the checkout write
returned, with no client request involved, and the client's only remaining call is a status poll,
which is a read. Left to the write rule alone the badge kept its pre-payment count. `CheckoutPage`
and `OrderConfirmationPage` therefore both announce a payment that reaches any status but `pending`.
Paying offline never had the fault, because `markAwaitingOfflinePayment` closes the cart during the
checkout request itself.

Orange rather than the club's primary, because primary is already the selected state of that same
list; announced as a phrase (`nav.cartCount`) with the digits `aria-hidden`, since a bare number
beside "Basket" is not a sentence.

## A member can see what they filled in, everywhere it was asked

The application form is gone once the thing it created exists, and
`GET /form-submissions/:id` serves only lines still in an **open** basket — so once
checkout completes, the member's own records are the only place their answers survive. All three
screens read them through `utils/form-summary.ts`, so one submission is described the same way
wherever it appears:

| Screen | How |
|---|---|
| Basket | `formSummary` per line, behind *Click to see your N entry form values*, with *Change answers* |
| My Memberships | collapsed *Your details*, unmounted until opened |
| Entry detail (C2) | shown in full — the page is about one entry, so there is nothing to bury |

Entry detail previously said *"Your answers are not available to view here"* **unconditionally** —
a placeholder that read as an explanation, on a screen that had never rendered answers. An activity
that asked nothing now says so (`entry.noAnswers`) rather than showing an empty heading.

## Memberships: the card is the link, and the details are behind it

A membership card on the home screen **is** the link to My Memberships — a `CardActionArea`, so it
is keyboard-reachable and announced as a button. The per-card *View memberships* link it replaced
appeared once in every card and said the same thing each time. Renew stays outside the action area:
it goes somewhere else, and a button inside a button is markup browsers resolve by firing both.

On My Memberships each record carries a collapsed **Your details** section holding every answer from
the application form, labelled and in the club's field order — the only record a member has of what
the club was told, since the form is gone once the membership exists. It **unmounts while
collapsed** rather than hiding: several memberships of a dozen answers each would otherwise put a
hundred hidden rows in the page, reachable by search and by a screen reader. A club that asked
nothing gets no expander at all.

The answers come from `utils/form-summary.ts`, shared with the basket so the two describe the same
submission the same way.

## The basket shows the answers, and lets them be corrected

Each line carries a `formSummary` — the application form's answers, labelled and in the club's own
field order, built by joining the submission to its form. Empty answers are left out: a summary is
for confirming what was said, and a list of blanks buries it.

Between filling the form in and the club receiving the entry, the basket is the member's **only**
sight of what they wrote. A mistyped pony name or the wrong age group is otherwise found by the club
rather than by them, so the summary carries a *Change answers* button, opening the same
`ApplicationFormDialog` prefilled with what was submitted.

**Editing is confined to an open basket.** `GET`/`PUT /api/account/:orgCode/form-submissions/:id`
resolve the submission through `cart_items → carts`, requiring the cart to be `open` and both the
submission and the cart to belong to the resolved account. Once checked out, the club has been told
what was said, and a member quietly rewriting it afterwards would change a record somebody has acted
on. Anything else is a **404, not a 403** — a member has no business learning that another member's
submission exists. An edit is re-validated by the same rules as the original, so correcting answers
clears the same bar as giving them.

## The cart picks a payment method; the member changes it

Nothing asks a member how they want to pay while they are adding a thing to a basket, so nothing
sends a method — `paymentMethodId` is optional on `AddCartItemDto` and the cart resolves it:

- **one** supported method → that one, since there is nothing to decide
- **several** → the **card** method, because it completes without the club having to do anything;
  an offline default would leave a member believing they had paid while the club is still waiting
  to record it
- several, none of them card → the first, so an offline-only club can still sell

The cart page then offers the alternatives as a `Select` per line. Changing one reloads the whole
cart rather than patching locally: the handling fee is charged on the card portion of the basket, so
moving a single item between card and offline re-prices the rest.

`CartItemView.availablePaymentMethods` carries names, not just ids — ids were enough to *validate* a
switch but not to *offer* one, so the page could only ever show the method already chosen.

> **`itemType` is a union, not a string.** `cart_items.item_type` has a check constraint, so a value
> that merely looks right — `event-entry` for `event_entry` — is refused by Postgres at insert time
> with a 500. Two pages sent the hyphenated spelling, and the client typed the field as `string`, so
> nothing caught it; the test fixtures had copied the same wrong value, so they agreed with the bug.
> `CartItemType` now lives in `types/account.ts` and every call site annotates its literal with
> `satisfies CartItemType`, which turns the mistake into a compile error where it is written.
>
> **Event activities carry two payment columns**, and the catalogue read the wrong one.
> `allowed_payment_method` is a *single* value (`any` / `pay-offline` / `stripe`); the list of method
> ids is `supported_payment_methods`, the same jsonb column memberships, merchandise and calendars
> use. Assigning the single value to a `string[]` gave every activity a string where an array
> belonged — so `includes()` did substring matching, and once the cart started resolving a default
> the bare slug reached Postgres as `ANY('pay-offline')` and took the request down with "malformed
> array literal". `defaultPaymentMethodFor` now filters to uuid-shaped ids and refuses anything else
> as a validation error, so a misconfigured item is something a member can act on rather than a 500.
>
> **This is why every add to basket failed** with "that payment method is not accepted for this
> item". The guard compared the item's accepted methods against a `paymentMethodId` no front end has
> ever sent, so it was always `includes(undefined)`. A second break sat behind it: the seed stored
> method *names* where the column and the guard both use *ids*, so even a correct request could not
> have matched.

## Booking several slots at once

The week grid is multi-select: a member books Tuesday *and* Thursday in one pass, or the same slot
several weeks running. Each chosen slot becomes **its own cart item**, added in one POST per slot
rather than a batch — the cart's guard re-checks each as it arrives, and a batch would have to
decide what to do when the third of five has gone. Adding them singly means the member keeps
whatever was still free and is told about the one that was not.

`slotKey` includes the **date** for this reason: without it, 10:00 Saturday and 10:00 Sunday share a
key, and selecting one would toggle the other. Each day's `ToggleButtonGroup` reports only its own
day, so the other days are carried through untouched on every change.

The basket, terms and the add button sit in a **sticky column beside the week** rather than below
it: a member picking several slots is running a total in their head, and a summary below the fold
makes them scroll to check it after every tap. Chosen slots fill success green — with several
selectable at once, a selected-but-grey button reads as disabled next to the ones that genuinely
are.

## The tab icon follows the club

`hooks/useOrganisationFavicon.ts` swaps the browser favicon to the organisation's uploaded logo, and
restores `/favicon.png` when the logo goes away or the member leaves for the directory. A member
with three clubs open in three tabs otherwise sees the same platform mark on all of them.

Driven from `AccountOrganisationContext`, not `AppShell`, because the gateway and directory screens
render outside the shell and must still get the right icon.

**The logo is proved to decode before it is applied.** A browser that fails to decode an icon falls
back to a blank page glyph rather than to the previous one, so pointing the tab straight at an
unverified upload would let a bad file cost the club its icon entirely. Loading it into an `Image`
first means a failure is simply a swap that never happens. `apple-touch-icon` is left alone: it is
baked into a homescreen shortcut at install time, so rewriting it mid-session changes nothing.

## Two catalogues, not one tabbed page

`/browse/events` and `/browse/memberships` are separate routes with their own menu entries, each
gated on its own capability (`event-management`, `memberships`). They share one component —
`BrowsePage` takes a `section` prop — because the add-to-basket path, the application-form gate and
the availability handling are identical; only the list differs.

The previous single "Enter or join" screen had to render a tab strip and then account for a tab that
was missing, and a club with one capability got a page with one tab. Splitting the routes means such
a club has one menu item and one page.

**Nav items carry an icon name, not a component.** `navigation.ts` stays a plain data model so
`visibleSections` is testable without rendering; `AppShell` maps `NavIcon` → MUI icon through a
`Record`, which is exhaustive, so a new icon name fails the typecheck rather than rendering a gap
beside its label. Icons are `aria-hidden`: the label already names the destination.

**The drawer paper sets its own background.** `AppShell` gives `.MuiDrawer-paper` an explicit
`background.paper` colour, `backgroundImage: none` and a `divider` right border. The temporary
variant slides over the page, so a panel relying on an inherited background let the page text show
through the menu items on a narrow screen; the desktop layout hides that, because there the drawer
sits beside the content rather than on top of it.

**Entry windows show the time.** `open_date_entries` and `entries_closing_date` are timestamps, and
a deadline at 09:00 is a different thing to plan around than one at 23:59 — so `EntryStatus` uses
`formatDisplayDateTime`, not `formatDisplayDate`.

## Entering is a page, not a dialog

`EntryFormPage` — `/browse/events/:itemId/enter` and `/browse/memberships/:itemId/apply`. It
replaced `ApplicationFormDialog`, which is gone.

A club's application form can run to many fields, and a dialog gave it a scrolling box inside a
scrolling page, hid the item being paid for behind an overlay, and could not be linked to or
reloaded. Terms made that worse: a member was being asked to agree to something they could not
comfortably read.

**The item is re-fetched by id, not passed through router state**, so the page survives a reload and
a pasted link, and the price shown is the server's current answer rather than whatever the list held
when the member clicked.

**Terms gate the submit button.** `termsAndConditions` comes back with the catalogue —
`use_terms_and_conditions` decides whether the stored text is presented at all, since text left over
from a previous configuration is not something anyone decided to show. The button is disabled until
the box is ticked, with a line saying why: a dead control with no explanation reads as a broken page.

**The one-click add survives for items with neither a form nor terms.** Routing those through a page
whose only content is a confirm button would be ceremony rather than consent.

`EntryStatus` renders the chips **and**, beneath them, the dates in full: before the window opens
both the opening and closing moments, once open just the deadline. The chip is for the glance
("Closes in 2 days"); the line under it is for the decision, and only that says *when*.

### Entry form details

- **The club's form name and description are not shown.** They are written for the administrator who
  built the form ("Entry entry v2", "used for junior classes") and mean nothing to the member filling
  it in, who gets `form.detailsHeading` — an instruction — instead.
- **Required answers gate the submit button**, recomputed as the member types, with the outstanding
  fields named beneath it. On a long form the missing field is often off-screen, so a count would
  not help.
- **Wrong answers gate it too, and are reported separately.** `validateApplicationField` checks
  every answer against its datatype — an email that is not an email, letters in a phone number, a
  choice that was never offered — under "Check these answers: …" rather than "Still needed: …",
  because a member told something is missing goes looking for an empty box that is not there. The
  server applies the same rules at `POST /form-submissions` and returns `400 INVALID_SUBMISSION`
  with a per-field list (`docs/APPLICATION_FORM_FIELD_TYPES.md`).
- **Fields go through `applicationFieldToFieldDefinition`** (`packages/components`,
  `utils/applicationField.ts`) before reaching `FieldRenderer`. It reconciles three separate
  disagreements between the form builder and the renderers — `label`/`name` vs
  `displayName`/`shortName`, builder datatypes (`radio`, `checkbox`, `select`, `multiselect`) vs
  renderer ones, and top-level `options` vs `datatypeProperties.options`. All three fail silently:
  the first as an unlabelled box, the other two as a plain text box, because `FieldRenderer` falls
  back to `TextRenderer` for anything it does not recognise. Both showed up in front of members
  before anything asserted the control rather than the label.
- **Terms render through `RichText`** (`packages/components`), which sanitises with DOMPurify. They
  are stored as HTML from a rich-text editor, so rendering them as text shows the tags and rendering
  them raw is stored XSS against every member. The allow-list excludes `img` and `iframe`: a club
  should not be able to turn terms members are agreeing to into a page that loads anything.

**Capacity before entries open reads as a limit, not a remainder** — "Limit: 20 places" rather than
"20 places left". The latter implies a race that has not started and a number that will have moved
by the time it has. `CatalogueActivity` carries `entriesLimit` alongside `placesRemaining` so the
cap is accurate even when some entries already exist.
