# Public event listings — design proposal

**For review. Nothing here is built.**

**Request:** an event-level *Show Public* setting. Off, and the event behaves as today — visible only
to signed-in account users. On, and the org admin chooses one or both of:

1. list it on the organisation's own public page
2. list it on a common, searchable ItsPlainSailing page covering every organisation

Both public listings show the event, its activities, opening and closing dates and any entry limits.
Entries are still made through the account login: clicking an event takes the visitor to that event
inside the organisation's account app, signing in or joining first if needed.

---

## 1. What the investigation found

Six findings shaped the design. Three of them are the reason parts of this are more work than they
look.

**`event_activities.show_publicly` already exists and means something else.** It controls whether an
activity appears in the club's *own* listing to its own members — a way to keep a class off the list
without deleting it. It is not a public-visibility flag, and the new setting must not be confused
with it or folded into it. Naming matters here: the new fields are about *the public*, that one is
about *the list*.

**Venues have no structured location.** `venues` carries a free-text `address` and nullable
`latitude`/`longitude`. Nothing holds a county, region or town as a value that can be filtered on.
Filtering "by county/region" — which the request asks for — cannot be done from what exists without
parsing prose. **This is the one place the feature needs new data from org admins.** §6.1.

**Sign-in loses the destination.** An anonymous visitor deep-linked to
`/{orgCode}/browse/events` gets the gateway, and the gateway signs them in with
`redirectUri: /account/{orgCode}` — the club's home page. The event they clicked is gone. The
central promise of this feature ("clicking an event brings them to that event") does not work today
and needs a change to `useAuth`. §5.3.

**There is a precedent for public opt-in.** Organisations already choose whether to appear in the
public directory, via `settings->listedInDirectory`, honoured by `listPublicOrganisations`. The new
setting follows the same shape: opt-in, off by default, and discoverability is separate from access.

**`public-search` is a capability that gates nothing.** It is seeded on every organisation of the
type and referenced nowhere in the codebase. It is either the natural gate for option 2 or dead
weight to be removed — see the decision in §7.

**The account app already is the public front door.** `account-shell` serves the anonymous
organisation directory at its root and the per-organisation gateway. Adding public pages there
reuses the routing, theme, i18n and API client rather than standing up a fifth app. The site root
(`itsps.org/`) is currently a static placeholder listing the four apps.

---

## 2. The data model

```
events.show_on_organisation_page   BOOLEAN NOT NULL DEFAULT false
events.show_on_platform_page       BOOLEAN NOT NULL DEFAULT false
venues.region                      VARCHAR(100)                    -- see §6.1
```

**Two booleans rather than a `public_visibility` enum**, and the reason is that it leaves no invalid
state to defend. `(false, false)` *is* "Show Public: No" — not a fourth enum value that duplicates
what two falses already say. The Yes/No toggle in the form is **derived** from "is either one on",
so a user who turns the toggle on and then unticks both has simply turned it off again, and there is
no "you must choose at least one" error to write, translate and explain. The invalid state cannot be
represented.

It also keeps the queries honest: the platform page is `WHERE show_on_platform_page`, indexable and
obvious, rather than `WHERE public_visibility IN ('platform','both')`.

**Draft events are never public**, whatever the flags say. Public listings filter on
`status = 'published' AND deleted = FALSE`, exactly as the member catalogue does. A club must not be
able to publish to the world something it has not published to its own members.

---

## 3. What a public listing shows — and what it must not

| Shown | Why |
|---|---|
| Event name, description, type | what it is |
| Start and end dates | when |
| Venue name, address, region | where — and the only reason the region field exists |
| Organisation name, and a link to it | whose event it is; the request's "run by" |
| Activities: name, description, fee | what can be entered and what it costs |
| Entry window: opens, closes | whether it is worth acting now |
| Entry limits and places remaining | event-level and activity-level, as the member view already computes |

| Not shown | Why |
|---|---|
| Who has entered, or how many by name | it is a public page; entrants are not public |
| Terms and conditions | agreed at entry, behind the login, where they are read in context |
| Discount codes | a public page is not where a club's pricing negotiations belong |
| Anything about members | including whether an activity is members-only — see below |

**Members-only activities are a decision, not an oversight.** An activity restricted to members
(`entry_eligibility <> 'all'`) is still *listed* publicly, marked as members-only, with no
suggestion the visitor can enter it. Hiding it would misrepresent the event's size — a show with
eight classes would appear to have three — and a visitor who reads "members only" has learned
something true and useful: that joining is the route in.

---

## 4. The two public pages

### 4.1 The organisation's page — `/{orgCode}/whats-on`

Everything that organisation has marked for option 1. Its own branding, its own colours.

Named `whats-on` rather than `public`: "public" is a word from the administrator's form, not from
the visitor's world, and it will be read as "is there a private page I am missing?". The account app
already uses "What's on" for the same idea inside the login.

### 4.2 The platform page — `/events`

Every event any organisation has marked for option 2, across all organisations, searchable and
filterable. This is the surface the request asks to be "nicely styled" — it is the only page in the
product with no logged-in user, no organisation context and no prior relationship with the reader.

Filters, from the request and from what the data can actually answer:

| Filter | Source |
|---|---|
| Free text | event name, description, organisation, venue |
| Event type | `event_types` across all organisations |
| Region | `venues.region` — **needs §6.1** |
| Organisation | organisations with public events |
| Date range | `start_date` |
| Entries open now | derived from the entry window |

Sorts: soonest first (default), closing soonest, recently published, organisation A–Z.

**Hosting.** Built in `account-shell`, so it is served at `/account/events`. That URL says "account"
about a page for people who have no account. Recommendation in §7.3.

---

## 5. How it hangs together

### 5.1 API

```
GET /api/public/organisations/{code}/events     option 1 — one club's public events
GET /api/public/events                          option 2 — the platform page, with q/filters/sort/page
GET /api/public/events/filters                  the filter vocabularies, so the UI never invents one
```

All three anonymous, all three under the existing `/api/public` mount, which is already
unauthenticated by design and rate-limited by nginx.

A third endpoint for the filter options is deliberate: the type, region and organisation lists must
come from what is actually *in* the public results, or the page offers filters that return nothing.

### 5.2 Reuse rather than re-derivation

Entry windows, capacity and "places remaining" are already computed for the member catalogue by
`account-catalogue.service`, and the account shell already phrases them (`utils/entryWindow.ts`,
`components/EntryStatus.tsx`, `EventDateTile`). The public pages use the same computation and the
same components. A second opinion about whether entries are open would eventually disagree with the
first, and the two would be wrong in different places.

### 5.3 The click-through, and the change it needs

```
public card  →  /{orgCode}/browse/events?event={id}
                     │
                     ├─ signed in and connected  →  the event, expanded
                     ├─ signed in, not connected →  join this club  →  back to the event
                     └─ anonymous                →  gateway → Keycloak → back to the event
```

The last two do not work today: the gateway signs a visitor in with `redirectUri: /account/{orgCode}`
and drops everything after it. The fix is small and contained — carry the current path as the return
URI while still passing the organisation code for Keycloak's branding — but it is a change to shared
auth code and is called out here rather than discovered later.

`?event={id}` rather than a fragment, so the server sees it and the browse page can expand that one
event on arrival. With the events list now collapsed by default, arriving at a wall of closed
accordions with no indication of which one was clicked would be worse than not linking at all.

---

## 6. The two things that cost more than they look

### 6.1 Location filtering needs a field that does not exist

`venues.address` is prose: *"Craddockstown, Naas, Co. Kildare"*. Filtering by county means either
parsing that — brittle, and wrong for the first venue written differently — or storing it.

**Proposal:** add `venues.region VARCHAR(100)`, optional, on the venue form. The public filter offers
the distinct values actually present. Free-text search still covers the whole address, so a visitor
typing "Kildare" finds it whether or not the region is filled in.

**The cost is honest and worth stating:** every existing venue has a null region until an
administrator edits it, and until then those events answer no region filter. The alternative —
shipping a filter that silently omits most events — is worse. A one-line hint on the venue form
("used to filter public event listings") is what makes it get filled in.

Not proposed: geocoding the address, or a radius search off `latitude`/`longitude`. Both are real
options later; neither is needed to answer "show me events in Meath", and both add a dependency.

### 6.2 Search discovery needs a per-event URL — which this proposal did not have

Investigated separately in **[PUBLIC_EVENTS_SEO.md](PUBLIC_EVENTS_SEO.md)**, and it corrects this
document rather than extending it.

The two pages proposed above are two URLs. Forty-seven events on one URL can rank for *"equestrian
events Ireland"* and for nothing else — not for the event names people actually search. Search
discovery needs **one URL per event**, `/{orgCode}/whats-on/{slug}`, canonical at the club.

That is a structural change to §4, not a later layer, and it also fixes something unrelated to
search: today, pasting any link from this product into Facebook or WhatsApp produces a grey box with
no title, image or description, because the shell carries no Open Graph tags at all. Sharing a link
is the first thing a club will do with this feature.

See the SEO document for the four layers, the `schema.org/Event` mapping, and a URL-code collision
that has to be fixed before the platform page can exist.

---

## 7. Decisions for you

| # | Decision | Recommendation |
|---|---|---|
| 1 | Add `venues.region`, or leave location to free-text search only? | **Add it.** The request asks for region filtering by name, and it cannot be done otherwise |
| 2 | Gate option 2 on the `public-search` capability? | **Yes.** It exists, gates nothing today, and this is what it obviously means. It also gives you a per-organisation switch for the platform page without a new concept |
| 3 | Public URL for the platform page | Ship at `/account/events`; add an nginx alias `/events` → `/account/events` when the root becomes a real page. Flagged rather than assumed |
| 4 | Show activity fees publicly? | **Yes.** "From €20" is most of why a visitor clicks, and the fee is not confidential |
| 5 | Should option 1 be available to every organisation, or gated too? | **Ungated.** A club publishing its own events on its own page needs no permission from the platform |

---

## 8. Task breakdown

Sized in the order it would be built, each step leaving the product working.

Per-event public pages and the search work are sequenced in
[PUBLIC_EVENTS_SEO.md](PUBLIC_EVENTS_SEO.md) §7; the two lists interleave.

| # | Task |
|---|---|
| 1 | Migration: two `events` columns, `venues.region`, indexes, and `events` added to `RESERVED_URL_CODES` |
| 2 | `event.service` reads and writes the flags; validation that draft cannot be public |
| 3 | Org-admin: the *Show Public* control on the event form (§4 of the wireframes) |
| 4 | Venue form: the region field and its hint |
| 5 | `public-event.service` — one query behind both endpoints, reusing the catalogue's window and capacity logic |
| 6 | The three public endpoints |
| 7 | `useAuth` return-path fix, and `?event=` handling on the browse page |
| 8 | Organisation public page, **and the per-event page** (SEO §7.2) |
| 9 | Platform page: search, filters, sort, pagination |
| 10 | Six locales; module summaries; seed fixtures for public events |

Visual design: [PUBLIC_EVENTS_WIREFRAMES.md](PUBLIC_EVENTS_WIREFRAMES.md).
