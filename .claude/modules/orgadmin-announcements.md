# `packages/orgadmin-announcements` — Org Announcements capability module

A club's own notices to its members: written here, read on the member's home page in the account
application.

- **Capability:** `org-announcements`. Without it the menu item, the routes and the API are all
  absent — a club sees no trace of a feature it has not bought.
- **Its own package** rather than a corner of `orgadmin-core`, because `orgadmin-core` is the
  always-on package and every module in it is `capability: undefined`.
- **Tests:** Vitest — `npm run test:orgadmin-announcements`.
- Feature record: [ORG_ANNOUNCEMENTS.md](../../docs/ORG_ANNOUNCEMENTS.md) · wireframes:
  [ORG_ANNOUNCEMENTS_WIREFRAMES.md](../../docs/ORG_ANNOUNCEMENTS_WIREFRAMES.md).

## Routes (`src/index.ts`)

| Path | Page |
|---|---|
| `announcements` | `AnnouncementsListPage` — every notice the club has written, finished ones included |
| `announcements/new` | `AnnouncementEditorPage` |
| `announcements/:id/edit` | `AnnouncementEditorPage` (the same page; `useParams().id` decides) |

Menu item **Announcements**, `order: 14` — after ticketing, last of the capability modules.

## The window is the only control

There is no draft or published flag. `startsAt` and `endsAt` decide everything, and
`announcementState()` in `src/types/announcement.types.ts` derives the three states the list shows —
*Showing now*, *Scheduled*, *Finished* — from them alone. A status column alongside would make
publishing two facts that can disagree.

## What lives where

| Piece | Where | Why |
|---|---|---|
| `AnnouncementCard` | `packages/components` | The org-admin **preview** and the member's home page render the same component. A preview built separately drifts, and what it gets wrong first is what the preview was for |
| The three placements and the background scrim | `AnnouncementCard` | A club uploads whatever photograph it has; darkening it is the card's job, not the club's |
| Table, service, routes | `packages/backend` | `organisation_announcements`, `announcement.service`, `announcement.routes` |
| The member's right-hand third | `account-shell` `HomePage` | B3 owns its own layout |

## Data it touches

```
GET    /api/orgadmin/announcements              the list
GET    /api/orgadmin/announcements/:id          the editor
POST   /api/orgadmin/announcements              create
PUT    /api/orgadmin/announcements/:id          update
DELETE /api/orgadmin/announcements/:id          remove (a real delete)
POST   /api/orgadmin/announcements/:id/image    attach an image (multipart)
DELETE /api/orgadmin/announcements/:id/image    remove the image, keep the notice
```

The member's read is **not** a route of its own: announcements ride on
`GET /api/account/:orgCode/dashboard`, which already returns the whole home screen in one call.

## Questions this answers without opening code

| Question | Answer |
|---|---|
| "Why is a notice not showing?" | Its window. `starts_at <= now < ends_at`, applied in SQL against the **database's** clock, so a member with a wrong device clock sees what everyone else sees |
| "How does a club take one down early?" | Edit *Shows until*, or delete it. Deleting is real — nothing was paid and nothing granted — and is confirmed by a dialog that names the notice |
| "Where does the image live?" | S3, keyed `organisations/<org>/announcements/<id>/image_<unique>`. The row stores the **key**; a signed URL valid for an hour is generated at read time. Not an unauthenticated route like `platform_posts` uses: a club's notices are for its members |
| "Why is the image uploaded separately from saving?" | The key is derived from the row's id, so the row has to exist. On a new announcement the editor saves first, then uploads; the preview shows a blob URL in the meantime |
| "Why is there only one link?" | A club notice points at the thing it is about. `platform_posts.links` is an array because a release note may point at three; here two columns say what one link is and let the database enforce **both halves or neither**. `http`/`https` only — this button renders on every member's home page, so a `javascript:` URL would be stored XSS against the whole club |
| "An image was added and did not save — why?" | It was two faults: `useApi` forced `application/json` onto the multipart body so the server found no file, and the editor turned the resulting 400 into silence. Both fixed — the hook leaves the content type to axios for a `FormData` body, and the editor reports the refusal and stays put with the file still chosen so Save retries. A new announcement created before a failed upload is **updated** on retry, not created again |
| "Why is the menu item missing for a club that has the capability?" | Its **admin role** does not carry it. `orgadmin-shell` filters modules by `GET /auth/capabilities`, which is the organisation's `enabled_capabilities` **and** the role's `capability_permissions`; a role seeded before the capability existed has to be given it from Platform Admin. True of every capability, met by every new one |
| "Why does a placement disappear when the image goes?" | `imagePlacement` is reported as null wherever there is no image, in the service and again in the card. A card claiming a background it has no picture for is not renderable |
| "What does the preview render?" | `AnnouncementCard` from `packages/components`, from the **form's** state rather than from what is saved — so a club sees the effect of a word before committing to it |
| "Why is the date picker's provider in the page?" | Through the source alias Vite can load a second copy of `@mui/x-date-pickers`; a provider inside a shared component would belong to a different module instance than the pickers rendered here |
| "Which club does a request concern?" | `req.organisationId`, set by `byCurrentOrganisation` / `byResource('announcement')`. Never the body or the query string |
| "Where are the strings?" | `orgadmin-shell/src/locales/<locale>/translation.json` under `announcements.*` and `modules.announcements.*`, six locales. The member-facing heading (*Notices*) is in **account-shell's** own catalogue under `announcements.heading` |
