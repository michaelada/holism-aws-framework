# `packages/admin` — Super-admin UI

The platform operator's console. Creates and configures the tenants, organisations, organisation
types, roles and users that the org-admin app then operates within.

- **Dev:** `npm run dev:admin` → `http://localhost:5174`, `/api` proxied to `:3000`.
- **Tests:** Vitest — `npm run test:admin` (~23 test files).
- **Talks to** `/api/admin/*` on the backend.

## Layout

```
src/
  routes/index.tsx     Central route table (a conventional <Routes> block, not a module registry)
  pages/               All screens
  components/          Layout and shared admin widgets
  context/             AuthContext, ApiContext, NotificationContext
  hooks/useApiCall.ts  API wrapper (admin's own, not orgadmin-core's useApi)
  services/            adminApi, organizationApi, paymentMethodApi
  utils/errorHandling.ts
  theme/, types/
```

Unlike the org-admin shell, routes are declared centrally in `routes/index.tsx`; there is no module
registry and no capability filtering of navigation.

## Routes and pages

| Path | Page |
|---|---|
| `/dashboard` | `DashboardPage` |
| `/tenants`, `/tenants/:id` | `TenantsPage`, `TenantDetailsPage` |
| `/organization-types`, `/organization-types/new`, `/:id`, `/:id/edit` | `OrganizationTypesPage`, `CreateOrganizationTypePage`, `OrganizationTypeDetailsPage`, `EditOrganizationTypePage` |
| `/organizations`, `/organizations/new`, `/:id`, `/:id/edit` | `OrganizationsPage`, `CreateOrganizationPage`, `OrganizationDetailsPage`, `EditOrganizationPage` |
| `/organizations/:id/users/add` | `AddOrganizationAdminUserPage` |
| `/organizations/:id/roles/create` | `CreateOrganizationRolePage` |
| `/roles` | `RolesPage` |
| `/users` | `UsersPage` |
| — | `AccessDeniedPage` |

## What it configures

- **Tenants** — the top-level customer boundary.
- **Organisation types** — templates carrying a default capability set, `defaultLocale` (which seeds
  the org-admin UI language), and the **card handling fees** every organisation of the type
  inherits. The fee editor is `components/PaymentFeeEditor.tsx`; rates live in
  `organization_type_payment_fees`, with platform defaults on `payment_methods.default_fee_config`.
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

## The capability handshake

Capabilities enabled here determine which modules and routes the org-admin shell renders and which
backend endpoints pass `requireCapability`. When a feature "doesn't appear" for an organisation,
this app is where it is switched on.

## Conventions

- API access goes through `services/*Api.ts` + `hooks/useApiCall`, not raw axios in pages.
- `NotificationContext` provides the snackbar/toast surface; errors are normalised in
  `utils/errorHandling.ts`.
- This app is **not** internationalised the way org-admin is — it does not use the shell's locale
  files.

## Where to look for what

| Question | Start at |
|---|---|
| "How do I enable a capability for an org?" | `pages/EditOrganizationPage.tsx` |
| "Where is an organisation created?" | `pages/CreateOrganizationPage.tsx` → `/api/admin/organizations` |
| "How does someone become an org admin?" | `pages/AddOrganizationAdminUserPage.tsx` |
| "What does an organisation type control?" | `pages/CreateOrganizationTypePage.tsx` |
| "Where are card handling fees set?" | `components/PaymentFeeEditor.tsx` on the organisation type pages |
| "Why can't I change an organisation's currency?" | It is inherited from its type — see G12 in `docs/ACCOUNT_USER_APP_WIREFRAMES.md` |
