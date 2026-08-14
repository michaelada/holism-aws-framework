# Retiring tenants

The platform's top tier is the **organisation type**. The `tenants` table, the
`/api/admin/tenants` endpoints, the Tenants pages in the super-admin console and
`users.tenant_id` have all been removed.

## What a tenant actually was

`.claude/modules/architecture.md` described a three-tier model — tenant, organisation, user —
with the tenant as "the top-level customer boundary". The schema never implemented it:

- `organizations` has no `tenant_id` and never did. An organisation belongs to an **organisation
  type**, and that is what fixes its currency, locale, default capabilities and fee rates.
- The only foreign key pointing at `tenants` in the whole database was `users.tenant_id`.
- Nothing in the org-admin application, the account-user application, checkout, the capability
  model or events ever read a tenant.

Creating one inserted a row, made a Keycloak group, and changed nothing else.

A concept that exists in the documentation, the menu and one nullable column — but in no
behaviour — is worse than no concept at all: it invites people to model against a boundary that
does not enforce anything.

## What changed

### Database — `migrations/1709000000023_retire-tenants.js`

| Before | After |
|---|---|
| `tenants` table | dropped |
| `users.tenant_id` (FK → `tenants`, `ON DELETE SET NULL`) | `users.organization_id` (FK → `organizations`, `ON DELETE SET NULL`), indexed |

`users` is the platform-level registry the super admin maintains, distinct from
`organization_users` where every real org-admin and member lives. Its rows were optionally scoped
to a tenant; they are now optionally scoped to an **organisation**, the boundary the rest of the
platform actually uses.

`ON DELETE SET NULL` rather than `CASCADE`: a platform user record outliving its organisation is a
loose end to tidy, not a reason to delete a person.

**No data was carried across.** A tenant was never linked to an organisation, so there is no
mapping to derive one from — anything other than `NULL` would be a guess. The `down` migration
recreates the table and the column, but the tenants themselves are not recoverable, because
nothing ever recorded which organisation a given tenant corresponded to. This is safe precisely
because nothing consumed the value.

### Backend

- `src/services/tenant.service.ts` and its two test suites — deleted.
- The five `/api/admin/tenants` CRUD endpoints in `src/routes/admin.routes.ts` — removed. That
  router now serves users and roles only; organisations are served by `organization.routes.ts`.
- `src/services/user.service.ts` — `tenantId` became `organizationId` throughout. The group
  resolution now lives in `resolveOrganizationIds` and walks the organisation hierarchy: an
  organisation's group tree is `<org-type>/<org>/{admins,members}`, so a member's group is a
  *child* of the organisation's. Matching on the organisation's own group id alone finds nothing
  for anyone actually placed in `admins` or `members`, so the parent path is checked too.

  `getUsers` draws the platform user list from Keycloak and then enriches each person from the
  `users` table. Anyone with no `users` row used to come back with `roles: []` and
  `organizations: []` hardcoded — which is nearly everyone, since `users` is the super admin's own
  registry rather than the record of who belongs where, so the Organisation column showed `-` for
  the whole list. Both are now resolved from Keycloak in that branch as well.

### Super-admin UI (`packages/admin`)

- `TenantsPage`, `TenantDetailsPage`, `TenantForm`, `TenantList` and their tests — deleted.
- The `/tenants` routes and the Tenants nav entry — removed. `Layout.test.tsx` carries a
  regression test asserting the entry does not come back.
- The tenant types and the tenant CRUD methods on `AdminApiService` — removed.
- `UserList` shows an **Organisation** column and filters by organisation; `UserForm` assigns a
  user to an organisation. Both read `Organization` from `types/organization.types.ts` and load
  the list through `services/organizationApi.ts`.

### Tests

The tenant CRUD suites were deleted rather than renamed. Where a suite tested tenant CRUD through
`admin.routes`, that block is gone — `admin.routes.ts` has no organisation endpoints, so pointing
those cases at `/api/admin/organizations` would have tested a different router against a contract
it does not accept. Flows that merely need a user to belong to an organisation now seed the
organisation (and its type) straight into the database.
