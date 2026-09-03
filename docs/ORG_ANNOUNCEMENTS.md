# Org Announcements

A club posts a notice; its members see it when they sign in.

---

## 1. Requirements

### 1.1 The ask

> Org admins can post messages that are then displayed to account users when they log in. This
> requires a new capability called "Org Announcements" which, if an organisation has it, gives the
> Org Admin UI a new menu option "Announcements" where the admin can create announcements that are
> displayed on the account user's home page. An announcement has: title; description; active start
> and end date — two date-time stamps, one for when to start displaying it and one for when it is to
> be removed; an optional image with options on how it is used — as a background, as a header, as a
> footer. If used as a background it should be reasonably dark so the text can be seen; maybe add a
> dark/shadow overlay to darken it first.
>
> The edit/view page should include a preview of the announcement as it would be shown to the account
> user.
>
> On account login, the home page is split in thirds, with 1/3 on the right for announcements if
> there are any — otherwise the screen looks as it does today. If announcements are being displayed,
> the current home page contents fit into the other 2/3. The page must be responsive: on narrow
> screens announcements, if there are any, are shown first.

### 1.2 Functional requirements

| # | Requirement |
|---|---|
| R1 | A new capability, **`org-announcements`** ("Org Announcements"), seeded in `capabilities` and assignable to an organisation like any other |
| R2 | With the capability, the org-admin menu gains **Announcements**; without it, neither the menu nor the routes exist |
| R3 | An announcement has a **title**, a **description**, a **display window** (starts at / ends at, both date-times), and optionally an **image** with a **placement**: background, header or footer |
| R4 | The list shows every announcement the club has, with its window and whether it is showing **now** |
| R5 | Create, edit and delete, each audited |
| R6 | The create/edit screen shows a **live preview** of the announcement exactly as a member will see it |
| R7 | An image used as a **background** is darkened so the text over it stays legible, without the administrator having to prepare the image |
| R8 | The account home page shows announcements that are **inside their window now**, in a right-hand third; the rest of the page occupies the other two thirds |
| R9 | With no announcements — or without the capability — the home page is exactly as it is today |
| R10 | On a narrow screen the announcements come **first**, above the rest of the home page |
| R11 | Announcements belong to one organisation and are never visible to another |
| R12 | An announcement may carry **one optional link** — words and a web address — shown as a button, the way the platform's own posts carry theirs |

### 1.3 Out of scope

Deliberately not built, and worth saying so:

- **No scheduling beyond the window.** No recurrence, no per-member targeting, no read receipts.
- **No ordering control.** Announcements sort by start date, newest first. A club that wants one at
  the top gives it a later start.
- **No email or push.** This is a screen, not a notification channel.
- **No draft state.** The window is the control: an announcement that starts tomorrow is not showing
  today. A separate `status` would mean taking one down by unticking a box *and* remembering what the
  dates were.

---

## 2. Design

### 2.1 Where each piece lives

| Piece | Package | Why |
|---|---|---|
| `organisation_announcements` table, service, routes | `packages/backend` | Every endpoint is a router plus a service (§3.1) |
| `AnnouncementCard` | `packages/components` | **Rendered by both front ends** — the org-admin preview and the member's home page. One implementation, or the preview stops being a preview (§1.5) |
| Announcements module (list, editor) | `packages/orgadmin-announcements` (new) | A capability-gated module is its own package; `orgadmin-core` is the always-on package and every module in it is `capability: undefined` |
| The right-hand third | `packages/account-shell` `HomePage` | B3 owns its own layout |

The new package mirrors `orgadmin-ticketing`, the smallest existing capability module.

### 2.2 The table

`organisation_announcements`, one row per announcement:

| Column | Notes |
|---|---|
| `organisation_id` | The tenancy column. `platform_posts` deliberately has none — *"an organisation's own announcements, if they are ever wanted, are a different table with a tenancy column and a different audience"*. This is that table |
| `title` | Required |
| `description` | HTML from the same rich-text editor the rest of the org-admin uses; sanitised on the way out by `RichText`, exactly like event and membership descriptions |
| `starts_at`, `ends_at` | Both required. `ends_at > starts_at`, enforced by a check constraint as well as by the service, because a window that ends before it begins is a row that can never be shown and nothing else would notice |
| `image_key`, `image_mime` | The **S3 key**, not a URL — a bucket rename or a CDN would otherwise rewrite every row. The same choice `platform_posts` made |
| `image_placement` | `background` \| `header` \| `footer`, constrained. Meaningless without an image, and null when there is none |
| `created_by` | The `organization_users` row of the admin who wrote it |

Index on `(organisation_id, starts_at, ends_at)`: the account read is always "this club's announcements whose window contains now", and it runs on every member's home page.

### 2.3 The link

One link, not a list. `platform_posts.links` is a JSONB array because a release note may well point
at three things; a club notice points at the thing it is about — the booking page, the fixture list,
the form. Two columns (`link_label`, `link_url`) say exactly what a single link is, and let the
database enforce the one rule that matters: **both halves or neither**, since a label with no URL is
a button that does nothing and a URL with no label is a link with nothing to click. If a second link
is ever wanted, these become a JSONB column and nothing outside the service notices.

**`http` and `https` only**, refused on the way in. This button renders on every member's home page,
and a club administrator's account is a much softer target than the platform's — a `javascript:` URL
here is stored XSS aimed at the whole club. `mailto:` is excluded as well: a button that opens a mail
client when it looks like it opens a page is a small betrayal of the reader. The same rule the
platform's posts apply, for the same reasons.

Rendered by `AnnouncementCard` under the words, opening in a new tab with `noopener` — a member
reading the home page is in the middle of their own business, and taking the tab away loses it. Over
a background photograph the button is drawn in white, because the default outline disappears into
whatever the picture happens to be.

### 2.4 The image

Uploaded as a **separate step** after the announcement exists, like a platform post's — the row must
exist for its S3 key to be derived from its id, and a form that uploads before saving leaves orphan
objects whenever somebody changes their mind.

Delivered to both front ends as a **signed URL**, valid for an hour, generated at read time. The
alternative — a stable unauthenticated route, as `platform_posts` uses — is right for a login page
that has no session, and wrong here: a club's notices are for its members, and an unauthenticated
route would serve them to anyone holding the id.

**Background placement darkens the image itself.** A club uploads whatever photograph it has; asking
an administrator to prepare a suitably dark version is asking them to do something they cannot
easily do and will not check. The card lays a gradient scrim over the image and sets the text white,
so legibility does not depend on the photograph.

### 2.5 What the account sees

Announcements ride on the **existing dashboard call** (`GET /api/account/:orgCode/dashboard`), which
already returns the whole home screen in one request and already decides every section server-side.
A second request would mean a second spinner on the one screen that must feel instant.

The server sends only what is showing now — the window is applied in SQL, against the database's
clock, not the browser's. A member whose device clock is wrong sees the same notices as everyone
else.

`announcements` is `[]` for a club without the capability, and `[]` for a club that has it but has
nothing showing. The home page treats both the same way, which is what R9 asks for.

### 2.6 The home page layout

```
Wide (md and up)          Narrow (below md)
┌──────────┬────┐         ┌────────────┐
│ today's  │ an │         │ announce.  │  ← first
│ home     │ n  │         ├────────────┤
│ page     │ .  │         │ today's    │
│ (8/12)   │(4) │         │ home page  │
└──────────┴────┘         └────────────┘
```

MUI's `Grid` with `order` on the announcements column: `order: -1` below `md`, `0` from `md` up. The
existing content is unwrapped and full width when there is nothing to show, so a club without
announcements gets today's page byte for byte rather than today's page inside a 12-column grid that
happens to be full width.

---

## 3. Task breakdown

| # | Task |
|---|---|
| T1 | Migration: seed the `org-announcements` capability; create `organisation_announcements` with its constraints and index |
| T2 | `announcement.service.ts` — list, get, create, update, remove, `setImage`, `clearImage`, `activeFor`; window validation; signed URLs |
| T3 | `announcement.routes.ts` under `/api/orgadmin`, capability-gated and organisation-scoped, each mutation audited |
| T4 | Audit actions (`announcement.created` / `.updated` / `.deleted`) with labels in six locales |
| T5 | `AccountDashboard.announcements`, filled only when the capability is on |
| T6 | `AnnouncementCard` in `packages/components`, with the three placements and the background scrim |
| T7 | New package `orgadmin-announcements`: module registration, list page, editor with live preview |
| T8 | Shell wiring — dependency, vite alias, `ALL_MODULES` |
| T9 | i18n keys in all six locales |
| T10 | Account `HomePage`: the two-thirds/one-third split and the narrow-screen order |
| T11 | Seed: a club with the capability and a few announcements, one per placement |
| T12 | Tests at every layer, then the module summaries and the wireframes doc |

Wireframes: [ORG_ANNOUNCEMENTS_WIREFRAMES.md](ORG_ANNOUNCEMENTS_WIREFRAMES.md).

---

## 4. What was built

Everything in §3, plus three things worth recording because they were decisions rather than tasks.

**The capability had to be seeded in `capabilities`, not only granted.**
`1709000000027_strip-unknown-capabilities` removes any name from an organisation that is not in that
table, so a capability that skipped the row would have been silently stripped from every club it was
granted to.

**`announcement` had to be registered in three maps**, none of which the compiler would have missed:
`OWNER_SQL` in `organisation-scope.middleware` (so `byResource('announcement')` can find the owning
club), `ROW_SQL` in `audit.middleware` (so an update records what changed and a delete records what
was removed), and `AUDIT_ACTIONS` (so the action is accepted on write at all).

**The account home page is wrapped, not rewritten.** `HomeLayout` takes the existing page as
`children` and renders it bare when there is nothing to show — so the club with no announcements
gets today's page, and the 400 lines inside it were not touched.

## 5. Verified

Against the development database, with the capability granted to Kildare and four notices written:

```
capability on: true
admin list: [ 'AGM: 14 October [not]', 'Clubhouse closed this Saturday [showing]',
              'Summer camp booking is open [showing]', 'Winter league results [not]' ]
members see: [ 'Clubhouse closed this Saturday', 'Summer camp booking is open' ]
dashboard announcements: [ 'Clubhouse closed this Saturday', 'Summer camp booking is open' ]
without the capability: []
backwards window refused: Shows until must be after shows from
database refuses it too: violates check constraint "organisation_announcements_window_check"
```

## 6. Tests

| Suite | Covers |
|---|---|
| `announcement.service.test.ts` | half a link refused either way round, `javascript:` and `mailto:` refused, link text capped, the pair returned as one fact and dropped where a row holds only half of one; the window in SQL and against the club's clock; newest first; a blank title, a backwards window, a zero-length one, an unreadable date and an unknown placement all refused; a signed URL rather than a key; a notice that survives an image it cannot sign; no placement without an image; the replaced key reported so the object can be tidied |
| `announcement.routes.test.ts` | the club comes from the middleware, not the query; a club without the capability is refused at the URL; the author recorded from the token; the picture removed with the notice, and the notice removed even when the bucket refuses; an upload with no file, and one that is not an image |
| `account-dashboard.service.test.ts` | announcements ride on the dashboard; none asked for without the capability; a dashboard that still builds when the notices cannot be read |
| `AnnouncementCard.test.tsx` | the link as a button that opens a new tab with `noopener`, absent for half a link, and white over a photograph; the three placements as three arrangements; the scrim over a background, aria-hidden, with white text; no `img` for a background; no placement without an image |
| `module-registration.test.ts` | the capability name, i18n keys rather than English, the routes, and **that the shell actually registers the module** |
| `AnnouncementsListPage.test.tsx` | the three states from the window alone; the window under the badge; the empty state said in full; delete confirmed by name and the list re-read |
| `AnnouncementEditorPage.test.tsx` | the link previewed as the member's button, held back until both halves are there, trimmed on the way out and null when empty; the preview updating as you type; create-then-upload in that order; a chosen image previewed before it is uploaded; placement disabled until there is one; the backwards-window refusal; editing an existing notice |
| `HomePage.test.tsx` | the two-thirds/one-third split; *Notices*; the notices first on a narrow screen; **the page unchanged when there are none**; a background notice rendered over its scrim |

---

## 7. Granting the capability is two steps, not one

Worth knowing before anybody wonders where the menu went. `orgadmin-shell` filters `ALL_MODULES` by
what `GET /api/orgadmin/auth/capabilities` returns, and that is the intersection of the
organisation's `enabled_capabilities` with the **admin role's** `capability_permissions` — a role
seeded before a capability existed does not carry it. So a club whose organisation has
`org-announcements` still sees no menu item until the role does too.

That is existing platform behaviour rather than anything new here — it applies to every capability —
but a newly-added one meets it every time. Role permissions are edited from **Platform Admin**, on
the organisation's roles; the seed does it for itself, because `capabilitiesFor()` fills both the
organisation and its admin role from the same list.

---

## 8. The image that was never saved

Reported from the product: a club edited a notice, added an image, pressed Save, and the picture was
not there afterwards — with no error.

**Two faults, one behind the other.**

`useApi` set `Content-Type: application/json` on every request that had not asked for something
else. A `FormData` body has to be announced as `multipart/form-data; boundary=…`, and only the HTTP
client can write that boundary, because it is generated with the body. So the upload arrived with a
multipart body under a JSON header, `multer` found no file, and the route answered **400 "Choose an
image to upload"** — confirmed by replaying exactly that request against the router.

Then the editor swallowed it. `execute` answers `null` on an error unless `throwOnError` is passed,
so the failed upload read as "nothing to do", and the page navigated to the list as though the notice
had saved with its picture.

**Fixed at both levels.** `useApi` now leaves the content type alone when the body is `FormData` —
unset rather than `multipart/form-data`, since a boundary-less multipart header is the same bug one
step on, and axios fills it in correctly from the body itself. That repairs the class of defect
rather than this one call site: the merchandise gallery only worked because it happened to pass the
header by hand. The editor's upload now uses `throwOnError`, reports the refusal, and **stays on the
page** with the chosen file still in hand so Save retries.

One hazard came with that. On a *new* announcement the row exists after the first press, so a retry
had to correct it rather than write a second notice; the page remembers the id it created and
switches to updating. Otherwise a club with a failing upload would have collected one announcement
per attempt.

Covered by `useApi.test.ts` (no content type for a `FormData` body, JSON kept for ordinary
requests, a caller's own header never overridden, the token still sent) and by
`AnnouncementEditorPage.test.tsx` (the refusal shown rather than navigated past, the file kept for a
retry, one create however many attempts, and the body sent as `FormData` with `throwOnError`).
