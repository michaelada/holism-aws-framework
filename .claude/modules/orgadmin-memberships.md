# `packages/orgadmin-memberships` — Memberships capability module

Membership types, the member database, joining and renewal, and membership discounts.

- **Capability:** `memberships`. Discount pages gate on `membership-discounts`.
- **Tests:** Vitest — `npm run test:orgadmin-memberships` (~52 test files, the best-covered
  capability module).

## Routes (`src/index.ts`)

| Path | Page | Capability |
|---|---|---|
| `members` | `MembersDatabasePage` | — |
| `members/create` | `CreateMemberPage` | — |
| `members/:id` | `MemberDetailsPage` | — |
| `members/:id/edit` | `EditMemberPage` | — |
| `members/types` | `MembershipTypesListPage` | — |
| `members/types/new/single` | `CreateSingleMembershipTypePage` | — |
| `members/types/new/group` | `CreateGroupMembershipTypePage` | — |
| `members/types/:id` | `MembershipTypeDetailsPage` | — |
| `members/types/:id/edit` | `CreateSingleMembershipTypePage` (edit mode) | — |
| `members/discounts` | `DiscountsListPage` | `membership-discounts` |
| `members/discounts/new` | `CreateDiscountPage` | `membership-discounts` |
| `members/discounts/:id/edit` | `EditDiscountPage` | `membership-discounts` |

## Layout

```
src/
  index.ts        membershipsModule registration
  pages/          The pages above
  components/
    MembershipTypeForm            Shared by single and group creation/editing
    PersonConfigurationSection    Which person fields a type captures
    FieldConfigurationTable       Per-field configuration grid
    MembershipTypeSelector        Type picker used when creating a member
    CreateCustomFilterDialog      Saved filters over the member database
    BatchOperationsDialog         Bulk actions on selected members
  types/          membership.types, module.types, index
```

## Concepts

- **Single vs group membership types** — separate creation pages over the same
  `MembershipTypeForm`; group types configure multiple people per membership, which is what
  `PersonConfigurationSection` and `FieldConfigurationTable` drive.
- **Member database** — `MembersDatabasePage` is a filterable, batch-operable grid. **Custom
  filters** are saved questions over the roster (status, labels, renewal and validity bounds),
  stored in `member_filters` and shared across every administrator of the club — `user_id` records
  who saved one, not who may see it. They are applied in the browser over the members already
  loaded; an empty clause narrows nothing, so a half-filled filter shows everybody rather than
  nobody. Until August 2026 the whole feature was three stubs — a dialog that discarded its payload,
  no create endpoint, and a list endpoint returning a hard-coded `[]` — so the dropdown was empty
  for every club. See [docs/MEMBER_CUSTOM_FILTERS.md](../../docs/MEMBER_CUSTOM_FILTERS.md).
- **Membership numbers** — generated and validated server-side
  (`membership-number-generator.service`, `membership-number-validator.service`), configured by the
  membership-numbering migration.
- **Application forms** — membership types reference forms built in the `orgadmin-core` Forms area.

## Data it touches

`/api/orgadmin/members`, `/api/orgadmin/membership-types`, member filters, discounts for
memberships, application forms. Backend: `membership.service`, `membership-number-*.service`,
`discount*.service`, `member-filter.service`, `form-submission.service`. Tables: `members`,
`membership_types`, `member_filters`.

## Where to look for what

| Question | Start at |
|---|---|
| "How is a membership type configured?" | `components/MembershipTypeForm.tsx` |
| "Where do group-membership person rules live?" | `components/PersonConfigurationSection.tsx` |
| "How do bulk member actions work?" | `components/BatchOperationsDialog.tsx` |
| "How are membership numbers allocated?" | Backend `membership-number-generator.service` |

## Deleting a membership type withdraws it

`deleteMembershipType` is a **soft delete** — see [docs/SOFT_DELETE.md](../../docs/SOFT_DELETE.md).
`members` reference these rows: a type an organisation retires is still the type last season's
members hold. Lists, get-by-id, the account catalogue and renewal eligibility filter
`deleted = FALSE`; the reporting aggregate deliberately does not, so historical members and revenue
still count.
