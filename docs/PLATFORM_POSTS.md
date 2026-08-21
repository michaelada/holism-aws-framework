# Platform posts

An ItsPlainSailing super admin writes announcements; everybody signing in to
either application reads them, beside the sign-in form.

The login page is the one screen every user of the product passes through. That
is what makes it the right place to put a message — and what makes a mistake
here expensive: a broken post is seen by the whole platform at once, by people
who are not signed in and mostly cannot report it. Almost every decision below
follows from that.

## A post

| Field | Notes |
|---|---|
| Title | Required, 255 characters |
| Body | Rich text, written in the same ReactQuill editor as the rest of the product |
| Image | Optional, served publicly, shown across the top of the card |
| Links | Optional list of `{ display text, URL }`, rendered as buttons under the message |
| Status | `Active` or `Inactive` |
| Show on account login | Checkbox |
| Show on org admin login | Checkbox |
| Order | Arranged by the operator; the same order readers get |

**Status and the two checkboxes answer different questions.** Status is whether
the post is finished; the checkboxes are where it belongs. So an active post on
neither page is a legitimate state — a draft that has been proof-read — and the
admin screen says so out loud rather than refusing it, because "active" and
"nobody can see it" read as a contradiction.

Two independent flags rather than an `account | orgadmin | both` enum: a post
very often belongs on both pages, quite often on exactly one, and an enum makes
"both" a value somebody has to remember while making "neither" unsayable.

## Where they appear

Four surfaces, in two implementations.

| Surface | Rendered by |
|---|---|
| Keycloak **org-admin** login | `infrastructure/keycloak/themes/org-admin/login/` |
| Keycloak **account-user** login | `infrastructure/keycloak/themes/account-user/login/` |
| Account app organisation gateway (`/:orgCode`, signed out) | `OrganisationGatewayPage` → `PostCard` |
| Platform Admin preview | `PostDetailsPage` |

The Keycloak pages are the ones that actually hold the password field. They are
FreeMarker and plain JavaScript — no React, no build step — so they cannot use
`packages/components`' `PostCard` and carry **a second implementation of the
same card** in `resources/js/posts.js`. That duplication is deliberate and is
the price of putting posts on the real login page; the order (image, title,
message, links) is the part that has to be kept in step by hand.

### The card is a tinted panel, and the values live in three files

These pages have a white background, so a white card with a hairline border
barely reads as a card — the announcements looked like loose text beside the
sign-in form. The card is therefore a very light warm grey, a step back from the
paper-white sign-in card next to it:

| | |
|---|---|
| background | `#faf8f5` |
| border | `1px solid rgba(0, 0, 0, 0.08)` |
| radius | `12px` |
| shadow | `0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)` |

The look came from **`org-admin/…/warm.css`**, where it is expressed in that
theme's own tokens (`--bg-paper`, `--border-medium`, `--shadow-sm`) and should
stay that way — it tracks the warm theme rather than this card.

The other two carry the literals, because neither can reach a token: `PostCard.tsx`
(a MUI `sx`) and `account-user/…/account.css`. **Those two must change together.**
A member crosses between the account application and the account-user login page
mid-task, and a card that changed shape at the boundary is exactly the sort of
thing that reads as "have I ended up somewhere I should not be?".

### Layout

Sign-in on the left, posts on the right, **an even split**, from **600px** (`sm`)
upward. Two equal columns with no floor on either: a `minmax(380px, 1fr)` floor
on the sign-in side does not fit inside 600px alongside a second column, and
keeping it would have given a full-width form beside a ribbon of announcements.
Even columns shrink together instead, which is the honest behaviour when there
is little width to divide. At 600px each column is 272px — tight but usable —
and it reads comfortably by tablet width.

Gap and padding step up at 900px (24→48px, 32→64px top): 48px of gutter out of
600 is most of a column.

The posts themselves are capped at **440px** and centred within their half. The
two halves of the page stay equal, but a card of text and a 16:9 image does not
need the whole of one: at full width the announcements read as the main event
beside the sign-in that is the actual reason for the page. The cap applies only
to the two-column layout — stacked, the cards match the sign-in card above them,
and narrowing them there would leave them visibly thinner than it for no reason.
It does not bind below about 950px, where the column is already narrower.

Below 600px they stack, sign-in first — somebody on a phone came here to sign in, and
announcements they must scroll past to reach the password field are an obstacle
rather than a message.

**With no posts, every surface collapses to exactly the single-column page it
was before this existed.** On the Keycloak pages that is `data-has-posts`, which
`posts.js` sets only once it has actually rendered something; in the account app
the gateway returns its original centred `Container`. Without it, a deployment
that has never written a post gets an empty half of a screen and an off-centre
sign-in form.

## The rules that matter

### The public read is sanitised on the server

`GET /api/public/posts?surface=…` returns bodies that have already been through
DOMPurify with a narrow allowlist. That is not belt-and-braces, it is the only
sanitiser in the chain for one of the two consumers: the Keycloak theme sets
`innerHTML` and has no DOMPurify, no build step and no way to acquire either.
Leaving sanitising to the caller means leaving it to the caller that cannot do
it.

The **admin** read is deliberately *not* sanitised — it feeds an editor and must
round-trip exactly, or every open-and-save would erode the author's post.

### Link URLs are checked on write

A post's links become anchors on an anonymous page, so a `javascript:` URL is
stored XSS aimed at everybody who signs in. Only `http:` and `https:` are
accepted, and the refusal happens on write so the author is told rather than
silently ignored. `posts.js` re-checks anyway; it costs one regex.

### The public read can never break a login page

If the query fails, `/api/public/posts` returns `[]` with a 200 rather than an
error, `usePlatformPosts` resolves to an empty list, and `posts.js` swallows
everything. Nobody on a login page can report a broken announcements panel, and
an error beside a sign-in form suggests the sign-in itself is broken — which
stops people trying, over a decorative failure.

### Only a super admin may write one

Every `/api/admin/posts` route is `requireRole('super-admin')`. An organisation
administrator runs one club; a post is shown to every user of the platform, so
`admin` is deliberately not enough. Verified: an org-admin token gets `403`.

### The image URL changes when the image does

`/api/public/posts/:id/image?v=<token>`, streamed from S3. Not a signed URL: two
very different clients read it — React and a hand-written theme script — and
neither should have to refresh a URL that expires. Taking a post down takes its
picture with it; the route only serves images for `active` posts.

**The `v` token is what makes the path safe to cache, and it was missing.** The
URL was `/posts/:id/image`, derived from the post — which does not change when
its picture does. So the same address served different pictures, and with
`max-age=300` on it a browser that had seen the old one kept showing it. An
operator removed a post's image, went to the login page, and the image was still
there.

The token is a short hash of the S3 key, which is uniquified per upload, so it
changes exactly when the bytes change and not otherwise — a fresh token per read
would defeat caching just as thoroughly in the other direction. Because the URL
is now content-addressed the bytes can be cached hard:
`public, max-age=31536000, immutable`.

### The post list is revalidated, not held

`Cache-Control: no-cache` on `/api/public/posts`. This was `max-age=60`, to
spare the database on the busiest anonymous endpoint in the product, and it cost
more than it saved: for a minute after any edit the login pages showed the
previous version, which reads as "my change did not save". `no-cache` means
revalidate rather than "do not store", so Express still answers a conditional
request with a 304 when nothing has changed, and the query behind it is one
indexed read against a partial index.

## Ordering

`display_order`, rewritten wholesale by `PUT /api/admin/posts/reorder`, which
takes the complete list of ids. One statement rather than a move-up/move-down
that writes two rows: two people reordering at once then end with one of their
arrangements rather than an interleaving of both.

The admin screen uses a pair of arrows per row rather than drag-and-drop — it is
keyboard-reachable and screen-reader-legible with none of the machinery drag
needs, and the list is short enough that dragging would rarely be faster. The
list is deliberately *not* the sortable `AdminTable` the other admin screens
use: here the order **is** the content, and a table that can be re-sorted by
title would show an arrangement that is not the one being edited.

New posts append rather than insert — the only choice that cannot disturb an
arrangement somebody has already made.

## Configuration

Nothing, in a deployed environment. nginx serves Keycloak under `/auth/` and the
API under `/api/` on one origin, so the theme's relative path is correct and
CORS never arises.

In development Keycloak is on `:8080` and the API on `:3000`; `posts.js` detects
that port and falls back to `http://localhost:3000`, and the backend already
allows any `http://localhost` origin when `NODE_ENV=development`. For a
split-host setup, set `ipsApiBase` in each theme's `theme.properties`.

Keycloak runs `start-dev` in `docker-compose.yml`, so theme changes are picked
up on reload with no restart.

## Two bugs found after the first pass

Both were caching, and both were reported as "I removed the image and it is
still there".

1. **The image URL was not content-addressed** — see above. Replacing a picture
   served the old one for up to five minutes; removing one left it on screen
   until the browser's copy expired.
2. **`clearImage` never reported the old S3 key**, so no replaced or removed
   image was ever deleted from the bucket. The SQL was
   `UPDATE … SET image_key = NULL … RETURNING image_key`, which reads perfectly
   and is wrong: Postgres `RETURNING` gives the **new** row, so it returned the
   null it had just written. It now reads the row in a CTE first.
   `RETURNING OLD.*` would be the obvious fix and arrived in PG18; this
   deployment is on 16.

## A trap this work uncovered

`packages/backend/__mocks__/isomorphic-dompurify.js` was **an identity
function** — "in tests, we're not actually testing sanitization" — wired in
through `moduleNameMapper`. Against it, every sanitisation assertion in the repo
passed while proving nothing: a `<script>` tag survives an identity function
exactly as it would survive a sanitiser somebody had deleted. `moduleNameMapper`
also intercepts `jest.requireActual`, so no single suite could opt out.

It now delegates to the real DOMPurify over jsdom. Making it honest caused
**zero** failures across 159 suites, so it was pure risk. The XSS middleware and
this service both depend on it working.

## Tests

| What | Where |
|---|---|
| Sanitising, link URLs, ordering, per-surface reads, image-URL versioning | `backend/src/services/__tests__/platform-post.service.test.ts` |
| Super-admin gating, the anonymous read, its never-fail behaviour | `backend/src/routes/__tests__/platform-post.routes.test.ts` |
| The card: order, links, image URL, empty alt | `components/src/components/PostCard/__tests__/PostCard.test.tsx` |
| The admin list: arranging, deleting, empty and failed states | `admin/src/pages/__tests__/PostsPage.test.tsx` |
| The gateway's announcements column | `account-shell/src/pages/__tests__/OrganisationGatewayPage.test.tsx` |

See [PLATFORM_POSTS_WIREFRAMES.md](PLATFORM_POSTS_WIREFRAMES.md).
