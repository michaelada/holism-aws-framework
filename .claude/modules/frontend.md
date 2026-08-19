# `packages/frontend` — Metadata repository UI

The smallest front end (~29 source files). A working UI over the metadata repository: define field
types, define object types from those fields, and create/edit instances of them.

- **Dev:** `npm run dev:frontend` → `http://localhost:5173`, `/api` proxied to `:3000`.
- **Tests:** Vitest — `npm run test:frontend` (~3 test files; coverage thresholds are configured at
  80% but the suite is small).
- **Talks to** `/api/metadata` and `/api/objects` on the backend.

## Layout

```
src/
  routes/index.tsx   Central route table
  pages/             HomePage, FieldDefinitionsPage, CreateEditFieldPage,
                     ObjectDefinitionsPage, CreateEditObjectPage,
                     ObjectInstancesPage, EditInstancePage, NotFoundPage
  components/        Layout, ProtectedRoute, ErrorBoundary
  context/           AuthContext, ApiContext, NotificationContext
  api/               client, metadata.api, instances.api
  theme/                 MUI theme — `warmTheme`, copied from `admin`; was neumorphic until 18 Aug 2026
```

## Routes

| Path | Page |
|---|---|
| `/` | `HomePage` |
| `/fields`, `/fields/new`, `/fields/:fieldShortName/edit` | `FieldDefinitionsPage`, `CreateEditFieldPage` |
| `/objects`, `/objects/new`, `/objects/:objectShortName/edit` | `ObjectDefinitionsPage`, `CreateEditObjectPage` |
| `/objects/:objectType/instances` | `ObjectInstancesPage` |
| `/objects/:objectType/instances/new`, `/:instanceId/edit` | `EditInstancePage` |
| `/404`, `*` | `NotFoundPage` |

Note the URL parameters are **short names**, not ids.

## Why it matters beyond itself

It is the reference consumer of `packages/components`: the metadata-driven `MetadataForm`,
`MetadataTable` and `FieldRenderer` family are exercised here in their plainest form. When changing
those components, this app is the quickest place to see the effect without org-admin's auth,
capability and i18n layers in the way.

Its data — `field_definitions`, `object_definitions`, `object_fields` and instances — is the same
metadata that backs the generic CRUD API (`/api/objects`) used elsewhere.

## Conventions

- API access through `api/metadata.api.ts` and `api/instances.api.ts`, not raw axios in pages.
- `ProtectedRoute` + `AuthContext` guard the routes; `ErrorBoundary` wraps the tree.
- Not internationalised — it does not use the org-admin locale files.

## Where to look for what

| Question | Start at |
|---|---|
| "What can a field definition contain?" | `pages/CreateEditFieldPage.tsx` + `metadata.types.ts` in `packages/components` |
| "How are instances loaded and saved?" | `api/instances.api.ts` |
| "Where is the generic CRUD API served?" | Backend `routes/generic-crud.routes.ts` + `generic-crud.service.ts` |
