/**
 * Application-form fields → `FieldDefinition`, the shape `FieldRenderer` reads.
 *
 * The form builder and the renderer do not speak the same language, and the gap
 * is silent in both directions:
 *
 * - **Datatype.** `application_fields.datatype` holds the *builder's* vocabulary
 *   — `radio`, `checkbox`, `select`, `multiselect`, `textarea`, `phone`, `file`,
 *   `image`. `FieldRenderer` switches on the *metadata* vocabulary — `text`,
 *   `single_select`, `multi_select`, `document_upload` — and its `default` case
 *   is `TextRenderer`. An unmapped datatype therefore does not fail; it quietly
 *   renders as a text box, which is exactly how a radio group, a checkbox list
 *   and a dropdown all came to look identical on the member-facing form.
 * - **Options.** The builder saves `options` as a plain string array on the
 *   field. Every renderer reads `datatypeProperties.options` as `{value,label}`
 *   pairs. Left untranslated, a select renders with no choices at all.
 * - **Names.** The API answers with `name`/`label`; the renderers read
 *   `shortName`/`displayName`, so without the rename each field renders with no
 *   label.
 *
 * Mapping is idempotent: a field already carrying metadata-vocabulary values
 * passes through unchanged, so this is safe to apply to either source.
 *
 * @see CLAUDE.md §1.5 — shared between the org-admin form preview and the
 * account-user application form, so it lives here rather than in either app.
 */

import { FieldDatatype } from '../types';
import type { FieldDefinition, ValidationRule } from '../types';
import { defaultValidationService } from '../validation';

/** How a field arrives from `/application-forms/:id/with-fields` and its account twin. */
export interface ApplicationFieldLike {
  name?: string;
  label?: string;
  /** Already-mapped equivalents, tolerated so the helper can be applied twice. */
  shortName?: string;
  displayName?: string;
  description?: string | null;
  datatype?: string;
  options?: unknown;
  validation?: { required?: boolean; rules?: ValidationRule[] } | null;
}

/**
 * Builder datatype → renderer datatype.
 *
 * The metadata names map to themselves so that a field which has already been
 * normalised — or which came from `field_definitions` rather than the form
 * builder — is not degraded to text on a second pass.
 */
const DATATYPE_MAP: Record<string, FieldDatatype> = {
  // Builder vocabulary
  text: FieldDatatype.TEXT,
  textarea: FieldDatatype.TEXT_AREA,
  number: FieldDatatype.NUMBER,
  email: FieldDatatype.EMAIL,
  url: FieldDatatype.URL,
  phone: FieldDatatype.PHONE,
  date: FieldDatatype.DATE,
  time: FieldDatatype.TIME,
  datetime: FieldDatatype.DATETIME,
  boolean: FieldDatatype.BOOLEAN,
  select: FieldDatatype.SINGLE_SELECT,
  multiselect: FieldDatatype.MULTI_SELECT,
  radio: FieldDatatype.SINGLE_SELECT,
  // A checkbox *list* is a multi-select; MultiSelectRenderer draws checkboxes.
  checkbox: FieldDatatype.MULTI_SELECT,
  file: FieldDatatype.DOCUMENT_UPLOAD,
  image: FieldDatatype.DOCUMENT_UPLOAD,

  // Metadata vocabulary, mapped to itself
  text_area: FieldDatatype.TEXT_AREA,
  single_select: FieldDatatype.SINGLE_SELECT,
  multi_select: FieldDatatype.MULTI_SELECT,
  document_upload: FieldDatatype.DOCUMENT_UPLOAD,
};

/** Nothing has been answered here. */
function isBlank(value: unknown): boolean {
  if (Array.isArray(value)) return value.length === 0;
  return value === undefined || value === null || value === '';
}

/** Builder types whose choices are shown laid out rather than behind a dropdown. */
const EXPANDED_DISPLAY_MODES: Record<string, string> = {
  radio: 'radio',
  checkbox: 'checkbox',
};

/** The datatype `FieldRenderer` should switch on, given a stored one. */
export function mapApplicationDatatype(datatype?: string | null): FieldDatatype {
  if (!datatype) return FieldDatatype.TEXT;
  return DATATYPE_MAP[datatype] ?? FieldDatatype.TEXT;
}

/**
 * Stored options → the `{value,label}` pairs the renderers expect.
 *
 * The builder writes strings, but options edited elsewhere (or seeded) may
 * already be objects, so both are accepted. Anything else yields no options
 * rather than a crash — a select with nothing to choose is recoverable, a
 * render-time throw takes the whole form down.
 */
export function mapApplicationOptions(options: unknown): Array<{ value: string; label: string }> {
  if (!Array.isArray(options)) return [];

  return options
    .map((option) => {
      if (typeof option === 'string') return { value: option, label: option };
      if (option && typeof option === 'object') {
        const candidate = option as { value?: unknown; label?: unknown };
        const value = candidate.value ?? candidate.label;
        if (value === undefined || value === null) return null;
        return { value: String(value), label: String(candidate.label ?? value) };
      }
      return null;
    })
    .filter((option): option is { value: string; label: string } => option !== null);
}

/**
 * The `fieldDefinition` prop for an application-form field.
 *
 * @example
 * ```tsx
 * <FieldRenderer
 *   fieldDefinition={applicationFieldToFieldDefinition(field)}
 *   value={values[field.name]}
 *   onChange={(value) => setValues({ ...values, [field.name]: value })}
 * />
 * ```
 */
export function applicationFieldToFieldDefinition(field: ApplicationFieldLike): FieldDefinition {
  const datatype = mapApplicationDatatype(field.datatype);
  const options = mapApplicationOptions(field.options);

  const datatypeProperties: Record<string, any> = {};

  if (options.length > 0) {
    datatypeProperties.options = options;
    /*
     * `radio` and `checkbox` are the builder's *expanded* types — the choices
     * laid out and all visible, one control each for pick-one and pick-many.
     * `select` and `multiselect` are the same two answers behind a dropdown.
     * The datatype decides which answer is allowed; the display mode decides
     * whether the member has to open something to see the choices.
     */
    datatypeProperties.displayMode = EXPANDED_DISPLAY_MODES[field.datatype ?? ''] ?? 'dropdown';
  }

  if (field.datatype === 'image') {
    datatypeProperties.fileType = 'image';
    datatypeProperties.acceptImages = true;
  }

  return {
    shortName: field.shortName ?? field.name ?? '',
    displayName: field.displayName ?? field.label ?? '',
    description: field.description ?? '',
    datatype,
    datatypeProperties,
    validationRules: field.validation?.rules ?? [],
  };
}

/**
 * What is wrong with this answer, or `null` if nothing is.
 *
 * One place decides, so that the submit button, the field's own message and
 * the server all agree. Required-ness is checked here rather than in the
 * schema because it does not live on the field: a field is mandatory *on a
 * form*, via the `application_form_fields` join row, and the same field can be
 * optional on the next form.
 *
 * A blank optional answer is valid — "not filled in" is not "filled in wrongly",
 * and running format checks over an empty string reports every untouched field
 * as an error.
 */
export function validateApplicationField(
  field: ApplicationFieldLike,
  value: unknown,
  required = false
): string | null {
  const blank = isBlank(value);

  if (required && blank) return `${field.label ?? field.displayName ?? 'This field'} is required`;
  if (blank) return null;

  const { valid, error } = defaultValidationService.validateFieldSync(
    applicationFieldToFieldDefinition(field),
    value
  );

  return valid ? null : error ?? 'Invalid value';
}

/**
 * The value an unanswered field should start at.
 *
 * Multi-selects and uploads are array-valued; handing them `''` makes MUI warn
 * about a controlled value of the wrong type, and makes "has this been
 * answered?" checks compare a string against an array.
 */
export function emptyValueForField(field: ApplicationFieldLike): unknown {
  const datatype = mapApplicationDatatype(field.datatype);

  if (datatype === FieldDatatype.MULTI_SELECT) return [];
  if (datatype === FieldDatatype.DOCUMENT_UPLOAD) return [];
  if (datatype === FieldDatatype.BOOLEAN) return false;
  return '';
}
