# `packages/admin` — Super-admin UI

The platform operator's console. Creates and configures the organisations, organisation types,
roles and users that the org-admin app then operates within.

- **Dev:** `npm run dev:admin` → `http://localhost:5174`, `/api` proxied to `:3000`.
- **Tests:** Vitest — `npm run test:admin` (~23 test files).
- **Talks to** `/api/admin/*` on the backend.


## Hold windows are set per organisation

The organisation edit page carries **Basket hold** and **Payment hold**, in minutes, written to
`settings.holds` ([docs/CONFIGURABLE_HOLD_WINDOWS.md](../../docs/CONFIGURABLE_HOLD_WINDOWS.md)).
Defaults 3 and 15; ranges 1–60 and 5–180, validated server-side and echoed in the helper text. An
empty box means "use the platform default" and is sent as `undefined`, not 0 — which the server
would read as a hold of no time at all.

`settings` is merged rather than replaced on update, so saving these cannot wipe `stripeConnect`
stored beside them.

## Layout

```
src/
  routes/index.tsx     Central route table (a conventional <Routes> block, not a module registry)
  pages/               All screens
  components/          Layout and shared admin widgets
  constants/           localisation.ts — the single locale/language/currency source
  context/             AuthContext, ApiContext, NotificationContext
  hooks/               useApiCall (admin's own, not orgadmin-core's useApi), useUnsavedChanges
  services/            adminApi, organizationApi, paymentMethodApi
  utils/errorHandling.ts
  theme/, types/
```

Unlike the org-admin shell, routes are declared centrally in `routes/index.tsx`; there is no module
registry and no capability filtering of navigation.

### Shared UI primitives

Five components carry the conventions; reach for them before hand-rolling.

| Component | Owns |
|---|---|
| `AdminTable` | The one table. Sorting, pagination, selection + bulk actions, `/` `n` `j` `k` `Enter` `x` shortcuts, and search/filter/sort/page persisted in **URL params** so a filtered list survives a drill-down. Pagination is client-side — the admin API has no paged endpoints. |
| `ConfirmDialog` | Every destructive confirmation. Takes `consequences` (the blast radius) and an optional `confirmPhrase` for type-to-confirm. **There is no `window.confirm` left in this package; do not reintroduce one.** |
| `PageHeader` | The page title block. Renders the page's single real `<h1>`. |
| `FormSection` | One decision area of a form — a card with a real `<h2>`. Long forms are built from these, not from one flat stack. |
| `StatusChip` | Status vocabulary. Distinguishes an *unrecognised* status from `inactive`, and never conveys state by colour alone. |

## Routes and pages

| Path | Page |
|---|---|
| `/dashboard` | `DashboardPage` |
| `/organization-types`, `/organization-types/new`, `/:id`, `/:id/edit` | `OrganizationTypesPage`, `CreateOrganizationTypePage`, `OrganizationTypeDetailsPage`, `EditOrganizationTypePage` |
| `/organizations`, `/organizations/new`, `/:id`, `/:id/edit` | `OrganizationsPage`, `CreateOrganizationPage`, `OrganizationDetailsPage`, `EditOrganizationPage` |
| `/organizations/:id/users/add` | `AddOrganizationAdminUserPage` |
| `/organizations/:id/roles/create` | `CreateOrganizationRolePage` |
| `/event-type-templates`, `/new`, `/:id/edit` | `EventTypeTemplatesPage`, `EditEventTypeTemplatePage` (one page for create and edit) |
| `/posts`, `/posts/new`, `/posts/:id`, `/posts/:id/edit` | `PostsPage`, `CreatePostPage`, `PostDetailsPage`, `EditPostPage` |
| `/sessions` | `SessionsPage` |
| `/audit`, `/audit/:id` | `AuditLogPage`, `AuditEventPage` |
| `/roles` | `RolesPage` |
| `/users` | `UsersPage` |
| — | `AccessDeniedPage` |

## What it configures

- **Tenants** — the top-level customer boundary.
- **Organisation types** — templates carrying a default capability set, `defaultLocale` (which seeds
  the org-admin UI language), and the **card handling fees** every organisation of the type
  inherits. The fee editor is `components/PaymentFeeEditor.tsx`; rates live in
  `organization_type_payment_fees`, with platform defaults on `payment_methods.default_fee_config`.
- **Organisation status** — `active` or `inactive`, and nothing else (a `CHECK` constraint enforces
  it). **Inactive closes the club to everyone**, including its own administrators, and is what
  replaced deleting an organisation: there is no delete action in this UI and the backend endpoint
  answers 409. See `docs/ORGANISATION_STATUS_AND_DEACTIVATION.md`.
- **Organisations** — name, contact details, the **member portal code** (`url_code`, the short code
  the account-user application uses), language, **enabled capabilities**, and which payment methods
  are available. Currency is **not** editable here: it is inherited from the organisation type and
  shown read-only, because the type's fixed handling fee is a cash amount in it. Optional address
  and contact fields are stored in the `organizations.settings` JSONB column rather than as
  dedicated columns.
- **Org-admin users and roles** — creates Keycloak users and grants org-admin roles, which is what
  makes a person able to sign in to `/orgadmin`.
- **Payment methods** — the catalogue an organisation may enable; the org admin then supplies
  credentials in its own Settings → Payments tab.
- **Platform share (Stripe Connect application fee)** — set on the organisation type as the default
  a *new* organisation starts with, and then per organisation in `EditOrganizationPage` →
  Platform share (`components/ApplicationFeeEditor.tsx`). Copy-on-create: editing the type never
  reaches organisations that already exist. This is the one fee that varies per organisation — the
  three handling-fee elements are type-level and inherited live. See
  `docs/ORGANISATION_APPLICATION_FEE.md`.

## Navigation

`components/Layout.tsx` is a persistent left rail carrying **all twelve** destinations, grouped
Platform / Configuration / Content / Oversight / Access, collapsing to a temporary `Drawer` below
`md`. It marks the
current section with `aria-current="page"` and keeps a section current inside its detail pages.

Adding a route means adding it to `routes/index.tsx` **and** to `NAV_GROUPS` in `Layout.tsx`. The
rail listed three of eight for a long time, which left Users and Roles reachable only by
typed URL — see `docs/PLATFORM_ADMIN_CRAFT_PASS.md`.

## Event type templates

The platform's definition of a discipline — its phases, what they run on, and the rules every club
starts from. A club's own `event_types` row is free text with no behaviour; a discipline that knows
how to schedule itself is defined once here. Task S0-5 of
docs/EVENT_SCHEDULING_TASKS_S0_S1.md; the API is `/api/admin/event-type-templates`.

`EditEventTypeTemplatePage` is one page for create and edit — the second is the first with an id, and
a create form that diverges is how the two come to disagree about what a template is. It hosts two
editors:

- **`TemplateShapeEditor`** — the part a club cannot override. Phases reorder with **arrows, not
  drag**, matching `PostsPage`'s decision rather than the wireframe's drawing. Removing a resource
  kind a phase still runs on is refused, with the tooltip naming the phases.
- **`TemplateSettingsEditor`** — the defaults, drawn by `describeSettings` from
  `@itsplainsailing/components`, the same helper the org-admin's Event rules tab uses. Settings are a
  flat map of dotted keys; the dots group them, the value's type picks the input, and
  `shape.settingLabels` supplies the wording.

Two rules the screen enforces and the server also enforces, because a screen is not a constraint:
the **key** may be corrected while the template is a draft and never after (a published key is what
saved schedules and results name), and **publishing** is its own act with its own confirmation,
refused while there are no phases.

## Organisation type logos

`TypeLogoSection` on the create and edit screens: upload, remove, and "Organisations may replace
this with their own logo". Unticking it warns that clubs' own logos stop being shown — the
consequence an operator is least likely to have thought through.

The logo is addressed by type id, so the **create** screen holds the file and uploads it straight
after saving; a failure there leaves a created type without a logo rather than failing the save.
See [docs/ORGANISATION_TYPE_LOGO.md](../../docs/ORGANISATION_TYPE_LOGO.md).

## Posts

Announcements shown to the whole platform on both login pages
([docs/PLATFORM_POSTS.md](../../docs/PLATFORM_POSTS.md)). `postApi.ts` is a separate client from
`organizationApi` because a post belongs to no organisation and every route is `super-admin`.

`PostsPage` is a plain ordered list, **not** `AdminTable` — here the order *is* the content, and a
table that can be re-sorted by title would show an arrangement that is not the one being edited.
Reordering is a pair of arrows per row (keyboard-reachable, no drag machinery) and saves the whole
arrangement on every move.

`PostForm` is shared by create and edit. The image is uploaded *after* the post exists, because the
upload route is addressed by post id — so a create whose image fails still created the post, says
so, and lands on the edit screen. This package gained `react-quill` and `dompurify` for it.

## Oversight — sessions and the audit trail

Two screens, one nav group, almost nothing shared.

**`SessionsPage`** reads through to Keycloak, which owns sessions, and keeps no state of its own —
a second copy would be wrong the moment somebody signed out. **Each row is a session, not a
person**, which is what makes "end this session" and "sign them out everywhere" different actions.
The confirmation says the person is signed out *within 5 minutes*, not now: ending the Keycloak
session stops the refresh, but an access token already issued stays valid for its remaining
lifetime.

**`AuditLogPage`** keeps its filters in the URL, so an investigation can be sent to somebody else.
Paging is keyset (`occurred_at|id`), because an offset would skip or repeat rows as new events
arrive underneath — constant, on an append-only log. It also carries the **health banner**: a failed
audit write is deliberately silent everywhere else (`record()` never throws), so this is the only
place a gap in the trail becomes visible.

**`AuditEventPage`** is the before/after table, which is the reason the trail exists. Values are
formatted for a reader — a fee is `€25.00`, not `2500` — with the raw record one click away.

Both viewers render changes through `AuditChanges` from `packages/components`, so a club reading its
own trail in the org-admin and a super admin reading the platform's never see two renderings of one
event. See [docs/AUDIT_TRAIL_AND_SESSIONS.md](../../docs/AUDIT_TRAIL_AND_SESSIONS.md).

## The capability handshake

Capabilities enabled here determine which modules and routes the org-admin shell renders and which
backend endpoints pass `requireCapability`. When a feature "doesn't appear" for an organisation,
this app is where it is switched on.

## Conventions

- API access goes through `services/*Api.ts` + `hooks/useApiCall`, not raw axios in pages.
- `NotificationContext` provides the snackbar/toast surface; errors are normalised in
  `utils/errorHandling.ts`.
- This app is **not** internationalised the way org-admin is — it does not use the shell's locale
  files. Locale, language and currency option lists come from `constants/localisation.ts`; do not
  declare a second list in a page.
- Destructive actions state their blast radius before they run, in the voice `PaymentFeeEditor`
  established ("affects **N organisations** … payments already taken are unaffected"). Anything
  that reaches beyond the record on screen uses `ConfirmDialog`'s `consequences`, and anything
  irreversible adds `confirmPhrase`.
- Forms validate every field at once, mark the offender with `error`/`helperText`, and move focus
  to it. Never a sequence of one-at-a-time toasts.
- Forms with unsaved work wrap their exits in `useUnsavedChanges`. There is no router-level blocker:
  `unstable_useBlocker` needs a data router and this app mounts a plain `BrowserRouter`.
- Row action icons carry a target-naming `aria-label` ("Delete Killarney Sailing Club"), never a
  bare `title`.

## Where to look for what

| Question | Start at |
|---|---|
| "How do I enable a capability for an org?" | `pages/EditOrganizationPage.tsx` |
| "Where is an organisation created?" | `pages/CreateOrganizationPage.tsx` → `/api/admin/organizations` |
| "How does someone become an org admin?" | `pages/AddOrganizationAdminUserPage.tsx` |
| "What do the Type chips in the user list mean?" | Super Admin / Org-admin / Account, derived by the backend — `docs/USER_CLASSIFICATIONS.md` |
| "What does an organisation type control?" | `pages/CreateOrganizationTypePage.tsx` |
| "Why does changing a type's application fee not affect its organisations?" | By design — copy-on-create. `components/ApplicationFeeEditor.tsx`, `docs/ORGANISATION_APPLICATION_FEE.md` |
| "How do I delete an organisation?" | You don't. Set its status to inactive — `docs/ORGANISATION_STATUS_AND_DEACTIVATION.md` |
| "Why can't I change a type's currency?" | `pages/EditOrganizationTypePage.tsx` — locked once organisations depend on the type, because the fixed handling fee is a cash amount in it |
| "Where do I add a column, sort or bulk action to a list?" | `components/AdminTable.tsx` |
| "Why is there no `window.confirm` anywhere?" | `components/ConfirmDialog.tsx` — it replaced all three |

## Known state

`docs/PLATFORM_ADMIN_CRAFT_PASS.md` records the design and hardening pass over this package, with
the critique snapshot it came from in `.impeccable/critique/`.

The Vitest suite carries **11 pre-existing failures** — `RoleForm.test.tsx` (6), 
`organization-type-locale.test.tsx` (4) and one downstream failure in `RolesPage.test.tsx`. They are
unrelated to recent work; see §3.3 of `CLAUDE.md` before treating a failure here as yours.
| "Where are card handling fees set?" | `components/PaymentFeeEditor.tsx` on the organisation type pages |
| "Why can't I change an organisation's currency?" | It is inherited from its type — see G12 in `docs/ACCOUNT_USER_APP_WIREFRAMES.md` |
