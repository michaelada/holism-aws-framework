# Application-form field types render as themselves

## The symptom

A club attached an application form to an event activity. On the **account-user app** the form
appeared, the fields were in the right order and the labels were right — but every field was a
plain text box. Radio groups, checkbox lists, dropdowns and multi-selects all looked identical, and
none of them offered the choices the administrator had configured. The same form previewed
correctly in org-admin.

## Why

Three separate translations sit between an application form and `FieldRenderer`, and **all three
fail silently**:

| The form builder writes | `FieldRenderer` reads |
|---|---|
| `name`, `label` | `shortName`, `displayName` |
| `radio`, `checkbox`, `select`, `multiselect`, `textarea`, `phone`, `file`, `image` | `single_select`, `multi_select`, `text_area`, `text`, `document_upload` |
| `options: ['Under 12', 'Under 14']` on the field | `datatypeProperties.options: [{value, label}]` |

`FieldRenderer`'s `switch` ends in `default: return <TextRenderer …/>`. An unrecognised datatype
therefore does not throw and does not warn — it renders a text box. A select whose options never
arrive renders an empty dropdown. Neither shows up as an error anywhere.

The translation existed, but as a private copy inside each of the two org-admin pages that preview
a form (`FormPreviewPage`, `CreateFieldPage`). The account-user app, written later, had no copy —
so the administrator's preview was right and the member's form was wrong.

## The fix

One shared translation, in the package both front ends already depend on
(CLAUDE.md §1.5): `packages/components/src/utils/applicationField.ts`.

```ts
import { applicationFieldToFieldDefinition, emptyValueForField } from '@itsplainsailing/components';

<FieldRenderer
  fieldDefinition={applicationFieldToFieldDefinition(field)}
  value={values[field.name] ?? emptyValueForField(field)}
  onChange={(value) => setValues((previous) => ({ ...previous, [field.name]: value }))}
/>
```

| Export | Does |
|---|---|
| `applicationFieldToFieldDefinition(field)` | Names, datatype, options, radio-vs-dropdown presentation, image-only uploads |
| `mapApplicationDatatype(datatype)` | Builder datatype → renderer datatype. Idempotent, so an already-mapped field is not degraded |
| `mapApplicationOptions(options)` | Strings *or* `{value,label}` objects → `{value,label}` pairs; anything else yields none rather than throwing |
| `emptyValueForField(field)` | `[]` for multi-select and upload, `false` for boolean, `''` otherwise |

Mapping decisions worth knowing:

- **The datatype decides what may be answered; `displayMode` decides whether the member has to open
  something to see the choices.** `radio` and `checkbox` are the builder's *expanded* types — the
  options laid out and all visible — while `select` and `multiselect` are the same two answers
  behind a dropdown:

  | Builder type | Datatype | `displayMode` | Renders as |
  |---|---|---|---|
  | `radio` | `single_select` | `radio` | Radio buttons |
  | `select` | `single_select` | `dropdown` | Dropdown |
  | `checkbox` | `multi_select` | `checkbox` | A row of checkboxes, wrapping |
  | `multiselect` | `multi_select` | `dropdown` | Dropdown with checkboxes in its menu |

- **A checkbox field is a row, not a dropdown.** For the handful of options a club usually writes,
  making the member open a menu to discover three choices is a click for nothing, and the answer is
  not readable at a glance afterwards. The dropdown stays the default for `multiselect`, where a
  long option list would otherwise fill the form. The row wraps, so six options or two long ones
  behave on a phone. A single yes/no tick-box is the separate `boolean` type.
- **`phone` → `text`.** No phone renderer exists; a text box is the honest fallback rather than a
  silent one.
- **`image` → `document_upload`** plus `fileType: 'image'`, which is what makes the upload accept
  images only.

Call sites now sharing it: `EntryFormPage` and `ApplicationFormDialog` (`account-shell`),
`FormPreviewPage` and `CreateFieldPage` (`orgadmin-core`). The org-admin copies were deleted, so
the preview an administrator sees and the form a member fills in cannot drift apart again.

## The datatype is enforced, not decorative

The same gap ran through validation. `ValidationService` built its schema from the field's
**configured rules** only, so `email` was `yup.string()` with nothing attached unless the form
builder had also added an "email" rule — which it never does, because the builder writes no rules at
all. An email field accepted `not an email`; a phone field accepted a sentence, and `phone` was
mapped to plain text so nothing could have checked it anyway.

The datatype now constrains the value on its own, before any configured rule narrows it further:

| Datatype | Enforced |
|---|---|
| `email` | `something@something.tld` |
| `phone` | Digits and the punctuation people write numbers with (`+ ( ) - .` and spaces), at least 6 digits |
| `url` | Parseable web address |
| `number` | A number (a numeric string is accepted — that is what an HTML form produces) |
| `date` / `time` / `datetime` | A real date |
| `boolean` | true / false |
| `single_select` | One of the offered options, when the field has options |
| `multi_select` | A list, every entry one of the offered options |
| `document_upload` | A list |

`phone` is now its own datatype (`FieldDatatype.PHONE`) rather than an alias for text: it renders
through `TextRenderer` as `type="tel"` — a phone keypad on a handset and a `tel` autofill target —
and is validated as a phone number. A blank optional answer is always valid: *not filled in* is not
*filled in wrongly*, and checking format over empty strings would flag every untouched field.

**One email pattern, not Yup's.** `yup.string().email()` accepts `member@club` — a hostname with no
dot, valid on an intranet and a typo on a club entry form. The server requires the dot, so the
client does too. A client that accepts what the server rejects sends the member to a 400 *after*
they have committed to entering, against a field they were told was fine.

### Three places, one answer

| Where | What it does |
|---|---|
| `FieldRenderer` (on blur) | Shows the message under the field the member just left |
| `EntryFormPage` (every keystroke) | Disables **Add to basket** and names the fields, via `validateApplicationField` |
| `POST /api/account/:orgCode/form-submissions` | Refuses the submission with `400 INVALID_SUBMISSION` and a per-field list |

The server check is not belt-and-braces politeness. The endpoint is a plain authenticated POST, and
`members.form_submission_id` is NOT NULL — a bad submission is not a bad screen, it is the record
the club works from. It lives in `backend/src/utils/application-field-validation.ts`, deliberately
the more forgiving of the two where they could differ: rejecting something the form itself produced
would strand a member with an answer they cannot correct. Answers for fields the form no longer
contains are ignored rather than refused, since a form edited between page load and submit would
otherwise fail with an error the member cannot act on.

The page distinguishes *missing* from *wrong* — "Still needed: …" and "Check these answers: …" are
different instructions, and a member told only that something is missing goes looking for an empty
box that is not there.

## Accessibility fixed alongside

Writing the tests exposed that the choice fields had a visible label and **no accessible name**:

- `SelectRenderer` and `MultiSelectRenderer` rendered an `InputLabel` and a `Select` that were never
  linked. MUI needs `labelId`/`id` for that; without it a screen reader announces an unnamed combo
  box and `getByLabelText` cannot find the control. The radio branch now names its `RadioGroup`
  through `aria-labelledby` as well.
- `DocumentUploadRenderer` rendered the field's name as free-standing `Typography`. It is now a
  real `<label htmlFor>` bound to the file input.

## Tests

- `packages/components/src/utils/__tests__/applicationField.test.ts` — every builder datatype,
  option shape, idempotency, and the empty-value rules.
- `packages/components/src/components/FieldRenderer/__tests__/MultiSelectRenderer.test.tsx` — both
  presentations: the row of checkboxes (layout, group name, ticking and un-ticking, disabled,
  errors) and the dropdown that remains the default.
- `packages/backend/src/utils/__tests__/application-field-validation.test.ts` — every datatype the
  server accepts and refuses, including the forgiving cases (numeric strings, unknown datatypes,
  answers for removed fields).
- `packages/backend/src/routes/__tests__/account-form-submissions.routes.test.ts` — the endpoint
  refuses and stores nothing, naming every bad answer at once rather than one per attempt.
- `packages/account-shell/src/pages/__tests__/EntryFormPage.test.tsx` — asserts the **control**, not
  the label: radio buttons for a radio field, comboboxes for select/multiselect/checkbox, the stored
  options in the menu, the chosen value reaching the submission, and a required choice gating the
  button.

The pre-existing tests asserted labels only, which is why every field rendering as a text box was
invisible to them.

## Related

- `.claude/modules/components.md` — the helper's place in the shared library
- `.claude/modules/core-forms.md` — the builder's datatype list and what adding one now costs
- `.claude/modules/account-shell.md` — entry-form behaviour
