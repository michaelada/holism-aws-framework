# Form Builder — `packages/orgadmin-core/src/forms`

The application-form builder. Organisations define reusable fields, assemble them into forms, and
other modules then reference a form by id — an event activity, a membership type or a registration
type all capture their data through a form built here. **Mandatory for event activities.**

Part of `orgadmin-core`, always available (no capability gate on the module itself).

## Routes (`forms/index.ts` → `formsModule`)

| Path | Page |
|---|---|
| `forms` | `FormsListPage` |
| `forms/new` | `FormBuilderPage` |
| `forms/:id/edit` | `FormBuilderPage` |
| `forms/:id/preview` | `FormPreviewPage` |
| `forms/fields` | `FieldsListPage` |
| `forms/fields/new` | `CreateFieldPage` |
| `forms/fields/:id/edit` | `EditFieldPage` |

Menu: two entries — "Forms" (`/forms`) and "Fields" (`/forms/fields`).

## The two-level model

1. **Fields** (`application_fields`) — reusable definitions owned by the organisation: name, label,
   datatype, validation, options, help text. Managed on the Fields pages.
2. **Forms** (`application_forms` + `application_form_fields`) — an ordered selection of fields,
   with optional grouping and wizard configuration. Managed in `FormBuilderPage`.

A field can appear on many forms; editing the field changes it everywhere.

## FormBuilderPage

The densest page in `orgadmin-core`. It holds:

- **Form metadata** — name, description, `status: 'draft' | 'published'`.
- **`selectedFields`** — the chosen `ApplicationFormField`s and their order/required flags.
- **`fieldGroups`** — named groups for laying fields out in sections.
- **`wizardConfig`** — optional `WizardConfiguration` of `WizardStep`s, turning the form into a
  multi-step wizard rather than one long page.
- **`availableFields`** — the organisation's field catalogue, loaded from
  `/api/orgadmin/application-fields`.

It is tabbed, with dialogs for adding a field, adding/editing a group, and adding/editing a wizard
step. Loading an existing form uses `/api/orgadmin/application-forms/:id/with-fields`, which
returns the form and its fields in one call.

Groups and wizard configuration arrived in migration
`1707000000016_add-form-groups-wizard-config`; the per-field `required` flag in
`1709000000002_add-required-to-application-form-fields`.

## Field types

`forms/hooks/useFilteredFieldTypes.ts` is the authoritative list:

```
text  textarea  number  email  phone  date  time  datetime
boolean  select  multiselect  radio  checkbox  file  image
```

`file` and `image` are filtered out unless the organisation has the **`document-management`**
capability. When an upload field "disappears", that capability is why.

Rendering is handled by `FieldRenderer` in `packages/components`, so **adding a datatype means
touching six places**: this list, the mapping in `packages/components/src/utils/applicationField.ts`,
a renderer, client validation (`ValidationService`), server validation
(`backend/src/utils/application-field-validation.ts`), and backend metadata support.

**A datatype is enforced, not a hint.** Each one constrains its answer on both sides — an `email`
field will not take prose, a `phone` field will not take letters, and a `select` will not take a
choice that is not on its list — without the form builder configuring anything. The two
implementations must agree; where they could differ, the client is aligned to the server so a
member is never told an answer is fine and then refused (`docs/APPLICATION_FORM_FIELD_TYPES.md`).

**The datatypes above are not the ones `FieldRenderer` switches on.** `radio` and `select` both
render as `single_select`, `checkbox` and `multiselect` as `multi_select`, `textarea` as
`text_area`, `file`/`image` as `document_upload`, and `phone` as plain text; `options` moves from
the field to `datatypeProperties`. Within each pair the datatype is the same and the presentation
differs — `radio` draws radio buttons and `checkbox` a wrapping row of checkboxes, while `select`
and `multiselect` put the same choices behind a dropdown. `applicationFieldToFieldDefinition` does that translation, and
every page that renders an application form — the preview here and the member-facing form in
`account-shell` — must use it. Miss it and the field silently renders as a text box, because that
is `FieldRenderer`'s fallback (`docs/APPLICATION_FORM_FIELD_TYPES.md`).

## Draft vs published

Forms carry a status. Draft forms are work in progress; other modules are meant to select published
forms. `FormPreviewPage` renders the form exactly as an applicant will see it, wizard steps
included — the quickest way to check grouping and step configuration.

## API endpoints

| Endpoint | Use |
|---|---|
| `GET /api/orgadmin/application-fields` | Field catalogue |
| `GET /api/orgadmin/application-forms` | Forms list |
| `GET /api/orgadmin/application-forms/:id/with-fields` | Form plus its fields |
| `PUT /api/orgadmin/application-forms/:id` | Save |
| `GET /api/orgadmin/organisations/:orgId/application-forms` | Form picker used by other modules |

Backend: `application-form.routes` → `application-form.service`; submissions via
`form-submission.service` into `form_submissions` / `form_submission_files`.

## Where to look for what

| Question | Start at |
|---|---|
| "Why isn't a file-upload field offered?" | `hooks/useFilteredFieldTypes.ts` + `document-management` capability |
| "How do wizard steps get configured?" | `FormBuilderPage.tsx` — `wizardConfig` state and its dialogs |
| "How does another module pick a form?" | `GET /organisations/:orgId/application-forms` (e.g. `EventActivityForm`) |
| "Where do submitted answers go?" | Backend `form-submission.service` → `form_submissions` |
| "Why does the form render differently to the builder?" | `FormPreviewPage.tsx` + `MetadataForm` in `packages/components` |
