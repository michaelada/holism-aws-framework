# Users — `packages/orgadmin-core/src/users`

Manages the two kinds of people attached to an organisation: **org-admin users** who log into this
console, and **account users** who are the organisation's own end users. Roles are assigned here.

Part of `orgadmin-core`, always available.

## Routes (`users/index.ts` → `usersModule`)

| Path | Page |
|---|---|
| `users` | `OrgAdminUsersListPage` (the landing view) |
| `users/admins` | `OrgAdminUsersListPage` |
| `users/admins/invite` | `InviteAdminUserPage` |
| `users/accounts` | `AccountUsersListPage` |
| `users/accounts/create` | `CreateAccountUserPage` |
| `users/groups` | `UserGroupsPage` |
| `users/:type/:id` | `UserDetailsPage` |

`UserDetailsPage` is shared: `:type` selects whether it is showing an admin or an account user.

## The two user kinds

| | Org-admin user | Account user |
|---|---|---|
| Purpose | Runs the organisation from `/orgadmin` | Member/customer of the organisation |
| Created by | Invitation (email) | Created directly |
| Roles | `organization_admin_roles` | `organization_user_roles` |
| Identity | Keycloak account | Keycloak account |

Both are rows in `organization_users`, distinguished by `user_type` — the same column the backend
uses to resolve which organisation a caller administers.

## Invitations

`InviteAdminUserPage` and `InviteUserDialog` send an invitation rather than setting a password.
Re-sending is supported: `POST /api/orgadmin/users/admins/:id/resend-invite`. The invite flow goes
through Keycloak on the backend (`keycloak-admin.service`), so failures there surface as Keycloak
errors handled by `keycloak-error-handler`.

## API endpoints

| Endpoint | Use |
|---|---|
| `GET /api/orgadmin/users/admins/:organisationId` | Org-admin users |
| `PUT /api/orgadmin/users/admins/:id/roles` | Assign admin roles |
| `POST /api/orgadmin/users/admins/:id/resend-invite` | Re-send invitation |
| `GET`/`POST /api/orgadmin/users/accounts` | Account users |
| `GET /api/orgadmin/users/accounts/:id` | Account user detail |
| `GET /api/orgadmin/users/roles/:organisationId` | Roles available to the organisation |
| `GET /api/orgadmin/roles` | Role catalogue |
| `GET`/`POST /api/orgadmin/user-groups` | Account-user groups |
| `PUT`/`DELETE /api/orgadmin/user-groups/:id` | Rename or delete a group |
| `GET`/`POST /api/orgadmin/user-groups/:id/members` | Who is in a group; add people |
| `DELETE /api/orgadmin/user-groups/:id/members/:userId` | Remove someone |

Backend: `user-management.routes` → `org-admin-user.service`, `account-user.service`,
`organization-user.service`, `organization-admin-role.service`, `role.service`,
`keycloak-admin.service`.

## Testing these pages

All four suites pass. They render through `src/test/renderWithProviders.tsx`, which supplies the
router and `OrganisationProvider` — rendering a page bare throws
"useOrganisation must be used within an OrganisationProvider", which is how most of this package's
suites still fail.

The pages also read `useOnboarding`, `usePageHelp` and `useTranslation` from
`@aws-web-framework/orgadmin-shell`. Those are **mocked at module level** rather than provided, which
avoids standing up the shell's providers in a unit test. Two things matter in that mock:

- Return **stable references** (`vi.hoisted`). `useOnboarding` feeds a `useEffect` dependency array,
  so a fresh object per render re-triggers the effect forever (§3.4).
- `t()` returns the key, because there is no i18next instance. Assertions match keys, not English.

Three classes of stale assertion were fixed alongside: URLs missing the organisation id
(`/users/admins` → `/users/admins/:organisationId`), responses read as bare arrays when the pages
read `response.data`, and tests still expecting the dialogs these pages replaced with routes
(`docs/DIALOG_TO_PAGES_MIGRATION.md`).

## Internationalisation

The whole area is translated. It was not until August 2026 — the pages hard-coded English, in breach
of §3.2 — so `users.*` in `orgadmin-shell/src/locales/<locale>/translation.json` is new and complete
across all six locales.

Two things worth knowing when adding a string here:

- Reuse `common.actions.*` for verbs (save, cancel, delete, edit, back, add). Only user-specific
  wording belongs under `users.*`.
- The test environment has no i18next instance, so `t('users.title')` returns the **key**. Assertions
  in these suites match keys, not English — the convention noted in §3.4.

## User groups

Named groups of **account users**, managed at `users/groups`. The only consumer is discount
eligibility: a discount can be restricted to members of selected groups, enforced by
`discount-validator.service` against `user_group_members`.

Two behaviours worth knowing:

- Adding someone who is not an active account user of the organisation **fails the whole call**
  rather than skipping them, so a mistake surfaces instead of producing a group that quietly omits
  people.
- Deleting a group does **not** rewrite discounts that name it. The response reports how many still
  do, and the page says so — silently editing someone's discount rules as a side effect would be
  worse than telling them.

## Relationship to the super-admin app

The **first** org-admin for an organisation is created in the super-admin app
(`AddOrganizationAdminUserPage` — see [admin.md](admin.md)); thereafter org admins invite each
other from here. If nobody can sign in to an organisation, that is where to bootstrap it, and
`scripts/check-orgadmin-user.sql` is the diagnostic.

## Where to look for what

| Question | Start at |
|---|---|
| "Why can't this person sign in to /orgadmin?" | `organization_users.user_type` / `status`, plus their Keycloak account |
| "How are roles granted?" | `PUT /users/admins/:id/roles` → `organization-admin-role.service` |
| "Where is the invite email sent?" | Backend `keycloak-admin.service` (+ `email.service`) |
| "What's the difference between the two lists?" | `user_type` — admins vs account users |
| "How do I restrict a discount to certain members?" | Create a group here, then pick it in the discount's eligibility criteria |
| "How is the very first admin created?" | The super-admin app — see [admin.md](admin.md) |

## Registrations (I3)

`RegistrationsPage.tsx`, route `/users/registrations` — the approval queue for clubs with
auto-registration off. Three tabs (pending / active / rejected) over
`GET /api/orgadmin/organisation/registrations?status=`, decisions via
`POST /api/orgadmin/organisation/registrations/:id/decision` with `{ decision, note? }`.

Things that are deliberate, not incidental:

- **Refusals stay listed.** A refusal is not a delete; the row is what answers "I registered last
  week and still cannot sign in".
- **Both decisions are confirmed**, and the note is recorded for the club only — the member is never
  told why they were refused (A8), so the dialog says so under the field.
- **`users/registrations` is declared before `users/:type/:id`** in `src/users/index.ts`, or it is
  read as a user-detail page for the id "registrations".
- The empty state is suppressed when the load failed, so a broken request cannot make a queue of real
  people look empty.

Settings for it live in [core-settings.md](core-settings.md). Full record:
[docs/REGISTRATION_APPROVAL_ORGADMIN.md](../../docs/REGISTRATION_APPROVAL_ORGADMIN.md).

## The automatic "Full Administrator" role

Creating an organisation provisions a `full-administrator` role with `admin` on **every active
capability** — not just the organisation's enabled ones. Access needs both the organisation's
capability and the role's permission, so the extra grants cost nothing now and keep the role
genuinely full when a capability is enabled later.

Idempotent via a unique `(organization_id, name)` key and `ON CONFLICT DO NOTHING`; `DO NOTHING`
rather than `DO UPDATE` so a club that has edited the role does not have it silently reset. Unlike
the payment-method setup beside it, a failure is **not** swallowed — an organisation with no admin
role cannot have anyone granted access, and a silent failure looks fine until someone tries to
invite an administrator.

Note that `createDefaultRoles()` in the same service is **not** this path and remains unused. Full
record: [docs/DEFAULT_ORGANISATION_ROLE.md](../../docs/DEFAULT_ORGANISATION_ROLE.md).
