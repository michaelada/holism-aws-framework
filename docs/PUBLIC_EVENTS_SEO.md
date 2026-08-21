# Making public events findable in web search

Companion to [PUBLIC_EVENTS.md](PUBLIC_EVENTS.md), which flagged this as a limitation and deferred
it. **Built** — see §7 for what landed and the two items that did not.

---

## 1. The finding that changes the shape of the feature

My proposal had two public pages: a club's list and the platform's list. **Neither is indexable in
any useful sense, because neither is an event.**

A list page is one URL. Forty-seven events on one URL can rank for *"equestrian events Ireland"* and
for nothing else — not for "Spring Show Jumping League", not for "cross country Punchestown
September", which are the searches that actually bring someone to a club. And a search result that
lands a visitor on a filter page, where they must find the event again among forty-six others, has
wasted the click.

**Search discovery requires one URL per event.** That is a structural change to the proposal, not a
layer added on top of it, and everything below depends on it.

```
/{orgCode}/whats-on                  the club's list          indexable, ranks as a list
/{orgCode}/whats-on/{slug}           ← one event, one URL     the page that ranks and is linked to
/events                              the platform list        indexable, ranks as a list
```

**The club's URL is the canonical one for an event, always.** It is the club's event, under the
club's name, and it is where entry happens. The platform page is an aggregator that links out to it.
The alternative — the same event indexed under two URLs on one domain — splits whatever authority it
earns and asks Google to choose between them.

---

## 2. What a crawler sees today

Verified against the actual files, not assumed:

| | Now |
|---|---|
| `<title>` | `ItsPlainSailing` — the same on every route |
| `<meta name="description">` | one generic sentence, every route |
| Open Graph / Twitter card | **none at all** |
| `#root` | empty — a crawler that does not run JS sees a blank page |
| `robots.txt` | does not exist |
| `sitemap.xml` | does not exist |
| Structured data | none |
| Anything setting `document.title` | nothing — no `react-helmet`, no manual title code |

The Open Graph gap is worth pulling out of that table. The first thing a pony club will do with a
public event link is paste it into Facebook or WhatsApp. Today that produces a grey box with no
image, no title and no description — which is not an SEO problem, it is the product looking broken
at the exact moment a club is recommending it.

**A second finding, unrelated to crawlers but fatal to the URL plan:** `events` is not in
`RESERVED_URL_CODES`. A club could take the URL code `events`, and `/account/events` would resolve to
that club instead of the platform page. It has to be reserved in the same change — and the reserved
list has a mirror in `migrations/1709000000003_add-organization-url-code.js` that must move with it.

---

## 3. The proposal, in four layers

Each layer is useful alone and they are worth doing in this order.

### Layer 1 — one URL per event

`/{orgCode}/whats-on/{slug}`, where the slug is the event name reduced to words and suffixed with a
short id for uniqueness:

```
/khpc/whats-on/spring-show-jumping-league-a1b2c3
```

The id is what resolves; the words are for the reader and for the search snippet. A renamed event
keeps working on its old URL and a `301` sends it to the new one, so a link a club posted in March
still lands in September.

**Not `slugifyUrlCode`**, despite the obvious overlap — this document originally said to reuse it and
that was wrong. That helper is built for organisation codes, which occupy a path segment alone: it
enforces a minimum length and appends `-org` to anything reserved or too short, so an event named
"!!!" would publish at `/whats-on/org-a1b2c3d4`. An event slug always carries an id and never
competes for the organisation namespace, so it needs neither rule.

### Layer 2 — real `<head>` content, served by the backend

nginx already routes `/api/` to Express. The public event paths route the same way: the backend reads
the built `index.html` once at startup and returns it with the head filled in per event — title,
description, canonical, Open Graph, Twitter card, JSON-LD. The SPA then boots and takes over exactly
as it does now.

This is the smallest change that works. It needs no SSR framework, no second app, no change to how
the SPA is built, and it leaves every authenticated route untouched.

```
GET /khpc/whats-on/spring-show-jumping-league-a1b2c3
   nginx ──▶ Express
              ├── look up the event (public? published? not deleted?)
              ├── inject <head>: title, description, canonical, OG, JSON-LD
              ├── inject <noscript> with the event's real content
              └── return index.html  ──▶  SPA boots, renders the page
```

**The `<noscript>` block is not a trick.** It carries the same facts the rendered page shows — name,
date, venue, club, activities, entry window — so a crawler that does not execute JavaScript gets the
event rather than an empty div. Google does run JavaScript, with a delay; Bing is inconsistent; and
social scrapers, which is where the club's own traffic comes from, run none at all.

### Layer 3 — `schema.org/Event`, the piece that matters most here

Generic SEO advice undersells this. Google has a **dedicated events experience** — the "Events" pane
in search, and event rich results with date, venue and ticket link — and it is populated from
`Event` structured data. For a product whose public surface is entirely events, this is the highest
return of anything in this document.

The mapping is unusually clean, because the data already exists:

| schema.org | Source |
|---|---|
| `name`, `description` | `events.name`, `events.description` |
| `startDate`, `endDate` | `events.start_date`, `events.end_date` |
| `eventStatus` | `EventScheduled`, or `EventCancelled` when unpublished after being public |
| `eventAttendanceMode` | `OfflineEventAttendanceMode` — these are horses in fields |
| `location` → `Place` | `venues.name`, `venues.address`, `venues.region`, and `latitude`/`longitude` when set — the `geo` property is exactly what those unused columns are for |
| `organizer` → `Organization` | the club's `display_name` and its public URL |
| `offers` → `Offer[]` | one per activity: `price` from `fee`, `priceCurrency` from the organisation, `url` the entry link, `validFrom` the entry-open date |
| `offers.availability` | `InStock` / `SoldOut` from the places-remaining logic the catalogue already computes |
| `image` | the club's logo today; an event image if that is ever added |

Two things to get right, because they are the usual failures:

- **`offers.url` must be the entry URL**, and that URL must work for an anonymous visitor — which is
  the sign-in-return-path fix already called out in the main proposal. A rich result whose ticket
  link dead-ends is worse than no rich result.
- **Members-only activities are not offers.** They are not purchasable by the reader, and listing
  them as available offers would be a false price in a search result. They stay in the visible page
  (§3 of the main proposal) and out of the structured data.

### Layer 4 — `robots.txt` and a generated `sitemap.xml`

`robots.txt`, served at the site root:

```
User-agent: *
Allow: /events
Allow: /account/            # the public directory and gateway
Disallow: /api/
Disallow: /orgadmin/
Disallow: /admin/
Disallow: /metadata/
Disallow: /auth/
Disallow: /*/browse/        # the member catalogue, behind sign-in
Disallow: /*/cart
Disallow: /*/checkout
Disallow: /*/profile
Sitemap: https://itsps.org/sitemap.xml
```

The `Disallow` lines matter as much as the `Allow` ones. The member app is behind authentication, so
a crawler reaching it finds a sign-in wall; indexing those is wasted crawl budget and puts sign-in
pages in results where events should be.

`sitemap.xml` is **generated by the backend**, not written by hand, because the content changes daily:
every public event URL, plus the two list pages, with `lastmod` from `events.updated_at` and
`changefreq` reflecting how close the entry deadline is. Cached for an hour; a club publishing an
event should not wait a day for it to be listed.

Above a few thousand events this becomes a sitemap index with one child per organisation. That is a
later problem, but the generator should be written so it is a small one.

---

## 4. The details that decide whether this actually works

Most SEO work fails on these rather than on the big pieces.

**A past event keeps its page.** It does not 404 and it is not removed from the sitemap the day after
it runs. It keeps the URL, gains a clear "this event has finished" state, and its structured data
keeps the real dates. An event that ranked for a year and then 404s loses the club everything it
earned, and repeat events benefit from a URL with history.

**A withdrawn event returns `410 Gone`, not `404`.** An event made private after being public has
genuinely gone; `410` tells Google to drop it promptly rather than re-crawling for weeks. A `404`
says "not found", which invites retries.

**Filtered views are not indexed.** `/events?type=dressage&region=meath` is the same content
rearranged — infinite combinations of near-duplicate pages. The base `/events` is indexed;
anything with query parameters carries `<meta name="robots" content="noindex,follow">`. `follow`
matters: the links out to individual events are still worth crawling.

**Locale.** Public pages render in the organisation's language, and there are six. If a club's page
is only ever served in one language, `<html lang>` and an `og:locale` are enough. If the same event
is reachable in several, it needs `hreflang` and a per-locale URL — which is more work than it
sounds and should be a deliberate decision rather than a discovery. **Recommend one language per
organisation page for a first version**, and say so in the document rather than leaving it implied.

**Core Web Vitals are a ranking input.** The shell currently loads Google Fonts from a third-party
origin, which delays first paint on a cold visit. For a public page whose visitor has no relationship
with the product yet, that is the wrong first impression as well as a ranking cost. Self-hosting the
two font families removes a DNS lookup, a TLS handshake and a render-blocking dependency, and is
independent of everything else here.

---

## 5. What I would not do, and why

**Not full server-side rendering of the account app.** It would mean Node in the serving path where
nginx serves static files today, a rewrite of how the app boots, and an auth story for SSR that does
not currently exist. All of that to server-render pages that are mostly behind a login and do not
need it.

**Not build-time pre-rendering.** Clubs publish events continuously; a snapshot taken at build time
is wrong before it deploys. It is the right tool for a marketing site and the wrong one for this.

**Not dynamic rendering — serving crawlers a different page.** It was tolerated by Google as a
workaround and is now explicitly described as a stopgap rather than a recommendation; it doubles the
surface that can drift, and the failure mode is being judged as cloaking. Injecting real head content
and real `<noscript>` content into the *same* page for *every* visitor avoids the question entirely.

---

## 6. Decisions for you

| # | Decision | Recommendation |
|---|---|---|
| 1 | Add per-event public URLs? | **Yes — this is the whole thing.** Without it there is nothing for a search result to point at |
| 2 | Canonical: the club's URL or the platform's? | **The club's.** It is their event, their brand, and where entry happens |
| 3 | Public pages served by Express (head injection) | **Yes.** Smallest change that works; nginx already routes `/api/` this way |
| 4 | One language per organisation page, or `hreflang` across six? | **One**, for a first version. Revisit with evidence |
| 5 | Self-host the fonts? | **Yes**, and it is worth doing whether or not any of the rest happens |
| 6 | Reserve `events` as a URL code | **Required**, not optional — the platform page does not work otherwise |

---

## 7. Built

All of it, except where noted. Layers 1 and 3 are most of the value; layer 2 is what makes them
visible to everything that is not Googlebot.

| # | Task | State |
|---|---|---|
| 1 | Reserve `events`; migration + the mirrored list | ✅ migration `1709000000033`, both lists |
| 2 | Per-event route and page, slug + id resolution, redirect on rename | ✅ `PublicEventPage`; `301` server-side, `replace` client-side |
| 3 | `schema.org/Event` JSON-LD | ✅ `EventStructuredData`, 12 tests |
| 4 | Express head injection | ✅ `seo.routes`, **needs `ACCOUNT_SHELL_HTML` set** — see below |
| 5 | `<noscript>` content block | ✅ name, club, date, venue, priced activities |
| 6 | `robots.txt` | ✅ served by the backend, routed by nginx |
| 7 | Generated `sitemap.xml`, cached | ✅ one hour, `lastmod` per event |
| 8 | `noindex` on filtered views | ✅ on the platform page |
| 8b | `410` on a withdrawn event | ⛔️ **not built** — a withdrawn event currently 404s |
| 9 | Self-host fonts | ⛔️ **not built** — independent of the rest |

### Deploying layer 2

Head injection needs the built `account-shell/index.html`, which lives in the nginx image rather
than the backend's. `ACCOUNT_SHELL_HTML` points at it.

**Unset, the routes do nothing and nginx serves the static shell exactly as today** — the feature
degrades to the current behaviour rather than breaking, which is the right failure for something
only crawlers and link previews can see. Wiring it up means either mounting the file into the
backend container or adding a `COPY` to `packages/backend/Dockerfile`.

Verified against the real built shell: one `<title>` (the generic one is stripped, not appended to),
one description, four `Offer` objects, the app's module script still present so the page hydrates,
and a stale slug answering `301` to the canonical address.
