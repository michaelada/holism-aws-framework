# `packages/components` — Shared component library

The cross-front-end library. **Per project rule §1.5, anything another front end (e.g. the Account
User Interface) could reuse belongs here** rather than in one app.

- **Consumed by:** `frontend`, `admin`, `orgadmin-*` (aliased to `src` in dev, so no rebuild).
- **Tests:** Vitest — `npm run test:components` (~33 test files).
- **Package name:** `@itsplainsailing/components`.

## Public surface (`src/index.ts`)

```ts
export * from './theme';                        // ThemeProvider, defaultTheme
export * from './types';                        // metadata.types and friends
export * from './api';                          // configured axios client
export * from './validation';                   // validator
export * from './hooks';                        // useMetadata, useObjectInstances, …
export * from './components/FieldRenderer';
export * from './components/MetadataForm';
export * from './components/MetadataTable';
export * from './components/MetadataWizard';
export * from './components/OrgDataTable';
export * from './components/OrgPaymentWidget';
export * from './components/OrgDatePicker';
export * from './components/OrgFileUpload';
export * from './components/discount';
```

## The metadata-driven family

The library's core idea: object and field definitions from the metadata repository drive the UI, so
new entity types need no bespoke components.

| Component | Purpose |
|---|---|
| `renderTicketHTML` (`utils/ticketRender`) | A ticket as HTML — printed by the org-admin and previewed by the ticketing settings screen, so what a club approves is what a member receives. Four image placements, three layouts, one-or-two dates, and a **QR panel that is always white** whatever else the club chose. Everything inline: no stylesheet, no web font, no network, because the HTML is written into a print frame and printed a moment later |
| `AnnouncementCard` | One club announcement — the member's home page and the org-admin's **preview** render this same component, which is what stops a preview drifting from the thing it previews. Three image placements: `header`, `footer`, and `background`, where the card lays a gradient scrim over the picture and writes in white so legibility does not depend on the photograph a club happened to upload |
| `FieldRenderer` | One field from its definition. Renderers: `TextRenderer`, `NumberRenderer`, `BooleanRenderer`, `DateRenderer`, `SelectRenderer`, `MultiSelectRenderer`, `DocumentUploadRenderer`. `SelectRenderer` and `MultiSelectRenderer` each have two presentations, chosen by `datatypeProperties.displayMode`: radio buttons or a dropdown for one answer, a row of checkboxes or a dropdown for many |
| `MetadataForm` | A full form from an object definition; `MetadataReadOnlyView` for display |
| `MetadataTable` | Definition-driven table; `VirtualizedMetadataTable` for large sets |
| `MetadataWizard` | Multi-step form from a `WizardConfiguration`; `WizardStepForm` per step |

Types in `types/metadata.types.ts`: `FieldDatatype`, `ValidationType`, `ValidationRule`,
`FieldDefinition`, `ObjectFieldReference`, `FieldGroup`, `WizardStep`, `WizardConfiguration`,
`ObjectDefinition`, `FieldError`, `ValidationResult`, `ListQueryParams`, `ListResponse<T>`,
`ErrorResponse`.

**Adding a field datatype** means: the enum, a renderer, validation support, and backend metadata
support — all four, or the type renders as unsupported.

**The datatype validates itself.** `ValidationService.buildFieldSchema` constrains the value from
the datatype before any configured rule narrows it: email and phone formats, a real number, a real
date, a choice that is actually on offer. It used to apply only the rules attached to a field, and
the application-form builder attaches none — so an `email` field accepted anything. Note the email
pattern is deliberately **not** Yup's `.email()`, which passes `member@club`; it matches the
backend's, and the two must stay in step (`docs/APPLICATION_FORM_FIELD_TYPES.md`).
`validateFieldSync` is the same check for a form that has to answer "may this be submitted?" during
render.

## Other component groups

| Group | Contents |
|---|---|
| `OrgDataTable` | General-purpose data grid used across org-admin lists |
| `OrgDatePicker` | `DateRangePicker`, `TimeSlotPicker` |
| `OrgFileUpload` | `FileUpload`, `ImageUpload` |
| `OrgPaymentWidget` | `PaymentDetails`, `PaymentList`, `RefundDialog` |
| `discount` | `DiscountSelector`, `DiscountSummary` — used by every capability module's discount UI |
| `PoweredByFooter` | "Powered by ItsPlainSailing.com – © YYYY Esker Software. All rights reserved", with the mark. Presentational: both strings and `logoSrc` are props, and **the year is the caller's** — baked into a translation it would go quietly wrong every 1st of January. The Keycloak account-user theme renders the same footer a second time in FreeMarker, using `.now?string('yyyy')`. See [docs/PLATFORM_POSTS.md](../../docs/PLATFORM_POSTS.md) |
| `PostCard` | One platform announcement — image, title, message, links, in that order. A tinted panel (`#faf8f5`, 12px radius, soft shadow), because these pages are white and a white card does not read as one. The same values are repeated in `account-user/login/resources/css/account.css` (a FreeMarker theme cannot read a MUI theme) and **must change with it**; the org-admin theme expresses the same look through its own tokens, which is where it came from. Used by the account app's organisation gateway. The Keycloak login themes render **the same card a second time** in plain JS (`infrastructure/keycloak/themes/*/login/resources/js/posts.js`) because they have no React; the two must be kept in step. See [docs/PLATFORM_POSTS.md](../../docs/PLATFORM_POSTS.md) |
| `auditLabels` (utils) | `auditActionLabel`, `auditFieldLabel`, `humaniseFieldName`, `AUDIT_ACTION_LABELS` (all 109 registered actions), `AUDIT_FIELD_LABELS`. The **single English source** for turning audit identifiers into words: Platform Admin uses it directly, the org-admin passes each string to `t()` as `defaultValue` so an untranslated locale degrades to readable English rather than a raw key. Two label lists would have drifted |
| `signOutReport` (utils) | `reportSignOut({ token, application })` — tells the API a session is ending, because a sign-out is a redirect to Keycloak and no request ever reaches the server as it happens. Used by all four front ends on the way out. `keepalive: true` is the whole point: the redirect starts immediately after, and a normal request is cancelled when the page goes away. Every error is swallowed — a lost sign-out row is a gap in a log, a failed sign-out is a security problem. See [docs/AUDIT_SESSION_EVENTS_FIX.md](../../docs/AUDIT_SESSION_EVENTS_FIX.md) |
| `eventSettings` (utils) | `describeSettings`, `humaniseSettingKey`, `keysInGroups`. Turns a template's **flat map of dotted keys** into labelled, grouped, typed rows — the settings panel that appears three times (platform template, organisation type, club) and must look the same each time. Nothing declares what a setting *is*: the keys say which exist, the dots group them, the value's type picks the input, and only the wording is optional data (`shape.settingLabels`, else the key humanised). A second list of settings would be one to forget, and its failure mode is a setting that resolves and is invisible. Rows sort **by label**, because a jsonb column does not preserve the order its keys were written in |
| `AuditChanges` | What an audit event changed — a field diff (before → after), or a whole row for a create or delete. Shared by the Platform Admin and org-admin viewers so **one event is never rendered two ways**. A redacted value shows a **lock**, not a blank: "this field changed and we are not showing you to what" is information, where an empty cell reads as "not touched". Field names are rendered through `formatField` (defaulting to `auditFieldLabel`), and `formatAuditValue` — exported here — renders timestamps in the reader's timezone and date-only values without an invented midnight. Every string arrives via `labels`, and `formatValue` is the caller's — money and dates are their business, and the formatter is never handed a redacted value. See [docs/AUDIT_TRAIL_AND_SESSIONS.md](../../docs/AUDIT_TRAIL_AND_SESSIONS.md) §2.4 |
| `EntrantNameField` | Who an event entry is for. Presentational — it neither fetches nor debounces, and every string arrives via `labels`; the app owning the API and the translations keeps owning them. `autocomplete: false` renders a plain text box (a club with no roster); `allowFreeText: false` makes it refuse an unmatched name, clearing it on blur so the refusal happens at the field rather than after the whole form is filled in. See [docs/ENTRANT_NAME.md](../../docs/ENTRANT_NAME.md) |

## Hooks

- `useMetadata`, `useObjectDefinitions`, `useFieldDefinitions` — load definitions.
- `useObjectInstances` — list/query instance data.
- `useFieldValidation` — validate a value against its field's rules.
- `useWizard` — step state, navigation and per-step validation.

## Theme and API

- `theme/ThemeProvider` + `defaultTheme` — the shared MUI theme; app-specific themes extend it.
- `api/client.ts` — configured axios instance. Note that org-admin code normally goes through
  `useApi` in `orgadmin-core` instead, because that is what injects the Keycloak token.

## Gotchas

- MUI date pickers must resolve to a **single** module instance; the shell's `dedupe` config exists
  for this. Importing `@mui/x-date-pickers` here and again in a consumer previously produced the
  "Can not find utils in context" blank screen (`docs/DATE_PICKER_*.md`).
- The package is built as an ES-module library with React and MUI externalised, so it must not
  assume a bundler-provided global.

## Application-form fields

`utils/applicationField.ts` — the translation between the **form builder's** vocabulary and the
**renderer's**. `application_fields` stores `radio`, `checkbox`, `select`, `multiselect`,
`textarea`, `phone`, `file`, `image` and keeps `options` as a plain string array on the field;
`FieldRenderer` switches on `single_select` / `multi_select` / `text_area` / `document_upload` and
reads `datatypeProperties.options` as `{value,label}` pairs.

The gap is silent — `FieldRenderer`'s `default` case is `TextRenderer` — so an unmapped datatype
renders as a text box rather than failing. That is exactly how radio, checkbox, select and
multiselect fields all reached members of the account-user app as identical empty text boxes
(`docs/APPLICATION_FORM_FIELD_TYPES.md`).

The datatype says what may be answered; `displayMode` says whether the choices are laid out or
behind a dropdown. `radio` → `single_select` + `radio`, `checkbox` → `multi_select` + `checkbox`
(a wrapping row of checkboxes), while `select` and `multiselect` map to the same two datatypes with
`dropdown`.

| Export | Use |
|---|---|
| `applicationFieldToFieldDefinition(field)` | The whole `fieldDefinition` prop — names, datatype, options, image flags |
| `validateApplicationField(field, value, required)` | What is wrong with an answer, or `null`. Required-ness is passed in because it lives on the *form*, not the field |
| `mapApplicationDatatype(datatype)` | Builder datatype → renderer datatype, idempotent |
| `mapApplicationOptions(options)` | Stored strings (or objects) → `{value,label}` pairs |
| `emptyValueForField(field)` | The starting value: `[]` for multi-select and upload, `false` for boolean, `''` otherwise |

Every consumer of an application form must go through it: `EntryFormPage` and
`ApplicationFormDialog` in `account-shell`, `FormPreviewPage` and `CreateFieldPage` in
`orgadmin-core`. The mapping used to be copied into the two org-admin pages, which is why the
member-facing copy could be — and was — missing.

## Ticket generation

`utils/ticketGeneration.ts` — ticket references (`TKT-YYYY-NNNNNN`), QR data URLs and buffers, and
ticket PDF HTML. Moved here from `orgadmin-ticketing` (CLAUDE.md §1.5) once the account-user app
started rendering the same ticket a gate scans.

**The reference format is duplicated on purpose.** `validateTicketReference` here, and the
`TKT-YYYY-NNNNNN` construction in SQL in `backend/src/services/ticketing.service.ts`, which builds
it from a Postgres sequence. A change to one without the other produces references the client
rejects as malformed; a test in `__tests__/ticketGeneration.test.ts` asserts they agree.

## Formatting

`utils/formatting.ts` — `formatCurrency`, `formatDisplayDate` / `formatDisplayDateTime`,
`formatDateRange`, and the ordinal pair below. All fall back rather than throw: an unrecognised
currency renders a plain figure, and a null or unparseable date renders an em dash, because
"Invalid Date" in a table reads as a fault in the member's own record.

**`formatOrdinalDate` / `formatOrdinalDateTime`** add the ordinal day — "22nd Sept 2026" — for dates
read as a deadline rather than scanned in a column. The suffix table covers **English** (`st`/`nd`/
`rd`/`th`, selected by `Intl.PluralRules` with `type: 'ordinal'`, which is what knows 21 takes `st`
while 11 takes `th`) and **French** (`1er`, then nothing). German already writes `1.`, and Spanish,
Italian and Portuguese use a plain numeral, so those come back exactly as `Intl` rendered them —
inventing a suffix would be a wrong date in a language we do not speak.

Built on `formatToParts`, rewriting only the `day` token, so each locale keeps its own order and
separators and a two-digit hour is never suffixed as if it were a day.

## Where to look for what

| Question | Start at |
|---|---|
| "How is a field of type X rendered?" | `components/FieldRenderer/renderers/` |
| "Why does a date field say 'Must be a valid date' when one has been picked?" | It did, twice over: an empty date cast to an Invalid Date, and the picker's popover blurs the input *before* the chosen date arrives as a prop. `FieldRenderer` validates through a ref and clears a corrected error without waiting for another blur; the validator treats `''` as unanswered. See [DATE_FIELD_AND_REPEAT_ENTRIES.md](../../docs/DATE_FIELD_AND_REPEAT_ENTRIES.md) |
| "Why is a form answer showing an ISO date?" | It should not: `formatFormAnswer` renders `date`, `datetime` and `time` answers with the app's own date formatters, from the `datatype` the server now sends alongside each answer. Everything else is already display text |
| "Why is an already-entered member still selectable?" | Because an activity may be entered more than once — one rider, two horses. `alreadyEntered` is a label beside the name, not a disabled option |
| "Why is this date '22 Sept' here and '22nd Sept' there?" | `utils/formatting.ts` — ordinals are for deadlines, and only in English and French |
| "Why does an application-form field render as a text box?" | `utils/applicationField.ts` — its datatype is unmapped, and the fallback is `TextRenderer` |
| "How do I show a definition-driven form?" | `components/MetadataForm/MetadataForm.tsx` |
| "Where does the discount picker live?" | `components/discount/DiscountSelector.tsx` |
| "What shapes do metadata objects have?" | `types/metadata.types.ts` |
| "Should this go here or in orgadmin-core?" | Here if a non-org-admin front end could use it |
