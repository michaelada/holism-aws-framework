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
| `members/discounts/:id/stats` | `DiscountUsagePage` (from `orgadmin-events`) | `membership-discounts` |  <!-- where the list's View Usage icon goes; see docs/DISCOUNT_USAGE_PAGE.md -->

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

`/api/orgadmin/members`, `POST /api/orgadmin/organisations/:id/members/export` (the workbook),
`/api/orgadmin/membership-types`, member filters, discounts for memberships, application forms.
Backend: `membership.service` (including `exportMembersToExcel`), `membership-number-*.service`,
`discount*.service`, `member-filter.service`, `form-submission.service`. Tables: `members`,
`membership_types`, `member_filters`.

## Where to look for what

| Question | Start at |
|---|---|
| "How is a membership type configured?" | `components/MembershipTypeForm.tsx` |
| "Where do group-membership person rules live?" | `components/PersonConfigurationSection.tsx` |
| "How do bulk member actions work?" | `components/BatchOperationsDialog.tsx` |
| "How are membership numbers allocated?" | Backend `membership-number-generator.service` |
| "Why would a screen in this module show a raw i18n key?" | The key is missing from `orgadmin-shell`'s catalogue and the module's suites cannot see it: they mock `t()` as the identity function, so a page asking for a key nobody wrote renders the key and every assertion still passes. `src/__tests__/i18n-key-coverage.test.ts` closes that by reading the module's own sources and checking each key it renders against the real catalogue — it fails naming the key and the file. See [MEMBER_EDIT_HEADING_SHOWED_ITS_KEY.md](../../docs/MEMBER_EDIT_HEADING_SHOWED_ITS_KEY.md) |
| "How do I open a member?" | The **name is a link**, as well as the View button pinned to the right of the table. The button was the only way in, and reaching it meant scrolling a wide table sideways past the name you were already pointing at. Both work; the phone's card layout already spelled its actions out and is untouched. See [MEMBERS_EXPORT_AND_NAME_LINK.md](../../docs/MEMBERS_EXPORT_AND_NAME_LINK.md) |
| "What does Export to Excel export?" | **What is on screen** — the ids the filtered table is showing, sent to `POST /organisations/:id/members/export`. The list is filtered in the browser (status tabs, search, saved filter), so re-deriving those rules on the server would be a second implementation of each; sending the ids means the workbook is the table by construction. It was a `console.log` stub until [MEMBERS_EXPORT_AND_NAME_LINK.md](../../docs/MEMBERS_EXPORT_AND_NAME_LINK.md) |
| "Why does the export have several sheets?" | **One per membership type**, each with a column for **every field of that type's form** plus a row per member's answers. The columns belong to the form, and two types may ask entirely different questions — one flat table could only hold the union, giving every member blanks under questions their own application never asked. Same principle as the entries export's sheet-per-activity. Per type rather than per form, because a type is what a club recognises; grouped by **id**, because two types can share a name |
| "Why are the export's dates strings rather than dates?" | `date_last_renewed` and `valid_until` are Postgres `date` columns, and node-postgres returns a `date` as a Date at **local midnight** — 12 July in Ireland is `2026-07-11T23:00Z`, which Excel displays as 11 July. Every date a day early through the summer and right through the winter, so it survives being checked. Written as `yyyy-mm-dd` from the local parts, which cannot shift and still sorts chronologically |
| "Where does a member's name come from?" | The application's *"Who is this membership for?"* field, carried on the basket line as `memberName` and used by `fulfilment.createMembership`. **Not** the account holder — that was the old behaviour, and it made a parent's three children three records of the same name — and not the form, which no longer asks |

## Deleting a membership type withdraws it

`deleteMembershipType` is a **soft delete** — see [docs/SOFT_DELETE.md](../../docs/SOFT_DELETE.md).
`members` reference these rows: a type an organisation retires is still the type last season's
members hold. Lists, get-by-id, the account catalogue and renewal eligibility filter
`deleted = FALSE`; the reporting aggregate deliberately does not, so historical members and revenue
still count.
