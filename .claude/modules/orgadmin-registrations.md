# `packages/orgadmin-registrations` — Registrations capability module

Registration types (courses, programmes, schemes) and the register of people signed up to them.
Structurally the closest sibling to `orgadmin-memberships`.

- **Capability:** `registrations`. Discount pages gate on `registration-discounts`.
- **Tests:** Vitest — `npm run test:orgadmin-registrations` (~29 test files).
- **Module registration** lives in `src/module.config.ts`, re-exported from `src/index.ts` — unlike
  the other capability modules, which declare it inline in `index.ts`.

## Routes (`src/module.config.ts`)

| Path | Page | Capability |
|---|---|---|
| `registrations` | `RegistrationsDatabasePage` | — |
| `registrations/create` | `CreateRegistrationPage` | — |
| `registrations/:id` | `RegistrationDetailsPage` | — |
| `registrations/types` | `RegistrationTypesListPage` | — |
| `registrations/types/new` | `CreateRegistrationTypePage` | — |
| `registrations/types/:id` | `RegistrationTypeDetailsPage` | — |
| `registrations/types/:id/edit` | `CreateRegistrationTypePage` (edit mode) | — |
| `registrations/discounts` | `DiscountsListPage` | `registration-discounts` |
| `registrations/discounts/new` | `CreateDiscountPage` | `registration-discounts` |
| `registrations/discounts/:id/edit` | `EditDiscountPage` | `registration-discounts` |

## Layout

```
src/
  module.config.ts   registrationsModule registration (routes, menu, card)
  index.ts           Re-exports the module and the public components
  pages/             The pages above
  components/
    RegistrationTypeForm        Definition of a registration type
    CreateCustomFilterDialog    Saved filters over the registrations database
    BatchOperationsDialog       Bulk actions on selected registrations
  types/             registration.types, module.types
```

## Concepts

- **Registration type** — what someone can register for: fields captured (via an application form),
  fees, payment methods, discounts.
- **Registrations database** — filterable grid with saved filters (`registration_filters`) and
  batch operations, mirroring the member database.
- **Discounts** — the same shared discount subsystem, gated on `registration-discounts`.

## Data it touches

`/api/orgadmin/registrations`, `/api/orgadmin/registration-types`, registration filters, discounts
for registrations, application forms. Backend: `registration.service`, `discount*.service`,
`form-submission.service`. Tables: `registrations`, `registration_types`, `registration_filters`.

## Where to look for what

| Question | Start at |
|---|---|
| "Where are this module's routes?" | `src/module.config.ts` (not `index.ts`) |
| "How is a registration type configured?" | `components/RegistrationTypeForm.tsx` |
| "How do saved filters work?" | `components/CreateCustomFilterDialog.tsx` |

## Deleting a registration type withdraws it

`deleteRegistrationType` is a **soft delete** — see [docs/SOFT_DELETE.md](../../docs/SOFT_DELETE.md).
`registrations` reference these rows, so a withdrawn type must still name what somebody registered
for. Lists and get-by-id filter `deleted = FALSE`.
