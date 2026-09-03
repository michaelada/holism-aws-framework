# Architecture — cross-cutting concepts

Read this before any other summary. It explains the vocabulary the rest use.

## What the product is

A multi-tenant SaaS platform for membership organisations (sailing clubs and similar — the
org-admin UI brands itself "ItsPlainSailing"). Organisations run events, memberships, merchandise
sales, facility bookings, registrations and ticketing, configured from a super-admin console and
operated from an organisation-admin console.

## Monorepo layout

npm workspaces, one package per deployable or shared library:

```
packages/
  backend                 Express + TypeScript API (the only server)
  components              Shared React component library
  frontend                Metadata-repository UI            :5173
  admin                   Super-admin UI                    :5174
  orgadmin-shell          Org-admin host application        :5175
  orgadmin-core           Always-on org-admin features (library)
  orgadmin-events         }
  orgadmin-memberships    }
  orgadmin-merchandise    } capability modules (libraries,
  orgadmin-calendar       } lazy-loaded by the shell)
  orgadmin-registrations  }
  orgadmin-ticketing      }
  orgadmin-announcements  }
docs/                     Feature documentation and wireframes
infrastructure/           nginx, Keycloak, Prometheus, Grafana, init-db.sql
terraform/                AWS infrastructure (staging, production)
scripts/                  Test-data generation, i18n helpers, deployment verification
__tests__/                Repo-level structure and CI/CD tests (Jest)
```

Root scripts follow a fixed shape: `dev:<pkg>`, `build:<pkg>`, `test:<pkg>`, plus `build:all`,
`docker:up`, `docker:down`, `docker:logs`.

## The two tiers of identity

1. **Organisation** — the customer boundary (`organizations`), classified by its **organisation
   type**, which fixes its currency, locale, default capabilities and fee rates. Almost every
   business table is scoped by `organization_id`.
2. **User** — a Keycloak identity. Membership of an organisation lives in `organization_users`,
   with `user_type` distinguishing `org-admin` from account users, and roles in
   `organization_user_roles` / `organization_admin_roles`.

Backend code resolves the caller's organisation from the Keycloak user id rather than trusting a
client-supplied id. The canonical pattern:

```sql
SELECT organization_id FROM organization_users
WHERE keycloak_user_id = $1 AND user_type = 'org-admin' AND status = 'active'
```

## The two front-end audiences

| | Org admin | Account user |
|---|---|---|
| App | `orgadmin-shell` at `/orgadmin` | `account-shell` at `/account` — a PWA, works offline |
| API | `/api/orgadmin/*` | `/api/account/*`, plus unauthenticated `/api/public/*` |
| Organisation | One, resolved from the token | Possibly several; the one in the URL (`/account/:orgCode`) |
| Resolver | `loadOrganisationCapabilities()` | `resolveAccountOrganisation()` |
| `user_type` | `'org-admin'` | `'account-user'` |

An account user fails the org-admin lookup by design, so none of `/api/orgadmin/*` is reusable for
them. See `docs/ACCOUNT_USER_APP_WIREFRAMES.md` for the design and
`.claude/modules/account-shell.md` for what is built.

## Authentication

Keycloak (realm `aws-framework`) issues JWTs; the backend validates them in
`authenticateToken()` and populates `req.user`. Front ends obtain a token via
`orgadmin-shell`'s `useAuth`, which publishes a getter through `AuthTokenContext`; `useApi` in
`orgadmin-core` injects it into every request. There is a `DISABLE_AUTH` escape hatch in the Docker
compose file, commented out by default.

## Organisation status

`organizations.status` is `active` or `inactive`, constrained in the database. **Inactive means
closed to everyone**: members lose the directory listing, the `/account/:urlCode` route and their
session, and org admins are refused at sign-in *and* on every subsequent request
(`orgadmin-auth.routes.ts`, `capability.middleware.ts`, `orgadmin-role.middleware.ts` all check
`o.status`). Organisations are never deleted; deactivating is the supported way to close one, and
`DELETE /api/admin/organizations/:id` answers 409. See
`docs/ORGANISATION_STATUS_AND_DEACTIVATION.md`.

## The capability model

Capabilities are feature flags stored per organisation (`enabled_capabilities`), seeded and amended
by migrations. They gate three things simultaneously and must stay in step:

- **Backend** — `requireCapability` / `requireAllCapabilities` / `requireOrgAdminCapability`
  middleware, with `loadOrganisationCapabilities` populating the request.
- **Module availability** — `orgadmin-shell/src/App.tsx` filters `ALL_MODULES` by the
  organisation's capabilities before registering routes.
- **Route and menu visibility** — individual routes and menu items inside a module carry their own
  `capability`, so a module can be present with parts of it hidden.

Capabilities currently seeded:

```
additional-feature          calendar-bookings       calendar-discounts
discounts                   document-management     document-uploads
email-notifications         entry-discounts         entry-restrictions
event-document-management   event-management        event-ticketing
event-types                 membership-discounts    membership-document-management
memberships                 merchandise             merchandise-discounts
multi-area-discounts        org-announcements       organisation-level-members
payment-processing          pcuk-integration
public-search               registration-discounts  registration-document-management
registrations               reporting               sms-notifications
venues
```

Adding a capability means: a migration, backend middleware on the relevant routes, a `capability`
on the module/route registration, and translations for any new UI.

## Module registration

Every capability module default-exports a `ModuleRegistration` from its `src/index.ts`
(type in `orgadmin-core/src/types/module.types.ts`):

```ts
{ id, name, title, description, capability?, card, routes[], menuItem?, subMenuItems?, order? }
```

`routes[]` entries hold a path and a `React.lazy` component, each optionally capability-gated. The
shell composes these into a single `<Routes>` under the `/orgadmin` basename. **Adding a page means
adding a route to the module registration** — there is no central route table.

## API conventions

- Everything is under `/api`. Super-admin endpoints live under `/api/admin/*`, organisation-admin
  endpoints under `/api/orgadmin/*`.
- Each route file pairs with a service; routes handle HTTP and validation, services own SQL and
  business logic.
- Routes are annotated with `@openapi` JSDoc and served at `/api-docs`.
- Responses are plain JSON; errors are `{ error: string }` with a conventional status code.

## Organisation identity and money

- `organizations.url_code` is a unique, URL-friendly short code (`khpc`). The account-user
  application addresses an organisation by it, so it competes for namespace with that application's
  own routes and cannot be a reserved word. Rules in `backend/src/utils/url-code.ts`.
- `organizations.currency` always equals its organisation type's currency. Card handling fees are
  configured by the super admin **per organisation type, per card payment method** — a fixed amount,
  a percentage, and a tax percentage — and the fixed amount is a cash value in that currency, so the
  two cannot diverge. Rates live in `organization_type_payment_fees`; the arithmetic lives in
  `backend/src/utils/handling-fee.ts` and nowhere else.

## Organisation settings

`organizations.settings` is a JSONB column shared by several unrelated feature areas (address and
contact details, payment settings, branding). Updates **merge** rather than replace:

```sql
settings = COALESCE(settings, '{}'::jsonb) || $n::jsonb
```

Replacing it wholesale silently destroys another feature's configuration.

## Internationalisation

- Six locales: `en-GB`, `de-DE`, `es-ES`, `fr-FR`, `it-IT`, `pt-PT`.
- All org-admin translations live in `orgadmin-shell/src/locales/<locale>/translation.json`, even
  for strings rendered by capability modules.
- The active locale comes from the organisation's `language`, falling back to its organisation
  type's `defaultLocale`, then `en-GB`. i18n is initialised before the app renders.
- Components consume `useTranslation` / `useLocale` / `formatCurrency` / `formatDate` re-exported
  from `@aws-web-framework/orgadmin-shell`.

## Cross-cutting feature patterns

- **Discounts** — a shared subsystem. Each domain module has its own discount pages plus a
  domain-specific capability (`entry-discounts`, `membership-discounts`, `merchandise-discounts`,
  `calendar-discounts`, `registration-discounts`), backed by shared backend services
  (`discount.service`, `discount-calculator.service`, `discount-validator.service`) and the shared
  `DiscountSelector` component.
- **Application forms** — organisations build forms in the Forms area of `orgadmin-core`; other
  modules reference a form by id (for example every event activity must select one). Submissions
  land in `form_submissions`.
- **Payments** — payment methods are enabled per organisation by the super admin; the org admin
  configures credentials (Stripe, Helix-Pay) in Settings → Payments.
- **Metadata repository** — `object_definitions` / `object_fields` / `field_definitions` drive the
  generic CRUD API and the metadata-driven components.

## Build and test tooling

| Concern | Backend | Front ends |
|---|---|---|
| Language | TypeScript (`tsc` build) | TypeScript + Vite |
| Dev runner | `tsx watch` | `vite` |
| Tests | Jest | Vitest + Testing Library |
| Lint | ESLint | ESLint |

Capability modules build as ES-module libraries via `packages/vite.config.shared.ts`, which
externalises React, MUI, `date-fns`, `axios` and friends and preserves module structure for
tree-shaking. The shell **dedupes** `react`, `react-dom`, `@mui/material`, `@mui/x-date-pickers` and
`date-fns` — duplicate instances break React context (this is why date pickers once rendered blank).

## Dev proxies target `127.0.0.1:3000`, not `localhost:3000`

Every front end proxies `/api` to the backend. The target names the IPv4 address deliberately: on
macOS `localhost` resolves to `::1` first, so any **other** project's dev server holding
`[::1]:3000` answers the proxy instead of the backend, returning its own `index.html` with a 200 for
every API call. The app then parses HTML as JSON, and the first property access blanks the screen.

That failure is silent in the worst way — a 200 means `catch` blocks never fire — so the account app
also **validates the shape** of `/me` and the organisations list before trusting them, falling back
to its existing `unavailable` and "could not load" screens instead of crashing.
