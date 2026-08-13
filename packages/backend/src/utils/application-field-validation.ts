/**
 * Server-side validation of application-form answers.
 *
 * **Why this exists even though the client validates.** The client's gate is a
 * courtesy to the member — it names the field before they commit to paying.
 * It is not a guarantee: the endpoint is a plain authenticated POST, and a
 * submission is what a membership and an event entry are built from later.
 * `members.form_submission_id` is NOT NULL, so bad answers are not a display
 * problem; they are the record the club works from.
 *
 * The rules mirror `ValidationService` in `packages/components` (see
 * `docs/APPLICATION_FORM_FIELD_TYPES.md`). Where the two could differ, this one
 * is deliberately the more forgiving: rejecting something the form itself
 * produced would strand a member with an answer they cannot correct. So a
 * number arriving as `"12"` is accepted, and only answers that are wrong in
 * kind are refused.
 */

export interface ValidatableField {
  name: string;
  label?: string;
  datatype?: string;
  options?: unknown;
  /** Mandatory on this form — the `application_form_fields` join row. */
  required?: boolean;
  /** Mandatory wherever the field is used, plus any configured rules. */
  validation?: { required?: boolean } | null;
}

export interface FieldError {
  field: string;
  label: string;
  message: string;
}

/** Same permissive shape / strict content rule as the client. */
const PHONE_PATTERN = /^[+()\-.\s\d]+$/;
const PHONE_MIN_DIGITS = 6;

/**
 * Email, as a format check rather than a delivery check. Anything stricter
 * rejects addresses that work; anything looser accepts answers that are plainly
 * not addresses, which is what this is for.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isBlank = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && value.length === 0);

const isRequired = (field: ValidatableField): boolean =>
  field.required === true || field.validation?.required === true;

/** The offered choices, as strings, however they were stored. */
const allowedValues = (options: unknown): string[] => {
  if (!Array.isArray(options)) return [];
  return options
    .map((option) => {
      if (typeof option === 'string') return option;
      if (option && typeof option === 'object') {
        const candidate = option as { value?: unknown; label?: unknown };
        const value = candidate.value ?? candidate.label;
        return value === undefined || value === null ? null : String(value);
      }
      return null;
    })
    .filter((option): option is string => option !== null);
};

/** What is wrong with one answer, or `null`. */
export function validateFieldValue(field: ValidatableField, value: unknown): string | null {
  if (isRequired(field) && isBlank(value)) {
    return 'This answer is required';
  }
  // A blank optional answer is valid — "not filled in" is not "filled in wrongly".
  if (isBlank(value)) return null;

  const choices = allowedValues(field.options);

  switch (field.datatype) {
    case 'email':
      if (typeof value !== 'string' || !EMAIL_PATTERN.test(value.trim())) {
        return 'Must be a valid email address';
      }
      return null;

    case 'phone': {
      if (typeof value !== 'string' || !PHONE_PATTERN.test(value)) {
        return 'Must be a valid phone number';
      }
      if ((value.match(/\d/g) ?? []).length < PHONE_MIN_DIGITS) {
        return `Must contain at least ${PHONE_MIN_DIGITS} digits`;
      }
      return null;
    }

    case 'url':
      if (typeof value !== 'string') return 'Must be a valid web address';
      try {
        // eslint-disable-next-line no-new
        new URL(value);
        return null;
      } catch {
        return 'Must be a valid web address';
      }

    case 'number':
      // A numeric string is what an HTML form produces; only non-numbers fail.
      if (typeof value === 'number' ? !Number.isFinite(value) : Number.isNaN(Number(value))) {
        return 'Must be a number';
      }
      return null;

    case 'boolean':
      if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
        return 'Must be yes or no';
      }
      return null;

    case 'date':
    case 'time':
    case 'datetime':
      if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
        return 'Must be a valid date';
      }
      return null;

    case 'select':
    case 'radio':
      if (typeof value !== 'string') return 'Choose one of the offered options';
      if (choices.length > 0 && !choices.includes(value)) {
        return 'Choose one of the offered options';
      }
      return null;

    case 'multiselect':
    case 'checkbox': {
      if (!Array.isArray(value)) return 'Must be a list of choices';
      if (choices.length === 0) return null;
      const unknownChoice = value.find((entry) => !choices.includes(String(entry)));
      return unknownChoice === undefined ? null : 'Choose from the offered options';
    }

    case 'file':
    case 'image':
      if (!Array.isArray(value)) return 'Must be a list of files';
      return null;

    case 'text':
    case 'textarea':
    default:
      if (typeof value === 'object') return 'Must be text';
      return null;
  }
}

/**
 * Every answer that is missing or wrong, in field order.
 *
 * Answers for fields the form does not contain are ignored rather than
 * rejected: a form edited between the page load and the submit would otherwise
 * fail with an error the member cannot act on, and an extra key is harmless —
 * nothing downstream reads by anything but field name.
 */
export function validateSubmissionData(
  fields: ValidatableField[],
  submissionData: Record<string, unknown>
): FieldError[] {
  const data = submissionData ?? {};

  return fields
    .map((field) => {
      const message = validateFieldValue(field, data[field.name]);
      return message === null
        ? null
        : { field: field.name, label: field.label ?? field.name, message };
    })
    .filter((error): error is FieldError => error !== null);
}
